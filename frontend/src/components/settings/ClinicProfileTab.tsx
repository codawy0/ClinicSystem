import { useState, useEffect } from 'react';
import { Building2, Save, CheckCircle2, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ClinicSettingDto, TvPrivacyMode } from '../../types';
import { parseEgpToPiastres, piastresToEgpNumber } from '../../lib/currency';
import { api, ApiException } from '../../lib/api';

const DEFAULT_PROFILE: ClinicSettingDto = {
  clinicName: 'عيادة النور التخصصية',
  doctorName: 'د. أحمد عبد الرحمن',
  doctorTitle: 'استشاري الباطنة والقلب والسكر',
  specialty: 'أمراض الباطنة والقلب',
  consultationValidityDays: 14,
  maxConsultationsPerExam: 1,
  defaultExamPricePiastres: 30000,
  defaultConsultPricePiastres: 0,
  enableNursingStage: true,
  tvPrivacyMode: 'FirstNameAndInitial',
  tvDeviceToken: 'clinic-tv-key',
  isDoctorOnBreak: false,
} as ClinicSettingDto;

export function ClinicProfileTab() {
  const [profile, setProfile] = useState<ClinicSettingDto>(DEFAULT_PROFILE);
  const [examPriceEgp, setExamPriceEgp] = useState<string>('300');
  const [consultPriceEgp, setConsultPriceEgp] = useState<string>('0');
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.get<ClinicSettingDto>('/settings');
      if (data) {
        setProfile(data);
        setExamPriceEgp(piastresToEgpNumber(data.defaultExamPricePiastres || 30000).toString());
        setConsultPriceEgp(piastresToEgpNumber(data.defaultConsultPricePiastres || 0).toString());
      }
    } catch {
      // Keep defaults
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSaveNotice(null);

    const updated: ClinicSettingDto = {
      ...profile,
      defaultExamPricePiastres: parseEgpToPiastres(examPriceEgp || '0'),
      defaultConsultPricePiastres: parseEgpToPiastres(consultPriceEgp || '0'),
    };

    try {
      await api.put('/settings', updated);
      setProfile(updated);
      setSaveNotice('تم حفظ إعدادات العيادة وسياسات الاستشارة بنجاح');
      setTimeout(() => setSaveNotice(null), 3500);
    } catch (err: any) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        // Fallback update
        setProfile(updated);
        setSaveNotice('تم تحديث البيانات محلياً');
        setTimeout(() => setSaveNotice(null), 3500);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {saveNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{saveNotice}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Clinic & Physician Identity Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Building2 className="w-4 h-4 text-sky-600" />
          <h3 className="font-bold text-slate-800 text-sm">بيانات العيادة والطبيب المسؤول</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">اسم العيادة / المركز *</label>
            <Input
              type="text"
              value={profile.clinicName}
              onChange={(e) => setProfile({ ...profile, clinicName: e.target.value })}
              required
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">اسم الطبيب الرئيسي *</label>
            <Input
              type="text"
              value={profile.doctorName}
              onChange={(e) => setProfile({ ...profile, doctorName: e.target.value })}
              required
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">اللقب المهني والدرجة العلمية *</label>
            <Input
              type="text"
              value={profile.doctorTitle}
              onChange={(e) => setProfile({ ...profile, doctorTitle: e.target.value })}
              required
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">التخصص الطبي *</label>
            <Input
              type="text"
              value={profile.specialty}
              onChange={(e) => setProfile({ ...profile, specialty: e.target.value })}
              required
              className="text-xs"
            />
          </div>
        </div>
      </div>

      {/* Consultation Policies & Default Pricing */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <ShieldCheck className="w-4 h-4 text-sky-600" />
          <h3 className="font-bold text-slate-800 text-sm">سياسات الاستشارة والأسعار الافتراضية</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              صلاحية الاستشارة المجانية (بالأيام) *
            </label>
            <Input
              type="number"
              min="1"
              max="90"
              value={profile.consultationValidityDays}
              onChange={(e) =>
                setProfile({ ...profile, consultationValidityDays: parseInt(e.target.value) || 14 })
              }
              required
              className="text-xs font-bold"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              المدة المسموح للمريض خلالها بإجراء استشارة بعد الكشف (افتراضياً 14 يوماً)
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              الحد الأقصى لعدد الاستشارات لكل كشف *
            </label>
            <Input
              type="number"
              min="1"
              max="5"
              value={profile.maxConsultationsPerExam}
              onChange={(e) =>
                setProfile({ ...profile, maxConsultationsPerExam: parseInt(e.target.value) || 1 })
              }
              required
              className="text-xs font-bold"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              عدد مرات الاستشارة المجانية المسموح بها قبل وجوب حجز كشف جديد
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              سعر الكشف الافتراضي (ج.م) *
            </label>
            <div className="relative">
              <Input
                type="number"
                step="any"
                min="0"
                value={examPriceEgp}
                onChange={(e) => setExamPriceEgp(e.target.value)}
                required
                className="text-sm font-bold pl-12 text-emerald-700"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                ج.م
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              سعر الاستشارة / الإعادة (ج.م) *
            </label>
            <div className="relative">
              <Input
                type="number"
                step="any"
                min="0"
                value={consultPriceEgp}
                onChange={(e) => setConsultPriceEgp(e.target.value)}
                required
                className="text-sm font-bold pl-12"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                ج.م
              </div>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              0 ج.م للاستشارات المجانية
            </span>
          </div>
        </div>
      </div>

      {/* Operational Rules & Screen Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Clock className="w-4 h-4 text-sky-600" />
          <h3 className="font-bold text-slate-800 text-sm">قواعد التشغيل وعرض الشاشات</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              وضع خصوصية الأسماء على شاشة الانتظار (TV) *
            </label>
            <select
              value={profile.tvPrivacyMode}
              onChange={(e) =>
                setProfile({ ...profile, tvPrivacyMode: e.target.value as TvPrivacyMode })
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="FirstNameAndInitial">الاسم الأول والحرف الأول فقط (محمد أ.)</option>
              <option value="QueueNumberOnly">رقم الدور في الطابور فقط (دور #4)</option>
              <option value="FullName">الاسم بالكامل (محمد أحمد محمود)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              تفعيل مرحلة قياس العلامات الحيوية بالتمريض *
            </label>
            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="enableNursing"
                checked={profile.enableNursingStage}
                onChange={(e) => setProfile({ ...profile, enableNursingStage: e.target.checked })}
                className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
              />
              <label htmlFor="enableNursing" className="text-xs font-medium text-slate-700 cursor-pointer">
                توجيه المرضى تلقائياً إلى غرفة التمريض قبل غرفة الطبيب
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <Button type="submit" variant="primary" size="md" disabled={isSaving} className="gap-2 px-6">
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'جاري الحفظ...' : 'حفظ إعدادات العيادة'}</span>
        </Button>
      </div>
    </form>
  );
}
