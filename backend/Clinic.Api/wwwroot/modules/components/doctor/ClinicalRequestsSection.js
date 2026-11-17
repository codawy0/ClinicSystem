import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { FlaskConical, Plus, Trash2, Check, } from 'lucide-react';
import { Button } from '../ui/button';
const COMMON_LAB_CHIPS = [
    { nameAr: 'صورة دم كاملة', nameEn: 'CBC', code: 'LAB-CBC' },
    { nameAr: 'سكر صائم وتراكمي', nameEn: 'FBG & HbA1c', code: 'LAB-HBA1C' },
    { nameAr: 'وظائف كبد', nameEn: 'ALT, AST, Bilirubin', code: 'LAB-LFT' },
    { nameAr: 'وظائف كلى', nameEn: 'Creatinine, Urea', code: 'LAB-KFT' },
    { nameAr: 'دهون الدم الكاملة', nameEn: 'Lipid Profile', code: 'LAB-LIPID' },
    { nameAr: 'تحليل بول كامل', nameEn: 'Urine Analysis', code: 'LAB-URINE' },
    { nameAr: 'سرعة الترسيب والالتهاب', nameEn: 'ESR & CRP', code: 'LAB-ESR-CRP' },
    { nameAr: 'فيتامين د وكالسيوم', nameEn: 'Vitamin D & Ca', code: 'LAB-VITD' },
];
const COMMON_RADIOLOGY_CHIPS = [
    { nameAr: 'أشعة عادية على الصدر', nameEn: 'Chest X-Ray', code: 'RAD-CXR' },
    { nameAr: 'موجات صوتية على البطن والحوض', nameEn: 'Pelvi-Abdominal US', code: 'RAD-US-ABD' },
    { nameAr: 'موجات صوتية على القلب', nameEn: 'Echocardiography', code: 'RAD-ECHO' },
    { nameAr: 'رنين مغناطيسي', nameEn: 'MRI Scan', code: 'RAD-MRI' },
    { nameAr: 'أشعة مقطعية', nameEn: 'CT Scan', code: 'RAD-CT' },
];
export function ClinicalRequestsSection({ requests, onChangeRequests, }) {
    const [activeTab, setActiveTab] = useState('Lab');
    const [customNameAr, setCustomNameAr] = useState('');
    const [customNameEn, setCustomNameEn] = useState('');
    const [customNotes, setCustomNotes] = useState('');
    // Add chip order
    const handleAddChip = (chip, type) => {
        // Avoid exact duplicate
        if (requests.some((r) => r.catalogCode === chip.code || r.nameAr === chip.nameAr)) {
            return;
        }
        const newRequest = {
            requestType: type,
            catalogCode: chip.code,
            nameAr: chip.nameAr,
            nameEn: chip.nameEn,
            notes: '',
        };
        onChangeRequests([...requests, newRequest]);
    };
    // Add custom manual order
    const handleAddCustom = (e) => {
        if (e)
            e.preventDefault();
        if (!customNameAr.trim())
            return;
        const newRequest = {
            requestType: activeTab,
            nameAr: customNameAr.trim(),
            nameEn: customNameEn.trim() || undefined,
            notes: customNotes.trim() || undefined,
        };
        onChangeRequests([...requests, newRequest]);
        setCustomNameAr('');
        setCustomNameEn('');
        setCustomNotes('');
    };
    // Update request item
    const handleUpdateRequest = (index, patch) => {
        const updated = requests.map((item, idx) => (idx === index ? { ...item, ...patch } : item));
        onChangeRequests(updated);
    };
    // Remove request item
    const handleRemoveRequest = (index) => {
        const updated = requests.filter((_, idx) => idx !== index);
        onChangeRequests(updated);
    };
    return (_jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(FlaskConical, { className: "w-5 h-5 text-indigo-600" }), _jsx("h3", { className: "font-bold text-slate-900 text-base", children: "\u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0648\u0627\u0644\u0641\u062D\u0648\u0635\u0627\u062A \u0627\u0644\u0625\u0643\u0644\u064A\u0646\u064A\u0643\u064A\u0629 (Lab & Radiology)" }), _jsxs("span", { className: "text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full", children: [requests.length, " ", requests.length === 1 ? 'طلب' : 'طلبات'] })] }), _jsxs("div", { className: "flex items-center bg-slate-100 p-1 rounded-xl", children: [_jsx("button", { type: "button", onClick: () => setActiveTab('Lab'), className: `px-3 py-1 rounded-lg text-xs font-bold transition-all ${activeTab === 'Lab'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'}`, children: "\u062A\u062D\u0627\u0644\u064A\u0644 \u0637\u0628\u064A\u0629 (Laboratory)" }), _jsx("button", { type: "button", onClick: () => setActiveTab('Radiology'), className: `px-3 py-1 rounded-lg text-xs font-bold transition-all ${activeTab === 'Radiology'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'}`, children: "\u0641\u062D\u0648\u0635\u0627\u062A \u0648\u0623\u0634\u0639\u0629 (Radiology)" })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("span", { className: "text-xs font-bold text-slate-600", children: "\u0641\u062D\u0648\u0635\u0627\u062A \u0634\u0627\u0626\u0639\u0629 \u0633\u0631\u064A\u0639\u0629 (\u0627\u0636\u063A\u0637 \u0644\u0644\u0625\u0636\u0627\u0641\u0629):" }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: activeTab === 'Lab'
                            ? COMMON_LAB_CHIPS.map((chip) => {
                                const isAdded = requests.some((r) => r.catalogCode === chip.code || r.nameAr === chip.nameAr);
                                return (_jsxs("button", { type: "button", onClick: () => handleAddChip(chip, 'Lab'), disabled: isAdded, className: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${isAdded
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 opacity-80 cursor-default'
                                        : 'bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-700 border-slate-200'}`, children: [isAdded ? _jsx(Check, { className: "w-3.5 h-3.5 text-emerald-600" }) : _jsx(Plus, { className: "w-3.5 h-3.5 text-slate-400" }), _jsx("span", { children: chip.nameAr }), _jsxs("span", { className: "text-[10px] font-mono text-slate-400", children: ["(", chip.nameEn, ")"] })] }, chip.code));
                            })
                            : COMMON_RADIOLOGY_CHIPS.map((chip) => {
                                const isAdded = requests.some((r) => r.catalogCode === chip.code || r.nameAr === chip.nameAr);
                                return (_jsxs("button", { type: "button", onClick: () => handleAddChip(chip, 'Radiology'), disabled: isAdded, className: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${isAdded
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 opacity-80 cursor-default'
                                        : 'bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-700 border-slate-200'}`, children: [isAdded ? _jsx(Check, { className: "w-3.5 h-3.5 text-emerald-600" }) : _jsx(Plus, { className: "w-3.5 h-3.5 text-slate-400" }), _jsx("span", { children: chip.nameAr }), _jsxs("span", { className: "text-[10px] font-mono text-slate-400", children: ["(", chip.nameEn, ")"] })] }, chip.code));
                            }) })] }), _jsxs("form", { onSubmit: handleAddCustom, className: "grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1", children: [_jsx("div", { className: "sm:col-span-5", children: _jsx("input", { type: "text", value: customNameAr, onChange: (e) => setCustomNameAr(e.target.value), placeholder: `اسم فحص ${activeTab === 'Lab' ? 'التحليل' : 'الأشعة'} بالعربية...`, className: "w-full text-xs font-medium rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" }) }), _jsx("div", { className: "sm:col-span-3", children: _jsx("input", { type: "text", value: customNameEn, onChange: (e) => setCustomNameEn(e.target.value), placeholder: "\u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)...", className: "w-full text-xs font-medium rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" }) }), _jsx("div", { className: "sm:col-span-3", children: _jsx("input", { type: "text", value: customNotes, onChange: (e) => setCustomNotes(e.target.value), placeholder: "\u062A\u0639\u0644\u064A\u0645\u0627\u062A \u0623\u0648 \u062F\u0644\u0627\u0644\u0629 \u0633\u0631\u064A\u0631\u064A\u0629...", className: "w-full text-xs rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" }) }), _jsx("div", { className: "sm:col-span-1", children: _jsx(Button, { type: "submit", variant: "primary", size: "sm", disabled: !customNameAr.trim(), className: "w-full h-full bg-indigo-600 hover:bg-indigo-700 text-white p-2", title: "\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0641\u062D\u0635", children: _jsx(Plus, { className: "w-4 h-4" }) }) })] }), requests.length > 0 && (_jsx("div", { className: "border border-slate-200 rounded-xl overflow-hidden shadow-xs", children: _jsxs("table", { className: "w-full text-right text-xs", children: [_jsx("thead", { className: "bg-slate-50 text-slate-600 font-bold border-b border-slate-200", children: _jsxs("tr", { children: [_jsx("th", { className: "py-2 px-3 w-28", children: "\u0627\u0644\u0646\u0648\u0639" }), _jsx("th", { className: "py-2 px-3", children: "\u0627\u0633\u0645 \u0627\u0644\u0641\u062D\u0635 \u0623\u0648 \u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628" }), _jsx("th", { className: "py-2 px-3", children: "\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0648\u0627\u0644\u062A\u0639\u0644\u064A\u0645\u0627\u062A" }), _jsx("th", { className: "py-2 px-2 w-10 text-center" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100 bg-white", children: requests.map((item, index) => (_jsxs("tr", { className: "hover:bg-slate-50/60 transition-colors", children: [_jsx("td", { className: "py-2 px-3", children: _jsx("span", { className: `inline-block px-2 py-0.5 rounded text-[11px] font-bold ${item.requestType === 'Lab'
                                                ? 'bg-purple-100 text-purple-800'
                                                : 'bg-cyan-100 text-cyan-800'}`, children: item.requestType === 'Lab' ? 'تحليل مخبري' : 'أشعة وفحص' }) }), _jsxs("td", { className: "py-2 px-3 font-semibold text-slate-900", children: [item.nameAr, item.nameEn && (_jsxs("span", { className: "text-xs font-normal font-mono text-slate-500 mr-1.5", children: ["(", item.nameEn, ")"] }))] }), _jsx("td", { className: "py-2 px-3", children: _jsx("input", { type: "text", value: item.notes || '', onChange: (e) => handleUpdateRequest(index, { notes: e.target.value }), placeholder: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0633\u0631\u064A\u0631\u064A\u0629...", className: "w-full text-xs text-slate-700 rounded border border-transparent hover:border-slate-300 focus:border-indigo-500 px-2 py-1 focus:outline-none" }) }), _jsx("td", { className: "py-2 px-2 text-center", children: _jsx("button", { type: "button", onClick: () => handleRemoveRequest(index), className: "p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors", children: _jsx(Trash2, { className: "w-4 h-4" }) }) })] }, index))) })] }) }))] }));
}
