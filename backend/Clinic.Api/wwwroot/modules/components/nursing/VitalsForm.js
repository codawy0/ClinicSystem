import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { Heart, Thermometer, Scale, Droplet, Baby, FileEdit, Save, CheckCircle, AlertCircle, AlertTriangle, RotateCcw, } from 'lucide-react';
import { vitalsAlerts } from '../../lib/vitalsAlerts';
import { nursingService } from '../../services/nursingService';
import { ConcurrencyConflictException } from '../../lib/api';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
const COMMON_SYMPTOMS = [
    'صداع شديد',
    'مغص كلوي حاد',
    'ارتفاع حرارة ورعشة',
    'ألم بالصدر',
    'كحة وضيق تنفس',
    'متابعة دورية',
    'غثيان وقيء',
    'إرهاق عام ودوخة',
    'ألم بالظهر والرقبة',
];
export function VitalsForm({ visitId, initialVitals, initialVersion, patientGender, onSaveSuccess, onCompletePrep, onConcurrencyError, }) {
    // Form fields state
    const [bpSystolic, setBpSystolic] = useState('');
    const [bpDiastolic, setBpDiastolic] = useState('');
    const [pulseBpm, setPulseBpm] = useState('');
    const [tempCelsius, setTempCelsius] = useState('');
    const [spo2Pct, setSpo2Pct] = useState('');
    const [weightKg, setWeightKg] = useState('');
    const [heightCm, setHeightCm] = useState('');
    const [bloodSugarMgDl, setBloodSugarMgDl] = useState('');
    const [bloodSugarType, setBloodSugarType] = useState('Random');
    const [isPregnant, setIsPregnant] = useState(false);
    const [isLactating, setIsLactating] = useState(false);
    const [lmpDate, setLmpDate] = useState('');
    const [chiefComplaint, setChiefComplaint] = useState('');
    const [nurseNotes, setNurseNotes] = useState('');
    // Version tracking
    const [currentVersion, setCurrentVersion] = useState(initialVersion);
    // Submission state
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);
    const [formError, setFormError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    // Sync initial vitals when visit changes
    useEffect(() => {
        setCurrentVersion(initialVersion);
        setFormError(null);
        setSuccessMessage(null);
        if (initialVitals) {
            setBpSystolic(initialVitals.bpSystolic ? String(initialVitals.bpSystolic) : '');
            setBpDiastolic(initialVitals.bpDiastolic ? String(initialVitals.bpDiastolic) : '');
            setPulseBpm(initialVitals.pulseBpm ? String(initialVitals.pulseBpm) : '');
            setTempCelsius(initialVitals.tempCelsius ? String(initialVitals.tempCelsius) : '');
            setSpo2Pct(initialVitals.spo2Pct ? String(initialVitals.spo2Pct) : '');
            setWeightKg(initialVitals.weightKg ? String(initialVitals.weightKg) : '');
            setHeightCm(initialVitals.heightCm ? String(initialVitals.heightCm) : '');
            setBloodSugarMgDl(initialVitals.bloodSugarMgDl ? String(initialVitals.bloodSugarMgDl) : '');
            setBloodSugarType(initialVitals.bloodSugarType || 'Random');
            setIsPregnant(Boolean(initialVitals.isPregnant));
            setIsLactating(Boolean(initialVitals.isLactating));
            setLmpDate(initialVitals.lmpDate || '');
            setChiefComplaint(initialVitals.chiefComplaint || '');
            setNurseNotes(initialVitals.nurseNotes || '');
        }
        else {
            setBpSystolic('');
            setBpDiastolic('');
            setPulseBpm('');
            setTempCelsius('');
            setSpo2Pct('');
            setWeightKg('');
            setHeightCm('');
            setBloodSugarMgDl('');
            setBloodSugarType('Random');
            setIsPregnant(false);
            setIsLactating(false);
            setLmpDate('');
            setChiefComplaint('');
            setNurseNotes('');
        }
    }, [visitId, initialVitals, initialVersion]);
    // Real-time Evaluations
    const bpAlert = useMemo(() => {
        const sys = bpSystolic ? parseInt(bpSystolic, 10) : null;
        const dia = bpDiastolic ? parseInt(bpDiastolic, 10) : null;
        return vitalsAlerts.evaluateBp(sys, dia);
    }, [bpSystolic, bpDiastolic]);
    const pulseAlert = useMemo(() => {
        const p = pulseBpm ? parseInt(pulseBpm, 10) : null;
        return vitalsAlerts.evaluatePulse(p);
    }, [pulseBpm]);
    const tempAlert = useMemo(() => {
        const t = tempCelsius ? parseFloat(tempCelsius) : null;
        return vitalsAlerts.evaluateTemp(t);
    }, [tempCelsius]);
    const spo2Alert = useMemo(() => {
        const s = spo2Pct ? parseInt(spo2Pct, 10) : null;
        return vitalsAlerts.evaluateSpo2(s);
    }, [spo2Pct]);
    const glucoseAlert = useMemo(() => {
        const g = bloodSugarMgDl ? parseInt(bloodSugarMgDl, 10) : null;
        return vitalsAlerts.evaluateGlucose(g, bloodSugarType);
    }, [bloodSugarMgDl, bloodSugarType]);
    const bmiEval = useMemo(() => {
        const w = weightKg ? parseFloat(weightKg) : null;
        const h = heightCm ? parseFloat(heightCm) : null;
        return vitalsAlerts.calculateBmi(w, h);
    }, [weightKg, heightCm]);
    // Append symptom chip to chief complaint
    const handleAppendSymptom = (symptom) => {
        setChiefComplaint((prev) => {
            const trimmed = prev.trim();
            if (!trimmed)
                return symptom;
            if (trimmed.includes(symptom))
                return trimmed;
            return `${trimmed}، ${symptom}`;
        });
    };
    // Build payload
    const buildPayload = (markNursePrepComplete) => {
        return {
            bpSystolic: bpSystolic ? parseInt(bpSystolic, 10) : null,
            bpDiastolic: bpDiastolic ? parseInt(bpDiastolic, 10) : null,
            pulseBpm: pulseBpm ? parseInt(pulseBpm, 10) : null,
            tempCelsius: tempCelsius ? parseFloat(tempCelsius) : null,
            spo2Pct: spo2Pct ? parseInt(spo2Pct, 10) : null,
            weightKg: weightKg ? parseFloat(weightKg) : null,
            heightCm: heightCm ? parseFloat(heightCm) : null,
            bloodSugarMgDl: bloodSugarMgDl ? parseInt(bloodSugarMgDl, 10) : null,
            bloodSugarType: bloodSugarMgDl ? bloodSugarType : null,
            isPregnant: patientGender === 'Female' ? isPregnant : false,
            isLactating: patientGender === 'Female' ? isLactating : false,
            lmpDate: patientGender === 'Female' && isPregnant && lmpDate ? lmpDate : null,
            chiefComplaint: chiefComplaint.trim() || null,
            nurseNotes: nurseNotes.trim() || null,
            markNursePrepComplete,
            version: currentVersion,
        };
    };
    // Submit Handler
    const handleSave = async (markNursePrepComplete) => {
        setFormError(null);
        setSuccessMessage(null);
        if (markNursePrepComplete) {
            setIsCompleting(true);
        }
        else {
            setIsSavingDraft(true);
        }
        try {
            const payload = buildPayload(markNursePrepComplete);
            const updatedVisit = await nursingService.saveVitals(visitId, payload);
            setCurrentVersion(updatedVisit.version);
            if (markNursePrepComplete) {
                setSuccessMessage('تم حفظ الفحص بنجاح ونقل المريض إلى قائمة انتظار الطبيب');
                onCompletePrep(updatedVisit);
            }
            else {
                setSuccessMessage('تم حفظ مسودة العلامات الحيوية بنجاح');
                onSaveSuccess(updatedVisit);
            }
        }
        catch (err) {
            if (err instanceof ConcurrencyConflictException || err.status === 409) {
                setFormError('تم تعديل بيانات الزيارة بواسطة مستخدم آخر. يرجى إعادة تحميل البيانات.');
                onConcurrencyError?.();
            }
            else {
                setFormError(err.message || 'حدث خطأ أثناء حفظ العلامات الحيوية');
            }
        }
        finally {
            setIsSavingDraft(false);
            setIsCompleting(false);
        }
    };
    const renderAlertBadge = (alert) => {
        if (!alert.hasAlert && alert.labelAr === 'غير مسجل')
            return null;
        if (alert.level === 'danger') {
            return (_jsxs("span", { className: "inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2 py-0.5", children: [_jsx(AlertCircle, { className: "w-3.5 h-3.5 flex-shrink-0" }), _jsx("span", { children: alert.labelAr })] }));
        }
        if (alert.level === 'warning') {
            return (_jsxs("span", { className: "inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5", children: [_jsx(AlertTriangle, { className: "w-3.5 h-3.5 flex-shrink-0" }), _jsx("span", { children: alert.labelAr })] }));
        }
        return (_jsxs("span", { className: "inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5", children: [_jsx(CheckCircle, { className: "w-3.5 h-3.5 flex-shrink-0" }), _jsx("span", { children: alert.labelAr })] }));
    };
    return (_jsxs("div", { className: "space-y-4 text-right", children: [formError && (_jsxs("div", { className: "p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0 text-rose-600" }), _jsx("span", { className: "font-semibold", children: formError })] }), onConcurrencyError && (_jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: onConcurrencyError, className: "text-xs bg-white text-rose-700 border-rose-300 hover:bg-rose-100", children: [_jsx(RotateCcw, { className: "w-3.5 h-3.5 ml-1" }), "\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A"] }))] })), successMessage && (_jsxs("div", { className: "p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2", children: [_jsx(CheckCircle, { className: "w-4 h-4 flex-shrink-0 text-emerald-600" }), _jsx("span", { className: "font-semibold", children: successMessage })] })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: [_jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 pb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center", children: _jsx(Heart, { className: "w-4 h-4" }) }), _jsx("h3", { className: "text-xs font-bold text-slate-800", children: "\u0627\u0644\u0642\u0644\u0628 \u0648\u0636\u063A\u0637 \u0627\u0644\u062F\u0645" })] }), _jsx("span", { className: "text-[10px] text-slate-400 font-mono", children: "BP & Pulse" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u0627\u0646\u0642\u0628\u0627\u0636\u064A (Systolic)" }), _jsx("input", { type: "number", value: bpSystolic, onChange: (e) => setBpSystolic(e.target.value), placeholder: "120", className: "w-full text-sm font-bold font-mono text-center bg-slate-50 border border-slate-300 rounded-xl py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u0627\u0646\u0628\u0633\u0627\u0637\u064A (Diastolic)" }), _jsx("input", { type: "number", value: bpDiastolic, onChange: (e) => setBpDiastolic(e.target.value), placeholder: "80", className: "w-full text-sm font-bold font-mono text-center bg-slate-50 border border-slate-300 rounded-xl py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500" })] })] }), renderAlertBadge(bpAlert), _jsxs("div", { className: "pt-2 border-t border-slate-100", children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u0627\u0644\u0646\u0628\u0636 (Pulse bpm)" }), _jsx("input", { type: "number", value: pulseBpm, onChange: (e) => setPulseBpm(e.target.value), placeholder: "72", className: "w-full text-sm font-bold font-mono text-center bg-slate-50 border border-slate-300 rounded-xl py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500" }), _jsx("div", { className: "mt-2", children: renderAlertBadge(pulseAlert) })] })] }), _jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 pb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center", children: _jsx(Thermometer, { className: "w-4 h-4" }) }), _jsx("h3", { className: "text-xs font-bold text-slate-800", children: "\u0627\u0644\u062D\u0631\u0627\u0631\u0629 \u0648\u0627\u0644\u0623\u0643\u0633\u062C\u064A\u0646" })] }), _jsx("span", { className: "text-[10px] text-slate-400 font-mono", children: "Temp & SpO2" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u062F\u0631\u062C\u0629 \u0627\u0644\u062D\u0631\u0627\u0631\u0629 (\u00B0C)" }), _jsx("input", { type: "number", step: "0.1", value: tempCelsius, onChange: (e) => setTempCelsius(e.target.value), placeholder: "37.0", className: "w-full text-sm font-bold font-mono text-center bg-slate-50 border border-slate-300 rounded-xl py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500" }), _jsx("div", { className: "mt-2", children: renderAlertBadge(tempAlert) })] }), _jsxs("div", { className: "pt-2 border-t border-slate-100", children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u062A\u0634\u0628\u0639 \u0627\u0644\u0623\u0643\u0633\u062C\u064A\u0646 (SpO2 %)" }), _jsx("input", { type: "number", value: spo2Pct, onChange: (e) => setSpo2Pct(e.target.value), placeholder: "98", className: "w-full text-sm font-bold font-mono text-center bg-slate-50 border border-slate-300 rounded-xl py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500" }), _jsx("div", { className: "mt-2", children: renderAlertBadge(spo2Alert) })] })] }), _jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 pb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-7 h-7 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center", children: _jsx(Scale, { className: "w-4 h-4" }) }), _jsx("h3", { className: "text-xs font-bold text-slate-800", children: "\u0627\u0644\u0648\u0632\u0646 \u0648\u0627\u0644\u0637\u0648\u0644 \u0648\u0643\u062A\u0644\u0629 \u0627\u0644\u062C\u0633\u0645" })] }), _jsx("span", { className: "text-[10px] text-slate-400 font-mono", children: "BMI" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u0627\u0644\u0648\u0632\u0646 (kg)" }), _jsx("input", { type: "number", step: "0.1", value: weightKg, onChange: (e) => setWeightKg(e.target.value), placeholder: "75", className: "w-full text-sm font-bold font-mono text-center bg-slate-50 border border-slate-300 rounded-xl py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u0627\u0644\u0637\u0648\u0644 (cm)" }), _jsx("input", { type: "number", step: "1", value: heightCm, onChange: (e) => setHeightCm(e.target.value), placeholder: "170", className: "w-full text-sm font-bold font-mono text-center bg-slate-50 border border-slate-300 rounded-xl py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" })] })] }), _jsxs("div", { className: "p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1", children: [_jsxs("div", { className: "flex items-center justify-between text-xs font-semibold", children: [_jsx("span", { className: "text-slate-600", children: "\u0645\u0624\u0634\u0631 \u0643\u062A\u0644\u0629 \u0627\u0644\u062C\u0633\u0645:" }), _jsx("span", { className: "font-mono font-bold text-slate-900 text-sm", children: bmiEval.bmi !== null ? `${bmiEval.bmi} kg/m²` : '--' })] }), bmiEval.bmi !== null ? (_jsx("div", { className: cn('text-center text-xs font-bold rounded-lg py-1 px-2 mt-1', bmiEval.level === 'normal' && 'bg-emerald-100 text-emerald-800', bmiEval.level === 'warning' && 'bg-amber-100 text-amber-800', bmiEval.level === 'danger' && 'bg-rose-100 text-rose-800'), children: bmiEval.labelAr })) : (_jsx("p", { className: "text-[11px] text-slate-400 text-center", children: "\u0623\u062F\u062E\u0644 \u0627\u0644\u0637\u0648\u0644 \u0648\u0627\u0644\u0648\u0632\u0646 \u0644\u0627\u062D\u062A\u0633\u0627\u0628 \u0627\u0644\u0645\u0624\u0634\u0631 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B" }))] })] }), _jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 pb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-7 h-7 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center", children: _jsx(Droplet, { className: "w-4 h-4" }) }), _jsx("h3", { className: "text-xs font-bold text-slate-800", children: "\u0627\u0644\u0633\u0643\u0631 \u0628\u0627\u0644\u062F\u0645" })] }), _jsx("span", { className: "text-[10px] text-slate-400 font-mono", children: "Blood Glucose" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u0627\u0644\u0642\u0631\u0627\u0621\u0629 (mg/dL)" }), _jsx("input", { type: "number", value: bloodSugarMgDl, onChange: (e) => setBloodSugarMgDl(e.target.value), placeholder: "110", className: "w-full text-sm font-bold font-mono text-center bg-slate-50 border border-slate-300 rounded-xl py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0641\u062D\u0635" }), _jsxs("select", { value: bloodSugarType, onChange: (e) => setBloodSugarType(e.target.value), className: "w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl py-2 px-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500", children: [_jsx("option", { value: "Random", children: "\u0639\u0634\u0648\u0627\u0626\u064A (Random)" }), _jsx("option", { value: "Fasting", children: "\u0635\u0627\u0626\u0645 (Fasting)" }), _jsx("option", { value: "PostPrandial", children: "\u0628\u0639\u062F \u0627\u0644\u0623\u0643\u0644 (Post-Prandial)" })] })] })] }), renderAlertBadge(glucoseAlert)] }), patientGender === 'Female' && (_jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 pb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-7 h-7 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center", children: _jsx(Baby, { className: "w-4 h-4" }) }), _jsx("h3", { className: "text-xs font-bold text-slate-800", children: "\u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u0645\u0644 \u0648\u0627\u0644\u0631\u0636\u0627\u0639\u0629" })] }), _jsx("span", { className: "text-[10px] text-slate-400 font-mono", children: "Maternal" })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("label", { className: "flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-pink-50/50", children: [_jsx("span", { className: "text-xs font-bold text-slate-700", children: "\u0627\u0644\u0645\u0631\u064A\u0636\u0629 \u062D\u0627\u0645\u0644 \u062D\u0627\u0644\u064A\u0627\u064B" }), _jsx("input", { type: "checkbox", checked: isPregnant, onChange: (e) => setIsPregnant(e.target.checked), className: "w-4 h-4 rounded text-pink-600 focus:ring-pink-500 border-slate-300" })] }), isPregnant && (_jsxs("div", { className: "p-2 bg-pink-50/70 border border-pink-200 rounded-xl space-y-1", children: [_jsx("label", { className: "block text-[10px] font-bold text-pink-800", children: "\u062A\u0627\u0631\u064A\u062E \u0622\u062E\u0631 \u062F\u0648\u0631\u0629 \u0634\u0647\u0631\u064A\u0629 (LMP)" }), _jsx("input", { type: "date", value: lmpDate, onChange: (e) => setLmpDate(e.target.value), className: "w-full text-xs bg-white border border-pink-300 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-pink-500 font-mono" })] })), _jsxs("label", { className: "flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-pink-50/50", children: [_jsx("span", { className: "text-xs font-bold text-slate-700", children: "\u0627\u0644\u0645\u0631\u064A\u0636\u0629 \u0645\u0631\u0636\u0639\u0629 \u062D\u0627\u0644\u064A\u0627\u064B" }), _jsx("input", { type: "checkbox", checked: isLactating, onChange: (e) => setIsLactating(e.target.checked), className: "w-4 h-4 rounded text-pink-600 focus:ring-pink-500 border-slate-300" })] })] })] })), _jsxs("div", { className: cn('bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3', patientGender === 'Female' ? 'md:col-span-2 lg:col-span-1' : 'md:col-span-2 lg:col-span-2'), children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 pb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center", children: _jsx(FileEdit, { className: "w-4 h-4" }) }), _jsx("h3", { className: "text-xs font-bold text-slate-800", children: "\u0627\u0644\u0634\u0643\u0648\u0649 \u0648\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0633\u0631\u064A\u0631\u064A\u0629 \u0627\u0644\u0623\u0648\u0644\u064A\u0629" })] }), _jsx("span", { className: "text-[10px] text-slate-400 font-mono", children: "Triage Notes" })] }), _jsxs("div", { children: [_jsx("span", { className: "block text-[11px] font-bold text-slate-500 mb-1.5", children: "\u0627\u062E\u062A\u0635\u0627\u0631\u0627\u062A \u0633\u0631\u064A\u0639\u0629 \u0644\u0644\u0623\u0639\u0631\u0627\u0636 \u0627\u0644\u0634\u0627\u0626\u0639\u0629:" }), _jsx("div", { className: "flex flex-wrap gap-1", children: COMMON_SYMPTOMS.map((symptom) => (_jsxs("button", { type: "button", onClick: () => handleAppendSymptom(symptom), className: "text-[11px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 transition-colors", children: ["+ ", symptom] }, symptom))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u0627\u0644\u0634\u0643\u0648\u0649 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629 \u0644\u0644\u0645\u0631\u064A\u0636 (Chief Complaint)" }), _jsx("textarea", { rows: 2, value: chiefComplaint, onChange: (e) => setChiefComplaint(e.target.value), placeholder: "\u0627\u0643\u062A\u0628 \u0634\u0643\u0648\u0649 \u0627\u0644\u0645\u0631\u064A\u0636 \u0623\u0648 \u0633\u0628\u0628 \u0627\u0644\u062D\u0636\u0648\u0631 \u0627\u0644\u064A\u0648\u0645...", className: "w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-bold text-slate-600 mb-1", children: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u062A\u0645\u0631\u064A\u0636\u064A\u0629 \u0625\u0636\u0627\u0641\u064A\u0629 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)" }), _jsx("textarea", { rows: 2, value: nurseNotes, onChange: (e) => setNurseNotes(e.target.value), placeholder: "\u0623\u064A \u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629 \u0644\u0644\u0637\u0628\u064A\u0628 \u0627\u0644\u0645\u0639\u0627\u0644\u062C...", className: "w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" })] })] })] }), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm", children: [_jsxs("div", { className: "text-xs text-slate-500 flex items-center gap-2", children: [_jsx("span", { children: "\u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u0633\u062C\u0644:" }), _jsxs("span", { className: "font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded", children: ["v", currentVersion] }), _jsx("span", { className: "text-[11px] text-slate-400", children: "(\u0645\u0632\u0627\u0645\u0646\u0629 \u0644\u0645\u0646\u0639 \u0627\u0644\u062A\u0639\u0627\u0631\u0636)" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Button, { type: "button", variant: "outline", disabled: isSavingDraft || isCompleting, onClick: () => handleSave(false), className: "text-xs border-slate-300 text-slate-700 hover:bg-slate-50", children: [_jsx(Save, { className: "w-3.5 h-3.5 ml-1" }), isSavingDraft ? 'جاري الحفظ...' : 'حفظ كمسودة'] }), _jsxs(Button, { type: "button", variant: "primary", disabled: isSavingDraft || isCompleting, onClick: () => handleSave(true), className: "text-xs font-bold bg-teal-600 hover:bg-teal-700 shadow-sm", children: [_jsx(CheckCircle, { className: "w-4 h-4 ml-1.5" }), isCompleting ? 'جاري الإرسال...' : 'إتمام الفحص وجاهز للطبيب'] })] })] })] }));
}
