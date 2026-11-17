import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
export function Dialog({ isOpen, onClose, title, description, children, className, maxWidth = 'md', }) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);
    if (!isOpen)
        return null;
    const maxWidthClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
    };
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200", children: [_jsx("div", { className: "fixed inset-0", onClick: onClose, "aria-hidden": "true" }), _jsxs("div", { role: "dialog", "aria-modal": "true", className: cn('relative z-10 w-full overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all border border-slate-100', maxWidthClasses[maxWidth], className), children: [_jsx("button", { onClick: onClose, className: "absolute top-4 left-4 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors", "aria-label": "\u0625\u063A\u0644\u0627\u0642", children: _jsx(X, { className: "w-5 h-5" }) }), title && (_jsxs("div", { className: "mb-4 text-right", children: [_jsx("h3", { className: "text-lg font-bold text-slate-900", children: title }), description && _jsx("p", { className: "mt-1 text-xs text-slate-500", children: description })] })), _jsx("div", { className: "text-right", children: children })] })] }));
}
