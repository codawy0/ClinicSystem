import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { Activity, User, LogOut, LayoutDashboard, } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useQueueHub } from '../hooks/useQueueHub';
import { nursingService } from '../services/nursingService';
import { NurseQueuePanel } from '../components/nursing/NurseQueuePanel';
import { PatientClinicalHeader } from '../components/nursing/PatientClinicalHeader';
import { VitalsForm } from '../components/nursing/VitalsForm';
import { ClinicalProfileModal } from '../components/nursing/ClinicalProfileModal';
import { VisitHistorySidebar } from '../components/nursing/VisitHistorySidebar';
import { Button } from '../components/ui/button';
export function NursePrepScreen() {
    const { user, logout } = useAuth();
    // Queue state
    const [queueItems, setQueueItems] = useState([]);
    const [isLoadingQueue, setIsLoadingQueue] = useState(true);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    // Active visit and clinical profile state
    const [activeVisit, setActiveVisit] = useState(null);
    const [clinicalProfile, setClinicalProfile] = useState(null);
    const [isLoadingVisit, setIsLoadingVisit] = useState(false);
    const [isStartingPrepId, setIsStartingPrepId] = useState(null);
    // Modal state
    const [isClinicalModalOpen, setIsClinicalModalOpen] = useState(false);
    // Fetch live queue
    const fetchLiveQueue = useCallback(async () => {
        setIsLoadingQueue(true);
        try {
            const items = await nursingService.getLiveQueue();
            setQueueItems(items);
            // If we already have a selected appointment, update its item in place
            setSelectedAppointment((prev) => {
                if (!prev)
                    return null;
                const matched = items.find((i) => i.appointmentId === prev.appointmentId);
                return matched || prev;
            });
        }
        catch (e) {
            console.error('Failed to load nursing live queue', e);
        }
        finally {
            setIsLoadingQueue(false);
        }
    }, []);
    // Initial load
    useEffect(() => {
        fetchLiveQueue();
    }, [fetchLiveQueue]);
    // Real-time QueueHub subscription
    const handleQueueUpdated = useCallback((_payload) => {
        // Background resync of queue items
        nursingService.getLiveQueue().then((items) => {
            setQueueItems(items);
            setSelectedAppointment((prev) => {
                if (!prev)
                    return null;
                const matched = items.find((i) => i.appointmentId === prev.appointmentId);
                return matched || prev;
            });
        }).catch(() => { });
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
    const loadPatientData = useCallback(async (appointment) => {
        setSelectedAppointment(appointment);
        setIsLoadingVisit(true);
        try {
            const [visit, profile] = await Promise.all([
                nursingService.initOrGetVisit(appointment.appointmentId),
                nursingService.getClinicalProfile(appointment.patientId),
            ]);
            setActiveVisit(visit);
            setClinicalProfile(profile);
        }
        catch (err) {
            console.error('Failed to load visit or clinical profile:', err);
        }
        finally {
            setIsLoadingVisit(false);
        }
    }, []);
    // Start Prep Action
    const handleStartPrep = async (appointment) => {
        setIsStartingPrepId(appointment.appointmentId);
        try {
            await nursingService.startNursing(appointment.appointmentId);
            // Immediately load patient and refresh queue
            await loadPatientData({ ...appointment, status: 'InNursing' });
            await fetchLiveQueue();
        }
        catch (err) {
            console.error('Failed to start nursing triage:', err);
        }
        finally {
            setIsStartingPrepId(null);
        }
    };
    // Re-fetch clinical profile (e.g. after adding allergy/condition in modal)
    const handleProfileUpdated = useCallback(async () => {
        if (selectedAppointment) {
            try {
                const updated = await nursingService.getClinicalProfile(selectedAppointment.patientId);
                setClinicalProfile(updated);
            }
            catch (err) {
                console.error('Failed to refresh clinical profile', err);
            }
        }
    }, [selectedAppointment]);
    // Save draft success handler
    const handleSaveSuccess = (updatedVisit) => {
        setActiveVisit(updatedVisit);
    };
    // Complete prep handler
    const handleCompletePrep = (updatedVisit) => {
        setActiveVisit(updatedVisit);
        fetchLiveQueue();
    };
    return (_jsxs("div", { className: "min-h-screen bg-slate-100 flex flex-col font-cairo selection:bg-teal-500 selection:text-white", dir: "rtl", children: [_jsxs("header", { className: "bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-500/20", children: _jsx(Activity, { className: "w-6 h-6" }) }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h1", { className: "text-base font-black text-slate-900", children: "\u0645\u062D\u0637\u0629 \u062A\u062C\u0647\u064A\u0632 \u0627\u0644\u062A\u0645\u0631\u064A\u0636 \u0648\u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062A \u0627\u0644\u062D\u064A\u0648\u064A\u0629" }), _jsx("span", { className: "text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2 py-0.5", children: "Nurse Prep Station" })] }), _jsx("p", { className: "text-xs text-slate-500", children: "\u0642\u064A\u0627\u0633 \u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062A \u0627\u0644\u0641\u0633\u064A\u0648\u0644\u0648\u062C\u064A\u0629\u060C \u0627\u0644\u062D\u0633\u0627\u0633\u064A\u0627\u062A \u0627\u0644\u062F\u0648\u0627\u0626\u064A\u0629\u060C \u0648\u0625\u0639\u062F\u0627\u062F \u0627\u0644\u0645\u0631\u064A\u0636 \u0644\u0644\u0643\u0634\u0641" })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 border border-slate-200", children: [_jsx("span", { className: `w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}` }), _jsx("span", { className: "text-slate-600 text-[11px]", children: isConnected ? 'المزامنة الحية متصلة' : 'جاري الاتصال...' })] }), (user?.role === 'Admin' || user?.role === 'Receptionist') && (_jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: () => {
                                    window.location.href = '/reception';
                                }, className: "text-xs text-slate-600 hover:text-slate-900 border-slate-200", children: [_jsx(LayoutDashboard, { className: "w-3.5 h-3.5 ml-1" }), "\u0644\u0648\u062D\u0629 \u0627\u0644\u0627\u0633\u062A\u0642\u0628\u0627\u0644"] })), _jsx("div", { className: "h-6 w-px bg-slate-200 mx-1" }), _jsxs("div", { className: "flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs", children: [_jsx(User, { className: "w-4 h-4 text-slate-400" }), _jsxs("div", { className: "text-right", children: [_jsx("span", { className: "font-bold text-slate-800 block leading-tight", children: user?.fullName || 'طاقم التمريض' }), _jsx("span", { className: "text-[10px] text-teal-700 font-semibold block", children: "\u062A\u0645\u0631\u064A\u0636 \u0627\u0644\u0639\u064A\u0627\u062F\u0629" })] })] }), _jsx(Button, { variant: "ghost", size: "icon", onClick: logout, title: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C", className: "text-slate-400 hover:text-rose-600", children: _jsx(LogOut, { className: "w-4 h-4" }) })] })] }), _jsx("main", { className: "flex-1 p-4 max-w-[1920px] mx-auto w-full", children: _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-4 items-start", children: [_jsx("div", { className: "lg:col-span-3", children: _jsx(NurseQueuePanel, { items: queueItems, selectedAppointmentId: selectedAppointment?.appointmentId || null, onSelectAppointment: loadPatientData, onStartPrep: handleStartPrep, isLoading: isLoadingQueue, onRefresh: fetchLiveQueue, isStartingPrepId: isStartingPrepId }) }), _jsxs("div", { className: "lg:col-span-6 space-y-4", children: [_jsx(PatientClinicalHeader, { profile: clinicalProfile, appointment: selectedAppointment, onOpenClinicalModal: () => setIsClinicalModalOpen(true), isLoading: isLoadingVisit }), activeVisit && selectedAppointment ? (_jsx(VitalsForm, { visitId: activeVisit.id, initialVitals: activeVisit, initialVersion: activeVisit.version, patientGender: clinicalProfile?.gender || 'Male', onSaveSuccess: handleSaveSuccess, onCompletePrep: handleCompletePrep, onConcurrencyError: () => {
                                        if (selectedAppointment) {
                                            loadPatientData(selectedAppointment);
                                        }
                                    } })) : (_jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-sm space-y-3", children: [_jsx(Activity, { className: "w-12 h-12 mx-auto text-slate-300" }), _jsx("h3", { className: "text-sm font-bold text-slate-700", children: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u062E\u062A\u064A\u0627\u0631 \u0645\u0631\u064A\u0636 \u0644\u0644\u0642\u064A\u0627\u0633" }), _jsx("p", { className: "text-xs text-slate-400 max-w-sm mx-auto", children: "\u0627\u062E\u062A\u0631 \u0623\u062D\u062F \u0627\u0644\u0645\u0631\u0636\u0649 \u0645\u0646 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0637\u0627\u0628\u0648\u0631 \u0627\u0644\u062C\u0627\u0646\u0628\u064A\u0629\u060C \u0623\u0648 \u0627\u0636\u063A\u0637 \"\u0628\u062F\u0621 \u0627\u0644\u0641\u062D\u0635\" \u0644\u062A\u0633\u062C\u064A\u0644 \u0642\u064A\u0627\u0633\u0627\u062A \u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062A \u0627\u0644\u062D\u064A\u0648\u064A\u0629 \u0648\u0627\u0644\u062D\u0633\u0627\u0633\u064A\u0627\u062A \u0627\u0644\u0637\u0628\u064A\u0629." })] }))] }), _jsx("div", { className: "lg:col-span-3", children: _jsx(VisitHistorySidebar, { patientId: selectedAppointment?.patientId || null, currentVisitId: activeVisit?.id, currentWeight: activeVisit?.weightKg, currentBpSystolic: activeVisit?.bpSystolic, currentBpDiastolic: activeVisit?.bpDiastolic }) })] }) }), _jsx(ClinicalProfileModal, { isOpen: isClinicalModalOpen, onClose: () => setIsClinicalModalOpen(false), patientId: selectedAppointment?.patientId || null, patientName: selectedAppointment?.patientName, onProfileUpdated: handleProfileUpdated })] }));
}
