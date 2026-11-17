import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Printer, Stethoscope, FlaskConical, FileCheck, } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { printService } from '../../services/printService';
export function PrescriptionPrintModal({ isOpen, onClose, patient, appointment, vitals, diagnosis, items, clinicalRequests, nextVisitDate, clinicSetting, }) {
    // Mode: 'digital' = full header & footer; 'letterhead' = blank 45mm margin for pre-printed pads
    const [printMode, setPrintMode] = useState('digital');
    const [pageSize, setPageSize] = useState('A5');
    const [isPrinting, setIsPrinting] = useState(false);
    const [isPrintingLabSlip, setIsPrintingLabSlip] = useState(false);
    if (!isOpen)
        return null;
    const patientName = patient?.fullName || appointment?.patientName || '---';
    const fileNumber = patient?.fileNumber || appointment?.fileNumber || '---';
    const ageYears = patient?.ageYears;
    const gender = patient?.gender || appointment?.gender;
    const weightKg = vitals?.weightKg;
    const todayStr = new Date().toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const handlePrint = async () => {
        setIsPrinting(true);
        try {
            await printService.printPrescription({
                patient,
                appointment,
                vitals,
                diagnosis,
                items,
                clinicalRequests,
                nextVisitDate,
                clinicSetting,
            }, {
                pageSize,
                mode: printMode,
            });
        }
        catch (err) {
            console.error('Failed to print prescription:', err);
        }
        finally {
            setIsPrinting(false);
        }
    };
    const handlePrintLabSlip = async () => {
        if (clinicalRequests.length === 0)
            return;
        setIsPrintingLabSlip(true);
        try {
            await printService.printLabSlip({
                patientName,
                fileNumber,
                ageYears,
                gender,
                doctorName: clinicSetting?.doctorName || 'د. طبيب العيادة',
                doctorTitle: clinicSetting?.doctorTitle || 'استشاري العيادة',
                clinicName: clinicSetting?.clinicName || 'العيادة التخصصية',
                date: todayStr,
                provisionalDiagnosis: diagnosis,
                requests: clinicalRequests.map((r) => ({
                    requestType: r.requestType === 'Lab' ? 'Lab' : 'Radiology',
                    nameAr: r.nameAr,
                    nameEn: r.nameEn,
                    notes: r.notes,
                })),
                clinicalNotes: diagnosis ? `التشخيص المبدئي: ${diagnosis}` : undefined,
            });
        }
        catch (err) {
            console.error('Failed to print lab slip:', err);
        }
        finally {
            setIsPrintingLabSlip(false);
        }
    };
    return (_jsx(Dialog, { isOpen: isOpen, onClose: onClose, title: "\u0645\u0639\u0627\u064A\u0646\u0629 \u0648\u0637\u0628\u0627\u0639\u0629 \u0627\u0644\u0631\u0648\u0634\u062A\u0629 \u0627\u0644\u0639\u0644\u0627\u062C\u064A\u0629 (Rx Pad)", description: "\u0627\u062E\u062A\u0631 \u0646\u0645\u0637 \u0627\u0644\u0637\u0628\u0627\u0639\u0629 \u0648\u0645\u0642\u0627\u0633 \u0627\u0644\u0648\u0631\u0642 (\u0648\u0631\u0642 \u0639\u064A\u0627\u062F\u0629 \u0645\u0633\u0628\u0642 \u0627\u0644\u0637\u0628\u0627\u0639\u0629 \u0623\u0648 \u0631\u0648\u0634\u062A\u0629 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629 \u0643\u0627\u0645\u0644\u0629)", maxWidth: "2xl", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl print:hidden", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-xs font-bold text-slate-700", children: "\u0627\u0644\u0646\u0645\u0637:" }), _jsxs("div", { className: "flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs", children: [_jsx("button", { type: "button", onClick: () => setPrintMode('digital'), className: `px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${printMode === 'digital'
                                                        ? 'bg-sky-600 text-white shadow-2xs'
                                                        : 'text-slate-600 hover:text-slate-900'}`, children: "\u0631\u0648\u0634\u062A\u0629 \u0643\u0627\u0645\u0644\u0629" }), _jsx("button", { type: "button", onClick: () => setPrintMode('letterhead'), className: `px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${printMode === 'letterhead'
                                                        ? 'bg-sky-600 text-white shadow-2xs'
                                                        : 'text-slate-600 hover:text-slate-900'}`, children: "\u0648\u0631\u0642 \u0639\u064A\u0627\u062F\u0629 (Letterhead 45mm)" })] })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-xs font-bold text-slate-700", children: "\u0627\u0644\u0645\u0642\u0627\u0633:" }), _jsxs("div", { className: "flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs", children: [_jsx("button", { type: "button", onClick: () => setPageSize('A5'), className: `px-2 py-1 text-xs font-semibold rounded-md transition-colors ${pageSize === 'A5'
                                                        ? 'bg-sky-600 text-white shadow-2xs'
                                                        : 'text-slate-600 hover:text-slate-900'}`, children: "A5" }), _jsx("button", { type: "button", onClick: () => setPageSize('A4'), className: `px-2 py-1 text-xs font-semibold rounded-md transition-colors ${pageSize === 'A4'
                                                        ? 'bg-sky-600 text-white shadow-2xs'
                                                        : 'text-slate-600 hover:text-slate-900'}`, children: "A4" })] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [clinicalRequests.length > 0 && (_jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: handlePrintLabSlip, disabled: isPrintingLabSlip, className: "text-xs text-indigo-700 border-indigo-300 hover:bg-indigo-50 gap-1.5", title: "\u0637\u0628\u0627\u0639\u0629 \u0637\u0644\u0628 \u0627\u0644\u0641\u062D\u0648\u0635\u0627\u062A \u0648\u0627\u0644\u062A\u062D\u0627\u0644\u064A\u0644 \u0641\u064A \u0625\u064A\u0635\u0627\u0644 \u0645\u0646\u0641\u0635\u0644", children: [_jsx(FileCheck, { className: "w-4 h-4" }), _jsx("span", { children: "\u0637\u0628\u0627\u0639\u0629 \u0637\u0644\u0628 \u0627\u0644\u0641\u062D\u0648\u0635\u0627\u062A" })] })), _jsxs(Button, { type: "button", variant: "primary", size: "sm", onClick: handlePrint, disabled: isPrinting, className: "bg-sky-600 hover:bg-sky-700 text-white font-bold gap-1.5 shadow-sm text-xs", children: [_jsx(Printer, { className: "w-4 h-4" }), _jsx("span", { children: isPrinting ? 'جاري الطباعة...' : 'طباعة الآن (Print)' })] })] })] }), _jsxs("div", { className: "bg-white border-2 border-slate-300 rounded-2xl p-6 sm:p-8 shadow-inner font-sans text-slate-900 max-h-[68vh] overflow-y-auto print:max-h-none print:overflow-visible print:border-none print:p-0 print:m-0 print:shadow-none print-prescription-root", children: [printMode === 'digital' ? (_jsxs("div", { className: "border-b-2 border-sky-600 pb-4 mb-4 flex items-center justify-between gap-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-12 h-12 rounded-2xl bg-sky-600 flex items-center justify-center text-white shadow-sm", children: _jsx(Stethoscope, { className: "w-7 h-7" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-black text-sky-950", children: clinicSetting?.clinicName || 'عيادة النخبة التخصصية' }), _jsx("p", { className: "text-sm font-bold text-sky-800", children: clinicSetting?.doctorName || 'د. استشاري العيادة' }), _jsx("p", { className: "text-xs text-slate-500", children: clinicSetting?.doctorTitle || clinicSetting?.specialty || 'استشاري الأمراض الباطنية والجهاز الهضمي' })] })] }), _jsxs("div", { className: "text-left text-xs text-slate-500 font-mono", children: [_jsxs("div", { children: ["\u0627\u0644\u062A\u0627\u0631\u064A\u062E: ", todayStr] }), _jsxs("div", { children: ["\u0627\u0644\u0645\u0644\u0641: ", _jsxs("bdi", { dir: "ltr", children: ["#", fileNumber] })] })] })] })) : (
                        // Letterhead mode: Blank 45mm spacing to accommodate pre-printed clinic letterhead
                        _jsx("div", { className: "h-28 print:h-[45mm] flex items-center justify-center border-b border-dashed border-slate-200 mb-4 print:border-none text-slate-300 text-xs italic", children: "[\u0645\u0633\u0627\u062D\u0629 \u0645\u062E\u0635\u0635\u0629 \u0644\u0648\u0631\u0642 \u0627\u0644\u0639\u064A\u0627\u062F\u0629 \u0627\u0644\u0645\u0637\u0628\u0648\u0639 \u0645\u0633\u0628\u0642\u0627\u064B - 45mm]" })), _jsxs("div", { className: "bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 mb-5 flex flex-wrap items-center justify-between gap-3 text-xs", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0631\u064A\u0636: " }), _jsx("span", { className: "font-bold text-slate-900 text-sm", children: patientName })] }), ageYears !== undefined && (_jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: "\u0627\u0644\u0633\u0646: " }), _jsxs("span", { className: "font-semibold text-slate-800", children: [ageYears, " \u0633\u0646\u0629"] })] })), gender && (_jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: "\u0627\u0644\u0646\u0648\u0639: " }), _jsx("span", { className: "font-semibold text-slate-800", children: gender === 'Female' ? 'أنثى' : 'ذكر' })] }))] }), _jsxs("div", { className: "flex items-center gap-4 font-mono", children: [weightKg && (_jsxs("div", { children: [_jsx("span", { className: "text-slate-500 font-sans", children: "\u0627\u0644\u0648\u0632\u0646: " }), _jsxs("span", { className: "font-bold text-slate-900", children: [weightKg, " kg"] })] })), _jsxs("div", { children: [_jsx("span", { className: "text-slate-500 font-sans", children: "\u0631\u0642\u0645 \u0627\u0644\u0645\u0644\u0641: " }), _jsx("span", { className: "font-bold text-slate-800", children: _jsxs("bdi", { dir: "ltr", children: ["#", fileNumber] }) })] }), _jsxs("div", { children: [_jsx("span", { className: "text-slate-500 font-sans", children: "\u0627\u0644\u062A\u0627\u0631\u064A\u062E: " }), _jsx("span", { className: "text-slate-700", children: todayStr })] })] })] }), diagnosis && (_jsxs("div", { className: "mb-4 text-xs", children: [_jsx("span", { className: "font-bold text-slate-700", children: "\u0627\u0644\u062A\u0634\u062E\u064A\u0635 (Diagnosis): " }), _jsx("span", { className: "font-semibold text-slate-900", children: diagnosis })] })), _jsxs("div", { className: "space-y-4 mb-6", children: [_jsxs("div", { className: "flex items-center gap-2 text-2xl font-serif font-black text-sky-800 select-none", children: [_jsx("span", { children: "\u211E" }), _jsx("div", { className: "h-0.5 flex-1 bg-slate-200" })] }), items.length === 0 ? (_jsx("p", { className: "text-center text-xs text-slate-400 py-6", children: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0623\u062F\u0648\u064A\u0629 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0631\u0648\u0634\u062A\u0629" })) : (_jsx("ol", { className: "space-y-3.5 pr-2", children: items.map((item, idx) => (_jsxs("li", { className: "space-y-0.5", children: [_jsxs("div", { className: "flex items-baseline gap-2", children: [_jsxs("span", { className: "font-mono font-bold text-sm text-slate-400 w-5", children: [idx + 1, "."] }), _jsxs("div", { className: "font-bold text-base text-slate-950", children: [_jsx("bdi", { dir: "ltr", children: item.drugName }), item.strength && (_jsx("span", { className: "text-sm font-mono text-slate-700 mr-2", children: _jsx("bdi", { dir: "ltr", children: item.strength }) })), item.form && (_jsxs("span", { className: "text-xs font-normal text-slate-500 mr-2", children: ["(", item.form, ")"] }))] })] }), _jsxs("div", { className: "pr-7 text-xs sm:text-sm font-semibold text-slate-800 flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "bg-slate-100 px-2 py-0.5 rounded text-sky-900 font-bold", children: item.dosage }), _jsx("span", { children: "\u2014" }), _jsx("span", { children: item.timing }), item.duration && (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u2014" }), _jsxs("span", { className: "text-slate-600", children: ["\u0644\u0645\u062F\u0629 ", item.duration] })] }))] }), item.instructions && (_jsxs("div", { className: "pr-7 text-xs text-slate-500 italic", children: ["* ", item.instructions] }))] }, idx))) }))] }), clinicalRequests.length > 0 && (_jsxs("div", { className: "border border-slate-200 rounded-xl p-3.5 mb-6 bg-slate-50/60", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-xs font-bold text-indigo-900 mb-2 border-b border-slate-200 pb-1.5", children: [_jsx(FlaskConical, { className: "w-4 h-4 text-indigo-600" }), _jsx("span", { children: "\u0627\u0644\u0641\u062D\u0648\u0635\u0627\u062A \u0648\u0627\u0644\u062A\u062D\u0627\u0644\u064A\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 (Lab & Radiology Orders)" })] }), _jsx("ul", { className: "grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs", children: clinicalRequests.map((req, idx) => (_jsxs("li", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" }), _jsx("span", { className: "font-semibold text-slate-800", children: req.nameAr }), req.nameEn && (_jsx("span", { className: "font-mono text-[11px] text-slate-500", children: _jsxs("bdi", { dir: "ltr", children: ["(", req.nameEn, ")"] }) })), req.notes && (_jsxs("span", { className: "text-[10px] text-slate-400", children: ["[", req.notes, "]"] }))] }, idx))) })] })), _jsxs("div", { className: "pt-6 border-t-2 border-slate-200 flex items-end justify-between gap-6 text-xs", children: [_jsx("div", { children: nextVisitDate ? (_jsxs("div", { className: "bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-lg text-sky-900", children: [_jsx("span", { className: "font-bold", children: "\u0645\u0648\u0639\u062F \u0627\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0627\u0644\u0642\u0627\u062F\u0645\u0629: " }), _jsx("span", { className: "font-mono font-semibold", children: nextVisitDate })] })) : (_jsx("div", { className: "text-slate-400 text-[11px]", children: "\u062A\u0645\u0646\u064A\u0627\u062A\u0646\u0627 \u0644\u0644\u0645\u0631\u064A\u0636 \u0628\u0627\u0644\u0634\u0641\u0627\u0621 \u0627\u0644\u0639\u0627\u062C\u0644 \u0648\u062F\u0648\u0627\u0645 \u0627\u0644\u0635\u062D\u0629 \u0648\u0627\u0644\u0639\u0627\u0641\u064A\u0629." })) }), _jsxs("div", { className: "text-center space-y-3 min-w-[140px]", children: [_jsx("span", { className: "font-bold text-slate-700 block", children: "\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0637\u0628\u064A\u0628 \u0627\u0644\u0645\u0639\u0627\u0644\u062C" }), _jsx("div", { className: "h-10 border-b border-dashed border-slate-400" }), _jsx("span", { className: "text-[11px] text-slate-500 block", children: clinicSetting?.doctorName || 'د. الطبيب' })] })] })] }), _jsxs("div", { className: "flex items-center justify-between pt-2 border-t border-slate-100 print:hidden", children: [_jsx(Button, { variant: "outline", size: "sm", onClick: onClose, children: "\u0625\u063A\u0644\u0627\u0642" }), _jsxs(Button, { variant: "primary", size: "sm", onClick: handlePrint, disabled: isPrinting, className: "bg-sky-600 hover:bg-sky-700 text-white font-bold gap-2", children: [_jsx(Printer, { className: "w-4 h-4" }), _jsx("span", { children: isPrinting ? 'جاري الطباعة...' : 'طباعة الروشتة (Print)' })] })] })] }) }));
}
