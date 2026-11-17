import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { LogOut, AlertCircle, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { formatEgp, parseEgpToPiastres } from '../../lib/currency';
import { api, ApiException } from '../../lib/api';
export function CloseShiftModal({ isOpen, onClose, currentShift, onShiftClosed }) {
    const [actualCashEgp, setActualCashEgp] = useState('');
    const [closingNotes, setClosingNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    if (!currentShift)
        return null;
    const actualPiastres = parseEgpToPiastres(actualCashEgp);
    const expectedPiastres = currentShift.expectedClosingCashPiastres;
    const differencePiastres = actualCashEgp === '' ? 0 : actualPiastres - expectedPiastres;
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (actualCashEgp === '') {
            setError('يرجى إدخال المبلغ الفعلي الموجود بالدرج بعد الجرد');
            return;
        }
        setError(null);
        setIsSubmitting(true);
        try {
            await api.post('/shifts/close', {
                shiftId: currentShift.shiftId || currentShift.id,
                actualClosingCashPiastres: actualPiastres,
                closingNotes: closingNotes.trim() || undefined,
                version: currentShift.version,
            });
            onShiftClosed();
            onClose();
        }
        catch (err) {
            if (err instanceof ApiException) {
                setError(err.message);
            }
            else {
                setError('حدث خطأ أثناء إغلاق الوردية. يرجى إعادة المحاولة.');
            }
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (_jsx(Dialog, { isOpen: isOpen, onClose: onClose, title: "\u062C\u0631\u062F \u0627\u0644\u062E\u0632\u064A\u0646\u0629 \u0648\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0648\u0631\u062F\u064A\u0629", description: `الوردية رقم #${currentShift.id} - تاريخ العمل: ${currentShift.businessDate}`, maxWidth: "md", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [error && (_jsxs("div", { className: "p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("span", { children: error })] })), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs", children: [_jsxs("div", { className: "p-2.5 bg-slate-50 border border-slate-200 rounded-lg", children: [_jsx("span", { className: "text-slate-500 block", children: "\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0627\u0641\u062A\u062A\u0627\u062D\u064A:" }), _jsx("strong", { className: "text-slate-800 text-sm", children: formatEgp(currentShift.openingBalancePiastres) })] }), _jsxs("div", { className: "p-2.5 bg-slate-50 border border-slate-200 rounded-lg", children: [_jsx("span", { className: "text-slate-500 block", children: "\u0645\u0642\u0628\u0648\u0636\u0627\u062A \u0646\u0642\u062F\u064A\u0629:" }), _jsxs("strong", { className: "text-emerald-700 text-sm", children: ["+", formatEgp(currentShift.cashPaymentsPiastres)] })] }), _jsxs("div", { className: "p-2.5 bg-slate-50 border border-slate-200 rounded-lg", children: [_jsx("span", { className: "text-slate-500 block", children: "\u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0646\u062B\u0631\u064A\u0629:" }), _jsxs("strong", { className: "text-rose-700 text-sm", children: ["-", formatEgp(currentShift.cashExpensesPiastres)] })] }), _jsxs("div", { className: "p-2.5 bg-sky-50 border border-sky-200 rounded-lg", children: [_jsx("span", { className: "text-sky-700 block font-semibold", children: "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0646\u0642\u062F\u064A \u0627\u0644\u0645\u062D\u0633\u0648\u0628 \u0628\u0627\u0644\u062F\u0631\u062C:" }), _jsx("strong", { className: "text-sky-900 text-sm", children: formatEgp(expectedPiastres) })] })] }), _jsx("div", { children: _jsx(Input, { id: "actualCash", label: "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0641\u0639\u0644\u064A \u0628\u0627\u0644\u062F\u0631\u062C \u0628\u0639\u062F \u0627\u0644\u0639\u062F (\u062C\u0646\u064A\u0647 \u0645\u0635\u0631\u064A)", type: "number", step: "0.5", min: "0", value: actualCashEgp, onChange: (e) => setActualCashEgp(e.target.value), required: true, autoFocus: true, className: "text-lg font-bold text-center tracking-wide", placeholder: "0.00" }) }), actualCashEgp !== '' && (_jsxs("div", { className: `p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${differencePiastres === 0
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : differencePiastres < 0
                            ? 'bg-rose-50 border-rose-300 text-rose-800'
                            : 'bg-blue-50 border-blue-300 text-blue-800'}`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [differencePiastres === 0 ? (_jsx(CheckCircle2, { className: "w-5 h-5 text-emerald-600" })) : differencePiastres < 0 ? (_jsx(TrendingDown, { className: "w-5 h-5 text-rose-600" })) : (_jsx(TrendingUp, { className: "w-5 h-5 text-blue-600" })), _jsx("span", { children: differencePiastres === 0
                                        ? 'الخزينة مطابقة تماماً للمحسوب'
                                        : differencePiastres < 0
                                            ? 'يوجد عجز نقدي في الدرج'
                                            : 'يوجد زيادة نقدية في الدرج' })] }), _jsx("span", { className: "text-sm font-bold dir-ltr", children: formatEgp(Math.abs(differencePiastres)) })] })), _jsxs("div", { children: [_jsx("label", { htmlFor: "closingNotes", className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0625\u063A\u0644\u0627\u0642 \u0648\u0627\u0644\u062A\u0633\u0648\u064A\u0629 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)" }), _jsx("textarea", { id: "closingNotes", rows: 2, value: closingNotes, onChange: (e) => setClosingNotes(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: \u062A\u0645 \u062A\u0633\u0644\u064A\u0645 \u0627\u0644\u0646\u0642\u062F\u064A\u0629 \u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u064A\u0627\u062F\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644...", className: "flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" })] }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-slate-100", children: [_jsx(Button, { type: "button", variant: "secondary", onClick: onClose, disabled: isSubmitting, children: "\u0625\u0644\u063A\u0627\u0621" }), _jsxs(Button, { type: "submit", variant: "danger", disabled: isSubmitting, children: [_jsx(LogOut, { className: "w-4 h-4 ml-1" }), isSubmitting ? 'جاري الإغلاق...' : 'تأكيد الجرد وإغلاق الوردية'] })] })] }) }));
}
