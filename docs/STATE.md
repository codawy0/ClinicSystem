# Clinic Management System — Project State

## System Overview
- **Repository**: Clinic Management System (نظام إدارة العيادة الطبية)
- **Architecture**: Monorepo (`/backend`, `/frontend`, `/desktop`, `/docs`)
- **Current Milestone**: Project Complete (All 7 Phases Verified & Packaged)
- **Phase 1 Status**: Completed & 100% Verified
- **Phase 2 Status**: Completed & 100% Verified
- **Phase 3A Status**: Completed & 100% Verified (138/138 tests passing)
- **Phase 3B Status**: Completed & 100% Verified (174/174 tests passing, frontend built)
- **Phase 3C Status**: Completed & 100% Verified (219/219 tests passing, frontend built)
- **Phase 4 Status**: Completed & 100% Verified (257/257 tests passing, frontend built)
- **Phase 5 Status**: Completed & 100% Verified (258/258 tests passing, release packaged)
- **Last Updated**: 2026-11-17 (Phase 5 Desktop Shell, Release Packaging & E2E Golden Path Verification)

## Implemented Entities (Phase 1 & Phase 2)
| # | Entity | Table Name | Status | Key Characteristics |
|---|--------|------------|--------|---------------------|
| 1 | `User` | `Users` | Implemented | Identity, role enum as string, password hash (PBKDF2), unique username, MustChangePassword |
| 2 | `ClinicSetting` | `ClinicSettings` | Implemented | Single row settings, TvDeviceToken, rollover hour, margins, break state |
| 3 | `ServiceCatalog` | `ServiceCatalogs` | Implemented | Code, category, DefaultPricePiastres (long) |
| 4 | `Patient` | `Patients` | Implemented | SearchName, NormalizedPhone (non-unique), Version concurrency token |
| 5 | `PatientAllergy` | `PatientAllergies` | Implemented | ActiveIngredient (lowercased), severity, composite index |
| 6 | `PatientChronicCondition` | `PatientChronicConditions` | Implemented | Condition code and name, index on PatientId |
| 7 | `Appointment` | `Appointments` | Implemented | Filtered unique queue index, Version token, IdempotencyKey |
| 8 | `AppointmentStatusHistory` | `AppointmentStatusHistories` | Implemented | Audit trail of status transitions |
| 9 | `MedicalVisit` | `MedicalVisits` | Implemented | Draft status, vitals, diagnosis, Version concurrency token |
| 10 | `VisitAddendum` | `VisitAddenda` | Implemented | Immutable append-only notes for completed visits |
| 11 | `Drug` | `Drugs` | Implemented | Active ingredient (lowercased), SearchTradeName, safety flags |
| 12 | `PrescriptionItem` | `PrescriptionItems` | Implemented | Frozen drug snapshots, dosage, timing, duration, override reason |
| 13 | `ClinicalRequestItem` | `ClinicalRequestItems` | Implemented | Lab & Radiology request lines |
| 14 | `PatientAttachment` | `PatientAttachments` | Implemented | Storage file GUID, mime type, size, soft delete flag, restrict delete |
| 15 | `Shift` | `Shifts` | Implemented | Filtered unique active shift per user, cash drawer math, Version token |
| 16 | `Invoice` | `Invoices` | Implemented | Money strictly as long Piastres, discount reasons, Version token |
| 17 | `InvoiceLine` | `InvoiceLines` | Implemented | Service reference, unit and total price in Piastres |
| 18 | `FinancialTransaction` | `FinancialTransactions` | Implemented | Immutable ledger, IdempotencyKey, payment methods, Piastres math |
| 19 | `PrintJob` | `PrintJobs` | Implemented | Target role, document type, payload JSON |
| 20 | `AuditLog` | `AuditLogs` | Implemented | Change tracking log with DiffJson and 64-bit Id |
| 21 | `PrescriptionTemplate` | `PrescriptionTemplates` | Implemented | Doctor reusable Rx templates |

## Implemented API Endpoints (Phase 2)

