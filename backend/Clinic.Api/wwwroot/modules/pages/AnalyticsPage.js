import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Users, Clock, RefreshCw, AlertCircle, Stethoscope, Percent, Receipt, Wallet, } from 'lucide-react';
import { AppNavbar } from '../components/layout/AppNavbar';
import { Button } from '../components/ui/button';
import { RevenueTrendChart } from '../components/analytics/RevenueTrendChart';
import { PaymentMethodDonutChart } from '../components/analytics/PaymentMethodDonutChart';
import { analyticsService } from '../services/analyticsService';
import { formatEgp } from '../lib/currency';
import { authStorage, ApiException } from '../lib/api';
export function AnalyticsPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Filters
    const [datePreset, setDatePreset] = useState('month');
    const [selectedDoctorId, setSelectedDoctorId] = useState('ALL');
    const currentUser = authStorage.getUser();
    const isAdmin = currentUser?.role === 'Admin';
    useEffect(() => {
        loadAnalytics();
    }, [datePreset, selectedDoctorId]);
    const loadAnalytics = async () => {
        setLoading(true);
        setError(null);
        const now = new Date();
        let startDate = undefined;
        let endDate = now.toISOString().split('T')[0];
        if (datePreset === 'today') {
            startDate = endDate;
        }
        else if (datePreset === 'yesterday') {
            const y = new Date(now);
            y.setDate(y.getDate() - 1);
            startDate = y.toISOString().split('T')[0];
            endDate = startDate;
        }
        else if (datePreset === 'week') {
            const w = new Date(now);
            w.setDate(w.getDate() - 7);
            startDate = w.toISOString().split('T')[0];
        }
        else if (datePreset === 'month') {
            const m = new Date(now);
            m.setDate(m.getDate() - 30);
            startDate = m.toISOString().split('T')[0];
        }
        const params = {
            startDate,
            endDate,
            doctorId: selectedDoctorId !== 'ALL' ? parseInt(selectedDoctorId) : undefined,
        };
        try {
            const res = await analyticsService.getKpis(params);
            setData(res);
        }
        catch (err) {
            if (err instanceof ApiException) {
                setError(err.message);
            }
            else {
                // Fallback default empty KPI object if backend is initializing
                setData({
                    grossRevenuePiastres: 0,
                    foregoneDiscountsPiastres: 0,
                    netRevenuePiastres: 0,
                    paidRevenuePiastres: 0,
                    refundedPiastres: 0,
                    pettyCashExpensesPiastres: 0,
                    netClinicProfitPiastres: 0,
                    paymentMethods: {
                        cashPiastres: 0,
                        instapayPiastres: 0,
                        vodafoneCashPiastres: 0,
                        cardPiastres: 0,
                        cashCount: 0,
                        instapayCount: 0,
                        vodafoneCashCount: 0,
                        cardCount: 0,
                    },
                    discounts: {
                        colleaguePiastres: 0,
                        staffPiastres: 0,
                        charityPiastres: 0,
                        doctorCustomPiastres: 0,
                    },
                    serviceCategories: {
                        examCount: 0,
                        examRevenuePiastres: 0,
                        consultationCount: 0,
                        consultationRevenuePiastres: 0,
                        procedureCount: 0,
                        procedureRevenuePiastres: 0,
                    },
                    totalAppointmentsCount: 0,
                    completedVisitsCount: 0,
                    uniquePatientsCount: 0,
                    averageConsultationDurationMinutes: 0,
                    averageWaitTimeMinutes: 0,
                    dailyTrends: [],
                });
            }
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "min-h-screen bg-slate-50 flex flex-col", children: [_jsx(AppNavbar, { currentPath: "/analytics" }), _jsxs("main", { className: "flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6", children: [error && (_jsxs("div", { className: "p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("span", { children: error })] })), _jsxs("div", { className: "flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs", children: [_jsxs("div", { children: [_jsxs("h1", { className: "text-xl font-bold text-slate-900 flex items-center gap-2", children: [_jsx(TrendingUp, { className: "w-6 h-6 text-sky-600" }), _jsx("span", { children: "\u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0644\u064A\u0644\u0627\u062A \u0648\u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0648\u0627\u0644\u0633\u0631\u064A\u0631\u064A\u0629" })] }), _jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: "\u0645\u062A\u0627\u0628\u0639\u0629 \u062F\u0642\u064A\u0642\u0629 \u0644\u062D\u062C\u0645 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A\u060C \u0627\u0644\u062E\u0635\u0648\u0645\u0627\u062A\u060C \u0632\u0645\u0646 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631\u060C \u0648\u0625\u0646\u062A\u0627\u062C\u064A\u0629 \u0627\u0644\u0639\u064A\u0627\u062F\u0629" })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("div", { className: "flex bg-slate-100 p-1 rounded-xl text-xs font-semibold", children: [_jsx("button", { type: "button", onClick: () => setDatePreset('today'), className: `px-3 py-1.5 rounded-lg transition-all ${datePreset === 'today' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'}`, children: "\u0627\u0644\u064A\u0648\u0645" }), _jsx("button", { type: "button", onClick: () => setDatePreset('yesterday'), className: `px-3 py-1.5 rounded-lg transition-all ${datePreset === 'yesterday' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'}`, children: "\u0623\u0645\u0633" }), _jsx("button", { type: "button", onClick: () => setDatePreset('week'), className: `px-3 py-1.5 rounded-lg transition-all ${datePreset === 'week' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'}`, children: "\u0622\u062E\u0631 7 \u0623\u064A\u0627\u0645" }), _jsx("button", { type: "button", onClick: () => setDatePreset('month'), className: `px-3 py-1.5 rounded-lg transition-all ${datePreset === 'month' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'}`, children: "\u0622\u062E\u0631 30 \u064A\u0648\u0645\u0627\u064B" })] }), isAdmin && (_jsxs("select", { value: selectedDoctorId, onChange: (e) => setSelectedDoctorId(e.target.value), className: "px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700", children: [_jsx("option", { value: "ALL", children: "\u062C\u0645\u064A\u0639 \u0623\u0637\u0628\u0627\u0621 \u0627\u0644\u0639\u064A\u0627\u062F\u0629" }), _jsx("option", { value: "2", children: "\u062F. \u0623\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0631\u062D\u0645\u0646" }), _jsx("option", { value: "3", children: "\u062F. \u0645\u0646\u0649 \u0645\u062D\u0645\u0648\u062F (\u0645\u0633\u0627\u0639\u062F)" })] })), _jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: loadAnalytics, disabled: loading, className: "gap-1 text-xs", children: [_jsx(RefreshCw, { className: `w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}` }), _jsx("span", { children: "\u062A\u062D\u062F\u064A\u062B" })] })] })] }), data && (_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4 shadow-2xs", children: [_jsxs("div", { className: "flex items-center justify-between text-slate-500 mb-1", children: [_jsx("span", { className: "text-[11px] font-semibold", children: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631" }), _jsx(Receipt, { className: "w-4 h-4 text-sky-600" })] }), _jsx("div", { className: "text-base font-bold text-slate-900", children: _jsx("bdi", { dir: "ltr", children: formatEgp(data.grossRevenuePiastres) }) }), _jsx("div", { className: "text-[10px] text-slate-400 mt-1", children: "\u0642\u0628\u0644 \u0627\u0644\u062E\u0635\u0648\u0645\u0627\u062A" })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4 shadow-2xs", children: [_jsxs("div", { className: "flex items-center justify-between text-slate-500 mb-1", children: [_jsx("span", { className: "text-[11px] font-semibold", children: "\u0627\u0644\u062E\u0635\u0648\u0645\u0627\u062A \u0627\u0644\u0645\u0645\u0646\u0648\u062D\u0629" }), _jsx(Percent, { className: "w-4 h-4 text-amber-600" })] }), _jsx("div", { className: "text-base font-bold text-amber-700", children: _jsx("bdi", { dir: "ltr", children: formatEgp(data.foregoneDiscountsPiastres) }) }), _jsx("div", { className: "text-[10px] text-slate-400 mt-1", children: data.grossRevenuePiastres > 0
                                            ? `نسبة %${((data.foregoneDiscountsPiastres / data.grossRevenuePiastres) * 100).toFixed(1)}`
                                            : '0%' })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4 shadow-2xs", children: [_jsxs("div", { className: "flex items-center justify-between text-slate-500 mb-1", children: [_jsx("span", { className: "text-[11px] font-semibold", children: "\u0635\u0627\u0641\u064A \u0627\u0644\u0645\u0637\u0644\u0648\u0628" }), _jsx(DollarSign, { className: "w-4 h-4 text-indigo-600" })] }), _jsx("div", { className: "text-base font-bold text-indigo-700", children: _jsx("bdi", { dir: "ltr", children: formatEgp(data.netRevenuePiastres) }) }), _jsx("div", { className: "text-[10px] text-slate-400 mt-1", children: "\u0628\u0639\u062F \u0627\u0633\u062A\u0642\u0637\u0627\u0639 \u0627\u0644\u062E\u0635\u0645" })] }), _jsxs("div", { className: "bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 p-4 shadow-2xs", children: [_jsxs("div", { className: "flex items-center justify-between text-emerald-800 mb-1", children: [_jsx("span", { className: "text-[11px] font-semibold", children: "\u0627\u0644\u0645\u062D\u0635\u0644 \u0641\u0639\u0644\u064A\u0627\u064B" }), _jsx(Wallet, { className: "w-4 h-4 text-emerald-600" })] }), _jsx("div", { className: "text-base font-bold text-emerald-700", children: _jsx("bdi", { dir: "ltr", children: formatEgp(data.paidRevenuePiastres) }) }), _jsx("div", { className: "text-[10px] text-emerald-600 mt-1", children: "\u0646\u0642\u062F\u064A\u0627\u064B \u0648\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u064B" })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4 shadow-2xs", children: [_jsxs("div", { className: "flex items-center justify-between text-slate-500 mb-1", children: [_jsx("span", { className: "text-[11px] font-semibold", children: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0627\u0644\u0646\u062B\u0631\u064A\u0629" }), _jsx(TrendingDown, { className: "w-4 h-4 text-rose-600" })] }), _jsx("div", { className: "text-base font-bold text-rose-600", children: _jsx("bdi", { dir: "ltr", children: formatEgp(data.pettyCashExpensesPiastres) }) }), _jsx("div", { className: "text-[10px] text-slate-400 mt-1", children: "\u0645\u0633\u062D\u0648\u0628\u0627\u062A \u0627\u0644\u0639\u064A\u0627\u062F\u0629" })] }), _jsxs("div", { className: "bg-sky-50/80 rounded-xl border border-sky-200 p-4 shadow-2xs", children: [_jsxs("div", { className: "flex items-center justify-between text-sky-800 mb-1", children: [_jsx("span", { className: "text-[11px] font-bold", children: "\u0635\u0627\u0641\u064A \u0627\u0644\u0631\u0628\u062D / \u0627\u0644\u0646\u0642\u062F\u064A\u0629" }), _jsx(TrendingUp, { className: "w-4 h-4 text-sky-600" })] }), _jsx("div", { className: "text-base font-black text-sky-900", children: _jsx("bdi", { dir: "ltr", children: formatEgp(data.netClinicProfitPiastres) }) }), _jsx("div", { className: "text-[10px] text-sky-700 mt-1", children: "\u0627\u0644\u0645\u062D\u0635\u0644 - \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062A" })] })] })), data && (_jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsx("div", { className: "lg:col-span-2", children: _jsx(RevenueTrendChart, { data: data.dailyTrends || [], height: 280 }) }), _jsx("div", { className: "lg:col-span-1", children: _jsx(PaymentMethodDonutChart, { data: data.paymentMethods || {
                                        cashPiastres: 0,
                                        instapayPiastres: 0,
                                        vodafoneCashPiastres: 0,
                                        cardPiastres: 0,
                                        cashCount: 0,
                                        instapayCount: 0,
                                        vodafoneCashCount: 0,
                                        cardCount: 0,
                                    } }) })] })), data && (_jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 pb-3 border-b border-slate-100", children: [_jsx(Stethoscope, { className: "w-5 h-5 text-sky-600" }), _jsx("h2", { className: "font-bold text-slate-800 text-sm", children: "\u0645\u0624\u0634\u0631\u0627\u062A \u0627\u0644\u0625\u0646\u062A\u0627\u062C\u064A\u0629 \u0648\u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0633\u0631\u064A\u0631\u064A (Clinical Operations)" })] }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsxs("div", { className: "bg-slate-50 border border-slate-200 rounded-xl p-3.5", children: [_jsxs("div", { className: "flex items-center justify-between text-slate-500 mb-1 text-xs", children: [_jsx("span", { children: "\u0627\u0644\u0645\u0631\u0636\u0649 \u0627\u0644\u0645\u062A\u0631\u062F\u062F\u0648\u0646" }), _jsx(Users, { className: "w-4 h-4 text-sky-600" })] }), _jsxs("div", { className: "text-xl font-bold text-slate-900", children: [data.uniquePatientsCount, " ", _jsx("span", { className: "text-xs font-normal text-slate-400", children: "\u0645\u0631\u064A\u0636" })] }), _jsx("div", { className: "text-[10px] text-slate-400 mt-1", children: "\u0633\u062C\u0644\u0627\u062A \u0645\u0646\u0641\u0635\u0644\u0629" })] }), _jsxs("div", { className: "bg-slate-50 border border-slate-200 rounded-xl p-3.5", children: [_jsxs("div", { className: "flex items-center justify-between text-slate-500 mb-1 text-xs", children: [_jsx("span", { children: "\u0627\u0644\u0643\u0634\u0648\u0641\u0627\u062A \u0627\u0644\u0645\u0643\u062A\u0645\u0644\u0629" }), _jsx(Stethoscope, { className: "w-4 h-4 text-emerald-600" })] }), _jsxs("div", { className: "text-xl font-bold text-slate-900", children: [data.completedVisitsCount, " ", _jsx("span", { className: "text-xs font-normal text-slate-400", children: "\u0643\u0634\u0641" })] }), _jsxs("div", { className: "text-[10px] text-slate-400 mt-1", children: ["\u0645\u0646 \u0625\u062C\u0645\u0627\u0644\u064A ", data.totalAppointmentsCount, " \u062D\u062C\u0632"] })] }), _jsxs("div", { className: "bg-slate-50 border border-slate-200 rounded-xl p-3.5", children: [_jsxs("div", { className: "flex items-center justify-between text-slate-500 mb-1 text-xs", children: [_jsx("span", { children: "\u0645\u062A\u0648\u0633\u0637 \u0648\u0642\u062A \u0627\u0644\u0643\u0634\u0641" }), _jsx(Clock, { className: "w-4 h-4 text-indigo-600" })] }), _jsxs("div", { className: "text-xl font-bold text-indigo-700", children: [data.averageConsultationDurationMinutes, ' ', _jsx("span", { className: "text-xs font-normal text-slate-400", children: "\u062F\u0642\u064A\u0642\u0629" })] }), _jsx("div", { className: "text-[10px] text-slate-400 mt-1", children: "\u062F\u0627\u062E\u0644 \u063A\u0631\u0641\u0629 \u0627\u0644\u0637\u0628\u064A\u0628" })] }), _jsxs("div", { className: "bg-slate-50 border border-slate-200 rounded-xl p-3.5", children: [_jsxs("div", { className: "flex items-center justify-between text-slate-500 mb-1 text-xs", children: [_jsx("span", { children: "\u0645\u062A\u0648\u0633\u0637 \u0632\u0645\u0646 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631" }), _jsx(Clock, { className: "w-4 h-4 text-amber-600" })] }), _jsxs("div", { className: "text-xl font-bold text-amber-700", children: [data.averageWaitTimeMinutes, ' ', _jsx("span", { className: "text-xs font-normal text-slate-400", children: "\u062F\u0642\u064A\u0642\u0629" })] }), _jsx("div", { className: "text-[10px] text-slate-400 mt-1", children: "\u0645\u0646 \u0627\u0644\u0648\u0635\u0648\u0644 \u062D\u062A\u0649 \u0627\u0644\u0627\u0633\u062A\u062F\u0639\u0627\u0621" })] })] })] }))] })] }));
}
