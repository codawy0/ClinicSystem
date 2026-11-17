import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Ban, AlertCircle, AlertTriangle } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { formatEgp } from '../../lib/currency';
import { treasuryService } from '../../services/treasuryService';
import { ApiException, authStorage } from '../../lib/api';
export function VoidInvoiceModal({ isOpen, onClose, invoice, onInvoiceVoided, }) {
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const currentUser = authStorage.getUser();
    const isAuthorized = currentUser?.role === 'Doctor' || currentUser?.role === 'Admin';
    useEffect(() => {
        if (isOpen) {
            setReason('');
            setError(null);
        }
    }, [isOpen]);
    if (!invoice)
        return null;
    const isValidReason = reason.trim().length >= 4;
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isAuthorized) {
            setError('إلغاء الفواتير مقتصر فقط على الطبيب أو المدير الإداري (Admin/Doctor)');
            return;
        }
        if (!isValidReason) {
            setError('يرجى كتابة سبب إداري واضح للإلغاء (4 أحرف على الأقل)');
            return;
        }
        setError(null);
        setIsSubmitting(true);
        try {
            const updated = await treasuryService.voidInvoice(invoice.id, {
                reason: reason.trim(),
                version: invoice.version,
            });
            onInvoiceVoided(updated);
            onClose();
        }
        catch (err) {
            if (err instanceof ApiException) {
                setError(err.message);
            }
            else {
                setError('حدث خطأ أثناء إلغاء الفاتورة. يرجى المحاولة مرة أخرى.');
            }
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (_jsx(Dialog, { isOpen: isOpen, onClose: onClose, title: "\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0646\u0647\u0627\u0626\u064A\u0627\u064B (Void)", description: `إلغاء الفاتورة #${invoice.id} - المريض: ${invoice.patientName}`, maxWidth: "md", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 flex items-start gap-2.5", children: [_jsx(AlertTriangle, { className: "w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" }), _jsxs("div", { className: "space-y-1", children: [_jsx("div", { className: "font-bold text-rose-800", children: "\u062A\u062D\u0630\u064A\u0631 \u0623\u0645\u0627\u0646 \u0645\u0627\u0644\u064A \u0635\u0627\u0631\u0645:" }), _jsxs("div", { className: "text-rose-700 leading-relaxed", children: ["\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0625\u062C\u0631\u0627\u0621 \u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0639\u0646\u0647. \u0633\u064A\u062A\u0645 \u062A\u062D\u0648\u064A\u0644 \u062D\u0627\u0644\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0625\u0644\u0649 ", _jsx("span", { className: "font-bold", children: "\u0645\u0644\u063A\u0627\u0629 (Voided)" }), " \u0648\u0625\u0646\u0634\u0627\u0621 \u062D\u0631\u0643\u0629 \u0639\u0643\u0633\u064A\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0629 \u0641\u064A \u0627\u0644\u062E\u0632\u064A\u0646\u0629 \u0644\u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u0628\u0627\u0644\u063A \u0627\u0644\u0645\u062D\u0635\u0644\u0629."] })] })] }), _jsxs("div", { className: "bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-slate-600", children: "\u0642\u064A\u0645\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0635\u0627\u0641\u064A\u0629:" }), _jsx("span", { className: "font-semibold text-slate-800", children: _jsx("bdi", { dir: "ltr", children: formatEgp(invoice.netTotalPiastres) }) })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-slate-600", children: "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u062D\u0635\u0644 \u0641\u0639\u0644\u064A\u0627\u064B:" }), _jsx("span", { className: "font-semibold text-emerald-600", children: _jsx("bdi", { dir: "ltr", children: formatEgp(invoice.paidPiastres) }) })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-slate-600", children: "\u0627\u0644\u0645\u062A\u0628\u0642\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0644:" }), _jsx("span", { className: "font-semibold text-rose-600", children: _jsx("bdi", { dir: "ltr", children: formatEgp(invoice.remainingPiastres) }) })] })] }), error && (_jsxs("div", { className: "p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("span", { children: error })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1.5", children: "\u0633\u0628\u0628 \u0627\u0644\u0625\u0644\u063A\u0627\u0621 (\u0625\u0644\u0632\u0627\u0645\u064A \u0644\u0644\u062A\u062F\u0642\u064A\u0642 \u0627\u0644\u0645\u0627\u0644\u064A) *" }), _jsx(Input, { type: "text", value: reason, onChange: (e) => setReason(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: \u062A\u0633\u062C\u064A\u0644 \u062E\u0627\u0637\u0626 \u0644\u0645\u0631\u064A\u0636 \u0622\u062E\u0631\u060C \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062E\u062F\u0645\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0642\u0628\u0644 \u0627\u0644\u0628\u062F\u0621...", required: true, className: "text-xs" })] }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-slate-100", children: [_jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: onClose, disabled: isSubmitting, children: "\u062A\u0631\u0627\u062C\u0639" }), _jsxs(Button, { type: "submit", variant: "danger", size: "sm", disabled: isSubmitting || !isValidReason || !isAuthorized, className: "gap-1.5", children: [_jsx(Ban, { className: "w-4 h-4" }), isSubmitting ? 'جاري الإلغاء...' : 'تأكيد إلغاء الفاتورة'] })] })] }) }));
}
