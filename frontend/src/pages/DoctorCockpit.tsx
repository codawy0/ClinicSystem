import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useQueueHub } from '../hooks/useQueueHub';
import { useDoctorShortcuts } from '../hooks/useDoctorShortcuts';
import { doctorService } from '../services/doctorService';
import {
  LiveQueueItemDto,
  MedicalVisitDetailDto,
  PatientClinicalProfileDto,
  MedicalVisitSummaryDto,
  PrescriptionItemInputDto,
  ClinicalRequestInputDto,
  DrugSafetyCheckResultDto,
  PrescriptionTemplateDto,
  CompleteConsultationRequestDto,
  ClinicSettingDto,
} from '../types';

import { DoctorHeader } from '../components/doctor/DoctorHeader';
import { DoctorPatientBanner } from '../components/doctor/DoctorPatientBanner';
import { ClinicalNotesEditor, ClinicalNotesState } from '../components/doctor/ClinicalNotesEditor';
import { DrugSafetyBanner } from '../components/doctor/DrugSafetyBanner';
import { SmartPrescriptionBuilder } from '../components/doctor/SmartPrescriptionBuilder';
import { ClinicalRequestsSection } from '../components/doctor/ClinicalRequestsSection';
import { DoctorActionBar } from '../components/doctor/DoctorActionBar';
import { PrescriptionTemplateModal } from '../components/doctor/PrescriptionTemplateModal';
import { SaveTemplateModal } from '../components/doctor/SaveTemplateModal';
import { PrescriptionPrintModal } from '../components/doctor/PrescriptionPrintModal';
import { DoctorQueueDrawer } from '../components/doctor/DoctorQueueDrawer';

