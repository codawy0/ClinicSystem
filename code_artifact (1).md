# الوثيقة الهندسية وخطة التنفيذ (v2.0 Production-Hardened): نظام إدارة عيادة طبيب استشاري

> **تحديث المراجعة الهندسية (v2.0):** تم تحديث هذه الوثيقة بالكامل لمعالجة كافة الثغرات الإنتاجية، مشاكل التزامن في SQLite، دقة الحسابات المالية، التوقيت المحلي للعيادات في مصر، حماية خصوصية بيانات المرضى (PHI)، وتقسيم المهام لضمان عدم ارتجال الـ AI Agent (**Antigravity / Codex**) أثناء التنفيذ.

---

## أولاً: الملخص التنفيذي لأهم التعديلات الهندسية الحرجة (Critical Production Fixes)

### 1. قاعدة البيانات والتزامن والأمان (SQLite Concurrency & Integrity)
1. **المبالغ المالية بالقروش (`long Piastres`):** تم إلغاء تحويل `decimal` إلى `double` نهائياً لمنع أخطاء التقريب المالي. تُخزن كافة المبالغ كأعداد صحيحة `long` تمثل **القروش** ($\text{1 EGP} = 100\text{ Piastres}$)، مما يجعل عمليات `Sum()` و `OrderBy()` دقيقة بنسبة $100\%$ ومتطابقة عبر كافة قواعد البيانات.
2. **تطبيق إعدادات SQLite لكل اتصال (`DbConnectionInterceptor`):** بما أن `busy_timeout` و `synchronous` و `foreign_keys` تُطبق على مستوى كل اتصال (Connection) وليس الملف، يتم حقنها عبر `SqlitePragmaConnectionInterceptor` عند فتح أي اتصال جديد، مع استخدام `PRAGMA synchronous = FULL;` لحماية البيانات المالية والطبية من انقطاع الكهرباء المفاجئ.
3. **منع تضارب أرقام الطابور (`QueueNumber` Race Condition):**
   * تمر عمليات حجز الدور وتحديث الطابور عبر قناة تسلسلية واحدة داخل السيرفر (`SemaphoreSlim(1, 1)`).
   * فهرس فريد مركب `UNIQUE(DoctorUserId, BusinessDate, QueueNumber)` مع إعادة المحاولة تلقائياً عند التضارب.
   * الاعتماد على **ترتيب الحضور الفعلي (`ArrivedAtUtc`)** لإعطاء رقم الدور عند وصول المريض للعيادة، مع دعم الحالات المستعجلة (`IsUrgent`) وحالات التخطي المؤقت (`Skipped` للمريض الذي يصلي أو في الصيدلية) دون ضياع دوره.
4. **مفهوم "يوم العمل" في مصر (`BusinessDate` vs UTC):**
   * الأطباء الاستشاريون يعملون غالباً بعد منتصف الليل (حتى 2 أو 3 صباحاً). الاعتماد على `DateTime.UtcNow.Date` يقسم شيفت العيادة إلى يومين ويصفر الطابور في منتصف الليل!
   * الحل: تخزين جميع الطوابع الزمنية بـ `UTC` (مع إجبار `DateTimeKind.Utc` عند القراءة من SQLite)، وإضافة حقل **`BusinessDate` (`DateOnly`)** يُحسب بتوقيت مصر (`Egypt Standard Time`) مع حد انقضاء يوم عمل الساعة **05:00 صباحاً** (أي كشف قبل 5 فجراً يتبع يوم عمل الأمس، أو يتبع تاريخ الوردية المفتوحة).
