import { ThermalReceiptDto } from '../../types';
import { formatEgp } from '../../lib/currency';

export interface ThermalReceiptTemplateProps {
  receipt: ThermalReceiptDto;
}

export function ThermalReceiptTemplate({ receipt }: ThermalReceiptTemplateProps) {
  const getMethodTitle = (method: string) => {
    switch (method) {
      case 'Cash':
        return 'نقدي (Cash)';
      case 'Instapay':
        return 'إنستاباي (Instapay)';
      case 'VodafoneCash':
        return 'فودافون كاش (Vodafone Cash)';
      case 'Card':
        return 'بطاقة بنكية (Card)';
      default:
        return method;
    }
  };

  return (
    <div
      className="printable-receipt border border-slate-300 rounded-lg p-3 bg-white text-slate-900 font-sans shadow-inner w-[72mm] max-w-[80mm] mx-auto text-[11px] leading-tight"
      dir="rtl"
    >
      {/* Clinic Header */}
      <div className="text-center pb-2 border-b border-dashed border-slate-400 space-y-0.5">
        <h2 className="text-sm font-extrabold text-slate-950">
          {receipt.clinicName || 'العيادة التخصصية'}
        </h2>
        <p className="text-xs font-bold text-slate-800">{receipt.doctorName}</p>
        <p className="text-[10px] text-slate-600">{receipt.specialty}</p>
      </div>

      {/* Queue Number Callout */}
      {receipt.queueNumber != null && (
        <div className="my-2 py-1.5 text-center bg-slate-50 border-2 border-slate-900 rounded-md">
          <span className="text-[10px] font-bold text-slate-700 block">رقم الدور في الانتظار</span>
          <span className="text-3xl font-black text-slate-950 tracking-wider">
            {receipt.queueNumber}
          </span>
        </div>
      )}

      {/* Patient & Receipt Meta */}
      <div className="py-2 text-[11px] space-y-1 border-b border-dashed border-slate-300">
        <div className="flex justify-between">
          <span className="text-slate-500">رقم الإيصال:</span>
          <span className="font-mono font-bold text-slate-900">
            <bdi dir="ltr">{receipt.receiptNumber}</bdi>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">التاريخ:</span>
          <span className="text-slate-800">{receipt.date}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">اسم المريض:</span>
          <span className="font-bold text-slate-950">{receipt.patientName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">رقم الملف:</span>
          <span className="font-mono font-semibold text-slate-800">
            <bdi dir="ltr">#{receipt.fileNumber}</bdi>
          </span>
        </div>
      </div>

      {/* Service & Items */}
      <div className="py-2 text-[11px] space-y-1 border-b border-dashed border-slate-300">
        <div className="flex justify-between">
          <span className="font-semibold text-slate-800">الخدمة:</span>
          <span className="font-bold text-slate-950">{receipt.serviceName}</span>
        </div>
        {receipt.procedures && receipt.procedures.length > 0 && (
          <div className="pr-2 space-y-0.5 text-[10px] text-slate-600">
            {receipt.procedures.map((proc, idx) => (
              <div key={idx}>• {proc}</div>
            ))}
          </div>
        )}
      </div>

      {/* Money Math (Strictly Piastres -> EGP via formatEgp) */}
      <div className="py-2 text-[11px] space-y-1 border-b border-dashed border-slate-300">
        <div className="flex justify-between">
          <span className="text-slate-600">الإجمالي:</span>
          <span className="font-mono">{formatEgp(receipt.totalPiastres)}</span>
        </div>
        {receipt.discountPiastres > 0 && (
          <div className="flex justify-between text-rose-600">
            <span>الخصم:</span>
            <span className="font-mono">-{formatEgp(receipt.discountPiastres)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-slate-950 pt-0.5">
          <span>الصافي المطلوب:</span>
          <span className="font-mono">{formatEgp(receipt.netTotalPiastres)}</span>
        </div>
        <div className="flex justify-between font-bold text-emerald-700">
          <span>المدفوع:</span>
          <span className="font-mono">{formatEgp(receipt.paidPiastres)}</span>
        </div>
        {receipt.remainingPiastres > 0 ? (
          <div className="flex justify-between font-bold text-amber-700">
            <span>المتبقي:</span>
            <span className="font-mono">{formatEgp(receipt.remainingPiastres)}</span>
          </div>
        ) : (
          <div className="text-center font-bold text-emerald-800 text-[10px] py-0.5 bg-emerald-50 rounded mt-1">
            خالص تماماً ✅
          </div>
        )}
        <div className="flex justify-between pt-1 text-[10px] text-slate-500">
          <span>طريقة الدفع:</span>
          <span className="font-semibold text-slate-700">
            {getMethodTitle(receipt.paymentMethod)}
          </span>
        </div>
      </div>

      {/* Cashier Footer */}
      <div className="text-center pt-2 text-[10px] text-slate-500 space-y-0.5">
        <div>الموظف: {receipt.receptionistName}</div>
        <div className="text-[9px] text-slate-400">نتمنى لكم دوام الصحة والعافية</div>
      </div>
    </div>
  );
}
