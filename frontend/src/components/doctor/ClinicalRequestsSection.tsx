import { useState } from 'react';
import {
  FlaskConical,
  Plus,
  Trash2,
  Check,
} from 'lucide-react';
import { Button } from '../ui/button';
import { ClinicalRequestInputDto } from '../../types';

interface ClinicalRequestsSectionProps {
  requests: ClinicalRequestInputDto[];
  onChangeRequests: (requests: ClinicalRequestInputDto[]) => void;
}

const COMMON_LAB_CHIPS = [
  { nameAr: 'صورة دم كاملة', nameEn: 'CBC', code: 'LAB-CBC' },
  { nameAr: 'سكر صائم وتراكمي', nameEn: 'FBG & HbA1c', code: 'LAB-HBA1C' },
  { nameAr: 'وظائف كبد', nameEn: 'ALT, AST, Bilirubin', code: 'LAB-LFT' },
  { nameAr: 'وظائف كلى', nameEn: 'Creatinine, Urea', code: 'LAB-KFT' },
  { nameAr: 'دهون الدم الكاملة', nameEn: 'Lipid Profile', code: 'LAB-LIPID' },
  { nameAr: 'تحليل بول كامل', nameEn: 'Urine Analysis', code: 'LAB-URINE' },
  { nameAr: 'سرعة الترسيب والالتهاب', nameEn: 'ESR & CRP', code: 'LAB-ESR-CRP' },
  { nameAr: 'فيتامين د وكالسيوم', nameEn: 'Vitamin D & Ca', code: 'LAB-VITD' },
];

const COMMON_RADIOLOGY_CHIPS = [
  { nameAr: 'أشعة عادية على الصدر', nameEn: 'Chest X-Ray', code: 'RAD-CXR' },
  { nameAr: 'موجات صوتية على البطن والحوض', nameEn: 'Pelvi-Abdominal US', code: 'RAD-US-ABD' },
  { nameAr: 'موجات صوتية على القلب', nameEn: 'Echocardiography', code: 'RAD-ECHO' },
  { nameAr: 'رنين مغناطيسي', nameEn: 'MRI Scan', code: 'RAD-MRI' },
  { nameAr: 'أشعة مقطعية', nameEn: 'CT Scan', code: 'RAD-CT' },
];

