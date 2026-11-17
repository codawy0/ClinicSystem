import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Stethoscope, Sparkles } from 'lucide-react';
export function TvActiveCallHero({ queueNumber, patientName, roomName, doctorName, privacyMode, }) {
    // Format name based on privacy settings
    const formatDisplayName = (fullName) => {
        if (!fullName)
            return '';
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
    const formattedName = formatDisplayName(patientName);
    if (!queueNumber) {
        return (_jsxs("div", { className: "flex-1 flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 shadow-2xl backdrop-blur-md", children: [_jsx("div", { className: "p-6 rounded-full bg-slate-800/80 text-slate-500 mb-6", children: _jsx(Stethoscope, { className: "w-20 h-20" }) }), _jsx("h2", { className: "text-4xl font-extrabold text-slate-300", children: "\u0641\u064A \u0627\u0646\u062A\u0638\u0627\u0631 \u0646\u062F\u0627\u0621 \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u0642\u0627\u062F\u0645\u0629" }), _jsx("p", { className: "text-xl text-slate-500 mt-3 font-medium", children: "\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0633\u062A\u0631\u0627\u062D\u0629 \u0648\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0634\u0627\u0634\u0629 \u0639\u0646\u062F \u0635\u062F\u0648\u0631 \u0627\u0644\u062A\u0646\u0628\u064A\u0647 \u0627\u0644\u0635\u0648\u062A\u064A" })] }));
    }
    return (_jsxs("div", { className: "flex-1 flex flex-col items-center justify-center p-8 rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border-2 border-sky-500/30 shadow-2xl backdrop-blur-md relative overflow-hidden", children: [_jsx("div", { className: "absolute -top-32 -left-32 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" }), _jsx("div", { className: "absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" }), _jsxs("div", { className: "inline-flex items-center gap-2 px-6 py-2 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 font-bold text-xl mb-6 shadow-sm animate-pulse", children: [_jsx(Sparkles, { className: "w-5 h-5 text-sky-400" }), _jsx("span", { children: "\u062A\u0641\u0636\u0644 \u0628\u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0622\u0646" })] }), _jsx("div", { className: "relative my-2 select-none", children: _jsx("span", { className: "text-[130px] sm:text-[160px] font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-sky-100 to-sky-400 tracking-tighter drop-shadow-[0_10px_25px_rgba(56,189,248,0.4)] font-mono leading-none", children: queueNumber }) }), formattedName && (_jsx("div", { className: "text-3xl sm:text-4xl font-bold text-white mt-4 text-center tracking-wide", children: formattedName })), _jsxs("div", { className: "mt-8 flex flex-wrap items-center justify-center gap-4 text-slate-300 text-xl font-semibold", children: [_jsx("div", { className: "px-5 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-md flex items-center gap-2", children: _jsx("span", { className: "text-sky-400 font-bold", children: roomName || 'عيادة الكشف 1' }) }), _jsx("div", { className: "px-5 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-md", children: _jsx("span", { children: doctorName }) })] })] }));
}