### Auth (`/api/auth`)
- `POST /api/auth/login`: Authenticates username & password hash (PBKDF2), returns JWT token, user info, and clinic settings.
- `POST /api/auth/change-password`: `[Authorize]`, verifies current password, updates PBKDF2 hash, and clears `MustChangePassword`.
- `GET /api/auth/dev-accounts`: Returns quick-login developer accounts for all 5 roles.

### Shifts (`/api/shifts`)
- `GET /api/shifts/current`: Returns active shift for calling user with exact physical drawer math ($Opening + CashIn - CashOut$) and separate non-cash totals (Instapay, VodafoneCash, Card).
- `POST /api/shifts/open`: Opens shift with opening cash balance, tied to Egypt 5AM `BusinessDate`. Rejects duplicate active shift (`ACTIVE_SHIFT_EXISTS`).
- `POST /api/shifts/expense`: Records petty cash expense transaction (`Type = Expense`, `PaymentMethod = Cash`), reducing expected cash.
- `POST /api/shifts/close`: Reconciles actual cash vs expected cash ($Difference = Actual - Expected$), computes shortage/surplus/balanced, verifies `Version` concurrency token.

### Patients (`/api/patients`)
- `GET /api/patients/search?q=...`: High-speed normalized Arabic search (text, phone, file number, national ID). Discovers and groups shared-phone family members.
- `GET /api/patients/{id}`: Detailed patient profile with allergies, chronic conditions, and recent appointments.
- `POST /api/patients`: Registers new patient, auto-assigns next sequential `FileNumber` (`F-1001`...), normalizes search fields.
- `PUT /api/patients/{id}`: Updates patient profile protected by optimistic concurrency `Version` token (returns 409 Conflict on collision).
- `GET /api/patients/{id}/consultation-eligibility`: Calculates follow-up consultation validity against `ClinicSetting.ConsultationValidityDays` (14 days) and `MaxConsultationsPerExam`.

### Appointments (`/api/appointments`)
- `GET /api/appointments/today`: Retrieves today's clinic appointments filtered by doctor and status.
- `POST /api/appointments`: **Receptionist 1-Click Booking**:
  - Enforces **Shift Guard** (`SHIFT_REQUIRED` if caller has no active shift).
  - Handles `Idempotency-Key` replay.
  - Acquires `BookingWriteLock` serialization lane.
  - Assigns sequential `QueueNumber` (`MAX + 1` for doctor today).
  - Creates `Appointment`, `Invoice`, `InvoiceLines`, and `FinancialTransaction` atomically.
  - Returns `ThermalReceiptDto` ready for thermal printing.
  - Broadcasts `QueueUpdated` SignalR notification.
- `PUT /api/appointments/{id}/check-in`: Marks patient arrived, assigns queue number if null, transitions to `Waiting`.
- `POST /api/appointments/{id}/urgent`: Toggles urgent priority flag and pushes `QueueUpdated` update.
- `PUT /api/appointments/{id}/start-nursing`: Transitions appointment status to `InNursing`, appends status history, and broadcasts `QueueUpdated`.
- `PUT /api/appointments/{id}/complete-nursing`: Transitions appointment status to `Waiting`, appends status history, and broadcasts `QueueUpdated`.

