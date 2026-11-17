import React, { useState } from 'react';
import { DollarSign, AlertCircle } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { parseEgpToPiastres } from '../../lib/currency';
import { api, ApiException } from '../../lib/api';

interface PettyExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId: number;
  onExpenseRecorded: () => void;
}

export function PettyExpenseModal({ isOpen, onClose, shiftId, onExpenseRecorded }: PettyExpenseModalProps) {
  const [amountEgp, setAmountEgp] = useState<string>('');
  const [category, setCategory] = useState<string>('نثريات عامة');
  const [description, setDescription] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountEgp || parseFloat(amountEgp) <= 0) {
      setError('يرجى إدخال مبلغ صحيح للمصروف');
      return;
    }
    if (!description.trim()) {
      setError('يرجى تحديد سبب/بند المصروف');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const amountPiastres = parseEgpToPiastres(amountEgp);
      await api.post('/shifts/expense', {
        shiftId,
        amountPiastres,
        category: category || 'نثريات عامة',
        description: description.trim(),
        recipient: recipient.trim() || undefined,
      });

      onExpenseRecorded();
      onClose();
      setAmountEgp('');
      setCategory('نثريات عامة');
      setDescription('');
      setRecipient('');
    } catch (err: any) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError('حدث خطأ أثناء تسجيل المصروف. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="تسجيل مصروف نثري من الدرج"
      description="سيتم خصم هذا المبلغ فوراً من النقدية المتوقعة بالدرج مع تسجيل إيصال صرف."
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
            id="expenseAmount"
            label="مبلغ المصروف (جنيه مصري)"
            type="number"
            step="0.5"
            min="0.5"
            value={amountEgp}
            onChange={(e) => setAmountEgp(e.target.value)}
            required
            autoFocus
            className="text-lg font-bold text-center tracking-wide"
            placeholder="0.00"
          />
        </div>

        <div>
          <label htmlFor="expenseCategory" className="block text-xs font-semibold text-slate-700 mb-1">
            تصنيف المصروف
          </label>
          <select
            id="expenseCategory"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="نثريات عامة">نثريات عامة</option>
            <option value="أدوات ومستلزمات">أدوات ومستلزمات</option>
            <option value="ضيافة ونظافة">ضيافة ونظافة</option>
            <option value="صيانة سريعة">صيانة سريعة</option>
            <option value="أخرى">أخرى</option>
          </select>
        </div>

        <div>
          <Input
            id="expenseDesc"
            label="سبب / بند الصرف"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="مثال: شراء شاي وسكر للعيادة / نظافة / أدوات مكتبية..."
          />
        </div>

        <div>
          <Input
            id="expenseRecipient"
            label="اسم المستلم (اختياري)"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="اسم الشخص أو العامل الذي استلم النقدية"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            <DollarSign className="w-4 h-4 ml-1" />
            {isSubmitting ? 'جاري التسجيل...' : 'صرف المبلغ وتحديث الدرج'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
