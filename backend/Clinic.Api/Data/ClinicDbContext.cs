using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Clinic.Api.Common.Enums;
using Clinic.Api.Data.Converters;
using Clinic.Api.Entities;
using Clinic.Api.Entities.Common;
using Clinic.Api.Infrastructure;

namespace Clinic.Api.Data;

public class ClinicDbContext : DbContext
{
    public ClinicDbContext(DbContextOptions<ClinicDbContext> options)
        : base(options)
    {
    }

    // DbSets for all 21 Domain Entities
    public DbSet<User> Users => Set<User>();
    public DbSet<ClinicSetting> ClinicSettings => Set<ClinicSetting>();
    public DbSet<ServiceCatalog> ServiceCatalogs => Set<ServiceCatalog>();
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<PatientAllergy> PatientAllergies => Set<PatientAllergy>();
    public DbSet<PatientChronicCondition> PatientChronicConditions => Set<PatientChronicCondition>();
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<AppointmentStatusHistory> AppointmentStatusHistories => Set<AppointmentStatusHistory>();
    public DbSet<MedicalVisit> MedicalVisits => Set<MedicalVisit>();
    public DbSet<VisitAddendum> VisitAddenda => Set<VisitAddendum>();
    public DbSet<Drug> Drugs => Set<Drug>();
    public DbSet<PrescriptionItem> PrescriptionItems => Set<PrescriptionItem>();
    public DbSet<ClinicalRequestItem> ClinicalRequestItems => Set<ClinicalRequestItem>();
    public DbSet<PatientAttachment> PatientAttachments => Set<PatientAttachment>();
    public DbSet<Shift> Shifts => Set<Shift>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceLine> InvoiceLines => Set<InvoiceLine>();
    public DbSet<FinancialTransaction> FinancialTransactions => Set<FinancialTransaction>();
    public DbSet<PrintJob> PrintJobs => Set<PrintJob>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<PrescriptionTemplate> PrescriptionTemplates => Set<PrescriptionTemplate>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        base.ConfigureConventions(configurationBuilder);

        // Global UTC DateTime value converters
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<NullableUtcDateTimeConverter>();

