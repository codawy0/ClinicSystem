import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  HeartPulse,
  Plus,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { nursingService } from '../../services/nursingService';
import {
  PatientClinicalProfileDto,
  AllergySeverity,
} from '../../types';
import { cn } from '../../lib/utils';

interface ClinicalProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number | null;
  patientName?: string;
  onProfileUpdated?: () => void;
}

type TabType = 'allergies' | 'chronic';

interface SuggestedCondition {
  code: string;
  name: string;
  notes?: string;
}

const COMMON_CONDITIONS: SuggestedCondition[] = [
  { code: 'HTN', name: 'ارتفاع ضغط الدم (Hypertension)' },
  { code: 'DM2', name: 'السكري من النوع الثاني (Type 2 Diabetes)' },
  { code: 'DM1', name: 'السكري من النوع الأول (Type 1 Diabetes)' },
  { code: 'Asthma', name: 'الربو الشعبي (Bronchial Asthma)' },
  { code: 'IHD', name: 'قصور الشرايين التاجية (Ischemic Heart Disease)' },
  { code: 'CKD', name: 'قصور كلوي مزمن (Chronic Kidney Disease)' },
  { code: 'Thyroid', name: 'اضطراب الغدة الدرقية (Thyroid Disorder)' },
  { code: 'Hepatitis', name: 'التهاب كبدي فيروسي (Viral Hepatitis)' },
];

const COMMON_ALLERGIES = [
  { ingredient: 'penicillin', name: 'بنسلين ومشتقاته (Penicillins)' },
  { ingredient: 'sulfa', name: 'مركبات السلفا (Sulfonamides)' },
  { ingredient: 'aspirin', name: 'أسبرين ومسكنات NSAIDs (Aspirin/NSAIDs)' },
  { ingredient: 'cephalosporin', name: 'سيفالوسبورين (Cephalosporins)' },
  { ingredient: 'ciprofloxacin', name: 'سيبروفلوكساسين وكينولونز (Fluoroquinolones)' },
];

