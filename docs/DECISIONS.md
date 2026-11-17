# Architectural Decisions Log (ADR)

## DEC-001: Monetary Storage as 64-bit Integer Piastres (`long`)
- **Context**: Medical systems handle financial transactions (exams, consultations, procedures, discounts, refunds, shift reconciliations). SQLite does not possess an arbitrary-precision decimal type. Storing `decimal` or `double` in SQLite results in either text strings or IEEE-754 floating-point rounding errors on aggregate calculations (`SUM()`, `AVG()`).
- **Decision**: All financial amounts in C# models and SQLite tables are stored strictly as 64-bit signed integers (`long`) representing Piastres ($1\text{ EGP} = 100\text{ Piastres}$). Property names follow the convention `*Piastres` (e.g., `DefaultExamPricePiastres`, `DefaultPricePiastres`, `PaidPiastres`, `AmountPiastres`, `TotalPiastres`, `OpeningBalancePiastres`). Conversion to EGP display strings is deferred entirely to UI/DTO formatting.
- **Consequences**: Exact integer math, exact SQL `SUM()`, zero rounding discrepancies, guaranteed database cross-compatibility.

## DEC-002: SQLite Concurrency Hardening (WAL Mode, Interceptors & BookingWriteLock)
- **Context**: In a multi-user LAN clinic environment (doctor, nurse, receptionist, TV display), concurrent access to SQLite can produce `SQLITE_BUSY` (database locked) errors, particularly on simultaneous writes or sequential queue counter generation.
- **Decision**:
  1. WAL mode (`PRAGMA journal_mode = WAL;`) enabled on startup to allow concurrent readers alongside a writer.
  2. A custom `SqlitePragmaInterceptor` (`DbConnectionInterceptor`) executes on every connection open: `PRAGMA busy_timeout = 5000; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;`.
  3. A singleton in-memory serialization lane `BookingWriteLock` (`SemaphoreSlim(1, 1)`) serializes queue number assignment (`MAX(QueueNumber) + 1`) and shift cash closing, preventing race conditions before hitting the database.
- **Consequences**: Eliminates `SQLITE_BUSY` exceptions, enforces foreign key referential integrity at the engine level, and guarantees sequential, gapless queue numbers.

## DEC-003: Egyptian Medical BusinessDate Rollover (05:00 AM Local Time)
- **Context**: Egyptian medical practices frequently conduct evening consultations that extend past midnight (e.g., until 2:00 AM or 3:00 AM). Relying on UTC midnight or calendar midnight splits a single clinic session across two distinct calendar days, resetting patient queue counters mid-session.
- **Decision**: Stored timestamps remain UTC. A specialized `BusinessDateService` converts UTC to local Egypt time (`Africa/Cairo` / `Egypt Standard Time`) with a configurable rollover threshold at 5:00 AM local time. Consultations between midnight and 05:00 AM belong to the preceding calendar day's `BusinessDate`.
- **Consequences**: Unbroken clinic sessions, consistent daily queue numbering, and unified daily shift reporting.

## DEC-004: Arabic Search Normalization and Shared Family Phones
- **Context**: Arabic text variations (hamzas, taa-marbuta, alef-maksura, diacritics) make raw SQL `LIKE` or `.ToLower()` matching ineffective and slow in SQLite. Furthermore, in Egypt, parents frequently share a single mobile number for multiple family members (mother, infant, child).
- **Decision**:
  1. `ArabicNormalizer` standardizes alef variants to bare alef, yaa/alef-maksura to yaa, taa-marbuta to haa, strips tashkeel/tatweel, and maps Arabic-Indic digits to ASCII digits.
  2. Egyptian phones are normalized to 11-digit `01...` format.
  3. Precomputed `SearchName` and `NormalizedPhone` are persisted upon patient save and indexed non-uniquely.
- **Consequences**: Fast indexed prefix search (`StartsWith`) in SQLite, complete support for family multi-patient lookup sharing one telephone number.