        // Enforce Enums stored as strings
        configurationBuilder.Properties<UserRole>().HaveConversion<string>();
        configurationBuilder.Properties<ServiceCategory>().HaveConversion<string>();
        configurationBuilder.Properties<PatientGender>().HaveConversion<string>();
        configurationBuilder.Properties<BloodType>().HaveConversion<string>();
        configurationBuilder.Properties<AllergySeverity>().HaveConversion<string>();
        configurationBuilder.Properties<BookingType>().HaveConversion<string>();
        configurationBuilder.Properties<AppointmentStatus>().HaveConversion<string>();
        configurationBuilder.Properties<BloodSugarType>().HaveConversion<string>();
        configurationBuilder.Properties<DrugForm>().HaveConversion<string>();
        configurationBuilder.Properties<RequestType>().HaveConversion<string>();
        configurationBuilder.Properties<AttachmentFileType>().HaveConversion<string>();
        configurationBuilder.Properties<TvPrivacyMode>().HaveConversion<string>();
        configurationBuilder.Properties<DiscountReason>().HaveConversion<string>();
        configurationBuilder.Properties<InvoiceStatus>().HaveConversion<string>();
        configurationBuilder.Properties<TransactionType>().HaveConversion<string>();
        configurationBuilder.Properties<PaymentMethod>().HaveConversion<string>();
        configurationBuilder.Properties<PrintJobTargetRole>().HaveConversion<string>();
        configurationBuilder.Properties<PrintDocumentType>().HaveConversion<string>();
        configurationBuilder.Properties<PrintJobStatus>().HaveConversion<string>();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // 1. Global Rule: DeleteBehavior.Restrict on ALL Foreign Keys
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var foreignKey in entityType.GetForeignKeys())
            {
                foreignKey.DeleteBehavior = DeleteBehavior.Restrict;
            }
        }

        // 2. Global Rule: ConcurrencyToken on IVersionedEntity.Version
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(IVersionedEntity).IsAssignableFrom(entityType.ClrType))
            {
                modelBuilder.Entity(entityType.ClrType)
                    .Property(nameof(IVersionedEntity.Version))
                    .IsConcurrencyToken();
            }
        }

        // 3. User
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Username).IsUnique();
        });

        // 4. Patient
        modelBuilder.Entity<Patient>(entity =>
        {
            entity.HasIndex(p => p.FileNumber).IsUnique();
            entity.HasIndex(p => p.SearchName);
            entity.HasIndex(p => p.NormalizedPhone); // NON-UNIQUE index to support shared family phones

            entity.HasOne(p => p.GuardianPatient)
                .WithMany(p => p.Dependents)
                .HasForeignKey(p => p.GuardianPatientId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 5. PatientAllergy
        modelBuilder.Entity<PatientAllergy>(entity =>
        {
            entity.HasIndex(a => new { a.PatientId, a.ActiveIngredient });

            entity.HasOne(a => a.Patient)
                .WithMany(p => p.Allergies)
                .HasForeignKey(a => a.PatientId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 6. PatientChronicCondition
        modelBuilder.Entity<PatientChronicCondition>(entity =>
        {
            entity.HasIndex(c => c.PatientId);

            entity.HasOne(c => c.Patient)
                .WithMany(p => p.ChronicConditions)
                .HasForeignKey(c => c.PatientId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 7. Appointment
        modelBuilder.Entity<Appointment>(entity =>
        {
            // Filtered unique index: UNIQUE(DoctorUserId, BusinessDate, QueueNumber) WHERE QueueNumber IS NOT NULL
            entity.HasIndex(a => new { a.DoctorUserId, a.BusinessDate, a.QueueNumber })
                .IsUnique()
                .HasFilter("\"QueueNumber\" IS NOT NULL");

            // Filtered unique index: UNIQUE(IdempotencyKey) WHERE IdempotencyKey IS NOT NULL
            entity.HasIndex(a => a.IdempotencyKey)
                .IsUnique()
                .HasFilter("\"IdempotencyKey\" IS NOT NULL");

            // Filtered unique index: UNIQUE(CallIdempotencyKey) WHERE CallIdempotencyKey IS NOT NULL
            entity.HasIndex(a => a.CallIdempotencyKey)
                .IsUnique()
                .HasFilter("\"CallIdempotencyKey\" IS NOT NULL");

            entity.HasIndex(a => new { a.BusinessDate, a.Status });
            entity.HasIndex(a => a.PatientId);

            entity.HasOne(a => a.Doctor)
                .WithMany(u => u.DoctorAppointments)
                .HasForeignKey(a => a.DoctorUserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(a => a.Patient)
                .WithMany(p => p.Appointments)
                .HasForeignKey(a => a.PatientId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(a => a.Service)
                .WithMany(s => s.Appointments)
                .HasForeignKey(a => a.ServiceId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(a => a.ParentExamAppointment)
                .WithMany(a => a.FollowUpConsultations)
                .HasForeignKey(a => a.ParentExamAppointmentId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 8. AppointmentStatusHistory
        modelBuilder.Entity<AppointmentStatusHistory>(entity =>
        {
            entity.HasIndex(h => h.AppointmentId);

            entity.HasOne(h => h.Appointment)
                .WithMany(a => a.StatusHistories)
                .HasForeignKey(h => h.AppointmentId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(h => h.ChangedByUser)
                .WithMany(u => u.StatusHistories)
                .HasForeignKey(h => h.ChangedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 9. MedicalVisit
        modelBuilder.Entity<MedicalVisit>(entity =>
        {
            // Unique 1:1 with Appointment
            entity.HasIndex(v => v.AppointmentId).IsUnique();
            entity.HasIndex(v => new { v.PatientId, v.CompletedAtUtc });

            // Precision for vitals
            entity.Property(v => v.WeightKg).HasPrecision(5, 2);
            entity.Property(v => v.HeightCm).HasPrecision(5, 2);
            entity.Property(v => v.TempCelsius).HasPrecision(4, 1);

            entity.HasOne(v => v.Appointment)
                .WithOne(a => a.MedicalVisit)
                .HasForeignKey<MedicalVisit>(v => v.AppointmentId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(v => v.Patient)
                .WithMany(p => p.MedicalVisits)
                .HasForeignKey(v => v.PatientId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(v => v.Doctor)
                .WithMany(u => u.DoctorVisits)
                .HasForeignKey(v => v.DoctorUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 10. VisitAddendum
        modelBuilder.Entity<VisitAddendum>(entity =>
        {
            entity.HasIndex(a => a.MedicalVisitId);

            entity.HasOne(a => a.MedicalVisit)
                .WithMany(v => v.Addenda)
                .HasForeignKey(a => a.MedicalVisitId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(a => a.AuthorUser)
                .WithMany(u => u.VisitAddenda)
                .HasForeignKey(a => a.AuthorUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 11. Drug
        modelBuilder.Entity<Drug>(entity =>
        {
            entity.HasIndex(d => d.SearchTradeName);
            entity.HasIndex(d => d.ActiveIngredient);
        });

        // 12. PrescriptionItem
        modelBuilder.Entity<PrescriptionItem>(entity =>
        {
            entity.HasIndex(p => p.MedicalVisitId);

            entity.HasOne(p => p.MedicalVisit)
                .WithMany(v => v.PrescriptionItems)
                .HasForeignKey(p => p.MedicalVisitId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(p => p.Drug)
                .WithMany(d => d.PrescriptionItems)
                .HasForeignKey(p => p.DrugId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 13. ClinicalRequestItem
        modelBuilder.Entity<ClinicalRequestItem>(entity =>
        {
            entity.HasIndex(c => c.MedicalVisitId);

            entity.HasOne(c => c.MedicalVisit)
                .WithMany(v => v.ClinicalRequests)
                .HasForeignKey(c => c.MedicalVisitId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 14. PatientAttachment
        modelBuilder.Entity<PatientAttachment>(entity =>
        {
            entity.HasIndex(a => new { a.PatientId, a.IsDeleted });

            entity.HasOne(a => a.Patient)
                .WithMany(p => p.Attachments)
                .HasForeignKey(a => a.PatientId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(a => a.MedicalVisit)
                .WithMany(v => v.Attachments)
                .HasForeignKey(a => a.MedicalVisitId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(a => a.UploadedByUser)
                .WithMany(u => u.UploadedAttachments)
                .HasForeignKey(a => a.UploadedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 15. Shift
        modelBuilder.Entity<Shift>(entity =>
        {
            // Filtered unique index: UNIQUE(UserId) WHERE IsClosed = 0
            entity.HasIndex(s => s.UserId)
                .IsUnique()
                .HasFilter("\"IsClosed\" = 0");

            entity.HasOne(s => s.User)
                .WithMany(u => u.Shifts)
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 16. Invoice
        modelBuilder.Entity<Invoice>(entity =>
        {
            entity.HasIndex(i => i.AppointmentId);
            entity.HasIndex(i => i.PatientId);

            entity.HasOne(i => i.Appointment)
                .WithOne(a => a.Invoice)
                .HasForeignKey<Invoice>(i => i.AppointmentId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(i => i.Patient)
                .WithMany(p => p.Invoices)
                .HasForeignKey(i => i.PatientId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(i => i.ApprovedByUser)
                .WithMany(u => u.ApprovedInvoices)
                .HasForeignKey(i => i.ApprovedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 17. InvoiceLine
        modelBuilder.Entity<InvoiceLine>(entity =>
        {
            entity.HasIndex(l => l.InvoiceId);

            entity.HasOne(l => l.Invoice)
                .WithMany(i => i.Lines)
                .HasForeignKey(l => l.InvoiceId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(l => l.Service)
                .WithMany(s => s.InvoiceLines)
                .HasForeignKey(l => l.ServiceId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 18. FinancialTransaction
        modelBuilder.Entity<FinancialTransaction>(entity =>
        {
            // Filtered unique index: UNIQUE(IdempotencyKey) WHERE IdempotencyKey IS NOT NULL
            entity.HasIndex(t => t.IdempotencyKey)
                .IsUnique()
                .HasFilter("\"IdempotencyKey\" IS NOT NULL");

            entity.HasIndex(t => t.ShiftId);
            entity.HasIndex(t => t.InvoiceId);

            entity.HasOne(t => t.Shift)
                .WithMany(s => s.Transactions)
                .HasForeignKey(t => t.ShiftId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(t => t.Invoice)
                .WithMany(i => i.Transactions)
                .HasForeignKey(t => t.InvoiceId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(t => t.CreatedByUser)
                .WithMany(u => u.CreatedTransactions)
                .HasForeignKey(t => t.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 19. PrintJob
        modelBuilder.Entity<PrintJob>(entity =>
        {
            entity.HasIndex(j => new { j.Status, j.TargetRole });
        });

        // 20. AuditLog
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasIndex(a => new { a.EntityName, a.EntityId });
            entity.HasIndex(a => a.CreatedAtUtc);

            entity.HasOne(a => a.ActorUser)
                .WithMany(u => u.AuditLogs)
                .HasForeignKey(a => a.ActorUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 21. PrescriptionTemplate
        modelBuilder.Entity<PrescriptionTemplate>(entity =>
        {
            entity.HasIndex(t => t.DoctorUserId);

            entity.HasOne(t => t.Doctor)
                .WithMany(u => u.PrescriptionTemplates)
                .HasForeignKey(t => t.DoctorUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    public override int SaveChanges()
    {
        ApplyModelSaveHooks();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyModelSaveHooks();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void ApplyModelSaveHooks()
    {
        var now = DateTime.UtcNow;

        // Hook 1: Auto-increment Version on modified IVersionedEntity
        foreach (var entry in ChangeTracker.Entries<IVersionedEntity>())
        {
            if (entry.State == EntityState.Modified)
            {
                entry.Entity.Version++;
            }
        }

        // Hook 2: Auto-populate SearchName and NormalizedPhone on Patient
        foreach (var entry in ChangeTracker.Entries<Patient>())
        {
            if (entry.State == EntityState.Added || entry.State == EntityState.Modified)
            {
                entry.Entity.SearchName = ArabicNormalizer.NormalizeText(entry.Entity.FullName);
                entry.Entity.NormalizedPhone = ArabicNormalizer.NormalizePhone(entry.Entity.Phone);
            }
        }

        // Hook 3: Auto-populate SearchTradeName and lowercase ActiveIngredient on Drug
        foreach (var entry in ChangeTracker.Entries<Drug>())
        {
            if (entry.State == EntityState.Added || entry.State == EntityState.Modified)
            {
                entry.Entity.SearchTradeName = ArabicNormalizer.NormalizeText(entry.Entity.TradeName);
                if (!string.IsNullOrWhiteSpace(entry.Entity.ActiveIngredient))
                {
                    entry.Entity.ActiveIngredient = entry.Entity.ActiveIngredient.Trim().ToLowerInvariant();
                }
            }
        }

        // Hook 4: Lowercase ActiveIngredient on PatientAllergy
        foreach (var entry in ChangeTracker.Entries<PatientAllergy>())
        {
            if (entry.State == EntityState.Added || entry.State == EntityState.Modified)
            {
                if (!string.IsNullOrWhiteSpace(entry.Entity.ActiveIngredient))
                {
                    entry.Entity.ActiveIngredient = entry.Entity.ActiveIngredient.Trim().ToLowerInvariant();
                }
            }
        }

        // Hook 5: Automatic CreatedAtUtc and UpdatedAtUtc timestamps
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State == EntityState.Added)
            {
                var createdAt = entry.Properties.FirstOrDefault(p => p.Metadata.Name == "CreatedAtUtc");
                if (createdAt != null && (createdAt.CurrentValue == null || (DateTime)createdAt.CurrentValue == default))
                {
                    createdAt.CurrentValue = now;
                }
            }
            else if (entry.State == EntityState.Modified)
            {
                var updatedAt = entry.Properties.FirstOrDefault(p => p.Metadata.Name == "UpdatedAtUtc");
                if (updatedAt != null)
                {
                    updatedAt.CurrentValue = now;
                }
            }
        }
    }
}
