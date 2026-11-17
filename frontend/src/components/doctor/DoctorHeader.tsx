import {
  Stethoscope,
  Coffee,
  Play,
  RefreshCw,
  SkipForward,
  Users,
  LogOut,
  WifiOff,
  Loader2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { LiveQueueItemDto } from '../../types';

interface DoctorHeaderProps {
  doctorName: string;
  specialty: string;
  isConnected: boolean;
  isDoctorOnBreak: boolean;
  onToggleBreak: () => void;
  onCallNext: () => void;
  onRecall: () => void;
  onSkip: () => void;
  activeAppointment: LiveQueueItemDto | null;
  waitingCount: number;
  isCallingNext: boolean;
  onToggleQueueDrawer: () => void;
  isQueueDrawerOpen: boolean;
  onLogout: () => void;
}

export function DoctorHeader({
  doctorName,
  specialty,
  isConnected,
  isDoctorOnBreak,
  onToggleBreak,
  onCallNext,
  onRecall,
  onSkip,
  activeAppointment,
  waitingCount,
  isCallingNext,
  onToggleQueueDrawer,
  isQueueDrawerOpen,
  onLogout,
}: DoctorHeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        {/* Right side: Doctor Info & Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center text-white shadow-sm ring-2 ring-sky-100">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-900 text-base leading-tight">
                {doctorName || 'د. عيادة التخصصات'}
              </h1>
              {isConnected ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  متصل
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  <WifiOff className="w-3 h-3 text-rose-500" />
                  منفصل
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">{specialty || 'العيادة الطبية العامة'}</p>
          </div>
        </div>

        {/* Center: Live Queue Status & Break Toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-xs text-slate-500 font-medium">الانتظار بالعيادة:</span>
            <Badge variant={waitingCount > 0 ? 'info' : 'default'} className="px-2 py-0.5 font-bold">
              {waitingCount} مريض
            </Badge>
          </div>

          <Button
            variant={isDoctorOnBreak ? 'danger' : 'outline'}
            size="sm"
            onClick={onToggleBreak}
            className={isDoctorOnBreak ? 'animate-pulse font-bold' : ''}
            title={isDoctorOnBreak ? 'إنهاء الاستراحة واستئناف العمل' : 'أخذ استراحة وتنبيه شاشة الانتظار'}
          >
            <Coffee className="w-4 h-4" />
            <span>{isDoctorOnBreak ? 'في استراحة (اضغط للإنهاء)' : 'استراحة الطبيب'}</span>
          </Button>
        </div>

        {/* Left side: Call Console & Actions */}
        <div className="flex items-center gap-2">
          {/* Call Next Button with F4 badge */}
          <Button
            variant="primary"
            size="sm"
            onClick={onCallNext}
            disabled={isCallingNext}
            className="bg-sky-600 hover:bg-sky-700 text-white font-semibold gap-2 shadow-sm"
          >
            {isCallingNext ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            <span>استدعاء التالي</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-sky-700/60 text-sky-100 rounded border border-sky-400/30">
              F4
            </kbd>
          </Button>

          {/* Recall */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRecall}
            disabled={!activeAppointment}
            title="إعادة نداء المريض الحالي على شاشة الانتظار"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">إعادة النداء</span>
          </Button>

          {/* Skip */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            disabled={!activeAppointment}
            title="تخطي المريض الحالي مؤقتاً"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">تخطي</span>
          </Button>

          {/* Queue Drawer Toggle */}
          <Button
            variant={isQueueDrawerOpen ? 'secondary' : 'outline'}
            size="sm"
            onClick={onToggleQueueDrawer}
            title="عرض قائمة الانتظار والزيارات السابقة"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">قائمة المرضى</span>
          </Button>

          {/* Logout */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            title="تسجيل الخروج"
            className="text-slate-500 hover:text-rose-600 hover:bg-rose-50"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
