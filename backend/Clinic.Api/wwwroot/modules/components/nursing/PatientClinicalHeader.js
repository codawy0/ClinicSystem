import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { User, Phone, FileText, AlertTriangle, ShieldAlert, HeartPulse, Baby, Edit3, Sparkles, } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
export function PatientClinicalHeader({ profile, appointment, onOpenClinicalModal, isLoading, }) {
    if (isLoading && !profile && !appointment) {
        return (_jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 p-5 shadow-sm animate-pulse", children: [_jsx("div", { className: "h-6 bg-slate-200 rounded w-1/3 mb-3" }), _jsx("div", { className: "h-4 bg-slate-100 rounded w-1/2" })] }));
    }
    if (!appointment && !profile) {
        return (_jsxs("div", { className: "bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6 text-center text-slate-500", children: [_jsx(User, { className: "w-8 h-8 mx-auto text-slate-400 mb-2" }), _jsx("p", { className: "text-sm font-semibold", children: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u062D\u062F\u064A\u062F \u0645\u0631\u064A\u0636" }), _jsx("p", { className: "text-xs text-slate-400 mt-1", children: "\u0627\u062E\u062A\u0631 \u0645\u0631\u064A\u0636\u0627\u064B \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u062C\u0627\u0646\u0628\u064A\u0629 \u0644\u0628\u062F\u0621 \u0627\u0644\u0641\u062D\u0635 \u0648\u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062A \u0627\u0644\u062D\u064A\u0648\u064A\u0629" })] }));
    }
    const fullName = profile?.fullName || appointment?.patientName || 'مريض';
    const fileNumber = profile?.fileNumber || appointment?.fileNumber || '';
    const phone = profile?.phone || appointment?.phone || '';
    const gender = profile?.gender || 'Male';
    const isFemale = gender === 'Female';
    const ageYears = profile?.ageYears;
    const isUrgent = appointment?.isUrgent || false;
    const isPregnant = profile?.isPregnant || false;
    const isLactating = profile?.isLactating || false;
    const allergies = profile?.allergies || [];
    const chronicConditions = profile?.chronicConditions || [];
    const getAllergyBadgeStyle = (severity) => {
        switch (severity) {
            case 'Severe':
                return 'text-rose-700 bg-rose-50 border-rose-300 ring-1 ring-rose-200';
            case 'Moderate':
                return 'text-amber-800 bg-amber-50 border-amber-300 ring-1 ring-amber-200';
            case 'Mild':
                return 'text-yellow-800 bg-yellow-50 border-yellow-300';
            default:
                return 'text-slate-700 bg-slate-100 border-slate-200';
        }
    };
    const getSeverityLabel = (severity) => {
        switch (severity) {
            case 'Severe':
                return 'شديدة الخطورة';
            case 'Moderate':
                return 'متوسطة';
            case 'Mild':
                return 'خفيفة';
            default:
                return severity;
        }
    };
    return (_jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-right space-y-3", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: cn('w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-md flex-shrink-0', isFemale
                                    ? 'bg-gradient-to-tr from-pink-500 to-rose-400 shadow-rose-200'
                                    : 'bg-gradient-to-tr from-sky-600 to-teal-500 shadow-teal-200'), children: _jsx(User, { className: "w-6 h-6" }) }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("h1", { className: "text-base font-black text-slate-900", children: fullName }), isUrgent && (_jsxs("span", { className: "inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-300 rounded-full px-2 py-0.5", children: [_jsx(AlertTriangle, { className: "w-3.5 h-3.5" }), "\u062D\u0627\u0644\u0629 \u0637\u0627\u0631\u0626\u0629"] })), appointment?.queueNumber !== null && appointment?.queueNumber !== undefined && (_jsxs("span", { className: "text-xs font-bold font-mono bg-slate-800 text-white rounded-md px-2 py-0.5", children: ["\u062F\u0648\u0631 \u0631\u0642\u0645 #", appointment.queueNumber] }))] }), _jsxs("div", { className: "flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(FileText, { className: "w-3.5 h-3.5 text-slate-400" }), "\u0631\u0642\u0645 \u0627\u0644\u0645\u0644\u0641: ", _jsxs("strong", { className: "font-mono text-slate-700", children: ["#", fileNumber] })] }), _jsx("span", { children: "\u2022" }), _jsxs("span", { children: ["\u0627\u0644\u062C\u0646\u0633: ", _jsx("strong", { children: isFemale ? 'أنثى' : 'ذكر' })] }), ageYears !== undefined && ageYears !== null && (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u2022" }), _jsxs("span", { children: ["\u0627\u0644\u0639\u0645\u0631: ", _jsxs("strong", { children: [ageYears, " \u0633\u0646\u0629"] })] })] })), phone && (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u2022" }), _jsxs("a", { href: `tel:${phone}`, className: "flex items-center gap-1 text-teal-600 hover:text-teal-700 hover:underline dir-ltr font-mono", children: [_jsx(Phone, { className: "w-3.5 h-3.5" }), phone] })] }))] })] })] }), _jsx("div", { className: "flex items-center gap-2 self-end md:self-center", children: _jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: onOpenClinicalModal, className: "text-xs border-teal-300 text-teal-700 hover:bg-teal-50 hover:text-teal-800", children: [_jsx(Edit3, { className: "w-3.5 h-3.5 ml-1" }), "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u062D\u0633\u0627\u0633\u064A\u0627\u062A \u0648\u0627\u0644\u0623\u0645\u0631\u0627\u0636 \u0627\u0644\u0645\u0632\u0645\u0646\u0629"] }) })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3 pt-1", children: [isFemale && (_jsxs("div", { className: "flex items-center gap-2 pl-3 border-l border-slate-200", children: [isPregnant ? (_jsxs("span", { className: "inline-flex items-center gap-1 text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2.5 py-1", children: [_jsx(Baby, { className: "w-3.5 h-3.5 text-purple-600" }), "\u062D\u0627\u0645\u0644"] })) : null, isLactating ? (_jsxs("span", { className: "inline-flex items-center gap-1 text-xs font-bold bg-pink-50 text-pink-700 border border-pink-200 rounded-full px-2.5 py-1", children: [_jsx(Sparkles, { className: "w-3.5 h-3.5 text-pink-600" }), "\u0645\u0631\u0636\u0639\u0629"] })) : null, !isPregnant && !isLactating && (_jsx("span", { className: "text-[11px] text-slate-400", children: "\u0644\u0627 \u064A\u0648\u062C\u062F \u062D\u0645\u0644 \u0623\u0648 \u0631\u0636\u0627\u0639\u0629 \u0645\u0633\u062C\u0644\u064A\u0646" }))] })), _jsxs("div", { className: "flex items-center gap-1.5 flex-wrap flex-1", children: [_jsxs("div", { className: "flex items-center gap-1 text-xs font-bold text-slate-700", children: [_jsx(ShieldAlert, { className: "w-4 h-4 text-rose-500" }), _jsx("span", { children: "\u0627\u0644\u062D\u0633\u0627\u0633\u064A\u0627\u062A \u0627\u0644\u062F\u0648\u0627\u0626\u064A\u0629:" })] }), allergies.length === 0 ? (_jsx("span", { className: "text-xs text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full", children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u062D\u0633\u0627\u0633\u064A\u0627\u062A \u0645\u0633\u062C\u0644\u0629" })) : (allergies.map((allergy) => (_jsxs("span", { title: `المادة الفعالة: ${allergy.activeIngredient} (${getSeverityLabel(allergy.severity)})`, className: cn('inline-flex items-center gap-1 text-xs font-bold border rounded-full px-2.5 py-0.5', getAllergyBadgeStyle(allergy.severity)), children: [_jsx(AlertTriangle, { className: "w-3 h-3" }), _jsx("span", { children: allergy.allergyName || allergy.activeIngredient }), _jsxs("span", { className: "text-[10px] opacity-80", children: ["(", getSeverityLabel(allergy.severity), ")"] })] }, allergy.id))))] }), _jsxs("div", { className: "flex items-center gap-1.5 flex-wrap", children: [_jsxs("div", { className: "flex items-center gap-1 text-xs font-bold text-slate-700", children: [_jsx(HeartPulse, { className: "w-4 h-4 text-sky-500" }), _jsx("span", { children: "\u0627\u0644\u0623\u0645\u0631\u0627\u0636 \u0627\u0644\u0645\u0632\u0645\u0646\u0629:" })] }), chronicConditions.length === 0 ? (_jsx("span", { className: "text-xs text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full", children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0645\u0631\u0627\u0636 \u0645\u0632\u0645\u0646\u0629 \u0645\u0633\u062C\u0644\u0629" })) : (chronicConditions.map((cond) => (_jsxs("span", { title: cond.notes || cond.conditionCode, className: "inline-flex items-center gap-1 text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200 rounded-full px-2.5 py-0.5", children: [_jsx("span", { children: cond.conditionName }), cond.conditionCode && (_jsxs("span", { className: "text-[10px] text-sky-600 font-mono", children: ["(", cond.conditionCode, ")"] }))] }, cond.id))))] })] })] }));
}
