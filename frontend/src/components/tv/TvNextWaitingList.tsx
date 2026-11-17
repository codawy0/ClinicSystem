import { Users, Clock } from 'lucide-react';
import { TvPrivacyMode } from '../../types';

interface WaitingPatient {
  queueNumber: number;
  patientName: string;
  isUrgent?: boolean;
}

interface TvNextWaitingListProps {
  waitingPatients: WaitingPatient[];
  privacyMode: TvPrivacyMode;
}

export function TvNextWaitingList({ waitingPatients, privacyMode }: TvNextWaitingListProps) {
  const formatDisplayName = (fullName: string): string => {
    if (privacyMode === 'QueueNumberOnly') return '';
    if (privacyMode === 'FirstNameAndInitial') {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length <= 1) return parts[0];
      return `${parts[0]} ${parts[1][0]}.`;
    }
    return fullName;
  };

  const nextFive = waitingPatients.slice(0, 5);

  return (
    <div className="w-full lg:w-80 rounded-3xl bg-slate-900/60 border border-slate-800 p-6 flex flex-col shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-2 text-slate-300 font-bold text-lg">
          <Users className="w-5 h-5 text-sky-400" />
          <span>الأدوار القادمة</span>
        </div>
        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-800 text-sky-400 border border-slate-700">
          {waitingPatients.length} في الانتظار
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-hidden">
        {nextFive.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-medium text-sm">
            لا توجد حالات تالية في صالة الانتظار
          </div>
        ) : (
          nextFive.map((p, idx) => (
            <div
              key={p.queueNumber}
              className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                idx === 0
                  ? 'bg-sky-500/10 border-sky-500/40 text-sky-200'
                  : 'bg-slate-800/40 border-slate-700/50 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black font-mono tracking-tight px-3 py-1 rounded-xl bg-slate-900 border border-slate-700 text-white shadow-xs">
                  {p.queueNumber}
                </span>
                {privacyMode !== 'QueueNumberOnly' && (
                  <span className="font-bold text-base truncate max-w-[130px]">
                    {formatDisplayName(p.patientName)}
                  </span>
                )}
              </div>

              {p.isUrgent && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  مستعجل
                </span>
              )}
            </div>
          ))
        )}
      </div>

      <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span>تحديث دوري فوري تلقائي</span>
      </div>
    </div>
  );
}
