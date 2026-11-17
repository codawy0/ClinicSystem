import { Printer } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { ThermalReceiptDto } from '../../types';
import { formatEgp } from '../../lib/currency';

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: ThermalReceiptDto | null;
}

export function ThermalReceiptModal({ isOpen, onClose, receipt }: ThermalReceiptModalProps) {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const getMethodTitle = (method: string) => {
    switch (method) {
      case 'Cash': return 'نقدي (Cash)';
      case 'Instapay': return 'إنستاباي (Instapay)';
      case 'VodafoneCash': return 'فودافون كاش (Vodafone Cash)';
      case 'Card': return 'بطاقة بنكية (Card)';
      default: return method;
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="إيصال سداد - كشف العيادة"
      maxWidth="sm"
    >
      <div className="space-y-4">
        {/* Printable 80mm Container */}
        <div className="printable-receipt border border-slate-300 rounded-lg p-4 bg-white text-slate-900 font-sans shadow-inner">
          <div className="text-center pb-3 border-b border-dashed border-slate-400 space-y-0.5">
            <h2 className="text-base font-extrabold text-slate-950">{receipt.clinicName || 'العيادة التخصصية'}</h2>
            <p className="text-xs font-bold text-slate-800">{receipt.doctorName}</p>
            <p className="text-[10px] text-slate-600">{receipt.specialty}</p>
          </div>

          {/* Queue Number Callout */}
          {receipt.queueNumber != null && (
            <div className="my-3 py-2 text-center bg-slate-50 border border-slate-300 rounded-md">
              <span className="text-[10px] font-semibold text-slate-600 block">رقم الدور في الانتظار</span>
              <span className="text-3xl font-extrabold text-slate-950 tracking-wider">
                {receipt.queueNumber}
              </span>
            </div>
          )}

          {/* Patient Details */}
          <div className="py-2 text-[11px] space-y-1 border-b border-dashed border-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-500">رقم الإيصال:</span>
              <span className="font-mono font-bold text-slate-800">{receipt.receiptNumber}</span>
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
              <span className="font-mono font-semibold text-slate-800">{receipt.fileNumber}</span>
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
                {receipt.procedures.map((p, i) => (
                  <div key={i}>• {p}</div>
                ))}
              </div>
            )}
          </div>

          {/* Financial Breakdown */}
          <div className="py-2 text-[11px] space-y-1 border-b border-dashed border-slate-300">
            <div className="flex justify-between text-slate-600">
              <span>الإجمالي:</span>
              <span>{formatEgp(receipt.totalPiastres)}</span>
            </div>
            {receipt.discountPiastres > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>الخصم:</span>
                <span>-{formatEgp(receipt.discountPiastres)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
              <span>الصافي المطلوب:</span>
              <span>{formatEgp(receipt.netTotalPiastres)}</span>
            </div>
            <div className="flex justify-between font-bold text-emerald-700">
              <span>المدفوع:</span>
              <span>{formatEgp(receipt.paidPiastres)}</span>
            </div>
            {receipt.remainingPiastres > 0 ? (
              <div className="flex justify-between font-bold text-rose-700">
                <span>المتبقي:</span>
                <span>{formatEgp(receipt.remainingPiastres)}</span>
              </div>
            ) : (
              <div className="flex justify-between font-semibold text-emerald-800">
                <span>حالة الحساب:</span>
                <span>خالص تماماً ✅</span>
              </div>
            )}
            <div className="flex justify-between text-[10px] text-slate-500 pt-1">
              <span>طريقة الدفع:</span>
              <span>{getMethodTitle(receipt.paymentMethod)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 text-center text-[9px] text-slate-500 space-y-0.5">
            <p>الموظف: {receipt.receptionistName}</p>
            <p className="font-semibold text-slate-700">نتمنى لكم دوام الصحة والعافية</p>
          </div>
        </div>

        {/* Action Buttons (Excluded from print) */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
          <Button variant="primary" onClick={handlePrint} className="bg-slate-900 hover:bg-slate-800">
            <Printer className="w-4 h-4 ml-1" />
            طباعة الإيصال (80mm)
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
