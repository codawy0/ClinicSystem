import { Coffee } from 'lucide-react';

interface TvDoctorBreakBannerProps {
  isOnBreak: boolean;
  message?: string;
}

export function TvDoctorBreakBanner({ isOnBreak, message }: TvDoctorBreakBannerProps) {
  if (!isOnBreak) return null;

  return (
    <div className="w-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 py-3.5 px-6 shadow-xl flex items-center justify-center gap-3 animate-pulse select-none">
      <div className="p-1.5 rounded-full bg-slate-950 text-amber-400">
        <Coffee className="w-6 h-6" />
      </div>
      <span className="text-xl sm:text-2xl font-black tracking-wide">
        {message || 'الطبيب في استراحة قصيرة — يرجى الانتظار، وسيتم استئناف الكشف قريباً'}
      </span>
    </div>
  );
}