5. **عزل المرفقات وقاعدة البيانات خارج مجلد البرنامج (PHI Security):**
   * يُمنع تماماً وضع صور الأشعة والتحاليل داخل `wwwroot`.
   * تُحفظ قاعدة البيانات والمرفقات والنسخ الاحتياطية في مجلد بيانات مستقل (`%ProgramData%\ClinicSystem\data\` في الإنتاج، أو `./appdata` في التطوير).
   * تُحفظ المرفقات بأسماء `GUID` عشوائية، مع فحص `Magic Bytes` وحجم الملف، وتُعرض فقط عبر Endpoint محمي بالتوثيق (`GET /api/attachments/{id}/file`).

### 2. البحث العربي، الدفتر المالي، وسير العمل الطبي في مصر
1. **تطبيع البحث العربي والأرقام (`ArabicNormalizer`):**
   * إلغاء `.ToLower()` للبحث العربي، وإنشاء أعمدة مفهرسة مطبعة عند الحفظ (`SearchName`, `NormalizedPhone`).
   * توحيد (`أ/إ/آ/ٱ` $\leftarrow$ `ا`، `ى` $\leftarrow$ `ي`، `ة` $\leftarrow$ `ه`، وإزالة التشكيل والتطويل)، وتحويل الأرقام الهندية (`٠-٩` $\leftarrow$ `0-9`)، وتوحيد صيغة الموبايل المصري (`+201` $\leftarrow$ `01`).
   * رقم الهاتف **غير فريد (Non-Unique)** لأن الأم والأطفال يشتركون في نفس الرقم؛ البحث يعيد كل أفراد الأسرة مع السن ورقم الملف وصلة القرابة.
2. **دفتر الأستاذ المالي والورديات (Ledger as Source of Truth):**
   * نقل فتح/تقفيل الوردية إلى **المرحلة الثانية (Phase 2)** ومنع تحصيل أي مبالغ إذا لم تكن هناك وردية مفتوحة.
   * دعم الفواتير متعددة البنود (`InvoiceLine`: كشف، رسم قلب، سونار، فتح ملف) والمدفوعات الجزئية، الاسترداد (`Refund`)، والإلغاء بسبب (`Void`) دون حذف أي سجل مالي (`No Hard Delete`).
   * مطابقة نقدية الوردية تحسب **الكاش فقط**: $\text{ExpectedCash} = \text{OpeningBalance} + \text{CashIncome} - \text{CashExpenses}$، بينما يظهر `Instapay` (مع رقم المرجع) والمحافظ الإلكترونية (`VodafoneCash`) والبطاقات في خانات مستقلة.
3. **السلامة الدوائية والحفظ التلقائي (Clinical Safety & Autosave):**
   * حفظ مسودة الكشف تلقائياً (`Draft Autosave`) كل 5 ثوانٍ في السيرفر وفي `localStorage` لتفادي ضياع الروشتة عند انقطاع الكهرباء.
   * ربط الحساسية الدوائية بالمادة الفعالة (`ActiveIngredient`)، وإضافة تنبيهات الحمل والرضاعة، وتجزئة ضغط الدم إلى (`Systolic` / `Diastolic`) والسكر إلى (`Fasting` / `Random` / `PostPrandial`).
   * استبدال قراءة الصوت السحابية في تلفزيون الانتظار بملفات صوتية عربية محلية مسجلة مسبقاً للأرقام (`Offline Audio Sprites/Clips`) تعمل بدون إنترنت بنسبة $100\%$.

---

## ثانياً: ملف القواعد المعمارية المحدث للـ Agent (`AGENTS.md`)

*احفظ هذا الملف باسم `AGENTS.md` في المجلد الرئيسي للمشروع قبل البدء:*

```markdown
# Clinic Management System - Master Architecture & Agent Rules (v2.0)

## 1. Context Persistence & Agent Workflow (MANDATORY)
- Before starting ANY phase, read `docs/STATE.md` and `docs/DECISIONS.md` (create them in Phase 1 if they do not exist).
- At the end of EVERY phase, update `docs/STATE.md` (implemented entities, endpoints, UI routes, test status) and `docs/DECISIONS.md` (any assumptions made).
- **Ambiguity Rule:** Never leave TODO stubs or hacks. Choose the simplest production-safe option, implement it cleanly, and log it in `docs/DECISIONS.md`.
- **Verification Rule:** Before using version-sensitive APIs (`CoreWebView2.PrintAsync`, SignalR JWT WebSocket auth, EF Core SQLite translations), inspect installed package signatures or write an automated test to verify behavior.

## 2. Tech Stack & Monorepo Structure
- **Minimum OS for Desktop:** Windows 10 (1809+) / Windows 11 (x64) with WebView2 Runtime.
- `/backend`: ASP.NET Core 8 Web API (`Clinic.Api`) + `Clinic.Tests` (xUnit), EF Core 8 (`Microsoft.EntityFrameworkCore.Sqlite`), SignalR, Swashbuckle OpenAPI.
- `/frontend`: React 18 + Vite + TypeScript, Tailwind CSS, Shadcn/UI, Lucide Icons, `@fontsource/cairo` (offline bundled font—NO external CDNs), TanStack Query v5, `@microsoft/signalr`, `openapi-typescript`.
- `/desktop`: .NET 8 WPF (`Clinic.Desktop`) hosting `WebView2`, native print agent, and dual-monitor TV window manager.
- **Data Storage Location:** NEVER store the SQLite DB, attachments, or secrets inside the application install directory or `wwwroot`. Use a configurable `ClinicStorage:DataRoot` path defaulting to `%ProgramData%\ClinicSystem` in Production and `./.clinic-data` in Development.

## 3. Strict Database, Money, Time & Concurrency Rules
- **Single-Tenant DB Design (SaaS via Isolated DB per Clinic):** Each clinic runs on its own isolated SQLite database file (`clinic.db`). Do NOT scatter half-implemented `ClinicId` columns without filters; instead, support multiple doctors/assistants within the clinic via `DoctorUserId`.
- **Money Representation:** NEVER use `double` or `float` for money. Store all monetary fields in C# and SQLite as `long` representing **Piastres (قرش)** (`1 EGP = 100 Piastres`, e.g., `PricePiastres`, `AmountPiastres`). Format to EGP only in the UI/DTO display layer.
- **SQL Query Policy:** NEVER use raw SQL for business logic (use LINQ). Infrastructure SQL (`PRAGMA`, `BackupDatabase`, `wal_checkpoint`) is strictly isolated inside `/Infrastructure/Sqlite/`.
- **SQLite Per-Connection Pragmas:** Register a `DbConnectionInterceptor` (`SqlitePragmaInterceptor`) that executes on every `ConnectionOpened` / `ConnectionOpenedAsync`:
  `PRAGMA busy_timeout = 5000; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;`
  And execute `PRAGMA journal_mode = WAL;` once on startup.
- **Timezones & Clinic BusinessDate:**
  - Store all `DateTime` properties in UTC and configure a global EF Core `ValueConverter<DateTime, DateTime>` that enforces `DateTime.SpecifyKind(v, DateTimeKind.Utc)` on read.
  - Define a `BusinessDateService` using `Egypt Standard Time` (`Africa/Cairo`) with a configurable rollover hour (default `05:00 AM` local time) so clinic sessions running past midnight stay on the same `BusinessDate` (`DateOnly`).
- **Optimistic Concurrency & Idempotency:**
  - Mutable clinical/financial entities (`Patient`, `Appointment`, `MedicalVisit`, `Shift`, `Invoice`) must implement `long Version` configured with `.IsConcurrencyToken()`, auto-incremented in `SaveChangesAsync`. Return HTTP `409 Conflict` (`ProblemDetails`) on concurrency collisions.
  - All state-changing POST endpoints (`appointments`, `call-next`, `complete-consultation`, `payments`) must accept an `Idempotency-Key` header or payload field to prevent double-click duplicates.
- **Enums & Foreign Keys:** Store all Enums as strings via `.HasConversion<string>()` for readability and safety. Set default FK delete behavior to `DeleteBehavior.Restrict` (never cascade-delete medical or financial records).

## 4. Arabic Search Normalization Rules
- NEVER use `.ToLower()` or unindexed `.Contains()` for Arabic patient search.
- Implement `ArabicNormalizer.NormalizeText(string)` and `ArabicNormalizer.NormalizePhone(string)`:
  - Unify `أ, إ, آ, ٱ` -> `ا`; `ى` -> `ي`; `ة` -> `ه`; `ؤ` -> `و`; `ئ` -> `ي`; strip Arabic diacritics (tashkeel) and tatweel (`ـ`).
  - Convert Arabic-Indic digits (`٠-٩`) to Western digits (`0-9`).
  - Normalize Egyptian phone numbers (`+201...`, `00201...`, spaces/dashes -> `01...`).
- Persist `SearchName` and `NormalizedPhone` (NON-UNIQUE index, as families share phones) on `Patient` save, and search via indexed prefix (`StartsWith`) or token match.

## 5. Security, Audit & Offline LAN Rules
- **No Unauthenticated PHI:** Serve attachments only through `[Authorize] GET /api/attachments/{id}/file`. Validate file magic bytes (JPEG, PNG, WebP, PDF), enforce max size (10MB), and store on disk using `{Guid}.{ext}`.
- **SignalR Security:** `QueueHub` is read/subscribe-only for clients; clients NEVER invoke broadcast methods directly on the Hub. All broadcasts originate from Controllers/Services via `IHubContext<QueueHub>` AFTER `dbTransaction.CommitAsync()`. Support JWT `access_token` in query string for WebSockets and a restricted read-only `TvDeviceToken` for `/tv-queue`.
- **Audit Logging:** Log all create/update/void/status-change actions on medical and financial records into an `AuditLog` table (`ActorUserId`, `Action`, `EntityName`, `EntityId`, `DiffJson`, `CreatedAtUtc`).
- **Offline Zero-CDN Policy:** Bundle fonts (`@fontsource/cairo`), icons, and Arabic number audio clips locally in `/frontend/public/audio/`. Never fetch from external CDNs at runtime.
```

---

## ثالثاً: المواصفات التفصيلية لقاعدة البيانات (Strict Schema Specification)

*مرجع سريع للعلاقات، الفهارس الفريدة (Unique Indexes)، وأنواع البيانات الدقيقة:*

| الجدول (Entity) | الحقول الأساسية والأنواع | القيود والفهارس (Indexes & Constraints) |
| :--- | :--- | :--- |
| **`User`** | `Id`, `Username` (max 50), `PasswordHash`, `FullName`, `Role` (`Doctor`, `AssistantDoctor`, `Nurse`, `Receptionist`), `IsActive`, `MustChangePassword` | `UNIQUE(Username)` |
| **`ClinicSetting`** | `Id`, `ClinicName`, `DoctorName`, `DoctorTitle`, `Specialty`, `ConsultationValidityDays` (14), `MaxConsultationsPerExam` (1), `DefaultExamPricePiastres`, `DefaultConsultPricePiastres`, `EnableNursingStage` (bool), `TvPrivacyMode` (`FirstNameAndInitial`, `QueueNumberOnly`, `FullName`), `RolloverHourLocal` (5), `RxTopMarginMm`, `RxBottomMarginMm`, `TvDeviceToken`, `IsDoctorOnBreak` | سجل واحد للإعدادات العامة للعيادة |
| **`ServiceCatalog`** | `Id`, `Code`, `NameAr`, `NameEn`, `Category` (`Exam`, `Consultation`, `Procedure`, `FileFee`), `DefaultPricePiastres`, `IsActive` | يدعم الكشف، الاستشارة، والسونار/رسم القلب/الإجراءات |
| **`Patient`** | `Id`, `FileNumber` (string, max 30), `FullName`, `SearchName`, `Phone`, `NormalizedPhone`, `SecondaryPhone`, `NationalId` (max 14, optional), `Gender`, `BirthDate` (`DateOnly?`), `ApproximateAgeYears` (`int?`), `GuardianPatientId` (`int?`), `BloodType`, `IsPregnant`, `IsLactating`, `Version` (`long`) | `UNIQUE(FileNumber)`, `INDEX(SearchName)`, `INDEX(NormalizedPhone)` **(غير فريد لدعم العائلات)** |
| **`PatientAllergy`** | `Id`, `PatientId`, `ActiveIngredient` (normalized lowercase), `AllergyName`, `Severity` (`Mild`, `Moderate`, `Severe`), `Notes` | `INDEX(PatientId, ActiveIngredient)` لفحص تعارض الأدوية |
| **`PatientChronicCondition`** | `Id`, `PatientId`, `ConditionCode`, `ConditionName`, `Notes` | `INDEX(PatientId)` |
| **`Appointment`** | `Id`, `PatientId`, `DoctorUserId`, `ServiceId`, `BusinessDate` (`DateOnly`), `QueueNumber` (`int?` - يُمنح عند الحضور), `BookingType` (`WalkIn`, `Advance`), `IsUrgent` (`bool`), `Status` (`Booked`, `Waiting`, `InNursing`, `WithDoctor`, `Skipped`, `Completed`, `Cancelled`), `IsConsultation` (`bool`), `ParentExamAppointmentId` (`int?`), `ArrivedAtUtc`, `CalledAtUtc`, `CompletedAtUtc`, `CallSequence` (`long`), `IdempotencyKey`, `Version` (`long`) | `UNIQUE(DoctorUserId, BusinessDate, QueueNumber)` (Filtered where `QueueNumber IS NOT NULL`), `UNIQUE(IdempotencyKey)`, `INDEX(BusinessDate, Status)` |
| **`AppointmentStatusHistory`** | `Id`, `AppointmentId`, `FromStatus`, `ToStatus`, `ChangedByUserId`, `Reason`, `ChangedAtUtc` | `INDEX(AppointmentId)` لحساب أوقات الانتظار |
| **`MedicalVisit`** | `Id`, `AppointmentId`, `PatientId`, `DoctorUserId`, `IsDraft` (`bool`), `BpSystolic` (`int?`), `BpDiastolic` (`int?`), `WeightKg` (`decimal?`), `HeightCm` (`decimal?`), `TempCelsius` (`decimal?`), `BloodSugarMgDl` (`int?`), `BloodSugarType` (`Fasting`, `Random`, `PostPrandial`), `PulseBpm` (`int?`), `Spo2Pct` (`int?`), `LmpDate` (`DateOnly?`), `ChiefComplaint`, `Examination`, `Diagnosis`, `Icd10Code`, `DoctorPrivateNotes`, `SpecialtyDataJson`, `NextVisitDate` (`DateOnly?`), `CompletedAtUtc`, `Version` (`long`) | `UNIQUE(AppointmentId)`, `INDEX(PatientId, CompletedAtUtc DESC)` |
| **`VisitAddendum`** | `Id`, `MedicalVisitId`, `AuthorUserId`, `NoteText`, `CreatedAtUtc` | يمنع تعديل الكشف المكتمل؛ يضاف كملحق طبي (Addendum) |
| **`Drug`** | `Id`, `TradeName`, `SearchTradeName`, `ActiveIngredient` (lowercase), `Strength` (e.g. `500 mg`), `Form` (`Tablet`, `Syrup`, `Injection`, `Capsule`, `Ointment`, `Drops`), `Category`, `DefaultDosage`, `DefaultTiming`, `DefaultDuration`, `AvoidInPregnancy` (`bool`), `AvoidInLactation` (`bool`), `IsDiscontinued` (`bool`), `IsDemoSeed` (`bool`) | `INDEX(SearchTradeName)`, `INDEX(ActiveIngredient)` |
| **`PrescriptionItem`** | `Id`, `MedicalVisitId`, `DrugId` (`int?`), `DrugNameSnapshot`, `StrengthSnapshot`, `FormSnapshot`, `ActiveIngredientSnapshot`, `Dosage`, `Timing`, `Duration`, `Notes`, `WarningOverridden` (`bool`), `OverrideReason` | يحفظ نسخة نصية كاملة من الدواء والتركيز وقت الطباعة |
| **`ClinicalRequestItem`** | `Id`, `MedicalVisitId`, `RequestType` (`Lab`, `Radiology`), `CatalogCode`, `NameAr`, `NameEn`, `Notes`, `ResultSummary` | طلبات التحاليل والأشعة المنظمة |
| **`PatientAttachment`** | `Id`, `PatientId`, `MedicalVisitId` (`int?`), `FileType` (`Ray`, `Lab`, `Report`, `Document`), `Title`, `StorageFileName` (`Guid.ext`), `OriginalFileName`, `MimeType`, `SizeBytes`, `UploadedByUserId`, `UploadedAtUtc`, `IsDeleted` | `INDEX(PatientId, IsDeleted)` |
| **`Shift`** | `Id`, `UserId`, `BusinessDate` (`DateOnly`), `OpenedAtUtc`, `ClosedAtUtc`, `OpeningBalancePiastres` (`long`), `ExpectedClosingCashPiastres` (`long`), `ActualClosingCashPiastres` (`long?`), `CashDifferencePiastres` (`long?`), `IsClosed` (`bool`), `ClosingNotes`, `Version` (`long`) | `UNIQUE(UserId)` Filtered where `IsClosed = 0` (وردية مفتوحة واحدة لكل موظف) |
| **`Invoice` & `InvoiceLine`** | `Invoice`: `Id`, `AppointmentId`, `PatientId`, `TotalPiastres`, `DiscountPiastres`, `DiscountReason` (`None`, `Colleague`, `Staff`, `Charity`, `DoctorCustom`), `ApprovedByUserId`, `NetTotalPiastres`, `PaidPiastres`, `RemainingPiastres`, `Status` (`Unpaid`, `Partial`, `Paid`, `Voided`), `Version` | يدعم تعدد الخدمات والمدفوعات الجزئية وخصم الزملاء |
| **`FinancialTransaction`** | `Id`, `ShiftId`, `InvoiceId` (`int?`), `Type` (`Payment`, `Refund`, `Expense`, `VoidReversal`), `ExpenseCategory`, `AmountPiastres` (`long`), `PaymentMethod` (`Cash`, `Instapay`, `VodafoneCash`, `Card`), `ReferenceNumber` (لإنستا باي/الكارت), `Description`, `CreatedByUserId`, `CreatedAtUtc`, `IdempotencyKey` | **دفتر الأستاذ غير قابل للحذف (Immutable Ledger)**؛ `UNIQUE(IdempotencyKey)` |
| **`PrintJob`** | `Id`, `TargetRole` (`DoctorPrinter`, `ReceptionReceiptPrinter`), `DocumentType` (`Prescription`, `Receipt`, `LabSlip`, `SickLeave`), `PayloadJson`, `Status` (`Pending`, `Printed`, `Failed`), `CreatedAtUtc` | يتيح الطباعة الصامتة حتى لو ضغط الدكتور "طباعة" من التابلت |

---

## رابعاً: خطة التنفيذ المقسمة إلى 7 مراحل (Sequential Agent Prompts)

### Phase 1: Backend Foundation, Exact SQLite Schema, Interceptors & Concurrency Tests

**الهدف:** تأسيس مشروع الباك إند ومشروع الاختبارات، كتابة الجداول بالمواصفات القياسية (القروش `long`، التوقيت، التطبيع العربي، `SqlitePragmaInterceptor`)، واجتياز اختبار التزامن.

```text
Read `AGENTS.md` carefully. Execute **Phase 1: Backend Foundation, Exact SQLite Schema, Interceptors, Arabic Normalizer, and xUnit Concurrency Tests**.

### Tasks:
1. Initialize the solution structure:
   - `/backend/Clinic.Api` (ASP.NET Core 8 Web API, Swashbuckle OpenAPI, ProblemDetails enabled).
   - `/backend/Clinic.Tests` (xUnit test project referencing `Clinic.Api`).
   - Create `docs/STATE.md` and `docs/DECISIONS.md` to track architectural state across phases.
2. Implement Core Utilities & Infrastructure in `/backend/Clinic.Api/Infrastructure/`:
   - `ArabicNormalizer`:
     - `NormalizeText(string)`: Unifies `أ,إ,آ,ٱ` -> `ا`, `ى` -> `ي`, `ة` -> `ه`, `ؤ` -> `و`, `ئ` -> `ي`, strips Arabic tashkeel/tatweel, converts Arabic-Indic digits `٠-٩` to `0-9`, trims and collapses whitespace.
     - `NormalizePhone(string)`: Converts Arabic digits, strips spaces/dashes, normalizes `+201...` and `00201...` to `01...`.
   - `BusinessDateService`: Computes clinic `BusinessDate` (`DateOnly`) using `Egypt Standard Time` (`Africa/Cairo`) with a configurable rollover hour (default `05:00 AM` local time, so a 1:30 AM consultation belongs to the previous evening's clinic session).
   - `SqlitePragmaInterceptor` (`DbConnectionInterceptor`): On `ConnectionOpened` and `ConnectionOpenedAsync`, executes:
     `PRAGMA busy_timeout = 5000; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;`
   - `BookingWriteLock`: A singleton serialized lane (`SemaphoreSlim(1, 1)`) for atomic queue number assignment and shift financial writes.
3. Implement Domain Entities & `ClinicDbContext`:
   - Implement all entities defined in the Schema Specification (`User`, `ClinicSetting`, `ServiceCatalog`, `Patient`, `PatientAllergy`, `PatientChronicCondition`, `Appointment`, `AppointmentStatusHistory`, `MedicalVisit`, `VisitAddendum`, `Drug`, `PrescriptionItem`, `ClinicalRequestItem`, `PatientAttachment`, `Shift`, `Invoice`, `InvoiceLine`, `FinancialTransaction`, `PrintJob`, `AuditLog`).
   - Configure all monetary properties as `long` in Piastres (`*Piastres`).
   - Configure all `Enum` properties with `.HasConversion<string>()`.
   - Configure global `DateTime` value converter to enforce `DateTimeKind.Utc` on read.
   - Override `SaveChangesAsync` to automatically increment `Version` (`long`) on modified concurrency-tracked entities, populate `SearchName` / `NormalizedPhone` on `Patient` and `SearchTradeName` on `Drug`, and write `AuditLog` entries.
   - Add all required indexes:
     - `UNIQUE(DoctorUserId, BusinessDate, QueueNumber)` with filter `QueueNumber IS NOT NULL`.
     - `UNIQUE(UserId)` on `Shift` with filter `IsClosed = 0`.
     - `UNIQUE(AppointmentId)` on `MedicalVisit`.
     - Non-unique indexes on `Patient.SearchName` and `Patient.NormalizedPhone`.
4. Configure Startup & Safe Seeding (`Program.cs`):
   - Resolve `DataRoot` from config (`./.clinic-data` in Dev, `%ProgramData%\ClinicSystem` in Prod) and create subdirectories (`db/`, `attachments/`, `backups/`, `config/`).
   - On startup, open connection, set `PRAGMA journal_mode = WAL;`, apply migrations (creating a pre-migration file copy backup if DB already exists).
   - `DbSeeder`:
     - Always seed structural defaults if empty: `ClinicSetting`, default `ServiceCatalog` items (كشف، استشارة، كشف مستعجل، سونار، رسم قلب), and initial users (`doctor`, `assistant`, `nurse`, `receptionist`) with `MustChangePassword = true` in Production.
     - ONLY when `app.Environment.IsDevelopment()` is true: seed demo patients (including family members sharing a phone number), sample drugs marked `IsDemoSeed = true`, and sample appointments.
5. Create `QueueHub` (`/hubs/queue`):
   - Client methods are strictly for joining groups (`JoinClinicGroup`). Clients CANNOT invoke broadcast methods directly.
   - Configure JWT authentication to support `access_token` from query string for `/hubs/queue`, plus a read-only `TvDeviceToken` header/query validator for the waiting room TV.

### Definition of Done (Must Pass Before Finishing):
- Write xUnit tests in `Clinic.Tests`:
  1. `ArabicNormalizerTests`: Verifies hamza/taa-marbuta/tashkeel/Indic-digit normalization and Egyptian phone normalization.
  2. `BusinessDateTests`: Verifies that 01:30 AM Cairo time maps to the previous calendar day's `BusinessDate`.
  3. `QueueConcurrencyTests`: Fires 30 parallel tasks assigning `QueueNumber` via `BookingWriteLock` against a real file-based SQLite DB and asserts 30 unique, gapless queue numbers (`1..30`) with zero `SQLITE_BUSY` failures.
- Run `dotnet test` and confirm 100% pass. Update `docs/STATE.md` and `docs/DECISIONS.md`.
```

---

### Phase 2: Auth, Minimal Shift Desk, Receptionist Cockpit, Live Queue & Offline TV Screen

**الهدف:** بناء التوثيق، فتح/تقفيل الوردية (لمنع أي حجز بدون وردية مفتوحة)، شاشة السكرتارية الموحدة، منطق الطابور الذكي (الحضور، التخطي، الاستدعاء الذري)، وشاشة التلفزيون بالصوت المحلي بدون إنترنت.

```text
Read `AGENTS.md`, `docs/STATE.md`, and `docs/DECISIONS.md`. Execute **Phase 2: Auth, Minimal Shift Management, Receptionist Cockpit, Atomic Queue Engine, and Waiting Room TV Screen**.

### Part A: Backend APIs
1. `AuthController`:
   - `POST /api/auth/login`: Returns JWT token, user profile, `mustChangePassword` flag, and clinic settings.
   - `POST /api/auth/change-password`: Changes password and clears `MustChangePassword`.
   - `GET /api/auth/dev-accounts`: Returns quick-login demo credentials ONLY when `IsDevelopment()` is true (returns 404 in Production).
2. `ShiftsController` (Minimal Shift Lifecycle required for bookings):
   - `GET /api/shifts/current`: Returns the logged-in user's currently open `Shift` (including calculated `ExpectedClosingCashPiastres = OpeningBalancePiastres + CashPaymentsPiastres - CashRefundsPiastres - CashExpensesPiastres`, plus separate totals for `Instapay`, `VodafoneCash`, and `Card`).
   - `POST /api/shifts/open`: Opens a new shift with `OpeningBalancePiastres` (enforcing only one open shift per user).
   - `POST /api/shifts/expense`: Records a cash petty expense into the active shift.
   - `POST /api/shifts/close`: Records `ActualClosingCashPiastres`, computes shortage/surplus, and closes the shift.
3. `PatientsController`:
   - `GET /api/patients/search?q=`: Searches `SearchName`, `NormalizedPhone`, and `FileNumber` using `ArabicNormalizer`. Returns matching patients (supporting multiple family members per phone) with age, last visit date, and consultation eligibility.
   - `POST /api/patients` & `PUT /api/patients/{id}`: Creates/updates patient (auto-generating sequential `FileNumber` if not provided manually for legacy paper files).
   - `GET /api/patients/{id}/consultation-eligibility`: Checks the last `Completed` and paid Examination for this patient. Returns eligibility boolean, days remaining within `ConsultationValidityDays`, and whether `MaxConsultationsPerExam` has already been consumed.
4. `AppointmentsController` & Atomic Queue State Machine:
   - Enforce an explicit state-transition matrix:
     - `Booked` (advance booking) -> `Waiting` (upon arrival, assigns `QueueNumber` inside `BookingWriteLock`).
     - `Waiting` -> `InNursing` (if `EnableNursingStage` is true) OR `WithDoctor` / `Skipped` / `Cancelled`.
     - `Skipped` (patient praying/absent) -> `Waiting` (recalled to front of queue) or `WithDoctor`.
   - `POST /api/appointments`:
     - Requires an active open `Shift` if any payment is collected (returns `400 ProblemDetails` with code `SHIFT_REQUIRED` if no shift is open).
     - Inside `BookingWriteLock` + DB transaction: creates `Appointment`, assigns `QueueNumber` if patient has arrived (`WalkIn`), creates `Invoice` + `InvoiceLine` items (Exam, File Fee, or Procedures) and `FinancialTransaction` (`Cash`, `Instapay` with reference, `VodafoneCash`, `Card`), and logs `AppointmentStatusHistory`.
     - After commit, broadcasts `"QueueUpdated"` with monotonic `sequenceId` via `IHubContext<QueueHub>`.
   - `POST /api/queue/call-next`:
     - Single atomic source of truth for calling the next patient for `doctorUserId` (supports idempotency key so double-clicking cannot claim two patients).
     - Picks the next eligible patient ordered by `IsUrgent DESC, QueueNumber ASC`, transitions status to `WithDoctor`, increments `CallSequence`, commits, and broadcasts `"PatientCalled"` (containing `callSequence`, `queueNumber`, privacy-formatted `displayName`, and `roomName`).
   - `POST /api/queue/{appointmentId}/recall`, `POST /api/queue/{appointmentId}/skip`, and `POST /api/queue/doctor-break` (toggles `IsDoctorOnBreak` banner on TV).

### Part B: Frontend Setup & Screens (`/frontend`)
1. Initialize React 18 + Vite + TypeScript + Tailwind CSS in `/frontend`:
   - Install `@fontsource/cairo` locally and configure `dir="rtl"` as default.
   - Configure Vite proxy (`/api` and `/hubs` -> `http://localhost:5050` with `ws: true`).
   - Generate or define strict TypeScript interfaces matching the Backend DTOs (converting `Piastres` to formatted EGP strings via a `formatEgp(piastres)` helper).
2. Build Login Screen (`/login`):
   - Standard login form + password change modal if `mustChangePassword` is true.
   - Show Demo Quick-Login buttons ONLY if `GET /api/auth/dev-accounts` succeeds.
3. Build **Receptionist Unified Cockpit (`/reception`)**:
   - **Shift Guard Banner:** If no shift is open, display a prominent modal/button to open shift with opening cash balance before allowing payment collection.
   - **Right Panel (Search & 1-Click Booking):**
     - Instant normalized Arabic/Phone search showing all family members sharing a phone number, their age, and phone suffix.
     - Automatic badge if eligible for Free/Discounted Consultation (`استشارة مجانية متاحة - متبقي X يوم`).
     - Inline form to add new patient (supports DOB or approximate age in years + optional family guardian link), select service + extra billable procedures (e.g., ECG/Sonar), apply enumerated Discount Reason if any, collect full or partial payment (`Cash`, `Instapay` + ref, `VodafoneCash`, `Card`), and print 80mm Thermal Receipt (with Queue Number).
   - **Center Panel (Live Queue Board):**
     - Real-time SignalR connection with automatic reconnect and full state refetch on reconnect.
     - Tabs/Columns for: `حجوزات مسبقة لم تحضر` | `في الانتظار` | `في التمريض` | `بالداخل مع الطبيب` | `غائب مؤقتاً (Skipped)` | `تم الكشف (مدفوع / متبقي عليه مبلغ)`.
     - 1-click buttons to mark arrived, mark urgent (`مستعجل`), skip/recall absent patient, or collect remaining balance.
   - **Left Panel (My Active Shift Drawer):**
     - Shows ONLY the current receptionist's active shift: Opening Cash, Expected Cash in Drawer, non-cash collections (`Instapay`/Wallets), quick petty expense form, and **"تقفيل وتسليم الوردية (Close Shift)"** modal.
4. Build **Waiting Room TV Screen (`/tv-queue`)**:
   - Connects using `TvDeviceToken` (no user login required).
   - High-contrast 10-foot TV UI displaying: Current Queue Number & Privacy-formatted Name (`محمد أ.`), Doctor Room Status (or `"الطبيب في استراحة قصيرة"` banner), and the next 5 waiting numbers.
   - **100% Offline Audio Engine:** Generate local WAV audio files (chime + spoken Arabic digits/phrases or synthesized offline audio blobs) in `/public/audio/` so when `"PatientCalled"` arrives (deduplicated by `callSequence`), the TV plays the chime and announces the queue number offline without relying on cloud TTS. Include a 1-click "تفعيل الصوت وملء الشاشة" overlay to satisfy browser autoplay rules (and bypass it automatically in WebView2).

### Definition of Done:
- `dotnet test` passes (add integration tests for Shift cash calculation excluding Instapay, and atomic `call-next` idempotency).
- `npm run build` succeeds with 0 TypeScript errors.
- Update `docs/STATE.md` and `docs/DECISIONS.md`.
```

---

### Phase 3A: Nurse Prep Screen, Vitals Tracking, Clinical History Pagination & Draft Autosave

**الهدف:** بناء شاشة التمريض، العلامات الحيوية المهيكلة (الضغط، السكر، الحمل/الرضاعة)، استعراض التاريخ المرضي بصفحات سريعة (Paginated)، ونظام الحفظ التلقائي للمسودات لمنع ضياع البيانات عند انقطاع الكهرباء.

```text
Read `AGENTS.md`, `docs/STATE.md`, and `docs/DECISIONS.md`. Execute **Phase 3A: Nurse Prep Screen, Structured Vitals, Paginated Patient History, and Consultation Draft Autosave**.

### Part A: Backend APIs
1. Create `MedicalVisitsController`:
   - `GET /api/visits/patient/{patientId}?page=1&pageSize=10`: Returns paginated medical history timeline (past visits, vitals, diagnoses, prescription snapshots, requested labs, and attachment thumbnails/metadata), plus patient chronic conditions and structured allergies.
   - `PUT /api/visits/appointment/{appointmentId}/vitals`:
     - Saves/updates structured vitals (`BpSystolic`, `BpDiastolic`, `WeightKg`, `HeightCm`, `TempCelsius`, `BloodSugarMgDl`, `BloodSugarType`, `PulseBpm`, `Spo2Pct`, `LmpDate`) and patient pregnancy/lactation flags (`IsPregnant`, `IsLactating`).
     - Checks `Version` concurrency token (returns `409 Conflict` if stale).
     - Optionally transitions appointment from `Waiting`/`InNursing` to ready for doctor, and broadcasts `"VitalsUpdated"` via `QueueHub`.
   - `PUT /api/visits/appointment/{appointmentId}/draft`:
     - Upserts an in-progress `MedicalVisit` (`IsDraft = true`) with clinical notes (`ChiefComplaint`, `Examination`, `Diagnosis`, `DoctorPrivateNotes`, `SpecialtyDataJson`, draft `PrescriptionItems`, and `ClinicalRequestItems`).
     - Designed to be called every 5 seconds while the doctor types so a power outage loses nothing.
   - `POST /api/visits/{visitId}/addendum`:
     - Appends a `VisitAddendum` to an already completed visit (completed visits are immutable and cannot be overwritten).
2. Create `PatientClinicalProfileController`:
   - `PUT /api/patients/{id}/clinical-alerts`: Updates structured `PatientAllergy` (linked to `ActiveIngredient`) and `PatientChronicCondition` tags.

### Part B: Frontend Screens
1. Build **Nurse Prep & Vitals Screen (`/nursing`)**:
   - Displays waiting/in-nursing queue with real-time updates.
   - Structured Vitals form with abnormal value highlighting (e.g., red border if `BpSystolic >= 140` or `BpDiastolic >= 90`).
   - Quick toggle for female patients (`حامل / مرضعة`) and editor for Chronic Conditions (سكر، ضغط، قلب، كبد) & Drug Allergies.
   - **"حفظ وتحويل للطبيب"** button.
2. Build the **Patient Clinical Header & History Sidebar Components** (to be embedded in the Doctor Cockpit):
   - Prominent **RED ALERT Banner** displaying Allergies, Chronic Conditions, and Pregnancy/Lactation warnings.
   - Vitals trend badges (comparing today's BP/Weight/Sugar with the previous visit's delta).
   - Paginated timeline of past visits with lazy loading and an **"إضافة ملحق طبي (Addendum)"** option on past completed visits.

### Definition of Done:
- `dotnet test` passes (including concurrency conflict test returning 409 when two requests update the same visit simultaneously, and immutability check on completed visits).
- `npm run build` succeeds with 0 TypeScript errors.
- Update `docs/STATE.md` and `docs/DECISIONS.md`.
```

---

### Phase 3B: Doctor's Single-Screen Cockpit, Drug Safety Engine & Smart E-Prescription

**الهدف:** بناء شاشة الطبيب الاستشاري الكاملة، قاموس الأدوية بالتركيز والمادة الفعالة، محرك فحص الحساسية والحمل والرضاعة، تكرار الروشتة الآمن، وإنهاء الكشف.

```text
Read `AGENTS.md`, `docs/STATE.md`, and `docs/DECISIONS.md`. Execute **Phase 3B: Doctor's Single-Screen Cockpit, Drug Allergy/Pregnancy Safety Engine, and Smart E-Prescription**.

### Part A: Backend APIs
1. Create `DrugsController` & `PrescriptionTemplatesController`:
   - `GET /api/drugs/search?q=`: Fast prefix/token search on `SearchTradeName` and `ActiveIngredient` (excludes `IsDiscontinued = true` unless requested).
   - `POST /api/drugs`, `PUT /api/drugs/{id}`: CRUD for drugs (`TradeName`, `ActiveIngredient`, `Strength`, `Form`, `DefaultDosage`, `DefaultTiming`, `DefaultDuration`, `AvoidInPregnancy`, `AvoidInLactation`, `IsDiscontinued`).
   - `POST /api/drugs/import-csv`: Allows the doctor to import a verified real-world drug dictionary CSV (and an option to purge `IsDemoSeed = true` records).
   - `POST /api/drugs/check-safety`: Given `patientId` and a list of `drugIds`/`activeIngredients`, checks against `PatientAllergy` (`ActiveIngredient` match), duplicate active ingredients in the same Rx, and patient `IsPregnant`/`IsLactating` flags. Returns structured warnings (`AllergyConflict`, `DuplicateIngredient`, `PregnancyWarning`, `DiscontinuedDrug`).
   - CRUD for `PrescriptionTemplate` (1-click diagnosis + drug sets + lab/radiology requests).
2. Add `POST /api/visits/appointment/{appointmentId}/complete` in `MedicalVisitsController`:
   - Requires `Idempotency-Key`.
   - Validates that any severe drug safety warnings have `WarningOverridden = true` with an `OverrideReason`.
   - Snapshots `DrugNameSnapshot`, `StrengthSnapshot`, `FormSnapshot`, `ActiveIngredientSnapshot` onto each `PrescriptionItem`.
   - Marks `MedicalVisit.IsDraft = false`, `CompletedAtUtc = DateTime.UtcNow`, transitions `Appointment.Status = Completed`, logs `AppointmentStatusHistory`, commits, and broadcasts `"QueueUpdated"`.

### Part B: Frontend Doctor Cockpit (`/doctor`)
1. Build **Doctor's Single-Screen Cockpit (`/doctor`)**:
   - **Top Bar:** Current patient info, Vitals, Red Alerts, **"نداء المريض التالي (`F9`)"** button (calls `POST /api/queue/call-next`), **"تخطي مؤقت (غائب)"**, and **"استراحة الطبيب"** toggle.
   - **Autosave Engine:** Automatically syncs draft notes and Rx items to `PUT /api/visits/appointment/{id}/draft` every 5 seconds and caches in `localStorage` with a live status indicator (`تم الحفظ تلقائياً`).
   - **Center Clinical Workspace:**
     - Chief Complaint, Examination, Diagnosis, and Private Notes (with optional feature-detected Web Speech dictation button + tooltip reminding doctor that Windows `Win+H` works offline).
     - **Smart E-Prescription Builder (`dir="auto"` / `<bdi>` for clean mixed English drug names & Arabic dosages):**
       - Autocomplete drug search displaying `TradeName + Strength + Form` (e.g., `Augmentin 1g Tablet`).
       - Real-time safety check: immediately highlights red warning banners if a selected drug conflicts with the patient's recorded Allergies, Pregnancy/Lactation status, or duplicates another drug's active ingredient, requiring an override reason to proceed.
       - **"تكرار الروشتة السابقة (Repeat Prescription)"** from the history sidebar: copies items into today's Rx, automatically re-runs the safety check, and flags any drug that was discontinued since that visit.
       - 1-click **Prescription Template** selector and "Save current Rx as Template" button.
     - **Lab & Radiology Requests Selector:** Quick tags/search to request Labs & Radiology for the next visit.
   - **Keyboard Shortcuts:** `F2` (Quick Patient Search), `F4` (Focus Drug Search), `F9` (Call Next Patient), `Ctrl+Enter` (Save & Complete), `Ctrl+P` (Complete & Print).

### Definition of Done:
- `dotnet test` passes (test drug allergy conflict detection, pregnancy warning detection, Rx snapshot immutability, and idempotent visit completion).
- `npm run build` succeeds with 0 TypeScript errors.
- Update `docs/STATE.md` and `docs/DECISIONS.md`.
```

---

### Phase 3C: Authenticated Attachments (PHI Safe), Printable Medical Documents & Print Abstraction

**الهدف:** بناء نظام رفع ومقارنة الأشعة والتحاليل المحمي، وتصميم المطبوعات الطبية (الروشتة بوضعي الورق المطبوع مسبقاً أو الكامل، نموذج التحاليل والأشعة، وتقرير الإجازة المرضية)، مع خدمة الطباعة الموحدة (`printService`).

```text
Read `AGENTS.md`, `docs/STATE.md`, and `docs/DECISIONS.md`. Execute **Phase 3C: Authenticated PHI Attachments, Printable Medical Documents, and Print Service Abstraction**.

### Part A: Backend APIs
1. Create `AttachmentsController` (Zero-Public-Static-Files Policy):
   - `POST /api/attachments/upload`:
     - `[Authorize]` endpoint accepting multipart file upload (`patientId`, `medicalVisitId?`, `fileType`, `title`).
     - Validates file size (<= 10MB) and inspects file header **magic bytes** (allowing only JPEG, PNG, WebP, and PDF; rejecting executables or spoofed extensions).
     - Generates `{Guid}.{ext}` filename and saves inside `{DataRoot}/attachments/{year}/{month}/` (strictly outside `wwwroot`, blocking any path traversal).
   - `GET /api/attachments/{id}/file`:
     - `[Authorize]` endpoint that streams the file with `Content-Disposition: inline` and appropriate `Content-Type`, logging the access if needed.
   - `DELETE /api/attachments/{id}`: Soft-deletes (`IsDeleted = true`) and logs in `AuditLog`.
2. Create `PrintJobsController`:
   - `POST /api/print-jobs`: Creates a `PrintJob` (`Prescription`, `Receipt`, `LabSlip`, `SickLeave`) and broadcasts `"PrintJobCreated"` via `QueueHub` to any connected WPF Desktop Shell registered as a print station (allowing a Doctor using an iPad/Tablet to print silently on the clinic PC's printer).

### Part B: Frontend Viewers & Print Engine
1. **Side-by-Side Attachment Viewer Modal:**
   - Fetches authenticated image/PDF blobs via `Authorization: Bearer` header.
   - Supports side-by-side comparison of two X-rays/Lab reports (old vs. new) with zoom/pan controls.
2. **Unified Print Abstraction (`src/services/printService.ts`):**
   - Exposes `printDocument(kind: 'prescription' | 'receipt' | 'lab-slip' | 'sick-leave', payload)`.
   - Priority 1: If running inside WPF `WebView2` (`window.chrome?.webview`), sends native silent print message.
   - Priority 2: If configured to use Remote Workstation Printer (e.g., from Doctor's iPad), posts to `/api/print-jobs`.
   - Priority 3: Clean browser `@media print` fallback window.
3. **Printable Templates (Western digits `0-9` policy, proper `<bdi>` RTL/LTR isolation):**
   - **E-Prescription (`A5` / `A4`):**
     - **Letterhead Mode (ورق العيادة المطبوع مسبقاً):** Hides header/footer and applies configurable `RxTopMarginMm` and `RxBottomMarginMm` in `mm`.
     - **Full Digital Mode:** Full clinic header, patient name/age/date, `Rx` table (`DrugName + Strength + Form` in LTR column, Arabic dosage/timing/duration in RTL column), offline verification code QR (`RX-{VisitId}-{ShortHash}` - NO PHI in QR), and footer.
   - **Lab & Radiology Request Slip (`نموذج طلب تحاليل وأشعة`):** Separate printable slip listing requested tests and clinical indication.
   - **Medical Certificate / Sick Leave (`تقرير طبي / إجازة مرضية`):** Printable certificate with patient info, diagnosis, and recommended rest days.

### Definition of Done:
- `dotnet test` passes (test magic-byte validation rejecting a fake `.jpg` containing text/script, and test unauthenticated `GET /api/attachments/{id}/file` returning `401 Unauthorized`).
- `npm run build` succeeds.
- Update `docs/STATE.md` and `docs/DECISIONS.md`.
```

---

### Phase 4: Full Treasury & Ledger Analytics, Legacy CSV Import, Settings & Online SQLite Backup/Restore

**الهدف:** استكمال الخزينة والقيود المالية (الاسترداد، الإلغاء بسبب، تقارير الأرباح والخصومات)، استيراد المرضى القدامى من Excel/CSV، والتأمين الكامل للنسخ الاحتياطي والاسترجاع (`BackupDatabase` + `Restore`).

```text
Read `AGENTS.md`, `docs/STATE.md`, and `docs/DECISIONS.md`. Execute **Phase 4: Financial Ledger Refunds/Voids, Doctor Analytics, Legacy CSV Import, Settings, and Online SQLite Backup/Restore**.

### Part A: Backend APIs
1. Enhance `InvoicesController` & `TreasuryController`:
   - Support partial payments, paying remaining balances (`POST /api/invoices/{id}/pay`), Refunds (`POST /api/invoices/{id}/refund`), and Voids (`POST /api/invoices/{id}/void` with mandatory reason and audit log). Never hard-delete financial records.
   - `GET /api/analytics/doctor-summary` (`[Authorize(Roles = "Doctor")]`):
     - Filters by local `BusinessDate` range (`from`, `to`).
     - Returns: Gross Revenue, Foregone Revenue by Discount Reason (خصم الزملاء، الحالات المجانية، الموظفين), Refunds, Expenses, Net Profit, Cash vs. Instapay vs. VodafoneCash vs. Card breakdown, Exams vs. Consultations count, and **Average Patient Waiting Time** (computed from `AppointmentStatusHistory`: `ArrivedAt` -> `WithDoctor`).
2. Create `MigrationImportController` (`[Authorize(Roles = "Doctor")]`):
   - `POST /api/import/patients-csv`: Imports existing clinic patients from CSV (keeping legacy paper `FileNumber`, normalizing names and phones, and flagging potential duplicates).
3. Create `BackupController` (`[Authorize(Roles = "Doctor")]`) in `/Infrastructure/Sqlite/`:
   - `POST /api/backup/create`:
     - Uses `Microsoft.Data.Sqlite` `sourceConnection.BackupDatabase(destinationConnection)` (Online Backup API) to safely back up `clinic.db` while the clinic is live.
     - Runs `PRAGMA integrity_check;` on the backup DB file to verify zero corruption.
     - Packages the verified DB + incremental attachment manifest into `{DataRoot}/backups/backup-{timestamp}.zip` (with optional AES password encryption if configured) and supports downloading or copying to an external USB/Secondary path.
   - `POST /api/backup/restore`:
     - Acquires `BookingWriteLock`, validates the uploaded backup's `PRAGMA integrity_check;`, calls `SqliteConnection.ClearAllPools()`, swaps `clinic.db`, deletes stale `-wal` and `-shm` files, and triggers a clean state reload.
   - Add a background hosted service (`SqliteMaintenanceService`) that runs daily automatic backups with retention (keep last 14 daily backups) and executes `PRAGMA wal_checkpoint(TRUNCATE);` when idle.

### Part B: Frontend Screens
1. **Treasury & Shift History Screen (`/treasury`):**
   - Receptionist view: Active shift operations, partial balance collection, refund with reason, petty expenses, and shift closing report.
   - Doctor view: Audit all past shifts, view cashier discrepancies (`CashDifferencePiastres`), and inspect voided/refunded invoices.
2. **Doctor Financial & Operational Analytics (`/analytics` - Doctor Only):**
   - Date-range KPI cards (all converted cleanly from Piastres to EGP), payment method breakdown, discount/foregone revenue report, and waiting-time metrics.
3. **Clinic Settings, Catalog & Backup Center (`/settings` - Doctor Only):**
   - Tabs for: Clinic Profile & Working Hours, Services & Procedures Catalog (`ServiceCatalog`), User Accounts & Roles, Drug Dictionary + CSV Importer, Legacy Patient CSV Importer, Live Prescription Print Margin Calibrator (`mm`), and **1-Click Backup & Restore Center**.

### Definition of Done:
- `dotnet test` passes (test online `BackupDatabase` + `integrity_check` while concurrent reads occur, and test financial refund/void ledger math).
- `npm run build` succeeds.
- Update `docs/STATE.md` and `docs/DECISIONS.md`.
```

---

### Phase 5: Native Windows Desktop Shell (`WPF + WebView2`), Job-Object Lifecycle, Print Agent & Dual-Monitor TV

**الهدف:** بناء تطبيق الويندوز الأصلي (`/desktop`) بإدارة عمليات آمنة (منع العمليات اليتيمة عند الإغلاق عبر Windows Job Object / Mutex)، والطباعة الصامتة الحقيقية، والفتح التلقائي لشاشة الانتظار على التلفزيون الثاني.

```text
Read `AGENTS.md`, `docs/STATE.md`, and `docs/DECISIONS.md`. Execute **Phase 5: Native Windows Desktop Shell (`/desktop`), Safe Process Lifecycle, Silent Print Agent, and Dual-Monitor TV Launcher**.

### Tasks:
1. Configure Production SPA Hosting in `Clinic.Api`:
   - Configure `Clinic.Api` to serve static files from `wwwroot` ( strictly for the compiled React SPA bundle—attachments remain in `{DataRoot}/attachments`) and fallback to `index.html` for SPA routes.
   - Add `GET /api/system/health` returning `{ status: "ok", version: "2.0.0", serverTimeUtc, businessDate }`.
   - Support running `Clinic.Api` either as a Windows Service (`UseWindowsService()`) or as a local server process.
2. Create `/desktop/Clinic.Desktop` (.NET 8 WPF Application with `Microsoft.Web.WebView2`):
   - **Single-Instance & Process Safety:**
     - Enforce a single instance of `Clinic.Desktop` via a named `Mutex`.
     - Read desktop configuration from `%ProgramData%\ClinicSystem\config\desktop-config.json` (`Mode`: `"ServerAndClient"` or `"ClientOnly"`, `ServerUrl`: `"http://localhost:5050"`, `PrescriptionPrinterName`, `ReceiptPrinterName`, `AutoLaunchTvOnSecondMonitor`).
     - In `"ServerAndClient"` mode, if `/api/system/health` is not already responding (e.g., from a Windows Service), launch `Clinic.Api.exe` and attach it to a **Windows Job Object (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`)** so if the WPF shell crashes or closes, the child API process is guaranteed by the OS kernel never to remain orphaned.
     - Poll `/api/system/health` before navigating `WebView2`, and show a clean native Arabic connection status / retry banner if the LAN server is unreachable.
3. **WebView2 Host & Native Silent Printing:**
   - Initialize `CoreWebView2Environment` with user data folder in `%LocalAppData%\ClinicSystem\WebView2` and browser argument `--autoplay-policy=no-user-gesture-required` (so the TV screen audio chime/numbers play without requiring a manual click).
   - Inspect the installed `Microsoft.Web.WebView2` SDK version and use `CoreWebView2.PrintAsync(CoreWebView2PrintSettings)` to implement silent printing to `PrescriptionPrinterName` (A5/A4) and `ReceiptPrinterName` (80mm Thermal) without showing the browser dialog.
   - Listen both to `WebMessageReceived` (for local clicks) AND subscribe to the SignalR `QueueHub` `"PrintJobCreated"` event so print jobs triggered from the Doctor's iPad/Tablet on the LAN print automatically on the desktop workstation!
4. **Dual-Monitor Waiting Room TV Auto-Launcher:**
   - Detect connected displays. When a secondary monitor (HDMI TV) is detected (or triggered from the top bar), open a borderless, full-screen secondary WPF `Window` positioned on the secondary screen's bounds, hosting a dedicated `WebView2` instance navigated to `{ServerUrl}/tv-queue?deviceToken={TvDeviceToken}`.
5. **Packaging & Verification Script:**
   - Create a build script (`build-release.ps1` / `build-release.sh`) that builds the React frontend (`npm run build`), copies `dist/` to `Clinic.Api/wwwroot`, and publishes the backend and desktop projects.

### Final Definition of Done:
- `dotnet build` and `dotnet test` succeed across the entire solution with 0 errors.
- `npm run build` succeeds with 0 errors.
- Run an end-to-end verification test covering the golden path: Open Shift -> Register Patient -> Book Appointment -> Call Next Patient -> Save Vitals & Draft -> Complete Consultation with Rx -> Verify Shift Ledger & Online Backup.
- Finalize `docs/STATE.md` and `docs/DECISIONS.md`.
```