### Medical Visits (`/api/visits`) — Phase 3A
- `GET /api/visits/patient/{patientId}`: Paginated chronological visit history with vitals and addenda count (`page`, `pageSize`).
- `GET /api/visits/{id}`: Detailed visit view with patient demographics, physiological alerts, addenda, and draft/completed status.
- `POST /api/visits/init-or-get`: Idempotently retrieves or creates draft visit for appointment; transitions appointment to `InNursing` and broadcasts queue update.
- `PUT /api/visits/{id}/vitals`: Updates vitals, calculates BMI, checks physiological alert thresholds, updates patient pregnancy/lactation, supports `MarkNursePrepComplete` transition to `Waiting`, enforces `Version` token optimistic concurrency (returns 409 Conflict), enforces completed visit immutability (`VISIT_ALREADY_COMPLETED`), and broadcasts `VitalsUpdated` and `QueueUpdated`.
- `PUT /api/visits/{id}/draft`: Autosaves clinical notes (chief complaint, exam, diagnosis, ICD-10, private notes), protected by `Version` concurrency token and immutability guard.
- `POST /api/visits/{id}/addenda`: Appends immutable addendum note to visit (allowed on completed visits), strictly preserving parent visit immutability.
- `POST /api/visits/{id}/complete`: **Consultation Completion (Phase 3B)**:
  - Serialized under `BookingWriteLock.ExecuteAsync`.
  - Idempotent: returns existing completed data on replay without error.
  - Concurrency check: optimistic version token match (`visit.Version == request.Version`), returning 409 Conflict if mismatched.
  - Snapshots frozen drug properties into `PrescriptionItem` (`DrugNameSnapshot`, `ActiveIngredientSnapshot`, `StrengthSnapshot`, `FormSnapshot`, dosage, timing, duration, notes, override reason).
  - Creates `ClinicalRequestItem` rows (Lab & Radiology).
  - Transitions `Appointment.Status` to `Completed`, logs `AppointmentStatusHistory`.
  - Broadcasts `QueueUpdated` via `QueueHub`.

### Drugs & Clinical Safety Engine (`/api/drugs`) — Phase 3B
- `GET /api/drugs/search?q=...`: High-speed normalized Arabic/English search across `SearchTradeName`, `TradeName`, `ActiveIngredient`, `Category`.
- `GET /api/drugs/{id}`: Detailed drug catalog record.
- `POST /api/drugs`: Adds custom drug to catalog with automatic text and active ingredient normalization.
- `POST /api/drugs/safety-check`: Multi-factor safety analysis evaluating allergy conflicts (active ingredient equality and substring match), pregnancy contraindications (`AvoidInPregnancy` or FDA Categories D/X vs C), lactation warnings (`AvoidInLactation`), duplicate active ingredients across multi-drug selection, and discontinued drugs. Returns structured Arabic warnings and `RequiresOverride` flags.

### Prescription Templates (`/api/prescription-templates`) — Phase 3B
- `GET /api/prescription-templates`: Doctor-scoped template list (`DoctorUserId == callerId`).
- `GET /api/prescription-templates/{id}`: Template detail with doctor privacy isolation (returns 404 if accessed by another doctor).
- `POST /api/prescription-templates`: Creates reusable template with JSON serialization of prescription items and lab orders.
- `POST /api/prescription-templates/from-visit/{visitId}`: 1-click snapshot creation capturing visit prescriptions and clinical requests into a reusable template.
- `DELETE /api/prescription-templates/{id}`: Doctor-isolated deletion with 404 privacy guard.

### Patient Clinical Profile (`/api/clinical-profile`) — Phase 3A
- `GET /api/clinical-profile/{patientId}`: Retrieves patient clinical summary with active allergies and chronic conditions.
- `POST /api/clinical-profile/{patientId}/allergies`: Adds drug allergy with automatically normalized lowercased active ingredient.
- `DELETE /api/clinical-profile/{patientId}/allergies/{allergyId}`: Removes allergy record (verifies patient ownership).
- `POST /api/clinical-profile/{patientId}/chronic-conditions`: Adds chronic condition with code and Arabic name.
- `DELETE /api/clinical-profile/{patientId}/chronic-conditions/{conditionId}`: Removes chronic condition record (verifies patient ownership).

