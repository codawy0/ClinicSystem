using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Clinic.Api.Common.Enums;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Infrastructure;
using Clinic.Api.Models.Import;

namespace Clinic.Api.Controllers;

[Route("api/[controller]")]
[Authorize(Roles = "Admin,Doctor")]
public class ImportController : ApiControllerBase
{
    private readonly ClinicDbContext _context;
    private readonly ILogger<ImportController> _logger;

    public ImportController(
        ClinicDbContext context,
        ILogger<ImportController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // POST /api/import/patients?dryRun=true|false
    [HttpPost("patients")]
    public async Task<ActionResult<PatientImportSummaryDto>> ImportPatients(
        [FromQuery] bool dryRun = true,
        IFormFile? file = null)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("يرجى اختيار ملف CSV صالح للاستيراد.");
        }

        if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("امتداد الملف يجب أن يكون .csv.");
        }

        if (file.Length > 10 * 1024 * 1024)
        {
            return BadRequest("حجم الملف يتجاوز الحد الأقصى المسموح به (10 ميجابايت).");
        }

        List<List<string>> records;
        try
        {
            await using var stream = file.OpenReadStream();
            records = ParseCsv(stream);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse CSV file for patient import.");
            return BadRequest("فشل تحليل ملف الـ CSV. يرجى التأكد من تنسيق الملف.");
        }

        if (records.Count < 2)
        {
            return BadRequest("الملف لا يحتوي على بيانات كافية (يجب وجود سطر العناوين وسطر بيانات واحد على الأقل).");
        }

        var headers = records[0];
        int nameIdx = FindHeaderIndex(headers, "fullname", "name", "الاسم", "اسم المريض", "الاسم بالكامل", "الاسم_بالكامل");
        int phoneIdx = FindHeaderIndex(headers, "phone", "mobile", "الهاتف", "الموبايل", "رقم الهاتف", "رقم_الهاتف", "تليفون");
        int nidIdx = FindHeaderIndex(headers, "nationalid", "national_id", "الرقم القومي", "الرقم_القومي", "الهوية", "الرقم_الوطني");
        int genderIdx = FindHeaderIndex(headers, "gender", "النوع", "الجنس");
        int birthDateIdx = FindHeaderIndex(headers, "birthdate", "dateofbirth", "dob", "تاريخ الميلاد", "تاريخ_الميلاد");
        int ageIdx = FindHeaderIndex(headers, "age", "العمر", "السن");
        int addressIdx = FindHeaderIndex(headers, "address", "العنوان");
        int notesIdx = FindHeaderIndex(headers, "notes", "medicalnotes", "ملاحظات", "الملاحظات");

        if (nameIdx == -1 || phoneIdx == -1)
        {
            return BadRequest("يجب أن يحتوي الملف على عمودي 'الاسم' و 'الهاتف' على الأقل.");
        }

        // Existing patients in DB for duplicate checking
        var existingPatients = await _context.Patients.AsNoTracking().ToListAsync();
        var existingPhones = existingPatients
            .Where(p => !string.IsNullOrEmpty(p.NormalizedPhone))
            .ToDictionary(p => p.NormalizedPhone, p => p.FileNumber, StringComparer.OrdinalIgnoreCase);

        var existingNids = existingPatients
            .Where(p => !string.IsNullOrEmpty(p.NationalId))
            .ToDictionary(p => p.NationalId!, p => p.FileNumber, StringComparer.OrdinalIgnoreCase);

        // Next file sequence calculation
        int maxFileSeq = 1000;
        foreach (var p in existingPatients)
        {
            if (p.FileNumber.StartsWith("F-", StringComparison.OrdinalIgnoreCase) &&
                int.TryParse(p.FileNumber[2..], out var num))
            {
                if (num > maxFileSeq) maxFileSeq = num;
            }
        }
        int nextFileSeq = maxFileSeq + 1;

        var seenPhones = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var seenNids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var summary = new PatientImportSummaryDto
        {
            IsDryRun = dryRun,
            TotalRowsProcessed = records.Count - 1
        };

        var patientsToInsert = new List<Patient>();

        for (int i = 1; i < records.Count; i++)
        {
            var row = records[i];
            var rowDto = new PatientImportRowDto { RowNumber = i };

            string rawName = GetVal(row, nameIdx);
            string rawPhone = GetVal(row, phoneIdx);
            string rawNid = nidIdx != -1 ? GetVal(row, nidIdx) : string.Empty;
            string rawGender = genderIdx != -1 ? GetVal(row, genderIdx) : string.Empty;
            string rawBirthDate = birthDateIdx != -1 ? GetVal(row, birthDateIdx) : string.Empty;
            string rawAge = ageIdx != -1 ? GetVal(row, ageIdx) : string.Empty;
            string rawAddress = addressIdx != -1 ? GetVal(row, addressIdx) : string.Empty;
            string rawNotes = notesIdx != -1 ? GetVal(row, notesIdx) : string.Empty;

            rowDto.FullName = rawName.Trim();
            rowDto.Phone = rawPhone.Trim();
            rowDto.NationalId = !string.IsNullOrWhiteSpace(rawNid) ? rawNid.Trim() : null;
            rowDto.Address = !string.IsNullOrWhiteSpace(rawAddress) ? rawAddress.Trim() : null;
            rowDto.Notes = !string.IsNullOrWhiteSpace(rawNotes) ? rawNotes.Trim() : null;

            // Name validation
            if (string.IsNullOrWhiteSpace(rowDto.FullName) || rowDto.FullName.Length < 2)
            {
                rowDto.IsValid = false;
                rowDto.ErrorMessage = "اسم المريض يجب ألا يقل عن حرفين.";
            }

            // Phone normalization and validation
            string normalizedPhone = ArabicNormalizer.NormalizePhone(rowDto.Phone);
            rowDto.NormalizedPhone = normalizedPhone;

            if (string.IsNullOrEmpty(normalizedPhone) || normalizedPhone.Length != 11)
            {
                rowDto.IsValid = false;
                rowDto.ErrorMessage = rowDto.ErrorMessage != null
                    ? $"{rowDto.ErrorMessage}; رقم هاتف مصري غير صالح"
                    : "رقم هاتف مصري غير صالح.";
            }

            // Gender parsing
            rowDto.Gender = ParseGender(rawGender);

            // Age and BirthDate parsing
            if (int.TryParse(rawAge, out var age) && age >= 0 && age <= 130)
            {
                rowDto.Age = age;
            }
            if (DateOnly.TryParse(rawBirthDate, CultureInfo.InvariantCulture, DateTimeStyles.None, out var bdate))
            {
                rowDto.BirthDate = bdate;
            }

            // Duplicate checks (if row was valid so far)
            if (rowDto.IsValid)
            {
                bool isDupInFile = false;
                bool isDupInDb = false;
                string? existingFn = null;

                if (seenPhones.Contains(normalizedPhone))
                {
                    isDupInFile = true;
                }
                else if (existingPhones.TryGetValue(normalizedPhone, out var fnPhone))
                {
                    isDupInDb = true;
                    existingFn = fnPhone;
                }

                if (!string.IsNullOrEmpty(rowDto.NationalId))
                {
                    if (seenNids.Contains(rowDto.NationalId))
                    {
                        isDupInFile = true;
                    }
                    else if (existingNids.TryGetValue(rowDto.NationalId, out var fnNid))
                    {
                        isDupInDb = true;
                        existingFn ??= fnNid;
                    }
                }

                if (isDupInFile || isDupInDb)
                {
                    rowDto.IsDuplicate = true;
                    rowDto.ExistingFileNumber = existingFn;
                    rowDto.ErrorMessage = isDupInDb
                        ? $"المريض مسجل بالفعل برقم ملف {existingFn}"
                        : "مكرر داخل نفس ملف الاستيراد.";
                    summary.DuplicateCount++;
                }
                else
                {
                    seenPhones.Add(normalizedPhone);
                    if (!string.IsNullOrEmpty(rowDto.NationalId))
                    {
                        seenNids.Add(rowDto.NationalId);
                    }
                    summary.ValidCount++;

                    string assignedFn = $"F-{nextFileSeq++}";
                    rowDto.AssignedFileNumber = assignedFn;

                    if (!dryRun)
                    {
                        var newPatient = new Patient
                        {
                            FileNumber = assignedFn,
                            FullName = rowDto.FullName,
                            SearchName = ArabicNormalizer.NormalizeText(rowDto.FullName),
                            Phone = rowDto.Phone,
                            NormalizedPhone = normalizedPhone,
                            NationalId = rowDto.NationalId,
                            Gender = rowDto.Gender,
                            BirthDate = rowDto.BirthDate,
                            ApproximateAgeYears = rowDto.Age,
                            CreatedAtUtc = DateTime.UtcNow
                        };
                        patientsToInsert.Add(newPatient);
                    }
                }
            }
            else
            {
                summary.ErrorCount++;
            }

            summary.Rows.Add(rowDto);
        }

        if (!dryRun && patientsToInsert.Count > 0)
        {
            _context.Patients.AddRange(patientsToInsert);
            await _context.SaveChangesAsync();
            summary.InsertedCount = patientsToInsert.Count;
        }

        return Ok(summary);
    }

    // POST /api/import/drugs?dryRun=true|false
    [HttpPost("drugs")]
    public async Task<ActionResult<DrugImportSummaryDto>> ImportDrugs(
        [FromQuery] bool dryRun = true,
        IFormFile? file = null)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("يرجى اختيار ملف CSV صالح للاستيراد.");
        }

        if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("امتداد الملف يجب أن يكون .csv.");
        }

        if (file.Length > 10 * 1024 * 1024)
        {
            return BadRequest("حجم الملف يتجاوز الحد الأقصى المسموح به (10 ميجابايت).");
        }

        List<List<string>> records;
        try
        {
            await using var stream = file.OpenReadStream();
            records = ParseCsv(stream);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse CSV file for drug import.");
            return BadRequest("فشل تحليل ملف الـ CSV.");
        }

        if (records.Count < 2)
        {
            return BadRequest("الملف لا يحتوي على بيانات كافية.");
        }

        var headers = records[0];
        int tradeIdx = FindHeaderIndex(headers, "tradename", "trade_name", "اسم الدواء", "الاسم التجاري", "brand", "brandname");
        int activeIdx = FindHeaderIndex(headers, "activeingredient", "active_ingredient", "activeingredients", "المادة الفعالة", "المادة_الفعالة", "generic", "genericname");
        int strengthIdx = FindHeaderIndex(headers, "strength", "التركيز");
        int formIdx = FindHeaderIndex(headers, "form", "الشكل الصيدلي", "الشكل_الصيدلي", "dosageform");
        int categoryIdx = FindHeaderIndex(headers, "category", "التصنيف", "المجموعة");
        int dosageIdx = FindHeaderIndex(headers, "defaultdosage", "dosage", "الجرعة", "الجرعة الاعتيادية");
        int timingIdx = FindHeaderIndex(headers, "defaulttiming", "timing", "التوقيت");
        int durationIdx = FindHeaderIndex(headers, "defaultduration", "duration", "المدة");
        int pregIdx = FindHeaderIndex(headers, "avoidinpregnancy", "pregnancy", "حمل", "ممنوع للحامل");
        int lactIdx = FindHeaderIndex(headers, "avoidinlactation", "lactation", "رضاعة", "ممنوع للمرضع");
        int pregCatIdx = FindHeaderIndex(headers, "pregnancycategory", "فئة الحمل");

        if (tradeIdx == -1 || activeIdx == -1)
        {
            return BadRequest("يجب أن يحتوي الملف على عمودي 'اسم الدواء' و 'المادة الفعالة'.");
        }

        var existingDrugs = await _context.Drugs.ToListAsync();
        var drugsBySearchName = existingDrugs.ToDictionary(
            d => ArabicNormalizer.NormalizeText(d.TradeName),
            d => d,
            StringComparer.OrdinalIgnoreCase);

        var summary = new DrugImportSummaryDto
        {
            IsDryRun = dryRun,
            TotalRowsProcessed = records.Count - 1
        };

        var drugsToInsert = new List<Drug>();

        for (int i = 1; i < records.Count; i++)
        {
            var row = records[i];
            var rowDto = new DrugImportRowDto { RowNumber = i };

            string rawTrade = GetVal(row, tradeIdx).Trim();
            string rawActive = GetVal(row, activeIdx).Trim();
            string rawStrength = strengthIdx != -1 ? GetVal(row, strengthIdx).Trim() : string.Empty;
            string rawForm = formIdx != -1 ? GetVal(row, formIdx).Trim() : string.Empty;
            string rawCategory = categoryIdx != -1 ? GetVal(row, categoryIdx).Trim() : string.Empty;
            string rawDosage = dosageIdx != -1 ? GetVal(row, dosageIdx).Trim() : string.Empty;
            string rawTiming = timingIdx != -1 ? GetVal(row, timingIdx).Trim() : string.Empty;
            string rawDuration = durationIdx != -1 ? GetVal(row, durationIdx).Trim() : string.Empty;
            string rawPreg = pregIdx != -1 ? GetVal(row, pregIdx).Trim() : string.Empty;
            string rawLact = lactIdx != -1 ? GetVal(row, lactIdx).Trim() : string.Empty;
            string rawPregCat = pregCatIdx != -1 ? GetVal(row, pregCatIdx).Trim() : string.Empty;

            rowDto.TradeName = rawTrade;
            rowDto.ActiveIngredient = rawActive;
            rowDto.Strength = rawStrength;
            rowDto.Form = ParseDrugForm(rawForm);
            rowDto.Category = !string.IsNullOrEmpty(rawCategory) ? rawCategory : null;
            rowDto.DefaultDosage = !string.IsNullOrEmpty(rawDosage) ? rawDosage : null;
            rowDto.DefaultTiming = !string.IsNullOrEmpty(rawTiming) ? rawTiming : null;
            rowDto.DefaultDuration = !string.IsNullOrEmpty(rawDuration) ? rawDuration : null;
            rowDto.AvoidInPregnancy = ParseBool(rawPreg);
            rowDto.AvoidInLactation = ParseBool(rawLact);
            rowDto.PregnancyCategory = !string.IsNullOrEmpty(rawPregCat) ? rawPregCat.ToUpperInvariant() : null;

            if (string.IsNullOrWhiteSpace(rawTrade) || string.IsNullOrWhiteSpace(rawActive))
            {
                rowDto.IsValid = false;
                rowDto.Action = "Error";
                rowDto.ErrorMessage = "اسم الدواء والمادة الفعالة إلزاميان.";
                summary.ErrorCount++;
                summary.Rows.Add(rowDto);
                continue;
            }

            string searchKey = ArabicNormalizer.NormalizeText(rawTrade);
            if (drugsBySearchName.TryGetValue(searchKey, out var existingDrug))
            {
                rowDto.Action = "Update";
                summary.UpdatedCount++;

                if (!dryRun)
                {
                    existingDrug.ActiveIngredient = rawActive.ToLowerInvariant();
                    existingDrug.Strength = rawStrength;
                    existingDrug.Form = rowDto.Form;
                    if (!string.IsNullOrEmpty(rawCategory)) existingDrug.Category = rawCategory;
                    if (!string.IsNullOrEmpty(rawDosage)) existingDrug.DefaultDosage = rawDosage;
                    if (!string.IsNullOrEmpty(rawTiming)) existingDrug.DefaultTiming = rawTiming;
                    if (!string.IsNullOrEmpty(rawDuration)) existingDrug.DefaultDuration = rawDuration;
                    existingDrug.AvoidInPregnancy = rowDto.AvoidInPregnancy;
                    existingDrug.AvoidInLactation = rowDto.AvoidInLactation;
                    if (!string.IsNullOrEmpty(rowDto.PregnancyCategory)) existingDrug.PregnancyCategory = rowDto.PregnancyCategory;
                }
            }
            else
            {
                rowDto.Action = "Insert";
                summary.InsertedCount++;

                if (!dryRun)
                {
                    var newDrug = new Drug
                    {
                        TradeName = rawTrade,
                        SearchTradeName = ArabicNormalizer.NormalizeText(rawTrade),
                        ActiveIngredient = rawActive.ToLowerInvariant(),
                        Strength = rawStrength,
                        Form = rowDto.Form,
                        Category = rowDto.Category,
                        DefaultDosage = rowDto.DefaultDosage,
                        DefaultTiming = rowDto.DefaultTiming,
                        DefaultDuration = rowDto.DefaultDuration,
                        AvoidInPregnancy = rowDto.AvoidInPregnancy,
                        AvoidInLactation = rowDto.AvoidInLactation,
                        PregnancyCategory = rowDto.PregnancyCategory,
                        CreatedAtUtc = DateTime.UtcNow
                    };
                    drugsToInsert.Add(newDrug);
                    drugsBySearchName[searchKey] = newDrug;
                }
            }

            summary.Rows.Add(rowDto);
        }

        if (!dryRun)
        {
            if (drugsToInsert.Count > 0)
            {
                _context.Drugs.AddRange(drugsToInsert);
            }
            await _context.SaveChangesAsync();
        }

        return Ok(summary);
    }

    #region Helper Methods

    private static List<List<string>> ParseCsv(Stream stream)
    {
        var rows = new List<List<string>>();
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);

        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;

            var row = new List<string>();
            var sb = new StringBuilder();
            bool insideQuotes = false;

            for (int i = 0; i < line.Length; i++)
            {
                char c = line[i];
                if (c == '"')
                {
                    if (insideQuotes && i + 1 < line.Length && line[i + 1] == '"')
                    {
                        sb.Append('"');
                        i++; // skip escaped quote
                    }
                    else
                    {
                        insideQuotes = !insideQuotes;
                    }
                }
                else if (c == ',' && !insideQuotes)
                {
                    row.Add(sb.ToString().Trim());
                    sb.Clear();
                }
                else
                {
                    sb.Append(c);
                }
            }
            row.Add(sb.ToString().Trim());
            rows.Add(row);
        }

        return rows;
    }

    private static int FindHeaderIndex(List<string> headers, params string[] possibleNames)
    {
        for (int i = 0; i < headers.Count; i++)
        {
            string clean = headers[i].Trim().Replace(" ", "").Replace("_", "").ToLowerInvariant();
            foreach (var name in possibleNames)
            {
                string cleanTarget = name.Trim().Replace(" ", "").Replace("_", "").ToLowerInvariant();
                if (clean.Equals(cleanTarget, StringComparison.OrdinalIgnoreCase))
                {
                    return i;
                }
            }
        }
        return -1;
    }

    private static string GetVal(List<string> row, int index)
    {
        if (index >= 0 && index < row.Count)
        {
            return row[index];
        }
        return string.Empty;
    }

    private static PatientGender ParseGender(string val)
    {
        string norm = val.Trim().ToLowerInvariant();
        if (norm == "female" || norm == "انثى" || norm == "أنثى" || norm == "f" || norm == "2")
        {
            return PatientGender.Female;
        }
        return PatientGender.Male;
    }

    private static DrugForm ParseDrugForm(string val)
    {
        string norm = val.Trim().ToLowerInvariant();
        if (norm.Contains("syrup") || norm.Contains("شراب")) return DrugForm.Syrup;
        if (norm.Contains("inject") || norm.Contains("حقن")) return DrugForm.Injection;
        if (norm.Contains("capsule") || norm.Contains("كبسول")) return DrugForm.Capsule;
        if (norm.Contains("ointment") || norm.Contains("مرهم") || norm.Contains("كريم")) return DrugForm.Ointment;
        if (norm.Contains("drop") || norm.Contains("نقط") || norm.Contains("قطرة")) return DrugForm.Drops;
        if (norm.Contains("inhaler") || norm.Contains("بخاخ")) return DrugForm.Inhaler;
        if (norm.Contains("suppos") || norm.Contains("لبوس")) return DrugForm.Suppository;
        return DrugForm.Tablet;
    }

    private static bool ParseBool(string val)
    {
        string norm = val.Trim().ToLowerInvariant();
        return norm == "true" || norm == "1" || norm == "yes" || norm == "نعم" || norm == "صحيح";
    }

    #endregion
}
