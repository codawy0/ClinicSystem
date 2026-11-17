import {
  User,
  HeartPulse,
  AlertTriangle,
  Baby,
  Phone,
  FileText,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { PatientClinicalProfileDto, LiveQueueItemDto, MedicalVisitDetailDto } from '../../types';
import { vitalsAlerts } from '../../lib/vitalsAlerts';

interface DoctorPatientBannerProps {
  profile: PatientClinicalProfileDto | null;
  appointment: LiveQueueItemDto | null;
  vitals: MedicalVisitDetailDto | null;
  isLoading?: boolean;
}

export function DoctorPatientBanner({
  profile,
  appointment,
  vitals,
  isLoading = false,
}: DoctorPatientBannerProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-500 shadow-xs flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
        <span className="text-sm font-medium">جاري تحميل بيانات المريض...</span>
      </div>
    );
  }

  if (!appointment && !profile) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-6 text-center text-slate-500 shadow-xs">
        <User className="w-10 h-10 mx-auto text-slate-400 mb-2 stroke-[1.5]" />
        <p className="font-semibold text-slate-700">لا يوجد مريض في غرفة الكشف حالياً</p>
        <p className="text-xs text-slate-500 mt-1">
          اضغط زر <span className="font-bold text-sky-600">استدعاء التالي [F4]</span> لنداء الحالة الأولى في قائمة الانتظار.
        </p>
      </div>
    );
  }

  const isFemale = profile?.gender === 'Female' || (appointment as any)?.gender === 'Female';
  const displayName = profile?.fullName || appointment?.patientName || 'مريض غير محدد';
  const fileNumber = profile?.fileNumber || appointment?.fileNumber || '---';
  const phone = profile?.phone || appointment?.phone || '';
  const ageYears = profile?.ageYears;

  // Evaluate vitals using vitalsAlerts
  const bpEval = vitalsAlerts.evaluateBp(vitals?.bpSystolic, vitals?.bpDiastolic);
  const pulseEval = vitalsAlerts.evaluatePulse(vitals?.pulseBpm);
  const tempEval = vitalsAlerts.evaluateTemp(vitals?.tempCelsius);
  const glucoseEval = vitalsAlerts.evaluateGlucose(vitals?.bloodSugarMgDl, vitals?.bloodSugarType);
  const spo2Eval = vitalsAlerts.evaluateSpo2(vitals?.spo2Pct);
  const bmiEval = vitalsAlerts.calculateBmi(vitals?.weightKg, vitals?.heightCm);

  const isPregnant = Boolean(profile?.isPregnant || vitals?.isPregnant);
  const isLactating = Boolean(profile?.isLactating || vitals?.isLactating);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
      {/* Top Row: Demographics & Primary Flags */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm font-bold text-lg ${
              isFemale
                ? 'bg-gradient-to-tr from-rose-500 to-pink-400 ring-2 ring-pink-100'
                : 'bg-gradient-to-tr from-sky-600 to-teal-500 ring-2 ring-sky-100'
            }`}
          >
            {displayName.trim().charAt(0) || <User className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {displayName}
              </h2>
              {appointment?.isUrgent && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-100 border border-rose-300 px-2.5 py-0.5 rounded-full animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  أولوية قصوى (حالة عاجلة)
                </span>
              )}
              {appointment?.isConsultation && (
                <Badge variant="info" className="font-bold">
                  استشارة مجانية
                </Badge>
              )}
              {appointment?.queueNumber !== null && appointment?.queueNumber !== undefined && (
                <span className="text-xs font-mono font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg">
                  دور #{appointment.queueNumber}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1 font-mono">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                ملف: {fileNumber}
              </span>
              {ageYears !== undefined && (
                <span className="font-semibold text-slate-700">
                  {ageYears} سنة ({isFemale ? 'أنثى' : 'ذكر'})
                </span>
              )}
              {phone && (
                <span className="flex items-center gap-1 font-mono dir-ltr">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {phone}
                </span>
              )}
              {appointment?.serviceName && (
                <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  {appointment.serviceName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* High-Impact Clinical Warnings (Pregnancy & Lactation) */}
        <div className="flex flex-wrap items-center gap-2">
          {isPregnant && (
            <div className="flex items-center gap-1.5 bg-pink-100 text-pink-900 border border-pink-300 ring-2 ring-pink-400/20 px-3 py-1 rounded-xl text-xs font-bold animate-pulse">
              <Baby className="w-4 h-4 text-pink-600" />
              <span>حامل (تجنب الأدوية الممنوعة للحمل)</span>
            </div>
          )}
          {isLactating && (
            <div className="flex items-center gap-1.5 bg-purple-100 text-purple-900 border border-purple-300 px-3 py-1 rounded-xl text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>مرضع</span>
            </div>
          )}
        </div>
      </div>

      {/* Middle Row: Physiological Vitals Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center">
        {/* Blood Pressure */}
        <div
          className={`p-2 rounded-xl border text-xs ${
            bpEval.level === 'danger'
              ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
              : bpEval.level === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
          title={bpEval.detailAr || bpEval.labelAr}
        >
          <div className="text-[11px] text-slate-500 font-medium">ضغط الدم</div>
          <div className="font-bold font-mono text-sm mt-0.5">
            {vitals?.bpSystolic && vitals?.bpDiastolic
              ? `${vitals.bpSystolic}/${vitals.bpDiastolic}`
              : '---'}
            <span className="text-[10px] font-normal text-slate-400 mr-1">mmHg</span>
          </div>
        </div>

        {/* Pulse */}
        <div
          className={`p-2 rounded-xl border text-xs ${
            pulseEval.level === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
          title={pulseEval.detailAr || pulseEval.labelAr}
        >
          <div className="text-[11px] text-slate-500 font-medium">النبض</div>
          <div className="font-bold font-mono text-sm mt-0.5">
            {vitals?.pulseBpm ?? '---'}
            <span className="text-[10px] font-normal text-slate-400 mr-1">bpm</span>
          </div>
        </div>

        {/* Temperature */}
        <div
          className={`p-2 rounded-xl border text-xs ${
            tempEval.level === 'danger'
              ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
          title={tempEval.detailAr || tempEval.labelAr}
        >
          <div className="text-[11px] text-slate-500 font-medium">حرارة الجسم</div>
          <div className="font-bold font-mono text-sm mt-0.5">
            {vitals?.tempCelsius ? `${vitals.tempCelsius}°` : '---'}
            <span className="text-[10px] font-normal text-slate-400 mr-1">°C</span>
          </div>
        </div>

        {/* Blood Glucose */}
        <div
          className={`p-2 rounded-xl border text-xs ${
            glucoseEval.level === 'danger'
              ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
          title={glucoseEval.detailAr || glucoseEval.labelAr}
        >
          <div className="text-[11px] text-slate-500 font-medium">
            سكر الدم {vitals?.bloodSugarType ? `(${vitals.bloodSugarType === 'Fasting' ? 'صائم' : 'عشوائي'})` : ''}
          </div>
          <div className="font-bold font-mono text-sm mt-0.5">
            {vitals?.bloodSugarMgDl ?? '---'}
            <span className="text-[10px] font-normal text-slate-400 mr-1">mg/dL</span>
          </div>
        </div>

        {/* SpO2 */}
        <div
          className={`p-2 rounded-xl border text-xs ${
            spo2Eval.level === 'danger'
              ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
          title={spo2Eval.detailAr || spo2Eval.labelAr}
        >
          <div className="text-[11px] text-slate-500 font-medium">أكسجين SpO2</div>
          <div className="font-bold font-mono text-sm mt-0.5">
            {vitals?.spo2Pct ? `${vitals.spo2Pct}%` : '---'}
          </div>
        </div>

        {/* Weight / Height & BMI */}
        <div
          className={`p-2 rounded-xl border text-xs ${
            bmiEval.level === 'danger'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
          title={bmiEval.labelAr}
        >
          <div className="text-[11px] text-slate-500 font-medium">
            الوزن / BMI
          </div>
          <div className="font-bold font-mono text-sm mt-0.5">
            {vitals?.weightKg ? `${vitals.weightKg}kg` : '---'}
            {bmiEval.bmi ? ` (BMI ${bmiEval.bmi})` : ''}
          </div>
        </div>
      </div>

      {/* Bottom Row: Drug Allergies & Chronic Conditions Badges */}
      {(profile?.allergies?.length || 0) > 0 || (profile?.chronicConditions?.length || 0) > 0 ? (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          {/* Allergies */}
          {profile?.allergies?.map((allergy) => (
            <span
              key={allergy.id}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${
                allergy.severity === 'Severe'
                  ? 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-300/40 animate-pulse'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>
                حساسية: {allergy.allergyName}{' '}
                <bdi dir="ltr" className="font-mono text-[11px]">
                  ({allergy.activeIngredient})
                </bdi>
              </span>
            </span>
          ))}

          {/* Chronic Conditions */}
          {profile?.chronicConditions?.map((condition) => (
            <span
              key={condition.id}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200"
            >
              <HeartPulse className="w-3.5 h-3.5 text-sky-600" />
              <span>{condition.conditionName}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