### Live Queue & TV Waiting Room (`/api/queue`)
- `POST /api/queue/call-next`: Doctor calls next patient ordered strictly by `IsUrgent DESC, QueueNumber ASC`. Auto-completes previous in-consultation patient, increments monotonic `CallSequence`, formats patient name per `TvPrivacyMode`, and broadcasts `PatientCalled` & `QueueUpdated`.
- `POST /api/queue/{id}/recall`: Increments monotonic `CallSequence` and re-broadcasts `PatientCalled` for audio engine replay.
- `POST /api/queue/{id}/skip`: Transitions appointment status to `Skipped`.
- `POST /api/queue/{id}/return-from-skip`: Returns patient from `Skipped` to `Waiting` while strictly preserving original `QueueNumber`.
- `POST /api/queue/doctor-break`: Toggles `ClinicSetting.IsDoctorOnBreak` and broadcasts `DoctorBreakToggled`.
- `GET /api/queue/tv-state`: Unauthenticated endpoint for waiting room screen delivering currently called patient, top 5 upcoming waiting patients, and break status.
- `GET /api/queue/board`: 6-column receptionist live board snapshot (`Booked`, `Waiting`, `InNursing`, `WithDoctor`, `Skipped`, `Completed`).

### Authenticated Attachments (`/api/attachments`) — Phase 3C
- `POST /api/attachments/upload`: Multipart upload with `FileSecurityValidator` magic byte inspection (JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, WebP `RIFF..WEBP`, PDF `25 50 44 46`), 10MB limit enforcement (`10,485,760` bytes), sanitized filename, random GUID disk storage under `{ClinicStorage:DataRoot}/attachments/`, strictly outside `wwwroot`. Persists `PatientAttachment` entity.
- `GET /api/attachments/{id}/file`: `[Authorize]` endpoint streaming physical file with `PhysicalFile(filePath, mimeType, enableRangeProcessing: true)` and inline `Content-Disposition`. Returns 401 Unauthorized for unauthenticated calls and 404 for missing or soft-deleted records.
- `GET /api/attachments/{id}`: Retrieves attachment metadata (file name, type, size, upload date).
- `GET /api/attachments/patient/{patientId}`: Lists active non-deleted attachments for patient.
- `GET /api/attachments/visit/{visitId}`: Lists active non-deleted attachments linked to medical visit.
- `DELETE /api/attachments/{id}`: Soft delete setting `IsDeleted = true`, preserving physical file for medicolegal retention, and creating an `AuditLog` entry.

### Print Jobs Subsystem (`/api/print-jobs`) — Phase 3C
- `POST /api/print-jobs`: Enqueues print job (`Prescription`, `Receipt`, `LabSlip`, `SickLeave`), persists status as `Pending`, and broadcasts `PrintJobCreatedDto` via `IHubContext<QueueHub>` to `ClinicGroup`.
- `GET /api/print-jobs/pending`: Retrieves pending unprinted jobs in FIFO order for local printer agents, with optional `targetRole` filter.
- `GET /api/print-jobs/{id}`: Retrieves print job details.
- `POST /api/print-jobs/{id}/complete`: Updates print job status to `Printed` (or `Completed`/`Failed`), supporting idempotent replay.

### Invoices & Treasury Subsystem (`/api/invoices`) — Phase 4
- `GET /api/invoices`: Paginated invoice queries with filters (`patientId`, `status`, `startDate`, `endDate`, normalized Arabic search).
- `GET /api/invoices/{id}`: Full invoice details including line items and associated financial transactions.
- `POST /api/invoices/{id}/payments`: Records partial payments or installments under `BookingWriteLock`, validates `amount > 0 && amount <= remainingPiastres`, decrements `RemainingPiastres`, updates `PaidPiastres`, transitions status to `Partial` or `Paid`, updates active shift physical drawer if cash, creates immutable `FinancialTransaction`, and returns `PaymentResponseDto`.
- `POST /api/invoices/{id}/refund`: Strictly enforces financial invariant `TotalRefundedPiastres <= TotalPaidPiastres`, requires non-empty `reason`, decrements active shift cash drawer if cash refund, updates `Invoice.RefundedPiastres`, records immutable `FinancialTransaction` (`Type = Refund`), creates `AuditLog` row, and returns `RefundResponseDto`.
- `POST /api/invoices/{id}/void`: `[Authorize(Roles = "Doctor,Admin")]` endpoint requiring mandatory void reason, transitions status to `Voided`, deducts net collected cash (`CashPayments - CashRefunds`) from active shift cash drawer to prevent double-deduction, creates reversing transaction (`TransactionType.VoidReversal`), records `AuditLog` row, and returns `VoidInvoiceResponseDto`.
- `GET /api/invoices/transactions` (and `/api/treasury/transactions`): Treasury ledger report computing gross revenue, net cash in drawer, breakdown by payment method, refunds, expenses, and void reversals.

