import { useState, useEffect } from 'react';
import {
  FolderOpen,
  Search,
  Pill,
  FlaskConical,
  Trash2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { PrescriptionTemplateDto } from '../../types';
import { doctorService } from '../../services/doctorService';

interface PrescriptionTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (template: PrescriptionTemplateDto) => void;
}

export function PrescriptionTemplateModal({
  isOpen,
  onClose,
  onApplyTemplate,
}: PrescriptionTemplateModalProps) {
  const [templates, setTemplates] = useState<PrescriptionTemplateDto[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Load templates on modal open
  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    doctorService
      .getTemplates()
      .then((data) => setTemplates(data || []))
      .catch((err) => console.warn('Failed to load prescription templates:', err))
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  // Filter templates
  const filteredTemplates = templates.filter((tpl) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      tpl.templateName.toLowerCase().includes(q) ||
      (tpl.defaultDiagnosis && tpl.defaultDiagnosis.toLowerCase().includes(q))
    );
  });

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm('هل أنت متأكد من حذف هذا القالب؟')) return;

    setDeletingId(id);
    try {
      await doctorService.deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Failed to delete template:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="قوالب الروشتات الجاهزة (Prescription Protocols)"
      description="اختر قالباً جاهزاً لتطبيقه بنقرة واحدة على الروشتة الحالية"
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم القالب أو التشخيص..."
            className="w-full text-sm rounded-xl border border-slate-300 pr-9 pl-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Templates List */}
        {isLoading ? (
          <div className="py-12 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-sky-600 mb-2" />
            <p className="text-sm font-medium">جاري تحميل القوالب...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="py-10 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-1">
            <FolderOpen className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
            <p className="text-sm font-medium text-slate-600">لا توجد قوالب مطابقة</p>
            <p className="text-xs text-slate-400">
              يمكنك حفظ الروشتة الحالية كقالب جديد في أي وقت من خلال زر "حفظ كقالب جديد".
            </p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
            {filteredTemplates.map((template) => {
              const itemCount = template.items?.length || 0;
              const labCount = template.labRadiologyOrders?.length || 0;

              return (
                <div
                  key={template.id}
                  className="border border-slate-200 rounded-xl p-3.5 hover:border-sky-300 hover:bg-sky-50/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm sm:text-base">
                        {template.templateName}
                      </span>
                      {template.defaultDiagnosis && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {template.defaultDiagnosis}
                        </span>
                      )}
                    </div>

                    {/* Previews of Items */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                        <Pill className="w-3 h-3 text-sky-600" />
                        {itemCount} {itemCount === 1 ? 'دواء' : 'أدوية'}
                      </span>

                      {labCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                          <FlaskConical className="w-3 h-3 text-indigo-600" />
                          {labCount} {labCount === 1 ? 'فحص' : 'فحوصات'}
                        </span>
                      )}

                      {/* Display first 3 drugs as preview chips */}
                      {template.items?.slice(0, 3).map((it, idx) => (
                        <span
                          key={idx}
                          className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px]"
                        >
                          <bdi dir="ltr">{it.drugName}</bdi>
                        </span>
                      ))}
                      {itemCount > 3 && (
                        <span className="text-[11px] text-slate-400">
                          +{itemCount - 3} أخرى
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        onApplyTemplate(template);
                        onClose();
                      }}
                      className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>تطبيق القالب</span>
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDelete(e, template.id)}
                      disabled={deletingId === template.id}
                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 h-auto"
                      title="حذف القالب"
                    >
                      {deletingId === template.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" size="sm" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
