import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { RotateCcw, AlertCircle, AlertTriangle } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { formatEgp, parseEgpToPiastres, piastresToEgpNumber } from '../../lib/currency';
import { treasuryService } from '../../services/treasuryService';
import { ApiException } from '../../lib/api';
export function RefundModal({ isOpen, onClose, invoice, onRefundProcessed, }) {
    const [amountEgp, setAmountEgp] = useState('');
    const [reason, setReason] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const maxRefundablePiastres = invoice
        ? Math.max(0, invoice.paidPiastres - (invoice.refundedPiastres || 0))
        : 0;
    const maxRefundableEgp = piastresToEgpNumber(maxRefundablePiastres);
    useEffect(() => {
        if (invoice && isOpen) {
            setAmountEgp(maxRefundableEgp.toString());
            setReason('');
            setPaymentMethod('Cash');
            setError(null);
        }
    }, [invoice, isOpen, maxRefundableEgp]);
    if (!invoice)
        return null;
    const currentPiastres = parseEgpToPiastres(amountEgp || '0');
    const isValidAmount = currentPiastres > 0 && currentPiastres <= maxRefundablePiastres;
    const isValidReason = reason.trim().length >= 3;
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isValidAmount) {
            setError(`المبلغ يجب أن يكون أكبر من 0 ولا يتجاوز المبلغ القابل للاسترجاع (${formatEgp(maxRefundablePiastres)})`);
            return;
        }
        if (!isValidReason) {
            setError('يرجى توضيح سبب الاسترجاع بشكل كافٍ (3 أحرف على الأقل)');
            return;
        }
        setError(null);
        setIsSubmitting(true);
        try {
            const result = await treasuryService.refundInvoice(invoice.id, {
                amountPiastres: currentPiastres,
                reason: reason.trim(),
                paymentMethod,
                version: invoice.version,
            });
            onRefundProcessed(result);
            onClose();
        }
        catch (err) {
            if (err instanceof ApiException) {
                setError(err.message);
            }
            else {
                setError('حدث خطأ أثناء معالجة الاسترجاع. يرجى المحاولة مرة أخرى.');
            }
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (_jsx(Dialog, { isOpen: isOpen, onClose: onClose, title: "\u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0645\u0627\u0644\u064A (Refund)", description: `استرجاع مالي للفاتورة #${invoice.id} - المريض: ${invoice.patientName}`, maxWidth: "md", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2", children: [_jsx(AlertTriangle, { className: "w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("div", { className: "font-semibold", children: "\u0642\u064A\u062F \u0627\u0644\u0623\u0645\u0627\u0646 \u0627\u0644\u0645\u0627\u0644\u064A \u0627\u0644\u0635\u0627\u0631\u0645:" }), _jsx("div", { className: "text-amber-700 mt-0.5", children: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0645\u0628\u0644\u063A \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u0645\u0633\u062F\u062F \u0641\u0639\u0644\u064A\u0627\u064B. \u0633\u064A\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u062D\u0631\u0643\u0629 \u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0645\u0627\u0644\u064A\u0629 \u0648\u062E\u0635\u0645\u0647\u0627 \u0645\u0646 \u0627\u0644\u062E\u0632\u064A\u0646\u0629." })] })] }), _jsxs("div", { className: "bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-slate-600", children: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0633\u062F\u062F:" }), _jsx("span", { className: "font-semibold text-emerald-600", children: _jsx("bdi", { dir: "ltr", children: formatEgp(invoice.paidPiastres) }) })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-slate-600", children: "\u0627\u0644\u0645\u0633\u062A\u0631\u062C\u0639 \u0633\u0627\u0628\u0642\u0627\u064B:" }), _jsx("span", { className: "font-semibold text-rose-600", children: _jsx("bdi", { dir: "ltr", children: formatEgp(invoice.refundedPiastres || 0) }) })] }), _jsxs("div", { className: "flex justify-between items-center pt-1 border-t border-slate-200 font-bold", children: [_jsx("span", { className: "text-slate-800", children: "\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0627\u0644\u0645\u062A\u0627\u062D \u0644\u0644\u0627\u0633\u062A\u0631\u062C\u0627\u0639:" }), _jsx("span", { className: "text-sky-700", children: _jsx("bdi", { dir: "ltr", children: formatEgp(maxRefundablePiastres) }) })] })] }), error && (_jsxs("div", { className: "p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("span", { children: error })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1.5", children: "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u0633\u062A\u0631\u062C\u0639 (\u062C.\u0645) *" }), _jsxs("div", { className: "relative", children: [_jsx(Input, { type: "number", step: "any", min: "1", max: maxRefundableEgp, value: amountEgp, onChange: (e) => setAmountEgp(e.target.value), placeholder: "0.00", required: true, className: "text-lg font-bold pl-12 text-rose-700" }), _jsx("div", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400", children: "\u062C.\u0645" })] }), _jsx("div", { className: "flex gap-2 mt-2", children: _jsxs("button", { type: "button", onClick: () => setAmountEgp(maxRefundableEgp.toString()), className: "text-[11px] px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-md border border-rose-200 font-medium", children: ["\u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0643\u0627\u0645\u0644 \u0627\u0644\u0645\u0628\u0644\u063A (", maxRefundableEgp, " \u062C.\u0645)"] }) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1.5", children: "\u0637\u0631\u064A\u0642\u0629 \u0631\u062F \u0627\u0644\u0645\u0628\u0644\u063A *" }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: [
                                { id: 'Cash', label: 'نقداً من الدرج (كاش)' },
                                { id: 'Instapay', label: 'تحويل انستاباي' },
                                { id: 'VodafoneCash', label: 'فودافون كاش' },
                                { id: 'Card', label: 'رد على البطاقة' },
                            ].map((m) => (_jsx("button", { type: "button", onClick: () => setPaymentMethod(m.id), className: `p-2 rounded-lg border text-xs font-medium text-right transition-all ${paymentMethod === m.id
                                    ? 'border-rose-500 bg-rose-50/70 text-rose-900 font-bold'
                                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`, children: m.label }, m.id))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1.5", children: "\u0633\u0628\u0628 \u0627\u0644\u0627\u0633\u062A\u0631\u062C\u0627\u0639 (\u0625\u0644\u0632\u0627\u0645\u064A \u0644\u0644\u062A\u062F\u0642\u064A\u0642 \u0627\u0644\u0645\u0627\u0644\u064A) *" }), _jsx(Input, { type: "text", value: reason, onChange: (e) => setReason(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0643\u0634\u0641 \u0644\u0639\u062F\u0645 \u062D\u0636\u0648\u0631 \u0627\u0644\u0637\u0628\u064A\u0628\u060C \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062D\u0633\u0627\u0628...", required: true, className: "text-xs" })] }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-slate-100", children: [_jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: onClose, disabled: isSubmitting, children: "\u0625\u0644\u063A\u0627\u0621" }), _jsxs(Button, { type: "submit", variant: "danger", size: "sm", disabled: isSubmitting || !isValidAmount || !isValidReason || maxRefundablePiastres <= 0, className: "gap-1.5", children: [_jsx(RotateCcw, { className: "w-4 h-4" }), isSubmitting ? 'جاري الاسترجاع...' : 'تأكيد الاسترجاع المالي'] })] })] }) }));
}