## DEC-005: Package Management & Offline Sandboxed Execution
- **Context**: The build and runtime environment operates in a sandboxed, zero-external-CDN offline LAN setting where `api.nuget.org` is not resolvable at build time. Furthermore, loopback socket connections between test runner processes in the sandbox require loopback permission.
- **Decision**:
  1. Target locally cached NuGet packages: `Microsoft.EntityFrameworkCore.Sqlite` 8.0.11, `xunit` 2.9.3, `FluentAssertions` 6.12.1, `Microsoft.NET.Test.Sdk` 17.12.0, `xunit.runner.visualstudio` 2.8.2, `coverlet.collector` 6.0.2.
  2. Set `<NuGetAudit>false</NuGetAudit>` in `.csproj` files to eliminate the 25-second online vulnerability check timeout.
  3. Implement timezone fallback logic in `BusinessDateService` without requiring third-party libraries.
  4. SignalR is consumed directly from the ASP.NET Core 8 shared framework without separate package references.
  5. Password hashing uses PBKDF2 HMAC-SHA256 via built-in `System.Security.Cryptography.Rfc2898DeriveBytes`.
  6. Test execution utilizes `BypassSandbox: true` to permit VSTest loopback IPC.
- **Consequences**: Ultra-fast restores and builds (~200ms), 100% offline self-containment, reliable test suite execution.

## DEC-006: Custom Zero-External-Dependency JwtAuthenticationHandler
- **Context**: The build and runtime environment operates in an offline sandbox where `api.nuget.org` is not resolvable. While `Microsoft.AspNetCore.Authentication.JwtBearer` is absent from the local NuGet cache, `System.IdentityModel.Tokens.Jwt` (6.35.0) and `Microsoft.IdentityModel.Tokens` (6.35.0) are present in `%USERPROFILE%\.nuget\packages`, and ASP.NET Core's built-in `AuthenticationHandler<AuthenticationSchemeOptions>` is part of the shared framework.
- **Decision**: Implemented a custom `JwtAuthenticationHandler` that extracts tokens from either the `Authorization: Bearer <token>` header or the query parameter `?access_token=<token>` (critical for browser SignalR WebSocket connections which cannot send custom headers). Tokens are signed with HMAC-SHA256 and contain `UserId`, `Username`, `Role`, `FullName`, and `MustChangePassword`.
- **Consequences**: Zero external package downloads required, full offline determinism, and seamless SignalR WebSocket authentication.

## DEC-007: Shift Physical Cash Drawer Isolation (Physical vs. Digital Payments)
- **Context**: In Egyptian clinics, payments are accepted in physical cash as well as digital wallets (Instapay, VodafoneCash) and credit/debit cards. However, end-of-shift physical drawer cash count reconciles the physical currency bills in the cash box.
- **Decision**: Physical cash drawer math strictly isolates cash payments:
  $$\text{ExpectedClosingCashPiastres} = \text{OpeningBalancePiastres} + \text{CashPayments} - \text{CashRefunds} - \text{CashExpenses}$$
  Non-cash transactions (Instapay, VodafoneCash, Card) are tracked and audited separately in the shift summary (`TotalInstapayPiastres`, `TotalVodafoneCashPiastres`, `TotalCardPiastres`), but are NEVER added to `ExpectedClosingCashPiastres`.
- **Consequences**: Eliminates artificial physical drawer shortages during end-of-shift cash counting while maintaining comprehensive daily gross revenue accounting.

## DEC-008: Receptionist Shift Guard & Atomic 1-Click Booking
- **Context**: Under high patient throughput, receptionists must not collect payments without an open shift, and double-clicking the booking button must not produce duplicate appointments or out-of-order queue numbers.
- **Decision**:
  1. The booking endpoint checks that the receptionist holds an active open shift (`!IsClosed`). If absent, returns HTTP `400 Bad Request` with `ProblemDetails` error code `SHIFT_REQUIRED`.
  2. Sequential `QueueNumber` generation (`MAX(QueueNumber) + 1`), `Appointment` creation, `Invoice` and `InvoiceLine` generation, and `FinancialTransaction` recording are executed atomically inside `BookingWriteLock.ExecuteAsync(...)`.
  3. Supports `Idempotency-Key` header and payload field to deduplicate rapid double clicks.
  4. Real-time `QueueUpdated` notification is broadcast via `IHubContext<QueueHub>` to all clinic staff screens.
- **Consequences**: Guaranteed financial traceability, elimination of unrecorded cash, gapless sequential queue numbering, and immediate UI reactivity.

