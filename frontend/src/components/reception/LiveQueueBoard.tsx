import React from 'react';
import {
  CalendarClock,
  Clock,
  Activity,
  Stethoscope,
  UserX,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ArrowRight,
  CreditCard,
} from 'lucide-react';
import { LiveQueueItemDto, AppointmentStatus } from '../../types';
import { formatEgp } from '../../lib/currency';
import { Button } from '../ui/button';

interface LiveQueueBoardProps {
  queueItems: LiveQueueItemDto[];
  onCheckIn: (item: LiveQueueItemDto) => void;
  onToggleUrgent: (item: LiveQueueItemDto) => void;
  onSkip: (item: LiveQueueItemDto) => void;
  onRecall: (item: LiveQueueItemDto) => void;
  onSettle: (item: LiveQueueItemDto) => void;
  isLoading?: boolean;
}

interface ColumnConfig {
  status: AppointmentStatus;
  title: string;
  icon: React.ReactNode;
  bgHeader: string;
  badgeColor: string;
}

export function LiveQueueBoard({
  queueItems,
  onCheckIn,
  onToggleUrgent,
  onSkip,
  onRecall,
  onSettle,
}: LiveQueueBoardProps) {
  const columns: ColumnConfig[] = [
    {
      status: 'Booked',
      title: 'حجوزات مسبقة لم تحضر',
      icon: <CalendarClock className="w-4 h-4 text-slate-600" />,
      bgHeader: 'bg-slate-100/90 text-slate-800',
      badgeColor: 'bg-slate-200 text-slate-800',
    },
    {
      status: 'Waiting',
      title: 'في صالة الانتظار',
      icon: <Clock className="w-4 h-4 text-sky-600" />,
      bgHeader: 'bg-sky-50 text-sky-900',
      badgeColor: 'bg-sky-200 text-sky-900',
    },
    {
      status: 'InNursing',
      title: 'في التمريض (قياسات)',
      icon: <Activity className="w-4 h-4 text-purple-600" />,
      bgHeader: 'bg-purple-50 text-purple-900',
      badgeColor: 'bg-purple-200 text-purple-900',
    },
    {
      status: 'WithDoctor',
      title: 'بالداخل مع الطبيب',
      icon: <Stethoscope className="w-4 h-4 text-emerald-600" />,
      bgHeader: 'bg-emerald-50 text-emerald-900',
      badgeColor: 'bg-emerald-200 text-emerald-900',
    },
    {
      status: 'Skipped',
      title: 'غائب مؤقتاً (تخطي)',
      icon: <UserX className="w-4 h-4 text-amber-600" />,
      bgHeader: 'bg-amber-50 text-amber-900',
      badgeColor: 'bg-amber-200 text-amber-900',
    },
    {
      status: 'Completed',
      title: 'تم الكشف اليوم',
      icon: <CheckCircle2 className="w-4 h-4 text-teal-600" />,
      bgHeader: 'bg-teal-50 text-teal-900',
      badgeColor: 'bg-teal-200 text-teal-900',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
      {/* Header & Live stats */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-900 text-sm">شاشة المتابعة الحية للدور (Live Queue)</h3>
          <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            تحديث مباشر (SignalR)
          </span>
        </div>
        <span className="text-xs text-slate-500">
          إجمالي الحالات اليوم: <strong>{queueItems.length}</strong>
        </span>
      </div>

      {/* 6-Column Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 min-h-[480px]">
        {columns.map((col) => {
          const items = queueItems.filter((i) => i.status === col.status);

          return (
            <div
              key={col.status}
              className="flex flex-col rounded-xl bg-slate-50/70 border border-slate-200 overflow-hidden"
            >
              {/* Column Header */}
              <div className={`p-2.5 flex items-center justify-between border-b border-slate-200 ${col.bgHeader}`}>
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  {col.icon}
                  <span>{col.title}</span>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${col.badgeColor}`}>
                  {items.length}
                </span>
              </div>

              {/* Column Body / Cards */}
              <div className="p-2 flex-1 space-y-2 overflow-y-auto max-h-[550px]">
                {items.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    لا توجد حالات
                  </div>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.appointmentId}
                      className={`p-2.5 rounded-xl border bg-white shadow-xs space-y-1.5 transition-all hover:shadow-md ${
                        item.isUrgent
                          ? 'border-rose-400 ring-1 ring-rose-300'
                          : 'border-slate-200'
                      }`}
                    >
                      {/* Top: Queue number & tags */}
                      <div className="flex items-center justify-between">
                        {item.queueNumber != null ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">رقم</span>
                            <span className="font-extrabold text-sm px-1.5 py-0.5 bg-slate-900 text-white rounded-md font-mono">
                              {item.queueNumber}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            حجز مسبق
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          {item.isUrgent && (
                            <span className="text-[9px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5 text-rose-600" />
                              مستعجل
                            </span>
                          )}
                          {item.isConsultation && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                              استشارة
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Patient Name & Details */}
                      <div>
                        <h5 className="font-bold text-slate-900 text-xs line-clamp-1">{item.patientName}</h5>
                        <div className="text-[10px] text-slate-500 flex items-center justify-between mt-0.5">
                          <span>ملف #{item.fileNumber}</span>
                          <span className="text-slate-600">{item.serviceName}</span>
                        </div>
                      </div>

                      {/* Invoice Status & Remaining Balance */}
                      {item.remainingBalancePiastres > 0 && (
                        <div className="text-[10px] p-1 bg-rose-50 border border-rose-200 rounded text-rose-800 font-semibold flex items-center justify-between">
                          <span>متبقي:</span>
                          <span className="font-bold dir-ltr">{formatEgp(item.remainingBalancePiastres)}</span>
                        </div>
                      )}

                      {/* Action Buttons per Status */}
                      <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1">
                        {col.status === 'Booked' && (
                          <Button
                            onClick={() => onCheckIn(item)}
                            variant="primary"
                            size="sm"
                            className="w-full text-[10px] py-1 bg-sky-600 hover:bg-sky-700"
                          >
                            <ArrowRight className="w-3 h-3 ml-1" />
                            تسجيل حضور (Check-In)
                          </Button>
                        )}

                        {col.status === 'Waiting' && (
                          <>
                            <Button
                              onClick={() => onToggleUrgent(item)}
                              variant="outline"
                              size="sm"
                              className={`text-[10px] py-1 flex-1 ${
                                item.isUrgent ? 'border-rose-400 text-rose-700' : 'text-slate-600'
                              }`}
                            >
                              ⭐ {item.isUrgent ? 'إلغاء الاستعجال' : 'مستعجل'}
                            </Button>
                            <Button
                              onClick={() => onSkip(item)}
                              variant="secondary"
                              size="sm"
                              className="text-[10px] py-1 text-slate-600 hover:text-amber-700"
                            >
                              تخطي
                            </Button>
                          </>
                        )}

                        {col.status === 'Skipped' && (
                          <Button
                            onClick={() => onRecall(item)}
                            variant="primary"
                            size="sm"
                            className="w-full text-[10px] py-1 bg-amber-600 hover:bg-amber-700"
                          >
                            <RotateCcw className="w-3 h-3 ml-1" />
                            استعادة للدور
                          </Button>
                        )}

                        {col.status === 'Completed' && item.remainingBalancePiastres > 0 && (
                          <Button
                            onClick={() => onSettle(item)}
                            variant="success"
                            size="sm"
                            className="w-full text-[10px] py-1"
                          >
                            <CreditCard className="w-3 h-3 ml-1" />
                            تحصيل المتبقي
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
