import React, { useState, useEffect } from 'react';
import { RotateCcw, AlertCircle, AlertTriangle } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { formatEgp, parseEgpToPiastres, piastresToEgpNumber } from '../../lib/currency';
import { PaymentMethod } from '../../types';
import { InvoiceListItemDto, InvoiceDetailDto } from '../../types/treasury';
import { treasuryService } from '../../services/treasuryService';
import { ApiException } from '../../lib/api';

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceListItemDto | null;
  onRefundProcessed: (result: { transactionId: number; newBalancePiastres: number; invoice: InvoiceDetailDto }) => void;
}

export function RefundModal({
  isOpen,
  onClose,
  invoice,
  onRefundProcessed,
}: RefundModalProps) {
  const [amountEgp, setAmountEgp] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const maxRefundablePiastres = invoice
    ? Math.max(0, invoice.paidPiastres - (invoice.refundedPiastres || 0))
    : 0;
  const maxRefundableEgp = piastresToEgpNumber(maxRefundablePiastres);

  useEffect(() => {
    if (invoice && isOpen) {
      setAmountEgp(maxRefundableEgp.toString());
      setReason('');
      setPaymentMethod('Cash');
      setError(null);
    }
  }, [invoice, isOpen, maxRefundableEgp]);

  if (!invoice) return null;

  const currentPiastres = parseEgpToPiastres(amountEgp || '0');
  const isValidAmount = currentPiastres > 0 && currentPiastres <= maxRefundablePiastres;
  const isValidReason = reason.trim().length >= 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAmount) {
      setError(`المبلغ يجب أن يكون أكبر من 0 ولا يتجاوز المبلغ القابل للاسترجاع (${formatEgp(maxRefundablePiastres)})`);
      return;
    }
    if (!isValidReason) {
      setError('يرجى توضيح سبب الاسترجاع بشكل كافٍ (3 أحرف على الأقل)');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await treasuryService.refundInvoice(invoice.id, {
        amountPiastres: currentPiastres,
        reason: reason.trim(),
        paymentMethod,
        version: invoice.version,
      });

      onRefundProcessed(result);
      onClose();
    } catch (err: any) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError('حدث خطأ أثناء معالجة الاسترجاع. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="استرجاع مالي (Refund)"
      description={`استرجاع مالي للفاتورة #${invoice.id} - المريض: ${invoice.patientName}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Warning / Invariant Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">قيد الأمان المالي الصارم:</div>
            <div className="text-amber-700 mt-0.5">
              لا يمكن استرجاع مبلغ أكبر من المسدد فعلياً. سيتم تسجيل حركة استرجاع مالية وخصمها من الخزينة.
            </div>
          </div>
        </div>

        {/* Invoice Summary Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-600">إجمالي المسدد:</span>
            <span className="font-semibold text-emerald-600">
              <bdi dir="ltr">{formatEgp(invoice.paidPiastres)}</bdi>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">المسترجع سابقاً:</span>
            <span className="font-semibold text-rose-600">
              <bdi dir="ltr">{formatEgp(invoice.refundedPiastres || 0)}</bdi>
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-200 font-bold">
            <span className="text-slate-800">الحد الأقصى المتاح للاسترجاع:</span>
            <span className="text-sky-700">
              <bdi dir="ltr">{formatEgp(maxRefundablePiastres)}</bdi>
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Refund Amount */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            المبلغ المسترجع (ج.م) *
          </label>
          <div className="relative">
            <Input
              type="number"
              step="any"
              min="1"
              max={maxRefundableEgp}
              value={amountEgp}
              onChange={(e) => setAmountEgp(e.target.value)}
              placeholder="0.00"
              required
              className="text-lg font-bold pl-12 text-rose-700"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              ج.م
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => setAmountEgp(maxRefundableEgp.toString())}
              className="text-[11px] px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-md border border-rose-200 font-medium"
            >
              استرجاع كامل المبلغ ({maxRefundableEgp} ج.م)
            </button>
          </div>
        </div>

        {/* Refund Payment Method */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            طريقة رد المبلغ *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'Cash', label: 'نقداً من الدرج (كاش)' },
                { id: 'Instapay', label: 'تحويل انستاباي' },
                { id: 'VodafoneCash', label: 'فودافون كاش' },
                { id: 'Card', label: 'رد على البطاقة' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethod(m.id)}
                className={`p-2 rounded-lg border text-xs font-medium text-right transition-all ${
                  paymentMethod === m.id
                    ? 'border-rose-500 bg-rose-50/70 text-rose-900 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mandatory Refund Reason */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            سبب الاسترجاع (إلزامي للتدقيق المالي) *
          </label>
          <Input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: إلغاء الكشف لعدم حضور الطبيب، خطأ في الحساب..."
            required
            className="text-xs"
          />
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button
            type="submit"
            variant="danger"
            size="sm"
            disabled={isSubmitting || !isValidAmount || !isValidReason || maxRefundablePiastres <= 0}
            className="gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            {isSubmitting ? 'جاري الاسترجاع...' : 'تأكيد الاسترجاع المالي'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