## DEC-009: Urgent Patient Prioritization & Monotonic CallSequence for TV Audio
- **Context**: Critical emergency patients must jump ahead of routine waiting patients. Furthermore, the waiting room TV audio announcement engine needs an unambiguous deduplication mechanism so sound clips do not re-trigger or overlap on network reconnection.
- **Decision**:
  1. Doctor `call-next` orders waiting patients strictly by `IsUrgent DESC, QueueNumber ASC`.
  2. Each call increments a monotonic `CallSequence` counter persisted on `Appointment.CallSequence` and broadcast in `PatientCalledDto`.
  3. The TV screen ignores any `PatientCalled` payload whose `CallSequence <= lastPlayedSequence`.
  4. Display names on public screens are formatted via `PrivacyFormatter` respecting `ClinicSetting.TvPrivacyMode` (`FirstNameAndInitial`, `QueueNumberOnly`, `FullName`).
- **Consequences**: Clinical priority safety, deterministic audio announcement playback without repeat jitter, and patient medical privacy protection.

## DEC-010: Concurrency Reloading under Shared Cashier Shifts & CallNext Idempotency
- **Context**: In multi-terminal reception setups or fast successive bookings under the same cashier shift, pre-loading `activeShift` outside `BookingWriteLock` produced stale `Shift.Version` tokens in EF Core change tracker when another thread committed, triggering `DbUpdateConcurrencyException`. In addition, network retries or double-clicking `call-next` without idempotency key handling caused the queue to advance prematurely and complete active patients by mistake.
- **Decision**:
  1. `BookAppointment` verifies the shift guard with `AsNoTracking()` outside the lock, and re-queries/tracks `Shift` from the database directly *inside* `_bookingWriteLock.ExecuteAsync(...)`, ensuring every concurrent booking accesses the freshest `Shift.Version` and updates `ExpectedClosingCashPiastres` safely.
  2. `CallNext` inspects `Idempotency-Key` (from header or payload) and persists `CallIdempotencyKey` on the `Appointment`. On duplicate submission today, it returns the existing `CallNextResponseDto` without modifying queue status or advancing the queue sequence.
- **Consequences**: Zero concurrency crashes under shared shift accounts, robust double-click and network-retry idempotency for the doctor's call console.

## DEC-011: Medical Record Immutability & Append-Only Addenda Architecture
- **Context**: Egyptian medical liability standards and medical record auditing mandate that once a consultation is marked completed (`!IsDraft || CompletedAtUtc != null`), the primary clinical document cannot be altered or overwritten. Subsequent clinical observations, telephone updates, or late lab results must be recorded without tampering with the original record.
- **Decision**:
  1. Both `PUT /api/visits/{id}/vitals` and `PUT /api/visits/{id}/draft` evaluate whether the visit is completed. If `!visit.IsDraft || visit.CompletedAtUtc.HasValue`, they return HTTP `400 Bad Request` with `ProblemDetails` title `VISIT_ALREADY_COMPLETED`.
  2. Post-completion clinical documentation is accepted strictly via `POST /api/visits/{id}/addenda`, which creates an immutable `VisitAddendum` row (`AuthorUserId`, `NoteText`, `CreatedAtUtc`) referencing the visit with `DeleteBehavior.Restrict`.
  3. The parent `MedicalVisit` fields (`BpSystolic`, `Diagnosis`, `ChiefComplaint`, `CompletedAtUtc`) remain completely unchanged and legally protected.
- **Consequences**: Strict medicolegal compliance, auditable historical records, and tamper-proof clinical notes.

