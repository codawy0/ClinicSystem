import { Stethoscope } from 'lucide-react';
import {
  PatientClinicalProfileDto,
  LiveQueueItemDto,
  MedicalVisitDetailDto,
  PrescriptionItemInputDto,
  ClinicalRequestInputDto,
  ClinicSettingDto,
} from '../../types';

export interface PrescriptionPrintTemplateProps {
  patient: PatientClinicalProfileDto | null;
  appointment: LiveQueueItemDto | null;
  vitals?: MedicalVisitDetailDto | null;
  diagnosis: string;
  items: PrescriptionItemInputDto[];
  clinicalRequests: ClinicalRequestInputDto[];
  nextVisitDate?: string;
  clinicSetting?: ClinicSettingDto | null;
  pageSize?: 'A4' | 'A5';
  mode?: 'digital' | 'letterhead'; // letterhead suppresses clinic header and introduces 45mm margin
}

export function PrescriptionPrintTemplate({
  patient,
  appointment,
  vitals,
  diagnosis,
  items,
  clinicalRequests,
  nextVisitDate,
  clinicSetting,
  pageSize = 'A5',
  mode = 'digital',
}: PrescriptionPrintTemplateProps) {
  const patientName = patient?.fullName || appointment?.patientName || '---';
  const fileNumber = patient?.fileNumber || appointment?.fileNumber || '---';
  const ageYears = patient?.ageYears;
  const gender = patient?.gender || (appointment as any)?.gender;
  const weightKg = vitals?.weightKg;
  const todayStr = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const isLetterhead = mode === 'letterhead';
  const isA4 = pageSize === 'A4';

  return (
    <div
      className={`bg-white text-slate-900 font-sans p-6 sm:p-8 rounded-xl print:p-0 print:m-0 print:border-none print-prescription-root ${
        isA4 ? 'max-w-[210mm]' : 'max-w-[148mm]'
      } mx-auto`}
      dir="rtl"
    >
      {/* Clinic Header (Suppressed in Letterhead Mode) */}
      {!isLetterhead ? (
        <div className="border-b-2 border-sky-600 pb-4 mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-xs">
              <Stethoscope className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-black text-sky-950">
                {clinicSetting?.clinicName || 'عيادة النخبة التخصصية'}
              </h2>
              <p className="text-sm font-bold text-sky-800">
                {clinicSetting?.doctorName || 'د. استشاري العيادة'}
              </p>
              <p className="text-xs text-slate-500">
                {clinicSetting?.doctorTitle || clinicSetting?.specialty || 'استشاري الأمراض الباطنية'}
              </p>
            </div>
          </div>

          <div className="text-left text-xs text-slate-500 font-mono">
            <div>التاريخ: {todayStr}</div>
            <div>الملف: <bdi dir="ltr">#{fileNumber}</bdi></div>
          </div>
        </div>
      ) : (
        /* Letterhead Spacing: 45mm top margin reserved for pre-printed clinic stationery */
        <div className="h-28 print:h-[45mm] flex items-center justify-center border-b border-dashed border-slate-200 mb-4 print:border-none text-slate-300 text-xs italic">
          [مساحة مخصصة لورق العيادة المطبوع مسبقاً - 45mm]
        </div>
      )}

      {/* Patient Demographics Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 mb-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-slate-500">اسم المريض: </span>
            <span className="font-bold text-slate-900">{patientName}</span>
          </div>
          {ageYears !== undefined && (
            <div>
              <span className="text-slate-500">السن: </span>
              <span className="font-semibold text-slate-800">{ageYears} سنة</span>
            </div>
          )}
          {gender && (
            <div>
              <span className="text-slate-500">النوع: </span>
              <span className="font-semibold text-slate-800">
                {gender === 'Female' ? 'أنثى' : 'ذكر'}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 font-mono">
          {weightKg && (
            <div>
              <span className="text-slate-500 font-sans">الوزن: </span>
              <span className="font-bold text-slate-900">{weightKg} kg</span>
            </div>
          )}
          <div>
            <span className="text-slate-500 font-sans">رقم الملف: </span>
            <span className="font-bold text-slate-800"><bdi dir="ltr">#{fileNumber}</bdi></span>
          </div>
          <div>
            <span className="text-slate-500 font-sans">التاريخ: </span>
            <span className="text-slate-700">{todayStr}</span>
          </div>
        </div>
      </div>

      {/* Diagnosis */}
      {diagnosis && (
        <div className="mb-4 text-xs">
          <span className="font-bold text-slate-700">التشخيص (Diagnosis): </span>
          <span className="font-semibold text-slate-900">{diagnosis}</span>
        </div>
      )}

      {/* Rx Section */}
      <div className="text-2xl font-serif font-black text-sky-800 select-none mb-3 border-b border-slate-200 pb-1">
        ℞
      </div>

      {/* Medications */}
      <div className="space-y-3.5 mb-6">
        {items.map((item, idx) => (
          <div key={idx} className="border-b border-slate-100 pb-2.5 last:border-none break-inside-avoid">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-sky-700 text-xs">{idx + 1}.</span>
              <span className="font-bold text-slate-900 text-sm">
                <bdi dir="ltr">{item.drugName}</bdi>
              </span>
              {item.strength && (
                <span className="text-xs font-mono text-slate-600">
                  <bdi dir="ltr">({item.strength})</bdi>
                </span>
              )}
              {item.form && (
                <span className="text-[11px] text-slate-500">[{item.form}]</span>
              )}
            </div>

            <div className="mr-5 text-xs text-slate-700 mt-1 flex flex-wrap gap-2">
              <span>{item.dosage}</span>
              <span>• {item.timing}</span>
              {item.duration && <span>• لمدة {item.duration}</span>}
            </div>

            {item.instructions && (
              <div className="mr-5 text-[11px] text-slate-500 italic mt-0.5">
                * {item.instructions}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Clinical Requests Box */}
      {clinicalRequests.length > 0 && (
        <div className="border border-slate-200 bg-slate-50 rounded-lg p-3 mb-6 break-inside-avoid">
          <h4 className="text-xs font-bold text-slate-800 mb-2">الفحوصات والتحاليل المطلوبة:</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {clinicalRequests.map((req, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="text-slate-400">•</span>
                <span className="font-semibold">{req.nameAr}</span>
                {req.nameEn && (
                  <span className="text-slate-500 font-mono text-[11px]">
                    <bdi dir="ltr">({req.nameEn})</bdi>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-slate-200 pt-3 flex items-end justify-between break-inside-avoid">
        <div>
          {nextVisitDate && (
            <div className="text-xs text-slate-700">
              <span className="font-bold">موعد الاستشارة القادمة: </span>
              <span>{nextVisitDate}</span>
            </div>
          )}
        </div>

        <div className="text-center min-w-[140px]">
          <div className="text-xs font-bold text-slate-800">توقيع الطبيب</div>
          <div className="h-8 border-b border-dashed border-slate-400 my-1"></div>
          <div className="text-[11px] text-slate-500">{clinicSetting?.doctorName || ''}</div>
        </div>
      </div>
    </div>
  );
}
