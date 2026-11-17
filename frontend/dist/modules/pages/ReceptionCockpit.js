import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { Stethoscope, User, LogOut, Tv, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useQueueHub } from '../hooks/useQueueHub';
import { api } from '../lib/api';
import { ShiftGuardBanner } from '../components/reception/ShiftGuardBanner';
import { SearchBookingPanel } from '../components/reception/SearchBookingPanel';
import { LiveQueueBoard } from '../components/reception/LiveQueueBoard';
import { ShiftDrawerLedger } from '../components/reception/ShiftDrawerLedger';
import { OpenShiftModal } from '../components/reception/OpenShiftModal';
import { CloseShiftModal } from '../components/reception/CloseShiftModal';
import { PettyExpenseModal } from '../components/reception/PettyExpenseModal';
import { ThermalReceiptModal } from '../components/reception/ThermalReceiptModal';
import { Button } from '../components/ui/button';
export function ReceptionCockpit() {
    const { user, logout } = useAuth();
    // Shift state
    const [currentShift, setCurrentShift] = useState(null);
    const [isLoadingShift, setIsLoadingShift] = useState(true);
    // Queue state
    const [queueItems, setQueueItems] = useState([]);
    const [isLoadingQueue, setIsLoadingQueue] = useState(false);
    // Modals state
    const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
    const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [activeReceipt, setActiveReceipt] = useState(null);
    // Fetch current active shift
    const fetchCurrentShift = useCallback(async () => {
        setIsLoadingShift(true);
        try {
            const res = await api.get('/shifts/current');
            if (res && res.hasActiveShift && res.shift && !res.shift.isClosed) {
                const s = {
                    ...res.shift,
                    id: res.shift.shiftId ?? res.shift.id,
                    shiftId: res.shift.shiftId ?? res.shift.id,
                    instapayTotalPiastres: res.shift.totalInstapayPiastres ?? res.shift.instapayTotalPiastres ?? 0,
                    vodafoneCashTotalPiastres: res.shift.totalVodafoneCashPiastres ?? res.shift.vodafoneCashTotalPiastres ?? 0,
                    cardTotalPiastres: res.shift.totalCardPiastres ?? res.shift.cardTotalPiastres ?? 0,
                };
                setCurrentShift(s);
            }
            else {
                setCurrentShift(null);
            }
        }
        catch {
            setCurrentShift(null);
        }
        finally {
            setIsLoadingShift(false);
        }
    }, []);
    // Fetch live queue items
    const fetchLiveQueue = useCallback(async () => {
        setIsLoadingQueue(true);
        try {
            const items = await api.get('/queue/today');
            if (Array.isArray(items)) {
                const mapped = items.map((a) => ({
                    appointmentId: a.appointmentId ?? a.id,
                    patientId: a.patientId,
                    patientName: a.patientName || '',
                    fileNumber: a.fileNumber || '',
                    phone: a.patientPhone || a.phone || '',
                    queueNumber: a.queueNumber,
                    status: a.status,
                    isUrgent: Boolean(a.isUrgent),
                    isConsultation: Boolean(a.isConsultation),
                    serviceName: a.serviceName || '',
                    doctorName: a.doctorName || '',
                    arrivedAtUtc: a.arrivedAtUtc,
                    calledAtUtc: a.calledAtUtc,
                    invoiceStatus: a.invoiceStatus || 'Paid',
                    remainingBalancePiastres: a.remainingPiastres ?? 0,
                    netTotalPiastres: a.netTotalPiastres ?? 0,
                    paidPiastres: a.paidPiastres ?? 0,
                    version: a.version ?? 1,
                }));
                setQueueItems(mapped);
            }
            else {
                setQueueItems([]);
            }
        }
        catch (err) {
            console.warn('Failed to load queue items:', err);
        }
        finally {
            setIsLoadingQueue(false);
        }
    }, []);
    // Initial load
    useEffect(() => {
        fetchCurrentShift();
        fetchLiveQueue();
    }, [fetchCurrentShift, fetchLiveQueue]);
    // Connect SignalR for live queue updates
    useQueueHub({
        onQueueUpdated: () => {
            fetchLiveQueue();
            fetchCurrentShift();
        },
        onPatientCalled: () => {
            fetchLiveQueue();
        },
        onResyncRequired: () => {
            fetchLiveQueue();
            fetchCurrentShift();
        },
    });
    // Action: Check-in (Booked -> Waiting)
    const handleCheckIn = async (item) => {
        try {
            await api.put(`/appointments/${item.appointmentId}/check-in`, {
                version: item.version,
            });
            fetchLiveQueue();
        }
        catch (err) {
            alert(err.message || 'فشل تسجيل حضور المريض');
        }
    };
    // Action: Toggle Urgent
    const handleToggleUrgent = async (item) => {
        try {
            await api.post(`/appointments/${item.appointmentId}/urgent`, {
                isUrgent: !item.isUrgent,
                version: item.version,
            });
            fetchLiveQueue();
        }
        catch (err) {
            alert(err.message || 'فشل تعديل حالة الاستعجال');
        }
    };
    // Action: Skip
    const handleSkip = async (item) => {
        try {
            await api.post(`/queue/${item.appointmentId}/skip`, {
                version: item.version,
            });
            fetchLiveQueue();
        }
        catch (err) {
            alert(err.message || 'فشل تخطي الدور');
        }
    };
    // Action: Recall
    const handleRecall = async (item) => {
        try {
            await api.post(`/queue/${item.appointmentId}/recall`, {
                version: item.version,
            });
            fetchLiveQueue();
        }
        catch (err) {
            alert(err.message || 'فشل استعادة الحالة');
        }
    };
    // Action: Settle Remaining Balance
    const handleSettle = async (item) => {
        if (!currentShift) {
            setIsOpenShiftModalOpen(true);
            return;
        }
        const amountEgp = (item.remainingBalancePiastres / 100).toFixed(2);
        const confirmed = window.confirm(`هل تريد تحصيل المبلغ المتبقي (${amountEgp} ج.م) نقداً بالدرج؟`);
        if (!confirmed)
            return;
        try {
            await api.post(`/appointments/${item.appointmentId}/settle`, {
                amountPiastres: item.remainingBalancePiastres,
                paymentMethod: 'Cash',
                version: item.version,
            });
            fetchLiveQueue();
            fetchCurrentShift();
        }
        catch (err) {
            alert(err.message || 'فشل تحصيل المبلغ');
        }
    };
    return (_jsxs("div", { className: "min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans selection:bg-sky-500 selection:text-white", children: [_jsxs("header", { className: "bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shadow-xs sticky top-0 z-30", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2.5 rounded-xl bg-gradient-to-br from-sky-600 to-cyan-600 text-white shadow-sm", children: _jsx(Stethoscope, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-base font-extrabold text-slate-900 leading-tight", children: "\u0643\u0627\u0628\u064A\u0646\u0629 \u0627\u0644\u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0648\u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0645\u0648\u062D\u062F\u0629" }), _jsx("p", { className: "text-[11px] text-slate-500", children: "\u0639\u064A\u0627\u062F\u0629 \u062F. \u0623\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0631\u062D\u0645\u0646 \u2022 \u0627\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u064A" })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: () => window.open('/tv-queue', '_blank'), className: "text-xs py-1.5 border-slate-300 text-slate-700", children: [_jsx(Tv, { className: "w-3.5 h-3.5 ml-1 text-sky-600" }), "\u0634\u0627\u0634\u0629 \u0635\u0627\u0644\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 (TV)"] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => {
                                    fetchLiveQueue();
                                    fetchCurrentShift();
                                }, className: "text-xs py-1.5 border-slate-300 text-slate-700", children: [_jsx(RefreshCw, { className: "w-3.5 h-3.5 ml-1" }), "\u062A\u062D\u062F\u064A\u062B"] }), _jsx("div", { className: "h-6 w-px bg-slate-200 mx-1" }), _jsxs("div", { className: "flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs", children: [_jsx(User, { className: "w-4 h-4 text-slate-400" }), _jsxs("div", { className: "text-right", children: [_jsx("span", { className: "font-bold text-slate-800 block leading-tight", children: user?.fullName || 'موظف الاستقبال' }), _jsx("span", { className: "text-[10px] text-slate-500 block", children: "\u0627\u0644\u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0648\u0627\u0644\u062E\u0632\u064A\u0646\u0629" })] })] }), _jsx(Button, { variant: "ghost", size: "icon", onClick: logout, title: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C", className: "text-slate-400 hover:text-rose-600", children: _jsx(LogOut, { className: "w-4 h-4" }) })] })] }), _jsxs("div", { className: "flex-1 p-5 space-y-4 max-w-[1920px] mx-auto w-full", children: [_jsx(ShiftGuardBanner, { currentShift: currentShift, onOpenShiftClick: () => setIsOpenShiftModalOpen(true), onCloseShiftClick: () => setIsCloseShiftModalOpen(true), onExpenseClick: () => setIsExpenseModalOpen(true), isLoading: isLoadingShift }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-4 items-start", children: [_jsx("div", { className: "lg:col-span-4 xl:col-span-3", children: _jsx(SearchBookingPanel, { isShiftOpen: Boolean(currentShift), onAppointmentCreated: (receipt) => {
                                        setActiveReceipt(receipt);
                                        fetchLiveQueue();
                                        fetchCurrentShift();
                                    }, onShiftRequired: () => setIsOpenShiftModalOpen(true) }) }), _jsx("div", { className: "lg:col-span-5 xl:col-span-6", children: _jsx(LiveQueueBoard, { queueItems: queueItems, onCheckIn: handleCheckIn, onToggleUrgent: handleToggleUrgent, onSkip: handleSkip, onRecall: handleRecall, onSettle: handleSettle, isLoading: isLoadingQueue }) }), _jsx("div", { className: "lg:col-span-3 xl:col-span-3", children: _jsx(ShiftDrawerLedger, { currentShift: currentShift, onOpenExpenseModal: () => setIsExpenseModalOpen(true), onOpenCloseShiftModal: () => setIsCloseShiftModalOpen(true) }) })] })] }), _jsx(OpenShiftModal, { isOpen: isOpenShiftModalOpen, onClose: () => setIsOpenShiftModalOpen(false), onShiftOpened: (shift) => {
                    const s = {
                        ...shift,
                        id: shift.shiftId ?? shift.id,
                        shiftId: shift.shiftId ?? shift.id,
                    };
                    setCurrentShift(s);
                    fetchCurrentShift();
                } }), _jsx(CloseShiftModal, { isOpen: isCloseShiftModalOpen, onClose: () => setIsCloseShiftModalOpen(false), currentShift: currentShift, onShiftClosed: () => {
                    setCurrentShift(null);
                    fetchCurrentShift();
                } }), currentShift && (_jsx(PettyExpenseModal, { isOpen: isExpenseModalOpen, onClose: () => setIsExpenseModalOpen(false), shiftId: currentShift.shiftId || currentShift.id || 0, onExpenseRecorded: () => {
                    fetchCurrentShift();
                } })), _jsx(ThermalReceiptModal, { isOpen: Boolean(activeReceipt), onClose: () => setActiveReceipt(null), receipt: activeReceipt })] }));
}
