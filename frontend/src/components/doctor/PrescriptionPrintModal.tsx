import { useState } from 'react';
import {
  Printer,
  Stethoscope,
  FlaskConical,
  FileCheck,
} from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import {
  PatientClinicalProfileDto,
  LiveQueueItemDto,
  MedicalVisitDetailDto,
  PrescriptionItemInputDto,
  ClinicalRequestInputDto,
  ClinicSettingDto,
} from '../../types';
import { printService } from '../../services/printService';

export interface PrescriptionPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientClinicalProfileDto | null;
  appointment: LiveQueueItemDto | null;
  vitals?: MedicalVisitDetailDto | null;
  diagnosis: string;
  items: PrescriptionItemInputDto[];
  clinicalRequests: ClinicalRequestInputDto[];
  nextVisitDate?: string;
  clinicSetting?: ClinicSettingDto | null;
}

export function PrescriptionPrintModal({
  isOpen,
  onClose,
  patient,
  appointment,
  vitals,
  diagnosis,
  items,
  clinicalRequests,
  nextVisitDate,
  clinicSetting,
}: PrescriptionPrintModalProps) {
  // Mode: 'digital' = full header & footer; 'letterhead' = blank 45mm margin for pre-printed pads
  const [printMode, setPrintMode] = useState<'digital' | 'letterhead'>('digital');
  const [pageSize, setPageSize] = useState<'A5' | 'A4'>('A5');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isPrintingLabSlip, setIsPrintingLabSlip] = useState<boolean>(false);

  if (!isOpen) return null;

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

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printService.printPrescription(
        {
          patient,
          appointment,
          vitals,
          diagnosis,
          items,
          clinicalRequests,
          nextVisitDate,
          clinicSetting,
        },
        {
          pageSize,
          mode: printMode,
        }
      );
    } catch (err) {
      console.error('Failed to print prescription:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintLabSlip = async () => {
    if (clinicalRequests.length === 0) return;
    setIsPrintingLabSlip(true);
    try {
      await printService.printLabSlip({
        patientName,
        fileNumber,
        ageYears,
        gender,
        doctorName: clinicSetting?.doctorName || 'د. طبيب العيادة',
        doctorTitle: clinicSetting?.doctorTitle || 'استشاري العيادة',
        clinicName: clinicSetting?.clinicName || 'العيادة التخصصية',
        date: todayStr,
        provisionalDiagnosis: diagnosis,
        requests: clinicalRequests.map((r) => ({
          requestType: r.requestType === 'Lab' ? 'Lab' : 'Radiology',
          nameAr: r.nameAr,
          nameEn: r.nameEn,
          notes: r.notes,
        })),
        clinicalNotes: diagnosis ? `التشخيص المبدئي: ${diagnosis}` : undefined,
      });
    } catch (err) {
      console.error('Failed to print lab slip:', err);
    } finally {
      setIsPrintingLabSlip(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="معاينة وطباعة الروشتة العلاجية (Rx Pad)"
      description="اختر نمط الطباعة ومقاس الورق (ورق عيادة مسبق الطباعة أو روشتة إلكترونية كاملة)"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Print Mode & Page Size Selector Bar (Hidden in Print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            {/* Mode: Digital vs Letterhead */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">النمط:</span>
              <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPrintMode('digital')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    printMode === 'digital'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  روشتة كاملة
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode('letterhead')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    printMode === 'letterhead'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ورق عيادة (Letterhead 45mm)
                </button>
              </div>
            </div>

            {/* Size: A5 vs A4 */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">المقاس:</span>
              <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPageSize('A5')}
                  className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                    pageSize === 'A5'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  A5
                </button>
                <button
                  type="button"
                  onClick={() => setPageSize('A4')}
                  className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                    pageSize === 'A4'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  A4
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {clinicalRequests.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrintLabSlip}
                disabled={isPrintingLabSlip}
                className="text-xs text-indigo-700 border-indigo-300 hover:bg-indigo-50 gap-1.5"
                title="طباعة طلب الفحوصات والتحاليل في إيصال منفصل"
              >
                <FileCheck className="w-4 h-4" />
                <span>طباعة طلب الفحوصات</span>
              </Button>
            )}

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting}
              className="bg-sky-600 hover:bg-sky-700 text-white font-bold gap-1.5 shadow-sm text-xs"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'جاري الطباعة...' : 'طباعة الآن (Print)'}</span>
            </Button>
          </div>
        </div>

        {/* Prescription Paper Container (A5/A4 Aspect / Preview) */}
        <div className="bg-white border-2 border-slate-300 rounded-2xl p-6 sm:p-8 shadow-inner font-sans text-slate-900 max-h-[68vh] overflow-y-auto print:max-h-none print:overflow-visible print:border-none print:p-0 print:m-0 print:shadow-none print-prescription-root">
          {/* Header Section */}
          {printMode === 'digital' ? (
            <div className="border-b-2 border-sky-600 pb-4 mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-600 flex items-center justify-center text-white shadow-sm">
                  <Stethoscope className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-sky-950">
                    {clinicSetting?.clinicName || 'عيادة النخبة التخصصية'}
                  </h2>
                  <p className="text-sm font-bold text-sky-800">
                    {clinicSetting?.doctorName || 'د. استشاري العيادة'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {clinicSetting?.doctorTitle || clinicSetting?.specialty || 'استشاري الأمراض الباطنية والجهاز الهضمي'}
                  </p>
                </div>
              </div>

              <div className="text-left text-xs text-slate-500 font-mono">
                <div>التاريخ: {todayStr}</div>
                <div>الملف: <bdi dir="ltr">#{fileNumber}</bdi></div>
              </div>
            </div>
          ) : (
            // Letterhead mode: Blank 45mm spacing to accommodate pre-printed clinic letterhead
            <div className="h-28 print:h-[45mm] flex items-center justify-center border-b border-dashed border-slate-200 mb-4 print:border-none text-slate-300 text-xs italic">
              [مساحة مخصصة لورق العيادة المطبوع مسبقاً - 45mm]
            </div>
          )}

          {/* Patient Demographics Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 mb-5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-slate-500">اسم المريض: </span>
                <span className="font-bold text-slate-900 text-sm">{patientName}</span>
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
                  <span className="font-semibold text-slate-800">{gender === 'Female' ? 'أنثى' : 'ذكر'}</span>
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

          {/* Diagnosis (if present) */}
          {diagnosis && (
            <div className="mb-4 text-xs">
              <span className="font-bold text-slate-700">التشخيص (Diagnosis): </span>
              <span className="font-semibold text-slate-900">{diagnosis}</span>
            </div>
          )}

          {/* Rx Symbol & Medication List */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-2 text-2xl font-serif font-black text-sky-800 select-none">
              <span>℞</span>
              <div className="h-0.5 flex-1 bg-slate-200" />
            </div>

            {items.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">لم يتم تسجيل أدوية في هذه الروشتة</p>
            ) : (
              <ol className="space-y-3.5 pr-2">
                {items.map((item, idx) => (
                  <li key={idx} className="space-y-0.5">
                    {/* Drug Line with <bdi dir="ltr"> */}
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono font-bold text-sm text-slate-400 w-5">
                        {idx + 1}.
                      </span>
                      <div className="font-bold text-base text-slate-950">
                        <bdi dir="ltr">{item.drugName}</bdi>
                        {item.strength && (
                          <span className="text-sm font-mono text-slate-700 mr-2">
                            <bdi dir="ltr">{item.strength}</bdi>
                          </span>
                        )}
                        {item.form && (
                          <span className="text-xs font-normal text-slate-500 mr-2">
                            ({item.form})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dosage & Timing Line in Arabic */}
                    <div className="pr-7 text-xs sm:text-sm font-semibold text-slate-800 flex flex-wrap items-center gap-2">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-sky-900 font-bold">
                        {item.dosage}
                      </span>
                      <span>—</span>
                      <span>{item.timing}</span>
                      {item.duration && (
                        <>
                          <span>—</span>
                          <span className="text-slate-600">لمدة {item.duration}</span>
                        </>
                      )}
                    </div>

                    {/* Patient Instructions */}
                    {item.instructions && (
                      <div className="pr-7 text-xs text-slate-500 italic">
                        * {item.instructions}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Clinical Requests (Lab / Radiology Orders) */}
          {clinicalRequests.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-3.5 mb-6 bg-slate-50/60">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 mb-2 border-b border-slate-200 pb-1.5">
                <FlaskConical className="w-4 h-4 text-indigo-600" />
                <span>الفحوصات والتحاليل المطلوبة (Lab & Radiology Orders)</span>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {clinicalRequests.map((req, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                    <span className="font-semibold text-slate-800">{req.nameAr}</span>
                    {req.nameEn && (
                      <span className="font-mono text-[11px] text-slate-500">
                        <bdi dir="ltr">({req.nameEn})</bdi>
                      </span>
                    )}
                    {req.notes && (
                      <span className="text-[10px] text-slate-400">[{req.notes}]</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Consultation Date & Doctor Signature Footer */}
          <div className="pt-6 border-t-2 border-slate-200 flex items-end justify-between gap-6 text-xs">
            <div>
              {nextVisitDate ? (
                <div className="bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-lg text-sky-900">
                  <span className="font-bold">موعد الاستشارة القادمة: </span>
                  <span className="font-mono font-semibold">{nextVisitDate}</span>
                </div>
              ) : (
                <div className="text-slate-400 text-[11px]">
                  تمنياتنا للمريض بالشفاء العاجل ودوام الصحة والعافية.
                </div>
              )}
            </div>

            <div className="text-center space-y-3 min-w-[140px]">
              <span className="font-bold text-slate-700 block">توقيع الطبيب المعالج</span>
              <div className="h-10 border-b border-dashed border-slate-400" />
              <span className="text-[11px] text-slate-500 block">
                {clinicSetting?.doctorName || 'د. الطبيب'}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions (Hidden in Print) */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 print:hidden">
          <Button variant="outline" size="sm" onClick={onClose}>
            إغلاق
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            disabled={isPrinting}
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>{isPrinting ? 'جاري الطباعة...' : 'طباعة الروشتة (Print)'}</span>
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
