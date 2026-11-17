import { ShieldCheck, Lock, Unlock, DollarSign, LogOut } from 'lucide-react';
import { ShiftSummaryDto } from '../../types';
import { formatEgp } from '../../lib/currency';
import { Button } from '../ui/button';

interface ShiftGuardBannerProps {
  currentShift: ShiftSummaryDto | null;
  onOpenShiftClick: () => void;
  onCloseShiftClick: () => void;
  onExpenseClick: () => void;
  isLoading?: boolean;
}

export function ShiftGuardBanner({
  currentShift,
  onOpenShiftClick,
  onCloseShiftClick,
  onExpenseClick,
  isLoading,
}: ShiftGuardBannerProps) {
  if (isLoading) {
    return (
      <div className="w-full bg-slate-100 p-3 rounded-xl border border-slate-200 animate-pulse flex items-center justify-between text-xs text-slate-500">
        <span>جاري التحقق من حالة الوردية...</span>
      </div>
    );
  }

  if (!currentShift) {
    return (
      <div className="w-full bg-amber-500/10 border-2 border-amber-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-md">
            <Lock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-900 text-sm">حارس الوردية مُفعّل — لا توجد وردية مفتوحة</span>
              <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold">حجز مُعطّل</span>
            </div>
            <p className="text-xs text-amber-800/90 mt-0.5">
              تم قفل إجراءات الحجز والتحصيل وإصدار الإيصالات لحين استلام العهدة النقدية وفتح الوردية.
            </p>
          </div>
        </div>

        <Button
          onClick={onOpenShiftClick}
          variant="primary"
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 shadow-md flex-shrink-0"
        >
          <Unlock className="w-4 h-4 ml-1" />
          فتح وردية جديدة وتفعيل الحجز
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-xs">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-950 text-xs">الوردية الحالية مفتوحة (رقم #{currentShift.id})</span>
            <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
              تاريخ العمل: {currentShift.businessDate}
            </span>
          </div>
          <div className="text-[11px] text-emerald-800 mt-0.5 flex items-center gap-3">
            <span>الرصيد الافتتاحي: <strong>{formatEgp(currentShift.openingBalancePiastres)}</strong></span>
            <span>•</span>
            <span>المتوقع بالدرج: <strong>{formatEgp(currentShift.expectedClosingCashPiastres)}</strong></span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={onExpenseClick}
          variant="outline"
          size="sm"
          className="bg-white hover:bg-slate-50 border-emerald-300 text-emerald-900 text-xs py-1.5"
        >
          <DollarSign className="w-3.5 h-3.5 ml-1 text-emerald-600" />
          تسجيل مصروف نثري
        </Button>

        <Button
          onClick={onCloseShiftClick}
          variant="danger"
          size="sm"
          className="bg-rose-600 hover:bg-rose-700 text-xs py-1.5"
        >
          <LogOut className="w-3.5 h-3.5 ml-1" />
          جرد وإغلاق الوردية
        </Button>
      </div>
    </div>
  );
}
