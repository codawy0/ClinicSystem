import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { FolderOpen, Search, Pill, FlaskConical, Trash2, Loader2, Sparkles, } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { doctorService } from '../../services/doctorService';
export function PrescriptionTemplateModal({ isOpen, onClose, onApplyTemplate, }) {
    const [templates, setTemplates] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    // Load templates on modal open
    useEffect(() => {
        if (!isOpen)
            return;
        setIsLoading(true);
        doctorService
            .getTemplates()
            .then((data) => setTemplates(data || []))
            .catch((err) => console.warn('Failed to load prescription templates:', err))
            .finally(() => setIsLoading(false));
    }, [isOpen]);
    // Filter templates
    const filteredTemplates = templates.filter((tpl) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q)
            return true;
        return (tpl.templateName.toLowerCase().includes(q) ||
            (tpl.defaultDiagnosis && tpl.defaultDiagnosis.toLowerCase().includes(q)));
    });
    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('هل أنت متأكد من حذف هذا القالب؟'))
            return;
        setDeletingId(id);
        try {
            await doctorService.deleteTemplate(id);
            setTemplates((prev) => prev.filter((t) => t.id !== id));
        }
        catch (err) {
            console.error('Failed to delete template:', err);
        }
        finally {
            setDeletingId(null);
        }
    };
    return (_jsx(Dialog, { isOpen: isOpen, onClose: onClose, title: "\u0642\u0648\u0627\u0644\u0628 \u0627\u0644\u0631\u0648\u0634\u062A\u0627\u062A \u0627\u0644\u062C\u0627\u0647\u0632\u0629 (Prescription Protocols)", description: "\u0627\u062E\u062A\u0631 \u0642\u0627\u0644\u0628\u0627\u064B \u062C\u0627\u0647\u0632\u0627\u064B \u0644\u062A\u0637\u0628\u064A\u0642\u0647 \u0628\u0646\u0642\u0631\u0629 \u0648\u0627\u062D\u062F\u0629 \u0639\u0644\u0649 \u0627\u0644\u0631\u0648\u0634\u062A\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629", maxWidth: "xl", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { className: "w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" }), _jsx("input", { type: "text", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), placeholder: "\u0627\u0628\u062D\u062B \u0628\u0627\u0633\u0645 \u0627\u0644\u0642\u0627\u0644\u0628 \u0623\u0648 \u0627\u0644\u062A\u0634\u062E\u064A\u0635...", className: "w-full text-sm rounded-xl border border-slate-300 pr-9 pl-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" })] }), isLoading ? (_jsxs("div", { className: "py-12 text-center text-slate-500", children: [_jsx(Loader2, { className: "w-6 h-6 animate-spin mx-auto text-sky-600 mb-2" }), _jsx("p", { className: "text-sm font-medium", children: "\u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0642\u0648\u0627\u0644\u0628..." })] })) : filteredTemplates.length === 0 ? (_jsxs("div", { className: "py-10 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-1", children: [_jsx(FolderOpen, { className: "w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" }), _jsx("p", { className: "text-sm font-medium text-slate-600", children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0642\u0648\u0627\u0644\u0628 \u0645\u0637\u0627\u0628\u0642\u0629" }), _jsx("p", { className: "text-xs text-slate-400", children: "\u064A\u0645\u0643\u0646\u0643 \u062D\u0641\u0638 \u0627\u0644\u0631\u0648\u0634\u062A\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0643\u0642\u0627\u0644\u0628 \u062C\u062F\u064A\u062F \u0641\u064A \u0623\u064A \u0648\u0642\u062A \u0645\u0646 \u062E\u0644\u0627\u0644 \u0632\u0631 \"\u062D\u0641\u0638 \u0643\u0642\u0627\u0644\u0628 \u062C\u062F\u064A\u062F\"." })] })) : (_jsx("div", { className: "max-h-96 overflow-y-auto space-y-2.5 pr-1", children: filteredTemplates.map((template) => {
                        const itemCount = template.items?.length || 0;
                        const labCount = template.labRadiologyOrders?.length || 0;
                        return (_jsxs("div", { className: "border border-slate-200 rounded-xl p-3.5 hover:border-sky-300 hover:bg-sky-50/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group", children: [_jsxs("div", { className: "space-y-1.5 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-bold text-slate-900 text-sm sm:text-base", children: template.templateName }), template.defaultDiagnosis && (_jsx("span", { className: "text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md", children: template.defaultDiagnosis }))] }), _jsxs("div", { className: "flex flex-wrap items-center gap-1.5 text-xs text-slate-600", children: [_jsxs("span", { className: "inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded", children: [_jsx(Pill, { className: "w-3 h-3 text-sky-600" }), itemCount, " ", itemCount === 1 ? 'دواء' : 'أدوية'] }), labCount > 0 && (_jsxs("span", { className: "inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded", children: [_jsx(FlaskConical, { className: "w-3 h-3 text-indigo-600" }), labCount, " ", labCount === 1 ? 'فحص' : 'فحوصات'] })), template.items?.slice(0, 3).map((it, idx) => (_jsx("span", { className: "bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px]", children: _jsx("bdi", { dir: "ltr", children: it.drugName }) }, idx))), itemCount > 3 && (_jsxs("span", { className: "text-[11px] text-slate-400", children: ["+", itemCount - 3, " \u0623\u062E\u0631\u0649"] }))] })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsxs(Button, { type: "button", variant: "primary", size: "sm", onClick: () => {
                                                onApplyTemplate(template);
                                                onClose();
                                            }, className: "bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs gap-1.5", children: [_jsx(Sparkles, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0642\u0627\u0644\u0628" })] }), _jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: (e) => handleDelete(e, template.id), disabled: deletingId === template.id, className: "text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 h-auto", title: "\u062D\u0630\u0641 \u0627\u0644\u0642\u0627\u0644\u0628", children: deletingId === template.id ? (_jsx(Loader2, { className: "w-4 h-4 animate-spin text-rose-500" })) : (_jsx(Trash2, { className: "w-4 h-4" })) })] })] }, template.id));
                    }) })), _jsx("div", { className: "flex justify-end pt-2 border-t border-slate-100", children: _jsx(Button, { variant: "secondary", size: "sm", onClick: onClose, children: "\u0625\u063A\u0644\u0627\u0642" }) })] }) }));
}
