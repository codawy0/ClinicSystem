import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Users, Clock } from 'lucide-react';
export function TvNextWaitingList({ waitingPatients, privacyMode }) {
    const formatDisplayName = (fullName) => {
        if (privacyMode === 'QueueNumberOnly')
            return '';
        if (privacyMode === 'FirstNameAndInitial') {
            const parts = fullName.trim().split(/\s+/);
            if (parts.length <= 1)
                return parts[0];
            return `${parts[0]} ${parts[1][0]}.`;
        }
        return fullName;
    };
    const nextFive = waitingPatients.slice(0, 5);
    return (_jsxs("div", { className: "w-full lg:w-80 rounded-3xl bg-slate-900/60 border border-slate-800 p-6 flex flex-col shadow-2xl backdrop-blur-md", children: [_jsxs("div", { className: "flex items-center justify-between pb-4 border-b border-slate-800 mb-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-slate-300 font-bold text-lg", children: [_jsx(Users, { className: "w-5 h-5 text-sky-400" }), _jsx("span", { children: "\u0627\u0644\u0623\u062F\u0648\u0627\u0631 \u0627\u0644\u0642\u0627\u062F\u0645\u0629" })] }), _jsxs("span", { className: "text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-800 text-sky-400 border border-slate-700", children: [waitingPatients.length, " \u0641\u064A \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631"] })] }), _jsx("div", { className: "flex-1 space-y-3 overflow-hidden", children: nextFive.length === 0 ? (_jsx("div", { className: "py-12 text-center text-slate-500 font-medium text-sm", children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u062D\u0627\u0644\u0627\u062A \u062A\u0627\u0644\u064A\u0629 \u0641\u064A \u0635\u0627\u0644\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631" })) : (nextFive.map((p, idx) => (_jsxs("div", { className: `p-3.5 rounded-2xl border flex items-center justify-between transition-all ${idx === 0
                        ? 'bg-sky-500/10 border-sky-500/40 text-sky-200'
                        : 'bg-slate-800/40 border-slate-700/50 text-slate-300'}`, children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-2xl font-black font-mono tracking-tight px-3 py-1 rounded-xl bg-slate-900 border border-slate-700 text-white shadow-xs", children: p.queueNumber }), privacyMode !== 'QueueNumberOnly' && (_jsx("span", { className: "font-bold text-base truncate max-w-[130px]", children: formatDisplayName(p.patientName) }))] }), p.isUrgent && (_jsx("span", { className: "text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30", children: "\u0645\u0633\u062A\u0639\u062C\u0644" }))] }, p.queueNumber)))) }), _jsxs("div", { className: "pt-4 border-t border-slate-800 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5", children: [_jsx(Clock, { className: "w-3.5 h-3.5 text-slate-400" }), _jsx("span", { children: "\u062A\u062D\u062F\u064A\u062B \u062F\u0648\u0631\u064A \u0641\u0648\u0631\u064A \u062A\u0644\u0642\u0627\u0626\u064A" })] })] }));
}
