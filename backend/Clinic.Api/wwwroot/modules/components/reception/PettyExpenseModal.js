import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { DollarSign, AlertCircle } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { parseEgpToPiastres } from '../../lib/currency';
import { api, ApiException } from '../../lib/api';
export function PettyExpenseModal({ isOpen, onClose, shiftId, onExpenseRecorded }) {
    const [amountEgp, setAmountEgp] = useState('');
    const [category, setCategory] = useState('نثريات عامة');
    const [description, setDescription] = useState('');
    const [recipient, setRecipient] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amountEgp || parseFloat(amountEgp) <= 0) {
            setError('يرجى إدخال مبلغ صحيح للمصروف');
            return;
        }
        if (!description.trim()) {
            setError('يرجى تحديد سبب/بند المصروف');
            return;
        }
        setError(null);
        setIsSubmitting(true);
        try {
            const amountPiastres = parseEgpToPiastres(amountEgp);
            await api.post('/shifts/expense', {
                shiftId,
                amountPiastres,
                category: category || 'نثريات عامة',
                description: description.trim(),
                recipient: recipient.trim() || undefined,
            });
            onExpenseRecorded();
            onClose();
            setAmountEgp('');
            setCategory('نثريات عامة');
            setDescription('');
            setRecipient('');
        }
        catch (err) {
            if (err instanceof ApiException) {
                setError(err.message);
            }
            else {
                setError('حدث خطأ أثناء تسجيل المصروف. يرجى المحاولة مرة أخرى.');
            }
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (_jsx(Dialog, { isOpen: isOpen, onClose: onClose, title: "\u062A\u0633\u062C\u064A\u0644 \u0645\u0635\u0631\u0648\u0641 \u0646\u062B\u0631\u064A \u0645\u0646 \u0627\u0644\u062F\u0631\u062C", description: "\u0633\u064A\u062A\u0645 \u062E\u0635\u0645 \u0647\u0630\u0627 \u0627\u0644\u0645\u0628\u0644\u063A \u0641\u0648\u0631\u0627\u064B \u0645\u0646 \u0627\u0644\u0646\u0642\u062F\u064A\u0629 \u0627\u0644\u0645\u062A\u0648\u0642\u0639\u0629 \u0628\u0627\u0644\u062F\u0631\u062C \u0645\u0639 \u062A\u0633\u062C\u064A\u0644 \u0625\u064A\u0635\u0627\u0644 \u0635\u0631\u0641.", maxWidth: "md", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [error && (_jsxs("div", { className: "p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("span", { children: error })] })), _jsx("div", { children: _jsx(Input, { id: "expenseAmount", label: "\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u0635\u0631\u0648\u0641 (\u062C\u0646\u064A\u0647 \u0645\u0635\u0631\u064A)", type: "number", step: "0.5", min: "0.5", value: amountEgp, onChange: (e) => setAmountEgp(e.target.value), required: true, autoFocus: true, className: "text-lg font-bold text-center tracking-wide", placeholder: "0.00" }) }), _jsxs("div", { children: [_jsx("label", { htmlFor: "expenseCategory", className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0645\u0635\u0631\u0648\u0641" }), _jsxs("select", { id: "expenseCategory", value: category, onChange: (e) => setCategory(e.target.value), className: "w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-500", children: [_jsx("option", { value: "\u0646\u062B\u0631\u064A\u0627\u062A \u0639\u0627\u0645\u0629", children: "\u0646\u062B\u0631\u064A\u0627\u062A \u0639\u0627\u0645\u0629" }), _jsx("option", { value: "\u0623\u062F\u0648\u0627\u062A \u0648\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A", children: "\u0623\u062F\u0648\u0627\u062A \u0648\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A" }), _jsx("option", { value: "\u0636\u064A\u0627\u0641\u0629 \u0648\u0646\u0638\u0627\u0641\u0629", children: "\u0636\u064A\u0627\u0641\u0629 \u0648\u0646\u0638\u0627\u0641\u0629" }), _jsx("option", { value: "\u0635\u064A\u0627\u0646\u0629 \u0633\u0631\u064A\u0639\u0629", children: "\u0635\u064A\u0627\u0646\u0629 \u0633\u0631\u064A\u0639\u0629" }), _jsx("option", { value: "\u0623\u062E\u0631\u0649", children: "\u0623\u062E\u0631\u0649" })] })] }), _jsx("div", { children: _jsx(Input, { id: "expenseDesc", label: "\u0633\u0628\u0628 / \u0628\u0646\u062F \u0627\u0644\u0635\u0631\u0641", type: "text", value: description, onChange: (e) => setDescription(e.target.value), required: true, placeholder: "\u0645\u062B\u0627\u0644: \u0634\u0631\u0627\u0621 \u0634\u0627\u064A \u0648\u0633\u0643\u0631 \u0644\u0644\u0639\u064A\u0627\u062F\u0629 / \u0646\u0638\u0627\u0641\u0629 / \u0623\u062F\u0648\u0627\u062A \u0645\u0643\u062A\u0628\u064A\u0629..." }) }), _jsx("div", { children: _jsx(Input, { id: "expenseRecipient", label: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u0644\u0645 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)", type: "text", value: recipient, onChange: (e) => setRecipient(e.target.value), placeholder: "\u0627\u0633\u0645 \u0627\u0644\u0634\u062E\u0635 \u0623\u0648 \u0627\u0644\u0639\u0627\u0645\u0644 \u0627\u0644\u0630\u064A \u0627\u0633\u062A\u0644\u0645 \u0627\u0644\u0646\u0642\u062F\u064A\u0629" }) }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-slate-100", children: [_jsx(Button, { type: "button", variant: "secondary", onClick: onClose, disabled: isSubmitting, children: "\u0625\u0644\u063A\u0627\u0621" }), _jsxs(Button, { type: "submit", variant: "primary", disabled: isSubmitting, children: [_jsx(DollarSign, { className: "w-4 h-4 ml-1" }), isSubmitting ? 'جاري التسجيل...' : 'صرف المبلغ وتحديث الدرج'] })] })] }) }));
}
