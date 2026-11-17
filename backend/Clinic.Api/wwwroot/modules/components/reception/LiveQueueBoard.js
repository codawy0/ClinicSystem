import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { CalendarClock, Clock, Activity, Stethoscope, UserX, CheckCircle2, RotateCcw, Sparkles, ArrowRight, CreditCard, } from 'lucide-react';
import { formatEgp } from '../../lib/currency';
import { Button } from '../ui/button';
export function LiveQueueBoard({ queueItems, onCheckIn, onToggleUrgent, onSkip, onRecall, onSettle, }) {
    const columns = [
        {
            status: 'Booked',
            title: 'حجوزات مسبقة لم تحضر',
            icon: _jsx(CalendarClock, { className: "w-4 h-4 text-slate-600" }),
            bgHeader: 'bg-slate-100/90 text-slate-800',
            badgeColor: 'bg-slate-200 text-slate-800',
        },
        {
            status: 'Waiting',
            title: 'في صالة الانتظار',
            icon: _jsx(Clock, { className: "w-4 h-4 text-sky-600" }),
            bgHeader: 'bg-sky-50 text-sky-900',
            badgeColor: 'bg-sky-200 text-sky-900',
        },
        {
            status: 'InNursing',
            title: 'في التمريض (قياسات)',
            icon: _jsx(Activity, { className: "w-4 h-4 text-purple-600" }),
            bgHeader: 'bg-purple-50 text-purple-900',
            badgeColor: 'bg-purple-200 text-purple-900',
        },
        {
            status: 'WithDoctor',
            title: 'بالداخل مع الطبيب',
            icon: _jsx(Stethoscope, { className: "w-4 h-4 text-emerald-600" }),
            bgHeader: 'bg-emerald-50 text-emerald-900',
            badgeColor: 'bg-emerald-200 text-emerald-900',
        },
        {
            status: 'Skipped',
            title: 'غائب مؤقتاً (تخطي)',
            icon: _jsx(UserX, { className: "w-4 h-4 text-amber-600" }),
            bgHeader: 'bg-amber-50 text-amber-900',
            badgeColor: 'bg-amber-200 text-amber-900',
        },
        {
            status: 'Completed',
            title: 'تم الكشف اليوم',
            icon: _jsx(CheckCircle2, { className: "w-4 h-4 text-teal-600" }),
            bgHeader: 'bg-teal-50 text-teal-900',
            badgeColor: 'bg-teal-200 text-teal-900',
        },
    ];
    return (_jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between pb-2 border-b border-slate-100", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h3", { className: "font-bold text-slate-900 text-sm", children: "\u0634\u0627\u0634\u0629 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u062D\u064A\u0629 \u0644\u0644\u062F\u0648\u0631 (Live Queue)" }), _jsxs("span", { className: "inline-flex items-center gap-1 text-[11px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" }), "\u062A\u062D\u062F\u064A\u062B \u0645\u0628\u0627\u0634\u0631 (SignalR)"] })] }), _jsxs("span", { className: "text-xs text-slate-500", children: ["\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062D\u0627\u0644\u0627\u062A \u0627\u0644\u064A\u0648\u0645: ", _jsx("strong", { children: queueItems.length })] })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 min-h-[480px]", children: columns.map((col) => {
                    const items = queueItems.filter((i) => i.status === col.status);
                    return (_jsxs("div", { className: "flex flex-col rounded-xl bg-slate-50/70 border border-slate-200 overflow-hidden", children: [_jsxs("div", { className: `p-2.5 flex items-center justify-between border-b border-slate-200 ${col.bgHeader}`, children: [_jsxs("div", { className: "flex items-center gap-1.5 font-bold text-xs", children: [col.icon, _jsx("span", { children: col.title })] }), _jsx("span", { className: `text-[11px] font-bold px-2 py-0.5 rounded-full ${col.badgeColor}`, children: items.length })] }), _jsx("div", { className: "p-2 flex-1 space-y-2 overflow-y-auto max-h-[550px]", children: items.length === 0 ? (_jsx("div", { className: "py-8 text-center text-slate-400 text-xs", children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u062D\u0627\u0644\u0627\u062A" })) : (items.map((item) => (_jsxs("div", { className: `p-2.5 rounded-xl border bg-white shadow-xs space-y-1.5 transition-all hover:shadow-md ${item.isUrgent
                                        ? 'border-rose-400 ring-1 ring-rose-300'
                                        : 'border-slate-200'}`, children: [_jsxs("div", { className: "flex items-center justify-between", children: [item.queueNumber != null ? (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-[10px] text-slate-500", children: "\u0631\u0642\u0645" }), _jsx("span", { className: "font-extrabold text-sm px-1.5 py-0.5 bg-slate-900 text-white rounded-md font-mono", children: item.queueNumber })] })) : (_jsx("span", { className: "text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded", children: "\u062D\u062C\u0632 \u0645\u0633\u0628\u0642" })), _jsxs("div", { className: "flex items-center gap-1", children: [item.isUrgent && (_jsxs("span", { className: "text-[9px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5", children: [_jsx(Sparkles, { className: "w-2.5 h-2.5 text-rose-600" }), "\u0645\u0633\u062A\u0639\u062C\u0644"] })), item.isConsultation && (_jsx("span", { className: "text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold", children: "\u0627\u0633\u062A\u0634\u0627\u0631\u0629" }))] })] }), _jsxs("div", { children: [_jsx("h5", { className: "font-bold text-slate-900 text-xs line-clamp-1", children: item.patientName }), _jsxs("div", { className: "text-[10px] text-slate-500 flex items-center justify-between mt-0.5", children: [_jsxs("span", { children: ["\u0645\u0644\u0641 #", item.fileNumber] }), _jsx("span", { className: "text-slate-600", children: item.serviceName })] })] }), item.remainingBalancePiastres > 0 && (_jsxs("div", { className: "text-[10px] p-1 bg-rose-50 border border-rose-200 rounded text-rose-800 font-semibold flex items-center justify-between", children: [_jsx("span", { children: "\u0645\u062A\u0628\u0642\u064A:" }), _jsx("span", { className: "font-bold dir-ltr", children: formatEgp(item.remainingBalancePiastres) })] })), _jsxs("div", { className: "pt-1.5 border-t border-slate-100 flex items-center gap-1", children: [col.status === 'Booked' && (_jsxs(Button, { onClick: () => onCheckIn(item), variant: "primary", size: "sm", className: "w-full text-[10px] py-1 bg-sky-600 hover:bg-sky-700", children: [_jsx(ArrowRight, { className: "w-3 h-3 ml-1" }), "\u062A\u0633\u062C\u064A\u0644 \u062D\u0636\u0648\u0631 (Check-In)"] })), col.status === 'Waiting' && (_jsxs(_Fragment, { children: [_jsxs(Button, { onClick: () => onToggleUrgent(item), variant: "outline", size: "sm", className: `text-[10px] py-1 flex-1 ${item.isUrgent ? 'border-rose-400 text-rose-700' : 'text-slate-600'}`, children: ["\u2B50 ", item.isUrgent ? 'إلغاء الاستعجال' : 'مستعجل'] }), _jsx(Button, { onClick: () => onSkip(item), variant: "secondary", size: "sm", className: "text-[10px] py-1 text-slate-600 hover:text-amber-700", children: "\u062A\u062E\u0637\u064A" })] })), col.status === 'Skipped' && (_jsxs(Button, { onClick: () => onRecall(item), variant: "primary", size: "sm", className: "w-full text-[10px] py-1 bg-amber-600 hover:bg-amber-700", children: [_jsx(RotateCcw, { className: "w-3 h-3 ml-1" }), "\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0644\u0644\u062F\u0648\u0631"] })), col.status === 'Completed' && item.remainingBalancePiastres > 0 && (_jsxs(Button, { onClick: () => onSettle(item), variant: "success", size: "sm", className: "w-full text-[10px] py-1", children: [_jsx(CreditCard, { className: "w-3 h-3 ml-1" }), "\u062A\u062D\u0635\u064A\u0644 \u0627\u0644\u0645\u062A\u0628\u0642\u064A"] }))] })] }, item.appointmentId)))) })] }, col.status));
                }) })] }));
}
