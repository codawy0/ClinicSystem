import {
  User,
  Phone,
  FileText,
  AlertTriangle,
  ShieldAlert,
  HeartPulse,
  Baby,
  Edit3,
  Sparkles,
} from 'lucide-react';
import { PatientClinicalProfileDto, LiveQueueItemDto, AllergySeverity } from '../../types';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface PatientClinicalHeaderProps {
  profile: PatientClinicalProfileDto | null;
  appointment: LiveQueueItemDto | null;
  onOpenClinicalModal: () => void;
  isLoading: boolean;
}

export function PatientClinicalHeader({
  profile,
  appointment,
  onOpenClinicalModal,
  isLoading,
}: PatientClinicalHeaderProps) {
  if (isLoading && !profile && !appointment) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-1/3 mb-3"></div>
        <div className="h-4 bg-slate-100 rounded w-1/2"></div>
      </div>
    );
  }

  if (!appointment && !profile) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6 text-center text-slate-500">
        <User className="w-8 h-8 mx-auto text-slate-400 mb-2" />
        <p className="text-sm font-semibold">لم يتم تحديد مريض</p>
        <p className="text-xs text-slate-400 mt-1">اختر مريضاً من القائمة الجانبية لبدء الفحص وإدخال العلامات الحيوية</p>
      </div>
    );
  }

  const fullName = profile?.fullName || appointment?.patientName || 'مريض';
  const fileNumber = profile?.fileNumber || appointment?.fileNumber || '';
  const phone = profile?.phone || appointment?.phone || '';
  const gender = profile?.gender || 'Male';
  const isFemale = gender === 'Female';
  const ageYears = profile?.ageYears;
  const isUrgent = appointment?.isUrgent || false;
  const isPregnant = profile?.isPregnant || false;
  const isLactating = profile?.isLactating || false;
  const allergies = profile?.allergies || [];
  const chronicConditions = profile?.chronicConditions || [];

  const getAllergyBadgeStyle = (severity: AllergySeverity) => {
    switch (severity) {
      case 'Severe':
        return 'text-rose-700 bg-rose-50 border-rose-300 ring-1 ring-rose-200';
      case 'Moderate':
        return 'text-amber-800 bg-amber-50 border-amber-300 ring-1 ring-amber-200';
      case 'Mild':
        return 'text-yellow-800 bg-yellow-50 border-yellow-300';
      default:
        return 'text-slate-700 bg-slate-100 border-slate-200';
    }
  };

  const getSeverityLabel = (severity: AllergySeverity) => {
    switch (severity) {
      case 'Severe':
        return 'شديدة الخطورة';
      case 'Moderate':
        return 'متوسطة';
      case 'Mild':
        return 'خفيفة';
      default:
        return severity;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-right space-y-3">
      {/* Top Banner: Demographics & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-md flex-shrink-0',
              isFemale
                ? 'bg-gradient-to-tr from-pink-500 to-rose-400 shadow-rose-200'
                : 'bg-gradient-to-tr from-sky-600 to-teal-500 shadow-teal-200'
            )}
          >
            <User className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-black text-slate-900">{fullName}</h1>

              {isUrgent && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-300 rounded-full px-2 py-0.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  حالة طارئة
                </span>
              )}

              {appointment?.queueNumber !== null && appointment?.queueNumber !== undefined && (
                <span className="text-xs font-bold font-mono bg-slate-800 text-white rounded-md px-2 py-0.5">
                  دور رقم #{appointment.queueNumber}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                رقم الملف: <strong className="font-mono text-slate-700">#{fileNumber}</strong>
              </span>

              <span>•</span>

              <span>
                الجنس: <strong>{isFemale ? 'أنثى' : 'ذكر'}</strong>
              </span>

              {ageYears !== undefined && ageYears !== null && (
                <>
                  <span>•</span>
                  <span>
                    العمر: <strong>{ageYears} سنة</strong>
                  </span>
                </>
              )}

              {phone && (
                <>
                  <span>•</span>
                  <a
                    href={`tel:${phone}`}
                    className="flex items-center gap-1 text-teal-600 hover:text-teal-700 hover:underline dir-ltr font-mono"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {phone}
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right side / Action side */}
        <div className="flex items-center gap-2 self-end md:self-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenClinicalModal}
            className="text-xs border-teal-300 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
          >
            <Edit3 className="w-3.5 h-3.5 ml-1" />
            إدارة الحساسيات والأمراض المزمنة
          </Button>
        </div>
      </div>

      {/* Bottom Bar: Clinical Alerts, Allergies, Chronic Conditions & Female Status */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {/* Female Pregnancy / Lactation Status */}
        {isFemale && (
          <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
            {isPregnant ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2.5 py-1">
                <Baby className="w-3.5 h-3.5 text-purple-600" />
                حامل
              </span>
            ) : null}

            {isLactating ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-pink-50 text-pink-700 border border-pink-200 rounded-full px-2.5 py-1">
                <Sparkles className="w-3.5 h-3.5 text-pink-600" />
                مرضعة
              </span>
            ) : null}

            {!isPregnant && !isLactating && (
              <span className="text-[11px] text-slate-400">لا يوجد حمل أو رضاعة مسجلين</span>
            )}
          </div>
        )}

        {/* Drug Allergies */}
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          <div className="flex items-center gap-1 text-xs font-bold text-slate-700">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span>الحساسيات الدوائية:</span>
          </div>

          {allergies.length === 0 ? (
            <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
              لا توجد حساسيات مسجلة
            </span>
          ) : (
            allergies.map((allergy) => (
              <span
                key={allergy.id}
                title={`المادة الفعالة: ${allergy.activeIngredient} (${getSeverityLabel(allergy.severity)})`}
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-bold border rounded-full px-2.5 py-0.5',
                  getAllergyBadgeStyle(allergy.severity)
                )}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>{allergy.allergyName || allergy.activeIngredient}</span>
                <span className="text-[10px] opacity-80">({getSeverityLabel(allergy.severity)})</span>
              </span>
            ))
          )}
        </div>

        {/* Chronic Conditions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 text-xs font-bold text-slate-700">
            <HeartPulse className="w-4 h-4 text-sky-500" />
            <span>الأمراض المزمنة:</span>
          </div>

          {chronicConditions.length === 0 ? (
            <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
              لا توجد أمراض مزمنة مسجلة
            </span>
          ) : (
            chronicConditions.map((cond) => (
              <span
                key={cond.id}
                title={cond.notes || cond.conditionCode}
                className="inline-flex items-center gap-1 text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200 rounded-full px-2.5 py-0.5"
              >
                <span>{cond.conditionName}</span>
                {cond.conditionCode && (
                  <span className="text-[10px] text-sky-600 font-mono">({cond.conditionCode})</span>
                )}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