## DEC-012: Physiological Vital Alerts Evaluation & BMI Boundary Safety
- **Context**: Nurses and doctors require immediate visual feedback on abnormal vital signs (hypotension/hypertension, bradycardia/tachycardia, hypothermia/fever, hypoglycemia/hyperglycemia, hypoxia). Furthermore, edge cases such as missing height or zero height must never cause division-by-zero crashes.
- **Decision**:
  1. `VitalsEvaluator` centrally computes deterministic vital alert flags (`IsBpHigh`, `IsBpLow`, `IsPulseHigh`, `IsPulseLow`, `IsTempHigh`, `IsTempLow`, `IsGlucoseHigh`, `IsGlucoseLow`, `IsSpo2Low`) and rich Arabic alert messages classified by severity (`Warning`, `Critical`, `Info`).
  2. BP thresholds: High ($\ge 140/90$), Low ($< 90/60$). Pulse: High ($> 100$), Low ($< 60$). Temp: Fever ($\ge 38.0^\circ\text{C}$), Hypothermia ($< 35.5^\circ\text{C}$). Glucose: High ($\ge 200\text{ mg/dL}$), Low ($< 70\text{ mg/dL}$). SpO2: Low ($< 94\%$).
  3. BMI computation guards against null or non-positive height ($Height \le 0$) by returning `null` safely without throwing `DivideByZeroException`.
  4. Real-time updates trigger typed SignalR `VitalsUpdated` notifications to the clinic group.
- **Consequences**: Instant clinical safety feedback across nurse and doctor screens, defensive numerical guards, and zero unhandled server exceptions.

## DEC-013: Frozen Drug Snapshot Immutability & BookingWriteLock Serialization on Consultation Completion
- **Context**: In medical practice, dispensations and prescriptions are legal documents. If a clinic updates its drug formulary (alters a trade name, changes formulation, or marks a drug discontinued), previously dispensed historical prescriptions must remain 100% frozen. Furthermore, rapid double clicks or network retries by clinicians must not spawn duplicate prescription items or trigger `SQLITE_BUSY` concurrency exceptions.
- **Decision**:
  1. `CompleteConsultation` freezes and copies `DrugNameSnapshot`, `ActiveIngredientSnapshot`, `StrengthSnapshot`, and `FormSnapshot` directly onto `PrescriptionItem` rows in SQLite.
  2. The completion workflow executes strictly inside `_bookingWriteLock.ExecuteAsync(...)`.
  3. Placed an idempotency check (`!visit.IsDraft || visit.CompletedAtUtc.HasValue`) at the start of the lock block, returning the existing completed visit safely on duplicate requests without re-writing rows or altering timestamps.
- **Consequences**: Complete medicolegal immutability even if the catalog `Drug` row is subsequently mutated or deleted; gapless, safe parallel execution without database locks or duplicate lines.

## DEC-014: Multi-Factor Clinical Drug Safety Engine & Mandatory Medical Override
- **Context**: Medication errors (prescribing drugs with active ingredients matching patient allergies, prescribing contraindicated Category D/X drugs during pregnancy, or duplicating active ingredients across combined trade names) pose severe patient safety risks.
- **Decision**:
  1. Implemented `POST /api/drugs/safety-check` evaluating allergy conflicts (normalized active ingredient equality and substring matching), maternal-fetal contraindications (`AvoidInPregnancy` and FDA categories D/X vs C), lactation warnings (`AvoidInLactation`), duplicate active ingredients grouped across multi-drug selections, and discontinued status.
  2. Classified warnings by severity (`Severe`, `Moderate`, `Info`) with descriptive Arabic warning text.
  3. In the UI, severe warnings trigger glowing red alert banners and strictly block consultation completion (`F9`, `Ctrl+Enter`) until the doctor checks the legal acknowledgment checkbox and enters a documented clinical override reason.
- **Consequences**: Multi-layered defense against adverse drug events while maintaining clinical flexibility under documented physician accountability.

## DEC-015: Bidirectional `<bdi>` Typography Isolation & 5s Debounced Autosave Ergonomics
- **Context**: In Egyptian clinics, drug names, active ingredients, and strengths are written in English (`Augmentin 1g`, `Concor 5mg`), while dosing instructions and frequency are in Arabic. In an RTL layout, mixing LTR English with numbers, slashes, and brackets reverses punctuation and misplaces dosages. Furthermore, clinicians typing long notes must not lose data upon accidental browser close or encounter false 409 concurrency collisions.
- **Decision**:
  1. Wrapped all English trade names, active ingredients, and dosages inside `<bdi dir="ltr">` across prescription builder tables, print modals, safety banners, and patient banners, ensuring clean typography.
  2. Implemented 5-second debounced autosave via `PUT /api/visits/{id}/draft` in `ClinicalNotesEditor.tsx`, with live version increment synchronization back into React state.
  3. Integrated muscle-memory keyboard shortcuts (`F2` search, `F4` call next, `F9` complete, `Ctrl+Enter` complete & advance, `Ctrl+P` print) with modal dialog suppression.
