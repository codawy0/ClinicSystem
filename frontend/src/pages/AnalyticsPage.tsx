import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Clock,
  RefreshCw,
  AlertCircle,
  Stethoscope,
  Percent,
  Receipt,
  Wallet,
} from 'lucide-react';
import { AppNavbar } from '../components/layout/AppNavbar';
import { Button } from '../components/ui/button';
import { RevenueTrendChart } from '../components/analytics/RevenueTrendChart';
import { PaymentMethodDonutChart } from '../components/analytics/PaymentMethodDonutChart';
import { AnalyticsKpiDto, AnalyticsFilterParams } from '../types/analytics';
import { analyticsService } from '../services/analyticsService';
import { formatEgp } from '../lib/currency';
import { authStorage, ApiException } from '../lib/api';

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsKpiDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'week' | 'month'>('month');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('ALL');

  const currentUser = authStorage.getUser();
  const isAdmin = currentUser?.role === 'Admin';

  useEffect(() => {
    loadAnalytics();
  }, [datePreset, selectedDoctorId]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);

    const now = new Date();
    let startDate: string | undefined = undefined;
    let endDate: string | undefined = now.toISOString().split('T')[0];

    if (datePreset === 'today') {
      startDate = endDate;
    } else if (datePreset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      startDate = y.toISOString().split('T')[0];
      endDate = startDate;
    } else if (datePreset === 'week') {
      const w = new Date(now);
      w.setDate(w.getDate() - 7);
      startDate = w.toISOString().split('T')[0];
    } else if (datePreset === 'month') {
      const m = new Date(now);
      m.setDate(m.getDate() - 30);
      startDate = m.toISOString().split('T')[0];
    }

    const params: AnalyticsFilterParams = {
      startDate,
      endDate,
      doctorId: selectedDoctorId !== 'ALL' ? parseInt(selectedDoctorId) : undefined,
    };

    try {
      const res = await analyticsService.getKpis(params);
      setData(res);
    } catch (err: any) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppNavbar currentPath="/analytics" />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Header & Filter Presets */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-sky-600" />
              <span>لوحة التحليلات والمؤشرات المالية والسريرية</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              متابعة دقيقة لحجم الإيرادات، الخصومات، زمن الانتظار، وإنتاجية العيادة
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date range presets */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDatePreset('today')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  datePreset === 'today' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('yesterday')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  datePreset === 'yesterday' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                أمس
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('week')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  datePreset === 'week' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                آخر 7 أيام
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('month')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  datePreset === 'month' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                آخر 30 يوماً
              </button>
            </div>

            {/* Doctor Filter (Admin Only) */}
            {isAdmin && (
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
              >
                <option value="ALL">جميع أطباء العيادة</option>
                <option value="2">د. أحمد عبد الرحمن</option>
                <option value="3">د. منى محمود (مساعد)</option>
              </select>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadAnalytics}
              disabled={loading}
              className="gap-1 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </Button>
          </div>
        </div>

        {/* Executive KPI Summary Cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Gross Revenue */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold">إجمالي الفواتير</span>
                <Receipt className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-base font-bold text-slate-900">
                <bdi dir="ltr">{formatEgp(data.grossRevenuePiastres)}</bdi>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">قبل الخصومات</div>
            </div>

            {/* Foregone Discounts */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold">الخصومات الممنوحة</span>
                <Percent className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-base font-bold text-amber-700">
                <bdi dir="ltr">{formatEgp(data.foregoneDiscountsPiastres)}</bdi>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {data.grossRevenuePiastres > 0
                  ? `نسبة %${((data.foregoneDiscountsPiastres / data.grossRevenuePiastres) * 100).toFixed(1)}`
                  : '0%'}
              </div>
            </div>

            {/* Net Billed Revenue */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold">صافي المطلوب</span>
                <DollarSign className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-base font-bold text-indigo-700">
                <bdi dir="ltr">{formatEgp(data.netRevenuePiastres)}</bdi>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">بعد استقطاع الخصم</div>
            </div>

            {/* Paid Revenue */}
            <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 p-4 shadow-2xs">
              <div className="flex items-center justify-between text-emerald-800 mb-1">
                <span className="text-[11px] font-semibold">المحصل فعلياً</span>
                <Wallet className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-base font-bold text-emerald-700">
                <bdi dir="ltr">{formatEgp(data.paidRevenuePiastres)}</bdi>
              </div>
              <div className="text-[10px] text-emerald-600 mt-1">نقدياً وإلكترونياً</div>
            </div>

            {/* Petty Expenses */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold">المصروفات النثرية</span>
                <TrendingDown className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-base font-bold text-rose-600">
                <bdi dir="ltr">{formatEgp(data.pettyCashExpensesPiastres)}</bdi>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">مسحوبات العيادة</div>
            </div>

            {/* Net Profit */}
            <div className="bg-sky-50/80 rounded-xl border border-sky-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between text-sky-800 mb-1">
                <span className="text-[11px] font-bold">صافي الربح / النقدية</span>
                <TrendingUp className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-base font-black text-sky-900">
                <bdi dir="ltr">{formatEgp(data.netClinicProfitPiastres)}</bdi>
              </div>
              <div className="text-[10px] text-sky-700 mt-1">المحصل - المصروفات</div>
            </div>
          </div>
        )}

        {/* Charts Section */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily Revenue Trend (2 cols) */}
            <div className="lg:col-span-2">
              <RevenueTrendChart data={data.dailyTrends || []} height={280} />
            </div>

            {/* Payment Method Donut (1 col) */}
            <div className="lg:col-span-1">
              <PaymentMethodDonutChart
                data={
                  data.paymentMethods || {
                    cashPiastres: 0,
                    instapayPiastres: 0,
                    vodafoneCashPiastres: 0,
                    cardPiastres: 0,
                    cashCount: 0,
                    instapayCount: 0,
                    vodafoneCashCount: 0,
                    cardCount: 0,
                  }
                }
              />
            </div>
          </div>
        )}

        {/* Clinical & Operational Productivity KPIs */}
        {data && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Stethoscope className="w-5 h-5 text-sky-600" />
              <h2 className="font-bold text-slate-800 text-sm">
                مؤشرات الإنتاجية والانتظار السريري (Clinical Operations)
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Unique Patients */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <div className="flex items-center justify-between text-slate-500 mb-1 text-xs">
                  <span>المرضى المترددون</span>
                  <Users className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {data.uniquePatientsCount} <span className="text-xs font-normal text-slate-400">مريض</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">سجلات منفصلة</div>
              </div>

              {/* Completed Consultations */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <div className="flex items-center justify-between text-slate-500 mb-1 text-xs">
                  <span>الكشوفات المكتملة</span>
                  <Stethoscope className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {data.completedVisitsCount} <span className="text-xs font-normal text-slate-400">كشف</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  من إجمالي {data.totalAppointmentsCount} حجز
                </div>
              </div>

              {/* Average Consultation Duration */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <div className="flex items-center justify-between text-slate-500 mb-1 text-xs">
                  <span>متوسط وقت الكشف</span>
                  <Clock className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-xl font-bold text-indigo-700">
                  {data.averageConsultationDurationMinutes}{' '}
                  <span className="text-xs font-normal text-slate-400">دقيقة</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">داخل غرفة الطبيب</div>
              </div>

              {/* Average Wait Time */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <div className="flex items-center justify-between text-slate-500 mb-1 text-xs">
                  <span>متوسط زمن الانتظار</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-xl font-bold text-amber-700">
                  {data.averageWaitTimeMinutes}{' '}
                  <span className="text-xs font-normal text-slate-400">دقيقة</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">من الوصول حتى الاستدعاء</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
