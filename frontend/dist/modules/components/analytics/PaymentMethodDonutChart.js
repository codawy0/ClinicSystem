import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { formatEgp, piastresToEgpNumber } from '../../lib/currency';
export function PaymentMethodDonutChart({ data, size = 180 }) {
    const [hoveredKey, setHoveredKey] = useState(null);
    const segments = [
        {
            id: 'Cash',
            label: 'نقدي (كاش)',
            piastres: data.cashPiastres || 0,
            count: data.cashCount || 0,
            color: '#10b981', // emerald-500
            hoverColor: '#059669',
        },
        {
            id: 'Instapay',
            label: 'انستاباي (Instapay)',
            piastres: data.instapayPiastres || 0,
            count: data.instapayCount || 0,
            color: '#8b5cf6', // violet-500
            hoverColor: '#7c3aed',
        },
        {
            id: 'VodafoneCash',
            label: 'فودافون كاش',
            piastres: data.vodafoneCashPiastres || 0,
            count: data.vodafoneCashCount || 0,
            color: '#f43f5e', // rose-500
            hoverColor: '#e11d48',
        },
        {
            id: 'Card',
            label: 'بطاقة بنكية (Card)',
            piastres: data.cardPiastres || 0,
            count: data.cardCount || 0,
            color: '#0ea5e9', // sky-500
            hoverColor: '#0284c7',
        },
    ];
    const totalPiastres = segments.reduce((sum, s) => sum + s.piastres, 0);
    // SVG Donut calculation
    const radius = 60;
    const strokeWidth = 24;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;
    let cumulativePercent = 0;
    return (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4 shadow-2xs", children: [_jsx("div", { className: "font-bold text-slate-800 text-xs mb-3", children: "\u062A\u0648\u0632\u064A\u0639 \u0637\u0631\u0642 \u0627\u0644\u062F\u0641\u0639 \u0648\u0627\u0644\u062A\u062D\u0635\u064A\u0644" }), _jsxs("div", { className: "flex flex-col sm:flex-row items-center gap-6", children: [_jsxs("div", { className: "relative flex-shrink-0", style: { width: size, height: size }, children: [totalPiastres === 0 ? (_jsx("div", { style: { width: size, height: size }, className: "rounded-full border-4 border-dashed border-slate-200 flex items-center justify-center text-slate-400 text-[11px]", children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u062A\u062D\u0635\u0644\u0627\u062A" })) : (_jsx("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, className: "-rotate-90", children: segments.map((seg) => {
                                    if (seg.piastres <= 0)
                                        return null;
                                    const percent = seg.piastres / totalPiastres;
                                    const dashLength = percent * circumference;
                                    const spaceLength = circumference - dashLength;
                                    const offset = -cumulativePercent * circumference;
                                    cumulativePercent += percent;
                                    const isHovered = hoveredKey === seg.id;
                                    return (_jsx("circle", { cx: center, cy: center, r: radius, fill: "transparent", stroke: isHovered ? seg.hoverColor : seg.color, strokeWidth: isHovered ? strokeWidth + 4 : strokeWidth, strokeDasharray: `${dashLength} ${spaceLength}`, strokeDashoffset: offset, className: "transition-all duration-300 cursor-pointer", onMouseEnter: () => setHoveredKey(seg.id), onMouseLeave: () => setHoveredKey(null) }, seg.id));
                                }) })), totalPiastres > 0 && (_jsxs("div", { className: "absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2", children: [_jsx("span", { className: "text-[10px] text-slate-500 font-medium", children: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062A\u062D\u0635\u064A\u0644" }), _jsx("span", { className: "text-sm font-bold text-slate-800", children: _jsx("bdi", { dir: "ltr", children: piastresToEgpNumber(totalPiastres) }) }), _jsx("span", { className: "text-[10px] text-slate-400", children: "\u062C.\u0645" })] }))] }), _jsx("div", { className: "flex-1 w-full space-y-2 text-xs", children: segments.map((seg) => {
                            const pct = totalPiastres > 0 ? ((seg.piastres / totalPiastres) * 100).toFixed(1) : '0';
                            const isHovered = hoveredKey === seg.id;
                            return (_jsxs("div", { onMouseEnter: () => setHoveredKey(seg.id), onMouseLeave: () => setHoveredKey(null), className: `p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${isHovered ? 'bg-slate-50 border-slate-300 shadow-2xs' : 'border-transparent'}`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-3 h-3 rounded-full flex-shrink-0", style: { backgroundColor: seg.color } }), _jsxs("div", { children: [_jsx("div", { className: "font-semibold text-slate-700", children: seg.label }), _jsxs("div", { className: "text-[10px] text-slate-400", children: [seg.count, " ", seg.count === 1 ? 'معاملة' : 'معاملات'] })] })] }), _jsxs("div", { className: "text-left", children: [_jsx("div", { className: "font-bold text-slate-800", children: _jsx("bdi", { dir: "ltr", children: formatEgp(seg.piastres) }) }), _jsx("div", { className: "text-[10px] text-slate-500 font-medium", children: _jsxs("bdi", { dir: "ltr", children: ["%", pct] }) })] })] }, seg.id));
                        }) })] })] }));
}
