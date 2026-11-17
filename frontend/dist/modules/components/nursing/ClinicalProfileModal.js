import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { ShieldAlert, HeartPulse, Plus, Trash2, AlertTriangle, RefreshCw, Sparkles, } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { nursingService } from '../../services/nursingService';
import { cn } from '../../lib/utils';
const COMMON_CONDITIONS = [
    { code: 'HTN', name: 'ارتفاع ضغط الدم (Hypertension)' },
    { code: 'DM2', name: 'السكري من النوع الثاني (Type 2 Diabetes)' },
    { code: 'DM1', name: 'السكري من النوع الأول (Type 1 Diabetes)' },
    { code: 'Asthma', name: 'الربو الشعبي (Bronchial Asthma)' },
    { code: 'IHD', name: 'قصور الشرايين التاجية (Ischemic Heart Disease)' },
    { code: 'CKD', name: 'قصور كلوي مزمن (Chronic Kidney Disease)' },
    { code: 'Thyroid', name: 'اضطراب الغدة الدرقية (Thyroid Disorder)' },
    { code: 'Hepatitis', name: 'التهاب كبدي فيروسي (Viral Hepatitis)' },
];
const COMMON_ALLERGIES = [
    { ingredient: 'penicillin', name: 'بنسلين ومشتقاته (Penicillins)' },
    { ingredient: 'sulfa', name: 'مركبات السلفا (Sulfonamides)' },
    { ingredient: 'aspirin', name: 'أسبرين ومسكنات NSAIDs (Aspirin/NSAIDs)' },
    { ingredient: 'cephalosporin', name: 'سيفالوسبورين (Cephalosporins)' },
    { ingredient: 'ciprofloxacin', name: 'سيبروفلوكساسين وكينولونز (Fluoroquinolones)' },
];
export function ClinicalProfileModal({ isOpen, onClose, patientId, patientName, onProfileUpdated, }) {
    const [activeTab, setActiveTab] = useState('allergies');
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    // New Allergy Form
    const [activeIngredient, setActiveIngredient] = useState('');
    const [allergyName, setAllergyName] = useState('');
    const [severity, setSeverity] = useState('Moderate');
    const [allergyNotes, setAllergyNotes] = useState('');
    const [isAddingAllergy, setIsAddingAllergy] = useState(false);
    // New Chronic Condition Form
    const [conditionCode, setConditionCode] = useState('');
    const [conditionName, setConditionName] = useState('');
    const [conditionNotes, setConditionNotes] = useState('');
    const [isAddingCondition, setIsAddingCondition] = useState(false);
    // Deletion tracking
    const [deletingId, setDeletingId] = useState(null);
    // Load profile when modal opens
    const fetchProfile = async () => {
        if (!patientId)
            return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await nursingService.getClinicalProfile(patientId);
            setProfile(data);
        }
        catch (err) {
            setError(err.message || 'تعذر تحميل الملف السريري للمريض');
        }
        finally {
            setIsLoading(false);
        }
    };
    useEffect(() => {
        if (isOpen && patientId) {
            fetchProfile();
            // Reset forms
            setActiveIngredient('');
            setAllergyName('');
            setSeverity('Moderate');
            setAllergyNotes('');
            setConditionCode('');
            setConditionName('');
            setConditionNotes('');
        }
    }, [isOpen, patientId]);
    // Add Allergy Handler
    const handleAddAllergy = async (e) => {
        e.preventDefault();
        if (!patientId || !activeIngredient.trim() || !allergyName.trim())
            return;
        setIsAddingAllergy(true);
        setError(null);
        try {
            await nursingService.addAllergy(patientId, {
                activeIngredient: activeIngredient.trim().toLowerCase(),
                allergyName: allergyName.trim(),
                severity,
                notes: allergyNotes.trim() || undefined,
            });
            setActiveIngredient('');
            setAllergyName('');
            setSeverity('Moderate');
            setAllergyNotes('');
            await fetchProfile();
            onProfileUpdated?.();
        }
        catch (err) {
            setError(err.message || 'حدث خطأ أثناء إضافة الحساسية الدوائية');
        }
        finally {
            setIsAddingAllergy(false);
        }
    };
    // Delete Allergy Handler
    const handleDeleteAllergy = async (allergyId) => {
        if (!patientId)
            return;
        setDeletingId(allergyId);
        setError(null);
        try {
            await nursingService.deleteAllergy(patientId, allergyId);
            await fetchProfile();
            onProfileUpdated?.();
        }
        catch (err) {
            setError(err.message || 'تعذر حذف الحساسية الدوائية');
        }
        finally {
            setDeletingId(null);
        }
    };
    // Add Chronic Condition Handler
    const handleAddCondition = async (e) => {
        e.preventDefault();
        if (!patientId || !conditionName.trim())
            return;
        setIsAddingCondition(true);
        setError(null);
        try {
            await nursingService.addChronicCondition(patientId, {
                conditionCode: conditionCode.trim() || 'CHRONIC',
                conditionName: conditionName.trim(),
                notes: conditionNotes.trim() || undefined,
            });
            setConditionCode('');
            setConditionName('');
            setConditionNotes('');
            await fetchProfile();
            onProfileUpdated?.();
        }
        catch (err) {
            setError(err.message || 'حدث خطأ أثناء إضافة المرض المزمن');
        }
        finally {
            setIsAddingCondition(false);
        }
    };
    // Delete Chronic Condition Handler
    const handleDeleteCondition = async (conditionId) => {
        if (!patientId)
            return;
        setDeletingId(conditionId);
        setError(null);
        try {
            await nursingService.deleteChronicCondition(patientId, conditionId);
            await fetchProfile();
            onProfileUpdated?.();
        }
        catch (err) {
            setError(err.message || 'تعذر حذف المرض المزمن');
        }
        finally {
            setDeletingId(null);
        }
    };
    // Quick select allergy preset
    const handleSelectAllergyPreset = (preset) => {
        setActiveIngredient(preset.ingredient);
        setAllergyName(preset.name);
    };
    // Quick select condition preset
    const handleSelectConditionPreset = (preset) => {
        setConditionCode(preset.code);
        setConditionName(preset.name);
    };
    const getSeverityBadge = (sev) => {
        switch (sev) {
            case 'Severe':
                return _jsx(Badge, { variant: "danger", children: "\u0634\u062F\u064A\u062F\u0629 \u0627\u0644\u062E\u0637\u0648\u0631\u0629 (Severe)" });
            case 'Moderate':
                return _jsx(Badge, { variant: "warning", children: "\u0645\u062A\u0648\u0633\u0637\u0629 (Moderate)" });
            case 'Mild':
                return _jsx(Badge, { variant: "default", children: "\u062E\u0641\u064A\u0641\u0629 (Mild)" });
        }
    };
    return (_jsx(Dialog, { isOpen: isOpen, onClose: onClose, title: `الملف الطبي والتحذيرات السريرية: ${patientName || ''}`, description: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u062D\u0633\u0627\u0633\u064A\u0627\u062A \u0627\u0644\u062F\u0648\u0627\u0626\u064A\u0629 \u0648\u0627\u0644\u0623\u0645\u0631\u0627\u0636 \u0627\u0644\u0645\u0632\u0645\u0646\u0629 \u0644\u0644\u0645\u0631\u064A\u0636 \u0644\u062D\u0645\u0627\u064A\u062A\u0647 \u0623\u062B\u0646\u0627\u0621 \u0648\u0635\u0641 \u0627\u0644\u0623\u062F\u0648\u064A\u0629 \u0648\u0627\u0644\u0639\u0644\u0627\u062C.", maxWidth: "xl", children: _jsxs("div", { className: "space-y-4", children: [error && (_jsxs("div", { className: "p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2", children: [_jsx(AlertTriangle, { className: "w-4 h-4 flex-shrink-0 text-rose-600" }), _jsx("span", { children: error })] })), _jsxs("div", { className: "flex border-b border-slate-200 gap-2", children: [_jsxs("button", { type: "button", onClick: () => setActiveTab('allergies'), className: cn('flex items-center gap-2 pb-2.5 px-3 text-xs font-bold transition-all border-b-2', activeTab === 'allergies'
                                ? 'border-rose-600 text-rose-700'
                                : 'border-transparent text-slate-500 hover:text-slate-800'), children: [_jsx(ShieldAlert, { className: "w-4 h-4 text-rose-600" }), "\u0627\u0644\u062D\u0633\u0627\u0633\u064A\u0627\u062A \u0627\u0644\u062F\u0648\u0627\u0626\u064A\u0629 (", profile?.allergies.length || 0, ")"] }), _jsxs("button", { type: "button", onClick: () => setActiveTab('chronic'), className: cn('flex items-center gap-2 pb-2.5 px-3 text-xs font-bold transition-all border-b-2', activeTab === 'chronic'
                                ? 'border-sky-600 text-sky-700'
                                : 'border-transparent text-slate-500 hover:text-slate-800'), children: [_jsx(HeartPulse, { className: "w-4 h-4 text-sky-600" }), "\u0627\u0644\u0623\u0645\u0631\u0627\u0636 \u0627\u0644\u0645\u0632\u0645\u0646\u0629 (", profile?.chronicConditions.length || 0, ")"] })] }), activeTab === 'allergies' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-rose-50/50 p-3 rounded-xl border border-rose-100 space-y-2", children: [_jsxs("span", { className: "text-[11px] font-bold text-rose-900 flex items-center gap-1", children: [_jsx(Sparkles, { className: "w-3.5 h-3.5 text-rose-600" }), "\u0623\u0634\u0647\u0631 \u0645\u0633\u0628\u0628\u0627\u062A \u0627\u0644\u062D\u0633\u0627\u0633\u064A\u0629 \u0627\u0644\u062F\u0648\u0627\u0626\u064A\u0629 (\u0627\u0636\u063A\u0637 \u0644\u0644\u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0633\u0631\u064A\u0639):"] }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: COMMON_ALLERGIES.map((preset) => (_jsxs("button", { type: "button", onClick: () => handleSelectAllergyPreset(preset), className: "text-[11px] bg-white border border-rose-200 text-rose-800 hover:bg-rose-100 rounded-lg px-2 py-1 transition-colors", children: ["+ ", preset.name] }, preset.ingredient))) })] }), _jsxs("form", { onSubmit: handleAddAllergy, className: "bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3", children: [_jsx("h4", { className: "text-xs font-bold text-slate-800", children: "\u0625\u0636\u0627\u0641\u0629 \u062D\u0633\u0627\u0633\u064A\u0629 \u062F\u0648\u0627\u0626\u064A\u0629 \u062C\u062F\u064A\u062F\u0629:" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u0627\u0644\u0645\u0627\u062F\u0629 \u0627\u0644\u0641\u0639\u0627\u0644\u0629 (Active Ingredient) *" }), _jsx("input", { type: "text", required: true, value: activeIngredient, onChange: (e) => setActiveIngredient(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: penicillin", className: "w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-mono dir-ltr focus:outline-none focus:ring-1 focus:ring-rose-500" }), _jsx("span", { className: "text-[10px] text-slate-400", children: "\u062A\u064F\u062D\u0641\u0638 \u0628\u0623\u062D\u0631\u0641 \u0635\u063A\u064A\u0631\u0629 \u0644\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u0627\u0633\u0645 \u0627\u0644\u062F\u0648\u0627\u0621 / \u0627\u0644\u062D\u0633\u0627\u0633\u064A\u0629 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629 *" }), _jsx("input", { type: "text", required: true, value: allergyName, onChange: (e) => setAllergyName(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: \u0628\u0646\u0633\u0644\u064A\u0646 \u0648\u0645\u0634\u062A\u0642\u0627\u062A\u0647", className: "w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-rose-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u062F\u0631\u062C\u0629 \u0627\u0644\u062E\u0637\u0648\u0631\u0629 (Severity) *" }), _jsxs("select", { value: severity, onChange: (e) => setSeverity(e.target.value), className: "w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-rose-500", children: [_jsx("option", { value: "Severe", children: "\u0634\u062F\u064A\u062F\u0629 \u0627\u0644\u062E\u0637\u0648\u0631\u0629 (Severe / \u0635\u062F\u0645\u0629 \u062A\u062D\u0633\u0633\u064A\u0629)" }), _jsx("option", { value: "Moderate", children: "\u0645\u062A\u0648\u0633\u0637\u0629 (Moderate / \u0637\u0641\u062D \u062C\u0644\u062F\u064A \u0648\u062A\u0648\u0631\u0645)" }), _jsx("option", { value: "Mild", children: "\u062E\u0641\u064A\u0641\u0629 (Mild / \u062D\u0643\u0629 \u062E\u0641\u064A\u0641\u0629)" })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0623\u0648 \u0631\u062F \u0627\u0644\u0641\u0639\u0644 \u0627\u0644\u062A\u062D\u0633\u0633\u064A (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)" }), _jsx("input", { type: "text", value: allergyNotes, onChange: (e) => setAllergyNotes(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: \u062D\u062F\u062B \u062A\u0648\u0631\u0645 \u0628\u0627\u0644\u0648\u062C\u0647 \u0648\u0635\u0639\u0648\u0628\u0629 \u062A\u0646\u0641\u0633 \u0639\u0646\u062F \u062A\u0646\u0627\u0648\u0644 \u062D\u0642\u0646\u0629 \u0627\u0644\u0628\u0646\u0633\u0644\u064A\u0646 \u0639\u0627\u0645 2022", className: "w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-rose-500" })] }), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "submit", size: "sm", variant: "primary", disabled: isAddingAllergy || !activeIngredient.trim() || !allergyName.trim(), className: "bg-rose-600 hover:bg-rose-700 text-xs font-bold", children: [_jsx(Plus, { className: "w-3.5 h-3.5 ml-1" }), isAddingAllergy ? 'جاري الإضافة...' : 'إضافة الحساسية'] }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("h4", { className: "text-xs font-bold text-slate-700", children: "\u0627\u0644\u062D\u0633\u0627\u0633\u064A\u0627\u062A \u0627\u0644\u0645\u0633\u062C\u0644\u0629 \u062D\u0627\u0644\u064A\u0627\u064B:" }), isLoading ? (_jsxs("div", { className: "text-center py-4 text-xs text-slate-400", children: [_jsx(RefreshCw, { className: "w-4 h-4 animate-spin mx-auto text-rose-500 mb-1" }), "\u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0633\u064A\u0627\u062A..."] })) : profile?.allergies && profile.allergies.length > 0 ? (_jsx("div", { className: "divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white", children: profile.allergies.map((allergy) => (_jsxs("div", { className: "p-3 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors", children: [_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-bold text-xs text-slate-800", children: allergy.allergyName }), _jsx("span", { className: "font-mono text-xs text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200", children: allergy.activeIngredient }), getSeverityBadge(allergy.severity)] }), allergy.notes && (_jsx("p", { className: "text-[11px] text-slate-500", children: allergy.notes }))] }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", disabled: deletingId === allergy.id, onClick: () => handleDeleteAllergy(allergy.id), className: "text-slate-400 hover:text-rose-600 hover:bg-rose-50", title: "\u062D\u0630\u0641 \u0627\u0644\u062D\u0633\u0627\u0633\u064A\u0629", children: _jsx(Trash2, { className: "w-4 h-4" }) })] }, allergy.id))) })) : (_jsx("p", { className: "text-xs text-slate-400 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center", children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u064A \u062D\u0633\u0627\u0633\u064A\u0627\u062A \u062F\u0648\u0627\u0626\u064A\u0629 \u0645\u0633\u062C\u0644\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0631\u064A\u0636" }))] })] })), activeTab === 'chronic' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-sky-50/50 p-3 rounded-xl border border-sky-100 space-y-2", children: [_jsxs("span", { className: "text-[11px] font-bold text-sky-900 flex items-center gap-1", children: [_jsx(Sparkles, { className: "w-3.5 h-3.5 text-sky-600" }), "\u0623\u0634\u0647\u0631 \u0627\u0644\u0623\u0645\u0631\u0627\u0636 \u0627\u0644\u0645\u0632\u0645\u0646\u0629 \u0627\u0644\u0634\u0627\u0626\u0639\u0629 (\u0627\u0636\u063A\u0637 \u0644\u0644\u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0633\u0631\u064A\u0639):"] }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: COMMON_CONDITIONS.map((preset) => (_jsxs("button", { type: "button", onClick: () => handleSelectConditionPreset(preset), className: "text-[11px] bg-white border border-sky-200 text-sky-800 hover:bg-sky-100 rounded-lg px-2 py-1 transition-colors", children: ["+ ", preset.name] }, preset.code))) })] }), _jsxs("form", { onSubmit: handleAddCondition, className: "bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3", children: [_jsx("h4", { className: "text-xs font-bold text-slate-800", children: "\u0625\u0636\u0627\u0641\u0629 \u0645\u0631\u0636 \u0645\u0632\u0645\u0646 \u062C\u062F\u064A\u062F:" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-2", children: [_jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0631\u0636 \u0627\u0644\u0645\u0632\u0645\u0646 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629 *" }), _jsx("input", { type: "text", required: true, value: conditionName, onChange: (e) => setConditionName(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: \u0627\u0631\u062A\u0641\u0627\u0639 \u0636\u063A\u0637 \u0627\u0644\u062F\u0645 \u0627\u0644\u0634\u0631\u064A\u0627\u0646\u064A", className: "w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-sky-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u0631\u0645\u0632 \u0627\u0644\u0645\u0631\u0636 / \u0627\u0644\u0643\u0648\u062F (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)" }), _jsx("input", { type: "text", value: conditionCode, onChange: (e) => setConditionCode(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: HTN \u0623\u0648 I10", className: "w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-mono uppercase focus:outline-none focus:ring-1 focus:ring-sky-500" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0633\u0631\u064A\u0631\u064A\u0629 \u0623\u0648 \u0633\u0646\u0629 \u0627\u0644\u062A\u0634\u062E\u064A\u0635 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)" }), _jsx("input", { type: "text", value: conditionNotes, onChange: (e) => setConditionNotes(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: \u0645\u0634\u062E\u0635 \u0645\u0646\u0630 5 \u0633\u0646\u0648\u0627\u062A\u060C \u0645\u0646\u062A\u0638\u0645 \u0639\u0644\u0649 \u0627\u0644\u0639\u0644\u0627\u062C", className: "w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-sky-500" })] }), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "submit", size: "sm", variant: "primary", disabled: isAddingCondition || !conditionName.trim(), className: "bg-sky-600 hover:bg-sky-700 text-xs font-bold", children: [_jsx(Plus, { className: "w-3.5 h-3.5 ml-1" }), isAddingCondition ? 'جاري الإضافة...' : 'إضافة المرض المزمن'] }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("h4", { className: "text-xs font-bold text-slate-700", children: "\u0627\u0644\u0623\u0645\u0631\u0627\u0636 \u0627\u0644\u0645\u0632\u0645\u0646\u0629 \u0627\u0644\u0645\u0633\u062C\u0644\u0629 \u062D\u0627\u0644\u064A\u0627\u064B:" }), isLoading ? (_jsxs("div", { className: "text-center py-4 text-xs text-slate-400", children: [_jsx(RefreshCw, { className: "w-4 h-4 animate-spin mx-auto text-sky-500 mb-1" }), "\u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0623\u0645\u0631\u0627\u0636 \u0627\u0644\u0645\u0632\u0645\u0646\u0629..."] })) : profile?.chronicConditions && profile.chronicConditions.length > 0 ? (_jsx("div", { className: "divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white", children: profile.chronicConditions.map((cond) => (_jsxs("div", { className: "p-3 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors", children: [_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-bold text-xs text-slate-800", children: cond.conditionName }), cond.conditionCode && (_jsx("span", { className: "font-mono text-xs text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200", children: cond.conditionCode }))] }), cond.notes && (_jsx("p", { className: "text-[11px] text-slate-500", children: cond.notes }))] }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", disabled: deletingId === cond.id, onClick: () => handleDeleteCondition(cond.id), className: "text-slate-400 hover:text-rose-600 hover:bg-rose-50", title: "\u062D\u0630\u0641 \u0627\u0644\u0645\u0631\u0636 \u0627\u0644\u0645\u0632\u0645\u0646", children: _jsx(Trash2, { className: "w-4 h-4" }) })] }, cond.id))) })) : (_jsx("p", { className: "text-xs text-slate-400 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center", children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u064A \u0623\u0645\u0631\u0627\u0636 \u0645\u0632\u0645\u0646\u0629 \u0645\u0633\u062C\u0644\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0631\u064A\u0636" }))] })] })), _jsx("div", { className: "pt-3 border-t border-slate-100 flex justify-end", children: _jsx(Button, { type: "button", variant: "secondary", onClick: onClose, className: "text-xs font-bold", children: "\u0625\u063A\u0644\u0627\u0642" }) })] }) }));
}
