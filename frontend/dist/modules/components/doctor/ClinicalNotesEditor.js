import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { FileText, Lock, CheckCircle2, Loader2, AlertCircle, RefreshCw, } from 'lucide-react';
import { doctorService } from '../../services/doctorService';
import { ConcurrencyConflictException } from '../../lib/api';
const COMMON_ICD10_CHIPS = [
    { code: 'J20.9', labelAr: 'نزلة شعبية حادة', labelEn: 'Acute Bronchitis' },
    { code: 'I10', labelAr: 'ضغط دم أساسي', labelEn: 'Essential Hypertension' },
    { code: 'E11.9', labelAr: 'سكري النوع الثاني', labelEn: 'Type 2 Diabetes' },
    { code: 'K29.7', labelAr: 'التهاب المعدة', labelEn: 'Gastritis' },
    { code: 'J02.9', labelAr: 'التهاب الحلق الحاد', labelEn: 'Acute Pharyngitis' },
];
export function ClinicalNotesEditor({ visitId, initialNotes, version, isDraft, onChangeNotes, onAutosaveSuccess, onVersionConflict, }) {
    const [chiefComplaint, setChiefComplaint] = useState(initialNotes.chiefComplaint || '');
    const [examination, setExamination] = useState(initialNotes.examination || '');
    const [diagnosis, setDiagnosis] = useState(initialNotes.diagnosis || '');
    const [icd10Code, setIcd10Code] = useState(initialNotes.icd10Code || '');
    const [doctorPrivateNotes, setDoctorPrivateNotes] = useState(initialNotes.doctorPrivateNotes || '');
    const [nextVisitDate, setNextVisitDate] = useState(initialNotes.nextVisitDate || '');
    const [saveStatus, setSaveStatus] = useState('idle');
    const [lastSavedTime, setLastSavedTime] = useState(null);
    // Sync state if initialNotes or visitId changes
    useEffect(() => {
        setChiefComplaint(initialNotes.chiefComplaint || '');
        setExamination(initialNotes.examination || '');
        setDiagnosis(initialNotes.diagnosis || '');
        setIcd10Code(initialNotes.icd10Code || '');
        setDoctorPrivateNotes(initialNotes.doctorPrivateNotes || '');
        setNextVisitDate(initialNotes.nextVisitDate || '');
        setSaveStatus('idle');
    }, [visitId]);
    // Keep a ref to latest state and version for debounced save
    const currentNotesRef = useRef({
        chiefComplaint,
        examination,
        diagnosis,
        icd10Code,
        doctorPrivateNotes,
        nextVisitDate,
    });
    currentNotesRef.current = {
        chiefComplaint,
        examination,
        diagnosis,
        icd10Code,
        doctorPrivateNotes,
        nextVisitDate,
    };
    const versionRef = useRef(version);
    versionRef.current = version;
    // Notify parent of notes change
    const notifyChange = (updated) => {
        const next = {
            ...currentNotesRef.current,
            ...updated,
        };
        currentNotesRef.current = next;
        setSaveStatus('dirty');
        onChangeNotes?.(next);
    };
    // 5-second debounced autosave effect
    useEffect(() => {
        if (!isDraft || !visitId || saveStatus !== 'dirty')
            return;
        const timer = setTimeout(async () => {
            try {
                setSaveStatus('saving');
                const payload = {
                    chiefComplaint: currentNotesRef.current.chiefComplaint,
                    examination: currentNotesRef.current.examination,
                    diagnosis: currentNotesRef.current.diagnosis,
                    icd10Code: currentNotesRef.current.icd10Code,
                    doctorPrivateNotes: currentNotesRef.current.doctorPrivateNotes,
                    nextVisitDate: currentNotesRef.current.nextVisitDate || null,
                    nurseNotes: initialNotes.nurseNotes || null,
                    version: versionRef.current,
                };
                const updated = await doctorService.saveDraft(visitId, payload);
                onAutosaveSuccess(updated);
                setSaveStatus('saved');
                const now = new Date();
                const timeStr = now.toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                });
                setLastSavedTime(timeStr);
            }
            catch (err) {
                if (err instanceof ConcurrencyConflictException || err?.status === 409) {
                    setSaveStatus('conflict');
                    onVersionConflict();
                }
                else {
                    setSaveStatus('error');
                    console.warn('Autosave failed:', err);
                }
            }
        }, 5000);
        return () => clearTimeout(timer);
    }, [chiefComplaint, examination, diagnosis, icd10Code, doctorPrivateNotes, nextVisitDate, saveStatus, visitId, isDraft]);
    // Quick preset dates for Next Consultation
    const handleAddDays = (days) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        const dateStr = d.toISOString().split('T')[0];
        setNextVisitDate(dateStr);
        notifyChange({ nextVisitDate: dateStr });
    };
    const handleSelectIcd10 = (code, label) => {
        setIcd10Code(code);
        if (!diagnosis.trim()) {
            setDiagnosis(label);
            notifyChange({ icd10Code: code, diagnosis: label });
        }
        else {
            notifyChange({ icd10Code: code });
        }
    };
    return (_jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 relative", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 pb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(FileText, { className: "w-5 h-5 text-sky-600" }), _jsx("h3", { className: "font-bold text-slate-900 text-base", children: "\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0637\u0628\u064A\u0629 \u0648\u0627\u0644\u0641\u062D\u0635 \u0627\u0644\u0633\u0631\u064A\u0631\u064A" })] }), _jsxs("div", { className: "flex items-center gap-2 text-xs", children: [saveStatus === 'saved' && (_jsxs("span", { className: "flex items-center gap-1.5 text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full animate-in fade-in", children: [_jsx(CheckCircle2, { className: "w-3.5 h-3.5 text-emerald-500" }), _jsxs("span", { children: ["\u062A\u0645 \u0627\u0644\u062D\u0641\u0638 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B ", lastSavedTime ? `(${lastSavedTime})` : ''] })] })), saveStatus === 'saving' && (_jsxs("span", { className: "flex items-center gap-1.5 text-amber-600 font-medium bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full animate-pulse", children: [_jsx(Loader2, { className: "w-3.5 h-3.5 animate-spin text-amber-500" }), _jsx("span", { children: "\u062C\u0627\u0631\u064A \u0627\u0644\u062D\u0641\u0638..." })] })), saveStatus === 'dirty' && (_jsxs("span", { className: "flex items-center gap-1.5 text-slate-500 font-medium bg-slate-100 px-2.5 py-1 rounded-full", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-amber-400" }), _jsx("span", { children: "\u062A\u063A\u064A\u064A\u0631\u0627\u062A \u063A\u064A\u0631 \u0645\u062D\u0641\u0648\u0638\u0629..." })] })), saveStatus === 'conflict' && (_jsxs("button", { onClick: onVersionConflict, className: "flex items-center gap-1.5 text-rose-700 font-bold bg-rose-50 border border-rose-300 px-2.5 py-1 rounded-full hover:bg-rose-100 transition-colors", children: [_jsx(AlertCircle, { className: "w-3.5 h-3.5 text-rose-600" }), _jsx("span", { children: "\u062A\u0636\u0627\u0631\u0628 \u0641\u064A \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A - \u0627\u0636\u063A\u0637 \u0644\u0644\u062A\u062D\u062F\u064A\u062B" }), _jsx(RefreshCw, { className: "w-3 h-3 text-rose-500" })] })), saveStatus === 'error' && (_jsxs("span", { className: "flex items-center gap-1.5 text-rose-600 font-medium bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full", children: [_jsx(AlertCircle, { className: "w-3.5 h-3.5 text-rose-500" }), _jsx("span", { children: "\u062A\u0639\u0630\u0631 \u0627\u0644\u062D\u0641\u0638 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A" })] }))] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1.5", children: "\u0627\u0644\u0634\u0643\u0648\u0649 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0644\u0644\u0645\u0631\u064A\u0636 (Chief Complaint)" }), _jsx("textarea", { rows: 2, value: chiefComplaint, onChange: (e) => {
                                    setChiefComplaint(e.target.value);
                                    notifyChange({ chiefComplaint: e.target.value });
                                }, placeholder: "\u0627\u0644\u0634\u0643\u0648\u0649 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629 \u0648\u0633\u0628\u0628 \u0627\u0644\u0632\u064A\u0627\u0631\u0629...", className: "w-full text-sm rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:text-slate-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1.5", children: "\u0627\u0644\u0641\u062D\u0635 \u0627\u0644\u0625\u0643\u0644\u064A\u0646\u064A\u0643\u064A \u0627\u0644\u0633\u0631\u064A\u0631\u064A (Physical Examination)" }), _jsx("textarea", { rows: 2, value: examination, onChange: (e) => {
                                    setExamination(e.target.value);
                                    notifyChange({ examination: e.target.value });
                                }, placeholder: "\u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0641\u062D\u0635 \u0627\u0644\u0625\u0643\u0644\u064A\u0646\u064A\u0643\u064A (\u0627\u0644\u0635\u062F\u0631\u060C \u0627\u0644\u0642\u0644\u0628\u060C \u0627\u0644\u0628\u0637\u0646\u060C \u0627\u0644\u0641\u062D\u0635 \u0627\u0644\u0639\u0627\u0645)...", className: "w-full text-sm rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:text-slate-400" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsx("label", { className: "block text-xs font-bold text-slate-700", children: "\u0627\u0644\u062A\u0634\u062E\u064A\u0635 \u0627\u0644\u0637\u0628\u064A (Diagnosis) \u0648\u0631\u0645\u0632 ICD-10" }), _jsxs("div", { className: "flex flex-wrap items-center gap-1.5", children: [_jsx("span", { className: "text-[11px] text-slate-400", children: "\u062A\u0634\u062E\u064A\u0635\u0627\u062A \u0634\u0627\u0626\u0639\u0629:" }), COMMON_ICD10_CHIPS.map((chip) => (_jsxs("button", { type: "button", onClick: () => handleSelectIcd10(chip.code, chip.labelAr), className: "text-[11px] font-medium bg-slate-100 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md transition-colors", children: [chip.code, " - ", chip.labelAr] }, chip.code)))] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-4 gap-3", children: [_jsx("div", { className: "sm:col-span-3", children: _jsx("input", { type: "text", value: diagnosis, onChange: (e) => {
                                        setDiagnosis(e.target.value);
                                        notifyChange({ diagnosis: e.target.value });
                                    }, placeholder: "\u0627\u0644\u062A\u0634\u062E\u064A\u0635 \u0627\u0644\u0625\u0643\u0644\u064A\u0646\u064A\u0643\u064A \u0627\u0644\u0646\u0647\u0627\u0626\u064A \u0623\u0648 \u0627\u0644\u0623\u0648\u0644\u064A...", className: "w-full text-sm font-semibold rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:font-normal placeholder:text-slate-400" }) }), _jsx("div", { children: _jsx("input", { type: "text", value: icd10Code, onChange: (e) => {
                                        setIcd10Code(e.target.value);
                                        notifyChange({ icd10Code: e.target.value });
                                    }, placeholder: "\u0643\u0648\u062F ICD-10 (\u0645\u062B\u0627\u0644: J20.9)", className: "w-full text-sm font-mono uppercase rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 text-center" }) })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { className: "md:col-span-2", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-xs font-bold text-amber-800 mb-1.5", children: [_jsx(Lock, { className: "w-3.5 h-3.5 text-amber-600" }), _jsx("span", { children: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0633\u0631\u064A\u0629 \u062E\u0627\u0635\u0629 \u0628\u0627\u0644\u0637\u0628\u064A\u0628 (\u0644\u0627 \u062A\u0638\u0647\u0631 \u0628\u0627\u0644\u0631\u0648\u0634\u062A\u0629 \u0627\u0644\u0645\u0637\u0628\u0648\u0639\u0629)" })] }), _jsx("textarea", { rows: 2, value: doctorPrivateNotes, onChange: (e) => {
                                    setDoctorPrivateNotes(e.target.value);
                                    notifyChange({ doctorPrivateNotes: e.target.value });
                                }, placeholder: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0633\u0631\u064A\u0629 \u062E\u0627\u0635\u0629 \u0628\u0627\u0644\u0639\u064A\u0627\u062F\u0629 \u0623\u0648 \u0645\u062A\u0627\u0628\u0639\u0629 \u062F\u0627\u062E\u0644\u064A\u0629...", className: "w-full text-sm rounded-xl border border-amber-200 bg-amber-50/30 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-slate-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1.5", children: "\u0645\u0648\u0639\u062F \u0627\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0627\u0644\u0642\u0627\u062F\u0645\u0629 (Next Visit)" }), _jsxs("div", { className: "space-y-2", children: [_jsx("input", { type: "date", value: nextVisitDate, onChange: (e) => {
                                            setNextVisitDate(e.target.value);
                                            notifyChange({ nextVisitDate: e.target.value });
                                        }, className: "w-full text-sm rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent font-medium" }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("button", { type: "button", onClick: () => handleAddDays(7), className: "flex-1 text-[11px] font-semibold bg-slate-100 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 rounded-lg py-1 transition-colors", children: "+7 \u0623\u064A\u0627\u0645" }), _jsx("button", { type: "button", onClick: () => handleAddDays(14), className: "flex-1 text-[11px] font-semibold bg-slate-100 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 rounded-lg py-1 transition-colors", title: "\u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0645\u062C\u0627\u0646\u064A\u0629 \u0628\u0639\u062F \u0623\u0633\u0628\u0648\u0639\u064A\u0646", children: "+14 \u064A\u0648\u0645" }), _jsx("button", { type: "button", onClick: () => handleAddDays(30), className: "flex-1 text-[11px] font-semibold bg-slate-100 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 rounded-lg py-1 transition-colors", children: "+\u0634\u0647\u0631" })] })] })] })] })] }));
}