### Doctor Analytics Subsystem (`/api/analytics`) — Phase 4
- `GET /api/analytics/kpi`:
  - `[Authorize(Roles = "Doctor,Admin")]`.
  - Doctor scoping guard: Doctor caller can only inspect own stats; querying another doctor's ID returns HTTP 403 Forbidden (`FORBIDDEN_DOCTOR_ACCESS`). Admin caller can query clinic-wide or filter by doctor.
  - Computes exact 64-bit integer Piastres metrics: gross invoiced revenue, foregone discounts, net billed revenue, collected breakdown by method (Cash, Instapay, Vodafone Cash, Card), digital totals, refunds, petty cash expenses, net cash flow, and net accrual profit.
  - Operational metrics: appointment count, unique patients, completed visits, cancelled count, average consultation duration in minutes, and average patient wait time in minutes.
  - Breakdowns: Discount reasons distribution and daily KPI trends for charts.

### CSV Data Import Subsystem (`/api/import`) — Phase 4
- `POST /api/import/patients`: Accepts CSV multipart upload with bilingual column mapping, Egyptian phone validation and normalization to 11 digits (`ArabicNormalizer.NormalizePhone`), Arabic text normalization, in-file and database duplicate detection, dual-mode support (`dryRun=true` preview vs `dryRun=false` batch insertion with sequential `F-1001` file numbers).
- `POST /api/import/drugs`: Formulary CSV parsing, DrugForm enum recognition, upsert logic by TradeName, pregnancy and lactation risk flags.

### SQLite Online Hot Backup & Maintenance (`/api/backup`) — Phase 4
- `POST /api/backup/create`: `[Authorize(Roles = "Admin")]` endpoint performing non-blocking online hot backup using SQLite Online Backup API (`SqliteConnection.BackupDatabase`), executes `PRAGMA integrity_check;`, packages snapshot into timestamped `.zip` containing `clinic.db` and manifest JSON, calculates SHA-256 checksum, stores in `{DataRoot}/backups/`.
- `GET /api/backup/list`: `[Authorize(Roles = "Admin")]` endpoint enumerating existing backup archives with file size, creation timestamp, and SHA-256 hash.
- `GET /api/backup/download/{filename}`: `[Authorize(Roles = "Admin")]` endpoint delivering authenticated ZIP streaming with directory traversal protection (`[a-zA-Z0-9_\-\.]+\.zip`).
- `POST /api/backup/restore`: `[Authorize(Roles = "Admin")]` endpoint with staged extraction, pre-restore emergency snapshot of active database, integrity check, and safe page restoration.
- `SqliteMaintenanceService`: Background hosted service running periodic `PRAGMA wal_checkpoint(PASSIVE);` without blocking active readers or writers. Registered in `Program.cs`.

### Desktop Host & System Health (`/api/system`) — Phase 5
- `GET /api/system/health`: Delivers server status, version (`2.0.0`), serverTimeUtc, and Egypt local BusinessDate.
- `GET /api/health`: Desktop splash screen health check polling endpoint.
- SPA Static Hosting: Configured in `Clinic.Api/Program.cs` (`UseDefaultFiles`, `UseStaticFiles`, `MapFallbackToFile("index.html")`) serving the production React 18 SPA directly from `wwwroot` with 404 guards for API and SignalR routes.