export function DoctorCockpit() {
  const { user, logout } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Queue and Patient State
  const [queueItems, setQueueItems] = useState<LiveQueueItemDto[]>([]);
  const [activeAppointment, setActiveAppointment] = useState<LiveQueueItemDto | null>(null);
  const [activeVisit, setActiveVisit] = useState<MedicalVisitDetailDto | null>(null);
  const [clinicalProfile, setClinicalProfile] = useState<PatientClinicalProfileDto | null>(null);
  const [pastVisits, setPastVisits] = useState<MedicalVisitSummaryDto[]>([]);
  const [clinicSetting] = useState<ClinicSettingDto | null>(null);

  // Clinical Notes State
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNotesState>({
    chiefComplaint: '',
    examination: '',
    diagnosis: '',
    icd10Code: '',
    doctorPrivateNotes: '',
    nextVisitDate: '',
  });

  // Prescription Items & Clinical Orders
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItemInputDto[]>([]);
  const [clinicalRequests, setClinicalRequests] = useState<ClinicalRequestInputDto[]>([]);

  // Drug Safety Engine State
  const [safetyCheckResult, setSafetyCheckResult] = useState<DrugSafetyCheckResultDto | null>(null);
  const [isOverrideChecked, setIsOverrideChecked] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  // Modals & UI States
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false);
  const [isDoctorOnBreak, setIsDoctorOnBreak] = useState(false);
  const [isCallingNext, setIsCallingNext] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPatient, setIsLoadingPatient] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load patient clinical details and active visit
  const loadAppointmentDetails = useCallback(async (appointment: LiveQueueItemDto) => {
    setIsLoadingPatient(true);
    setActiveAppointment(appointment);

    try {
      // 1. Initialize or get active medical visit
      const visit = await doctorService.initOrGetVisit(appointment.appointmentId);
      setActiveVisit(visit);

      // Populate clinical notes
      setClinicalNotes({
        chiefComplaint: visit.chiefComplaint || '',
        examination: visit.examination || '',
        diagnosis: visit.diagnosis || '',
        icd10Code: visit.icd10Code || '',
        doctorPrivateNotes: visit.doctorPrivateNotes || '',
        nextVisitDate: visit.nextVisitDate || '',
      });

      // Populate prescription items if visit has any saved
      if (visit.prescriptionItems && visit.prescriptionItems.length > 0) {
        setPrescriptionItems(
          visit.prescriptionItems.map((pi) => ({
            drugId: pi.drugId,
            drugName: pi.drugNameSnapshot || pi.drugName,
            activeIngredient: pi.activeIngredientSnapshot || pi.activeIngredient,
            strength: pi.strengthSnapshot || pi.strength,
            form: pi.formSnapshot || pi.form,
            dosage: pi.dosage,
            timing: pi.timing,
            duration: pi.duration,
            instructions: pi.instructions || '',
            warningOverridden: pi.warningOverridden,
            overrideReason: pi.overrideReason,
          }))
        );
      } else {
        setPrescriptionItems([]);
      }

      // Populate clinical requests
      if (visit.clinicalRequests && visit.clinicalRequests.length > 0) {
        setClinicalRequests(
          visit.clinicalRequests.map((cr) => ({
            id: cr.id,
            requestType: cr.requestType,
            catalogCode: cr.catalogCode,
            nameAr: cr.nameAr,
            nameEn: cr.nameEn,
            notes: cr.notes,
          }))
        );
      } else {
        setClinicalRequests([]);
      }

      // 2. Load Patient Clinical Profile (allergies, chronic conditions, pregnancy/lactation)
      const profile = await doctorService.getClinicalProfile(appointment.patientId);
      setClinicalProfile(profile);

      // 3. Load Past Visits for history & 1-click repeat
      setIsLoadingHistory(true);
      doctorService
        .getPatientVisits(appointment.patientId, 1, 15)
        .then((res) => {
          // Filter out current active visit from past visits history
          const history = (res.items || []).filter((v) => v.id !== visit.id);
          setPastVisits(history);
        })
        .catch(console.warn)
        .finally(() => setIsLoadingHistory(false));
    } catch (err) {
      console.error('Failed to load appointment details:', err);
    } finally {
      setIsLoadingPatient(false);
    }
  }, []);

  // Fetch today's queue items
  const fetchTodayQueue = useCallback(async () => {
    try {
      const items = await doctorService.getTodayQueue(user?.id);
      setQueueItems(items);

      // If no active appointment is selected yet, check if there is an in-progress patient WithDoctor
      setActiveAppointment((current) => {
        if (current) {
          const updatedCurrent = items.find((i) => i.appointmentId === current.appointmentId);
          return updatedCurrent || current;
        }

        const withDoctor = items.find((i) => i.status === 'WithDoctor');
        if (withDoctor) {
          loadAppointmentDetails(withDoctor);
          return withDoctor;
        }
        return null;
      });
    } catch (err) {
      console.warn('Failed to fetch today queue:', err);
    }
  }, [user?.id, loadAppointmentDetails]);

  // Initial load
  useEffect(() => {
    fetchTodayQueue();
  }, [fetchTodayQueue]);

  // Real-time QueueHub subscriptions
  const { isConnected } = useQueueHub({
    onQueueUpdated: () => fetchTodayQueue(),
    onPatientCalled: () => fetchTodayQueue(),
    onDoctorBreakToggled: (data) => setIsDoctorOnBreak(data.isDoctorOnBreak),
    onResyncRequired: () => fetchTodayQueue(),
  });

  // Call Next Patient (F4)
  const handleCallNext = useCallback(async () => {
    if (!user) return;
    setIsCallingNext(true);

    try {
      const res = await doctorService.callNext(user.id);
      // Refresh queue and locate called appointment
      const freshQueue = await doctorService.getTodayQueue(user.id);
      setQueueItems(freshQueue);

      const calledAppt = freshQueue.find((i) => i.appointmentId === res.appointmentId);
      if (calledAppt) {
        await loadAppointmentDetails(calledAppt);
      }
    } catch (err: any) {
      console.error('Failed to call next patient:', err);
      alert(err.message || 'تعذر استدعاء المريض التالي. قد تكون قائمة الانتظار فارغة.');
    } finally {
      setIsCallingNext(false);
    }
  }, [user, loadAppointmentDetails]);

  // Recall current patient
  const handleRecall = useCallback(async () => {
    if (!activeAppointment) return;
    try {
      await doctorService.recall(activeAppointment.appointmentId);
    } catch (err) {
      console.error('Failed to recall patient:', err);
    }
  }, [activeAppointment]);

  // Skip current patient
  const handleSkip = useCallback(async () => {
    if (!activeAppointment) return;
    if (!window.confirm('هل أنت متأكد من تخطي هذا المريض مؤقتاً؟')) return;

    try {
      await doctorService.skip(activeAppointment.appointmentId);
      setActiveAppointment(null);
      setActiveVisit(null);
      setClinicalProfile(null);
      setPrescriptionItems([]);
      setClinicalRequests([]);
      await handleCallNext();
    } catch (err) {
      console.error('Failed to skip patient:', err);
    }
  }, [activeAppointment, handleCallNext]);

  // Toggle Doctor Break
  const handleToggleBreak = useCallback(async () => {
    try {
      await doctorService.toggleDoctorBreak();
      setIsDoctorOnBreak((prev) => !prev);
    } catch (err) {
      console.error('Failed to toggle break:', err);
    }
  }, []);

  // Drug Safety Engine Evaluation on prescription change
  useEffect(() => {
    if (!clinicalProfile || prescriptionItems.length === 0) {
      setSafetyCheckResult(null);
      setIsOverrideChecked(false);
      return;
    }

    const drugIds = prescriptionItems
      .map((i) => i.drugId)
      .filter((id): id is number => typeof id === 'number' && id > 0);

    if (drugIds.length === 0) {
      setSafetyCheckResult(null);
      return;
    }

    doctorService
      .checkSafety({
        patientId: clinicalProfile.patientId,
        drugIds,
        isPregnant: Boolean(clinicalProfile.isPregnant || activeVisit?.isPregnant),
        isLactating: Boolean(clinicalProfile.isLactating || activeVisit?.isLactating),
      })
      .then((res) => {
        setSafetyCheckResult(res);
        if (!res.requiresOverride) {
          setIsOverrideChecked(false);
        }
      })
      .catch((err) => console.warn('Safety check evaluation failed:', err));
  }, [prescriptionItems, clinicalProfile, activeVisit?.isPregnant, activeVisit?.isLactating]);

  // Complete Consultation (F9 / Ctrl+Enter)
  const handleCompleteConsultation = useCallback(
    async (callNextAfter: boolean) => {
      if (!activeVisit) {
        alert('لا توجد جلسة كشف نشطة للإتمام!');
        return;
      }

      // Clinical Safety Guard: Mandatory override acknowledgment
      if (safetyCheckResult?.requiresOverride && !isOverrideChecked) {
        alert('⚠️ يوجد تحذير أمان دوائي حرج! يجب تأكيد الموافقة على مسؤوليتك الطبية وتحديد المبرر قبل إتمام الكشف.');
        return;
      }

      setIsSubmitting(true);
      try {
        const payload: CompleteConsultationRequestDto = {
          prescriptionItems: prescriptionItems.map((item) => ({
            ...item,
            warningOverridden: isOverrideChecked,
            overrideReason: isOverrideChecked ? overrideReason : undefined,
          })),
          clinicalRequests,
          diagnosis: clinicalNotes.diagnosis || undefined,
          icd10Code: clinicalNotes.icd10Code || undefined,
          chiefComplaint: clinicalNotes.chiefComplaint || undefined,
          examination: clinicalNotes.examination || undefined,
          doctorPrivateNotes: clinicalNotes.doctorPrivateNotes || undefined,
          nextVisitDate: clinicalNotes.nextVisitDate || undefined,
          version: activeVisit.version,
        };

        const completedVisit = await doctorService.completeConsultation(activeVisit.id, payload);
        setActiveVisit(completedVisit);

        if (callNextAfter) {
          await handleCallNext();
        } else {
          await fetchTodayQueue();
        }
      } catch (err: any) {
        console.error('Failed to complete consultation:', err);
        alert(err.message || 'حدث خطأ أثناء إتمام الكشف. يرجى التحقق وإعادة المحاولة.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      activeVisit,
      safetyCheckResult,
      isOverrideChecked,
      overrideReason,
      prescriptionItems,
      clinicalRequests,
      clinicalNotes,
      handleCallNext,
      fetchTodayQueue,
    ]
  );

  // Apply Prescription Template
  const handleApplyTemplate = useCallback((template: PrescriptionTemplateDto) => {
    // 1. Diagnosis
    if (template.defaultDiagnosis) {
      setClinicalNotes((prev) => ({
        ...prev,
        diagnosis: template.defaultDiagnosis || prev.diagnosis,
      }));
    }

    // 2. Prescription Items
    if (template.items && template.items.length > 0) {
      const mappedItems: PrescriptionItemInputDto[] = template.items.map((it) => ({
        drugId: it.drugId || null,
        drugName: it.drugName,
        activeIngredient: it.activeIngredient || null,
        dosage: it.dosage || '1 قرص',
        form: it.form || 'Tablet',
        route: it.route || null,
        timing: it.timing || 'كل 12 ساعة بعد الأكل (1x2)',
        duration: it.duration || '7 أيام',
        instructions: it.instructions || '',
      }));
      setPrescriptionItems(mappedItems);
    }

    // 3. Lab / Radiology Orders
    if (template.labRadiologyOrders && template.labRadiologyOrders.length > 0) {
      setClinicalRequests(template.labRadiologyOrders);
    }
  }, []);

  // 1-Click Repeat Prior Rx
  const handleRepeatPriorRx = useCallback(async () => {
    if (pastVisits.length === 0) return;
    const latestPastVisit = pastVisits[0];

    try {
      const fullPastVisit = await doctorService.getVisit(latestPastVisit.id);
      if (fullPastVisit.prescriptionItems && fullPastVisit.prescriptionItems.length > 0) {
        setPrescriptionItems(
          fullPastVisit.prescriptionItems.map((pi) => ({
            drugId: pi.drugId,
            drugName: pi.drugNameSnapshot || pi.drugName,
            activeIngredient: pi.activeIngredientSnapshot || pi.activeIngredient,
            strength: pi.strengthSnapshot || pi.strength,
            form: pi.formSnapshot || pi.form,
            dosage: pi.dosage,
            timing: pi.timing,
            duration: pi.duration,
            instructions: pi.instructions || '',
          }))
        );
      }

      if (fullPastVisit.diagnosis && !clinicalNotes.diagnosis) {
        setClinicalNotes((prev) => ({
          ...prev,
          diagnosis: fullPastVisit.diagnosis || '',
          icd10Code: fullPastVisit.icd10Code || '',
        }));
      }
    } catch (err) {
      console.error('Failed to repeat prior prescription:', err);
    }
  }, [pastVisits, clinicalNotes.diagnosis]);

  // Repeat Rx for a specific visit from history drawer
  const handleRepeatVisitRx = useCallback(async (visitId: number) => {
    try {
      const visit = await doctorService.getVisit(visitId);
      if (visit.prescriptionItems && visit.prescriptionItems.length > 0) {
        setPrescriptionItems(
          visit.prescriptionItems.map((pi) => ({
            drugId: pi.drugId,
            drugName: pi.drugNameSnapshot || pi.drugName,
            activeIngredient: pi.activeIngredientSnapshot || pi.activeIngredient,
            strength: pi.strengthSnapshot || pi.strength,
            form: pi.formSnapshot || pi.form,
            dosage: pi.dosage,
            timing: pi.timing,
            duration: pi.duration,
            instructions: pi.instructions || '',
          }))
        );
      }
    } catch (err) {
      console.error('Failed to repeat prescription:', err);
    }
  }, []);

  // Keyboard Shortcuts Hook (F2, F4, F9, Ctrl+Enter, Ctrl+P)
  useDoctorShortcuts({
    onFocusDrugSearch: () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    },
    onCallNext: () => handleCallNext(),
    onComplete: () => handleCompleteConsultation(false),
    onCompleteAndCallNext: () => handleCompleteConsultation(true),
    onPrintPrescription: () => setIsPrintModalOpen(true),
    enabled: !isTemplateModalOpen && !isSaveTemplateModalOpen && !isPrintModalOpen,
  });

  const waitingCount = queueItems.filter(
    (i) => i.status === 'Waiting' || i.status === 'InNursing'
  ).length;

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col antialiased selection:bg-sky-100 selection:text-sky-900">
      {/* 1. Doctor Header */}
      <DoctorHeader
        doctorName={user?.fullName || 'د. طبيب العيادة'}
        specialty="استشاري الأمراض الباطنية والجهاز الهضمي"
        isConnected={isConnected}
        isDoctorOnBreak={isDoctorOnBreak}
        onToggleBreak={handleToggleBreak}
        onCallNext={handleCallNext}
        onRecall={handleRecall}
        onSkip={handleSkip}
        activeAppointment={activeAppointment}
        waitingCount={waitingCount}
        isCallingNext={isCallingNext}
        onToggleQueueDrawer={() => setIsQueueDrawerOpen((prev) => !prev)}
        isQueueDrawerOpen={isQueueDrawerOpen}
        onLogout={logout}
      />

      {/* Main Single-Screen High-Density Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 space-y-4">
        {/* 2. Patient Banner */}
        <DoctorPatientBanner
          profile={clinicalProfile}
          appointment={activeAppointment}
          vitals={activeVisit}
          isLoading={isLoadingPatient}
        />

        {/* 3. Drug Safety Glowing Warning Banner (if warnings exist) */}
        {activeVisit && (
          <DrugSafetyBanner
            checkResult={safetyCheckResult}
            isOverrideChecked={isOverrideChecked}
            onToggleOverride={setIsOverrideChecked}
            overrideReason={overrideReason}
            onChangeOverrideReason={setOverrideReason}
          />
        )}

        {/* 4. Clinical Notes & Physical Examination Editor (with 5s debounced autosave) */}
        {activeVisit && (
          <ClinicalNotesEditor
            visitId={activeVisit.id}
            initialNotes={{
              chiefComplaint: clinicalNotes.chiefComplaint,
              examination: clinicalNotes.examination,
              diagnosis: clinicalNotes.diagnosis,
              icd10Code: clinicalNotes.icd10Code,
              doctorPrivateNotes: clinicalNotes.doctorPrivateNotes,
              nextVisitDate: clinicalNotes.nextVisitDate,
              nurseNotes: activeVisit.nurseNotes,
            }}
            version={activeVisit.version}
            isDraft={activeVisit.isDraft}
            onChangeNotes={(updated) => setClinicalNotes(updated)}
            onAutosaveSuccess={(updatedVisit) => {
              setActiveVisit(updatedVisit);
            }}
            onVersionConflict={() => {
              if (activeAppointment) {
                loadAppointmentDetails(activeAppointment);
              }
            }}
          />
        )}

        {/* 5. Smart Prescription Builder (F2 autocomplete, <bdi>, dosage presets) */}
        {activeVisit && (
          <SmartPrescriptionBuilder
            items={prescriptionItems}
            onChangeItems={setPrescriptionItems}
            patientId={clinicalProfile?.patientId}
            isPregnant={Boolean(clinicalProfile?.isPregnant || activeVisit?.isPregnant)}
            isLactating={Boolean(clinicalProfile?.isLactating || activeVisit?.isLactating)}
            patientAllergies={clinicalProfile?.allergies || []}
            onOpenTemplatesModal={() => setIsTemplateModalOpen(true)}
            onOpenSaveTemplateModal={() => setIsSaveTemplateModalOpen(true)}
            onRepeatPriorRx={handleRepeatPriorRx}
            hasPriorVisits={pastVisits.length > 0}
            searchRef={searchInputRef}
          />
        )}

        {/* 6. Clinical Requests Section (Lab & Radiology Orders with Quick Chips) */}
        {activeVisit && (
          <ClinicalRequestsSection
            requests={clinicalRequests}
            onChangeRequests={setClinicalRequests}
          />
        )}
      </main>

      {/* 7. Fixed Bottom Action Bar (F4, Ctrl+P, F9, Ctrl+Enter) */}
      <DoctorActionBar
        onCallNext={handleCallNext}
        onComplete={() => handleCompleteConsultation(false)}
        onCompleteAndCallNext={() => handleCompleteConsultation(true)}
        onPrint={() => setIsPrintModalOpen(true)}
        isSubmitting={isSubmitting}
        hasSevereWarnings={Boolean(safetyCheckResult?.requiresOverride)}
        isOverrideChecked={isOverrideChecked}
        hasActiveVisit={Boolean(activeVisit)}
      />

      {/* Modals & Drawers */}

      {/* Prescription Templates Modal */}
      <PrescriptionTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onApplyTemplate={handleApplyTemplate}
      />

      {/* Save Template Modal */}
      <SaveTemplateModal
        isOpen={isSaveTemplateModalOpen}
        onClose={() => setIsSaveTemplateModalOpen(false)}
        currentDiagnosis={clinicalNotes.diagnosis}
        currentItems={prescriptionItems}
        currentOrders={clinicalRequests}
        onSaved={() => {
          // Optional confirmation toast or notification
        }}
      />

      {/* Prescription Print Modal (Letterhead / Digital A5 Pad) */}
      <PrescriptionPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        patient={clinicalProfile}
        appointment={activeAppointment}
        vitals={activeVisit}
        diagnosis={clinicalNotes.diagnosis}
        items={prescriptionItems}
        clinicalRequests={clinicalRequests}
        nextVisitDate={clinicalNotes.nextVisitDate}
        clinicSetting={clinicSetting}
      />

      {/* Queue & History Timeline Drawer */}
      <DoctorQueueDrawer
        isOpen={isQueueDrawerOpen}
        onClose={() => setIsQueueDrawerOpen(false)}
        currentAppointment={activeAppointment}
        queueItems={queueItems}
        onSelectPatient={loadAppointmentDetails}
        onCallPatient={async (appt) => {
          await doctorService.recall(appt.appointmentId);
          await loadAppointmentDetails(appt);
        }}
        pastVisits={pastVisits}
        onRepeatVisitRx={handleRepeatVisitRx}
        isLoadingHistory={isLoadingHistory}
      />
    </div>
  );
}
