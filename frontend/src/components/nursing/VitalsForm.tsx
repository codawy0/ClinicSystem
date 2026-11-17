import { useState, useEffect, useMemo } from 'react';
import {
  Heart,
  Thermometer,
  Scale,
  Droplet,
  Baby,
  FileEdit,
  Save,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import {
  VitalsDto,
  MedicalVisitDetailDto,
  BloodSugarType,
  SaveVitalsRequestDto,
} from '../../types';
import { vitalsAlerts, AlertEvaluation, BmiEvaluation } from '../../lib/vitalsAlerts';
import { nursingService } from '../../services/nursingService';
import { ConcurrencyConflictException } from '../../lib/api';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface VitalsFormProps {
  visitId: number;
  initialVitals?: VitalsDto | null;
  initialVersion: number;
  patientGender: 'Male' | 'Female';
  onSaveSuccess: (updatedVisit: MedicalVisitDetailDto) => void;
  onCompletePrep: (updatedVisit: MedicalVisitDetailDto) => void;
  onConcurrencyError?: () => void;
}

const COMMON_SYMPTOMS = [
  'صداع شديد',
  'مغص كلوي حاد',
  'ارتفاع حرارة ورعشة',
  'ألم بالصدر',
  'كحة وضيق تنفس',
  'متابعة دورية',
  'غثيان وقيء',
  'إرهاق عام ودوخة',
  'ألم بالظهر والرقبة',
];

export function VitalsForm({
  visitId,
  initialVitals,
  initialVersion,
  patientGender,
  onSaveSuccess,
  onCompletePrep,
  onConcurrencyError,
}: VitalsFormProps) {
  // Form fields state
  const [bpSystolic, setBpSystolic] = useState<string>('');
  const [bpDiastolic, setBpDiastolic] = useState<string>('');
  const [pulseBpm, setPulseBpm] = useState<string>('');
  const [tempCelsius, setTempCelsius] = useState<string>('');
  const [spo2Pct, setSpo2Pct] = useState<string>('');
  const [weightKg, setWeightKg] = useState<string>('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [bloodSugarMgDl, setBloodSugarMgDl] = useState<string>('');
  const [bloodSugarType, setBloodSugarType] = useState<BloodSugarType>('Random');
  const [isPregnant, setIsPregnant] = useState<boolean>(false);
  const [isLactating, setIsLactating] = useState<boolean>(false);
  const [lmpDate, setLmpDate] = useState<string>('');
  const [chiefComplaint, setChiefComplaint] = useState<string>('');
  const [nurseNotes, setNurseNotes] = useState<string>('');

  // Version tracking
  const [currentVersion, setCurrentVersion] = useState<number>(initialVersion);

  // Submission state
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync initial vitals when visit changes
  useEffect(() => {
    setCurrentVersion(initialVersion);
    setFormError(null);
    setSuccessMessage(null);

    if (initialVitals) {
      setBpSystolic(initialVitals.bpSystolic ? String(initialVitals.bpSystolic) : '');
      setBpDiastolic(initialVitals.bpDiastolic ? String(initialVitals.bpDiastolic) : '');
      setPulseBpm(initialVitals.pulseBpm ? String(initialVitals.pulseBpm) : '');
      setTempCelsius(initialVitals.tempCelsius ? String(initialVitals.tempCelsius) : '');
      setSpo2Pct(initialVitals.spo2Pct ? String(initialVitals.spo2Pct) : '');
      setWeightKg(initialVitals.weightKg ? String(initialVitals.weightKg) : '');
      setHeightCm(initialVitals.heightCm ? String(initialVitals.heightCm) : '');
      setBloodSugarMgDl(initialVitals.bloodSugarMgDl ? String(initialVitals.bloodSugarMgDl) : '');
      setBloodSugarType(initialVitals.bloodSugarType || 'Random');
      setIsPregnant(Boolean(initialVitals.isPregnant));
      setIsLactating(Boolean(initialVitals.isLactating));
      setLmpDate(initialVitals.lmpDate || '');
      setChiefComplaint(initialVitals.chiefComplaint || '');
      setNurseNotes(initialVitals.nurseNotes || '');
    } else {
      setBpSystolic('');
      setBpDiastolic('');
      setPulseBpm('');
      setTempCelsius('');
      setSpo2Pct('');
      setWeightKg('');
      setHeightCm('');
      setBloodSugarMgDl('');
      setBloodSugarType('Random');
      setIsPregnant(false);
      setIsLactating(false);
      setLmpDate('');
      setChiefComplaint('');
      setNurseNotes('');
    }
  }, [visitId, initialVitals, initialVersion]);

  // Real-time Evaluations
  const bpAlert = useMemo<AlertEvaluation>(() => {
    const sys = bpSystolic ? parseInt(bpSystolic, 10) : null;
    const dia = bpDiastolic ? parseInt(bpDiastolic, 10) : null;
    return vitalsAlerts.evaluateBp(sys, dia);
  }, [bpSystolic, bpDiastolic]);

  const pulseAlert = useMemo<AlertEvaluation>(() => {
    const p = pulseBpm ? parseInt(pulseBpm, 10) : null;
    return vitalsAlerts.evaluatePulse(p);
  }, [pulseBpm]);

  const tempAlert = useMemo<AlertEvaluation>(() => {
    const t = tempCelsius ? parseFloat(tempCelsius) : null;
    return vitalsAlerts.evaluateTemp(t);
  }, [tempCelsius]);

  const spo2Alert = useMemo<AlertEvaluation>(() => {
    const s = spo2Pct ? parseInt(spo2Pct, 10) : null;
    return vitalsAlerts.evaluateSpo2(s);
  }, [spo2Pct]);

  const glucoseAlert = useMemo<AlertEvaluation>(() => {
    const g = bloodSugarMgDl ? parseInt(bloodSugarMgDl, 10) : null;
    return vitalsAlerts.evaluateGlucose(g, bloodSugarType);
  }, [bloodSugarMgDl, bloodSugarType]);

  const bmiEval = useMemo<BmiEvaluation>(() => {
    const w = weightKg ? parseFloat(weightKg) : null;
    const h = heightCm ? parseFloat(heightCm) : null;
    return vitalsAlerts.calculateBmi(w, h);
  }, [weightKg, heightCm]);

  // Append symptom chip to chief complaint
  const handleAppendSymptom = (symptom: string) => {
    setChiefComplaint((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return symptom;
      if (trimmed.includes(symptom)) return trimmed;
      return `${trimmed}، ${symptom}`;
    });
  };

  // Build payload
  const buildPayload = (markNursePrepComplete: boolean): SaveVitalsRequestDto => {
    return {
      bpSystolic: bpSystolic ? parseInt(bpSystolic, 10) : null,
      bpDiastolic: bpDiastolic ? parseInt(bpDiastolic, 10) : null,
      pulseBpm: pulseBpm ? parseInt(pulseBpm, 10) : null,
      tempCelsius: tempCelsius ? parseFloat(tempCelsius) : null,
      spo2Pct: spo2Pct ? parseInt(spo2Pct, 10) : null,
      weightKg: weightKg ? parseFloat(weightKg) : null,
      heightCm: heightCm ? parseFloat(heightCm) : null,
      bloodSugarMgDl: bloodSugarMgDl ? parseInt(bloodSugarMgDl, 10) : null,
      bloodSugarType: bloodSugarMgDl ? bloodSugarType : null,
      isPregnant: patientGender === 'Female' ? isPregnant : false,
      isLactating: patientGender === 'Female' ? isLactating : false,
      lmpDate: patientGender === 'Female' && isPregnant && lmpDate ? lmpDate : null,
      chiefComplaint: chiefComplaint.trim() || null,
      nurseNotes: nurseNotes.trim() || null,
      markNursePrepComplete,
      version: currentVersion,
    };
  };

  // Submit Handler
  const handleSave = async (markNursePrepComplete: boolean) => {
    setFormError(null);
    setSuccessMessage(null);

    if (markNursePrepComplete) {
      setIsCompleting(true);
    } else {
      setIsSavingDraft(true);
    }

    try {
      const payload = buildPayload(markNursePrepComplete);
      const updatedVisit = await nursingService.saveVitals(visitId, payload);

      setCurrentVersion(updatedVisit.version);

      if (markNursePrepComplete) {
        setSuccessMessage('تم حفظ الفحص بنجاح ونقل المريض إلى قائمة انتظار الطبيب');
        onCompletePrep(updatedVisit);
      } else {
        setSuccessMessage('تم حفظ مسودة العلامات الحيوية بنجاح');
        onSaveSuccess(updatedVisit);
      }
    } catch (err: any) {
      if (err instanceof ConcurrencyConflictException || err.status === 409) {
        setFormError('تم تعديل بيانات الزيارة بواسطة مستخدم آخر. يرجى إعادة تحميل البيانات.');
        onConcurrencyError?.();
      } else {
        setFormError(err.message || 'حدث خطأ أثناء حفظ العلامات الحيوية');
      }
    } finally {
      setIsSavingDraft(false);
      setIsCompleting(false);
    }
  };

  const renderAlertBadge = (alert: AlertEvaluation) => {
    if (!alert.hasAlert && alert.labelAr === 'غير مسجل') return null;

    if (alert.level === 'danger') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2 py-0.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{alert.labelAr}</span>
        </span>
      );
    }

    if (alert.level === 'warning') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{alert.labelAr}</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">
        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{alert.labelAr}</span>
      </span>
    );
  };

  return (
    <div className="space-y-4 text-right">
      {/* Alert / Notification banners */}
      {formError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span className="font-semibold">{formError}</span>
          </div>
          {onConcurrencyError && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onConcurrencyError}
              className="text-xs bg-white text-rose-700 border-rose-300 hover:bg-rose-100"
            >
              <RotateCcw className="w-3.5 h-3.5 ml-1" />
              تحديث البيانات
            </Button>
          )}
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Structured Vitals Input Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Cardiovascular Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                <Heart className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-800">القلب وضغط الدم</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">BP & Pulse</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">انقباضي (Systolic)</label>
              <input
                type="number"
                value={bpSystolic}
                onChange={(e) => setBpSystolic(e.target.value)}
                placeholder="120"
                className="w-full text-sm font-bold font-mono text-center bg-slate-50 border border-slate-300 rounded-xl py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">انبساطي (Diastolic)</label>
              <input
                type="number"
                value={bpDiastolic}
                onChange={(e) => setBpDiastolic(e.target.value)}
                placeholder="80"
                className="w-full text-sm font-bold font-mono text-center bg-slate-50 border border-slate-300 rounded-xl py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {renderAlertBadge(bpAlert)}

          <div className="pt-2 border-t border-slate-100">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">النبض (Pulse bpm)</label>
            <input
              type="number"
              value={pulseBpm}
              onChange={(e) => setPulseBpm(e.target.value)}
              placeholder="72"
              className="w-full text-sm font-bold font-mono text-center bg-slate-50 border border-slate-300 rounded-xl py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="mt-2">{renderAlertBadge(pulseAlert)}</div>
          </div>
        </div>

        {/* 2. Temperature & SpO2 Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                <Thermometer className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-800">الحرارة والأكسجين</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Temp & SpO2</span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">درجة الحرارة (°C)</label>
            <input
              type="number"
              step="0.1"
              value={tempCelsius}
              onChange={(e) => setTempCelsius(e.target.value)}
              placeholder="37.0"
              className="w-full text-sm font-bold font-mono text-center bg-slate-50 border border-slate-300 rounded-xl py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="mt-2">{renderAlertBadge(tempAlert)}</div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">تشبع الأكسجين (SpO2 %)</label>
            <input
              type="number"
              value={spo2Pct}
              onChange={(e) => setSpo2Pct(e.target.value)}
              placeholder="98"
              className="w-full text-sm font-bold font-mono text-center bg-slate-50 border border-slate-300 rounded-xl py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="mt-2">{renderAlertBadge(spo2Alert)}</div>
          </div>
        </div>

        {/* 3. Anthropometrics & BMI Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center">
                <Scale className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-800">الوزن والطول وكتلة الجسم</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">BMI</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">الوزن (kg)</label>
              <input
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="75"
                className="w-full text-sm font-bold font-mono text-center bg-slate-50 border border-slate-300 rounded-xl py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">الطول (cm)</label>
              <input
                type="number"
                step="1"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="170"
                className="w-full text-sm font-bold font-mono text-center bg-slate-50 border border-slate-300 rounded-xl py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* BMI Live Evaluation Display */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600">مؤشر كتلة الجسم:</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {bmiEval.bmi !== null ? `${bmiEval.bmi} kg/m²` : '--'}
              </span>
            </div>

            {bmiEval.bmi !== null ? (
              <div
                className={cn(
                  'text-center text-xs font-bold rounded-lg py-1 px-2 mt-1',
                  bmiEval.level === 'normal' && 'bg-emerald-100 text-emerald-800',
                  bmiEval.level === 'warning' && 'bg-amber-100 text-amber-800',
                  bmiEval.level === 'danger' && 'bg-rose-100 text-rose-800'
                )}
              >
                {bmiEval.labelAr}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 text-center">أدخل الطول والوزن لاحتساب المؤشر تلقائياً</p>
            )}
          </div>
        </div>

        {/* 4. Blood Glucose Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
                <Droplet className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-800">السكر بالدم</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Blood Glucose</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">القراءة (mg/dL)</label>
              <input
                type="number"
                value={bloodSugarMgDl}
                onChange={(e) => setBloodSugarMgDl(e.target.value)}
                placeholder="110"
                className="w-full text-sm font-bold font-mono text-center bg-slate-50 border border-slate-300 rounded-xl py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">حالة الفحص</label>
              <select
                value={bloodSugarType}
                onChange={(e) => setBloodSugarType(e.target.value as BloodSugarType)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl py-2 px-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="Random">عشوائي (Random)</option>
                <option value="Fasting">صائم (Fasting)</option>
                <option value="PostPrandial">بعد الأكل (Post-Prandial)</option>
              </select>
            </div>
          </div>

          {renderAlertBadge(glucoseAlert)}
        </div>

        {/* 5. Female Maternal Status Card (Only if Female) */}
        {patientGender === 'Female' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center">
                  <Baby className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-800">حالة الحمل والرضاعة</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Maternal</span>
            </div>

            <div className="space-y-2">
              <label className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-pink-50/50">
                <span className="text-xs font-bold text-slate-700">المريضة حامل حالياً</span>
                <input
                  type="checkbox"
                  checked={isPregnant}
                  onChange={(e) => setIsPregnant(e.target.checked)}
                  className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500 border-slate-300"
                />
              </label>

              {isPregnant && (
                <div className="p-2 bg-pink-50/70 border border-pink-200 rounded-xl space-y-1">
                  <label className="block text-[10px] font-bold text-pink-800">
                    تاريخ آخر دورة شهرية (LMP)
                  </label>
                  <input
                    type="date"
                    value={lmpDate}
                    onChange={(e) => setLmpDate(e.target.value)}
                    className="w-full text-xs bg-white border border-pink-300 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-pink-500 font-mono"
                  />
                </div>
              )}

              <label className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-pink-50/50">
                <span className="text-xs font-bold text-slate-700">المريضة مرضعة حالياً</span>
                <input
                  type="checkbox"
                  checked={isLactating}
                  onChange={(e) => setIsLactating(e.target.checked)}
                  className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500 border-slate-300"
                />
              </label>
            </div>
          </div>
        )}

        {/* 6. Chief Complaint & Notes Card */}
        <div
          className={cn(
            'bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3',
            patientGender === 'Female' ? 'md:col-span-2 lg:col-span-1' : 'md:col-span-2 lg:col-span-2'
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <FileEdit className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-800">الشكوى والملاحظات السريرية الأولية</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Triage Notes</span>
          </div>

          {/* Quick Symptoms Chips */}
          <div>
            <span className="block text-[11px] font-bold text-slate-500 mb-1.5">
              اختصارات سريعة للأعراض الشائعة:
            </span>
            <div className="flex flex-wrap gap-1">
              {COMMON_SYMPTOMS.map((symptom) => (
                <button
                  key={symptom}
                  type="button"
                  onClick={() => handleAppendSymptom(symptom)}
                  className="text-[11px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 transition-colors"
                >
                  + {symptom}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              الشكوى الرئيسية للمريض (Chief Complaint)
            </label>
            <textarea
              rows={2}
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="اكتب شكوى المريض أو سبب الحضور اليوم..."
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              ملاحظات تمريضية إضافية (اختياري)
            </label>
            <textarea
              rows={2}
              value={nurseNotes}
              onChange={(e) => setNurseNotes(e.target.value)}
              placeholder="أي ملاحظات إضافية للطبيب المعالج..."
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Action Footer Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span>إصدار السجل:</span>
          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
            v{currentVersion}
          </span>
          <span className="text-[11px] text-slate-400">(مزامنة لمنع التعارض)</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Save Draft Button */}
          <Button
            type="button"
            variant="outline"
            disabled={isSavingDraft || isCompleting}
            onClick={() => handleSave(false)}
            className="text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Save className="w-3.5 h-3.5 ml-1" />
            {isSavingDraft ? 'جاري الحفظ...' : 'حفظ كمسودة'}
          </Button>

          {/* Complete Prep & Ready for Doctor Button */}
          <Button
            type="button"
            variant="primary"
            disabled={isSavingDraft || isCompleting}
            onClick={() => handleSave(true)}
            className="text-xs font-bold bg-teal-600 hover:bg-teal-700 shadow-sm"
          >
            <CheckCircle className="w-4 h-4 ml-1.5" />
            {isCompleting ? 'جاري الإرسال...' : 'إتمام الفحص وجاهز للطبيب'}
          </Button>
        </div>
      </div>
    </div>
  );
}
