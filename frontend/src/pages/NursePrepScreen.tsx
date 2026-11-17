import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  User,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useQueueHub } from '../hooks/useQueueHub';
import { nursingService } from '../services/nursingService';
import {
  LiveQueueItemDto,
  MedicalVisitDetailDto,
  PatientClinicalProfileDto,
  QueueUpdatedPayload,
} from '../types';
import { NurseQueuePanel } from '../components/nursing/NurseQueuePanel';
import { PatientClinicalHeader } from '../components/nursing/PatientClinicalHeader';
import { VitalsForm } from '../components/nursing/VitalsForm';
import { ClinicalProfileModal } from '../components/nursing/ClinicalProfileModal';
import { VisitHistorySidebar } from '../components/nursing/VisitHistorySidebar';
import { Button } from '../components/ui/button';

export function NursePrepScreen() {
  const { user, logout } = useAuth();

  // Queue state
  const [queueItems, setQueueItems] = useState<LiveQueueItemDto[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(true);
  const [selectedAppointment, setSelectedAppointment] = useState<LiveQueueItemDto | null>(null);

  // Active visit and clinical profile state
  const [activeVisit, setActiveVisit] = useState<MedicalVisitDetailDto | null>(null);
  const [clinicalProfile, setClinicalProfile] = useState<PatientClinicalProfileDto | null>(null);
  const [isLoadingVisit, setIsLoadingVisit] = useState<boolean>(false);
  const [isStartingPrepId, setIsStartingPrepId] = useState<number | null>(null);

  // Modal state
  const [isClinicalModalOpen, setIsClinicalModalOpen] = useState<boolean>(false);

  // Fetch live queue
  const fetchLiveQueue = useCallback(async () => {
    setIsLoadingQueue(true);
    try {
      const items = await nursingService.getLiveQueue();
      setQueueItems(items);

      // If we already have a selected appointment, update its item in place
      setSelectedAppointment((prev) => {
        if (!prev) return null;
        const matched = items.find((i) => i.appointmentId === prev.appointmentId);
        return matched || prev;
      });
    } catch (e) {
      console.error('Failed to load nursing live queue', e);
    } finally {
      setIsLoadingQueue(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchLiveQueue();
  }, [fetchLiveQueue]);

  // Real-time QueueHub subscription
  const handleQueueUpdated = useCallback((_payload: QueueUpdatedPayload) => {
    // Background resync of queue items
    nursingService.getLiveQueue().then((items) => {
      setQueueItems(items);
      setSelectedAppointment((prev) => {
        if (!prev) return null;
        const matched = items.find((i) => i.appointmentId === prev.appointmentId);
        return matched || prev;
      });
    }).catch(() => {});
  }, []);

  const { isConnected } = useQueueHub({
    onQueueUpdated: handleQueueUpdated,
    onPatientCalled: () => {
      fetchLiveQueue();
    },
    onResyncRequired: () => {
      fetchLiveQueue();
    },
  });

  // Load Visit Details and Clinical Profile for selected appointment
  const loadPatientData = useCallback(async (appointment: LiveQueueItemDto) => {
    setSelectedAppointment(appointment);
    setIsLoadingVisit(true);

    try {
      const [visit, profile] = await Promise.all([
        nursingService.initOrGetVisit(appointment.appointmentId),
        nursingService.getClinicalProfile(appointment.patientId),
      ]);

      setActiveVisit(visit);
      setClinicalProfile(profile);
    } catch (err) {
      console.error('Failed to load visit or clinical profile:', err);
    } finally {
      setIsLoadingVisit(false);
    }
  }, []);

  // Start Prep Action
  const handleStartPrep = async (appointment: LiveQueueItemDto) => {
    setIsStartingPrepId(appointment.appointmentId);
    try {
      await nursingService.startNursing(appointment.appointmentId);
      // Immediately load patient and refresh queue
      await loadPatientData({ ...appointment, status: 'InNursing' });
      await fetchLiveQueue();
    } catch (err) {
      console.error('Failed to start nursing triage:', err);
    } finally {
      setIsStartingPrepId(null);
    }
  };

  // Re-fetch clinical profile (e.g. after adding allergy/condition in modal)
  const handleProfileUpdated = useCallback(async () => {
    if (selectedAppointment) {
      try {
        const updated = await nursingService.getClinicalProfile(selectedAppointment.patientId);
        setClinicalProfile(updated);
      } catch (err) {
        console.error('Failed to refresh clinical profile', err);
      }
    }
  }, [selectedAppointment]);

  // Save draft success handler
  const handleSaveSuccess = (updatedVisit: MedicalVisitDetailDto) => {
    setActiveVisit(updatedVisit);
  };

  // Complete prep handler
  const handleCompletePrep = (updatedVisit: MedicalVisitDetailDto) => {
    setActiveVisit(updatedVisit);
    fetchLiveQueue();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-cairo selection:bg-teal-500 selection:text-white" dir="rtl">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-500/20">
            <Activity className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-slate-900">محطة تجهيز التمريض والعلامات الحيوية</h1>
              <span className="text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2 py-0.5">
                Nurse Prep Station
              </span>
            </div>
            <p className="text-xs text-slate-500">قياس المؤشرات الفسيولوجية، الحساسيات الدوائية، وإعداد المريض للكشف</p>
          </div>
        </div>

        {/* Right Header Navigation & User info */}
        <div className="flex items-center gap-3">
          {/* Real-time Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 border border-slate-200">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-600 text-[11px]">
              {isConnected ? 'المزامنة الحية متصلة' : 'جاري الاتصال...'}
            </span>
          </div>

          {/* Quick link to Reception if Admin or authorized */}
          {(user?.role === 'Admin' || user?.role === 'Receptionist') && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = '/reception';
              }}
              className="text-xs text-slate-600 hover:text-slate-900 border-slate-200"
            >
              <LayoutDashboard className="w-3.5 h-3.5 ml-1" />
              لوحة الاستقبال
            </Button>
          )}

          <div className="h-6 w-px bg-slate-200 mx-1" />

          {/* User profile */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <User className="w-4 h-4 text-slate-400" />
            <div className="text-right">
              <span className="font-bold text-slate-800 block leading-tight">
                {user?.fullName || 'طاقم التمريض'}
              </span>
              <span className="text-[10px] text-teal-700 font-semibold block">تمريض العيادة</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            title="تسجيل الخروج"
            className="text-slate-400 hover:text-rose-600"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Workspace Layout (3-Column Grid) */}
      <main className="flex-1 p-4 max-w-[1920px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Column 1: Nurse Queue Panel (Col 3 on LG) */}
          <div className="lg:col-span-3">
            <NurseQueuePanel
              items={queueItems}
              selectedAppointmentId={selectedAppointment?.appointmentId || null}
              onSelectAppointment={loadPatientData}
              onStartPrep={handleStartPrep}
              isLoading={isLoadingQueue}
              onRefresh={fetchLiveQueue}
              isStartingPrepId={isStartingPrepId}
            />
          </div>

          {/* Column 2: Center Patient Header & Vitals Form (Col 6 on LG) */}
          <div className="lg:col-span-6 space-y-4">
            <PatientClinicalHeader
              profile={clinicalProfile}
              appointment={selectedAppointment}
              onOpenClinicalModal={() => setIsClinicalModalOpen(true)}
              isLoading={isLoadingVisit}
            />

            {activeVisit && selectedAppointment ? (
              <VitalsForm
                visitId={activeVisit.id}
                initialVitals={activeVisit}
                initialVersion={activeVisit.version}
                patientGender={clinicalProfile?.gender || 'Male'}
                onSaveSuccess={handleSaveSuccess}
                onCompletePrep={handleCompletePrep}
                onConcurrencyError={() => {
                  if (selectedAppointment) {
                    loadPatientData(selectedAppointment);
                  }
                }}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-sm space-y-3">
                <Activity className="w-12 h-12 mx-auto text-slate-300" />
                <h3 className="text-sm font-bold text-slate-700">لم يتم اختيار مريض للقياس</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  اختر أحد المرضى من قائمة الطابور الجانبية، أو اضغط "بدء الفحص" لتسجيل قياسات العلامات الحيوية والحساسيات الطبية.
                </p>
              </div>
            )}
          </div>

          {/* Column 3: Visit History Sidebar (Col 3 on LG) */}
          <div className="lg:col-span-3">
            <VisitHistorySidebar
              patientId={selectedAppointment?.patientId || null}
              currentVisitId={activeVisit?.id}
              currentWeight={activeVisit?.weightKg}
              currentBpSystolic={activeVisit?.bpSystolic}
              currentBpDiastolic={activeVisit?.bpDiastolic}
            />
          </div>
        </div>
      </main>

      {/* Clinical Profile Modal (Allergies & Chronic Conditions) */}
      <ClinicalProfileModal
        isOpen={isClinicalModalOpen}
        onClose={() => setIsClinicalModalOpen(false)}
        patientId={selectedAppointment?.patientId || null}
        patientName={selectedAppointment?.patientName}
        onProfileUpdated={handleProfileUpdated}
      />
    </div>
  );
}
