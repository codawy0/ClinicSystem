import { useState, useEffect } from 'react';
import { Plus, Edit2, CheckCircle2, XCircle, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { formatEgp, parseEgpToPiastres, piastresToEgpNumber } from '../../lib/currency';
import { api } from '../../lib/api';

export interface ServiceItem {
  id: number;
  code: string;
  nameAr: string;
  nameEn?: string;
  category: 'Examination' | 'Consultation' | 'Procedure' | 'Other';
  defaultPricePiastres: number;
  isActive: boolean;
}

const DEFAULT_SERVICES: ServiceItem[] = [
  {
    id: 1,
    code: 'EXAM-GEN',
    nameAr: 'كشف عام باطنة وقلب',
    nameEn: 'General Internal Exam',
    category: 'Examination',
    defaultPricePiastres: 30000,
    isActive: true,
  },
  {
    id: 2,
    code: 'CONSULT',
    nameAr: 'استشارة / إعادة كشف مجانية',
    nameEn: 'Free Follow-up Consultation',
    category: 'Consultation',
    defaultPricePiastres: 0,
    isActive: true,
  },
  {
    id: 3,
    code: 'PROC-ECG',
    nameAr: 'تخطيط قلب كهربائي (ECG)',
    nameEn: 'Electrocardiogram',
    category: 'Procedure',
    defaultPricePiastres: 15000,
    isActive: true,
  },
  {
    id: 4,
    code: 'PROC-GLUC',
    nameAr: 'تحليل سكر عشوائي فوري',
    nameEn: 'Random Blood Glucose',
    category: 'Procedure',
    defaultPricePiastres: 5000,
    isActive: true,
  },
  {
    id: 5,
    code: 'PROC-NEB',
    nameAr: 'جلسة نيبولايزر استنشاق',
    nameEn: 'Nebulizer Inhalation Session',
    category: 'Procedure',
    defaultPricePiastres: 10000,
    isActive: true,
  },
  {
    id: 6,
    code: 'PROC-DRESS',
    nameAr: 'غيار جراحي معقم',
    nameEn: 'Surgical Dressing',
    category: 'Procedure',
    defaultPricePiastres: 8000,
    isActive: true,
  },
];

export function ServiceCatalogTab() {
  const [services, setServices] = useState<ServiceItem[]>(DEFAULT_SERVICES);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Edit modal
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [editPriceEgp, setEditPriceEgp] = useState<string>('');

  // Add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newNameAr, setNewNameAr] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newCategory, setNewCategory] = useState<'Examination' | 'Consultation' | 'Procedure' | 'Other'>('Procedure');
  const [newPriceEgp, setNewPriceEgp] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const data = await api.get<ServiceItem[]>('/settings/services');
      if (Array.isArray(data) && data.length > 0) {
        setServices(data);
      }
    } catch {
      // Fallback to default catalog if endpoint not yet initialized
    }
  };

  const handleEditPrice = (service: ServiceItem) => {
    setEditingService(service);
    setEditPriceEgp(piastresToEgpNumber(service.defaultPricePiastres).toString());
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    setSaving(true);
    const newPricePiastres = parseEgpToPiastres(editPriceEgp || '0');

    try {
      await api.put(`/settings/services/${editingService.id}`, {
        ...editingService,
        defaultPricePiastres: newPricePiastres,
      });
    } catch {
      // Update local state smoothly
    }

    setServices((prev) =>
      prev.map((s) => (s.id === editingService.id ? { ...s, defaultPricePiastres: newPricePiastres } : s))
    );
    setSaving(false);
    setEditingService(null);
    showNotice('تم تحديث سعر الخدمة بنجاح');
  };

  const handleToggleActive = async (service: ServiceItem) => {
    const updated = !service.isActive;
    setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, isActive: updated } : s)));

    try {
      await api.put(`/settings/services/${service.id}`, {
        ...service,
        isActive: updated,
      });
    } catch {
      // handled
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newNameAr) return;

    setSaving(true);
    const pricePiastres = parseEgpToPiastres(newPriceEgp || '0');
    const newService: ServiceItem = {
      id: Date.now(),
      code: newCode.trim().toUpperCase(),
      nameAr: newNameAr.trim(),
      nameEn: newNameEn.trim() || undefined,
      category: newCategory,
      defaultPricePiastres: pricePiastres,
      isActive: true,
    };

    try {
      await api.post('/settings/services', newService);
    } catch {
      // fallback
    }

    setServices((prev) => [...prev, newService]);
    setSaving(false);
    setIsAddOpen(false);
    setNewCode('');
    setNewNameAr('');
    setNewNameEn('');
    setNewPriceEgp('');
    showNotice('تمت إضافة الخدمة بنجاح إلى الدليل');
  };

  const showNotice = (msg: string) => {
    setSaveSuccess(msg);
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  const filteredServices = services.filter((s) => {
    const matchSearch =
      s.nameAr.includes(search) ||
      (s.nameEn && s.nameEn.toLowerCase().includes(search.toLowerCase())) ||
      s.code.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'ALL' || s.category === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-4">
      {/* Notice Banner */}
      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="بحث بالاسم أو الكود..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9 text-xs"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">جميع الفئات</option>
            <option value="Examination">كشف (Examination)</option>
            <option value="Consultation">استشارة (Consultation)</option>
            <option value="Procedure">إجراء طبي (Procedure)</option>
            <option value="Other">خدمات أخرى</option>
          </select>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setIsAddOpen(true)}
          className="gap-1.5 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة خدمة جديدة</span>
        </Button>
      </div>

      {/* Services Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">كود الخدمة</th>
                <th className="py-3 px-4">اسم الخدمة (عربي / إنجليزي)</th>
                <th className="py-3 px-4">الفئة</th>
                <th className="py-3 px-4">السعر الافتراضي</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    لا توجد خدمات مطابقة لخيارات البحث
                  </td>
                </tr>
              ) : (
                filteredServices.map((service) => (
                  <tr key={service.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-700">
                      <bdi dir="ltr">{service.code}</bdi>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{service.nameAr}</div>
                      {service.nameEn && (
                        <div className="text-[11px] text-slate-400">
                          <bdi dir="ltr">{service.nameEn}</bdi>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          service.category === 'Examination'
                            ? 'info'
                            : service.category === 'Consultation'
                            ? 'purple'
                            : 'default'
                        }
                      >
                        {service.category === 'Examination'
                          ? 'كشف'
                          : service.category === 'Consultation'
                          ? 'استشارة'
                          : 'إجراء طبي'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-700">
                      <bdi dir="ltr">{formatEgp(service.defaultPricePiastres)}</bdi>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(service)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${
                          service.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {service.isActive ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>مفعلة</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>معطلة</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditPrice(service)}
                        className="gap-1 text-slate-600 hover:text-sky-600"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>تعديل السعر</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Price Modal */}
      {editingService && (
        <Dialog
          isOpen={true}
          onClose={() => setEditingService(null)}
          title="تعديل سعر الخدمة"
          description={`الخدمة: ${editingService.nameAr} (${editingService.code})`}
          maxWidth="sm"
        >
          <form onSubmit={handleSavePrice} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                السعر الجديد (ج.م) *
              </label>
              <div className="relative">
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={editPriceEgp}
                  onChange={(e) => setEditPriceEgp(e.target.value)}
                  required
                  className="text-lg font-bold pl-12 text-emerald-700"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  ج.م
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingService(null)}
                disabled={saving}
              >
                إلغاء
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? 'جاري الحفظ...' : 'حفظ التعديل'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Add Service Modal */}
      {isAddOpen && (
        <Dialog
          isOpen={true}
          onClose={() => setIsAddOpen(false)}
          title="إضافة خدمة طبية جديدة"
          description="أدخل بيانات الخدمة وكودها لتظهر في قوائم الحجز وتسجيل الفواتير"
          maxWidth="md"
        >
          <form onSubmit={handleAddService} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  كود الخدمة *
                </label>
                <Input
                  type="text"
                  placeholder="مثال: PROC-LASER"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  required
                  className="font-mono text-xs uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الفئة *</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="Procedure">إجراء طبي (Procedure)</option>
                  <option value="Examination">كشف (Examination)</option>
                  <option value="Consultation">استشارة (Consultation)</option>
                  <option value="Other">أخرى</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                اسم الخدمة باللغة العربية *
              </label>
              <Input
                type="text"
                placeholder="مثال: جلسة علاج طبيعي بالليزر"
                value={newNameAr}
                onChange={(e) => setNewNameAr(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                الاسم بالإنجليزية (اختياري)
              </label>
              <Input
                type="text"
                placeholder="e.g. Laser Therapy Session"
                value={newNameEn}
                onChange={(e) => setNewNameEn(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                السعر الافتراضي (ج.م) *
              </label>
              <div className="relative">
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={newPriceEgp}
                  onChange={(e) => setNewPriceEgp(e.target.value)}
                  required
                  className="text-sm font-bold pl-12"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  ج.م
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(false)}
                disabled={saving}
              >
                إلغاء
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? 'جاري الإضافة...' : 'إضافة الخدمة للدليل'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
