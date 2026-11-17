import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, FileCheck, RotateCcw, Download, Users, Pill, } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { importService } from '../../services/importService';
import { ApiException } from '../../lib/api';
export function DataImportTab() {
    const [mode, setMode] = useState('Patients');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [committing, setCommitting] = useState(false);
    // Previews
    const [patientPreview, setPatientPreview] = useState(null);
    const [drugPreview, setDrugPreview] = useState(null);
    // Result
    const [importResult, setImportResult] = useState(null);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const handleDragLeave = () => {
        setIsDragging(false);
    };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelected(e.dataTransfer.files[0]);
        }
    };
    const handleFileInputChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelected(e.target.files[0]);
        }
    };
    const handleFileSelected = async (file) => {
        if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
            setError('يرجى اختيار ملف بصيغة CSV صالحة.');
            return;
        }
        setSelectedFile(file);
        setError(null);
        setImportResult(null);
        setLoadingPreview(true);
        try {
            if (mode === 'Patients') {
                const preview = await importService.previewPatientImport(file);
                setPatientPreview(preview);
            }
            else {
                const preview = await importService.previewDrugImport(file);
                setDrugPreview(preview);
            }
        }
        catch (err) {
            if (err instanceof ApiException) {
                setError(err.message);
            }
            else {
                setError('تعذر قراءة ملف CSV أو معالجته. تحقق من توافق الأعمدة.');
            }
        }
        finally {
            setLoadingPreview(false);
        }
    };
    const handleCommit = async () => {
        if (!selectedFile)
            return;
        setCommitting(true);
        setError(null);
        try {
            let result;
            if (mode === 'Patients') {
                result = await importService.commitPatientImport(selectedFile);
            }
            else {
                result = await importService.commitDrugImport(selectedFile);
            }
            setImportResult(result);
        }
        catch (err) {
            if (err instanceof ApiException) {
                setError(err.message);
            }
            else {
                setError('حدث خطأ أثناء حفظ البيانات المستوردة.');
            }
        }
        finally {
            setCommitting(false);
        }
    };
    const resetImport = () => {
        setSelectedFile(null);
        setPatientPreview(null);
        setDrugPreview(null);
        setImportResult(null);
        setError(null);
        if (fileInputRef.current)
            fileInputRef.current.value = '';
    };
    const downloadSampleTemplate = () => {
        let csvContent = '';
        let filename = '';
        if (mode === 'Patients') {
            csvContent = 'FullName,Phone,NationalId,Gender,BirthDate,Address,MedicalNotes\n' +
                'أحمد محمد محمود,01012345678,29001011234567,Male,1990-05-15,القاهرة - المعادي,حساسية بنسلين\n' +
                'سارة إبراهيم حسن,01198765432,29502021234568,Female,1995-10-20,الجيزة - الدقي,\n';
            filename = 'patients_template.csv';
        }
        else {
            csvContent = 'TradeName,ActiveIngredients,Category,Form,Strength,DefaultDosage,PriceEgp\n' +
                'Panadol Extra,Paracetamol + Caffeine,Analgesic,Tablet,500mg/65mg,1 tab every 8h,45.00\n' +
                'Augmentin,Amoxicillin + Clavulanate,Antibiotic,Tablet,1g,1 tab every 12h,120.00\n';
            filename = 'drugs_template.csv';
        }
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "flex gap-2 p-1 bg-slate-100 rounded-xl w-fit", children: [_jsxs("button", { type: "button", onClick: () => {
                            setMode('Patients');
                            resetImport();
                        }, className: `flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'Patients'
                            ? 'bg-white text-sky-800 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'}`, children: [_jsx(Users, { className: "w-4 h-4" }), _jsx("span", { children: "\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0645\u0631\u0636\u0649 (Patients)" })] }), _jsxs("button", { type: "button", onClick: () => {
                            setMode('Drugs');
                            resetImport();
                        }, className: `flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'Drugs'
                            ? 'bg-white text-sky-800 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'}`, children: [_jsx(Pill, { className: "w-4 h-4" }), _jsx("span", { children: "\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u062F\u0644\u064A\u0644 \u0627\u0644\u0623\u062F\u0648\u064A\u0629 (Drugs)" })] })] }), error && (_jsxs("div", { className: "p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("span", { children: error })] })), importResult && (_jsxs("div", { className: "p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs space-y-2", children: [_jsxs("div", { className: "flex items-center gap-2 font-bold text-sm text-emerald-800", children: [_jsx(CheckCircle2, { className: "w-5 h-5 text-emerald-600 flex-shrink-0" }), _jsx("span", { children: importResult.message || 'تم إتمام عملية الاستيراد بنجاح!' })] }), _jsxs("div", { className: "flex gap-4 text-emerald-700", children: [_jsxs("span", { children: ["\u0639\u062F\u062F \u0627\u0644\u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0645\u0636\u0627\u0641\u0629: ", _jsx("strong", { children: importResult.importedCount })] }), importResult.errorsCount > 0 && (_jsxs("span", { className: "text-amber-700", children: ["\u0623\u062E\u0637\u0627\u0621 \u0645\u062A\u062C\u0627\u0648\u0632\u0629: ", _jsx("strong", { children: importResult.errorsCount })] }))] }), _jsx("div", { className: "pt-2", children: _jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: resetImport, children: "\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0645\u0644\u0641 \u0622\u062E\u0631" }) })] })), !selectedFile && !importResult && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { onDragOver: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop, className: `border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${isDragging
                            ? 'border-sky-500 bg-sky-50/50'
                            : 'border-slate-300 hover:border-sky-400 bg-white'}`, onClick: () => fileInputRef.current?.click(), children: [_jsx("input", { type: "file", ref: fileInputRef, onChange: handleFileInputChange, accept: ".csv,text/csv", className: "hidden" }), _jsxs("div", { className: "flex flex-col items-center justify-center space-y-3", children: [_jsx("div", { className: "p-3 bg-sky-50 text-sky-600 rounded-full", children: _jsx(UploadCloud, { className: "w-8 h-8" }) }), _jsxs("div", { className: "space-y-1", children: [_jsxs("p", { className: "text-sm font-bold text-slate-800", children: ["\u0627\u0633\u062D\u0628 \u0648\u0623\u0641\u0644\u062A \u0645\u0644\u0641 ", _jsx("bdi", { dir: "ltr", children: "CSV" }), " \u0647\u0646\u0627\u060C \u0623\u0648 \u0627\u0646\u0642\u0631 \u0644\u0644\u062A\u062D\u062F\u064A\u062F"] }), _jsx("p", { className: "text-xs text-slate-400", children: mode === 'Patients'
                                                    ? 'الأعمدة المدعومة: FullName, Phone, NationalId, Gender, BirthDate, Address, MedicalNotes'
                                                    : 'الأعمدة المدعومة: TradeName, ActiveIngredients, Category, Form, Strength, DefaultDosage, PriceEgp' })] })] })] }), _jsxs("div", { className: "flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs", children: [_jsx("span", { className: "text-slate-600", children: "\u062A\u062D\u062A\u0627\u062C \u0644\u0642\u0627\u0644\u0628 \u0625\u0643\u0633\u064A\u0644 \u062C\u0627\u0647\u0632 \u0644\u062A\u0639\u0628\u0626\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A\u061F" }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: downloadSampleTemplate, className: "gap-1.5 h-8 text-xs text-slate-700", children: [_jsx(Download, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u062A\u062D\u0645\u064A\u0644 \u0642\u0627\u0644\u0628 CSV \u0627\u0644\u0646\u0645\u0648\u0630\u062C\u064A" })] })] })] })), selectedFile && !importResult && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2.5 bg-sky-50 text-sky-600 rounded-lg", children: _jsx(FileSpreadsheet, { className: "w-6 h-6" }) }), _jsxs("div", { children: [_jsx("div", { className: "font-bold text-slate-900 text-sm", children: _jsx("bdi", { dir: "ltr", children: selectedFile.name }) }), _jsxs("div", { className: "text-[11px] text-slate-400", children: [(selectedFile.size / 1024).toFixed(1), " KB \u2014 \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629 \u0627\u0644\u0623\u0648\u0644\u064A\u0629 (Dry Run)"] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: resetImport, disabled: committing, className: "gap-1", children: [_jsx(RotateCcw, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0645\u0644\u0641" })] }), _jsxs(Button, { type: "button", variant: "primary", size: "sm", onClick: handleCommit, disabled: committing || loadingPreview, className: "gap-1.5", children: [_jsx(FileCheck, { className: "w-4 h-4" }), _jsx("span", { children: committing ? 'جاري الاستيراد والتسجيل...' : 'تأكيد وحفظ السجلات' })] })] })] }), loadingPreview && (_jsx("div", { className: "p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200 text-xs", children: "\u062C\u0627\u0631\u064A \u0641\u062D\u0635 \u0648\u062A\u062F\u0642\u064A\u0642 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0644\u0641 \u0648\u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629..." })), mode === 'Patients' && patientPreview && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-2", children: [_jsxs("div", { className: "bg-white p-3 rounded-xl border border-slate-200 text-center", children: [_jsx("div", { className: "text-[11px] text-slate-500 font-medium", children: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0635\u0641\u0648\u0641" }), _jsx("div", { className: "text-lg font-bold text-slate-800", children: patientPreview.totalRows })] }), _jsxs("div", { className: "bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-center", children: [_jsx("div", { className: "text-[11px] text-emerald-700 font-medium", children: "\u0633\u062C\u0644\u0627\u062A \u0635\u0627\u0644\u062D\u0629 \u062C\u062F\u064A\u062F\u0629" }), _jsx("div", { className: "text-lg font-bold text-emerald-700", children: patientPreview.validCount })] }), _jsxs("div", { className: "bg-amber-50/70 p-3 rounded-xl border border-amber-200 text-center", children: [_jsx("div", { className: "text-[11px] text-amber-700 font-medium", children: "\u0645\u0631\u0636\u0649 \u0645\u0633\u062C\u0644\u0648\u0646 \u0645\u0633\u0628\u0642\u0627\u064B" }), _jsx("div", { className: "text-lg font-bold text-amber-700", children: patientPreview.duplicateCount })] }), _jsxs("div", { className: "bg-rose-50/70 p-3 rounded-xl border border-rose-200 text-center", children: [_jsx("div", { className: "text-[11px] text-rose-700 font-medium", children: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629" }), _jsx("div", { className: "text-lg font-bold text-rose-700", children: patientPreview.invalidCount })] })] }), _jsx("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: _jsx("div", { className: "overflow-x-auto max-h-80", children: _jsxs("table", { className: "w-full text-right text-xs", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0", children: _jsxs("tr", { children: [_jsx("th", { className: "py-2.5 px-3", children: "#" }), _jsx("th", { className: "py-2.5 px-3", children: "\u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0643\u0627\u0645\u0644" }), _jsx("th", { className: "py-2.5 px-3", children: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641" }), _jsx("th", { className: "py-2.5 px-3", children: "\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0642\u0648\u0645\u064A" }), _jsx("th", { className: "py-2.5 px-3", children: "\u0627\u0644\u0646\u0648\u0639" }), _jsx("th", { className: "py-2.5 px-3", children: "\u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u062F\u0642\u064A\u0642" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: patientPreview.rows.map((row) => (_jsxs("tr", { className: "hover:bg-slate-50/50", children: [_jsx("td", { className: "py-2 px-3 text-slate-400", children: row.rowNumber }), _jsx("td", { className: "py-2 px-3 font-semibold text-slate-800", children: row.fullName }), _jsx("td", { className: "py-2 px-3", children: _jsx("bdi", { dir: "ltr", children: row.phone }) }), _jsx("td", { className: "py-2 px-3 text-slate-500", children: _jsx("bdi", { dir: "ltr", children: row.nationalId || '-' }) }), _jsx("td", { className: "py-2 px-3", children: row.gender === 'Female' ? 'أنثى' : 'ذكر' }), _jsxs("td", { className: "py-2 px-3", children: [row.isValid && !row.isDuplicate && (_jsx(Badge, { variant: "success", children: "\u062C\u0627\u0647\u0632 \u0644\u0644\u0625\u0636\u0627\u0641\u0629" })), row.isDuplicate && (_jsx(Badge, { variant: "warning", children: "\u0645\u0633\u062C\u0644 \u0633\u0627\u0628\u0642\u0627\u064B" })), !row.isValid && (_jsx(Badge, { variant: "danger", children: row.errorMessage || 'خطأ' }))] })] }, row.rowNumber))) })] }) }) })] })), mode === 'Drugs' && drugPreview && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-2", children: [_jsxs("div", { className: "bg-white p-3 rounded-xl border border-slate-200 text-center", children: [_jsx("div", { className: "text-[11px] text-slate-500 font-medium", children: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0623\u062F\u0648\u064A\u0629" }), _jsx("div", { className: "text-lg font-bold text-slate-800", children: drugPreview.totalRows })] }), _jsxs("div", { className: "bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-center", children: [_jsx("div", { className: "text-[11px] text-emerald-700 font-medium", children: "\u0623\u062F\u0648\u064A\u0629 \u062C\u062F\u064A\u062F\u0629" }), _jsx("div", { className: "text-lg font-bold text-emerald-700", children: drugPreview.newCount })] }), _jsxs("div", { className: "bg-sky-50/70 p-3 rounded-xl border border-sky-200 text-center", children: [_jsx("div", { className: "text-[11px] text-sky-700 font-medium", children: "\u062A\u062D\u062F\u064A\u062B \u0623\u0633\u0639\u0627\u0631" }), _jsx("div", { className: "text-lg font-bold text-sky-700", children: drugPreview.updateCount })] }), _jsxs("div", { className: "bg-rose-50/70 p-3 rounded-xl border border-rose-200 text-center", children: [_jsx("div", { className: "text-[11px] text-rose-700 font-medium", children: "\u0628\u064A\u0627\u0646\u0627\u062A \u062E\u0627\u0637\u0626\u0629" }), _jsx("div", { className: "text-lg font-bold text-rose-700", children: drugPreview.invalidCount })] })] }), _jsx("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: _jsx("div", { className: "overflow-x-auto max-h-80", children: _jsxs("table", { className: "w-full text-right text-xs", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0", children: _jsxs("tr", { children: [_jsx("th", { className: "py-2.5 px-3", children: "#" }), _jsx("th", { className: "py-2.5 px-3", children: "\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u062A\u062C\u0627\u0631\u064A (Trade Name)" }), _jsx("th", { className: "py-2.5 px-3", children: "\u0627\u0644\u0645\u0627\u062F\u0629 \u0627\u0644\u0641\u0639\u0627\u0644\u0629" }), _jsx("th", { className: "py-2.5 px-3", children: "\u0627\u0644\u0634\u0643\u0644 \u0627\u0644\u0635\u064A\u062F\u0644\u064A" }), _jsx("th", { className: "py-2.5 px-3", children: "\u0627\u0644\u0633\u0639\u0631" }), _jsx("th", { className: "py-2.5 px-3", children: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0625\u0636\u0627\u0641\u0629" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: drugPreview.rows.map((row) => (_jsxs("tr", { className: "hover:bg-slate-50/50", children: [_jsx("td", { className: "py-2 px-3 text-slate-400", children: row.rowNumber }), _jsx("td", { className: "py-2 px-3 font-semibold text-slate-800", children: _jsx("bdi", { dir: "ltr", children: row.tradeName }) }), _jsx("td", { className: "py-2 px-3 text-slate-600", children: _jsx("bdi", { dir: "ltr", children: row.activeIngredients }) }), _jsx("td", { className: "py-2 px-3 text-slate-500", children: row.form }), _jsx("td", { className: "py-2 px-3 font-bold text-emerald-700", children: _jsxs("bdi", { dir: "ltr", children: [row.priceEgp, " \u062C.\u0645"] }) }), _jsxs("td", { className: "py-2 px-3", children: [row.isValid && row.isNew && (_jsx(Badge, { variant: "success", children: "\u062F\u0648\u0627\u0621 \u062C\u062F\u064A\u062F" })), row.isValid && !row.isNew && (_jsx(Badge, { variant: "info", children: "\u062A\u062D\u062F\u064A\u062B" })), !row.isValid && (_jsx(Badge, { variant: "danger", children: row.errorMessage || 'خطأ' }))] })] }, row.rowNumber))) })] }) }) })] }))] }))] }));
}
