import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Coffee } from 'lucide-react';
export function TvDoctorBreakBanner({ isOnBreak, message }) {
    if (!isOnBreak)
        return null;
    return (_jsxs("div", { className: "w-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 py-3.5 px-6 shadow-xl flex items-center justify-center gap-3 animate-pulse select-none", children: [_jsx("div", { className: "p-1.5 rounded-full bg-slate-950 text-amber-400", children: _jsx(Coffee, { className: "w-6 h-6" }) }), _jsx("span", { className: "text-xl sm:text-2xl font-black tracking-wide", children: message || 'الطبيب في استراحة قصيرة — يرجى الانتظار، وسيتم استئناف الكشف قريباً' })] }));
}