## Desktop Shell & Release Packaging (Phase 5)
- `/desktop/Clinic.Desktop`: .NET 8 WPF desktop host targeting `net8.0-windows` with embedded `Microsoft.Web.WebView2`.
- `SingleInstanceManager`: Named system `Mutex` preventing duplicate processes and avoiding concurrent SQLite lock contention.
- `JobObjectManager`: Win32 P/Invoke Job Object lifecycle management (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`) ensuring child `Clinic.Api.exe` terminates automatically on desktop exit or crash.
- `SilentPrintManager`: Offscreen WebView2 bridge implementing silent printing via `CoreWebView2.PrintAsync` routing 80mm receipts and laser prescriptions without dialogs.
- `DualMonitorManager`: Hardware screen topology detection automatically opening borderless fullscreen `TvWindow.xaml` on secondary displays navigated to `/tv-queue`.
- `build-release.ps1`: Automated release packaging script compiling the frontend, deploying to `wwwroot`, and publishing the standalone distribution in `publish/ClinicSystem/` and `publish/ClinicSystem-Release-v1.0.0.zip` (21.10 MB).

## Frontend Pages & Routing
- `/treasury` (`TreasuryPage.tsx`): Physical cash drawer balance card, daily invoice/transaction ledger with date presets and payment method filters, partial payment modal, refund modal with invariant enforcement, void invoice modal, quick receipt printing.
- `/analytics` (`AnalyticsPage.tsx`): Executive KPI summary cards (Gross, Net, Discounts, Expenses, Profit), 100% Zero-CDN inline SVG charts (`RevenueTrendChart.tsx`, `PaymentMethodDonutChart.tsx`), patient volume, and wait time metrics.
- `/settings` (`SettingsPage.tsx`): 4-tab container hosting Service Catalog management, Clinic Profile configuration, 1-click Backup & Maintenance Center, and CSV Data Import Wizard.
- `AppNavbar.tsx`: Unified workspace switcher for Reception, Doctor, Nursing, Treasury, Analytics, Settings, and TV Queue.

## Core Infrastructure & Services
- `FileSecurityValidator`: Inspects stream header magic bytes directly with stream seek position preservation; rejects spoofed extensions (PE MZ, PHP, HTML scripts) and enforces 10MB bounds.
- `AttachmentStorageService` / `IAttachmentStorageService`: Safely resolves physical storage paths outside `wwwroot` in `DataRoot/attachments`, generates GUID filenames, and enforces anti-path-traversal protection.
- `JwtAuthenticationHandler`: Zero-external-dependency authentication handler based on cached `System.IdentityModel.Tokens.Jwt` 6.35.0 supporting both `Authorization: Bearer <token>` and WebSocket query string `?access_token=...`.
- `JwtTokenService` / `IJwtTokenService`: Signs HMAC-SHA256 JWT tokens containing `UserId`, `Username`, `Role`, `FullName`, and `MustChangePassword`.
- `ShiftService` / `IShiftService`: Shift lifecycle, exact physical cash drawer math, petty expense recording, and reconciliation.
- `PrivacyFormatter`: Formats patient names for the waiting room TV per `TvPrivacyMode` (`FirstNameAndInitial`, `QueueNumberOnly`, `FullName`).
- `ArabicNormalizer`: Text & phone normalization (Alef, Yaa, Taa-marbuta, Tashkeel, Indic digits, Egyptian phone numbers).
- `BusinessDateService`: Egypt Standard Time (Africa/Cairo) with 5:00 AM local rollover hour and resilient cross-platform fallback.
- `SqlitePragmaInterceptor`: Per-connection `busy_timeout = 5000; synchronous = FULL; foreign_keys = ON;`.
- `BookingWriteLock`: In-memory singleton `SemaphoreSlim(1, 1)` serialization lane.
- `Pbkdf2PasswordHasher`: PBKDF2 HMAC-SHA256 secure password hashing with constant-time verification.
- `QueueHub`: SignalR hub mapped on `/hubs/queue` implementing typed `IQueueClient` contract.

## Test Suite Status
| Suite | Target | Status | Result |
|-------|--------|--------|--------|
| `ArabicNormalizerTests` | Hamza, Tashkeel, Digits, Egyptian Phones | Executed | 39 / 39 Passed |
| `BusinessDateTests` | 01:30 AM rollover, 05:01 AM rollover, TZ fallback | Executed | 7 / 7 Passed |
| `CurrencyTests` | Piastres exact integer math and formatting | Executed | 6 / 6 Passed |
| `DbContextTests` | Auto-population, Version increment, Concurrency 409, Shift index, Seeder | Executed | 5 / 5 Passed |
| `QueueConcurrencyTests` | 30 parallel tasks booking queue numbers & 30 parallel tasks under same cashier shift | Executed | 2 / 2 (60 tasks) Passed |
| `ShiftCashDrawerMathTests` | Formula, Non-Cash isolation, Surplus/Shortage reconciliation, 64-bit overflow | Executed | 7 / 7 Passed |
| `AuthServiceTests` | PBKDF2 hashing, JWT generation, claims parsing, signature tampering rejection | Executed | 3 / 3 Passed |
| `ShiftManagementTests` | Open shift, filtered unique index, petty expenses, drawer math, version concurrency | Executed | 6 / 6 Passed |
| `AppointmentBookingTests` | Shift Guard (`SHIFT_REQUIRED`), 1-click booking, idempotency key replay, discount clamp | Executed | 4 / 4 Passed |
| `QueueStateMachineTests` | Urgent priority, monotonic CallSequence, skip & return-from-skip, recall, break toggle, CallNext idempotency replay | Executed | 5 / 5 Passed |
| `PatientSearchAndEligibilityTests` | Arabic text variants, Egyptian phones, shared-phone families, 4 eligibility cases | Executed | 13 / 13 Passed |
| `MedicalVisitsTests` | Init/Get, vitals saving, 11-point alert thresholds, zero height BMI, 409 concurrency, completed immutability, addenda, paginated history, nursing transitions | Executed | 21 / 21 Passed |
| `PatientClinicalProfileTests` | 4-point allergy normalization theory, add/delete allergy, cross-patient guard, add/delete conditions, profile retrieval | Executed | 10 / 10 Passed |
| `DrugSafetyTests` | Allergy conflicts, pregnancy contraindications, lactation warnings, duplicate ingredients, discontinued, search | Executed | 16 / 16 Passed |
| `PrescriptionTemplatesTests` | Doctor privacy isolation, CRUD, validation, 1-click snapshot from visit, cross-doctor delete guard | Executed | 10 / 10 Passed |
| `ConsultationCompletionTests` | Status transition, snapshot freezing, DB mutation immutability, idempotency replay, 409 concurrency, override persistence, post-completion guards | Executed | 8 / 8 Passed |
| `VisitCompletionConcurrencyTests` | 10 simultaneous parallel completions under BookingWriteLock, concurrent bookings and completions | Executed | 2 / 2 Passed |
| `AttachmentSecurityTests` | Magic bytes (JPEG, PNG, WebP, PDF), spoofed PE/PHP/HTML rejection, 10MB bounds, storage isolation outside wwwroot, authenticated streaming, visit linking, soft delete audit | Executed | 28 / 28 Passed |
| `PrintJobTests` | Enqueue job, SignalR broadcast, pending FIFO queue, complete/fail status, idempotency, role filtering, authorization | Executed | 17 / 17 Passed |
| `TreasuryLedgerTests` | Partial payments, refund invariants, void reversibility, cash drawer integration, 64-bit Piastres integer precision | Executed | 18 / 18 Passed |
| `DoctorAnalyticsTests` | KPI calculations, discount deduction accuracy, role authorization guards, duration and wait times | Executed | 8 / 8 Passed |
| `CsvImportTests` | Egyptian phone validation, Arabic name normalization, duplicate detection, dryRun preview vs commit | Executed | 7 / 7 Passed |
| `SqliteOnlineBackupTests` | Online hot backup during concurrent reads/writes without SQLITE_BUSY, integrity check, traversal rejection, restore snapshot | Executed | 5 / 5 Passed |
| `GoldenPathE2ETests` | 10-stage end-to-end clinical simulation over real HTTP sockets (auth, shift, patient, booking, vitals, consultation, rx, payment, shift close, backup) | Executed | 1 / 1 Passed |
| **Total Test Execution** | `dotnet test backend/Clinic.Tests` | **Passed** | **258 / 258 (100%)** |
