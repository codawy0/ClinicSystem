import React, { useState } from 'react';
import { LogOut, AlertCircle, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { formatEgp, parseEgpToPiastres } from '../../lib/currency';
import { api, ApiException } from '../../lib/api';
import { ShiftSummaryDto } from '../../types';

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentShift: ShiftSummaryDto | null;
  onShiftClosed: () => void;
}

export function CloseShiftModal({ isOpen, onClose, currentShift, onShiftClosed }: CloseShiftModalProps) {
  const [actualCashEgp, setActualCashEgp] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentShift) return null;

  const actualPiastres = parseEgpToPiastres(actualCashEgp);
  const expectedPiastres = currentShift.expectedClosingCashPiastres;
  const differencePiastres = actualCashEgp === '' ? 0 : actualPiastres - expectedPiastres;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actualCashEgp === '') {
      setError('يرجى إدخال المبلغ الفعلي الموجود بالدرج بعد الجرد');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await api.post('/shifts/close', {
        shiftId: currentShift.shiftId || currentShift.id,
        actualClosingCashPiastres: actualPiastres,
        closingNotes: closingNotes.trim() || undefined,
        version: currentShift.version,
      });

      onShiftClosed();
      onClose();
    } catch (err: any) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError('حدث خطأ أثناء إغلاق الوردية. يرجى إعادة المحاولة.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="جرد الخزينة وإغلاق الوردية"
      description={`الوردية رقم #${currentShift.id} - تاريخ العمل: ${currentShift.businessDate}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Ledger Breakdown Cards */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-slate-500 block">الرصيد الافتتاحي:</span>
            <strong className="text-slate-800 text-sm">{formatEgp(currentShift.openingBalancePiastres)}</strong>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-slate-500 block">مقبوضات نقدية:</span>
            <strong className="text-emerald-700 text-sm">+{formatEgp(currentShift.cashPaymentsPiastres)}</strong>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-slate-500 block">مصروفات نثرية:</span>
            <strong className="text-rose-700 text-sm">-{formatEgp(currentShift.cashExpensesPiastres)}</strong>
          </div>
          <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-lg">
            <span className="text-sky-700 block font-semibold">المبلغ النقدي المحسوب بالدرج:</span>
            <strong className="text-sky-900 text-sm">{formatEgp(expectedPiastres)}</strong>
          </div>
        </div>

        {/* Actual Cash Input */}
        <div>
          <Input
            id="actualCash"
            label="المبلغ الفعلي بالدرج بعد العد (جنيه مصري)"
            type="number"
            step="0.5"
            min="0"
            value={actualCashEgp}
            onChange={(e) => setActualCashEgp(e.target.value)}
            required
            autoFocus
            className="text-lg font-bold text-center tracking-wide"
            placeholder="0.00"
          />
        </div>

        {/* Difference Indicator */}
        {actualCashEgp !== '' && (
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
              differencePiastres === 0
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : differencePiastres < 0
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-blue-50 border-blue-300 text-blue-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {differencePiastres === 0 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : differencePiastres < 0 ? (
                <TrendingDown className="w-5 h-5 text-rose-600" />
              ) : (
                <TrendingUp className="w-5 h-5 text-blue-600" />
              )}
              <span>
                {differencePiastres === 0
                  ? 'الخزينة مطابقة تماماً للمحسوب'
                  : differencePiastres < 0
                  ? 'يوجد عجز نقدي في الدرج'
                  : 'يوجد زيادة نقدية في الدرج'}
              </span>
            </div>
            <span className="text-sm font-bold dir-ltr">
              {formatEgp(Math.abs(differencePiastres))}
            </span>
          </div>
        )}

        {/* Notes */}
        <div>
          <label htmlFor="closingNotes" className="block text-xs font-semibold text-slate-700 mb-1">
            ملاحظات الإغلاق والتسوية (اختياري)
          </label>
          <textarea
            id="closingNotes"
            rows={2}
            value={closingNotes}
            onChange={(e) => setClosingNotes(e.target.value)}
            placeholder="مثال: تم تسليم النقدية لمدير العيادة بالكامل..."
            className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button type="submit" variant="danger" disabled={isSubmitting}>
            <LogOut className="w-4 h-4 ml-1" />
            {isSubmitting ? 'جاري الإغلاق...' : 'تأكيد الجرد وإغلاق الوردية'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
