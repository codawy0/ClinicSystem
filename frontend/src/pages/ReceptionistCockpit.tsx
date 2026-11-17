import { useState, useEffect, useCallback } from 'react';
import {
  Stethoscope,
  User,
  LogOut,
  Tv,
  RefreshCw,
  Printer,
  FileText,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useQueueHub } from '../hooks/useQueueHub';
import { api } from '../lib/api';
import { printService } from '../services/printService';
import { ShiftSummaryDto, LiveQueueItemDto, ThermalReceiptDto } from '../types';

import { ShiftGuardBanner } from '../components/reception/ShiftGuardBanner';
import { SearchBookingPanel } from '../components/reception/SearchBookingPanel';
import { LiveQueueBoard } from '../components/reception/LiveQueueBoard';
import { ShiftDrawerLedger } from '../components/reception/ShiftDrawerLedger';
import { OpenShiftModal } from '../components/reception/OpenShiftModal';
import { CloseShiftModal } from '../components/reception/CloseShiftModal';
import { PettyExpenseModal } from '../components/reception/PettyExpenseModal';
import { ThermalReceiptTemplate } from '../components/print/ThermalReceiptTemplate';
import { PatientAttachmentsDrawer } from '../components/attachments/PatientAttachmentsDrawer';
import { AttachmentViewerModal } from '../components/attachments/AttachmentViewerModal';
import { Dialog } from '../components/ui/dialog';
import { Button } from '../components/ui/button';

