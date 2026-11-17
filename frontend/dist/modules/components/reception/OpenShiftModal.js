import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Unlock, AlertCircle } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { parseEgpToPiastres } from '../../lib/currency';
import { api, ApiException } from '../../lib/api';
export function OpenShiftModal({ isOpen, onClose, onShiftOpened }) {
    const [openingBalanceEgp, setOpeningBalanceEgp] = useState('0');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            const balancePiastres = parseEgpToPiastres(openingBalanceEgp);
            const newShift = await api.post('/shifts/open', {
                openingBalancePiastres: balancePiastres,
                notes: notes.trim() || undefined,
            });
            onShiftOpened(newShift);
            onClose();
        }
        catch (err) {
            if (err instanceof ApiException) {
                setError(err.message);
            }
            else {
                setError('حدث خطأ أثناء فتح الوردية. يرجى المحاولة مرة أخرى.');
            }
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (_jsx(Dialog, { isOpen: isOpen, onClose: onClose, title: "\u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0639\u0647\u062F\u0629 \u0648\u0641\u062A\u062D \u0648\u0631\u062F\u064A\u0629 \u062C\u062F\u064A\u062F\u0629", description: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0646\u0642\u062F\u064A \u0627\u0644\u0645\u062A\u0648\u0627\u062C\u062F \u0641\u064A \u062F\u0631\u062C \u0627\u0644\u062E\u0632\u064A\u0646\u0629 \u0639\u0646\u062F \u0628\u062F\u0621 \u0627\u0644\u0648\u0631\u062F\u064A\u0629.", maxWidth: "md", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [error && (_jsxs("div", { className: "p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("span", { children: error })] })), _jsxs("div", { children: [_jsx(Input, { id: "openingBalance", label: "\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0627\u0641\u062A\u062A\u0627\u062D\u064A \u0628\u0627\u0644\u062F\u0631\u062C (\u062C\u0646\u064A\u0647 \u0645\u0635\u0631\u064A)", type: "number", step: "0.5", min: "0", value: openingBalanceEgp, onChange: (e) => setOpeningBalanceEgp(e.target.value), required: true, autoFocus: true, className: "text-lg font-bold text-center tracking-wide", placeholder: "0.00" }), _jsx("p", { className: "text-[11px] text-slate-500 mt-1", children: "* \u064A\u062A\u0645 \u062D\u0641\u0638 \u0648\u062A\u062F\u0642\u064A\u0642 \u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u0628\u0627\u0644\u063A \u0628\u0627\u0644\u0642\u0631\u0634 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u0644\u062A\u0641\u0627\u062F\u064A \u0623\u064A \u0641\u0631\u0648\u0642\u0627\u062A \u062A\u0642\u0631\u064A\u0628." })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "notes", className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)" }), _jsx("textarea", { id: "notes", rows: 2, value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: \u0627\u0633\u062A\u0644\u0627\u0645 \u0641\u0643\u0629 \u0645\u0646 \u0648\u0631\u062F\u064A\u0629 \u0627\u0644\u0635\u0628\u0627\u062D...", className: "flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" })] }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-slate-100", children: [_jsx(Button, { type: "button", variant: "secondary", onClick: onClose, disabled: isSubmitting, children: "\u0625\u0644\u063A\u0627\u0621" }), _jsxs(Button, { type: "submit", variant: "primary", disabled: isSubmitting, children: [_jsx(Unlock, { className: "w-4 h-4 ml-1" }), isSubmitting ? 'جاري الفتح...' : 'فتح الوردية وتفعيل النظام'] })] })] }) }));
}