- **Consequences**: Flawless bi-directional medical typography, zero lost consultation notes, seamless high-speed doctor consultation ergonomics.

## DEC-016: Binary Magic Byte File Security & Physical Storage Isolation Outside wwwroot
- **Context**: Medical attachments (radiology X-rays, lab reports, ultrasound scans, external clinical records) contain sensitive Protected Health Information (PHI). Malicious actors can spoof file extensions (e.g. uploading a Windows PE `.exe` or PHP script disguised as `.jpg`) to achieve Remote Code Execution. Furthermore, serving files directly from `wwwroot` allows unauthenticated access via public URLs, violating medical privacy mandates.
- **Decision**:
  1. `FileSecurityValidator` inspects the stream header bytes directly from the binary stream: JPEG (`FF D8 FF`), PNG (`89 50 4E 47 0D 0A 1A 0A`), WebP (`RIFF....WEBP`), and PDF (`25 50 44 46`). Stream seek position is strictly rewound to 0 after inspection.
  2. Executables (`MZ`), PHP scripts (`<?php`), HTML scripts (`<html>`), and plain text disguised as images are rejected with HTTP `400 Bad Request` (`INVALID_FILE_TYPE`).
  3. File size is bounded to 10MB (`10,485,760` bytes). Exceeding files return `400 Bad Request` (`FILE_TOO_LARGE`).
  4. Physical files are stored at `{ClinicStorage:DataRoot}/attachments/{Guid}.{ext}`, strictly outside `wwwroot` and application binary directories, using randomly generated GUIDs and anti-path-traversal checks.
  5. File streaming is strictly guarded by `[Authorize] GET /api/attachments/{id}/file`, returning HTTP `401 Unauthorized` for unauthenticated requests and serving authenticated clients with inline `Content-Disposition`.
- **Consequences**: Complete immunity against extension spoofing and path traversal, zero unauthenticated PHI leakage, and robust physical storage isolation.

## DEC-017: Multi-Tier Unified Print Routing Architecture & Bidirectional Print Templates
- **Context**: Clinics operate across heterogeneous environments: high-speed native desktop workstations equipped with silent hardware printers (thermal receipt printers, laser prescription printers), mobile tablets or secondary workstations connected over LAN without local USB printers, and standalone browser sessions. A single print button must intelligently route to the optimal printing hardware.
- **Decision**:
  1. Implemented a 3-tier routing architecture in `printService.ts`:
     - **Tier 1 (Desktop WPF Host)**: Detects `window.chrome?.webview` IPC bridge and emits `postMessage({ action: "silentPrint", ... })` for background zero-dialog printing via `CoreWebView2.PrintAsync`.
     - **Tier 2 (LAN Network Print Queue)**: Submits print jobs to `POST /api/print-jobs`, triggering real-time SignalR `PrintJobCreatedDto` broadcasts for dedicated print workstations to spool.
     - **Tier 3 (Browser Fallback)**: Spools rendered HTML inside an isolated, hidden `<iframe>` and triggers `iframe.contentWindow.print()` without distorting host window CSS or modals.
  2. Created standardized printable templates (`PrescriptionPrintTemplate`, `ThermalReceiptTemplate`, `SickLeavePrintTemplate`, `LabSlipPrintTemplate`) with:
     - Letterhead mode toggle suppressing clinic headers and introducing 4.5cm (`45mm`) top margins for pre-printed clinical stationery.
     - 80mm thermal receipt geometry and exact Piastres-to-EGP currency formatting.
     - Strict `<bdi dir="ltr">` bidirectional typography isolation for all Latin drug names, codes, and telephone numbers.
     - 100% offline zero-CDN self-containment with `@fontsource/cairo`.
- **Consequences**: Unified multi-device printing experience, silent desktop printing capabilities, and zero external network dependencies.

