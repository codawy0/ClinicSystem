import {
  Play,
  Printer,
  CheckCircle2,
  Sparkles,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../ui/button';

interface DoctorActionBarProps {
  onCallNext: () => void;
  onComplete: () => void;
  onCompleteAndCallNext: () => void;
  onPrint: () => void;
  isSubmitting: boolean;
  hasSevereWarnings: boolean;
  isOverrideChecked: boolean;
  hasActiveVisit: boolean;
}

export function DoctorActionBar({
  onCallNext,
  onComplete,
  onCompleteAndCallNext,
  onPrint,
  isSubmitting,
  hasSevereWarnings,
  isOverrideChecked,
  hasActiveVisit,
}: DoctorActionBarProps) {
  const isCompletionBlocked = hasSevereWarnings && !isOverrideChecked;

  return (
    <footer className="sticky bottom-0 z-20 bg-white/95 backdrop-blur border-t border-slate-200 px-4 sm:px-6 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Right side: Secondary Actions */}
        <div className="flex items-center gap-2">
          {/* F4: Call Next Patient */}
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onCallNext}
            disabled={isSubmitting}
            className="text-xs sm:text-sm font-semibold gap-2 border-slate-300 hover:bg-slate-50"
          >
            <Play className="w-4 h-4 text-sky-600 fill-sky-600" />
            <span>استدعاء الحالة التالية</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-600 rounded border border-slate-300">
              F4
            </kbd>
          </Button>

          {/* Ctrl+P: Print Prescription */}
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onPrint}
            disabled={!hasActiveVisit}
            className="text-xs sm:text-sm font-semibold gap-2"
          >
            <Printer className="w-4 h-4 text-slate-700" />
            <span>طباعة الروشتة</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-200 text-slate-700 rounded border border-slate-300">
              Ctrl+P
            </kbd>
          </Button>
        </div>

        {/* Left side: Primary Completion Actions */}
        <div className="flex items-center gap-2">
          {isCompletionBlocked && (
            <span className="hidden lg:flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>أكد التجاوز الطبي للإتمام</span>
            </span>
          )}

          {/* F9: Complete Consultation Only */}
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onComplete}
            disabled={!hasActiveVisit || isSubmitting || isCompletionBlocked}
            className="text-xs sm:text-sm font-bold gap-2 border-slate-300 hover:bg-slate-50 text-slate-800"
            title={isCompletionBlocked ? 'يوجد تحذير أمان دوائي حرج يتطلب الموافقة' : 'إتمام الكشف وحفظ الروشتة'}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
            <span>إتمام الكشف فقط</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-600 rounded border border-slate-300">
              F9
            </kbd>
          </Button>

          {/* Ctrl+Enter: Turbo Action: Complete Consultation & Call Next */}
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onCompleteAndCallNext}
            disabled={!hasActiveVisit || isSubmitting || isCompletionBlocked}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm gap-2 shadow-md shadow-emerald-600/20"
            title={isCompletionBlocked ? 'يوجد تحذير أمان دوائي حرج يتطلب الموافقة' : 'إتمام الكشف الحالي واستدعاء المريض التالي فوراً'}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>إتمام واستدعاء التالي</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-emerald-800/60 text-emerald-100 rounded border border-emerald-400/40">
              Ctrl+Enter
            </kbd>
          </Button>
        </div>
      </div>
    </footer>
  );
}
