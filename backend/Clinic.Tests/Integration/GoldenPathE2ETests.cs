using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Clinic.Api.Common.Enums;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Models.Appointments;
using Clinic.Api.Models.Attachments;
using Clinic.Api.Models.Auth;
using Clinic.Api.Models.ClinicalProfile;
using Clinic.Api.Models.Drugs;
using Clinic.Api.Models.Invoices;
using Clinic.Api.Models.MedicalVisits;
using Clinic.Api.Models.Patients;
using Clinic.Api.Models.Queue;
using Clinic.Api.Models.Shifts;

namespace Clinic.Tests.Integration;

[Trait("Category", "Integration")]
public class GoldenPathE2ETests : IAsyncLifetime
{
    private string _tempDataRoot = null!;
    private Microsoft.AspNetCore.Builder.WebApplication _app = null!;
    private HttpClient _client = null!;
    private readonly JsonSerializerOptions _jsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public async Task InitializeAsync()
    {
        _tempDataRoot = Path.Combine(Path.GetTempPath(), $"clinic_golden_e2e_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempDataRoot);

        _app = Program.CreateWebApplication(new[] { "--urls", "http://127.0.0.1:0", "--environment", "Development" }, builder =>
        {
            builder.Configuration["ClinicStorage:DataRoot"] = _tempDataRoot;
            builder.Configuration["Jwt:Secret"] = "GoldenPathE2E_Test_Secret_Key_At_Least_32_Chars_Long!";
            builder.Configuration["Jwt:Issuer"] = "ClinicSystem";
            builder.Configuration["Jwt:Audience"] = "ClinicSystemClients";
            builder.Configuration["Jwt:ExpiryHours"] = "24";
        });

        await Program.InitializeDatabaseAsync(_app);
        await _app.StartAsync();

        var server = _app.Services.GetRequiredService<IServer>();
        var addressesFeature = server.Features.Get<IServerAddressesFeature>();
        var serverAddress = addressesFeature!.Addresses.First();

        _client = new HttpClient { BaseAddress = new Uri(serverAddress) };
    }

    public async Task DisposeAsync()
    {
        if (_client != null)
        {
            _client.Dispose();
        }

        if (_app != null)
        {
            await _app.StopAsync();
            await _app.DisposeAsync();
        }

        try
        {
            if (Directory.Exists(_tempDataRoot))
            {
                Directory.Delete(_tempDataRoot, true);
            }
        }
        catch { }
    }

    [Fact]
    public async Task GoldenPath_CompleteClinicalLifecycleSimulation_ExecutesFlawlessly()
    {
        // =====================================================================
        // STAGE 0: Dedicated Health Check Polling & SPA Route Protection
        // =====================================================================
        var healthResp = await _client.GetAsync("/api/health");
        healthResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var healthBody = await healthResp.Content.ReadAsStringAsync();
        healthBody.Should().Contain("Healthy");

        // Verify unmatched API endpoints return 404 Not Found (not SPA index.html)
        var nonExistentResp = await _client.GetAsync("/api/nonexistent-endpoint-test");
        nonExistentResp.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // =====================================================================
        // STAGE 1: Authentication & JWT Acquisition for All 4 Roles
        // =====================================================================
        var adminLogin = await AuthenticateFullAsync("admin", "Admin@123");
        var doctorLogin = await AuthenticateFullAsync("doctor", "Doctor@123");
        var nurseLogin = await AuthenticateFullAsync("nurse", "Nurse@123");
        var receptionistLogin = await AuthenticateFullAsync("receptionist", "Recept@123");

        adminLogin.User.Role.Should().Be(UserRole.Admin);
        doctorLogin.User.Role.Should().Be(UserRole.Doctor);
        nurseLogin.User.Role.Should().Be(UserRole.Nurse);
        receptionistLogin.User.Role.Should().Be(UserRole.Receptionist);

        int doctorUserId = doctorLogin.User.Id;
        int nurseUserId = nurseLogin.User.Id;
        int receptionistUserId = receptionistLogin.User.Id;

        // =====================================================================
        // STAGE 2: Receptionist Shift Opening
        // =====================================================================
        SetBearerToken(receptionistLogin.Token);

        var openShiftReq = new OpenShiftRequestDto
        {
            OpeningBalancePiastres = 50_000L, // 500 EGP
            Notes = "وردية صباحية - الخزينة الرئيسية للاستقبال"
        };
        var openShiftResp = await _client.PostAsJsonAsync("/api/shifts/open", openShiftReq);
        openShiftResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var shiftSummary = await openShiftResp.Content.ReadFromJsonAsync<ShiftSummaryDto>(_jsonOptions);
        shiftSummary.Should().NotBeNull();
        shiftSummary!.OpeningBalancePiastres.Should().Be(50_000L);
        shiftSummary.ExpectedClosingCashPiastres.Should().Be(50_000L);
        int shiftId = shiftSummary.ShiftId;
        long shiftVersion = shiftSummary.Version;

        // =====================================================================
        // STAGE 3: Arabic Patient Registration & Clinical Profile (Allergy Setup)
        // =====================================================================
        var createPatientReq = new CreatePatientRequestDto
        {
            FullName = "محمود عبد الرحمن السيد",
            Phone = "01098765432",
            SecondaryPhone = "01234567890",
            NationalId = "28506150102345",
            Gender = PatientGender.Male,
            BirthDate = new DateOnly(1985, 6, 15),
            BloodType = BloodType.APositive,
            IsPregnant = false,
            IsLactating = false
        };

        var patientResp = await _client.PostAsJsonAsync("/api/patients", createPatientReq);
        patientResp.StatusCode.Should().Be(HttpStatusCode.Created);
        var patientDto = await patientResp.Content.ReadFromJsonAsync<PatientDto>(_jsonOptions);
        patientDto.Should().NotBeNull();
        patientDto!.FullName.Should().Be("محمود عبد الرحمن السيد");
        patientDto.FileNumber.Should().StartWith("F-");
        int patientId = patientDto.Id;

        // Add Allergy: amoxicillin (Severe) for subsequent drug safety check
        var allergyReq = new AddPatientAllergyRequestDto
        {
            ActiveIngredient = "amoxicillin",
            AllergyName = "بنسلين ومشتقاته",
            Severity = AllergySeverity.Severe,
            Notes = "طفح جلدي حاد وضيق تنفس عند تناول مشتقات البنسلين"
        };
        var allergyResp = await _client.PostAsJsonAsync($"/api/clinical-profile/{patientId}/allergies", allergyReq);
        allergyResp.StatusCode.Should().Be(HttpStatusCode.Created);

        // =====================================================================
        // STAGE 4: Appointment 1-Click Booking & Shift Cash Drawer Math
        // =====================================================================
        int examServiceId;
        using (var scope = _app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
            var examService = await db.ServiceCatalogs.FirstAsync(s => s.Code == "EXAM");
            examServiceId = examService.Id;
        }

        string bookingIdempotencyKey = Guid.NewGuid().ToString("N");
        var bookApptReq = new BookAppointmentRequestDto
        {
            PatientId = patientId,
            DoctorUserId = doctorUserId,
            ServiceId = examServiceId,
            DiscountAmountPiastres = 0L,
            PaymentMethod = PaymentMethod.Cash,
            IsUrgent = false,
            IsWalkIn = true,
            IdempotencyKey = bookingIdempotencyKey
        };

        var bookReqMsg = new HttpRequestMessage(HttpMethod.Post, "/api/appointments")
        {
            Content = JsonContent.Create(bookApptReq)
        };
        bookReqMsg.Headers.Add("Idempotency-Key", bookingIdempotencyKey);

        var bookResp = await _client.SendAsync(bookReqMsg);
        bookResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var bookResult = await bookResp.Content.ReadFromJsonAsync<BookAppointmentResponseDto>(_jsonOptions);
        bookResult.Should().NotBeNull();
        bookResult!.QueueNumber.Should().Be(1);
        bookResult.TotalPiastres.Should().Be(30_000L);
        bookResult.NetTotalPiastres.Should().Be(30_000L);
        bookResult.Receipt.Should().NotBeNull();
        int appointmentId = bookResult.AppointmentId;
        int invoiceId = bookResult.InvoiceId;

        // Verify shift cash drawer was atomically incremented (500 EGP + 300 EGP = 800 EGP)
        var currentShiftResp = await _client.GetAsync("/api/shifts/current");
        currentShiftResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var currentShiftDto = await currentShiftResp.Content.ReadFromJsonAsync<CurrentShiftStatusDto>(_jsonOptions);
        currentShiftDto!.Shift!.ExpectedClosingCashPiastres.Should().Be(80_000L);
        shiftVersion = currentShiftDto.Shift.Version;

        // =====================================================================
        // STAGE 5: Queue State Progression & Nurse Vitals Recording
        // =====================================================================
        // Receptionist checks in patient
        var checkInResp = await _client.PutAsJsonAsync($"/api/appointments/{appointmentId}/check-in", new CheckInRequestDto { IsUrgent = false });
        checkInResp.StatusCode.Should().Be(HttpStatusCode.OK);

        // Switch to Nurse credentials
        SetBearerToken(nurseLogin.Token);

        // Initialize Medical Visit (transitions to InNursing)
        var initVisitReq = new InitVisitRequestDto { AppointmentId = appointmentId };
        var initVisitResp = await _client.PostAsJsonAsync("/api/visits/init-or-get", initVisitReq);
        initVisitResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var visitDetail = await initVisitResp.Content.ReadFromJsonAsync<MedicalVisitDetailDto>(_jsonOptions);
        visitDetail.Should().NotBeNull();
        visitDetail!.IsDraft.Should().BeTrue();
        int visitId = visitDetail.Id;
        long visitVersion = visitDetail.Version;

        // Nurse records vital signs (BP: 120/80, Pulse: 75, Temp: 37.0, W: 70kg, H: 175cm => BMI ~22.86)
        var vitalsReq = new UpdateVitalsRequestDto
        {
            Version = visitVersion,
            BpSystolic = 120,
            BpDiastolic = 80,
            PulseBpm = 75,
            TempCelsius = 37.0m,
            WeightKg = 70.0m,
            HeightCm = 175.0m,
            BloodSugarMgDl = 95,
            Spo2Pct = 98,
            IsPregnant = false,
            IsLactating = false,
            MarkNursePrepComplete = true
        };

        var vitalsResp = await _client.PutAsJsonAsync($"/api/visits/{visitId}/vitals", vitalsReq);
        vitalsResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var vitalsDetail = await vitalsResp.Content.ReadFromJsonAsync<MedicalVisitDetailDto>(_jsonOptions);
        vitalsDetail!.Bmi.Should().BeApproximately(22.86m, 0.05m);
        vitalsDetail.Alerts.HasAlerts.Should().BeFalse(); // All vitals are strictly within normal range
        visitVersion = vitalsDetail.Version;

        // =====================================================================
        // STAGE 6: Doctor Consultation & Clinical Drug Safety Evaluation
        // =====================================================================
        SetBearerToken(doctorLogin.Token);

        // Doctor calls next patient
        var callNextReq = new CallNextRequestDto { DoctorUserId = doctorUserId };
        var callNextResp = await _client.PostAsJsonAsync("/api/queue/call-next", callNextReq);
        callNextResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var callNextResult = await callNextResp.Content.ReadFromJsonAsync<CallNextResponseDto>(_jsonOptions);
        callNextResult!.AppointmentId.Should().Be(appointmentId);
        callNextResult.QueueNumber.Should().Be(1);
        callNextResult.CallSequence.Should().Be(1);

        // Doctor performs drug safety check on Augmentin (active ingredient: amoxicillin)
        int augmentinDrugId;
        using (var scope = _app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
            var aug = await db.Drugs.FirstAsync(d => d.ActiveIngredient == "amoxicillin");
            augmentinDrugId = aug.Id;
        }

        var safetyCheckReq = new DrugSafetyCheckRequestDto
        {
            PatientId = patientId,
            DrugIds = new List<int> { augmentinDrugId },
            IsPregnant = false,
            IsLactating = false
        };

        var safetyResp = await _client.PostAsJsonAsync("/api/drugs/safety-check", safetyCheckReq);
        safetyResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var safetyResult = await safetyResp.Content.ReadFromJsonAsync<DrugSafetyCheckResultDto>(_jsonOptions);
        safetyResult!.HasSevereWarnings.Should().BeTrue();
        safetyResult.RequiresOverride.Should().BeTrue();
        safetyResult.Warnings.Should().ContainSingle(w => w.Type == "Allergy" && w.ActiveIngredient == "amoxicillin");

        // =====================================================================
        // STAGE 7: Prescription Snapshot & Consultation Completion
        // =====================================================================
        var completeVisitReq = new CompleteVisitRequestDto
        {
            Version = visitVersion,
            ChiefComplaint = "سعال مستمر وارتفاع طفيف في درجة الحرارة منذ 3 أيام",
            Diagnosis = "التهاب شعبي حاد (Acute Bronchitis)",
            Examination = "أصوات تنفسية خشنة بالصدر، لا توجد بؤر صديدية بالحلق",
            Icd10Code = "J20.9",
            DoctorPrivateNotes = "متابعة استجابة المريض بعد 5 أيام",
            NextVisitDate = new DateOnly(2026, 11, 22),
            PrescriptionItems = new List<CompleteVisitPrescriptionItemDto>
            {
                new CompleteVisitPrescriptionItemDto
                {
                    DrugId = augmentinDrugId,
                    DrugName = "Augmentin 1g",
                    ActiveIngredient = "amoxicillin",
                    Strength = "1g",
                    Form = "Tablet",
                    Dosage = "قرص واحد كل 12 ساعة",
                    Timing = "بعد الأكل",
                    Duration = "7 أيام",
                    Notes = "تناول الجرعة كاملة مع كمية كافية من الماء",
                    WarningOverridden = true,
                    OverrideReason = "تم تقييم الفائدة العلاجية ومناقشة البدائل مع المريض مع أخذ موافقته الطبية"
                }
            },
            ClinicalRequests = new List<CompleteVisitClinicalRequestDto>
            {
                new CompleteVisitClinicalRequestDto
                {
                    RequestType = RequestType.Lab,
                    NameAr = "صورة دم كاملة (Complete Blood Count - CBC)",
                    Notes = "إجراء التحليل في أقرب معمل"
                },
                new CompleteVisitClinicalRequestDto
                {
                    RequestType = RequestType.Radiology,
                    NameAr = "أشعة عادية على الصدر (Chest X-Ray PA View)",
                    Notes = "إحضار فيلم الأشعة والتقرير في الاستشارة"
                }
            }
        };

        var completeResp = await _client.PostAsJsonAsync($"/api/visits/{visitId}/complete", completeVisitReq);
        completeResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var completedVisit = await completeResp.Content.ReadFromJsonAsync<MedicalVisitDetailDto>(_jsonOptions);
        completedVisit!.IsDraft.Should().BeFalse();
        completedVisit.CompletedAtUtc.Should().NotBeNull();
        completedVisit.PrescriptionItems.Should().HaveCount(1);
        completedVisit.PrescriptionItems[0].DrugNameSnapshot.Should().Be("Augmentin 1g");
        completedVisit.PrescriptionItems[0].ActiveIngredientSnapshot.Should().Be("amoxicillin");
        completedVisit.ClinicalRequests.Should().HaveCount(2);

        // Medicolegal Immutability Guard: Editing vitals on completed visit must be strictly rejected
        var illegalVitalsResp = await _client.PutAsJsonAsync($"/api/visits/{visitId}/vitals", vitalsReq);
        illegalVitalsResp.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Addendum Note is allowed on completed visit
        var addendumReq = new CreateAddendumRequestDto
        {
            NoteText = "تم الاتصال بالمريض هاتفياً للاطمئنان وتأكيد تحسن الأعراض."
        };
        var addendumResp = await _client.PostAsJsonAsync($"/api/visits/{visitId}/addenda", addendumReq);
        addendumResp.StatusCode.Should().Be(HttpStatusCode.Created);

        // Upload clinical attachment (PDF Lab Report) and soft-delete to exercise audit trail
        var pdfBytes = System.Text.Encoding.ASCII.GetBytes("%PDF-1.4\nClinical CBC Report for Patient");
        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(pdfBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(fileContent, "File", "cbc_result.pdf");
        form.Add(new StringContent(patientId.ToString()), "PatientId");
        form.Add(new StringContent(visitId.ToString()), "MedicalVisitId");
        form.Add(new StringContent("Lab"), "FileType");
        form.Add(new StringContent("تقرير تحليل صورة الدم الكاملة"), "Title");

        var uploadResp = await _client.PostAsync("/api/attachments/upload", form);
        uploadResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var attDto = await uploadResp.Content.ReadFromJsonAsync<AttachmentDto>(_jsonOptions);
        attDto.Should().NotBeNull();

        // Soft-delete attachment triggers AuditLog entry per Rule 5 of AGENTS.md
        var deleteAttResp = await _client.DeleteAsync($"/api/attachments/{attDto!.Id}");
        deleteAttResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // =====================================================================
        // STAGE 8: Treasury Invoicing Verification
        // =====================================================================
        SetBearerToken(receptionistLogin.Token);
        var invoiceResp = await _client.GetAsync($"/api/invoices/{invoiceId}");
        invoiceResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var invoiceDto = await invoiceResp.Content.ReadFromJsonAsync<InvoiceDetailDto>(_jsonOptions);
        invoiceDto!.Status.Should().Be(InvoiceStatus.Paid);
        invoiceDto.PaidPiastres.Should().Be(30_000L);
        invoiceDto.RemainingPiastres.Should().Be(0L);

        // Attempting to pay an already paid invoice must be rejected with INVOICE_ALREADY_PAID
        var duplicatePaymentReq = new RecordPaymentRequestDto
        {
            AmountPiastres = 5_000L,
            PaymentMethod = PaymentMethod.Cash
        };
        var duplicatePaymentResp = await _client.PostAsJsonAsync($"/api/invoices/{invoiceId}/payments", duplicatePaymentReq);
        duplicatePaymentResp.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // =====================================================================
        // STAGE 9: Receptionist Shift Closure & Reconciliation
        // =====================================================================
        var closeShiftReq = new CloseShiftRequestDto
        {
            ShiftId = shiftId,
            ActualClosingCashPiastres = 80_000L, // Physical drawer exactly matches expected 800 EGP (500 opening + 300 exam)
            ClosingNotes = "إغلاق الوردية الصباحية - الخزينة مطابقة تماماً",
            Version = shiftVersion
        };

        var closeShiftResp = await _client.PostAsJsonAsync("/api/shifts/close", closeShiftReq);
        closeShiftResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var closeShiftResult = await closeShiftResp.Content.ReadFromJsonAsync<ShiftCloseResponseDto>(_jsonOptions);
        closeShiftResult!.DifferenceType.Should().Be("Balanced");
        closeShiftResult.CashDifferencePiastres.Should().Be(0L);

        // =====================================================================
        // STAGE 10: Audit Log & Concurrency Token Verification
        // =====================================================================
        using (var scope = _app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();

            // 1. AuditLog entries verification
            var auditLogs = await db.AuditLogs.ToListAsync();
            auditLogs.Should().NotBeEmpty();

            // 2. Concurrency tokens verification
            var persistedPatient = await db.Patients.FindAsync(patientId);
            persistedPatient!.Version.Should().BeGreaterThanOrEqualTo(1);

            var persistedVisit = await db.MedicalVisits.FindAsync(visitId);
            persistedVisit!.Version.Should().BeGreaterThan(1);

            var persistedShift = await db.Shifts.FindAsync(shiftId);
            persistedShift!.IsClosed.Should().BeTrue();
            persistedShift.Version.Should().BeGreaterThan(1);

            // 3. Zero Financial Leakage Invariant
            var txs = await db.FinancialTransactions.Where(t => t.ShiftId == shiftId).ToListAsync();
            long totalTxCash = txs.Where(t => t.PaymentMethod == PaymentMethod.Cash && t.Type == TransactionType.Payment)
                                  .Sum(t => t.AmountPiastres);
            totalTxCash.Should().Be(30_000L);
        }
    }

    // -------------------------------------------------------------------------
    // Test Helpers
    // -------------------------------------------------------------------------
    private async Task<LoginResponseDto> AuthenticateFullAsync(string username, string password)
    {
        var resp = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequestDto
        {
            Username = username,
            Password = password
        });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<LoginResponseDto>(_jsonOptions);
        dto.Should().NotBeNull();
        return dto!;
    }

    private void SetBearerToken(string token)
    {
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }
}