## DEC-018: Financial Refund Invariant Enforcement ($TotalRefundedPiastres \le TotalPaidPiastres$) and Net Cash Void Reversal
- **Context**: Medical invoicing allows partial installments, refunds, and voiding. Allowing refunds to exceed the total amount previously paid or allowing an invoice to be refunded after being voided corrupts the financial ledger. Furthermore, if an invoice that was partially refunded is later voided, reversing the entire original payment amount in the cashier shift cash drawer would result in a double-deduction (reversing cash that was already refunded).
- **Decision**:
  1. Added `RefundedPiastres` directly to `Invoice.cs` for $O(1)$ invariant checking: any refund request where `invoice.RefundedPiastres + request.AmountPiastres > invoice.PaidPiastres` is strictly rejected with HTTP `400 Bad Request` (`REFUND_EXCEEDS_PAID_AMOUNT`).
  2. Every refund requires a non-empty mandatory reason (`REFUND_REASON_REQUIRED`) and generates an immutable `FinancialTransaction` (`Type = Refund`) and `AuditLog` row.
  3. When an invoice is voided, only the net collected cash ($\text{NetCash} = \max(0, \text{CashPayments} - \text{CashRefunds})$) is deducted from the active shift cash drawer, preventing double-deduction.
  4. Added `TransactionType.VoidReversal` to `ShiftService.CloseShiftAsync` and `MapToSummary` drawer reconciliation formulas.
  5. Voiding is restricted strictly to `Doctor` and `Admin` roles (`[Authorize(Roles = "Doctor,Admin")]`).
- **Consequences**: Absolute financial integrity, zero mathematical leakage, and accurate end-of-shift physical cash drawer reconciliation.

## DEC-019: Doctor KPI Analytics Role Scoping & 64-Bit Integer Piastres Calculations
- **Context**: Clinic doctors must be able to track their financial and clinical performance (gross revenue, collected cash vs digital, foregone discounts, expenses, wait times), but privacy and competition regulations require that individual doctors cannot inspect other doctors' performance metrics. Furthermore, financial aggregations in SQLite must remain immune to floating-point rounding errors.
- **Decision**:
  1. `AnalyticsController.cs` enforces `[Authorize(Roles = "Doctor,Admin")]`. If a user with the `Doctor` role attempts to query `doctorId` for a different practitioner, the system returns HTTP `403 Forbidden` (`FORBIDDEN_DOCTOR_ACCESS`), or pins `doctorId` to the authenticated caller's ID.
  2. Administrators can query clinic-wide aggregated KPIs or filter by any individual doctor.
  3. All monetary calculations (gross billings, discounts, collected breakdown by method, expenses, net profit) are performed strictly using 64-bit signed integers (`long` Piastres).
  4. Clinical metrics compute average consultation duration ($CompletedAtUtc - StartedAtUtc$) and patient wait times ($CalledAtUtc - ArrivedAtUtc$) in minutes.
- **Consequences**: Strict practitioner privacy isolation, administrative transparency, and exact 64-bit integer financial precision.

## DEC-020: Non-Blocking SQLite Online Hot Backup via `BackupDatabase` API & Integrity Verification
- **Context**: In a busy clinic, database backups must be taken on-demand or on schedule without stopping the application or locking out receptionists, doctors, and nurses. Conventional file copying of an active SQLite database in WAL mode can capture torn pages or fail with Windows file sharing violations (`SQLITE_BUSY`).
- **Decision**:
  1. `BackupController.cs` invokes native `Microsoft.Data.Sqlite.SqliteConnection.BackupDatabase(destinationConnection)`, which utilizes SQLite's online page-level backup engine to copy pages incrementally while concurrent readers and writers continue uninterrupted.
  2. Before archiving, the snapshot runs `PRAGMA integrity_check;`, guaranteeing zero corruption before packaging into a timestamped `.zip` containing `clinic.db` and manifest JSON with SHA-256 hash.
  3. Backup files are stored in `{DataRoot}/backups/` outside `wwwroot`, and `/download/{filename}` enforces strict regex filename validation (`[a-zA-Z0-9_\-\.]+\.zip`) to eliminate directory traversal attacks.
  4. Restore operations execute a staged extraction, verify SQLite snapshot integrity, take an emergency pre-restore snapshot of the active database, and swap pages safely.
  5. A background `SqliteMaintenanceService` executes non-blocking `PRAGMA wal_checkpoint(PASSIVE);` on a periodic timer.
