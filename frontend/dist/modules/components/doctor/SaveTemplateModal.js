import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Save, Pill, FlaskConical, Loader2 } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { doctorService } from '../../services/doctorService';
export function SaveTemplateModal({ isOpen, onClose, currentDiagnosis, currentItems, currentOrders, onSaved, }) {
    const [templateName, setTemplateName] = useState('');
    const [defaultDiagnosis, setDefaultDiagnosis] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    useEffect(() => {
        if (isOpen) {
            setTemplateName('');
            setDefaultDiagnosis(currentDiagnosis || '');
            setErrorMsg('');
        }
    }, [isOpen, currentDiagnosis]);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!templateName.trim()) {
            setErrorMsg('يرجى إدخال اسم للقالب');
            return;
        }
        setIsSubmitting(true);
        setErrorMsg('');
        try {
            const payload = {
                templateName: templateName.trim(),
                defaultDiagnosis: defaultDiagnosis.trim() || undefined,
                items: currentItems.map((item) => ({
                    drugId: item.drugId || null,
                    drugName: item.drugName,
                    activeIngredient: item.activeIngredient || null,
                    dosage: item.dosage,
                    form: item.form || null,
                    route: item.route || null,
                    timing: item.timing,
                    duration: item.duration,
                    instructions: item.instructions || null,
                })),
                labRadiologyOrders: currentOrders.map((o) => ({
                    requestType: o.requestType,
                    catalogCode: o.catalogCode || null,
                    nameAr: o.nameAr,
                    nameEn: o.nameEn || null,
                    notes: o.notes || null,
                })),
            };
            await doctorService.createTemplate(payload);
            onSaved();
            onClose();
        }
        catch (err) {
            console.error('Failed to create prescription template:', err);
            setErrorMsg(err.message || 'حدث خطأ أثناء حفظ القالب');
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (_jsx(Dialog, { isOpen: isOpen, onClose: onClose, title: "\u062D\u0641\u0638 \u0627\u0644\u0631\u0648\u0634\u062A\u0629 \u0643\u0642\u0627\u0644\u0628 \u062C\u062F\u064A\u062F", description: "\u0627\u062D\u0641\u0638 \u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644 \u0627\u0644\u0639\u0644\u0627\u062C \u0627\u0644\u062D\u0627\u0644\u064A \u0644\u0625\u0639\u0627\u062F\u0629 \u0627\u0633\u062A\u062E\u062F\u0627\u0645\u0647 \u0628\u0646\u0642\u0631\u0629 \u0648\u0627\u062D\u062F\u0629 \u0644\u0627\u062D\u0642\u0627\u064B", maxWidth: "md", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [errorMsg && (_jsx("div", { className: "p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold", children: errorMsg })), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1.5", children: "\u0627\u0633\u0645 \u0627\u0644\u0642\u0627\u0644\u0628 (Template Name) *" }), _jsx("input", { type: "text", required: true, value: templateName, onChange: (e) => setTemplateName(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: \u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644 \u0627\u0644\u0646\u0632\u0644\u0629 \u0627\u0644\u0634\u0639\u0628\u064A\u0629 \u0627\u0644\u062D\u0627\u062F\u0629...", className: "w-full text-sm font-semibold rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1.5", children: "\u0627\u0644\u062A\u0634\u062E\u064A\u0635 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0627\u0644\u0645\u0642\u062A\u0631\u0646" }), _jsx("input", { type: "text", value: defaultDiagnosis, onChange: (e) => setDefaultDiagnosis(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: Acute Bronchitis...", className: "w-full text-sm rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" })] }), _jsxs("div", { className: "bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs", children: [_jsx("span", { className: "font-bold text-slate-700 block", children: "\u0645\u062D\u062A\u0648\u064A\u0627\u062A \u0627\u0644\u0642\u0627\u0644\u0628:" }), _jsxs("div", { className: "flex items-center gap-4 text-slate-600", children: [_jsxs("span", { className: "flex items-center gap-1.5 font-medium", children: [_jsx(Pill, { className: "w-3.5 h-3.5 text-sky-600" }), currentItems.length, " ", currentItems.length === 1 ? 'دواء' : 'أدوية'] }), _jsxs("span", { className: "flex items-center gap-1.5 font-medium", children: [_jsx(FlaskConical, { className: "w-3.5 h-3.5 text-indigo-600" }), currentOrders.length, " ", currentOrders.length === 1 ? 'فحص / تحليل' : 'فحوصات'] })] }), _jsx("div", { className: "flex flex-wrap gap-1 pt-1 max-h-24 overflow-y-auto", children: currentItems.map((item, idx) => (_jsx("span", { className: "bg-white border border-slate-200 text-slate-800 text-[11px] px-2 py-0.5 rounded-md font-mono", children: _jsx("bdi", { dir: "ltr", children: item.drugName }) }, idx))) })] }), _jsxs("div", { className: "flex items-center justify-end gap-2 pt-2 border-t border-slate-100", children: [_jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: onClose, disabled: isSubmitting, children: "\u0625\u0644\u063A\u0627\u0621" }), _jsxs(Button, { type: "submit", variant: "primary", size: "sm", disabled: isSubmitting || !templateName.trim(), className: "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5", children: [isSubmitting ? (_jsx(Loader2, { className: "w-4 h-4 animate-spin" })) : (_jsx(Save, { className: "w-4 h-4" })), _jsx("span", { children: "\u062D\u0641\u0638 \u0627\u0644\u0642\u0627\u0644\u0628" })] })] })] }) }));
}
