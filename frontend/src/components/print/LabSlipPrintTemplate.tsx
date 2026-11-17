import { LabSlipData } from '../../types/print';

export interface LabSlipPrintTemplateProps {
  data: LabSlipData;
}

export function LabSlipPrintTemplate({ data }: LabSlipPrintTemplateProps) {
  return (
    <div
      className="bg-white text-slate-900 font-sans p-6 rounded-xl max-w-[148mm] mx-auto border border-slate-300 print:border-none print:p-0 print:m-0"
      dir="rtl"
    >
      {/* Header */}
      <div className="border-b-2 border-indigo-700 pb-3 mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-black text-indigo-950 mb-0.5">{data.clinicName}</h3>
          <div className="text-xs font-bold text-slate-800">{data.doctorName}</div>
          <div className="text-[10px] text-slate-500">{data.doctorTitle}</div>
        </div>
        <div className="text-left text-xs">
          <div className="font-bold text-indigo-800">طلب تحاليل وفحوصات طبية</div>
          <div className="text-slate-500 text-[11px]">التاريخ: {data.date}</div>
        </div>
      </div>

      {/* Patient Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-3 flex items-center justify-between text-xs">
        <div>
          <span className="text-slate-500">اسم المريض: </span>
          <span className="font-bold text-slate-900">{data.patientName}</span>
        </div>
        <div>
          <span className="text-slate-500">رقم الملف: </span>
          <span className="font-mono font-bold text-slate-900">
            <bdi dir="ltr">#{data.fileNumber}</bdi>
          </span>
        </div>
        {data.ageYears !== undefined && (
          <div>
            <span className="text-slate-500">السن: </span>
            <span className="font-semibold text-slate-800">{data.ageYears} سنة</span>
          </div>
        )}
      </div>

      {/* Clinical Indication */}
      {data.provisionalDiagnosis && (
        <div className="mb-3 text-xs">
          <span className="font-bold text-slate-700">التشخيص المبدئي (Clinical Indication): </span>
          <span className="font-semibold text-slate-900">{data.provisionalDiagnosis}</span>
        </div>
      )}

      {/* Requests Table */}
      <table className="w-full border-collapse border border-slate-300 text-xs mb-3">
        <thead>
          <tr className="bg-slate-100 text-slate-800">
            <th className="border border-slate-300 p-1.5 w-8 text-center">#</th>
            <th className="border border-slate-300 p-1.5 w-10 text-center">تم</th>
            <th className="border border-slate-300 p-1.5 w-16 text-center">النوع</th>
            <th className="border border-slate-300 p-1.5 text-right">اسم الفحص المطلوب</th>
            <th className="border border-slate-300 p-1.5 text-right">ملاحظات الطبيب</th>
          </tr>
        </thead>
        <tbody>
          {data.requests.map((req, idx) => (
            <tr key={idx} className="border-b border-slate-200">
              <td className="border border-slate-300 p-1.5 text-center font-bold text-slate-600">
                {idx + 1}
              </td>
              <td className="border border-slate-300 p-1.5 text-center">
                <span className="inline-block w-3.5 h-3.5 border-1.5 border-slate-500 rounded-xs"></span>
              </td>
              <td className="border border-slate-300 p-1.5 text-center font-bold text-[10px]">
                <span
                  className={
                    req.requestType === 'Lab'
                      ? 'text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded'
                      : 'text-purple-700 bg-purple-50 px-1 py-0.5 rounded'
                  }
                >
                  {req.requestType === 'Lab' ? 'تحليل دم' : 'أشعة'}
                </span>
              </td>
              <td className="border border-slate-300 p-1.5">
                <div className="font-bold text-slate-900">{req.nameAr}</div>
                {req.nameEn && (
                  <div className="text-[11px] text-slate-500 font-mono">
                    <bdi dir="ltr">{req.nameEn}</bdi>
                  </div>
                )}
              </td>
              <td className="border border-slate-300 p-1.5 text-slate-600 text-[11px]">
                {req.notes || '---'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Special Lab Instructions */}
      {data.clinicalNotes && (
        <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-2.5 mb-4 text-xs text-amber-900">
          <strong className="font-bold">تعليمات وتحذيرات خاصة للمعمل / مركز الأشعة: </strong>
          <span>{data.clinicalNotes}</span>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-slate-200 pt-3 flex items-end justify-between text-xs">
        <div className="text-[10px] text-slate-500 max-w-[200px]">
          يرجى تزويد المريض بنتائج الفحص في أقرب وقت لإعادة المتابعة وتقييم الحالة.
        </div>

        <div className="text-center min-w-[130px]">
          <div className="font-bold text-slate-800">توقيع الطبيب</div>
          <div className="h-8 border-b border-dashed border-slate-400 my-1"></div>
          <div className="text-[11px] text-slate-500">{data.doctorName}</div>
        </div>
      </div>
    </div>
  );
}
