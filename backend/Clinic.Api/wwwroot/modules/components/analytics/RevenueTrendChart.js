import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { formatEgp, piastresToEgpNumber } from '../../lib/currency';
export function RevenueTrendChart({ data, height = 260 }) {
    const [hoveredIndex, setHoveredIndex] = useState(null);
    if (!data || data.length === 0) {
        return (_jsx("div", { style: { height }, className: "flex items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs", children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0645\u0633\u062C\u0644\u0629 \u0644\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629" }));
    }
    const padding = { top: 25, right: 35, bottom: 45, left: 55 };
    const width = 650;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maxVal = Math.max(...data.map((d) => Math.max(d.grossPiastres, d.netPiastres, d.paidPiastres)), 10000 // minimum 100 EGP to prevent div by 0
    );
    const pointsCount = data.length;
    const stepX = pointsCount > 1 ? chartWidth / (pointsCount - 1) : chartWidth / 2;
    // Generate polyline points
    const grossPoints = data
        .map((d, i) => {
        const x = padding.left + (pointsCount > 1 ? i * stepX : chartWidth / 2);
        const y = padding.top + chartHeight - (d.grossPiastres / maxVal) * chartHeight;
        return `${x},${y}`;
    })
        .join(' ');
    const paidPoints = data
        .map((d, i) => {
        const x = padding.left + (pointsCount > 1 ? i * stepX : chartWidth / 2);
        const y = padding.top + chartHeight - (d.paidPiastres / maxVal) * chartHeight;
        return `${x},${y}`;
    })
        .join(' ');
    // Y-axis grid ticks (4 ticks)
    const yTicks = [0, 0.33, 0.66, 1].map((pct) => ({
        val: Math.round(maxVal * pct),
        y: padding.top + chartHeight - pct * chartHeight,
    }));
    return (_jsxs("div", { className: "relative w-full bg-white rounded-xl border border-slate-200 p-4 shadow-2xs", children: [_jsxs("div", { className: "flex items-center justify-between mb-3 text-xs", children: [_jsxs("div", { className: "font-bold text-slate-800 flex items-center gap-2", children: [_jsx("span", { children: "\u0627\u062A\u062C\u0627\u0647 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0627\u0644\u064A\u0648\u0645\u064A\u0629" }), _jsxs("span", { className: "text-[11px] font-normal text-slate-500", children: ["(", data.length, " ", data.length === 1 ? 'يوم' : 'أيام', ")"] })] }), _jsxs("div", { className: "flex items-center gap-4 text-[11px]", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-3 h-3 rounded-xs bg-sky-500 inline-block" }), _jsx("span", { className: "text-slate-600 font-medium", children: "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0635\u0627\u0641\u064A" })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-3 h-3 rounded-xs bg-emerald-500 inline-block" }), _jsx("span", { className: "text-slate-600 font-medium", children: "\u0627\u0644\u0645\u062D\u0635\u0644 \u0641\u0639\u0644\u064A\u0627\u064B" })] })] })] }), _jsx("div", { className: "w-full overflow-x-auto", children: _jsxs("svg", { viewBox: `0 0 ${width} ${height}`, className: "w-full overflow-visible", style: { minWidth: '480px', maxHeight: `${height}px` }, children: [yTicks.map((tick, i) => (_jsxs("g", { children: [_jsx("line", { x1: padding.left, y1: tick.y, x2: width - padding.right, y2: tick.y, stroke: "#f1f5f9", strokeWidth: "1", strokeDasharray: i === 0 ? undefined : '3 3' }), _jsx("text", { x: padding.left - 8, y: tick.y + 3, textAnchor: "end", className: "text-[10px] fill-slate-400 font-medium", children: piastresToEgpNumber(tick.val) })] }, i))), data.length > 1 && (_jsx("polygon", { points: `${padding.left},${padding.top + chartHeight} ${grossPoints} ${padding.left + (data.length - 1) * stepX},${padding.top + chartHeight}`, fill: "rgba(14, 165, 233, 0.08)" })), _jsx("polyline", { fill: "none", stroke: "#0ea5e9", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", points: grossPoints }), _jsx("polyline", { fill: "none", stroke: "#10b981", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", strokeDasharray: "4 2", points: paidPoints }), data.map((d, i) => {
                            const x = padding.left + (pointsCount > 1 ? i * stepX : chartWidth / 2);
                            const yGross = padding.top + chartHeight - (d.grossPiastres / maxVal) * chartHeight;
                            const yPaid = padding.top + chartHeight - (d.paidPiastres / maxVal) * chartHeight;
                            const isHovered = hoveredIndex === i;
                            return (_jsxs("g", { className: "cursor-pointer transition-all", onMouseEnter: () => setHoveredIndex(i), onMouseLeave: () => setHoveredIndex(null), children: [isHovered && (_jsx("line", { x1: x, y1: padding.top, x2: x, y2: padding.top + chartHeight, stroke: "#94a3b8", strokeWidth: "1", strokeDasharray: "2 2" })), _jsx("circle", { cx: x, cy: yGross, r: isHovered ? 5 : 3.5, fill: "#0ea5e9", stroke: "#ffffff", strokeWidth: "2" }), _jsx("circle", { cx: x, cy: yPaid, r: isHovered ? 5 : 3, fill: "#10b981", stroke: "#ffffff", strokeWidth: "1.5" }), _jsx("text", { x: x, y: padding.top + chartHeight + 18, textAnchor: "middle", className: `text-[10px] font-medium ${isHovered ? 'fill-sky-700 font-bold' : 'fill-slate-500'}`, children: d.date.length > 5 ? d.date.substring(5) : d.date })] }, i));
                        })] }) }), hoveredIndex !== null && data[hoveredIndex] && (_jsxs("div", { className: "mt-3 p-2.5 bg-slate-800 text-white rounded-lg text-xs flex items-center justify-between shadow-lg", children: [_jsxs("div", { className: "font-bold flex items-center gap-2", children: [_jsx("span", { children: "\u0627\u0644\u062A\u0627\u0631\u064A\u062E:" }), _jsx("bdi", { dir: "ltr", children: data[hoveredIndex].date }), _jsxs("span", { className: "text-slate-400 text-[11px] mr-2", children: ["(", data[hoveredIndex].patientCount, " \u0645\u0631\u064A\u0636)"] })] }), _jsxs("div", { className: "flex gap-4", children: [_jsxs("span", { className: "text-sky-300", children: ["\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A: ", _jsx("bdi", { dir: "ltr", children: formatEgp(data[hoveredIndex].grossPiastres) })] }), _jsxs("span", { className: "text-emerald-300", children: ["\u0627\u0644\u0645\u062D\u0635\u0644: ", _jsx("bdi", { dir: "ltr", children: formatEgp(data[hoveredIndex].paidPiastres) })] })] })] }))] }));
}
