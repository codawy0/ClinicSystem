using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Clinic.Api.Entities;
using Clinic.Api.Common.Enums;
using Clinic.Api.Infrastructure;
using Clinic.Api.Services;

namespace Clinic.Api.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(
        ClinicDbContext context,
        IHostEnvironment environment,
        IPasswordHasher passwordHasher,
        ILogger logger)
    {
        logger.LogInformation("Beginning database seeding process...");

        // 1. Structural defaults (production & dev)
        await SeedStructuralDefaultsAsync(context, passwordHasher, logger);

        // 2. Dev-only demo data
        if (environment.IsDevelopment())
        {
            logger.LogInformation("Development environment detected. Seeding demo clinical data...");
            await SeedDevelopmentDemoDataAsync(context, logger);
        }

        logger.LogInformation("Database seeding completed successfully.");
    }

    public static async Task SeedStructuralDefaultsAsync(
        ClinicDbContext context,
        IPasswordHasher passwordHasher,
        ILogger logger)
    {
        // Seed ClinicSettings
        if (!await context.ClinicSettings.AnyAsync())
        {
            logger.LogInformation("Seeding default ClinicSettings...");
            var settings = new ClinicSetting
            {
                Id = 1,
                ClinicName = "عيادة د. حازم القاضي التخصصية",
                DoctorName = "د. حازم القاضي",
                DoctorTitle = "استشاري أمراض الباطنة والجهاز الهضمي والمناظير",
                Specialty = "أمراض باطنة وجهاز هضمي",
                ConsultationValidityDays = 14,
                MaxConsultationsPerExam = 1,
                DefaultExamPricePiastres = 30000L, // 300 EGP
                DefaultConsultPricePiastres = 0L,   // Free follow-up
                EnableNursingStage = true,
                TvPrivacyMode = TvPrivacyMode.FirstNameAndInitial,
                RolloverHourLocal = 5,
                RxTopMarginMm = 25,
                RxBottomMarginMm = 20,
                TvDeviceToken = "tv-waiting-room-secret-token",
                IsDoctorOnBreak = false,
                UpdatedAtUtc = DateTime.UtcNow
            };

            await context.ClinicSettings.AddAsync(settings);
            await context.SaveChangesAsync();
        }

        // Seed Users
        if (!await context.Users.AnyAsync())
        {
            logger.LogInformation("Seeding default operational users...");
            var users = new List<User>
            {
                new User
                {
                    Username = "admin",
                    PasswordHash = passwordHasher.HashPassword("Admin@123"),
                    FullName = "مدير النظام",
                    Role = UserRole.Admin,
                    IsActive = true,
                    MustChangePassword = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new User
                {
                    Username = "doctor",
                    PasswordHash = passwordHasher.HashPassword("Doctor@123"),
                    FullName = "د. حازم القاضي",
                    Role = UserRole.Doctor,
                    IsActive = true,
                    MustChangePassword = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new User
                {
                    Username = "nurse",
                    PasswordHash = passwordHasher.HashPassword("Nurse@123"),
                    FullName = "منى السيد (تمريض)",
                    Role = UserRole.Nurse,
                    IsActive = true,
                    MustChangePassword = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new User
                {
                    Username = "receptionist",
                    PasswordHash = passwordHasher.HashPassword("Recept@123"),
                    FullName = "سارة محمود (استقبال)",
                    Role = UserRole.Receptionist,
                    IsActive = true,
                    MustChangePassword = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new User
                {
                    Username = "assistant",
                    PasswordHash = passwordHasher.HashPassword("Doctor@123"),
                    FullName = "د. أحمد كمال (مساعد طبيب)",
                    Role = UserRole.AssistantDoctor,
                    IsActive = true,
                    MustChangePassword = true,
                    CreatedAtUtc = DateTime.UtcNow
                }
            };

            await context.Users.AddRangeAsync(users);
            await context.SaveChangesAsync();
        }

        // Seed ServiceCatalogs
        if (!await context.ServiceCatalogs.AnyAsync())
        {
            logger.LogInformation("Seeding standard service catalog...");
            var services = new List<ServiceCatalog>
            {
                new ServiceCatalog
                {
                    Code = "EXAM",
                    NameAr = "كشف باطنة عام",
                    NameEn = "General Internal Medicine Exam",
                    Category = ServiceCategory.Exam,
                    DefaultPricePiastres = 30000L, // 300 EGP
                    IsActive = true
                },
                new ServiceCatalog
                {
                    Code = "CONSULT",
                    NameAr = "استشارة مجانية (خلال 14 يوم)",
                    NameEn = "Free Follow-up Consultation",
                    Category = ServiceCategory.Consultation,
                    DefaultPricePiastres = 0L, // 0 EGP
                    IsActive = true
                },
                new ServiceCatalog
                {
                    Code = "URGENT",
                    NameAr = "كشف مستعجل",
                    NameEn = "Urgent Examination",
                    Category = ServiceCategory.Exam,
                    DefaultPricePiastres = 45000L, // 450 EGP
                    IsActive = true
                },
                new ServiceCatalog
                {
                    Code = "SONAR",
                    NameAr = "سونار بطن وحوض",
                    NameEn = "Abdominal & Pelvic Ultrasound",
                    Category = ServiceCategory.Procedure,
                    DefaultPricePiastres = 20000L, // 200 EGP
                    IsActive = true
                },
                new ServiceCatalog
                {
                    Code = "ECG",
                    NameAr = "رسم قلب كهربائي (ECG)",
                    NameEn = "Electrocardiogram (ECG)",
                    Category = ServiceCategory.Procedure,
                    DefaultPricePiastres = 10000L, // 100 EGP
                    IsActive = true
                },
                new ServiceCatalog
                {
                    Code = "FILE_FEE",
                    NameAr = "رسوم فتح ملف جديد",
                    NameEn = "Patient File Registration Fee",
                    Category = ServiceCategory.FileFee,
                    DefaultPricePiastres = 5000L, // 50 EGP
                    IsActive = true
                }
            };

            await context.ServiceCatalogs.AddRangeAsync(services);
            await context.SaveChangesAsync();
        }
    }

    public static async Task SeedDevelopmentDemoDataAsync(ClinicDbContext context, ILogger logger)
    {
        // Seed Demo Drugs
        if (!await context.Drugs.AnyAsync(d => d.IsDemoSeed))
        {
            logger.LogInformation("Seeding Egyptian formulary of 24 drugs across 6 clinical categories...");
            var drugs = new List<Drug>
            {
                // Category 1: Antibiotics
                new Drug
                {
                    TradeName = "Augmentin 1g",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Augmentin 1g"),
                    ActiveIngredient = "amoxicillin",
                    Strength = "1g",
                    Form = DrugForm.Tablet,
                    Category = "Antibiotic",
                    DefaultDosage = "قرص واحد كل 12 ساعة",
                    DefaultTiming = "بعد الأكل",
                    DefaultDuration = "7 أيام",
                    AvoidInPregnancy = false,
                    AvoidInLactation = false,
                    PregnancyCategory = "B",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Amoxil 500mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Amoxil 500mg"),
                    ActiveIngredient = "amoxicillin",
                    Strength = "500mg",
                    Form = DrugForm.Capsule,
                    Category = "Antibiotic",
                    DefaultDosage = "كبسولة كل 8 ساعات",
                    DefaultTiming = "قبل الأكل بساعة",
                    DefaultDuration = "5 أيام",
                    AvoidInPregnancy = false,
                    AvoidInLactation = false,
                    PregnancyCategory = "B",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Ciprobay 500mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Ciprobay 500mg"),
                    ActiveIngredient = "ciprofloxacin",
                    Strength = "500mg",
                    Form = DrugForm.Tablet,
                    Category = "Antibiotic",
                    DefaultDosage = "قرص كل 12 ساعة",
                    DefaultTiming = "بعد الأكل",
                    DefaultDuration = "5 أيام",
                    AvoidInPregnancy = true,
                    AvoidInLactation = true,
                    PregnancyCategory = "C",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Zithromax 500mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Zithromax 500mg"),
                    ActiveIngredient = "azithromycin",
                    Strength = "500mg",
                    Form = DrugForm.Capsule,
                    Category = "Antibiotic",
                    DefaultDosage = "كبسولة واحدة يومياً",
                    DefaultTiming = "قبل الأكل بساعة أو بعده بساعتين",
                    DefaultDuration = "3 أيام",
                    AvoidInPregnancy = false,
                    AvoidInLactation = false,
                    PregnancyCategory = "B",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Clarican 500mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Clarican 500mg"),
                    ActiveIngredient = "clarithromycin",
                    Strength = "500mg",
                    Form = DrugForm.Tablet,
                    Category = "Antibiotic",
                    DefaultDosage = "قرص كل 12 ساعة",
                    DefaultTiming = "بعد الأكل",
                    DefaultDuration = "14 يوماً",
                    AvoidInPregnancy = true,
                    AvoidInLactation = true,
                    PregnancyCategory = "C",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },

                // Category 2: Analgesics / Antipyretics
                new Drug
                {
                    TradeName = "Panadol Extra",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Panadol Extra"),
                    ActiveIngredient = "paracetamol",
                    Strength = "500mg/65mg",
                    Form = DrugForm.Tablet,
                    Category = "Analgesic",
                    DefaultDosage = "قرصين عند اللزوم",
                    DefaultTiming = "بعد الأكل",
                    DefaultDuration = "عند اللزوم",
                    AvoidInPregnancy = false,
                    AvoidInLactation = false,
                    PregnancyCategory = "B",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Cetal 500mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Cetal 500mg"),
                    ActiveIngredient = "paracetamol",
                    Strength = "500mg",
                    Form = DrugForm.Tablet,
                    Category = "Analgesic",
                    DefaultDosage = "قرص كل 6 إلى 8 ساعات عند اللزوم",
                    DefaultTiming = "بعد الأكل",
                    DefaultDuration = "عند اللزوم",
                    AvoidInPregnancy = false,
                    AvoidInLactation = false,
                    PregnancyCategory = "B",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Adol 500mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Adol 500mg"),
                    ActiveIngredient = "paracetamol",
                    Strength = "500mg",
                    Form = DrugForm.Tablet,
                    Category = "Analgesic",
                    DefaultDosage = "قرص عند اللزوم",
                    DefaultTiming = "بعد الأكل",
                    DefaultDuration = "عند اللزوم",
                    AvoidInPregnancy = false,
                    AvoidInLactation = false,
                    PregnancyCategory = "B",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },

                // Category 3: NSAIDs
                new Drug
                {
                    TradeName = "Voltaren 75mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Voltaren 75mg"),
                    ActiveIngredient = "diclofenac sodium",
                    Strength = "75mg/3ml",
                    Form = DrugForm.Injection,
                    Category = "NSAID",
                    DefaultDosage = "حقنة عضل عند اللزوم",
                    DefaultTiming = "بعد الأكل",
                    DefaultDuration = "3 أيام كحد أقصى",
                    AvoidInPregnancy = true,
                    AvoidInLactation = true,
                    PregnancyCategory = "D",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Cataflam 50mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Cataflam 50mg"),
                    ActiveIngredient = "diclofenac potassium",
                    Strength = "50mg",
                    Form = DrugForm.Tablet,
                    Category = "NSAID",
                    DefaultDosage = "قرص مرتين إلى 3 مرات يومياً",
                    DefaultTiming = "بعد الأكل فوراً",
                    DefaultDuration = "5 أيام",
                    AvoidInPregnancy = true,
                    AvoidInLactation = true,
                    PregnancyCategory = "D",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Brufen 400mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Brufen 400mg"),
                    ActiveIngredient = "ibuprofen",
                    Strength = "400mg",
                    Form = DrugForm.Tablet,
                    Category = "NSAID",
                    DefaultDosage = "قرص 3 مرات يومياً",
                    DefaultTiming = "بعد الأكل",
                    DefaultDuration = "5 أيام",
                    AvoidInPregnancy = true,
                    AvoidInLactation = true,
                    PregnancyCategory = "D",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Ketolac 30mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Ketolac 30mg"),
                    ActiveIngredient = "ketorolac tromethamine",
                    Strength = "30mg/2ml",
                    Form = DrugForm.Injection,
                    Category = "NSAID",
                    DefaultDosage = "أمبول عضل أو وريد عند الألم الشديد",
                    DefaultTiming = "بعد الأكل",
                    DefaultDuration = "يومين كحد أقصى",
                    AvoidInPregnancy = true,
                    AvoidInLactation = true,
                    PregnancyCategory = "D",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Celebrex 200mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Celebrex 200mg"),
                    ActiveIngredient = "celecoxib",
                    Strength = "200mg",
                    Form = DrugForm.Capsule,
                    Category = "NSAID",
                    DefaultDosage = "كبسولة واحدة يومياً",
                    DefaultTiming = "بعد الأكل",
                    DefaultDuration = "10 أيام",
                    AvoidInPregnancy = true,
                    AvoidInLactation = true,
                    PregnancyCategory = "C",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },

                // Category 4: Antihypertensives
                new Drug
                {
                    TradeName = "Concor 5mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Concor 5mg"),
                    ActiveIngredient = "bisoprolol",
                    Strength = "5mg",
                    Form = DrugForm.Tablet,
                    Category = "Antihypertensive",
                    DefaultDosage = "قرص واحد صباحاً",
                    DefaultTiming = "قبل الإفطار",
                    DefaultDuration = "30 يوماً",
                    AvoidInPregnancy = true,
                    AvoidInLactation = true,
                    PregnancyCategory = "C",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Norvasc 5mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Norvasc 5mg"),
                    ActiveIngredient = "amlodipine",
                    Strength = "5mg",
                    Form = DrugForm.Tablet,
                    Category = "Antihypertensive",
                    DefaultDosage = "قرص واحد يومياً",
                    DefaultTiming = "في نفس الموعد",
                    DefaultDuration = "30 يوماً",
                    AvoidInPregnancy = true,
                    AvoidInLactation = true,
                    PregnancyCategory = "C",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Capoten 25mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Capoten 25mg"),
                    ActiveIngredient = "captopril",
                    Strength = "25mg",
                    Form = DrugForm.Tablet,
                    Category = "Antihypertensive",
                    DefaultDosage = "نصف قرص إلى قرص تحت اللسان أو بالفم",
                    DefaultTiming = "قبل الأكل بساعة",
                    DefaultDuration = "مستمر",
                    AvoidInPregnancy = true,
                    AvoidInLactation = true,
                    PregnancyCategory = "D",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Exforge 5/160mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Exforge 5/160mg"),
                    ActiveIngredient = "amlodipine/valsartan",
                    Strength = "5mg/160mg",
                    Form = DrugForm.Tablet,
                    Category = "Antihypertensive",
                    DefaultDosage = "قرص واحد يومياً صباحاً",
                    DefaultTiming = "مع أو بدون طعام",
                    DefaultDuration = "30 يوماً",
                    AvoidInPregnancy = true,
                    AvoidInLactation = true,
                    PregnancyCategory = "D",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Aldomet 250mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Aldomet 250mg"),
                    ActiveIngredient = "methyldopa",
                    Strength = "250mg",
                    Form = DrugForm.Tablet,
                    Category = "Antihypertensive",
                    DefaultDosage = "قرص مرتين إلى 3 مرات يومياً",
                    DefaultTiming = "مع الطعام",
                    DefaultDuration = "مستمر",
                    AvoidInPregnancy = false,
                    AvoidInLactation = false,
                    PregnancyCategory = "B",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },

                // Category 5: Antidiabetics
                new Drug
                {
                    TradeName = "Glucophage 1000mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Glucophage 1000mg"),
                    ActiveIngredient = "metformin",
                    Strength = "1000mg",
                    Form = DrugForm.Tablet,
                    Category = "Antidiabetic",
                    DefaultDosage = "قرص مرتين يومياً",
                    DefaultTiming = "مع أو بعد الوجبات",
                    DefaultDuration = "مستمر",
                    AvoidInPregnancy = false,
                    AvoidInLactation = false,
                    PregnancyCategory = "B",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Amaryl 2mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Amaryl 2mg"),
                    ActiveIngredient = "glimepiride",
                    Strength = "2mg",
                    Form = DrugForm.Tablet,
                    Category = "Antidiabetic",
                    DefaultDosage = "قرص واحد يومياً",
                    DefaultTiming = "قبل أول وجبة رئيسية",
                    DefaultDuration = "مستمر",
                    AvoidInPregnancy = true,
                    AvoidInLactation = true,
                    PregnancyCategory = "C",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Januvia 100mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Januvia 100mg"),
                    ActiveIngredient = "sitagliptin",
                    Strength = "100mg",
                    Form = DrugForm.Tablet,
                    Category = "Antidiabetic",
                    DefaultDosage = "قرص واحد يومياً",
                    DefaultTiming = "مع أو بدون طعام",
                    DefaultDuration = "مستمر",
                    AvoidInPregnancy = true,
                    AvoidInLactation = true,
                    PregnancyCategory = "B",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Lantus 100 IU/ml",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Lantus 100 IU/ml"),
                    ActiveIngredient = "insulin glargine",
                    Strength = "100 IU/ml",
                    Form = DrugForm.Injection,
                    Category = "Antidiabetic",
                    DefaultDosage = "جرعة محددة تحت الجلد مساءً",
                    DefaultTiming = "قبل النوم",
                    DefaultDuration = "مستمر",
                    AvoidInPregnancy = false,
                    AvoidInLactation = false,
                    PregnancyCategory = "C",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },

                // Category 6: PPIs / Gastrointestinal
                new Drug
                {
                    TradeName = "Nexium 40mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Nexium 40mg"),
                    ActiveIngredient = "esomeprazole",
                    Strength = "40mg",
                    Form = DrugForm.Tablet,
                    Category = "PPI",
                    DefaultDosage = "قرص واحد يومياً",
                    DefaultTiming = "قبل الإفطار بنصف ساعة",
                    DefaultDuration = "14 يوماً",
                    AvoidInPregnancy = false,
                    AvoidInLactation = false,
                    PregnancyCategory = "B",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new Drug
                {
                    TradeName = "Controloc 40mg",
                    SearchTradeName = ArabicNormalizer.NormalizeText("Controloc 40mg"),
                    ActiveIngredient = "pantoprazole",
                    Strength = "40mg",
                    Form = DrugForm.Tablet,
                    Category = "PPI",
                    DefaultDosage = "قرص واحد يومياً صباحاً",
                    DefaultTiming = "قبل الإفطار",
                    DefaultDuration = "14 يوماً",
                    AvoidInPregnancy = false,
                    AvoidInLactation = false,
                    PregnancyCategory = "B",
                    IsDiscontinued = false,
                    IsDemoSeed = true,
                    CreatedAtUtc = DateTime.UtcNow
                }
            };

            await context.Drugs.AddRangeAsync(drugs);
            await context.SaveChangesAsync();
        }

        // Seed Demo Patients
        if (!await context.Patients.AnyAsync())
        {
            logger.LogInformation("Seeding demo patients (including shared-phone family members)...");

            // Father
            var father = new Patient
            {
                FileNumber = "F-1001",
                FullName = "أحمد محمد عبد الله",
                SearchName = ArabicNormalizer.NormalizeText("أحمد محمد عبد الله"),
                Phone = "01012345678",
                NormalizedPhone = ArabicNormalizer.NormalizePhone("01012345678"),
                Gender = PatientGender.Male,
                BirthDate = new DateOnly(1981, 5, 14),
                ApproximateAgeYears = 45,
                BloodType = BloodType.OPositive,
                IsPregnant = false,
                IsLactating = false,
                Version = 1,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            await context.Patients.AddAsync(father);
            await context.SaveChangesAsync();

            // Mother
            var mother = new Patient
            {
                FileNumber = "F-1002",
                FullName = "فاطمة إبراهيم الشناوي",
                SearchName = ArabicNormalizer.NormalizeText("فاطمة إبراهيم الشناوي"),
                Phone = "01012345678", // Shared Phone
                NormalizedPhone = ArabicNormalizer.NormalizePhone("01012345678"),
                Gender = PatientGender.Female,
                BirthDate = new DateOnly(1986, 9, 20),
                ApproximateAgeYears = 40,
                BloodType = BloodType.APositive,
                IsPregnant = false,
                IsLactating = false,
                Version = 1,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            await context.Patients.AddAsync(mother);
            await context.SaveChangesAsync();

            // Child 1 (Linked to Father)
            var child1 = new Patient
            {
                FileNumber = "F-1003",
                FullName = "يوسف أحمد محمد",
                SearchName = ArabicNormalizer.NormalizeText("يوسف أحمد محمد"),
                Phone = "01012345678", // Shared Phone
                NormalizedPhone = ArabicNormalizer.NormalizePhone("01012345678"),
                Gender = PatientGender.Male,
                ApproximateAgeYears = 12,
                GuardianPatientId = father.Id,
                BloodType = BloodType.OPositive,
                Version = 1,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };

            // Child 2 (Linked to Father)
            var child2 = new Patient
            {
                FileNumber = "F-1004",
                FullName = "مريم أحمد محمد",
                SearchName = ArabicNormalizer.NormalizeText("مريم أحمد محمد"),
                Phone = "01012345678", // Shared Phone
                NormalizedPhone = ArabicNormalizer.NormalizePhone("01012345678"),
                Gender = PatientGender.Female,
                ApproximateAgeYears = 8,
                GuardianPatientId = father.Id,
                BloodType = BloodType.OPositive,
                Version = 1,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };

            // Patient with Severe Penicillin Allergy & Chronic Diabetes
            var patientWithAllergy = new Patient
            {
                FileNumber = "F-1005",
                FullName = "عمرو كمال الدين مصطفى",
                SearchName = ArabicNormalizer.NormalizeText("عمرو كمال الدين مصطفى"),
                Phone = "01234567890",
                NormalizedPhone = ArabicNormalizer.NormalizePhone("01234567890"),
                Gender = PatientGender.Male,
                ApproximateAgeYears = 36,
                BloodType = BloodType.BPositive,
                Version = 1,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            await context.Patients.AddRangeAsync(child1, child2, patientWithAllergy);
            await context.SaveChangesAsync();

            // Add Allergy to Amr
            await context.PatientAllergies.AddAsync(new PatientAllergy
            {
                PatientId = patientWithAllergy.Id,
                ActiveIngredient = "amoxicillin",
                AllergyName = "حساسية بنسلين مفرطة (Severe Penicillin Allergy)",
                Severity = AllergySeverity.Severe,
                Notes = "يسبب صدمة حساسية وطفح جلدي حاد",
                CreatedAtUtc = DateTime.UtcNow
            });

            // Add Chronic Condition to Amr
            await context.PatientChronicConditions.AddAsync(new PatientChronicCondition
            {
                PatientId = patientWithAllergy.Id,
                ConditionCode = "E11",
                ConditionName = "داء السكري من النوع الثاني (Type 2 Diabetes)",
                Notes = "يعالج بالأقراص الفموية",
                CreatedAtUtc = DateTime.UtcNow
            });

            // Pregnant Patient
            var pregnantPatient = new Patient
            {
                FileNumber = "F-1006",
                FullName = "منى محمود رضوان",
                SearchName = ArabicNormalizer.NormalizeText("منى محمود رضوان"),
                Phone = "01123456789",
                NormalizedPhone = ArabicNormalizer.NormalizePhone("01123456789"),
                Gender = PatientGender.Female,
                ApproximateAgeYears = 28,
                IsPregnant = true,
                IsLactating = false,
                BloodType = BloodType.ONegative,
                Version = 1,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            await context.Patients.AddAsync(pregnantPatient);
            await context.SaveChangesAsync();
        }

        // Seed Demo Prescription Templates
        var doctorUser = await context.Users.FirstOrDefaultAsync(u => u.Role == UserRole.Doctor);
        if (doctorUser != null && !await context.PrescriptionTemplates.AnyAsync())
        {
            logger.LogInformation("Seeding default clinical prescription templates for doctor...");
            var templates = new List<PrescriptionTemplate>
            {
                new PrescriptionTemplate
                {
                    DoctorUserId = doctorUser.Id,
                    TemplateName = "نزلة معوية حادة (Acute Gastroenteritis)",
                    DefaultDiagnosis = "Acute Gastroenteritis with moderate dehydration",
                    ItemsJson = "[{\"DrugName\":\"Nexium 40mg\",\"Dosage\":\"قرص يومياً\",\"Timing\":\"قبل الإفطار\",\"Duration\":\"14 يوماً\"},{\"DrugName\":\"Panadol Extra\",\"Dosage\":\"قرصين عند اللزوم\",\"Timing\":\"بعد الأكل\",\"Duration\":\"3 أيام\"}]",
                    LabRadiologyOrdersJson = "[{\"Type\":0,\"CatalogCode\":\"STOOL\",\"NameAr\":\"تحليل براز كامل (Stool Analysis)\",\"NameEn\":\"Stool Analysis\",\"Notes\":\"فحص الطفيليات والصديد\"}]",
                    CreatedAtUtc = DateTime.UtcNow
                },
                new PrescriptionTemplate
                {
                    DoctorUserId = doctorUser.Id,
                    TemplateName = "علاج جرثومة المعدة الثلاثي (H. Pylori Tri-Therapy)",
                    DefaultDiagnosis = "H. Pylori Gastritis",
                    ItemsJson = "[{\"DrugName\":\"Nexium 40mg\",\"Dosage\":\"قرص مرتين يومياً\",\"Timing\":\"قبل الأكل بنصف ساعة\",\"Duration\":\"14 يوماً\"},{\"DrugName\":\"Augmentin 1g\",\"Dosage\":\"قرص كل 12 ساعة\",\"Timing\":\"بعد الأكل\",\"Duration\":\"14 يوماً\"},{\"DrugName\":\"Clarican 500mg\",\"Dosage\":\"قرص كل 12 ساعة\",\"Timing\":\"بعد الأكل\",\"Duration\":\"14 يوماً\"}]",
                    LabRadiologyOrdersJson = "[{\"Type\":0,\"CatalogCode\":\"HPYLORI\",\"NameAr\":\"فحص جرثومة المعدة في البراز (H. Pylori Stool Antigen)\",\"NameEn\":\"H. Pylori Stool Antigen\",\"Notes\":\"تأكيد خلو البراز بعد العلاج\"}]",
                    CreatedAtUtc = DateTime.UtcNow
                },
                new PrescriptionTemplate
                {
                    DoctorUserId = doctorUser.Id,
                    TemplateName = "ارتفاع ضغط الدم والسكري (Hypertension & Type 2 Diabetes)",
                    DefaultDiagnosis = "Essential Hypertension with Type 2 Diabetes Mellitus",
                    ItemsJson = "[{\"DrugName\":\"Concor 5mg\",\"Dosage\":\"قرص صباحاً\",\"Timing\":\"قبل الإفطار\",\"Duration\":\"30 يوماً\"},{\"DrugName\":\"Glucophage 1000mg\",\"Dosage\":\"قرص مرتين يومياً\",\"Timing\":\"مع الأكل\",\"Duration\":\"30 يوماً\"}]",
                    LabRadiologyOrdersJson = "[{\"Type\":0,\"CatalogCode\":\"FBS\",\"NameAr\":\"سكر صائم وتراكمي (FBS & HbA1c)\",\"NameEn\":\"Fasting Blood Sugar & HbA1c\",\"Notes\":\"متابعة دورية\"},{\"Type\":0,\"CatalogCode\":\"LIPID\",\"NameAr\":\"دهون كاملة في الدم (Lipid Profile)\",\"NameEn\":\"Lipid Profile\",\"Notes\":\"صيام 12 ساعة\"}]",
                    CreatedAtUtc = DateTime.UtcNow
                },
                new PrescriptionTemplate
                {
                    DoctorUserId = doctorUser.Id,
                    TemplateName = "التهاب مفاصل حاد وتسكين ألم (Acute Arthritis & Pain Management)",
                    DefaultDiagnosis = "Acute Arthritis / Musculoskeletal Pain",
                    ItemsJson = "[{\"DrugName\":\"Celebrex 200mg\",\"Dosage\":\"كبسولة يومياً\",\"Timing\":\"بعد الأكل\",\"Duration\":\"10 أيام\"},{\"DrugName\":\"Nexium 40mg\",\"Dosage\":\"قرص صباحاً\",\"Timing\":\"قبل الإفطار\",\"Duration\":\"14 يوماً\"},{\"DrugName\":\"Panadol Extra\",\"Dosage\":\"قرصين عند اللزوم\",\"Timing\":\"بعد الأكل\",\"Duration\":\"5 أيام\"}]",
                    LabRadiologyOrdersJson = "[{\"Type\":1,\"CatalogCode\":\"XR_JOINT\",\"NameAr\":\"أشعة سينية على المفصل المصاب (Joint X-Ray)\",\"NameEn\":\"Joint X-Ray (AP & Lateral)\",\"Notes\":\"لتشخيص الخشونة والالتهاب\"}]",
                    CreatedAtUtc = DateTime.UtcNow
                }
            };

            await context.PrescriptionTemplates.AddRangeAsync(templates);
            await context.SaveChangesAsync();
        }
    }
}
