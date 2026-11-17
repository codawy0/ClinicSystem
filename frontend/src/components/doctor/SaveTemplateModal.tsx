import { useState, useEffect } from 'react';
import { Save, Pill, FlaskConical, Loader2 } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import {
  PrescriptionItemInputDto,
  ClinicalRequestInputDto,
  CreatePrescriptionTemplateRequestDto,
} from '../../types';
import { doctorService } from '../../services/doctorService';

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDiagnosis: string;
  currentItems: PrescriptionItemInputDto[];
  currentOrders: ClinicalRequestInputDto[];
  onSaved: () => void;
}

export function SaveTemplateModal({
  isOpen,
  onClose,
  currentDiagnosis,
  currentItems,
  currentOrders,
  onSaved,
}: SaveTemplateModalProps) {
  const [templateName, setTemplateName] = useState('');
  const [defaultDiagnosis, setDefaultDiagnosis] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTemplateName('');
      setDefaultDiagnosis(currentDiagnosis || '');
      setErrorMsg('');
    }
  }, [isOpen, currentDiagnosis]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) {
      setErrorMsg('يرجى إدخال اسم للقالب');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload: CreatePrescriptionTemplateRequestDto = {
        templateName: templateName.trim(),
        defaultDiagnosis: defaultDiagnosis.trim() || undefined,
        items: currentItems.map((item) => ({
          drugId: item.drugId || null,
          drugName: item.drugName,
          activeIngredient: item.activeIngredient || null,
          dosage: item.dosage,
          form: item.form || null,
          route: item.route || null,
          timing: item.timing,
          duration: item.duration,
          instructions: item.instructions || null,
        })),
        labRadiologyOrders: currentOrders.map((o) => ({
          requestType: o.requestType,
          catalogCode: o.catalogCode || null,
          nameAr: o.nameAr,
          nameEn: o.nameEn || null,
          notes: o.notes || null,
        })),
      };

      await doctorService.createTemplate(payload);
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to create prescription template:', err);
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ القالب');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="حفظ الروشتة كقالب جديد"
      description="احفظ بروتوكول العلاج الحالي لإعادة استخدامه بنقرة واحدة لاحقاً"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            اسم القالب (Template Name) *
          </label>
          <input
            type="text"
            required
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="مثال: بروتوكول النزلة الشعبية الحادة..."
            className="w-full text-sm font-semibold rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            التشخيص التلقائي المقترن
          </label>
          <input
            type="text"
            value={defaultDiagnosis}
            onChange={(e) => setDefaultDiagnosis(e.target.value)}
            placeholder="مثال: Acute Bronchitis..."
            className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Summary of Items */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
          <span className="font-bold text-slate-700 block">محتويات القالب:</span>
          <div className="flex items-center gap-4 text-slate-600">
            <span className="flex items-center gap-1.5 font-medium">
              <Pill className="w-3.5 h-3.5 text-sky-600" />
              {currentItems.length} {currentItems.length === 1 ? 'دواء' : 'أدوية'}
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <FlaskConical className="w-3.5 h-3.5 text-indigo-600" />
              {currentOrders.length} {currentOrders.length === 1 ? 'فحص / تحليل' : 'فحوصات'}
            </span>
          </div>

          <div className="flex flex-wrap gap-1 pt-1 max-h-24 overflow-y-auto">
            {currentItems.map((item, idx) => (
              <span
                key={idx}
                className="bg-white border border-slate-200 text-slate-800 text-[11px] px-2 py-0.5 rounded-md font-mono"
              >
                <bdi dir="ltr">{item.drugName}</bdi>
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting || !templateName.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>حفظ القالب</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
