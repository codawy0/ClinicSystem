import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, DollarSign } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { formatEgp, parseEgpToPiastres, piastresToEgpNumber } from '../../lib/currency';
import { treasuryService } from '../../services/treasuryService';
import { ApiException } from '../../lib/api';
export function PartialPaymentModal({ isOpen, onClose, invoice, onPaymentRecorded, }) {
    const [amountEgp, setAmountEgp] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (invoice && isOpen) {
            // Default to remaining balance
            const remainingEgp = piastresToEgpNumber(invoice.remainingPiastres);
            setAmountEgp(remainingEgp.toString());
            setPaymentMethod('Cash');
            setReferenceNumber('');
            setNotes('');
            setError(null);
        }
    }, [invoice, isOpen]);
    if (!invoice)
        return null;
    const remainingEgp = piastresToEgpNumber(invoice.remainingPiastres);
    const currentPiastres = parseEgpToPiastres(amountEgp || '0');
    const isValidAmount = currentPiastres > 0 && currentPiastres <= invoice.remainingPiastres;
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isValidAmount) {
            setError(`المبلغ يجب أن يكون أكبر من 0 ولا يتجاوز المبلغ المتبقي (${formatEgp(invoice.remainingPiastres)})`);
            return;
        }
        setError(null);
        setIsSubmitting(true);
        try {
            const updated = await treasuryService.recordPayment(invoice.id, {
                amountPiastres: currentPiastres,
                paymentMethod,
                referenceNumber: referenceNumber.trim() || undefined,
                notes: notes.trim() || undefined,
                version: invoice.version,
            });
            onPaymentRecorded(updated);
            onClose();
        }
        catch (err) {
            if (err instanceof ApiException) {
                setError(err.message);
            }
            else {
                setError('حدث خطأ أثناء تسجيل السداد. يرجى المحاولة مرة أخرى.');
            }
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (_jsx(Dialog, { isOpen: isOpen, onClose: onClose, title: "\u062A\u0633\u062C\u064A\u0644 \u0633\u062F\u0627\u062F / \u0642\u0633\u0637 \u0645\u0627\u0644\u064A", description: `فاتورة رقم #${invoice.id} - المريض: ${invoice.patientName}`, maxWidth: "md", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-slate-600", children: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629:" }), _jsx("span", { className: "font-semibold text-slate-800", children: _jsx("bdi", { dir: "ltr", children: formatEgp(invoice.totalPiastres) }) })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-slate-600", children: "\u0627\u0644\u0645\u0633\u062F\u062F \u0633\u0627\u0628\u0642\u0627\u064B:" }), _jsx("span", { className: "font-semibold text-emerald-600", children: _jsx("bdi", { dir: "ltr", children: formatEgp(invoice.paidPiastres) }) })] }), _jsxs("div", { className: "flex justify-between items-center pt-1 border-t border-slate-200 text-sm font-bold", children: [_jsx("span", { className: "text-slate-800", children: "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u062A\u0628\u0642\u064A:" }), _jsx("span", { className: "text-rose-600", children: _jsx("bdi", { dir: "ltr", children: formatEgp(invoice.remainingPiastres) }) })] })] }), error && (_jsxs("div", { className: "p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("span", { children: error })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1.5", children: "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u0631\u0627\u062F \u0633\u062F\u0627\u062F\u0647 (\u062C.\u0645) *" }), _jsxs("div", { className: "relative", children: [_jsx(Input, { type: "number", step: "any", min: "1", max: remainingEgp, value: amountEgp, onChange: (e) => setAmountEgp(e.target.value), placeholder: "0.00", required: true, className: "text-lg font-bold pl-12" }), _jsx("div", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400", children: "\u062C.\u0645" })] }), _jsxs("div", { className: "flex gap-2 mt-2", children: [_jsxs("button", { type: "button", onClick: () => setAmountEgp(remainingEgp.toString()), className: "text-[11px] px-2.5 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-md border border-sky-200 font-medium", children: ["\u0643\u0627\u0645\u0644 \u0627\u0644\u0645\u062A\u0628\u0642\u064A (", remainingEgp, " \u062C.\u0645)"] }), remainingEgp > 50 && (_jsxs("button", { type: "button", onClick: () => setAmountEgp((remainingEgp / 2).toFixed(2)), className: "text-[11px] px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md border border-slate-200 font-medium", children: ["\u0627\u0644\u0646\u0635\u0641 (", (remainingEgp / 2).toFixed(2), " \u062C.\u0645)"] }))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1.5", children: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639 *" }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: [
                                { id: 'Cash', label: 'نقدي (كاش)' },
                                { id: 'Instapay', label: 'انستاباي (Instapay)' },
                                { id: 'VodafoneCash', label: 'فودافون كاش' },
                                { id: 'Card', label: 'بطاقة دفع (Card)' },
                            ].map((m) => (_jsxs("button", { type: "button", onClick: () => setPaymentMethod(m.id), className: `flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition-all ${paymentMethod === m.id
                                    ? 'border-sky-500 bg-sky-50/70 text-sky-900 font-bold shadow-xs'
                                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`, children: [_jsx("span", { children: m.label }), paymentMethod === m.id && _jsx(CheckCircle, { className: "w-3.5 h-3.5 text-sky-600" })] }, m.id))) })] }), paymentMethod !== 'Cash' && (_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1.5", children: "\u0631\u0642\u0645 \u0627\u0644\u0639\u0645\u0644\u064A\u0629 / \u0627\u0644\u0645\u0631\u062C\u0639 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A" }), _jsx(Input, { type: "text", value: referenceNumber, onChange: (e) => setReferenceNumber(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: \u0631\u0642\u0645 \u062A\u062D\u0648\u064A\u0644 \u0627\u0646\u0633\u062A\u0627\u0628\u0627\u064A \u0623\u0648 \u0625\u064A\u0635\u0627\u0644 \u0641\u0648\u062F\u0627\u0641\u0648\u0646 \u0643\u0627\u0634", className: "text-xs" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1.5", children: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)" }), _jsx(Input, { type: "text", value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u062D\u0648\u0644 \u0627\u0644\u062F\u0641\u0639\u0629...", className: "text-xs" })] }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-slate-100", children: [_jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: onClose, disabled: isSubmitting, children: "\u0625\u0644\u063A\u0627\u0621" }), _jsxs(Button, { type: "submit", variant: "primary", size: "sm", disabled: isSubmitting || !isValidAmount, className: "gap-1.5", children: [_jsx(DollarSign, { className: "w-4 h-4" }), isSubmitting ? 'جاري التسجيل...' : 'تأكيد تسجيل السداد'] })] })] }) }));
}
