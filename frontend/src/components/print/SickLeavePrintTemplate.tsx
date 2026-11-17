import { SickLeaveData } from '../../types/print';

export interface SickLeavePrintTemplateProps {
  data: SickLeaveData;
}

export function SickLeavePrintTemplate({ data }: SickLeavePrintTemplateProps) {
  return (
    <div
      className="bg-white text-slate-900 font-sans p-6 sm:p-8 rounded-xl max-w-[148mm] mx-auto border border-slate-300 print:border-none print:p-0 print:m-0"
      dir="rtl"
    >
      {/* Header */}
      <div className="text-center border-b-2 border-sky-700 pb-3 mb-4">
        <h2 className="text-lg font-black text-sky-950 mb-0.5">{data.clinicName}</h2>
        <div className="text-xs font-bold text-slate-700">
          {data.doctorName} — {data.doctorTitle}
        </div>
        <div className="inline-block bg-sky-100 text-sky-800 font-bold px-3 py-1 rounded-full text-xs mt-2">
          شهادة طبية / تقرير إجازة مرضية (Sick Leave Certificate)
        </div>
      </div>

      {/* Patient & Consultation Narrative Box */}
      <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50 mb-4 text-xs leading-relaxed">
        <p className="mb-2">
          يفيد الطبيب المعالج بأن المريض /{' '}
          <strong className="text-slate-950 font-bold">{data.patientName}</strong>
          {data.ageYears !== undefined ? ` (${data.ageYears} سنة)` : ''}، المقيد بالملف الطبي رقم{' '}
          <strong className="text-slate-950 font-mono">
            <bdi dir="ltr">#{data.fileNumber}</bdi>
          </strong>
          ، قد قام بمراجعة العيادة وتوقيع الكشف الطبي عليه بتاريخ{' '}
          <strong className="text-slate-950">{data.issueDate}</strong>.
        </p>
        <p>
          وبعد الفحص الإكلينيكي اللازم، تبين أنه يعاني من حالة:{' '}
          <strong className="text-slate-950 font-bold">{data.diagnosis}</strong>.
        </p>
      </div>

      {/* Recommended Leave Box */}
      <div className="border-2 border-sky-600 bg-sky-50/60 rounded-xl p-3.5 text-center my-3.5 space-y-1.5">
        <div className="text-xs text-slate-700">
          يوصى بمنح المريض راحة تامة وإجازة مرضية عن العمل والدراسة لمدة:
        </div>
        <div className="text-2xl font-black text-sky-800">
          {data.leaveDays} {data.leaveDays === 1 ? 'يوم' : data.leaveDays === 2 ? 'يومان' : 'أيام'}
        </div>
        <div className="text-xs text-slate-800 font-medium">
          تبدأ من تاريخ <strong>{data.startDate}</strong> وحتى تاريخ <strong>{data.endDate}</strong>
        </div>
        <div className="text-[11px] text-slate-600 pt-1">
          تاريخ العودة للعمل المفترض: <strong className="text-slate-900">{data.returnToWorkDate}</strong>
        </div>
      </div>

      {/* Notes / Clinical Instructions */}
      {data.notes && (
        <div className="text-xs text-slate-700 mb-3 bg-white border border-slate-200 p-2.5 rounded-lg">
          <strong className="text-slate-900">توصيات وملاحظات إضافية: </strong>
          <span>{data.notes}</span>
        </div>
      )}

      {/* Official Footnote */}
      <div className="text-[10px] text-slate-500 mb-6 italic">
        * هذه الشهادة معتمدة وموجهة لجهة العمل أو الدراسة. يعتبر أي كشط أو تعديل بالبيانات لاغياً للشهادة.
      </div>

      {/* Signatures & Stamp */}
      <div className="flex items-end justify-between pt-2 border-t border-slate-200 text-xs">
        <div>
          <div className="text-slate-500 text-[11px]">تحريراً في: {data.issueDate}</div>
        </div>

        {/* Clinic Stamp Placeholder */}
        <div className="w-28 h-16 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-[10px] text-slate-400 font-semibold">
          خاتم العيادة
        </div>

        {/* Doctor Signature */}
        <div className="text-center min-w-[130px]">
          <div className="font-bold text-slate-800">توقيع الطبيب المعالج</div>
          <div className="h-8 border-b border-dashed border-slate-400 my-1"></div>
          <div className="text-[11px] text-slate-500">{data.doctorName}</div>
        </div>
      </div>
    </div>
  );
}