export function ClinicalRequestsSection({
  requests,
  onChangeRequests,
}: ClinicalRequestsSectionProps) {
  const [activeTab, setActiveTab] = useState<'Lab' | 'Radiology'>('Lab');
  const [customNameAr, setCustomNameAr] = useState('');
  const [customNameEn, setCustomNameEn] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  // Add chip order
  const handleAddChip = (chip: { nameAr: string; nameEn: string; code: string }, type: 'Lab' | 'Radiology') => {
    // Avoid exact duplicate
    if (requests.some((r) => r.catalogCode === chip.code || r.nameAr === chip.nameAr)) {
      return;
    }

    const newRequest: ClinicalRequestInputDto = {
      requestType: type,
      catalogCode: chip.code,
      nameAr: chip.nameAr,
      nameEn: chip.nameEn,
      notes: '',
    };

    onChangeRequests([...requests, newRequest]);
  };

  // Add custom manual order
  const handleAddCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customNameAr.trim()) return;

    const newRequest: ClinicalRequestInputDto = {
      requestType: activeTab,
      nameAr: customNameAr.trim(),
      nameEn: customNameEn.trim() || undefined,
      notes: customNotes.trim() || undefined,
    };

    onChangeRequests([...requests, newRequest]);
    setCustomNameAr('');
    setCustomNameEn('');
    setCustomNotes('');
  };

  // Update request item
  const handleUpdateRequest = (index: number, patch: Partial<ClinicalRequestInputDto>) => {
    const updated = requests.map((item, idx) => (idx === index ? { ...item, ...patch } : item));
    onChangeRequests(updated);
  };

  // Remove request item
  const handleRemoveRequest = (index: number) => {
    const updated = requests.filter((_, idx) => idx !== index);
    onChangeRequests(updated);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-900 text-base">الطلبات والفحوصات الإكلينيكية (Lab & Radiology)</h3>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {requests.length} {requests.length === 1 ? 'طلب' : 'طلبات'}
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('Lab')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'Lab'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            تحاليل طبية (Laboratory)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('Radiology')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'Radiology'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            فحوصات وأشعة (Radiology)
          </button>
        </div>
      </div>

      {/* Quick Chips Section */}
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-slate-600">
          فحوصات شائعة سريعة (اضغط للإضافة):
        </span>
        <div className="flex flex-wrap gap-1.5">
          {activeTab === 'Lab'
            ? COMMON_LAB_CHIPS.map((chip) => {
                const isAdded = requests.some((r) => r.catalogCode === chip.code || r.nameAr === chip.nameAr);
                return (
                  <button
                    key={chip.code}
                    type="button"
                    onClick={() => handleAddChip(chip, 'Lab')}
                    disabled={isAdded}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      isAdded
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 opacity-80 cursor-default'
                        : 'bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-700 border-slate-200'
                    }`}
                  >
                    {isAdded ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Plus className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{chip.nameAr}</span>
                    <span className="text-[10px] font-mono text-slate-400">({chip.nameEn})</span>
                  </button>
                );
              })
            : COMMON_RADIOLOGY_CHIPS.map((chip) => {
                const isAdded = requests.some((r) => r.catalogCode === chip.code || r.nameAr === chip.nameAr);
                return (
                  <button
                    key={chip.code}
                    type="button"
                    onClick={() => handleAddChip(chip, 'Radiology')}
                    disabled={isAdded}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      isAdded
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 opacity-80 cursor-default'
                        : 'bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-700 border-slate-200'
                    }`}
                  >
                    {isAdded ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Plus className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{chip.nameAr}</span>
                    <span className="text-[10px] font-mono text-slate-400">({chip.nameEn})</span>
                  </button>
                );
              })}
        </div>
      </div>

      {/* Custom Test Input Form */}
      <form onSubmit={handleAddCustom} className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
        <div className="sm:col-span-5">
          <input
            type="text"
            value={customNameAr}
            onChange={(e) => setCustomNameAr(e.target.value)}
            placeholder={`اسم فحص ${activeTab === 'Lab' ? 'التحليل' : 'الأشعة'} بالعربية...`}
            className="w-full text-xs font-medium rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="sm:col-span-3">
          <input
            type="text"
            value={customNameEn}
            onChange={(e) => setCustomNameEn(e.target.value)}
            placeholder="الاسم بالإنجليزي (اختياري)..."
            className="w-full text-xs font-medium rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="sm:col-span-3">
          <input
            type="text"
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            placeholder="تعليمات أو دلالة سريرية..."
            className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="sm:col-span-1">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!customNameAr.trim()}
            className="w-full h-full bg-indigo-600 hover:bg-indigo-700 text-white p-2"
            title="إضافة الفحص"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </form>

      {/* Orders List Table */}
      {requests.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2 px-3 w-28">النوع</th>
                <th className="py-2 px-3">اسم الفحص أو التحليل المطلوب</th>
                <th className="py-2 px-3">الملاحظات والتعليمات</th>
                <th className="py-2 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {requests.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                        item.requestType === 'Lab'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-cyan-100 text-cyan-800'
                      }`}
                    >
                      {item.requestType === 'Lab' ? 'تحليل مخبري' : 'أشعة وفحص'}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-900">
                    {item.nameAr}
                    {item.nameEn && (
                      <span className="text-xs font-normal font-mono text-slate-500 mr-1.5">
                        ({item.nameEn})
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={item.notes || ''}
                      onChange={(e) => handleUpdateRequest(index, { notes: e.target.value })}
                      placeholder="ملاحظات سريرية..."
                      className="w-full text-xs text-slate-700 rounded border border-transparent hover:border-slate-300 focus:border-indigo-500 px-2 py-1 focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRequest(index)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
