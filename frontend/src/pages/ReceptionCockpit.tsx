import { useState, useEffect, useCallback } from 'react';
import { Stethoscope, User, LogOut, Tv, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useQueueHub } from '../hooks/useQueueHub';
import { api } from '../lib/api';
import { ShiftSummaryDto, LiveQueueItemDto, ThermalReceiptDto } from '../types';

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
  const [currentShift, setCurrentShift] = useState<ShiftSummaryDto | null>(null);
  const [isLoadingShift, setIsLoadingShift] = useState<boolean>(true);

  // Queue state
  const [queueItems, setQueueItems] = useState<LiveQueueItemDto[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(false);

  // Modals state
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState<boolean>(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState<boolean>(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [activeReceipt, setActiveReceipt] = useState<ThermalReceiptDto | null>(null);

  // Fetch current active shift
  const fetchCurrentShift = useCallback(async () => {
    setIsLoadingShift(true);
    try {
      const res = await api.get<{ hasActiveShift: boolean; shift: ShiftSummaryDto | null }>('/shifts/current');
      if (res && res.hasActiveShift && res.shift && !res.shift.isClosed) {
        const s: ShiftSummaryDto = {
          ...res.shift,
          id: res.shift.shiftId ?? res.shift.id,
          shiftId: res.shift.shiftId ?? res.shift.id,
          instapayTotalPiastres: res.shift.totalInstapayPiastres ?? res.shift.instapayTotalPiastres ?? 0,
          vodafoneCashTotalPiastres: res.shift.totalVodafoneCashPiastres ?? res.shift.vodafoneCashTotalPiastres ?? 0,
          cardTotalPiastres: res.shift.totalCardPiastres ?? res.shift.cardTotalPiastres ?? 0,
        };
        setCurrentShift(s);
      } else {
        setCurrentShift(null);
      }
    } catch {
      setCurrentShift(null);
    } finally {
      setIsLoadingShift(false);
    }
  }, []);

  // Fetch live queue items
  const fetchLiveQueue = useCallback(async () => {
    setIsLoadingQueue(true);
    try {
      const items = await api.get<any[]>('/queue/today');
      if (Array.isArray(items)) {
        const mapped: LiveQueueItemDto[] = items.map((a: any) => ({
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
      } else {
        setQueueItems([]);
      }
    } catch (err) {
      console.warn('Failed to load queue items:', err);
    } finally {
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
  const handleCheckIn = async (item: LiveQueueItemDto) => {
    try {
      await api.put(`/appointments/${item.appointmentId}/check-in`, {
        version: item.version,
      });
      fetchLiveQueue();
    } catch (err: any) {
      alert(err.message || 'فشل تسجيل حضور المريض');
    }
  };

  // Action: Toggle Urgent
  const handleToggleUrgent = async (item: LiveQueueItemDto) => {
    try {
      await api.post(`/appointments/${item.appointmentId}/urgent`, {
        isUrgent: !item.isUrgent,
        version: item.version,
      });
      fetchLiveQueue();
    } catch (err: any) {
      alert(err.message || 'فشل تعديل حالة الاستعجال');
    }
  };

  // Action: Skip
  const handleSkip = async (item: LiveQueueItemDto) => {
    try {
      await api.post(`/queue/${item.appointmentId}/skip`, {
        version: item.version,
      });
      fetchLiveQueue();
    } catch (err: any) {
      alert(err.message || 'فشل تخطي الدور');
    }
  };

  // Action: Recall
  const handleRecall = async (item: LiveQueueItemDto) => {
    try {
      await api.post(`/queue/${item.appointmentId}/recall`, {
        version: item.version,
      });
      fetchLiveQueue();
    } catch (err: any) {
      alert(err.message || 'فشل استعادة الحالة');
    }
  };

  // Action: Settle Remaining Balance
  const handleSettle = async (item: LiveQueueItemDto) => {
    if (!currentShift) {
      setIsOpenShiftModalOpen(true);
      return;
    }

    const amountEgp = (item.remainingBalancePiastres / 100).toFixed(2);
    const confirmed = window.confirm(`هل تريد تحصيل المبلغ المتبقي (${amountEgp} ج.م) نقداً بالدرج؟`);
    if (!confirmed) return;

    try {
      await api.post(`/appointments/${item.appointmentId}/settle`, {
        amountPiastres: item.remainingBalancePiastres,
        paymentMethod: 'Cash',
        version: item.version,
      });
      fetchLiveQueue();
      fetchCurrentShift();
    } catch (err: any) {
      alert(err.message || 'فشل تحصيل المبلغ');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shadow-xs sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-600 to-cyan-600 text-white shadow-sm">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 leading-tight">
              كابينة الاستقبال والحجز الموحدة
            </h1>
            <p className="text-[11px] text-slate-500">عيادة د. أحمد عبد الرحمن • الاستشاري</p>
          </div>
        </div>

        {/* User Info & Quick Links */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/tv-queue', '_blank')}
            className="text-xs py-1.5 border-slate-300 text-slate-700"
          >
            <Tv className="w-3.5 h-3.5 ml-1 text-sky-600" />
            شاشة صالة الانتظار (TV)
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchLiveQueue();
              fetchCurrentShift();
            }}
            className="text-xs py-1.5 border-slate-300 text-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5 ml-1" />
            تحديث
          </Button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <User className="w-4 h-4 text-slate-400" />
            <div className="text-right">
              <span className="font-bold text-slate-800 block leading-tight">{user?.fullName || 'موظف الاستقبال'}</span>
              <span className="text-[10px] text-slate-500 block">الاستقبال والخزينة</span>
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

      {/* Main Container */}
      <div className="flex-1 p-5 space-y-4 max-w-[1920px] mx-auto w-full">
        {/* Top Shift Guard Banner */}
        <ShiftGuardBanner
          currentShift={currentShift}
          onOpenShiftClick={() => setIsOpenShiftModalOpen(true)}
          onCloseShiftClick={() => setIsCloseShiftModalOpen(true)}
          onExpenseClick={() => setIsExpenseModalOpen(true)}
          isLoading={isLoadingShift}
        />

        {/* 3-Panel Unified Cockpit Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Right Panel: Search & 1-Click Booking (Col 4 on LG) */}
          <div className="lg:col-span-4 xl:col-span-3">
            <SearchBookingPanel
              isShiftOpen={Boolean(currentShift)}
              onAppointmentCreated={(receipt) => {
                setActiveReceipt(receipt);
                fetchLiveQueue();
                fetchCurrentShift();
              }}
              onShiftRequired={() => setIsOpenShiftModalOpen(true)}
            />
          </div>

          {/* Center Panel: 6-Column Live Queue Board (Col 6 on LG) */}
          <div className="lg:col-span-5 xl:col-span-6">
            <LiveQueueBoard
              queueItems={queueItems}
              onCheckIn={handleCheckIn}
              onToggleUrgent={handleToggleUrgent}
              onSkip={handleSkip}
              onRecall={handleRecall}
              onSettle={handleSettle}
              isLoading={isLoadingQueue}
            />
          </div>

          {/* Left Panel: Active Shift Drawer Ledger (Col 2/3 on LG) */}
          <div className="lg:col-span-3 xl:col-span-3">
            <ShiftDrawerLedger
              currentShift={currentShift}
              onOpenExpenseModal={() => setIsExpenseModalOpen(true)}
              onOpenCloseShiftModal={() => setIsCloseShiftModalOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Action Modals */}
      <OpenShiftModal
        isOpen={isOpenShiftModalOpen}
        onClose={() => setIsOpenShiftModalOpen(false)}
        onShiftOpened={(shift) => {
          const s: ShiftSummaryDto = {
            ...shift,
            id: shift.shiftId ?? shift.id,
            shiftId: shift.shiftId ?? shift.id,
          };
          setCurrentShift(s);
          fetchCurrentShift();
        }}
      />

      <CloseShiftModal
        isOpen={isCloseShiftModalOpen}
        onClose={() => setIsCloseShiftModalOpen(false)}
        currentShift={currentShift}
        onShiftClosed={() => {
          setCurrentShift(null);
          fetchCurrentShift();
        }}
      />

      {currentShift && (
        <PettyExpenseModal
          isOpen={isExpenseModalOpen}
          onClose={() => setIsExpenseModalOpen(false)}
          shiftId={currentShift.shiftId || currentShift.id || 0}
          onExpenseRecorded={() => {
            fetchCurrentShift();
          }}
        />
      )}

      <ThermalReceiptModal
        isOpen={Boolean(activeReceipt)}
        onClose={() => setActiveReceipt(null)}
        receipt={activeReceipt}
      />
    </div>
  );
}