export function ClinicalProfileModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  onProfileUpdated,
}: ClinicalProfileModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('allergies');
  const [profile, setProfile] = useState<PatientClinicalProfileDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // New Allergy Form
  const [activeIngredient, setActiveIngredient] = useState('');
  const [allergyName, setAllergyName] = useState('');
  const [severity, setSeverity] = useState<AllergySeverity>('Moderate');
  const [allergyNotes, setAllergyNotes] = useState('');
  const [isAddingAllergy, setIsAddingAllergy] = useState(false);

  // New Chronic Condition Form
  const [conditionCode, setConditionCode] = useState('');
  const [conditionName, setConditionName] = useState('');
  const [conditionNotes, setConditionNotes] = useState('');
  const [isAddingCondition, setIsAddingCondition] = useState(false);

  // Deletion tracking
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Load profile when modal opens
  const fetchProfile = async () => {
    if (!patientId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await nursingService.getClinicalProfile(patientId);
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'تعذر تحميل الملف السريري للمريض');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && patientId) {
      fetchProfile();
      // Reset forms
      setActiveIngredient('');
      setAllergyName('');
      setSeverity('Moderate');
      setAllergyNotes('');
      setConditionCode('');
      setConditionName('');
      setConditionNotes('');
    }
  }, [isOpen, patientId]);

  // Add Allergy Handler
  const handleAddAllergy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !activeIngredient.trim() || !allergyName.trim()) return;

    setIsAddingAllergy(true);
    setError(null);
    try {
      await nursingService.addAllergy(patientId, {
        activeIngredient: activeIngredient.trim().toLowerCase(),
        allergyName: allergyName.trim(),
        severity,
        notes: allergyNotes.trim() || undefined,
      });

      setActiveIngredient('');
      setAllergyName('');
      setSeverity('Moderate');
      setAllergyNotes('');

      await fetchProfile();
      onProfileUpdated?.();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إضافة الحساسية الدوائية');
    } finally {
      setIsAddingAllergy(false);
    }
  };

  // Delete Allergy Handler
  const handleDeleteAllergy = async (allergyId: number) => {
    if (!patientId) return;
    setDeletingId(allergyId);
    setError(null);
    try {
      await nursingService.deleteAllergy(patientId, allergyId);
      await fetchProfile();
      onProfileUpdated?.();
    } catch (err: any) {
      setError(err.message || 'تعذر حذف الحساسية الدوائية');
    } finally {
      setDeletingId(null);
    }
  };

  // Add Chronic Condition Handler
  const handleAddCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !conditionName.trim()) return;

    setIsAddingCondition(true);
    setError(null);
    try {
      await nursingService.addChronicCondition(patientId, {
        conditionCode: conditionCode.trim() || 'CHRONIC',
        conditionName: conditionName.trim(),
        notes: conditionNotes.trim() || undefined,
      });

      setConditionCode('');
      setConditionName('');
      setConditionNotes('');

      await fetchProfile();
      onProfileUpdated?.();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إضافة المرض المزمن');
    } finally {
      setIsAddingCondition(false);
    }
  };

  // Delete Chronic Condition Handler
  const handleDeleteCondition = async (conditionId: number) => {
    if (!patientId) return;
    setDeletingId(conditionId);
    setError(null);
    try {
      await nursingService.deleteChronicCondition(patientId, conditionId);
      await fetchProfile();
      onProfileUpdated?.();
    } catch (err: any) {
      setError(err.message || 'تعذر حذف المرض المزمن');
    } finally {
      setDeletingId(null);
    }
  };

  // Quick select allergy preset
  const handleSelectAllergyPreset = (preset: { ingredient: string; name: string }) => {
    setActiveIngredient(preset.ingredient);
    setAllergyName(preset.name);
  };

  // Quick select condition preset
  const handleSelectConditionPreset = (preset: SuggestedCondition) => {
    setConditionCode(preset.code);
    setConditionName(preset.name);
  };

  const getSeverityBadge = (sev: AllergySeverity) => {
    switch (sev) {
      case 'Severe':
        return <Badge variant="danger">شديدة الخطورة (Severe)</Badge>;
      case 'Moderate':
        return <Badge variant="warning">متوسطة (Moderate)</Badge>;
      case 'Mild':
        return <Badge variant="default">خفيفة (Mild)</Badge>;
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`الملف الطبي والتحذيرات السريرية: ${patientName || ''}`}
      description="إدارة الحساسيات الدوائية والأمراض المزمنة للمريض لحمايته أثناء وصف الأدوية والعلاج."
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('allergies')}
            className={cn(
              'flex items-center gap-2 pb-2.5 px-3 text-xs font-bold transition-all border-b-2',
              activeTab === 'allergies'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            الحساسيات الدوائية ({profile?.allergies.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chronic')}
            className={cn(
              'flex items-center gap-2 pb-2.5 px-3 text-xs font-bold transition-all border-b-2',
              activeTab === 'chronic'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <HeartPulse className="w-4 h-4 text-sky-600" />
            الأمراض المزمنة ({profile?.chronicConditions.length || 0})
          </button>
        </div>

        {/* Tab 1: Allergies Content */}
        {activeTab === 'allergies' && (
          <div className="space-y-4">
            {/* Common Presets */}
            <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 space-y-2">
              <span className="text-[11px] font-bold text-rose-900 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                أشهر مسببات الحساسية الدوائية (اضغط للإدخال السريع):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_ALLERGIES.map((preset) => (
                  <button
                    key={preset.ingredient}
                    type="button"
                    onClick={() => handleSelectAllergyPreset(preset)}
                    className="text-[11px] bg-white border border-rose-200 text-rose-800 hover:bg-rose-100 rounded-lg px-2 py-1 transition-colors"
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Add Allergy Form */}
            <form onSubmit={handleAddAllergy} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800">إضافة حساسية دوائية جديدة:</h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    المادة الفعالة (Active Ingredient) *
                  </label>
                  <input
                    type="text"
                    required
                    value={activeIngredient}
                    onChange={(e) => setActiveIngredient(e.target.value)}
                    placeholder="مثال: penicillin"
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-mono dir-ltr focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  <span className="text-[10px] text-slate-400">تُحفظ بأحرف صغيرة للتحقق التلقائي</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    اسم الدواء / الحساسية بالعربية *
                  </label>
                  <input
                    type="text"
                    required
                    value={allergyName}
                    onChange={(e) => setAllergyName(e.target.value)}
                    placeholder="مثال: بنسلين ومشتقاته"
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    درجة الخطورة (Severity) *
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as AllergySeverity)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="Severe">شديدة الخطورة (Severe / صدمة تحسسية)</option>
                    <option value="Moderate">متوسطة (Moderate / طفح جلدي وتورم)</option>
                    <option value="Mild">خفيفة (Mild / حكة خفيفة)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">ملاحظات أو رد الفعل التحسسي (اختياري)</label>
                <input
                  type="text"
                  value={allergyNotes}
                  onChange={(e) => setAllergyNotes(e.target.value)}
                  placeholder="مثال: حدث تورم بالوجه وصعوبة تنفس عند تناول حقنة البنسلين عام 2022"
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  disabled={isAddingAllergy || !activeIngredient.trim() || !allergyName.trim()}
                  className="bg-rose-600 hover:bg-rose-700 text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5 ml-1" />
                  {isAddingAllergy ? 'جاري الإضافة...' : 'إضافة الحساسية'}
                </Button>
              </div>
            </form>

            {/* Existing Allergies List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700">الحساسيات المسجلة حالياً:</h4>

              {isLoading ? (
                <div className="text-center py-4 text-xs text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto text-rose-500 mb-1" />
                  جاري تحميل الحساسيات...
                </div>
              ) : profile?.allergies && profile.allergies.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {profile.allergies.map((allergy) => (
                    <div
                      key={allergy.id}
                      className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-800">{allergy.allergyName}</span>
                          <span className="font-mono text-xs text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            {allergy.activeIngredient}
                          </span>
                          {getSeverityBadge(allergy.severity)}
                        </div>
                        {allergy.notes && (
                          <p className="text-[11px] text-slate-500">{allergy.notes}</p>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={deletingId === allergy.id}
                        onClick={() => handleDeleteAllergy(allergy.id)}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="حذف الحساسية"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  لا توجد أي حساسيات دوائية مسجلة لهذا المريض
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Chronic Conditions Content */}
        {activeTab === 'chronic' && (
          <div className="space-y-4">
            {/* Common Presets */}
            <div className="bg-sky-50/50 p-3 rounded-xl border border-sky-100 space-y-2">
              <span className="text-[11px] font-bold text-sky-900 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                أشهر الأمراض المزمنة الشائعة (اضغط للإدخال السريع):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_CONDITIONS.map((preset) => (
                  <button
                    key={preset.code}
                    type="button"
                    onClick={() => handleSelectConditionPreset(preset)}
                    className="text-[11px] bg-white border border-sky-200 text-sky-800 hover:bg-sky-100 rounded-lg px-2 py-1 transition-colors"
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Add Chronic Condition Form */}
            <form onSubmit={handleAddCondition} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800">إضافة مرض مزمن جديد:</h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    اسم المرض المزمن بالعربية *
                  </label>
                  <input
                    type="text"
                    required
                    value={conditionName}
                    onChange={(e) => setConditionName(e.target.value)}
                    placeholder="مثال: ارتفاع ضغط الدم الشرياني"
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    رمز المرض / الكود (اختياري)
                  </label>
                  <input
                    type="text"
                    value={conditionCode}
                    onChange={(e) => setConditionCode(e.target.value)}
                    placeholder="مثال: HTN أو I10"
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-mono uppercase focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">ملاحظات سريرية أو سنة التشخيص (اختياري)</label>
                <input
                  type="text"
                  value={conditionNotes}
                  onChange={(e) => setConditionNotes(e.target.value)}
                  placeholder="مثال: مشخص منذ 5 سنوات، منتظم على العلاج"
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  disabled={isAddingCondition || !conditionName.trim()}
                  className="bg-sky-600 hover:bg-sky-700 text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5 ml-1" />
                  {isAddingCondition ? 'جاري الإضافة...' : 'إضافة المرض المزمن'}
                </Button>
              </div>
            </form>

            {/* Existing Chronic Conditions List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700">الأمراض المزمنة المسجلة حالياً:</h4>

              {isLoading ? (
                <div className="text-center py-4 text-xs text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto text-sky-500 mb-1" />
                  جاري تحميل الأمراض المزمنة...
                </div>
              ) : profile?.chronicConditions && profile.chronicConditions.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {profile.chronicConditions.map((cond) => (
                    <div
                      key={cond.id}
                      className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-800">{cond.conditionName}</span>
                          {cond.conditionCode && (
                            <span className="font-mono text-xs text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                              {cond.conditionCode}
                            </span>
                          )}
                        </div>
                        {cond.notes && (
                          <p className="text-[11px] text-slate-500">{cond.notes}</p>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={deletingId === cond.id}
                        onClick={() => handleDeleteCondition(cond.id)}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="حذف المرض المزمن"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  لا توجد أي أمراض مزمنة مسجلة لهذا المريض
                </p>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose} className="text-xs font-bold">
            إغلاق
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
