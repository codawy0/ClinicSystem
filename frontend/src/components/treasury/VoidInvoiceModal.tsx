import React, { useState, useEffect } from 'react';
import { Ban, AlertCircle, AlertTriangle } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { formatEgp } from '../../lib/currency';
import { InvoiceListItemDto, InvoiceDetailDto } from '../../types/treasury';
import { treasuryService } from '../../services/treasuryService';
import { ApiException, authStorage } from '../../lib/api';

interface VoidInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceListItemDto | null;
  onInvoiceVoided: (updatedInvoice: InvoiceDetailDto) => void;
}

export function VoidInvoiceModal({
  isOpen,
  onClose,
  invoice,
  onInvoiceVoided,
}: VoidInvoiceModalProps) {
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const currentUser = authStorage.getUser();
  const isAuthorized = currentUser?.role === 'Doctor' || currentUser?.role === 'Admin';

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError(null);
    }
  }, [isOpen]);

  if (!invoice) return null;

  const isValidReason = reason.trim().length >= 4;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorized) {
      setError('إلغاء الفواتير مقتصر فقط على الطبيب أو المدير الإداري (Admin/Doctor)');
      return;
    }
    if (!isValidReason) {
      setError('يرجى كتابة سبب إداري واضح للإلغاء (4 أحرف على الأقل)');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const updated = await treasuryService.voidInvoice(invoice.id, {
        reason: reason.trim(),
        version: invoice.version,
      });

      onInvoiceVoided(updated);
      onClose();
    } catch (err: any) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError('حدث خطأ أثناء إلغاء الفاتورة. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="إلغاء الفاتورة نهائياً (Void)"
      description={`إلغاء الفاتورة #${invoice.id} - المريض: ${invoice.patientName}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Warning Banner */}
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-rose-800">تحذير أمان مالي صارم:</div>
            <div className="text-rose-700 leading-relaxed">
              إلغاء الفاتورة إجراء لا يمكن التراجع عنه. سيتم تحويل حالة الفاتورة إلى <span className="font-bold">ملغاة (Voided)</span> وإنشاء حركة عكسية تلقائية في الخزينة لجميع المبالغ المحصلة.
            </div>
          </div>
        </div>

        {/* Invoice Summary */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-600">قيمة الفاتورة الصافية:</span>
            <span className="font-semibold text-slate-800">
              <bdi dir="ltr">{formatEgp(invoice.netTotalPiastres)}</bdi>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">المبلغ المحصل فعلياً:</span>
            <span className="font-semibold text-emerald-600">
              <bdi dir="ltr">{formatEgp(invoice.paidPiastres)}</bdi>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">المتبقي غير المحصل:</span>
            <span className="font-semibold text-rose-600">
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

        {/* Void Reason Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            سبب الإلغاء (إلزامي للتدقيق المالي) *
          </label>
          <Input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: تسجيل خاطئ لمريض آخر، إلغاء الخدمة بالكامل قبل البدء..."
            required
            className="text-xs"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            تراجع
          </Button>
          <Button
            type="submit"
            variant="danger"
            size="sm"
            disabled={isSubmitting || !isValidReason || !isAuthorized}
            className="gap-1.5"
          >
            <Ban className="w-4 h-4" />
            {isSubmitting ? 'جاري الإلغاء...' : 'تأكيد إلغاء الفاتورة'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
