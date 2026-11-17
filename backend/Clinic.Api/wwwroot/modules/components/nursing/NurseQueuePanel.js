import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { Search, Activity, User, Clock, AlertTriangle, Play, RefreshCw } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
export function NurseQueuePanel({ items, selectedAppointmentId, onSelectAppointment, onStartPrep, isLoading, onRefresh, isStartingPrepId, }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('ALL');
    // Filter only relevant nursing queue statuses: Booked, Waiting, InNursing (and WithDoctor for reference)
    const nursingQueue = useMemo(() => {
        return items.filter((item) => item.status === 'InNursing' || item.status === 'Waiting' || item.status === 'Booked');
    }, [items]);
    // Counts
    const counts = useMemo(() => {
        return {
            all: nursingQueue.length,
            inNursing: nursingQueue.filter((i) => i.status === 'InNursing').length,
            waiting: nursingQueue.filter((i) => i.status === 'Waiting').length,
            booked: nursingQueue.filter((i) => i.status === 'Booked').length,
        };
    }, [nursingQueue]);
    // Filter & Search
    const filteredItems = useMemo(() => {
        return nursingQueue.filter((item) => {
            // Tab filter
            if (activeFilter !== 'ALL' && item.status !== activeFilter) {
                return false;
            }
            // Search query
            if (!searchQuery.trim())
                return true;
            const q = searchQuery.trim().toLowerCase();
            return (item.patientName.toLowerCase().includes(q) ||
                item.fileNumber.toLowerCase().includes(q) ||
                (item.phone && item.phone.includes(q)) ||
                (item.queueNumber !== null && String(item.queueNumber).includes(q)));
        });
    }, [nursingQueue, activeFilter, searchQuery]);
    const getStatusBadge = (status) => {
        switch (status) {
            case 'InNursing':
                return (_jsxs(Badge, { variant: "purple", className: "animate-pulse", children: [_jsx(Activity, { className: "w-3 h-3 ml-1" }), "\u0642\u064A\u062F \u0627\u0644\u0641\u062D\u0635"] }));
            case 'Waiting':
                return (_jsxs(Badge, { variant: "warning", children: [_jsx(Clock, { className: "w-3 h-3 ml-1" }), "\u0641\u064A \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631"] }));
            case 'Booked':
                return (_jsxs(Badge, { variant: "default", children: [_jsx(Clock, { className: "w-3 h-3 ml-1" }), "\u0645\u062D\u062C\u0648\u0632"] }));
            default:
                return _jsx(Badge, { variant: "default", children: status });
        }
    };
    return (_jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-120px)] overflow-hidden", children: [_jsxs("div", { className: "p-4 border-b border-slate-100 space-y-3 bg-slate-50/50", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center", children: _jsx(Activity, { className: "w-4 h-4" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-sm font-bold text-slate-800", children: "\u0637\u0627\u0628\u0648\u0631 \u0627\u0644\u062A\u0645\u0631\u064A\u0636 \u0648\u0627\u0644\u0641\u062D\u0635" }), _jsx("p", { className: "text-[11px] text-slate-500", children: "\u0627\u0644\u0645\u0631\u0636\u0649 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0642\u064A\u0627\u0633 \u0639\u0644\u0627\u0645\u0627\u062A\u0647\u0645 \u0627\u0644\u062D\u064A\u0648\u064A\u0629" })] })] }), onRefresh && (_jsx(Button, { variant: "ghost", size: "icon", onClick: onRefresh, disabled: isLoading, title: "\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0637\u0627\u0628\u0648\u0631", className: "text-slate-500 hover:text-slate-800", children: _jsx(RefreshCw, { className: cn('w-4 h-4', isLoading && 'animate-spin') }) }))] }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: "text", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), placeholder: "\u0628\u062D\u062B \u0628\u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0645\u0644\u0641 \u0623\u0648 \u0627\u0644\u062F\u0648\u0631...", className: "w-full text-xs bg-white border border-slate-200 rounded-xl pr-8 pl-3 py-2 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500" }), _jsx(Search, { className: "w-4 h-4 text-slate-400 absolute top-2.5 right-2.5" })] }), _jsxs("div", { className: "flex gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold", children: [_jsxs("button", { type: "button", onClick: () => setActiveFilter('ALL'), className: cn('flex-1 py-1 rounded-lg transition-all text-center', activeFilter === 'ALL'
                                    ? 'bg-white text-slate-800 shadow-sm font-bold'
                                    : 'text-slate-500 hover:text-slate-700'), children: ["\u0627\u0644\u0643\u0644 (", counts.all, ")"] }), _jsxs("button", { type: "button", onClick: () => setActiveFilter('InNursing'), className: cn('flex-1 py-1 rounded-lg transition-all text-center', activeFilter === 'InNursing'
                                    ? 'bg-purple-600 text-white shadow-sm font-bold'
                                    : 'text-purple-700 hover:bg-purple-50'), children: ["\u0642\u064A\u062F \u0627\u0644\u0641\u062D\u0635 (", counts.inNursing, ")"] }), _jsxs("button", { type: "button", onClick: () => setActiveFilter('Waiting'), className: cn('flex-1 py-1 rounded-lg transition-all text-center', activeFilter === 'Waiting'
                                    ? 'bg-amber-500 text-white shadow-sm font-bold'
                                    : 'text-amber-700 hover:bg-amber-50'), children: ["\u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 (", counts.waiting, ")"] }), _jsxs("button", { type: "button", onClick: () => setActiveFilter('Booked'), className: cn('flex-1 py-1 rounded-lg transition-all text-center', activeFilter === 'Booked'
                                    ? 'bg-slate-700 text-white shadow-sm font-bold'
                                    : 'text-slate-600 hover:bg-slate-200'), children: ["\u062D\u062C\u0632 (", counts.booked, ")"] })] })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-3 space-y-2", children: isLoading && filteredItems.length === 0 ? (_jsxs("div", { className: "py-12 text-center text-slate-400 space-y-2", children: [_jsx(RefreshCw, { className: "w-6 h-6 animate-spin mx-auto text-teal-600" }), _jsx("p", { className: "text-xs", children: "\u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0631\u0636\u0649..." })] })) : filteredItems.length === 0 ? (_jsxs("div", { className: "py-12 text-center text-slate-400 space-y-2", children: [_jsx(User, { className: "w-8 h-8 mx-auto text-slate-300" }), _jsx("p", { className: "text-xs", children: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u0631\u0636\u0649 \u0645\u0637\u0627\u0628\u0642\u064A\u0646 \u0644\u0644\u0628\u062D\u062B \u062D\u0627\u0644\u064A\u0627\u064B" })] })) : (filteredItems.map((item) => {
                    const isSelected = item.appointmentId === selectedAppointmentId;
                    const isInNursing = item.status === 'InNursing';
                    const isStarting = isStartingPrepId === item.appointmentId;
                    return (_jsxs("div", { onClick: () => onSelectAppointment(item), className: cn('p-3 rounded-xl border text-right transition-all cursor-pointer relative group', isSelected
                            ? 'border-teal-500 bg-teal-50/50 shadow-sm ring-1 ring-teal-500'
                            : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50/70', item.isUrgent && 'border-r-4 border-r-rose-500'), children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-1.5 flex-wrap", children: [item.queueNumber !== null ? (_jsx("span", { className: "w-6 h-6 rounded-md bg-slate-800 text-white text-xs font-bold flex items-center justify-center font-mono", children: item.queueNumber })) : (_jsx("span", { className: "w-6 h-6 rounded-md bg-slate-100 text-slate-500 text-xs font-semibold flex items-center justify-center", children: "-" })), _jsx("span", { className: "font-bold text-xs text-slate-800 group-hover:text-teal-900", children: item.patientName }), item.isUrgent && (_jsxs("span", { className: "inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded px-1", children: [_jsx(AlertTriangle, { className: "w-3 h-3" }), "\u0637\u0648\u0627\u0631\u0626"] }))] }), _jsx("div", { children: getStatusBadge(item.status) })] }), _jsxs("div", { className: "mt-2 flex items-center justify-between text-[11px] text-slate-500", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded", children: ["#", item.fileNumber] }), _jsx("span", { children: item.serviceName })] }), item.arrivedAtUtc && (_jsx("span", { className: "text-[10px] text-slate-400", children: new Date(item.arrivedAtUtc).toLocaleTimeString('ar-EG', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        }) }))] }), !isInNursing && (_jsx("div", { className: "mt-2.5 pt-2 border-t border-slate-100 flex justify-end", children: _jsxs(Button, { type: "button", size: "sm", variant: "primary", disabled: isStarting, onClick: (e) => {
                                        e.stopPropagation();
                                        onStartPrep(item);
                                    }, className: "bg-teal-600 hover:bg-teal-700 text-xs py-1 px-3 shadow-none h-7", children: [_jsx(Play, { className: "w-3 h-3 ml-1 fill-white" }), isStarting ? 'جاري البدء...' : 'بدء الفحص'] }) })), isInNursing && (_jsxs("div", { className: "mt-2.5 pt-2 border-t border-purple-100 flex items-center justify-between text-[10px] text-purple-700", children: [_jsxs("span", { className: "flex items-center gap-1 font-semibold", children: [_jsx(Activity, { className: "w-3 h-3 animate-pulse" }), "\u062C\u0644\u0633\u0629 \u0627\u0644\u0642\u064A\u0627\u0633 \u0646\u0634\u0637\u0629 \u062D\u0627\u0644\u064A\u0627\u064B"] }), _jsx("span", { className: "text-teal-700 font-bold", children: "\u0645\u062D\u062F\u062F \u0627\u0644\u0622\u0646" })] }))] }, item.appointmentId));
                })) })] }));
}
