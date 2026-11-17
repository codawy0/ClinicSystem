import React, { useState } from 'react';
import { Unlock, AlertCircle } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { parseEgpToPiastres } from '../../lib/currency';
import { api, ApiException } from '../../lib/api';
import { ShiftSummaryDto } from '../../types';

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShiftOpened: (shift: ShiftSummaryDto) => void;
}

export function OpenShiftModal({ isOpen, onClose, onShiftOpened }: OpenShiftModalProps) {
  const [openingBalanceEgp, setOpeningBalanceEgp] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const balancePiastres = parseEgpToPiastres(openingBalanceEgp);
      const newShift = await api.post<ShiftSummaryDto>('/shifts/open', {
        openingBalancePiastres: balancePiastres,
        notes: notes.trim() || undefined,
      });

      onShiftOpened(newShift);
      onClose();
    } catch (err: any) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError('حدث خطأ أثناء فتح الوردية. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="استلام العهدة وفتح وردية جديدة"
      description="يرجى إدخال الرصيد النقدي المتواجد في درج الخزينة عند بدء الوردية."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <Input
            id="openingBalance"
            label="الرصيد الافتتاحي بالدرج (جنيه مصري)"
            type="number"
            step="0.5"
            min="0"
            value={openingBalanceEgp}
            onChange={(e) => setOpeningBalanceEgp(e.target.value)}
            required
            autoFocus
            className="text-lg font-bold text-center tracking-wide"
            placeholder="0.00"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            * يتم حفظ وتدقيق جميع المبالغ بالقرش تلقائياً لتفادي أي فروقات تقريب.
          </p>
        </div>

        <div>
          <label htmlFor="notes" className="block text-xs font-semibold text-slate-700 mb-1">
            ملاحظات الاستلام (اختياري)
          </label>
          <textarea
            id="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="مثال: استلام فكة من وردية الصباح..."
            className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            <Unlock className="w-4 h-4 ml-1" />
            {isSubmitting ? 'جاري الفتح...' : 'فتح الوردية وتفعيل النظام'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
