import { Wallet, ArrowDownRight, ArrowUpRight, CreditCard, Smartphone, Send, Lock, DollarSign } from 'lucide-react';
import { ShiftSummaryDto } from '../../types';
import { formatEgp } from '../../lib/currency';
import { Button } from '../ui/button';

interface ShiftDrawerLedgerProps {
  currentShift: ShiftSummaryDto | null;
  onOpenExpenseModal: () => void;
  onOpenCloseShiftModal: () => void;
}

export function ShiftDrawerLedger({
  currentShift,
  onOpenExpenseModal,
  onOpenCloseShiftModal,
}: ShiftDrawerLedgerProps) {
  if (!currentShift) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col items-center justify-center text-center h-full min-h-[300px]">
        <div className="p-3 bg-slate-100 rounded-full text-slate-400 mb-3">
          <Lock className="w-8 h-8" />
        </div>
        <h4 className="font-bold text-slate-800 text-sm">الدرج مقفل</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
          يرجى فتح وردية جديدة لعرض حركة الدرج والعمليات المالية.
        </p>
      </div>
    );
  }

  const instapay = currentShift.totalInstapayPiastres ?? currentShift.instapayTotalPiastres ?? 0;
  const vodafoneCash = currentShift.totalVodafoneCashPiastres ?? currentShift.vodafoneCashTotalPiastres ?? 0;
  const card = currentShift.totalCardPiastres ?? currentShift.cardTotalPiastres ?? 0;
  const nonCashTotalPiastres = currentShift.totalNonCashPiastres ?? (instapay + vodafoneCash + card);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-xs">حركة الخزينة والدرج</h3>
            <span className="text-[10px] text-slate-500">وردية #{currentShift.shiftId || currentShift.id}</span>
          </div>
        </div>
        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
          نشطة
        </span>
      </div>

      {/* Main Cash Expected in Drawer */}
      <div className="p-3.5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl text-white shadow-sm space-y-1">
        <span className="text-[11px] text-slate-300 font-medium block">
          النقدية المحسوبة حالياً بالدرج (Cash)
        </span>
        <div className="text-2xl font-extrabold text-white tracking-wide">
          {formatEgp(currentShift.expectedClosingCashPiastres)}
        </div>
        <div className="text-[10px] text-slate-400 pt-1 flex justify-between">
          <span>افتتاحي: {formatEgp(currentShift.openingBalancePiastres)}</span>
          <span>صافي: +{formatEgp(currentShift.cashPaymentsPiastres - currentShift.cashExpensesPiastres)}</span>
        </div>
      </div>

      {/* Cash Flow Breakdown */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-2 text-slate-600">
            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
            <span>مقبوضات نقدية (+)</span>
          </div>
          <span className="font-bold text-emerald-700 font-mono">
            +{formatEgp(currentShift.cashPaymentsPiastres)}
          </span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-2 text-slate-600">
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
            <span>مصروفات نثرية (-)</span>
          </div>
          <span className="font-bold text-rose-700 font-mono">
            -{formatEgp(currentShift.cashExpensesPiastres)}
          </span>
        </div>
      </div>

      {/* Non-Cash Channels */}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
          <span>المدفوعات الإلكترونية (غير نقدية):</span>
          <span className="font-mono text-slate-800 font-bold">{formatEgp(nonCashTotalPiastres)}</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
          <div className="p-2 bg-indigo-50/60 border border-indigo-100 rounded-lg text-center">
            <Send className="w-3.5 h-3.5 text-indigo-600 mx-auto mb-1" />
            <span className="text-slate-500 block text-[10px]">إنستاباي</span>
            <span className="font-bold text-indigo-900 block font-mono text-[11px]">
              {formatEgp(instapay)}
            </span>
          </div>

          <div className="p-2 bg-rose-50/60 border border-rose-100 rounded-lg text-center">
            <Smartphone className="w-3.5 h-3.5 text-rose-600 mx-auto mb-1" />
            <span className="text-slate-500 block text-[10px]">فودافون كاش</span>
            <span className="font-bold text-rose-900 block font-mono text-[11px]">
              {formatEgp(vodafoneCash)}
            </span>
          </div>

          <div className="p-2 bg-sky-50/60 border border-sky-100 rounded-lg text-center">
            <CreditCard className="w-3.5 h-3.5 text-sky-600 mx-auto mb-1" />
            <span className="text-slate-500 block text-[10px]">بطاقة بنكية</span>
            <span className="font-bold text-sky-900 block font-mono text-[11px]">
              {formatEgp(card)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <Button
          onClick={onOpenExpenseModal}
          variant="outline"
          size="sm"
          className="w-full justify-center text-xs py-2 bg-white hover:bg-slate-50 border-slate-300 text-slate-700"
        >
          <DollarSign className="w-3.5 h-3.5 ml-1 text-slate-600" />
          تسجيل مصروف نثري
        </Button>

        <Button
          onClick={onOpenCloseShiftModal}
          variant="danger"
          size="sm"
          className="w-full justify-center text-xs py-2 bg-rose-600 hover:bg-rose-700"
        >
          جرد وإغلاق الوردية
        </Button>
      </div>
    </div>
  );
}
