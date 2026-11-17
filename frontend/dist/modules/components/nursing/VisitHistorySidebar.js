import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { History, Calendar, ChevronDown, ChevronUp, Scale, Heart, FileText, User, RefreshCw, TrendingUp, TrendingDown, Minus, } from 'lucide-react';
import { nursingService } from '../../services/nursingService';
import { cn } from '../../lib/utils';
export function VisitHistorySidebar({ patientId, currentVisitId, currentWeight, currentBpSystolic, currentBpDiastolic, }) {
    const [visits, setVisits] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedVisitId, setExpandedVisitId] = useState(null);
    useEffect(() => {
        if (!patientId) {
            setVisits([]);
            return;
        }
        let isMounted = true;
        setIsLoading(true);
        nursingService
            .getPatientVisits(patientId, 1, 15)
            .then((res) => {
            if (!isMounted)
                return;
            // Filter out current visit if it is in the list
            const pastVisits = (res.items || []).filter((v) => v.id !== currentVisitId);
            setVisits(pastVisits);
            if (pastVisits.length > 0) {
                setExpandedVisitId(pastVisits[0].id);
            }
        })
            .catch(() => {
            if (isMounted)
                setVisits([]);
        })
            .finally(() => {
            if (isMounted)
                setIsLoading(false);
        });
        return () => {
            isMounted = false;
        };
    }, [patientId, currentVisitId]);
    const toggleExpand = (id) => {
        setExpandedVisitId((prev) => (prev === id ? null : id));
    };
    // Helper to compute weight delta
    const renderWeightDelta = (pastWeight) => {
        if (!pastWeight || !currentWeight)
            return null;
        const delta = Math.round((currentWeight - pastWeight) * 10) / 10;
        if (delta > 0) {
            return (_jsxs("span", { className: "inline-flex items-center gap-0.5 text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded dir-ltr", children: [_jsx(TrendingUp, { className: "w-3 h-3" }), "+", delta, " kg"] }));
        }
        if (delta < 0) {
            return (_jsxs("span", { className: "inline-flex items-center gap-0.5 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded dir-ltr", children: [_jsx(TrendingDown, { className: "w-3 h-3" }), delta, " kg"] }));
        }
        return (_jsxs("span", { className: "inline-flex items-center gap-0.5 text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded", children: [_jsx(Minus, { className: "w-3 h-3" }), "\u062B\u0627\u0628\u062A"] }));
    };
    return (_jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-120px)] overflow-hidden text-right", children: [_jsxs("div", { className: "p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center", children: _jsx(History, { className: "w-4 h-4" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-sm font-bold text-slate-800", children: "\u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0633\u0631\u064A\u0631\u064A \u0627\u0644\u0633\u0627\u0628\u0642" }), _jsx("p", { className: "text-[11px] text-slate-500", children: "\u0645\u0642\u0627\u0631\u0646\u0629 \u0627\u0644\u0642\u064A\u0627\u0633\u0627\u062A \u0628\u0627\u0644\u0632\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0633\u0627\u0628\u0642\u0629" })] })] }), visits.length > 0 && (_jsxs("span", { className: "text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full", children: [visits.length, " \u0632\u064A\u0627\u0631\u0627\u062A"] }))] }), _jsx("div", { className: "flex-1 overflow-y-auto p-3 space-y-2", children: isLoading ? (_jsxs("div", { className: "py-12 text-center text-slate-400 space-y-2", children: [_jsx(RefreshCw, { className: "w-6 h-6 animate-spin mx-auto text-sky-600" }), _jsx("p", { className: "text-xs", children: "\u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0633\u0627\u0628\u0642..." })] })) : !patientId ? (_jsxs("div", { className: "py-12 text-center text-slate-400 space-y-2", children: [_jsx(User, { className: "w-8 h-8 mx-auto text-slate-300" }), _jsx("p", { className: "text-xs", children: "\u062D\u062F\u062F \u0645\u0631\u064A\u0636\u0627\u064B \u0644\u0639\u0631\u0636 \u0632\u064A\u0627\u0631\u0627\u062A\u0647 \u0627\u0644\u0633\u0627\u0628\u0642\u0629" })] })) : visits.length === 0 ? (_jsxs("div", { className: "py-12 text-center text-slate-400 space-y-2", children: [_jsx(FileText, { className: "w-8 h-8 mx-auto text-slate-300" }), _jsx("p", { className: "text-xs font-semibold text-slate-600", children: "\u0647\u0630\u0647 \u0623\u0648\u0644 \u0632\u064A\u0627\u0631\u0629 \u0644\u0644\u0645\u0631\u064A\u0636" }), _jsx("p", { className: "text-[11px] text-slate-400", children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0632\u064A\u0627\u0631\u0627\u062A \u0633\u0627\u0628\u0642\u0629 \u0645\u0633\u062C\u0644\u0629 \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645" })] })) : (visits.map((visit) => {
                    const isExpanded = expandedVisitId === visit.id;
                    const visitDateFormatted = visit.visitDate
                        ? new Date(visit.visitDate).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                        })
                        : 'تاريخ غير محدد';
                    return (_jsxs("div", { className: cn('rounded-xl border transition-all overflow-hidden', isExpanded ? 'border-sky-300 bg-sky-50/30' : 'border-slate-200 bg-white hover:border-slate-300'), children: [_jsxs("button", { type: "button", onClick: () => toggleExpand(visit.id), className: "w-full p-3 flex items-center justify-between text-right gap-2 cursor-pointer focus:outline-none", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-xs font-bold text-slate-800", children: [_jsx(Calendar, { className: "w-3.5 h-3.5 text-sky-600" }), _jsx("span", { children: visitDateFormatted }), visit.isDraft && (_jsx("span", { className: "text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded", children: "\u0645\u0633\u0648\u062F\u0629" }))] }), visit.doctorName && (_jsxs("p", { className: "text-[11px] text-slate-500", children: ["\u0627\u0644\u0637\u0628\u064A\u0628: ", visit.doctorName] }))] }), _jsx("div", { className: "text-slate-400 hover:text-slate-600", children: isExpanded ? _jsx(ChevronUp, { className: "w-4 h-4" }) : _jsx(ChevronDown, { className: "w-4 h-4" }) })] }), isExpanded && (_jsxs("div", { className: "p-3 pt-0 border-t border-slate-100 space-y-2.5 text-xs", children: [_jsxs("div", { className: "grid grid-cols-2 gap-2 pt-2", children: [_jsxs("div", { className: "p-2 bg-white rounded-lg border border-slate-200 space-y-0.5", children: [_jsxs("div", { className: "flex items-center justify-between text-[10px] text-slate-500", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Heart, { className: "w-3 h-3 text-rose-500" }), "\u0636\u063A\u0637 \u0627\u0644\u062F\u0645"] }), currentBpSystolic && currentBpDiastolic ? (_jsxs("span", { className: "text-[9px] text-slate-400", children: ["(\u0627\u0644\u062D\u0627\u0644\u064A: ", currentBpSystolic, "/", currentBpDiastolic, ")"] })) : null] }), _jsx("div", { className: "font-mono font-bold text-slate-800 text-xs", children: visit.bpSystolic && visit.bpDiastolic
                                                            ? `${visit.bpSystolic}/${visit.bpDiastolic}`
                                                            : 'غير مسجل' })] }), _jsxs("div", { className: "p-2 bg-white rounded-lg border border-slate-200 space-y-0.5", children: [_jsxs("div", { className: "flex items-center justify-between text-[10px] text-slate-500", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Scale, { className: "w-3 h-3 text-teal-500" }), "\u0627\u0644\u0648\u0632\u0646"] }), renderWeightDelta(visit.weightKg)] }), _jsx("div", { className: "font-mono font-bold text-slate-800 text-xs", children: visit.weightKg ? `${visit.weightKg} kg` : 'غير مسجل' })] }), _jsxs("div", { className: "p-2 bg-white rounded-lg border border-slate-200 space-y-0.5", children: [_jsx("span", { className: "text-[10px] text-slate-500", children: "\u0627\u0644\u0646\u0628\u0636" }), _jsx("div", { className: "font-mono font-bold text-slate-800 text-xs", children: visit.pulseBpm ? `${visit.pulseBpm} bpm` : 'غير مسجل' })] }), _jsxs("div", { className: "p-2 bg-white rounded-lg border border-slate-200 space-y-0.5", children: [_jsx("span", { className: "text-[10px] text-slate-500", children: "\u0627\u0644\u0633\u0643\u0631" }), _jsx("div", { className: "font-mono font-bold text-slate-800 text-xs", children: visit.bloodSugarMgDl ? `${visit.bloodSugarMgDl} mg/dL` : 'غير مسجل' })] })] }), visit.chiefComplaint && (_jsxs("div", { className: "p-2 bg-white rounded-lg border border-slate-200", children: [_jsx("span", { className: "text-[10px] font-bold text-slate-500 block", children: "\u0634\u0643\u0648\u0649 \u0627\u0644\u0632\u064A\u0627\u0631\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629:" }), _jsx("p", { className: "text-[11px] text-slate-700 mt-0.5", children: visit.chiefComplaint })] })), visit.diagnosis && (_jsxs("div", { className: "p-2 bg-teal-50/50 rounded-lg border border-teal-200", children: [_jsx("span", { className: "text-[10px] font-bold text-teal-800 block", children: "\u0627\u0644\u062A\u0634\u062E\u064A\u0635 \u0627\u0644\u0637\u0628\u064A \u0627\u0644\u0633\u0627\u0628\u0642:" }), _jsx("p", { className: "text-[11px] text-teal-900 mt-0.5 font-semibold", children: visit.diagnosis })] }))] }))] }, visit.id));
                })) })] }));
}