export function ReceptionistCockpit() {
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
  const [isPrintingReceipt, setIsPrintingReceipt] = useState<boolean>(false);

  // Attachments state
  const [isAttachmentsDrawerOpen, setIsAttachmentsDrawerOpen] = useState<boolean>(false);
  const [isViewerModalOpen, setIsViewerModalOpen] = useState<boolean>(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>('');
  const [viewerAttachmentId, setViewerAttachmentId] = useState<number | undefined>(undefined);
  const [viewerCompareId, setViewerCompareId] = useState<number | undefined>(undefined);

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

  // QueueHub real-time listener
  const { isConnected } = useQueueHub({
    onQueueUpdated: () => fetchLiveQueue(),
    onPatientCalled: () => fetchLiveQueue(),
    onResyncRequired: () => {
      fetchLiveQueue();
      fetchCurrentShift();
    },
  });

  // Check-In (Mark as Waiting)
  const handleCheckIn = async (item: LiveQueueItemDto) => {
    try {
      await api.post(`/appointments/${item.appointmentId}/check-in`);
      await fetchLiveQueue();
    } catch (err: any) {
      alert(err.message || 'فشل تسجيل وصول المريض');
    }
  };

  // Toggle Urgent
  const handleToggleUrgent = async (item: LiveQueueItemDto) => {
    try {
      await api.post(`/appointments/${item.appointmentId}/toggle-urgent`);
      await fetchLiveQueue();
    } catch (err: any) {
      alert(err.message || 'فشل تعديل حالة الاستعجال');
    }
  };

  // Skip Patient
  const handleSkip = async (item: LiveQueueItemDto) => {
    if (!window.confirm('هل أنت متأكد من تخطي هذا المريض مؤقتاً؟')) return;
    try {
      await api.post(`/queue/${item.appointmentId}/skip`);
      await fetchLiveQueue();
    } catch (err: any) {
      alert(err.message || 'فشل تخطي المريض');
    }
  };

  // Recall Patient
  const handleRecall = async (item: LiveQueueItemDto) => {
    try {
      await api.post(`/queue/${item.appointmentId}/recall`);
      await fetchLiveQueue();
    } catch (err: any) {
      alert(err.message || 'فشل إعادة نداء المريض');
    }
  };

  // Settle invoice remaining payment
  const handleSettle = async (item: LiveQueueItemDto) => {
    try {
      const receipt = await api.post<ThermalReceiptDto>(`/invoices/${item.appointmentId}/settle`);
      if (receipt) {
        setActiveReceipt(receipt);
        await printService.printReceipt(receipt);
      }
      await fetchLiveQueue();
      await fetchCurrentShift();
    } catch (err: any) {
      alert(err.message || 'فشل تسوية الفاتورة');
    }
  };

  // Print thermal receipt via unified printService
  const handlePrintActiveReceipt = async () => {
    if (!activeReceipt) return;
    setIsPrintingReceipt(true);
    try {
      await printService.printReceipt(activeReceipt);
    } catch (err) {
      console.error('Failed to print thermal receipt:', err);
    } finally {
      setIsPrintingReceipt(false);
    }
  };

  // Open viewer modal
  const handleOpenViewer = (attachmentId: number, compareAttachmentId?: number) => {
    setViewerAttachmentId(attachmentId);
    setViewerCompareId(compareAttachmentId);
    setIsViewerModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white" dir="rtl">
      {/* Top Cockpit Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
            <Stethoscope className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-slate-900">مكتب الاستقبال وإدارة الحجوزات</h1>
              <span className="text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-2 py-0.5">
                Reception Cockpit
              </span>
            </div>
            <p className="text-xs text-slate-500">حجز الكشوفات والاستشارات، إدارة الورديات، وطباعة الإيصالات الحرارية</p>
          </div>
        </div>

        {/* Right Header Navigation */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 border border-slate-200">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-slate-600 text-[11px]">{isConnected ? 'المزامنة متصلة' : 'جاري الاتصال...'}</span>
          </div>

          {/* Quick Attachments Drawer Access */}
          {queueItems.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const first = queueItems[0];
                setSelectedPatientId(first.patientId);
                setSelectedPatientName(first.patientName);
                setIsAttachmentsDrawerOpen(true);
              }}
              className="text-xs text-sky-800 border-sky-200 hover:bg-sky-50 gap-1.5"
              title="إدارة المستندات والمرفقات لمرضى اليوم"
            >
              <FileText className="w-3.5 h-3.5 text-sky-600" />
              <span>مرفقات المرضى</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open('/tv-queue', '_blank')}
            className="text-xs text-slate-700 hover:text-slate-900 border-slate-200"
            title="فتح شاشة صالة الانتظار في نافذة جديدة"
          >
            <Tv className="w-3.5 h-3.5 ml-1 text-slate-500" />
            شاشة الانتظار (TV)
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              fetchLiveQueue();
              fetchCurrentShift();
            }}
            title="تحديث يدوي للبيانات"
            className="text-slate-600"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          {/* User profile */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <User className="w-4 h-4 text-slate-400" />
            <div className="text-right">
              <span className="font-bold text-slate-800 block leading-tight">{user?.fullName || 'الموظف'}</span>
              <span className="text-[10px] text-sky-600 font-semibold block">موظف استقبال</span>
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
          {/* Right Panel: Search & 1-Click Booking */}
          <div className="lg:col-span-4 xl:col-span-3">
            <SearchBookingPanel
              isShiftOpen={Boolean(currentShift)}
              onAppointmentCreated={(receipt) => {
                setActiveReceipt(receipt);
                fetchLiveQueue();
                fetchCurrentShift();
                if (receipt) {
                  printService.printReceipt(receipt);
                }
              }}
              onShiftRequired={() => setIsOpenShiftModalOpen(true)}
            />
          </div>

          {/* Center Panel: Live Queue Board */}
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

          {/* Left Panel: Active Shift Drawer Ledger */}
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

      {/* Upgraded Thermal Receipt Dialog with printService */}
      {activeReceipt && (
        <Dialog
          isOpen={Boolean(activeReceipt)}
          onClose={() => setActiveReceipt(null)}
          title="إيصال سداد - كشف العيادة"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <ThermalReceiptTemplate receipt={activeReceipt} />

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 print:hidden">
              <Button variant="outline" size="sm" onClick={() => setActiveReceipt(null)}>
                إغلاق
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handlePrintActiveReceipt}
                disabled={isPrintingReceipt}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>{isPrintingReceipt ? 'جاري الطباعة...' : 'طباعة الإيصال (80mm)'}</span>
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Attachments Drawer */}
      <PatientAttachmentsDrawer
        isOpen={isAttachmentsDrawerOpen}
        onClose={() => setIsAttachmentsDrawerOpen(false)}
        patientId={selectedPatientId}
        patientName={selectedPatientName}
        onOpenViewer={handleOpenViewer}
      />

      {/* Attachment Viewer Modal */}
      <AttachmentViewerModal
        isOpen={isViewerModalOpen}
        onClose={() => setIsViewerModalOpen(false)}
        patientName={selectedPatientName}
        attachments={[]}
        initialAttachmentId={viewerAttachmentId}
        initialCompareAttachmentId={viewerCompareId}
      />
    </div>
  );
}

export default ReceptionistCockpit;
