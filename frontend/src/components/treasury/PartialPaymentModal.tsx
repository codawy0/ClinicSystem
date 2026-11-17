import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, DollarSign } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { formatEgp, parseEgpToPiastres, piastresToEgpNumber } from '../../lib/currency';
import { PaymentMethod } from '../../types';
import { InvoiceListItemDto, InvoiceDetailDto } from '../../types/treasury';
import { treasuryService } from '../../services/treasuryService';
import { ApiException } from '../../lib/api';

interface PartialPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceListItemDto | null;
  onPaymentRecorded: (updatedInvoice: InvoiceDetailDto) => void;
}

export function PartialPaymentModal({
  isOpen,
  onClose,
  invoice,
  onPaymentRecorded,
}: PartialPaymentModalProps) {
  const [amountEgp, setAmountEgp] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invoice && isOpen) {
      // Default to remaining balance
      const remainingEgp = piastresToEgpNumber(invoice.remainingPiastres);
      setAmountEgp(remainingEgp.toString());
      setPaymentMethod('Cash');
      setReferenceNumber('');
      setNotes('');
      setError(null);
    }
  }, [invoice, isOpen]);

  if (!invoice) return null;

  const remainingEgp = piastresToEgpNumber(invoice.remainingPiastres);
  const currentPiastres = parseEgpToPiastres(amountEgp || '0');

  const isValidAmount = currentPiastres > 0 && currentPiastres <= invoice.remainingPiastres;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAmount) {
      setError(`المبلغ يجب أن يكون أكبر من 0 ولا يتجاوز المبلغ المتبقي (${formatEgp(invoice.remainingPiastres)})`);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const updated = await treasuryService.recordPayment(invoice.id, {
        amountPiastres: currentPiastres,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        version: invoice.version,
      });

      onPaymentRecorded(updated);
      onClose();
    } catch (err: any) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError('حدث خطأ أثناء تسجيل السداد. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="تسجيل سداد / قسط مالي"
      description={`فاتورة رقم #${invoice.id} - المريض: ${invoice.patientName}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Invoice Summary Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-600">إجمالي الفاتورة:</span>
            <span className="font-semibold text-slate-800">
              <bdi dir="ltr">{formatEgp(invoice.totalPiastres)}</bdi>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">المسدد سابقاً:</span>
            <span className="font-semibold text-emerald-600">
              <bdi dir="ltr">{formatEgp(invoice.paidPiastres)}</bdi>
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-200 text-sm font-bold">
            <span className="text-slate-800">المبلغ المتبقي:</span>
            <span className="text-rose-600">
              <bdi dir="ltr">{formatEgp(invoice.remainingPiastres)}</bdi>
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Amount Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            المبلغ المراد سداده (ج.م) *
          </label>
          <div className="relative">
            <Input
              type="number"
              step="any"
              min="1"
              max={remainingEgp}
              value={amountEgp}
              onChange={(e) => setAmountEgp(e.target.value)}
              placeholder="0.00"
              required
              className="text-lg font-bold pl-12"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              ج.م
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => setAmountEgp(remainingEgp.toString())}
              className="text-[11px] px-2.5 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-md border border-sky-200 font-medium"
            >
              كامل المتبقي ({remainingEgp} ج.م)
            </button>
            {remainingEgp > 50 && (
              <button
                type="button"
                onClick={() => setAmountEgp((remainingEgp / 2).toFixed(2))}
                className="text-[11px] px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md border border-slate-200 font-medium"
              >
                النصف ({(remainingEgp / 2).toFixed(2)} ج.م)
              </button>
            )}
          </div>
        </div>

        {/* Payment Method Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            طريقة الدفع *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'Cash', label: 'نقدي (كاش)' },
                { id: 'Instapay', label: 'انستاباي (Instapay)' },
                { id: 'VodafoneCash', label: 'فودافون كاش' },
                { id: 'Card', label: 'بطاقة دفع (Card)' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethod(m.id)}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition-all ${
                  paymentMethod === m.id
                    ? 'border-sky-500 bg-sky-50/70 text-sky-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span>{m.label}</span>
                {paymentMethod === m.id && <CheckCircle className="w-3.5 h-3.5 text-sky-600" />}
              </button>
            ))}
          </div>
        </div>

        {/* Reference Number for Digital Payments */}
        {paymentMethod !== 'Cash' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              رقم العملية / المرجع الإلكتروني
            </label>
            <Input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="مثال: رقم تحويل انستاباي أو إيصال فودافون كاش"
              className="text-xs"
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            ملاحظات إضافية (اختياري)
          </label>
          <Input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات حول الدفعة..."
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
            variant="primary"
            size="sm"
            disabled={isSubmitting || !isValidAmount}
            className="gap-1.5"
          >
            <DollarSign className="w-4 h-4" />
            {isSubmitting ? 'جاري التسجيل...' : 'تأكيد تسجيل السداد'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