- **Consequences**: Non-blocking online hot backups with zero `SQLITE_BUSY` errors under high concurrent transaction loads, guaranteed snapshot integrity, and resilient disaster recovery.

## DEC-021: Offline Zero-CDN Inline SVG/CSS Data Visualization Architecture
- **Context**: Architectural rule 5 strictly prohibits external CDN links (fonts, icons, scripts, or chart libraries). Third-party React charting libraries (e.g., Recharts, Chart.js) often pull external canvas/SVG dependencies or increase bundle bloat.
- **Decision**:
  1. Implemented data visualization charts (`RevenueTrendChart.tsx`, `PaymentMethodDonutChart.tsx`) as pure inline SVG and Tailwind CSS components.
  2. Charts dynamically render mathematical coordinates (SVG `<polyline>`, `<path>`, `<circle>`, `<polygon>`) with interactive hover tooltips directly in React.
  3. Full RTL support and Cairo typography with `<bdi dir="ltr">` isolation for numbers and dates.
- **Consequences**: 100% offline zero-CDN compliance, zero runtime bundle bloat, zero CDN vulnerabilities, and full RTL layout compatibility.

## DEC-022: Kernel-Level Windows Job Object Child Process Management & Single-Instance Mutex
- **Context**: In desktop deployment mode (`Clinic.Desktop.exe`), the WPF application hosts an embedded WebView2 control while managing the local ASP.NET Core `Clinic.Api.exe` server process. If the user exits the WPF app, or if the application crashes or is terminated from Task Manager, child processes left running in the background cause port conflicts (`http://localhost:5050` already in use) and lock the SQLite database file on subsequent launches. Furthermore, multiple concurrent launches of the desktop executable can cause conflicting writes to SQLite.
- **Decision**:
  1. Implemented `SingleInstanceManager` using a named global system `Mutex` (`ClinicManagementSystem_SingleInstance_Mutex`). If another instance is already running, the new instance brings the existing window to the foreground and exits immediately.
  2. Implemented `JobObjectManager` using Win32 P/Invoke APIs (`CreateJobObject`, `SetInformationJobObject`, `AssignProcessToJobObject`). The job object is configured with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`.
  3. When `Clinic.Desktop` launches `Clinic.Api.exe`, it assigns the child process handle to this job object. The Windows OS kernel guarantees that whenever the parent desktop process handle closes for any reason (clean exit, crash, SIGKILL, Task Manager termination), the child API process is killed instantly by the kernel with zero orphaned processes.
- **Consequences**: Zero orphaned backend processes, zero SQLite file lock conflicts on restart, and absolute single-instance execution integrity.

## DEC-023: Offscreen WebView2 Native Silent Print Bridge & Dual-Monitor Multi-Display Routing
- **Context**: Consulting clinics require silent printing without popup browser print dialogs: 80mm thermal receipts at reception, and A4/A5 laser prescriptions in the doctor's consultation room. Furthermore, waiting room TVs connected via HDMI to the clinic workstation must display the public queue screen without interfering with the receptionist's or doctor's workspace.
- **Decision**:
  1. `SilentPrintManager` initializes a dedicated offscreen `Microsoft.Web.WebView2` control with `--autoplay-policy=no-user-gesture-required` and user data folder isolation.
  2. The bridge receives native print requests (`window.chrome.webview.postMessage`) or SignalR `PrintJobCreatedDto` events and routes them directly to `CoreWebView2.PrintAsync(settings)`:
     - Receipts: 80mm roll width, zero margins, no headers/footers, routed to configured `ReceiptPrinterName`.
     - Prescriptions: A4/A5 portrait, letterhead margin support (`45mm`), routed to `PrescriptionPrinterName`.
  3. `DualMonitorManager` inspects system screen topology (`System.Windows.Forms.Screen.AllScreens`). If a secondary display is detected, it automatically launches a borderless, full-screen secondary window on Screen 2 bounds, navigated directly to `{ServerUrl}/tv-queue?deviceToken={TvDeviceToken}`.
- **Consequences**: Zero-dialog silent printing, automatic multi-monitor TV queue management, and unified desktop hardware integration.
