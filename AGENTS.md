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
