import { useState } from 'react';
import { Printer } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { printService } from '../../services/printService';
import { PatientClinicalProfileDto, LiveQueueItemDto, ClinicSettingDto } from '../../types';

export interface SickLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientClinicalProfileDto | null;
  appointment: LiveQueueItemDto | null;
  currentDiagnosis: string;
  clinicSetting?: ClinicSettingDto | null;
}

export function SickLeaveModal({
  isOpen,
  onClose,
  patient,
  appointment,
  currentDiagnosis,
  clinicSetting,
}: SickLeaveModalProps) {
  const [leaveDays, setLeaveDays] = useState<number>(3);
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [diagnosis, setDiagnosis] = useState<string>(currentDiagnosis || '');
  const [notes, setNotes] = useState<string>('راحة تامة بالمنزل مع تجنب أي مجهود بدني شاق');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  if (!isOpen) return null;

  // Calculate end date and return date
  const computeEndDate = (start: string, days: number): string => {
    const d = new Date(start);
    d.setDate(d.getDate() + Math.max(1, days) - 1);
    return d.toISOString().split('T')[0];
  };

  const computeReturnDate = (start: string, days: number): string => {
    const d = new Date(start);
    d.setDate(d.getDate() + Math.max(1, days));
    return d.toISOString().split('T')[0];
  };

  const endDate = computeEndDate(startDate, leaveDays);
  const returnToWorkDate = computeReturnDate(startDate, leaveDays);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printService.printSickLeave({
        patientName: patient?.fullName || appointment?.patientName || '---',
        fileNumber: patient?.fileNumber || appointment?.fileNumber || '---',
        ageYears: patient?.ageYears,
        gender: patient?.gender,
        doctorName: clinicSetting?.doctorName || 'د. طبيب العيادة',
        doctorTitle: clinicSetting?.doctorTitle || 'استشاري العيادة',
        clinicName: clinicSetting?.clinicName || 'العيادة التخصصية',
        diagnosis: diagnosis.trim() || 'وعكة صحية تستلزم الراحة والعلاج',
        leaveDays,
        startDate,
        endDate,
        returnToWorkDate,
        notes: notes.trim(),
        issueDate: new Date().toLocaleDateString('ar-EG'),
      });
      onClose();
    } catch (err) {
      console.error('Failed to print sick leave:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="تحرير وطباعة تقرير إجازة مرضية (Sick Leave Certificate)"
      description="إصدار شهادة طبية معتمدة بالإجازة المرضية وتاريخ العودة للعمل"
      maxWidth="md"
    >
      <div className="space-y-4 text-xs">
        {/* Quick Days Selector Chips */}
        <div>
          <label className="block font-bold text-slate-700 mb-1.5">مدة الإجازة المطلوبة (أيام):</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[1, 2, 3, 4, 5, 7, 10, 14].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setLeaveDays(d)}
                className={`px-3 py-1 rounded-lg border font-bold transition-colors ${
                  leaveDays === d
                    ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {d} {d === 1 ? 'يوم' : d === 2 ? 'يومان' : 'أيام'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-600 mb-1">تاريخ بداية الإجازة</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-600 mb-1">تاريخ نهاية الإجازة</label>
            <Input
              type="date"
              value={endDate}
              disabled
              className="text-xs bg-slate-100 text-slate-700"
            />
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 font-medium">
          تاريخ العودة للعمل المفترض: <strong className="font-bold">{returnToWorkDate}</strong>
        </div>

        <div>
          <label className="block font-semibold text-slate-600 mb-1">التشخيص الطبي للشهادة</label>
          <Input
            type="text"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="مثال: التهاب حاد بالجهاز التنفسي العلوي ونزلة معوية"
            className="text-xs"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-600 mb-1">توصيات وملاحظات إضافية</label>
          <Input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="مثال: مراجعة العيادة عند استمرار الأعراض"
            className="text-xs"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            disabled={isPrinting}
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الشهادة الآن</span>
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
