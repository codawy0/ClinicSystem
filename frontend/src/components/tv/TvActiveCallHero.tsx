import { Stethoscope, Sparkles } from 'lucide-react';
import { TvPrivacyMode } from '../../types';

interface TvActiveCallHeroProps {
  queueNumber: number | null;
  patientName: string | null;
  roomName: string;
  doctorName: string;
  privacyMode: TvPrivacyMode;
}

export function TvActiveCallHero({
  queueNumber,
  patientName,
  roomName,
  doctorName,
  privacyMode,
}: TvActiveCallHeroProps) {
  // Format name based on privacy settings
  const formatDisplayName = (fullName: string | null): string => {
    if (!fullName) return '';
    if (privacyMode === 'QueueNumberOnly') return '';
    if (privacyMode === 'FirstNameAndInitial') {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length <= 1) return parts[0];
      return `${parts[0]} ${parts[1][0]}.`;
    }
    return fullName;
  };

  const formattedName = formatDisplayName(patientName);

  if (!queueNumber) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 shadow-2xl backdrop-blur-md">
        <div className="p-6 rounded-full bg-slate-800/80 text-slate-500 mb-6">
          <Stethoscope className="w-20 h-20" />
        </div>
        <h2 className="text-4xl font-extrabold text-slate-300">في انتظار نداء الحالة القادمة</h2>
        <p className="text-xl text-slate-500 mt-3 font-medium">
          يرجى الاستراحة ومتابعة الشاشة عند صدور التنبيه الصوتي
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border-2 border-sky-500/30 shadow-2xl backdrop-blur-md relative overflow-hidden">
      {/* Background glowing aura */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner: Attention */}
      <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 font-bold text-xl mb-6 shadow-sm animate-pulse">
        <Sparkles className="w-5 h-5 text-sky-400" />
        <span>تفضل بالدخول الآن</span>
      </div>

      {/* Giant 120pt Glowing Queue Number */}
      <div className="relative my-2 select-none">
        <span className="text-[130px] sm:text-[160px] font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-sky-100 to-sky-400 tracking-tighter drop-shadow-[0_10px_25px_rgba(56,189,248,0.4)] font-mono leading-none">
          {queueNumber}
        </span>
      </div>

      {/* Formatted Patient Name */}
      {formattedName && (
        <div className="text-3xl sm:text-4xl font-bold text-white mt-4 text-center tracking-wide">
          {formattedName}
        </div>
      )}

      {/* Room and Doctor Tag */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-slate-300 text-xl font-semibold">
        <div className="px-5 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-md flex items-center gap-2">
          <span className="text-sky-400 font-bold">{roomName || 'عيادة الكشف 1'}</span>
        </div>
        <div className="px-5 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-md">
          <span>{doctorName}</span>
        </div>
      </div>
    </div>
  );
}
