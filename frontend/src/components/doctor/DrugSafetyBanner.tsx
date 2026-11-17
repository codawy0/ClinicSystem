import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { DrugSafetyCheckResultDto, SafetyWarningDto } from '../../types';

interface DrugSafetyBannerProps {
  checkResult: DrugSafetyCheckResultDto | null;
  isOverrideChecked: boolean;
  onToggleOverride: (checked: boolean) => void;
  overrideReason: string;
  onChangeOverrideReason: (reason: string) => void;
}

export function DrugSafetyBanner({
  checkResult,
  isOverrideChecked,
  onToggleOverride,
  overrideReason,
  onChangeOverrideReason,
}: DrugSafetyBannerProps) {
  // If no check result or no warnings
  if (!checkResult || !checkResult.hasWarnings || checkResult.warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-2xl text-xs font-semibold">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>الأمان الدوائي: لا توجد تضاربات حساسية أو موانع استخدام دوائية مسجلة.</span>
      </div>
    );
  }

  const hasSevere = checkResult.warnings.some((w) => w.severity === 'Severe') || checkResult.requiresOverride;

  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5 transition-all ${
        hasSevere
          ? 'bg-rose-50/90 border-2 border-rose-500 ring-4 ring-rose-500/10 text-rose-950'
          : 'bg-amber-50 border-2 border-amber-400 text-amber-950'
      }`}
    >
      {/* Title Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-rose-200/60 pb-3">
        <div className="flex items-center gap-2.5">
          {hasSevere ? (
            <div className="w-9 h-9 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-sm shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}

          <div>
            <h4 className="font-black text-sm sm:text-base leading-tight">
              {hasSevere
                ? '⚠️ تنبيه أمان دوائي حرج (Severe Drug Safety Alert)'
                : 'تنبيه أمان دوائي وملاحظات سريرية'}
            </h4>
            <p className="text-xs opacity-90 mt-0.5">
              {hasSevere
                ? 'تم رصد موانع استخدام خطيرة أو تضارب مع حساسية مسجلة للمريض. يلزم التجاوز الطبي للمتابعة.'
                : 'يرجى مراجعة الجرعات والمواد الفعالة المشتركة لتجنب أي مضاعفات غير مرغوبة.'}
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
            hasSevere
              ? 'bg-rose-200 text-rose-900 border border-rose-300'
              : 'bg-amber-200 text-amber-900 border border-amber-300'
          }`}
        >
          {checkResult.warnings.length} {checkResult.warnings.length === 1 ? 'تحذير' : 'تحذيرات'}
        </span>
      </div>

      {/* Warnings List */}
      <div className="space-y-2.5">
        {checkResult.warnings.map((warning: SafetyWarningDto, idx: number) => {
          const isWarningSevere = warning.severity === 'Severe';

          return (
            <div
              key={`${warning.drugId}-${warning.type}-${idx}`}
              className={`p-3 rounded-xl border text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                isWarningSevere
                  ? 'bg-white/90 border-rose-300 text-rose-900 shadow-xs'
                  : 'bg-white/80 border-amber-200 text-amber-900 shadow-xs'
              }`}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      warning.type === 'AllergyConflict'
                        ? 'bg-rose-600 text-white'
                        : warning.type === 'PregnancyContraindication'
                        ? 'bg-pink-600 text-white'
                        : warning.type === 'DuplicateIngredient'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-700 text-white'
                    }`}
                  >
                    {warning.titleAr || (warning.type === 'AllergyConflict' ? 'تضارب حساسية دوائية' : warning.type === 'PregnancyContraindication' ? 'ممنوع في الحمل' : 'تكرار مادة فعالة')}
                  </span>

                  <span className="font-bold text-slate-900">
                    دواء:{' '}
                    <bdi dir="ltr" className="font-black text-rose-700">
                      {warning.tradeName}
                    </bdi>
                  </span>

                  {warning.activeIngredient && (
                    <span className="text-xs text-slate-500">
                      المادة الفعالة:{' '}
                      <bdi dir="ltr" className="font-mono text-slate-700">
                        {warning.activeIngredient}
                      </bdi>
                    </span>
                  )}
                </div>

                <p className="text-xs leading-relaxed text-slate-700 font-medium">
                  {warning.messageAr}
                </p>
              </div>

              {warning.requiresOverride && (
                <span className="self-start sm:self-auto text-[11px] font-bold text-rose-700 bg-rose-100 border border-rose-300 px-2.5 py-1 rounded-lg shrink-0">
                  يتطلب إقرار الطبيب
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Mandatory Medical Override Section (If Severe / Requires Override) */}
      {checkResult.requiresOverride && (
        <div className="bg-rose-100/80 border border-rose-300 rounded-xl p-3.5 space-y-2.5">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isOverrideChecked}
              onChange={(e) => onToggleOverride(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-rose-400 text-rose-600 focus:ring-rose-500 shrink-0 cursor-pointer"
            />
            <span className="text-xs sm:text-sm font-bold text-rose-950 leading-snug">
              أقر أنا الطبيب المعالج بضرورة صرف هذه الأدوية وتحمل المسؤولية الطبية الكاملة بعد الموازنة السريرية بين الفوائد والمخاطر.
            </span>
          </label>

          {isOverrideChecked && (
            <div className="pt-1.5 animate-in fade-in space-y-1">
              <label className="block text-[11px] font-bold text-rose-900">
                المبرر الطبي للتجاوز (Medical Justification):
              </label>
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => onChangeOverrideReason(e.target.value)}
                placeholder="مثال: تم ضبط الجرعة ومتابعة المريض سريرياً، أو لا يوجد بديل متاح..."
                className="w-full text-xs rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
