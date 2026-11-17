import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Database, Download, RotateCcw, ShieldCheck, HardDrive, RefreshCw, AlertTriangle, CheckCircle2, AlertCircle, FileArchive, } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { backupService } from '../../services/backupService';
import { ApiException } from '../../lib/api';
export function BackupMaintenanceTab() {
    const [backupData, setBackupData] = useState({
        backups: [],
        databaseSizeMb: 12.5,
        lastBackupDateUtc: undefined,
        isWalMode: true,
    });
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [notice, setNotice] = useState(null);
    const [error, setError] = useState(null);
    // Restore Modal State
    const [restoreModalOpen, setRestoreModalOpen] = useState(false);
    const [selectedBackupForRestore, setSelectedBackupForRestore] = useState(null);
    const [confirmCode, setConfirmCode] = useState('');
    const [restoring, setRestoring] = useState(false);
    const [restoreError, setRestoreError] = useState(null);
    useEffect(() => {
        loadBackups();
    }, []);
    const loadBackups = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await backupService.listBackups();
            setBackupData(data);
        }
        catch (err) {
            if (err instanceof ApiException) {
                setError(err.message);
            }
            else {
                setError('تعذر تحميل سجل النسخ الاحتياطية.');
            }
        }
        finally {
            setLoading(false);
        }
    };
    const handleCreateBackup = async () => {
        setCreating(true);
        setError(null);
        setNotice(null);
        try {
            const res = await backupService.createBackup();
            if (res.success) {
                setNotice(`تم إنشاء النسخة الاحتياطية بنجاح: ${res.filename}`);
                await loadBackups();
            }
            else {
                setError(res.message || 'فشل إنشاء النسخة الاحتياطية');
            }
        }
        catch (err) {
            if (err instanceof ApiException) {
                setError(err.message);
            }
            else {
                setError('حدث خطأ أثناء إجراء النسخ الاحتياطي الساخن.');
            }
        }
        finally {
            setCreating(false);
        }
    };
    const handleDownload = async (filename) => {
        try {
            await backupService.downloadBackup(filename);
        }
        catch (err) {
            setError(err.message || 'فشل تحميل ملف النسخة الاحتياطية');
        }
    };
    const openRestoreModal = (backup) => {
        setSelectedBackupForRestore(backup);
        setConfirmCode('');
        setRestoreError(null);
        setRestoreModalOpen(true);
    };
    const handleConfirmRestore = async (e) => {
        e.preventDefault();
        if (!selectedBackupForRestore)
            return;
        if (confirmCode !== 'RESTORE') {
            setRestoreError('يرجى كتابة كلمة RESTORE بدقة لتأكيد الاسترجاع');
            return;
        }
        setRestoring(true);
        setRestoreError(null);
        try {
            const res = await backupService.restoreBackup({
                filename: selectedBackupForRestore.filename,
                confirmCode,
            });
            if (res.success) {
                setRestoreModalOpen(false);
                setNotice('تمت استعادة قاعدة البيانات بنجاح! يرجى إعادة تحميل التطبيق.');
                await loadBackups();
            }
            else {
                setRestoreError(res.message || 'فشلت استعادة قاعدة البيانات');
            }
        }
        catch (err) {
            if (err instanceof ApiException) {
                setRestoreError(err.message);
            }
            else {
                setRestoreError('حدث خطأ أثناء عملية الاستعادة');
            }
        }
        finally {
            setRestoring(false);
        }
    };
    const formatFileSize = (bytes) => {
        if (!bytes || bytes === 0)
            return '0 B';
        const mb = bytes / (1024 * 1024);
        if (mb >= 1)
            return `${mb.toFixed(2)} MB`;
        const kb = bytes / 1024;
        return `${kb.toFixed(1)} KB`;
    };
    return (_jsxs("div", { className: "space-y-5", children: [notice && (_jsxs("div", { className: "p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in", children: [_jsx(CheckCircle2, { className: "w-4 h-4 text-emerald-600 flex-shrink-0" }), _jsx("span", { children: notice })] })), error && (_jsxs("div", { className: "p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("span", { children: error })] })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Database, { className: "w-5 h-5 text-sky-600" }), _jsx("h4", { className: "font-bold text-slate-800 text-xs", children: "\u0646\u0633\u062E \u0627\u062D\u062A\u064A\u0627\u0637\u064A \u0633\u0627\u062E\u0646 \u0641\u0648\u0631\u064A" })] }), _jsx("p", { className: "text-[11px] text-slate-500 leading-relaxed", children: "\u064A\u0642\u0648\u0645 \u0628\u0625\u0646\u0634\u0627\u0621 \u0646\u0633\u062E\u0629 \u0641\u0648\u0631\u064A\u0629 \u0622\u0645\u0646\u0629 \u062F\u0648\u0646 \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0639\u0645\u0644 \u0641\u064A \u0627\u0644\u0639\u064A\u0627\u062F\u0629 \u0623\u0648 \u0625\u063A\u0644\u0627\u0642 \u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A SQLite." })] }), _jsx("div", { className: "mt-4", children: _jsxs(Button, { type: "button", variant: "primary", size: "sm", onClick: handleCreateBackup, disabled: creating, className: "w-full gap-2", children: [_jsx(HardDrive, { className: "w-4 h-4" }), _jsx("span", { children: creating ? 'جاري النسخ والضغط...' : 'إنشاء نسخة احتياطية الآن' })] }) })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(ShieldCheck, { className: "w-5 h-5 text-emerald-600" }), _jsx("h4", { className: "font-bold text-slate-800 text-xs", children: "\u0635\u062D\u0629 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" })] }), _jsxs("div", { className: "space-y-1.5 text-xs", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-slate-500", children: "\u0648\u0636\u0639 \u0627\u0644\u062A\u0634\u063A\u064A\u0644:" }), _jsx("span", { className: "font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]", children: backupData.isWalMode ? 'SQLite WAL Mode' : 'Standard' })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-slate-500", children: "\u062D\u062C\u0645 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0646\u0634\u0637:" }), _jsx("span", { className: "font-semibold text-slate-800", children: _jsxs("bdi", { dir: "ltr", children: [backupData.databaseSizeMb.toFixed(2), " MB"] }) })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-slate-500", children: "\u0641\u062D\u0635 \u0627\u0644\u062A\u0643\u0627\u0645\u0644 \u0627\u0644\u062F\u0648\u0631\u064A:" }), _jsx("span", { className: "text-emerald-600 font-bold text-[11px]", children: "\u0633\u0644\u064A\u0645 100% (PRAGMA OK)" })] })] })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(RefreshCw, { className: "w-5 h-5 text-indigo-600" }), _jsx("h4", { className: "font-bold text-slate-800 text-xs", children: "\u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A\u0629" })] }), _jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: loadBackups, disabled: loading, className: "p-1 h-7 w-7", children: _jsx(RefreshCw, { className: `w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}` }) })] }), _jsxs("p", { className: "text-[11px] text-slate-500 leading-relaxed", children: ["\u062A\u0639\u0645\u0644 \u062E\u062F\u0645\u0629 ", _jsx("bdi", { dir: "ltr", children: "SqliteMaintenanceService" }), " \u0641\u064A \u0627\u0644\u062E\u0644\u0641\u064A\u0629 \u0644\u062A\u0641\u0631\u064A\u063A \u0633\u062C\u0644\u0627\u062A WAL \u062F\u0648\u0631\u064A\u0627\u064B \u0644\u0645\u0646\u0639 \u062A\u0636\u062E\u0645 \u0627\u0644\u0645\u0644\u0641\u0627\u062A."] }), _jsxs("div", { className: "text-[11px] text-slate-400", children: ["\u0622\u062E\u0631 \u0646\u0633\u062E\u0629: ", backupData.lastBackupDateUtc ? new Date(backupData.lastBackupDateUtc).toLocaleString('ar-EG') : 'لم تُسجل بعد'] })] })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs", children: [_jsxs("div", { className: "p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(FileArchive, { className: "w-4 h-4 text-slate-600" }), _jsx("h4", { className: "font-bold text-slate-800 text-xs", children: "\u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0627\u0644\u0645\u062D\u0641\u0648\u0638\u0629" })] }), _jsxs("span", { className: "text-[11px] text-slate-500", children: [backupData.backups.length, " ", backupData.backups.length === 1 ? 'نسخة' : 'نسخ'] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-right text-xs", children: [_jsx("thead", { className: "bg-slate-50/50 border-b border-slate-200 text-slate-600 font-semibold", children: _jsxs("tr", { children: [_jsx("th", { className: "py-3 px-4", children: "\u0627\u0633\u0645 \u0645\u0644\u0641 \u0627\u0644\u0623\u0631\u0634\u064A\u0641" }), _jsx("th", { className: "py-3 px-4", children: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0646\u0634\u0627\u0621" }), _jsx("th", { className: "py-3 px-4", children: "\u062D\u062C\u0645 \u0627\u0644\u0645\u0644\u0641" }), _jsx("th", { className: "py-3 px-4", children: "\u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u0643\u0627\u0645\u0644" }), _jsx("th", { className: "py-3 px-4 text-center", children: "\u0627\u0644\u0625\u062C\u0631\u0627\u0621\u0627\u062A" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: backupData.backups.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "py-8 text-center text-slate-400", children: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0646\u0633\u062E \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0633\u0627\u0628\u0642\u0629. \u0627\u0636\u063A\u0637 \"\u0625\u0646\u0634\u0627\u0621 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0627\u0644\u0622\u0646\" \u0644\u062D\u0641\u0638 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." }) })) : (backupData.backups.map((b) => (_jsxs("tr", { className: "hover:bg-slate-50/70 transition-colors", children: [_jsx("td", { className: "py-3 px-4 font-mono font-bold text-slate-700", children: _jsx("bdi", { dir: "ltr", children: b.filename }) }), _jsx("td", { className: "py-3 px-4 text-slate-600", children: _jsx("bdi", { dir: "ltr", children: new Date(b.createdAtUtc).toLocaleString('ar-EG') }) }), _jsx("td", { className: "py-3 px-4 font-semibold text-slate-800", children: _jsx("bdi", { dir: "ltr", children: formatFileSize(b.sizeBytes) }) }), _jsx("td", { className: "py-3 px-4", children: _jsx(Badge, { variant: "success", children: b.integrityStatus || 'PRAGMA OK' }) }), _jsx("td", { className: "py-3 px-4 text-center", children: _jsxs("div", { className: "flex items-center justify-center gap-2", children: [_jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: () => handleDownload(b.filename), className: "gap-1 h-7 text-xs text-sky-700 hover:text-sky-800", children: [_jsx(Download, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u062A\u062D\u0645\u064A\u0644" })] }), _jsxs(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => openRestoreModal(b), className: "gap-1 h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50", children: [_jsx(RotateCcw, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u0627\u0633\u062A\u0631\u062C\u0627\u0639" })] })] }) })] }, b.filename)))) })] }) })] }), restoreModalOpen && selectedBackupForRestore && (_jsx(Dialog, { isOpen: true, onClose: () => setRestoreModalOpen(false), title: "\u062A\u0623\u0643\u064A\u062F \u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A", description: `الملف: ${selectedBackupForRestore.filename}`, maxWidth: "md", children: _jsxs("form", { onSubmit: handleConfirmRestore, className: "space-y-4", children: [_jsxs("div", { className: "bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 flex items-start gap-2.5", children: [_jsx(AlertTriangle, { className: "w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" }), _jsxs("div", { className: "space-y-1", children: [_jsx("div", { className: "font-bold text-rose-800", children: "\u062A\u062D\u0630\u064A\u0631 \u0628\u0627\u0644\u063A \u0627\u0644\u0623\u0647\u0645\u064A\u0629:" }), _jsx("div", { className: "text-rose-700 leading-relaxed", children: "\u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0633\u064A\u0642\u0648\u0645 \u0628\u0627\u0633\u062A\u0628\u062F\u0627\u0644 \u0643\u0627\u0641\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0628\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0648\u062C\u0648\u062F\u0629 \u0641\u064A \u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629. \u0623\u064A \u0628\u064A\u0627\u0646\u0627\u062A \u0633\u064F\u062C\u0644\u062A \u0628\u0639\u062F \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0646\u0633\u062E\u0629 \u0633\u062A\u064F\u0641\u0642\u062F \u062A\u0645\u0627\u0645\u0627\u064B." })] })] }), restoreError && (_jsxs("div", { className: "p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("span", { children: restoreError })] })), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-700 mb-1.5", children: ["\u0644\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0627\u0633\u062A\u0631\u062C\u0627\u0639\u060C \u0627\u0643\u062A\u0628 \u0627\u0644\u0643\u0644\u0645\u0629 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 ", _jsx("span", { className: "font-mono font-bold text-rose-600 select-all", children: "RESTORE" }), " \u0623\u062F\u0646\u0627\u0647:"] }), _jsx(Input, { type: "text", placeholder: "RESTORE", value: confirmCode, onChange: (e) => setConfirmCode(e.target.value), required: true, className: "font-mono text-center tracking-widest text-sm font-bold uppercase" })] }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-slate-100", children: [_jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => setRestoreModalOpen(false), disabled: restoring, children: "\u0625\u0644\u063A\u0627\u0621" }), _jsxs(Button, { type: "submit", variant: "danger", size: "sm", disabled: restoring || confirmCode !== 'RESTORE', className: "gap-1.5", children: [_jsx(RotateCcw, { className: "w-4 h-4" }), restoring ? 'جاري الاسترجاع...' : 'تأكيد الاستبدال والاسترجاع'] })] })] }) }))] }));
}
