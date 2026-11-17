import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { DollarSign, Search, RefreshCw, CreditCard, RotateCcw, Ban, Printer, FileText, AlertCircle, TrendingDown, Wallet, CheckCircle2, } from 'lucide-react';
import { AppNavbar } from '../components/layout/AppNavbar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { PartialPaymentModal } from '../components/treasury/PartialPaymentModal';
import { RefundModal } from '../components/treasury/RefundModal';
import { VoidInvoiceModal } from '../components/treasury/VoidInvoiceModal';
import { PettyExpenseModal } from '../components/reception/PettyExpenseModal';
import { treasuryService } from '../services/treasuryService';
import { printService } from '../services/printService';
import { api, authStorage, ApiException } from '../lib/api';
import { formatEgp } from '../lib/currency';
import { ArabicNormalizer } from '../lib/arabicNormalizer';
export function TreasuryPage() {
    const [shiftStatus, setShiftStatus] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [dateFilter, setDateFilter] = useState('today');
    // Modals state
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
    const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
    const [isPettyExpenseOpen, setIsPettyExpenseOpen] = useState(false);
    const currentUser = authStorage.getUser();
    const canVoid = currentUser?.role === 'Doctor' || currentUser?.role === 'Admin';
    useEffect(() => {
        loadAllData();
    }, [dateFilter]);
    const loadAllData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch current shift
            try {
                const shiftRes = await api.get('/shifts/current');
                setShiftStatus(shiftRes);
            }
            catch {
                // Shift endpoint might return empty if no shift is currently open
                setShiftStatus(null);
            }
            // 2. Fetch invoices
            const now = new Date();
            let startDateStr = undefined;
            if (dateFilter === 'today') {
                const todayStr = now.toISOString().split('T')[0];
                startDateStr = todayStr;
            }
            else if (dateFilter === 'yesterday') {
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                startDateStr = yesterday.toISOString().split('T')[0];
            }
            else if (dateFilter === 'week') {
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                startDateStr = weekAgo.toISOString().split('T')[0];
            }
            const invs = await treasuryService.getInvoices({
                startDate: startDateStr,
            });
            setInvoices(invs || []);
        }
        catch (err) {
            if (err instanceof ApiException) {
                setError(err.message);
            }
            else {
                setError('تعذر تحميل بيانات الخزينة والفواتير');
            }
        }
        finally {
            setLoading(false);
        }
    };
    const handlePaymentRecorded = (updated) => {
        setInvoices((prev) => prev.map((inv) => (inv.id === updated.id ? { ...inv, ...updated } : inv)));
        showNotice(`تم تسجيل سداد للفاتورة #${updated.id} بنجاح`);
        loadAllData();
    };
    const handleRefundProcessed = (res) => {
        setInvoices((prev) => prev.map((inv) => (inv.id === res.invoice.id ? { ...inv, ...res.invoice } : inv)));
        showNotice(`تم استرجاع مبلغ للفاتورة #${res.invoice.id} بنجاح`);
        loadAllData();
    };
    const handleInvoiceVoided = (updated) => {
        setInvoices((prev) => prev.map((inv) => (inv.id === updated.id ? { ...inv, ...updated } : inv)));
        showNotice(`تم إلغاء الفاتورة #${updated.id} وعكس المعاملات بنجاح`);
        loadAllData();
    };
    const showNotice = (msg) => {
        setNotice(msg);
        setTimeout(() => setNotice(null), 3500);
    };
    const handlePrintReceipt = async (inv) => {
        try {
            const receiptData = {
                clinicName: 'عيادة النور التخصصية',
                doctorName: inv.doctorName || 'د. أحمد عبد الرحمن',
                specialty: 'أمراض الباطنة والقلب',
                receiptNumber: `REC-${inv.id}`,
                date: new Date(inv.createdAtUtc).toLocaleDateString('ar-EG'),
                patientName: inv.patientName,
                fileNumber: inv.fileNumber,
                queueNumber: null,
                serviceName: inv.serviceName,
                procedures: [],
                totalPiastres: inv.totalPiastres,
                discountPiastres: inv.discountPiastres,
                netTotalPiastres: inv.netTotalPiastres,
                paidPiastres: inv.paidPiastres,
                remainingPiastres: inv.remainingPiastres,
                paymentMethod: 'Cash',
                receptionistName: currentUser?.fullName || 'مسؤول الخزينة',
            };
            await printService.printReceipt(receiptData);
        }
        catch {
            showNotice('تم إرسال أمر طباعة الإيصال');
        }
    };
    // Filtered invoices
    const filteredInvoices = useMemo(() => {
        return invoices.filter((inv) => {
            // Search
            if (searchTerm.trim()) {
                const normSearch = ArabicNormalizer.normalizeText(searchTerm.trim());
                const normName = ArabicNormalizer.normalizeText(inv.patientName || '');
                const normPhone = inv.patientPhone || '';
                const normFile = inv.fileNumber || '';
                const invIdStr = String(inv.id);
                const matches = normName.includes(normSearch) ||
                    normPhone.includes(normSearch) ||
                    normFile.toLowerCase().includes(normSearch.toLowerCase()) ||
                    invIdStr.includes(normSearch);
                if (!matches)
                    return false;
            }
            // Status
            if (statusFilter !== 'ALL' && inv.status !== statusFilter) {
                return false;
            }
            return true;
        });
    }, [invoices, searchTerm, statusFilter]);
    // Aggregate stats from invoices
    const totalBilled = filteredInvoices.reduce((sum, i) => sum + (i.status !== 'Voided' ? i.netTotalPiastres : 0), 0);
    const totalCollected = filteredInvoices.reduce((sum, i) => sum + (i.status !== 'Voided' ? i.paidPiastres : 0), 0);
    const totalRemaining = filteredInvoices.reduce((sum, i) => sum + (i.status !== 'Voided' ? i.remainingPiastres : 0), 0);
    const activeShift = shiftStatus?.hasActiveShift ? shiftStatus.shift : null;
    return (_jsxs("div", { className: "min-h-screen bg-slate-50 flex flex-col", children: [_jsx(AppNavbar, { currentPath: "/treasury" }), _jsxs("main", { className: "flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6", children: [notice && (_jsxs("div", { className: "p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in", children: [_jsx(CheckCircle2, { className: "w-4 h-4 text-emerald-600 flex-shrink-0" }), _jsx("span", { children: notice })] })), error && (_jsxs("div", { className: "p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("span", { children: error })] })), _jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsxs("h1", { className: "text-xl font-bold text-slate-900 flex items-center gap-2", children: [_jsx(Wallet, { className: "w-6 h-6 text-sky-600" }), _jsx("span", { children: "\u0627\u0644\u062E\u0632\u064A\u0646\u0629 \u0648\u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0648\u0627\u0644\u0645\u062F\u0641\u0648\u0639\u0627\u062A" })] }), _jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: "\u0625\u062F\u0627\u0631\u0629 \u062D\u0631\u0643\u0629 \u062F\u0631\u062C \u0627\u0644\u0646\u0642\u062F\u064A\u0629\u060C \u062A\u062D\u0635\u064A\u0644 \u0627\u0644\u0623\u0642\u0633\u0627\u0637\u060C \u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0627\u0644\u0645\u0628\u0627\u0644\u063A\u060C \u0648\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [activeShift && (_jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: () => setIsPettyExpenseOpen(true), className: "gap-1.5 text-xs text-amber-700 hover:text-amber-800 border-amber-200 hover:bg-amber-50", children: [_jsx(TrendingDown, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u062A\u0633\u062C\u064A\u0644 \u0645\u0635\u0631\u0648\u0641 \u0646\u062B\u0631\u064A" })] })), _jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: loadAllData, disabled: loading, className: "gap-1 text-xs", children: [_jsx(RefreshCw, { className: `w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}` }), _jsx("span", { children: "\u062A\u062D\u062F\u064A\u062B" })] })] })] }), _jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between pb-3 border-b border-slate-100", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(DollarSign, { className: "w-5 h-5 text-emerald-600" }), _jsx("h2", { className: "font-bold text-slate-800 text-sm", children: "\u062D\u0627\u0644\u0629 \u062F\u0631\u062C \u0627\u0644\u0646\u0642\u062F\u064A\u0629 \u0644\u0644\u0648\u0631\u062F\u064A\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629" })] }), activeShift ? (_jsxs(Badge, { variant: "success", children: ["\u0648\u0631\u062F\u064A\u0629 \u0646\u0634\u0637\u0629 (\u064A\u0648\u0645 \u0627\u0644\u0639\u0645\u0644: ", activeShift.businessDate, ")"] })) : (_jsx(Badge, { variant: "warning", children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0648\u0631\u062F\u064A\u0629 \u0645\u0641\u062A\u0648\u062D\u0629 \u062D\u0627\u0644\u064A\u0627\u064B" }))] }), activeShift ? (_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-5 gap-3", children: [_jsxs("div", { className: "col-span-2 md:col-span-1 bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5", children: [_jsx("span", { className: "text-[11px] font-semibold text-emerald-800 block mb-1", children: "\u0627\u0644\u0646\u0642\u062F\u064A\u0629 \u0627\u0644\u0645\u062A\u0648\u0642\u0639\u0629 \u0628\u0627\u0644\u062F\u0631\u062C" }), _jsx("span", { className: "text-xl font-black text-emerald-700", children: _jsx("bdi", { dir: "ltr", children: formatEgp(activeShift.expectedClosingCashPiastres) }) })] }), _jsxs("div", { className: "bg-slate-50 border border-slate-200 rounded-xl p-3.5", children: [_jsx("span", { className: "text-[11px] font-semibold text-slate-500 block mb-1", children: "\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0627\u0641\u062A\u062A\u0627\u062D\u064A" }), _jsx("span", { className: "text-sm font-bold text-slate-800", children: _jsx("bdi", { dir: "ltr", children: formatEgp(activeShift.openingBalancePiastres) }) })] }), _jsxs("div", { className: "bg-sky-50/60 border border-sky-200 rounded-xl p-3.5", children: [_jsx("span", { className: "text-[11px] font-semibold text-sky-800 block mb-1", children: "\u0645\u0642\u0628\u0648\u0636\u0627\u062A \u0643\u0627\u0634 (+)" }), _jsx("span", { className: "text-sm font-bold text-sky-700", children: _jsx("bdi", { dir: "ltr", children: formatEgp(activeShift.cashPaymentsPiastres) }) })] }), _jsxs("div", { className: "bg-purple-50/60 border border-purple-200 rounded-xl p-3.5", children: [_jsx("span", { className: "text-[11px] font-semibold text-purple-800 block mb-1", children: "\u062A\u062D\u0635\u064A\u0644 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A (\u0645\u062D\u0627\u0641\u0638/\u0643\u0631\u0648\u062A)" }), _jsx("span", { className: "text-sm font-bold text-purple-700", children: _jsx("bdi", { dir: "ltr", children: formatEgp((activeShift.instapayTotalPiastres || activeShift.totalInstapayPiastres || 0) +
                                                        (activeShift.vodafoneCashTotalPiastres || activeShift.totalVodafoneCashPiastres || 0) +
                                                        (activeShift.cardTotalPiastres || activeShift.totalCardPiastres || 0)) }) })] }), _jsxs("div", { className: "bg-rose-50/60 border border-rose-200 rounded-xl p-3.5", children: [_jsx("span", { className: "text-[11px] font-semibold text-rose-800 block mb-1", children: "\u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0648\u0645\u0633\u062A\u0631\u062C\u0639\u0627\u062A (-)" }), _jsx("span", { className: "text-sm font-bold text-rose-700", children: _jsx("bdi", { dir: "ltr", children: formatEgp((activeShift.cashExpensesPiastres || 0) + (activeShift.cashRefundsPiastres || 0)) }) })] })] })) : (_jsx("div", { className: "text-center py-4 text-xs text-slate-400", children: "\u064A\u0631\u062C\u0649 \u0641\u062A\u062D \u0648\u0631\u062F\u064A\u0629 \u062C\u062F\u064A\u062F\u0629 \u0645\u0646 \u0634\u0627\u0634\u0629 \u0627\u0644\u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0644\u062A\u0641\u0639\u064A\u0644 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0645\u0642\u0628\u0648\u0636\u0627\u062A \u0627\u0644\u0646\u0642\u062F\u064A\u0629 \u0648\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u062F\u0631\u062C." }))] }), _jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-5", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(FileText, { className: "w-5 h-5 text-sky-600" }), _jsx("h2", { className: "font-bold text-slate-800 text-sm", children: "\u0633\u062C\u0644 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0648\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u064A\u0629" })] }), _jsxs("div", { className: "flex items-center gap-2 text-xs", children: [_jsxs("span", { className: "text-slate-500", children: ["\u0627\u0644\u0645\u0637\u0644\u0648\u0628: ", _jsx("strong", { className: "text-slate-800", children: _jsx("bdi", { dir: "ltr", children: formatEgp(totalBilled) }) })] }), _jsx("span", { className: "text-slate-300", children: "|" }), _jsxs("span", { className: "text-emerald-700", children: ["\u0627\u0644\u0645\u062D\u0635\u0644: ", _jsx("strong", { children: _jsx("bdi", { dir: "ltr", children: formatEgp(totalCollected) }) })] }), _jsx("span", { className: "text-slate-300", children: "|" }), _jsxs("span", { className: "text-rose-600", children: ["\u0627\u0644\u0645\u062A\u0628\u0642\u064A: ", _jsx("strong", { children: _jsx("bdi", { dir: "ltr", children: formatEgp(totalRemaining) }) })] })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("div", { className: "flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold", children: [_jsx("button", { type: "button", onClick: () => setDateFilter('today'), className: `px-2.5 py-1 rounded-md transition-all ${dateFilter === 'today' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'}`, children: "\u0627\u0644\u064A\u0648\u0645" }), _jsx("button", { type: "button", onClick: () => setDateFilter('yesterday'), className: `px-2.5 py-1 rounded-md transition-all ${dateFilter === 'yesterday' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'}`, children: "\u0623\u0645\u0633" }), _jsx("button", { type: "button", onClick: () => setDateFilter('week'), className: `px-2.5 py-1 rounded-md transition-all ${dateFilter === 'week' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'}`, children: "\u0623\u0633\u0628\u0648\u0639" }), _jsx("button", { type: "button", onClick: () => setDateFilter('all'), className: `px-2.5 py-1 rounded-md transition-all ${dateFilter === 'all' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'}`, children: "\u0627\u0644\u0643\u0644" })] }), _jsxs("select", { value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), className: "px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700", children: [_jsx("option", { value: "ALL", children: "\u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0627\u0644\u0627\u062A" }), _jsx("option", { value: "Paid", children: "\u0645\u0633\u062F\u062F\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644" }), _jsx("option", { value: "Partial", children: "\u0633\u062F\u0627\u062F \u062C\u0632\u0626\u064A" }), _jsx("option", { value: "Unpaid", children: "\u063A\u064A\u0631 \u0645\u0633\u062F\u062F\u0629" }), _jsx("option", { value: "Voided", children: "\u0645\u0644\u063A\u0627\u0629" })] }), _jsxs("div", { className: "relative w-48", children: [_jsx(Search, { className: "w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" }), _jsx(Input, { type: "text", placeholder: "\u0628\u062D\u062B \u0628\u0627\u0644\u0645\u0631\u064A\u0636 \u0623\u0648 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), className: "pr-8 h-8 text-xs" })] })] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-right text-xs", children: [_jsx("thead", { className: "bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold", children: _jsxs("tr", { children: [_jsx("th", { className: "py-3 px-3", children: "\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629" }), _jsx("th", { className: "py-3 px-3", children: "\u0627\u0644\u0645\u0631\u064A\u0636 / \u0627\u0644\u0645\u0644\u0641" }), _jsx("th", { className: "py-3 px-3", children: "\u0627\u0644\u062E\u062F\u0645\u0629" }), _jsx("th", { className: "py-3 px-3", children: "\u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0635\u0627\u0641\u064A\u0629" }), _jsx("th", { className: "py-3 px-3", children: "\u0627\u0644\u0645\u0633\u062F\u062F" }), _jsx("th", { className: "py-3 px-3", children: "\u0627\u0644\u0645\u062A\u0628\u0642\u064A" }), _jsx("th", { className: "py-3 px-3", children: "\u0627\u0644\u0645\u0633\u062A\u0631\u062C\u0639" }), _jsx("th", { className: "py-3 px-3", children: "\u0627\u0644\u062D\u0627\u0644\u0629" }), _jsx("th", { className: "py-3 px-3 text-center", children: "\u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0627\u0644\u062E\u0632\u064A\u0646\u0629" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: filteredInvoices.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 9, className: "py-8 text-center text-slate-400", children: loading ? 'جاري تحميل سجل الفواتير...' : 'لا توجد فواتير مطابقة للبحث أو الفترة المحددة.' }) })) : (filteredInvoices.map((inv) => (_jsxs("tr", { className: `hover:bg-slate-50/70 transition-colors ${inv.status === 'Voided' ? 'opacity-50 bg-slate-50/40 line-through' : ''}`, children: [_jsx("td", { className: "py-3 px-3 font-mono font-bold text-slate-800", children: _jsxs("bdi", { dir: "ltr", children: ["#", inv.id] }) }), _jsxs("td", { className: "py-3 px-3", children: [_jsx("div", { className: "font-semibold text-slate-900", children: inv.patientName }), _jsxs("div", { className: "text-[11px] text-slate-400", children: [_jsx("bdi", { dir: "ltr", children: inv.fileNumber }), " \u2022 ", _jsx("bdi", { dir: "ltr", children: inv.patientPhone })] })] }), _jsx("td", { className: "py-3 px-3 text-slate-700", children: inv.serviceName }), _jsx("td", { className: "py-3 px-3 font-bold text-slate-800", children: _jsx("bdi", { dir: "ltr", children: formatEgp(inv.netTotalPiastres) }) }), _jsx("td", { className: "py-3 px-3 font-bold text-emerald-700", children: _jsx("bdi", { dir: "ltr", children: formatEgp(inv.paidPiastres) }) }), _jsx("td", { className: "py-3 px-3 font-bold text-rose-600", children: _jsx("bdi", { dir: "ltr", children: formatEgp(inv.remainingPiastres) }) }), _jsx("td", { className: "py-3 px-3 font-semibold text-slate-500", children: inv.refundedPiastres > 0 ? (_jsx("span", { className: "text-amber-700", children: _jsx("bdi", { dir: "ltr", children: formatEgp(inv.refundedPiastres) }) })) : ('-') }), _jsx("td", { className: "py-3 px-3", children: _jsx(Badge, { variant: inv.status === 'Paid'
                                                                ? 'success'
                                                                : inv.status === 'Partial'
                                                                    ? 'warning'
                                                                    : inv.status === 'Unpaid'
                                                                        ? 'danger'
                                                                        : 'default', children: inv.status === 'Paid'
                                                                ? 'مسددة'
                                                                : inv.status === 'Partial'
                                                                    ? 'سداد جزئي'
                                                                    : inv.status === 'Unpaid'
                                                                        ? 'غير مسددة'
                                                                        : 'ملغاة' }) }), _jsx("td", { className: "py-3 px-3 text-center", children: _jsxs("div", { className: "flex items-center justify-center gap-1", children: [inv.status !== 'Voided' && inv.remainingPiastres > 0 && (_jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: () => {
                                                                        setSelectedInvoice(inv);
                                                                        setIsPaymentModalOpen(true);
                                                                    }, className: "h-7 px-2 text-[11px] gap-1 text-sky-700 border-sky-200 hover:bg-sky-50", title: "\u0633\u062F\u0627\u062F \u0642\u0633\u0637 \u0623\u0648 \u0643\u0627\u0645\u0644 \u0627\u0644\u0645\u0628\u0644\u063A", children: [_jsx(CreditCard, { className: "w-3 h-3" }), _jsx("span", { children: "\u0633\u062F\u0627\u062F" })] })), inv.status !== 'Voided' && inv.paidPiastres > (inv.refundedPiastres || 0) && (_jsxs(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => {
                                                                        setSelectedInvoice(inv);
                                                                        setIsRefundModalOpen(true);
                                                                    }, className: "h-7 px-2 text-[11px] gap-1 text-amber-700 hover:bg-amber-50", title: "\u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0645\u0627\u0644\u064A", children: [_jsx(RotateCcw, { className: "w-3 h-3" }), _jsx("span", { children: "\u0627\u0633\u062A\u0631\u062C\u0627\u0639" })] })), _jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => handlePrintReceipt(inv), className: "h-7 px-1.5 text-slate-500 hover:text-slate-800", title: "\u0637\u0628\u0627\u0639\u0629 \u0625\u064A\u0635\u0627\u0644 \u062D\u0631\u0627\u0631\u064A", children: _jsx(Printer, { className: "w-3.5 h-3.5" }) }), inv.status !== 'Voided' && canVoid && (_jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => {
                                                                        setSelectedInvoice(inv);
                                                                        setIsVoidModalOpen(true);
                                                                    }, className: "h-7 px-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50", title: "\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0646\u0647\u0627\u0626\u064A\u0627\u064B", children: _jsx(Ban, { className: "w-3.5 h-3.5" }) }))] }) })] }, inv.id)))) })] }) })] })] }), _jsx(PartialPaymentModal, { isOpen: isPaymentModalOpen, onClose: () => setIsPaymentModalOpen(false), invoice: selectedInvoice, onPaymentRecorded: handlePaymentRecorded }), _jsx(RefundModal, { isOpen: isRefundModalOpen, onClose: () => setIsRefundModalOpen(false), invoice: selectedInvoice, onRefundProcessed: handleRefundProcessed }), _jsx(VoidInvoiceModal, { isOpen: isVoidModalOpen, onClose: () => setIsVoidModalOpen(false), invoice: selectedInvoice, onInvoiceVoided: handleInvoiceVoided }), activeShift && (_jsx(PettyExpenseModal, { isOpen: isPettyExpenseOpen, onClose: () => setIsPettyExpenseOpen(false), shiftId: activeShift.shiftId || activeShift.id || 1, onExpenseRecorded: () => {
                    showNotice('تم تسجيل المصروف النثري بنجاح');
                    loadAllData();
                } }))] }));
}
