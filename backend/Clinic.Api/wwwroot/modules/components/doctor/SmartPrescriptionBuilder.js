import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { Pill, Search, Plus, Trash2, FolderOpen, Save, Copy, AlertTriangle, Baby, Loader2, } from 'lucide-react';
import { Button } from '../ui/button';
import { doctorService } from '../../services/doctorService';
import { ArabicNormalizer } from '../../lib/arabicNormalizer';
const TIMING_PRESETS = [
    'كل 8 ساعات بعد الأكل (1x3)',
    'كل 12 ساعة بعد الأكل (1x2)',
    'مرة واحدة يومياً صباحاً (1x1)',
    'مرة واحدة يومياً قبل النوم',
    'قبل الأكل بنصف ساعة',
    'عند اللزوم (PRN)',
];
const DURATION_PRESETS = [
    '3 أيام',
    '5 أيام',
    '7 أيام',
    '10 أيام',
    'أسبوعين',
    'شهر',
];
export function SmartPrescriptionBuilder({ items, onChangeItems, patientId: _patientId, isPregnant = false, isLactating = false, patientAllergies = [], onOpenTemplatesModal, onOpenSaveTemplateModal, onRepeatPriorRx, hasPriorVisits, searchRef, }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const localSearchInputRef = useRef(null);
    const inputRef = searchRef || localSearchInputRef;
    const dropdownRef = useRef(null);
    // Debounced search query
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsDropdownOpen(false);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const results = await doctorService.searchDrugs(searchQuery.trim());
                setSearchResults(results);
                setIsDropdownOpen(results.length > 0);
                setSelectedIndex(0);
            }
            catch (err) {
                console.warn('Failed to search drugs:', err);
            }
            finally {
                setIsSearching(false);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [searchQuery]);
    // Click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current &&
                !dropdownRef.current.contains(e.target) &&
                inputRef.current &&
                !inputRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [inputRef]);
    // Add drug from search result
    const handleSelectDrug = (drug) => {
        const newItem = {
            drugId: drug.id,
            drugName: drug.tradeName,
            activeIngredient: drug.activeIngredient,
            strength: drug.strength,
            form: drug.form,
            dosage: drug.defaultDosage || '1 قرص',
            timing: drug.defaultTiming || 'كل 12 ساعة بعد الأكل (1x2)',
            duration: drug.defaultDuration || '7 أيام',
            instructions: '',
        };
        onChangeItems([...items, newItem]);
        setSearchQuery('');
        setSearchResults([]);
        setIsDropdownOpen(false);
        inputRef.current?.focus();
    };
    // Add manual custom drug row
    const handleAddCustomDrug = () => {
        const newItem = {
            drugName: '',
            activeIngredient: '',
            strength: '',
            form: 'Tablet',
            dosage: '1 قرص',
            timing: 'كل 12 ساعة بعد الأكل (1x2)',
            duration: '7 أيام',
            instructions: '',
        };
        onChangeItems([...items, newItem]);
    };
    // Update item field
    const handleUpdateItem = (index, patch) => {
        const updated = items.map((item, idx) => (idx === index ? { ...item, ...patch } : item));
        onChangeItems(updated);
    };
    // Remove item
    const handleRemoveItem = (index) => {
        const updated = items.filter((_, idx) => idx !== index);
        onChangeItems(updated);
    };
    // Handle keyboard navigation in search results
    const handleKeyDown = (e) => {
        if (!isDropdownOpen || searchResults.length === 0)
            return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % searchResults.length);
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
        }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (searchResults[selectedIndex]) {
                handleSelectDrug(searchResults[selectedIndex]);
            }
        }
        else if (e.key === 'Escape') {
            setIsDropdownOpen(false);
        }
    };
    return (_jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Pill, { className: "w-5 h-5 text-sky-600" }), _jsx("h3", { className: "font-bold text-slate-900 text-base", children: "\u0627\u0644\u0631\u0648\u0634\u062A\u0629 \u0627\u0644\u0639\u0644\u0627\u062C\u064A\u0629 (Prescription Builder)" }), _jsxs("span", { className: "text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full", children: [items.length, " ", items.length === 1 ? 'دواء' : 'أدوية'] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: onOpenTemplatesModal, className: "text-xs font-semibold gap-1.5", children: [_jsx(FolderOpen, { className: "w-3.5 h-3.5 text-sky-600" }), _jsx("span", { children: "\u0642\u0648\u0627\u0644\u0628 \u0627\u0644\u0631\u0648\u0634\u062A\u0629" })] }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: onOpenSaveTemplateModal, disabled: items.length === 0, className: "text-xs font-semibold gap-1.5", children: [_jsx(Save, { className: "w-3.5 h-3.5 text-emerald-600" }), _jsx("span", { children: "\u062D\u0641\u0638 \u0643\u0642\u0627\u0644\u0628 \u062C\u062F\u064A\u062F" })] }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: onRepeatPriorRx, disabled: !hasPriorVisits, className: "text-xs font-semibold gap-1.5", title: hasPriorVisits ? 'نسخ أدوية الكشف السابق للمريض' : 'لا توجد كشوفات سابقة مسجلة', children: [_jsx(Copy, { className: "w-3.5 h-3.5 text-indigo-600" }), _jsx("span", { children: "\u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0631\u0648\u0634\u062A\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629" })] })] })] }), _jsxs("div", { className: "relative", children: [_jsxs("div", { className: "relative flex items-center", children: [_jsx("div", { className: "absolute right-3.5 text-slate-400 pointer-events-none", children: isSearching ? _jsx(Loader2, { className: "w-4 h-4 animate-spin text-sky-600" }) : _jsx(Search, { className: "w-4 h-4" }) }), _jsx("input", { ref: inputRef, type: "text", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), onFocus: () => {
                                    if (searchResults.length > 0)
                                        setIsDropdownOpen(true);
                                }, onKeyDown: handleKeyDown, placeholder: "\u0627\u0628\u062D\u062B \u0628\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0623\u0648 \u0627\u0644\u0645\u0627\u062F\u0629 \u0627\u0644\u0641\u0639\u0627\u0644\u0629 (F2)...", className: "w-full text-sm font-medium rounded-xl border border-slate-300 pr-10 pl-24 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:text-slate-400" }), _jsxs("div", { className: "absolute left-2.5 flex items-center gap-1.5", children: [_jsx("kbd", { className: "hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-600 rounded border border-slate-300", children: "F2" }), _jsxs(Button, { type: "button", variant: "ghost", size: "sm", onClick: handleAddCustomDrug, className: "text-xs font-semibold text-sky-600 hover:text-sky-700 hover:bg-sky-50 px-2 py-1 h-auto", children: [_jsx(Plus, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u062F\u0648\u0627\u0621 \u064A\u062F\u0648\u064A" })] })] })] }), isDropdownOpen && searchResults.length > 0 && (_jsx("div", { ref: dropdownRef, className: "absolute z-40 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100 animate-in fade-in duration-150", children: searchResults.map((drug, index) => {
                            const isSelected = index === selectedIndex;
                            const hasAllergyConflict = patientAllergies.some((a) => a.activeIngredient &&
                                drug.activeIngredient &&
                                ArabicNormalizer.normalizeText(a.activeIngredient) ===
                                    ArabicNormalizer.normalizeText(drug.activeIngredient));
                            return (_jsxs("div", { onClick: () => handleSelectDrug(drug), onMouseEnter: () => setSelectedIndex(index), className: `p-3 cursor-pointer transition-colors flex items-center justify-between gap-3 ${isSelected ? 'bg-sky-50/80 text-sky-950' : 'hover:bg-slate-50'}`, children: [_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-bold text-slate-900 text-sm", children: _jsx("bdi", { dir: "ltr", children: drug.tradeName }) }), drug.strength && (_jsx("span", { className: "text-xs font-mono font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded", children: _jsx("bdi", { dir: "ltr", children: drug.strength }) })), drug.form && (_jsx("span", { className: "text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded", children: drug.form }))] }), _jsxs("div", { className: "flex items-center gap-2 text-xs text-slate-500", children: [_jsx("span", { children: "\u0627\u0644\u0645\u0627\u062F\u0629 \u0627\u0644\u0641\u0639\u0627\u0644\u0629:" }), _jsx("bdi", { dir: "ltr", className: "font-medium text-slate-700", children: drug.activeIngredient }), drug.category && (_jsxs("span", { className: "text-slate-400", children: ["(", drug.category, ")"] }))] })] }), _jsxs("div", { className: "flex items-center gap-1.5 shrink-0", children: [hasAllergyConflict && (_jsxs("span", { className: "inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200", children: [_jsx(AlertTriangle, { className: "w-3 h-3 text-rose-600" }), "\u062D\u0633\u0627\u0633\u064A\u0629 \u0645\u0633\u062C\u0644\u0629"] })), isPregnant && drug.avoidInPregnancy && (_jsxs("span", { className: "inline-flex items-center gap-1 text-[11px] font-bold text-pink-700 bg-pink-100 px-2 py-0.5 rounded-full border border-pink-200", children: [_jsx(Baby, { className: "w-3 h-3 text-pink-600" }), "\u0645\u0645\u0646\u0648\u0639 \u0641\u064A \u0627\u0644\u062D\u0645\u0644"] })), isLactating && drug.avoidInLactation && (_jsx("span", { className: "inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200", children: "\u062A\u062D\u0630\u064A\u0631 \u0641\u064A \u0627\u0644\u0631\u0636\u0627\u0639\u0629" }))] })] }, drug.id));
                        }) }))] }), items.length === 0 ? (_jsxs("div", { className: "border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 space-y-2", children: [_jsx(Pill, { className: "w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" }), _jsx("p", { className: "text-sm font-medium text-slate-600", children: "\u0644\u0645 \u064A\u062A\u0645 \u0625\u0636\u0627\u0641\u0629 \u0623\u062F\u0648\u064A\u0629 \u0644\u0644\u0631\u0648\u0634\u062A\u0629 \u0628\u0639\u062F" }), _jsx("p", { className: "text-xs text-slate-400", children: "\u0627\u0628\u062D\u062B \u0639\u0646 \u0627\u0644\u062F\u0648\u0627\u0621 \u0641\u064A \u0627\u0644\u062D\u0642\u0644 \u0623\u0639\u0644\u0627\u0647 \u0628\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0623\u0648 \u0627\u0636\u063A\u0637 F2 \u0644\u0644\u062A\u0631\u0643\u064A\u0632 \u0627\u0644\u0633\u0631\u064A\u0639." })] })) : (_jsx("div", { className: "overflow-x-auto border border-slate-200 rounded-xl shadow-xs", children: _jsxs("table", { className: "w-full text-right text-xs border-collapse", children: [_jsx("thead", { className: "bg-slate-50 text-slate-600 font-bold border-b border-slate-200", children: _jsxs("tr", { children: [_jsx("th", { className: "py-2.5 px-3 w-8 text-center", children: "#" }), _jsx("th", { className: "py-2.5 px-3 w-56", children: "\u0627\u0633\u0645 \u0627\u0644\u062F\u0648\u0627\u0621 \u0648\u0627\u0644\u0645\u0627\u062F\u0629 \u0627\u0644\u0641\u0639\u0627\u0644\u0629" }), _jsx("th", { className: "py-2.5 px-3 w-28", children: "\u0627\u0644\u062C\u0631\u0639\u0629" }), _jsx("th", { className: "py-2.5 px-3 w-48", children: "\u0627\u0644\u062A\u0643\u0631\u0627\u0631 \u0648\u0627\u0644\u062A\u0648\u0642\u064A\u062A" }), _jsx("th", { className: "py-2.5 px-3 w-32", children: "\u0627\u0644\u0645\u062F\u0629" }), _jsx("th", { className: "py-2.5 px-3", children: "\u062A\u0639\u0644\u064A\u0645\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645" }), _jsx("th", { className: "py-2.5 px-2 w-10 text-center" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100 bg-white", children: items.map((item, index) => (_jsxs("tr", { className: "hover:bg-slate-50/60 transition-colors", children: [_jsx("td", { className: "py-2 px-3 text-center font-mono font-bold text-slate-400", children: index + 1 }), _jsx("td", { className: "py-2 px-3", children: _jsxs("div", { className: "space-y-0.5", children: [_jsx("div", { className: "flex items-center gap-1.5", children: _jsx("input", { type: "text", value: item.drugName, onChange: (e) => handleUpdateItem(index, { drugName: e.target.value }), placeholder: "\u0627\u0633\u0645 \u0627\u0644\u062F\u0648\u0627\u0621...", className: "font-bold text-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 rounded px-1.5 py-0.5 w-full bg-transparent" }) }), item.activeIngredient && (_jsxs("div", { className: "text-[11px] text-slate-500 px-1.5", children: [_jsx("bdi", { dir: "ltr", children: item.activeIngredient }), item.strength && ` - ${item.strength}`] }))] }) }), _jsx("td", { className: "py-2 px-2", children: _jsx("input", { type: "text", value: item.dosage, onChange: (e) => handleUpdateItem(index, { dosage: e.target.value }), placeholder: "\u0645\u062B\u0627\u0644: 1 \u0642\u0631\u0635", className: "w-full text-xs font-semibold rounded-lg border border-slate-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500" }) }), _jsx("td", { className: "py-2 px-2", children: _jsxs("div", { className: "relative", children: [_jsx("input", { list: `timing-presets-${index}`, type: "text", value: item.timing, onChange: (e) => handleUpdateItem(index, { timing: e.target.value }), placeholder: "\u0627\u0644\u062A\u0648\u0642\u064A\u062A \u0648\u0627\u0644\u062A\u0643\u0631\u0627\u0631...", className: "w-full text-xs font-medium rounded-lg border border-slate-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500" }), _jsx("datalist", { id: `timing-presets-${index}`, children: TIMING_PRESETS.map((p) => (_jsx("option", { value: p }, p))) })] }) }), _jsx("td", { className: "py-2 px-2", children: _jsxs("div", { className: "relative", children: [_jsx("input", { list: `duration-presets-${index}`, type: "text", value: item.duration, onChange: (e) => handleUpdateItem(index, { duration: e.target.value }), placeholder: "\u0627\u0644\u0645\u062F\u0629...", className: "w-full text-xs font-medium rounded-lg border border-slate-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500" }), _jsx("datalist", { id: `duration-presets-${index}`, children: DURATION_PRESETS.map((d) => (_jsx("option", { value: d }, d))) })] }) }), _jsx("td", { className: "py-2 px-2", children: _jsx("input", { type: "text", value: item.instructions || '', onChange: (e) => handleUpdateItem(index, { instructions: e.target.value }), placeholder: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0644\u0644\u0645\u0631\u064A\u0636 (\u0645\u062B\u0627\u0644: \u0645\u0639 \u0648\u0641\u0631\u0629 \u0645\u0646 \u0627\u0644\u0645\u0627\u0621)...", className: "w-full text-xs text-slate-700 rounded-lg border border-slate-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-300" }) }), _jsx("td", { className: "py-2 px-2 text-center", children: _jsx("button", { type: "button", onClick: () => handleRemoveItem(index), className: "p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors", title: "\u062D\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u062F\u0648\u0627\u0621", children: _jsx(Trash2, { className: "w-4 h-4" }) }) })] }, index))) })] }) }))] }));
}
