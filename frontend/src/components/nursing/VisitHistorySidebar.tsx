import { useState, useEffect } from 'react';
import {
  History,
  Calendar,
  ChevronDown,
  ChevronUp,
  Scale,
  Heart,
  FileText,
  User,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { MedicalVisitSummaryDto } from '../../types';
import { nursingService } from '../../services/nursingService';
import { cn } from '../../lib/utils';

interface VisitHistorySidebarProps {
  patientId: number | null;
  currentVisitId?: number;
  currentWeight?: number | null;
  currentBpSystolic?: number | null;
  currentBpDiastolic?: number | null;
}

export function VisitHistorySidebar({
  patientId,
  currentVisitId,
  currentWeight,
  currentBpSystolic,
  currentBpDiastolic,
}: VisitHistorySidebarProps) {
  const [visits, setVisits] = useState<MedicalVisitSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [expandedVisitId, setExpandedVisitId] = useState<number | null>(null);

  useEffect(() => {
    if (!patientId) {
      setVisits([]);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    nursingService
      .getPatientVisits(patientId, 1, 15)
      .then((res) => {
        if (!isMounted) return;
        // Filter out current visit if it is in the list
        const pastVisits = (res.items || []).filter((v) => v.id !== currentVisitId);
        setVisits(pastVisits);
        if (pastVisits.length > 0) {
          setExpandedVisitId(pastVisits[0].id);
        }
      })
      .catch(() => {
        if (isMounted) setVisits([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [patientId, currentVisitId]);

  const toggleExpand = (id: number) => {
    setExpandedVisitId((prev) => (prev === id ? null : id));
  };

  // Helper to compute weight delta
  const renderWeightDelta = (pastWeight?: number | null) => {
    if (!pastWeight || !currentWeight) return null;
    const delta = Math.round((currentWeight - pastWeight) * 10) / 10;
    if (delta > 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded dir-ltr">
          <TrendingUp className="w-3 h-3" />
          +{delta} kg
        </span>
      );
    }
    if (delta < 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded dir-ltr">
          <TrendingDown className="w-3 h-3" />
          {delta} kg
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
        <Minus className="w-3 h-3" />
        ثابت
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-120px)] overflow-hidden text-right">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">السجل السريري السابق</h2>
            <p className="text-[11px] text-slate-500">مقارنة القياسات بالزيارات السابقة</p>
          </div>
        </div>

        {visits.length > 0 && (
          <span className="text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
            {visits.length} زيارات
          </span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-600" />
            <p className="text-xs">جاري تحميل السجل السابق...</p>
          </div>
        ) : !patientId ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <User className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs">حدد مريضاً لعرض زياراته السابقة</p>
          </div>
        ) : visits.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <FileText className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">هذه أول زيارة للمريض</p>
            <p className="text-[11px] text-slate-400">لا توجد زيارات سابقة مسجلة في النظام</p>
          </div>
        ) : (
          visits.map((visit) => {
            const isExpanded = expandedVisitId === visit.id;
            const visitDateFormatted = visit.visitDate
              ? new Date(visit.visitDate).toLocaleDateString('ar-EG', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : 'تاريخ غير محدد';

            return (
              <div
                key={visit.id}
                className={cn(
                  'rounded-xl border transition-all overflow-hidden',
                  isExpanded ? 'border-sky-300 bg-sky-50/30' : 'border-slate-200 bg-white hover:border-slate-300'
                )}
              >
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(visit.id)}
                  className="w-full p-3 flex items-center justify-between text-right gap-2 cursor-pointer focus:outline-none"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Calendar className="w-3.5 h-3.5 text-sky-600" />
                      <span>{visitDateFormatted}</span>
                      {visit.isDraft && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded">
                          مسودة
                        </span>
                      )}
                    </div>
                    {visit.doctorName && (
                      <p className="text-[11px] text-slate-500">الطبيب: {visit.doctorName}</p>
                    )}
                  </div>

                  <div className="text-slate-400 hover:text-slate-600">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Accordion Content */}
                {isExpanded && (
                  <div className="p-3 pt-0 border-t border-slate-100 space-y-2.5 text-xs">
                    {/* Vitals Summary Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {/* Blood Pressure */}
                      <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3 text-rose-500" />
                            ضغط الدم
                          </span>
                          {currentBpSystolic && currentBpDiastolic ? (
                            <span className="text-[9px] text-slate-400">
                              (الحالي: {currentBpSystolic}/{currentBpDiastolic})
                            </span>
                          ) : null}
                        </div>
                        <div className="font-mono font-bold text-slate-800 text-xs">
                          {visit.bpSystolic && visit.bpDiastolic
                            ? `${visit.bpSystolic}/${visit.bpDiastolic}`
                            : 'غير مسجل'}
                        </div>
                      </div>

                      {/* Weight with Delta */}
                      <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Scale className="w-3 h-3 text-teal-500" />
                            الوزن
                          </span>
                          {renderWeightDelta(visit.weightKg)}
                        </div>
                        <div className="font-mono font-bold text-slate-800 text-xs">
                          {visit.weightKg ? `${visit.weightKg} kg` : 'غير مسجل'}
                        </div>
                      </div>

                      {/* Pulse */}
                      <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-0.5">
                        <span className="text-[10px] text-slate-500">النبض</span>
                        <div className="font-mono font-bold text-slate-800 text-xs">
                          {visit.pulseBpm ? `${visit.pulseBpm} bpm` : 'غير مسجل'}
                        </div>
                      </div>

                      {/* Glucose */}
                      <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-0.5">
                        <span className="text-[10px] text-slate-500">السكر</span>
                        <div className="font-mono font-bold text-slate-800 text-xs">
                          {visit.bloodSugarMgDl ? `${visit.bloodSugarMgDl} mg/dL` : 'غير مسجل'}
                        </div>
                      </div>
                    </div>

                    {/* Chief Complaint / Diagnosis */}
                    {visit.chiefComplaint && (
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 block">شكوى الزيارة السابقة:</span>
                        <p className="text-[11px] text-slate-700 mt-0.5">{visit.chiefComplaint}</p>
                      </div>
                    )}

                    {visit.diagnosis && (
                      <div className="p-2 bg-teal-50/50 rounded-lg border border-teal-200">
                        <span className="text-[10px] font-bold text-teal-800 block">التشخيص الطبي السابق:</span>
                        <p className="text-[11px] text-teal-900 mt-0.5 font-semibold">{visit.diagnosis}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
