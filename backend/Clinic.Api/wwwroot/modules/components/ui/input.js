import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { cn } from '../../lib/utils';
export const Input = React.forwardRef(({ className, type = 'text', error, label, id, ...props }, ref) => {
    return (_jsxs("div", { className: "w-full space-y-1", children: [label && (_jsx("label", { htmlFor: id, className: "block text-xs font-semibold text-slate-700", children: label })), _jsx("input", { type: type, id: id, ref: ref, className: cn('flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60', error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500', className), ...props }), error && _jsx("p", { className: "text-xs text-rose-600 font-medium", children: error })] }));
});
Input.displayName = 'Input';
