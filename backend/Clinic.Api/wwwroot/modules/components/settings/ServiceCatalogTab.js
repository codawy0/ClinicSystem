import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Plus, Edit2, CheckCircle2, XCircle, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { formatEgp, parseEgpToPiastres, piastresToEgpNumber } from '../../lib/currency';
import { api } from '../../lib/api';
const DEFAULT_SERVICES = [
    {
        id: 1,
        code: 'EXAM-GEN',
        nameAr: 'كشف عام باطنة وقلب',
        nameEn: 'General Internal Exam',
        category: 'Examination',
        defaultPricePiastres: 30000,
        isActive: true,
    },
    {
        id: 2,
        code: 'CONSULT',
        nameAr: 'استشارة / إعادة كشف مجانية',
        nameEn: 'Free Follow-up Consultation',
        category: 'Consultation',
        defaultPricePiastres: 0,
        isActive: true,
    },
    {
        id: 3,
        code: 'PROC-ECG',
        nameAr: 'تخطيط قلب كهربائي (ECG)',
        nameEn: 'Electrocardiogram',
        category: 'Procedure',
        defaultPricePiastres: 15000,
        isActive: true,
    },
    {
        id: 4,
        code: 'PROC-GLUC',
        nameAr: 'تحليل سكر عشوائي فوري',
        nameEn: 'Random Blood Glucose',
        category: 'Procedure',
        defaultPricePiastres: 5000,
        isActive: true,
    },
    {
        id: 5,
        code: 'PROC-NEB',
        nameAr: 'جلسة نيبولايزر استنشاق',
        nameEn: 'Nebulizer Inhalation Session',
        category: 'Procedure',
        defaultPricePiastres: 10000,
        isActive: true,
    },
    {
        id: 6,
        code: 'PROC-DRESS',
        nameAr: 'غيار جراحي معقم',
        nameEn: 'Surgical Dressing',
        category: 'Procedure',
        defaultPricePiastres: 8000,
        isActive: true,
    },
];
export function ServiceCatalogTab() {
    const [services, setServices] = useState(DEFAULT_SERVICES);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    // Edit modal
    const [editingService, setEditingService] = useState(null);
    const [editPriceEgp, setEditPriceEgp] = useState('');
    // Add modal
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newCode, setNewCode] = useState('');
    const [newNameAr, setNewNameAr] = useState('');
    const [newNameEn, setNewNameEn] = useState('');
    const [newCategory, setNewCategory] = useState('Procedure');
    const [newPriceEgp, setNewPriceEgp] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(null);
    useEffect(() => {
        loadServices();
    }, []);
    const loadServices = async () => {
        try {
            const data = await api.get('/settings/services');
            if (Array.isArray(data) && data.length > 0) {
                setServices(data);
            }
        }
        catch {
            // Fallback to default catalog if endpoint not yet initialized
        }
    };
    const handleEditPrice = (service) => {
        setEditingService(service);
        setEditPriceEgp(piastresToEgpNumber(service.defaultPricePiastres).toString());
    };
    const handleSavePrice = async (e) => {
        e.preventDefault();
        if (!editingService)
            return;
        setSaving(true);
        const newPricePiastres = parseEgpToPiastres(editPriceEgp || '0');
        try {
            await api.put(`/settings/services/${editingService.id}`, {
                ...editingService,
                defaultPricePiastres: newPricePiastres,
            });
        }
        catch {
            // Update local state smoothly
        }
        setServices((prev) => prev.map((s) => (s.id === editingService.id ? { ...s, defaultPricePiastres: newPricePiastres } : s)));
        setSaving(false);
        setEditingService(null);
        showNotice('تم تحديث سعر الخدمة بنجاح');
    };
    const handleToggleActive = async (service) => {
        const updated = !service.isActive;
        setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, isActive: updated } : s)));
        try {
            await api.put(`/settings/services/${service.id}`, {
                ...service,
                isActive: updated,
            });
        }
        catch {
            // handled
        }
    };
    const handleAddService = async (e) => {
        e.preventDefault();
        if (!newCode || !newNameAr)
            return;
        setSaving(true);
        const pricePiastres = parseEgpToPiastres(newPriceEgp || '0');
        const newService = {
            id: Date.now(),
            code: newCode.trim().toUpperCase(),
            nameAr: newNameAr.trim(),
            nameEn: newNameEn.trim() || undefined,
            category: newCategory,
            defaultPricePiastres: pricePiastres,
            isActive: true,
        };
        try {
            await api.post('/settings/services', newService);
        }
        catch {
            // fallback
        }
        setServices((prev) => [...prev, newService]);
        setSaving(false);
        setIsAddOpen(false);
        setNewCode('');
        setNewNameAr('');
        setNewNameEn('');
        setNewPriceEgp('');
        showNotice('تمت إضافة الخدمة بنجاح إلى الدليل');
    };
    const showNotice = (msg) => {
        setSaveSuccess(msg);
        setTimeout(() => setSaveSuccess(null), 3000);
    };
    const filteredServices = services.filter((s) => {
        const matchSearch = s.nameAr.includes(search) ||
            (s.nameEn && s.nameEn.toLowerCase().includes(search.toLowerCase())) ||
            s.code.toLowerCase().includes(search.toLowerCase());
        const matchCat = categoryFilter === 'ALL' || s.category === categoryFilter;
        return matchSearch && matchCat;
    });
    return (_jsxs("div", { className: "space-y-4", children: [saveSuccess && (_jsxs("div", { className: "p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in", children: [_jsx(CheckCircle2, { className: "w-4 h-4 text-emerald-600 flex-shrink-0" }), _jsx("span", { children: saveSuccess })] })), _jsxs("div", { className: "flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200", children: [_jsxs("div", { className: "flex items-center gap-3 w-full sm:w-auto", children: [_jsxs("div", { className: "relative flex-1 sm:w-64", children: [_jsx(Search, { className: "w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" }), _jsx(Input, { type: "text", placeholder: "\u0628\u062D\u062B \u0628\u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u0627\u0644\u0643\u0648\u062F...", value: search, onChange: (e) => setSearch(e.target.value), className: "pr-9 text-xs" })] }), _jsxs("select", { value: categoryFilter, onChange: (e) => setCategoryFilter(e.target.value), className: "px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500", children: [_jsx("option", { value: "ALL", children: "\u062C\u0645\u064A\u0639 \u0627\u0644\u0641\u0626\u0627\u062A" }), _jsx("option", { value: "Examination", children: "\u0643\u0634\u0641 (Examination)" }), _jsx("option", { value: "Consultation", children: "\u0627\u0633\u062A\u0634\u0627\u0631\u0629 (Consultation)" }), _jsx("option", { value: "Procedure", children: "\u0625\u062C\u0631\u0627\u0621 \u0637\u0628\u064A (Procedure)" }), _jsx("option", { value: "Other", children: "\u062E\u062F\u0645\u0627\u062A \u0623\u062E\u0631\u0649" })] })] }), _jsxs(Button, { type: "button", variant: "primary", size: "sm", onClick: () => setIsAddOpen(true), className: "gap-1.5 w-full sm:w-auto", children: [_jsx(Plus, { className: "w-4 h-4" }), _jsx("span", { children: "\u0625\u0636\u0627\u0641\u0629 \u062E\u062F\u0645\u0629 \u062C\u062F\u064A\u062F\u0629" })] })] }), _jsx("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-right text-xs", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold", children: _jsxs("tr", { children: [_jsx("th", { className: "py-3 px-4", children: "\u0643\u0648\u062F \u0627\u0644\u062E\u062F\u0645\u0629" }), _jsx("th", { className: "py-3 px-4", children: "\u0627\u0633\u0645 \u0627\u0644\u062E\u062F\u0645\u0629 (\u0639\u0631\u0628\u064A / \u0625\u0646\u062C\u0644\u064A\u0632\u064A)" }), _jsx("th", { className: "py-3 px-4", children: "\u0627\u0644\u0641\u0626\u0629" }), _jsx("th", { className: "py-3 px-4", children: "\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A" }), _jsx("th", { className: "py-3 px-4", children: "\u0627\u0644\u062D\u0627\u0644\u0629" }), _jsx("th", { className: "py-3 px-4 text-center", children: "\u0625\u062C\u0631\u0627\u0621\u0627\u062A" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: filteredServices.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "py-8 text-center text-slate-400", children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u062E\u062F\u0645\u0627\u062A \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u062E\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0628\u062D\u062B" }) })) : (filteredServices.map((service) => (_jsxs("tr", { className: "hover:bg-slate-50/70 transition-colors", children: [_jsx("td", { className: "py-3 px-4 font-bold text-slate-700", children: _jsx("bdi", { dir: "ltr", children: service.code }) }), _jsxs("td", { className: "py-3 px-4", children: [_jsx("div", { className: "font-semibold text-slate-900", children: service.nameAr }), service.nameEn && (_jsx("div", { className: "text-[11px] text-slate-400", children: _jsx("bdi", { dir: "ltr", children: service.nameEn }) }))] }), _jsx("td", { className: "py-3 px-4", children: _jsx(Badge, { variant: service.category === 'Examination'
                                                    ? 'info'
                                                    : service.category === 'Consultation'
                                                        ? 'purple'
                                                        : 'default', children: service.category === 'Examination'
                                                    ? 'كشف'
                                                    : service.category === 'Consultation'
                                                        ? 'استشارة'
                                                        : 'إجراء طبي' }) }), _jsx("td", { className: "py-3 px-4 font-bold text-emerald-700", children: _jsx("bdi", { dir: "ltr", children: formatEgp(service.defaultPricePiastres) }) }), _jsx("td", { className: "py-3 px-4", children: _jsx("button", { type: "button", onClick: () => handleToggleActive(service), className: `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${service.isActive
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-slate-100 text-slate-500 border-slate-200'}`, children: service.isActive ? (_jsxs(_Fragment, { children: [_jsx(CheckCircle2, { className: "w-3 h-3 text-emerald-600" }), _jsx("span", { children: "\u0645\u0641\u0639\u0644\u0629" })] })) : (_jsxs(_Fragment, { children: [_jsx(XCircle, { className: "w-3 h-3 text-slate-400" }), _jsx("span", { children: "\u0645\u0639\u0637\u0644\u0629" })] })) }) }), _jsx("td", { className: "py-3 px-4 text-center", children: _jsxs(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => handleEditPrice(service), className: "gap-1 text-slate-600 hover:text-sky-600", children: [_jsx(Edit2, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0633\u0639\u0631" })] }) })] }, service.id)))) })] }) }) }), editingService && (_jsx(Dialog, { isOpen: true, onClose: () => setEditingService(null), title: "\u062A\u0639\u062F\u064A\u0644 \u0633\u0639\u0631 \u0627\u0644\u062E\u062F\u0645\u0629", description: `الخدمة: ${editingService.nameAr} (${editingService.code})`, maxWidth: "sm", children: _jsxs("form", { onSubmit: handleSavePrice, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1.5", children: "\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u062C\u062F\u064A\u062F (\u062C.\u0645) *" }), _jsxs("div", { className: "relative", children: [_jsx(Input, { type: "number", step: "any", min: "0", value: editPriceEgp, onChange: (e) => setEditPriceEgp(e.target.value), required: true, className: "text-lg font-bold pl-12 text-emerald-700" }), _jsx("div", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400", children: "\u062C.\u0645" })] })] }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-slate-100", children: [_jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => setEditingService(null), disabled: saving, children: "\u0625\u0644\u063A\u0627\u0621" }), _jsx(Button, { type: "submit", variant: "primary", size: "sm", disabled: saving, children: saving ? 'جاري الحفظ...' : 'حفظ التعديل' })] })] }) })), isAddOpen && (_jsx(Dialog, { isOpen: true, onClose: () => setIsAddOpen(false), title: "\u0625\u0636\u0627\u0641\u0629 \u062E\u062F\u0645\u0629 \u0637\u0628\u064A\u0629 \u062C\u062F\u064A\u062F\u0629", description: "\u0623\u062F\u062E\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062E\u062F\u0645\u0629 \u0648\u0643\u0648\u062F\u0647\u0627 \u0644\u062A\u0638\u0647\u0631 \u0641\u064A \u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u062D\u062C\u0632 \u0648\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631", maxWidth: "md", children: _jsxs("form", { onSubmit: handleAddService, className: "space-y-3.5", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u0643\u0648\u062F \u0627\u0644\u062E\u062F\u0645\u0629 *" }), _jsx(Input, { type: "text", placeholder: "\u0645\u062B\u0627\u0644: PROC-LASER", value: newCode, onChange: (e) => setNewCode(e.target.value), required: true, className: "font-mono text-xs uppercase" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u0627\u0644\u0641\u0626\u0629 *" }), _jsxs("select", { value: newCategory, onChange: (e) => setNewCategory(e.target.value), className: "w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500", children: [_jsx("option", { value: "Procedure", children: "\u0625\u062C\u0631\u0627\u0621 \u0637\u0628\u064A (Procedure)" }), _jsx("option", { value: "Examination", children: "\u0643\u0634\u0641 (Examination)" }), _jsx("option", { value: "Consultation", children: "\u0627\u0633\u062A\u0634\u0627\u0631\u0629 (Consultation)" }), _jsx("option", { value: "Other", children: "\u0623\u062E\u0631\u0649" })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u0627\u0633\u0645 \u0627\u0644\u062E\u062F\u0645\u0629 \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 *" }), _jsx(Input, { type: "text", placeholder: "\u0645\u062B\u0627\u0644: \u062C\u0644\u0633\u0629 \u0639\u0644\u0627\u062C \u0637\u0628\u064A\u0639\u064A \u0628\u0627\u0644\u0644\u064A\u0632\u0631", value: newNameAr, onChange: (e) => setNewNameAr(e.target.value), required: true, className: "text-xs" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)" }), _jsx(Input, { type: "text", placeholder: "e.g. Laser Therapy Session", value: newNameEn, onChange: (e) => setNewNameEn(e.target.value), className: "text-xs" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A (\u062C.\u0645) *" }), _jsxs("div", { className: "relative", children: [_jsx(Input, { type: "number", step: "any", min: "0", placeholder: "0.00", value: newPriceEgp, onChange: (e) => setNewPriceEgp(e.target.value), required: true, className: "text-sm font-bold pl-12" }), _jsx("div", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400", children: "\u062C.\u0645" })] })] }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-slate-100", children: [_jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => setIsAddOpen(false), disabled: saving, children: "\u0625\u0644\u063A\u0627\u0621" }), _jsx(Button, { type: "submit", variant: "primary", size: "sm", disabled: saving, children: saving ? 'جاري الإضافة...' : 'إضافة الخدمة للدليل' })] })] }) }))] }));
}
