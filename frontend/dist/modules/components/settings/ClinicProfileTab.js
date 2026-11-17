import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Building2, Save, CheckCircle2, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { parseEgpToPiastres, piastresToEgpNumber } from '../../lib/currency';
import { api, ApiException } from '../../lib/api';
const DEFAULT_PROFILE = {
    clinicName: 'عيادة النور التخصصية',
    doctorName: 'د. أحمد عبد الرحمن',
    doctorTitle: 'استشاري الباطنة والقلب والسكر',
    specialty: 'أمراض الباطنة والقلب',
    consultationValidityDays: 14,
    maxConsultationsPerExam: 1,
    defaultExamPricePiastres: 30000,
    defaultConsultPricePiastres: 0,
    enableNursingStage: true,
    tvPrivacyMode: 'FirstNameAndInitial',
    tvDeviceToken: 'clinic-tv-key',
    isDoctorOnBreak: false,
};
export function ClinicProfileTab() {
    const [profile, setProfile] = useState(DEFAULT_PROFILE);
    const [examPriceEgp, setExamPriceEgp] = useState('300');
    const [consultPriceEgp, setConsultPriceEgp] = useState('0');
    const [isSaving, setIsSaving] = useState(false);
    const [saveNotice, setSaveNotice] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        loadSettings();
    }, []);
    const loadSettings = async () => {
        try {
            const data = await api.get('/settings');
            if (data) {
                setProfile(data);
                setExamPriceEgp(piastresToEgpNumber(data.defaultExamPricePiastres || 30000).toString());
                setConsultPriceEgp(piastresToEgpNumber(data.defaultConsultPricePiastres || 0).toString());
            }
        }
        catch {
            // Keep defaults
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        setSaveNotice(null);
        const updated = {
            ...profile,
            defaultExamPricePiastres: parseEgpToPiastres(examPriceEgp || '0'),
            defaultConsultPricePiastres: parseEgpToPiastres(consultPriceEgp || '0'),
        };
        try {
            await api.put('/settings', updated);
            setProfile(updated);
            setSaveNotice('تم حفظ إعدادات العيادة وسياسات الاستشارة بنجاح');
            setTimeout(() => setSaveNotice(null), 3500);
        }
        catch (err) {
            if (err instanceof ApiException) {
                setError(err.message);
            }
            else {
                // Fallback update
                setProfile(updated);
                setSaveNotice('تم تحديث البيانات محلياً');
                setTimeout(() => setSaveNotice(null), 3500);
            }
        }
        finally {
            setIsSaving(false);
        }
    };
    return (_jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [saveNotice && (_jsxs("div", { className: "p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in", children: [_jsx(CheckCircle2, { className: "w-4 h-4 text-emerald-600 flex-shrink-0" }), _jsx("span", { children: saveNotice })] })), error && (_jsxs("div", { className: "p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("span", { children: error })] })), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 pb-3 border-b border-slate-100", children: [_jsx(Building2, { className: "w-4 h-4 text-sky-600" }), _jsx("h3", { className: "font-bold text-slate-800 text-sm", children: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u064A\u0627\u062F\u0629 \u0648\u0627\u0644\u0637\u0628\u064A\u0628 \u0627\u0644\u0645\u0633\u0624\u0648\u0644" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u0627\u0633\u0645 \u0627\u0644\u0639\u064A\u0627\u062F\u0629 / \u0627\u0644\u0645\u0631\u0643\u0632 *" }), _jsx(Input, { type: "text", value: profile.clinicName, onChange: (e) => setProfile({ ...profile, clinicName: e.target.value }), required: true, className: "text-xs" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u0627\u0633\u0645 \u0627\u0644\u0637\u0628\u064A\u0628 \u0627\u0644\u0631\u0626\u064A\u0633\u064A *" }), _jsx(Input, { type: "text", value: profile.doctorName, onChange: (e) => setProfile({ ...profile, doctorName: e.target.value }), required: true, className: "text-xs" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u0627\u0644\u0644\u0642\u0628 \u0627\u0644\u0645\u0647\u0646\u064A \u0648\u0627\u0644\u062F\u0631\u062C\u0629 \u0627\u0644\u0639\u0644\u0645\u064A\u0629 *" }), _jsx(Input, { type: "text", value: profile.doctorTitle, onChange: (e) => setProfile({ ...profile, doctorTitle: e.target.value }), required: true, className: "text-xs" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u0627\u0644\u062A\u062E\u0635\u0635 \u0627\u0644\u0637\u0628\u064A *" }), _jsx(Input, { type: "text", value: profile.specialty, onChange: (e) => setProfile({ ...profile, specialty: e.target.value }), required: true, className: "text-xs" })] })] })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 pb-3 border-b border-slate-100", children: [_jsx(ShieldCheck, { className: "w-4 h-4 text-sky-600" }), _jsx("h3", { className: "font-bold text-slate-800 text-sm", children: "\u0633\u064A\u0627\u0633\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0648\u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0627\u0644\u0645\u062C\u0627\u0646\u064A\u0629 (\u0628\u0627\u0644\u0623\u064A\u0627\u0645) *" }), _jsx(Input, { type: "number", min: "1", max: "90", value: profile.consultationValidityDays, onChange: (e) => setProfile({ ...profile, consultationValidityDays: parseInt(e.target.value) || 14 }), required: true, className: "text-xs font-bold" }), _jsx("span", { className: "text-[11px] text-slate-400 mt-1 block", children: "\u0627\u0644\u0645\u062F\u0629 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0644\u0644\u0645\u0631\u064A\u0636 \u062E\u0644\u0627\u0644\u0647\u0627 \u0628\u0625\u062C\u0631\u0627\u0621 \u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0628\u0639\u062F \u0627\u0644\u0643\u0634\u0641 (\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0627\u064B 14 \u064A\u0648\u0645\u0627\u064B)" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0639\u062F\u062F \u0627\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0627\u062A \u0644\u0643\u0644 \u0643\u0634\u0641 *" }), _jsx(Input, { type: "number", min: "1", max: "5", value: profile.maxConsultationsPerExam, onChange: (e) => setProfile({ ...profile, maxConsultationsPerExam: parseInt(e.target.value) || 1 }), required: true, className: "text-xs font-bold" }), _jsx("span", { className: "text-[11px] text-slate-400 mt-1 block", children: "\u0639\u062F\u062F \u0645\u0631\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0627\u0644\u0645\u062C\u0627\u0646\u064A\u0629 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647\u0627 \u0642\u0628\u0644 \u0648\u062C\u0648\u0628 \u062D\u062C\u0632 \u0643\u0634\u0641 \u062C\u062F\u064A\u062F" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u0633\u0639\u0631 \u0627\u0644\u0643\u0634\u0641 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A (\u062C.\u0645) *" }), _jsxs("div", { className: "relative", children: [_jsx(Input, { type: "number", step: "any", min: "0", value: examPriceEgp, onChange: (e) => setExamPriceEgp(e.target.value), required: true, className: "text-sm font-bold pl-12 text-emerald-700" }), _jsx("div", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400", children: "\u062C.\u0645" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u0633\u0639\u0631 \u0627\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0629 / \u0627\u0644\u0625\u0639\u0627\u062F\u0629 (\u062C.\u0645) *" }), _jsxs("div", { className: "relative", children: [_jsx(Input, { type: "number", step: "any", min: "0", value: consultPriceEgp, onChange: (e) => setConsultPriceEgp(e.target.value), required: true, className: "text-sm font-bold pl-12" }), _jsx("div", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400", children: "\u062C.\u0645" })] }), _jsx("span", { className: "text-[11px] text-slate-400 mt-1 block", children: "0 \u062C.\u0645 \u0644\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u062C\u0627\u0646\u064A\u0629" })] })] })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 pb-3 border-b border-slate-100", children: [_jsx(Clock, { className: "w-4 h-4 text-sky-600" }), _jsx("h3", { className: "font-bold text-slate-800 text-sm", children: "\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u062A\u0634\u063A\u064A\u0644 \u0648\u0639\u0631\u0636 \u0627\u0644\u0634\u0627\u0634\u0627\u062A" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u0648\u0636\u0639 \u062E\u0635\u0648\u0635\u064A\u0629 \u0627\u0644\u0623\u0633\u0645\u0627\u0621 \u0639\u0644\u0649 \u0634\u0627\u0634\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 (TV) *" }), _jsxs("select", { value: profile.tvPrivacyMode, onChange: (e) => setProfile({ ...profile, tvPrivacyMode: e.target.value }), className: "w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500", children: [_jsx("option", { value: "FirstNameAndInitial", children: "\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0623\u0648\u0644 \u0648\u0627\u0644\u062D\u0631\u0641 \u0627\u0644\u0623\u0648\u0644 \u0641\u0642\u0637 (\u0645\u062D\u0645\u062F \u0623.)" }), _jsx("option", { value: "QueueNumberOnly", children: "\u0631\u0642\u0645 \u0627\u0644\u062F\u0648\u0631 \u0641\u064A \u0627\u0644\u0637\u0627\u0628\u0648\u0631 \u0641\u0642\u0637 (\u062F\u0648\u0631 #4)" }), _jsx("option", { value: "FullName", children: "\u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 (\u0645\u062D\u0645\u062F \u0623\u062D\u0645\u062F \u0645\u062D\u0645\u0648\u062F)" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u062A\u0641\u0639\u064A\u0644 \u0645\u0631\u062D\u0644\u0629 \u0642\u064A\u0627\u0633 \u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062A \u0627\u0644\u062D\u064A\u0648\u064A\u0629 \u0628\u0627\u0644\u062A\u0645\u0631\u064A\u0636 *" }), _jsxs("div", { className: "flex items-center gap-3 pt-2", children: [_jsx("input", { type: "checkbox", id: "enableNursing", checked: profile.enableNursingStage, onChange: (e) => setProfile({ ...profile, enableNursingStage: e.target.checked }), className: "w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500" }), _jsx("label", { htmlFor: "enableNursing", className: "text-xs font-medium text-slate-700 cursor-pointer", children: "\u062A\u0648\u062C\u064A\u0647 \u0627\u0644\u0645\u0631\u0636\u0649 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u0625\u0644\u0649 \u063A\u0631\u0641\u0629 \u0627\u0644\u062A\u0645\u0631\u064A\u0636 \u0642\u0628\u0644 \u063A\u0631\u0641\u0629 \u0627\u0644\u0637\u0628\u064A\u0628" })] })] })] })] }), _jsx("div", { className: "flex justify-end pt-2", children: _jsxs(Button, { type: "submit", variant: "primary", size: "md", disabled: isSaving, className: "gap-2 px-6", children: [_jsx(Save, { className: "w-4 h-4" }), _jsx("span", { children: isSaving ? 'جاري الحفظ...' : 'حفظ إعدادات العيادة' })] }) })] }));
}
