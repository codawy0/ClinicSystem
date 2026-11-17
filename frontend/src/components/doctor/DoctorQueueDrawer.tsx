import { useState } from 'react';
import {
  X,
  Users,
  Clock,
  History,
  AlertTriangle,
  Play,
  Copy,
  Calendar,
  Loader2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { LiveQueueItemDto, MedicalVisitSummaryDto } from '../../types';

interface DoctorQueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentAppointment: LiveQueueItemDto | null;
  queueItems: LiveQueueItemDto[];
  onSelectPatient: (appointment: LiveQueueItemDto) => void;
  onCallPatient: (appointment: LiveQueueItemDto) => void;
  pastVisits: MedicalVisitSummaryDto[];
  onRepeatVisitRx?: (visitId: number) => void;
  isLoadingHistory?: boolean;
}

export function DoctorQueueDrawer({
  isOpen,
  onClose,
  currentAppointment,
  queueItems,
  onSelectPatient,
  onCallPatient,
  pastVisits,
  onRepeatVisitRx,
  isLoadingHistory = false,
}: DoctorQueueDrawerProps) {
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');

  if (!isOpen) return null;

  // Filter queue items: Waiting, InNursing, WithDoctor
  const waitingPatients = queueItems
    .filter((item) => item.status === 'Waiting' || item.status === 'InNursing')
    .sort((a, b) => {
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      return (a.queueNumber ?? 9999) - (b.queueNumber ?? 9999);
    });

  const withDoctorPatient = queueItems.find((item) => item.status === 'WithDoctor') || currentAppointment;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 left-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-r border-slate-200">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-600" />
              <h3 className="font-bold text-slate-900 text-base">قائمة الانتظار والسجل الطبي</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Selector */}
          <div className="p-3 border-b border-slate-200 bg-white">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('queue')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'queue'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>الانتظار اليوم ({waitingPatients.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>سجل المريض السابق ({pastVisits.length})</span>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeTab === 'queue' ? (
              <div className="space-y-4">
                {/* Active Consultation Patient */}
                {withDoctorPatient && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-500 block">
                      المريض الحالي في غرفة الكشف:
                    </span>
                    <div className="p-3.5 rounded-xl border-2 border-sky-400 bg-sky-50/60 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-900 text-sm">
                          {withDoctorPatient.patientName}
                        </span>
                        <span className="text-xs font-mono font-bold text-sky-800 bg-white border border-sky-200 px-2 py-0.5 rounded-md">
                          دور #{withDoctorPatient.queueNumber}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span className="font-mono">#{withDoctorPatient.fileNumber}</span>
                        <span className="text-emerald-700 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded">
                          قيد الكشف الآن
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Waiting Patients List */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-500 block">
                    قائمة المرضى في الانتظار ({waitingPatients.length}):
                  </span>

                  {waitingPatients.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-1">
                      <Clock className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
                      <p className="text-sm font-medium text-slate-600">لا يوجد مرضى في الانتظار</p>
                      <p className="text-xs text-slate-400">جميع الحالات المسجلة تم إتمامها أو لا يوجد حضور بعد.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {waitingPatients.map((patient) => {
                        const isCurrent = currentAppointment?.appointmentId === patient.appointmentId;

                        return (
                          <div
                            key={patient.appointmentId}
                            className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                              patient.isUrgent
                                ? 'bg-rose-50/70 border-rose-300 text-rose-950'
                                : isCurrent
                                ? 'bg-sky-50 border-sky-300'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm truncate">
                                  {patient.patientName}
                                </span>
                                {patient.isUrgent && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded animate-pulse">
                                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                                    عاجل
                                  </span>
                                )}
                                {patient.isConsultation && (
                                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                    استشارة
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-xs text-slate-500">
                                <span className="font-mono">#{patient.fileNumber}</span>
                                <span className="font-mono font-semibold text-slate-700">
                                  دور {patient.queueNumber ?? '—'}
                                </span>
                                {patient.status === 'InNursing' && (
                                  <span className="text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                    قياس علامات
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  onSelectPatient(patient);
                                  onClose();
                                }}
                                className="text-xs px-2 py-1 h-auto"
                                title="فتح ملف المريض"
                              >
                                <span>فتح</span>
                              </Button>

                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  onCallPatient(patient);
                                  onClose();
                                }}
                                className="bg-sky-600 hover:bg-sky-700 text-white p-1.5 h-auto rounded-lg"
                                title="نداء هذا المريض الآن"
                              >
                                <Play className="w-3.5 h-3.5 fill-white" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* History Tab: Past Visits Timeline */
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-500 block">
                  الزيارات والكشوفات السابقة للمريض:
                </span>

                {isLoadingHistory ? (
                  <div className="py-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-sky-600 mb-2" />
                    <p className="text-sm font-medium">جاري تحميل السجل الطبي...</p>
                  </div>
                ) : pastVisits.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-1">
                    <History className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
                    <p className="text-sm font-medium text-slate-600">لا توجد زيارات سابقة</p>
                    <p className="text-xs text-slate-400">هذه أول زيارة مسجلة للمريض في العيادة.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pastVisits.map((visit) => {
                      const visitDateStr = new Date(visit.visitDate).toLocaleDateString('ar-EG', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      });

                      return (
                        <div
                          key={visit.id}
                          className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-2 hover:border-sky-300 transition-colors"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1 font-semibold text-slate-700">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {visitDateStr}
                            </span>
                            <span className="text-slate-500 text-[11px]">
                              {visit.doctorName || 'العيادة'}
                            </span>
                          </div>

                          {visit.diagnosis && (
                            <div className="text-xs">
                              <span className="font-bold text-slate-700">التشخيص: </span>
                              <span className="font-semibold text-slate-900">{visit.diagnosis}</span>
                            </div>
                          )}

                          {visit.chiefComplaint && (
                            <div className="text-xs text-slate-600 line-clamp-2">
                              <span className="text-slate-400">الشكوى: </span>
                              {visit.chiefComplaint}
                            </div>
                          )}

                          {/* Vitals Summary */}
                          {(visit.bpSystolic || visit.weightKg || visit.tempCelsius) && (
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-100">
                              {visit.bpSystolic && visit.bpDiastolic && (
                                <span>BP: {visit.bpSystolic}/{visit.bpDiastolic}</span>
                              )}
                              {visit.pulseBpm && <span>HR: {visit.pulseBpm}</span>}
                              {visit.tempCelsius && <span>T: {visit.tempCelsius}°C</span>}
                              {visit.weightKg && <span>Wt: {visit.weightKg}kg</span>}
                            </div>
                          )}

                          {/* 1-click repeat prescription for this visit */}
                          {onRepeatVisitRx && (
                            <div className="pt-1.5 flex justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  onRepeatVisitRx(visit.id);
                                  onClose();
                                }}
                                className="text-xs font-semibold gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>تكرار روشتة هذه الزيارة</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
