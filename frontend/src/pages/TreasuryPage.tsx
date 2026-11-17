import { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Search,
  RefreshCw,
  CreditCard,
  RotateCcw,
  Ban,
  Printer,
  FileText,
  AlertCircle,
  TrendingDown,
  Wallet,
  CheckCircle2,
} from 'lucide-react';
import { AppNavbar } from '../components/layout/AppNavbar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { PartialPaymentModal } from '../components/treasury/PartialPaymentModal';
import { RefundModal } from '../components/treasury/RefundModal';
import { VoidInvoiceModal } from '../components/treasury/VoidInvoiceModal';
import { PettyExpenseModal } from '../components/reception/PettyExpenseModal';
import { InvoiceListItemDto, InvoiceDetailDto } from '../types/treasury';
import { CurrentShiftStatusDto, ThermalReceiptDto } from '../types';
import { treasuryService } from '../services/treasuryService';
import { printService } from '../services/printService';
import { api, authStorage, ApiException } from '../lib/api';
import { formatEgp } from '../lib/currency';
import { ArabicNormalizer } from '../lib/arabicNormalizer';

export function TreasuryPage() {
  const [shiftStatus, setShiftStatus] = useState<CurrentShiftStatusDto | null>(null);
  const [invoices, setInvoices] = useState<InvoiceListItemDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'all'>('today');

  // Modals state
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceListItemDto | null>(null);
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
        const shiftRes = await api.get<CurrentShiftStatusDto>('/shifts/current');
        setShiftStatus(shiftRes);
      } catch {
        // Shift endpoint might return empty if no shift is currently open
        setShiftStatus(null);
      }

      // 2. Fetch invoices
      const now = new Date();
      let startDateStr: string | undefined = undefined;

      if (dateFilter === 'today') {
        const todayStr = now.toISOString().split('T')[0];
        startDateStr = todayStr;
      } else if (dateFilter === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        startDateStr = yesterday.toISOString().split('T')[0];
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        startDateStr = weekAgo.toISOString().split('T')[0];
      }

      const invs = await treasuryService.getInvoices({
        startDate: startDateStr,
      });

      setInvoices(invs || []);
    } catch (err: any) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError('تعذر تحميل بيانات الخزينة والفواتير');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentRecorded = (updated: InvoiceDetailDto) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === updated.id ? { ...inv, ...updated } : inv))
    );
    showNotice(`تم تسجيل سداد للفاتورة #${updated.id} بنجاح`);
    loadAllData();
  };

  const handleRefundProcessed = (res: { transactionId: number; newBalancePiastres: number; invoice: InvoiceDetailDto }) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === res.invoice.id ? { ...inv, ...res.invoice } : inv))
    );
    showNotice(`تم استرجاع مبلغ للفاتورة #${res.invoice.id} بنجاح`);
    loadAllData();
  };

  const handleInvoiceVoided = (updated: InvoiceDetailDto) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === updated.id ? { ...inv, ...updated } : inv))
    );
    showNotice(`تم إلغاء الفاتورة #${updated.id} وعكس المعاملات بنجاح`);
    loadAllData();
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const handlePrintReceipt = async (inv: InvoiceListItemDto) => {
    try {
      const receiptData: ThermalReceiptDto = {
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
    } catch {
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

        const matches =
          normName.includes(normSearch) ||
          normPhone.includes(normSearch) ||
          normFile.toLowerCase().includes(normSearch.toLowerCase()) ||
          invIdStr.includes(normSearch);

        if (!matches) return false;
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppNavbar currentPath="/treasury" />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Notice & Error */}
        {notice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Wallet className="w-6 h-6 text-sky-600" />
              <span>الخزينة والمالية والمدفوعات</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              إدارة حركة درج النقدية، تحصيل الأقساط، استرجاع المبالغ، وإلغاء الفواتير
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeShift && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPettyExpenseOpen(true)}
                className="gap-1.5 text-xs text-amber-700 hover:text-amber-800 border-amber-200 hover:bg-amber-50"
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>تسجيل مصروف نثري</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadAllData}
              disabled={loading}
              className="gap-1 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </Button>
          </div>
        </div>

        {/* Cash Drawer Status Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-slate-800 text-sm">
                حالة درج النقدية للوردية الحالية
              </h2>
            </div>
            {activeShift ? (
              <Badge variant="success">وردية نشطة (يوم العمل: {activeShift.businessDate})</Badge>
            ) : (
              <Badge variant="warning">لا توجد وردية مفتوحة حالياً</Badge>
            )}
          </div>

          {activeShift ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {/* Expected Cash in Drawer */}
              <div className="col-span-2 md:col-span-1 bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5">
                <span className="text-[11px] font-semibold text-emerald-800 block mb-1">
                  النقدية المتوقعة بالدرج
                </span>
                <span className="text-xl font-black text-emerald-700">
                  <bdi dir="ltr">{formatEgp(activeShift.expectedClosingCashPiastres)}</bdi>
                </span>
              </div>

              {/* Opening Balance */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  الرصيد الافتتاحي
                </span>
                <span className="text-sm font-bold text-slate-800">
                  <bdi dir="ltr">{formatEgp(activeShift.openingBalancePiastres)}</bdi>
                </span>
              </div>

              {/* Cash Collections */}
              <div className="bg-sky-50/60 border border-sky-200 rounded-xl p-3.5">
                <span className="text-[11px] font-semibold text-sky-800 block mb-1">
                  مقبوضات كاش (+)
                </span>
                <span className="text-sm font-bold text-sky-700">
                  <bdi dir="ltr">{formatEgp(activeShift.cashPaymentsPiastres)}</bdi>
                </span>
              </div>

              {/* Digital Collections */}
              <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3.5">
                <span className="text-[11px] font-semibold text-purple-800 block mb-1">
                  تحصيل إلكتروني (محافظ/كروت)
                </span>
                <span className="text-sm font-bold text-purple-700">
                  <bdi dir="ltr">
                    {formatEgp(
                      (activeShift.instapayTotalPiastres || activeShift.totalInstapayPiastres || 0) +
                        (activeShift.vodafoneCashTotalPiastres || activeShift.totalVodafoneCashPiastres || 0) +
                        (activeShift.cardTotalPiastres || activeShift.totalCardPiastres || 0)
                    )}
                  </bdi>
                </span>
              </div>

              {/* Cash Expenses & Refunds */}
              <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3.5">
                <span className="text-[11px] font-semibold text-rose-800 block mb-1">
                  مصروفات ومسترجعات (-)
                </span>
                <span className="text-sm font-bold text-rose-700">
                  <bdi dir="ltr">
                    {formatEgp(
                      (activeShift.cashExpensesPiastres || 0) + (activeShift.cashRefundsPiastres || 0)
                    )}
                  </bdi>
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-slate-400">
              يرجى فتح وردية جديدة من شاشة الاستقبال لتفعيل تسجيل المقبوضات النقدية ومتابعة الدرج.
            </div>
          )}
        </div>

        {/* Invoices & Ledger Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-5">
          {/* Header & Filter Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-600" />
                <h2 className="font-bold text-slate-800 text-sm">سجل الفواتير والمعاملات المالية</h2>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">
                  المطلوب: <strong className="text-slate-800"><bdi dir="ltr">{formatEgp(totalBilled)}</bdi></strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-emerald-700">
                  المحصل: <strong><bdi dir="ltr">{formatEgp(totalCollected)}</bdi></strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-rose-600">
                  المتبقي: <strong><bdi dir="ltr">{formatEgp(totalRemaining)}</bdi></strong>
                </span>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Date Presets */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setDateFilter('today')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    dateFilter === 'today' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('yesterday')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    dateFilter === 'yesterday' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  أمس
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('week')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    dateFilter === 'week' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  أسبوع
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    dateFilter === 'all' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  الكل
                </button>
              </div>

              {/* Status Select */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
              >
                <option value="ALL">جميع الحالات</option>
                <option value="Paid">مسددة بالكامل</option>
                <option value="Partial">سداد جزئي</option>
                <option value="Unpaid">غير مسددة</option>
                <option value="Voided">ملغاة</option>
              </select>

              {/* Search */}
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  placeholder="بحث بالمريض أو الفاتورة..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-8 h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-3">رقم الفاتورة</th>
                  <th className="py-3 px-3">المريض / الملف</th>
                  <th className="py-3 px-3">الخدمة</th>
                  <th className="py-3 px-3">القيمة الصافية</th>
                  <th className="py-3 px-3">المسدد</th>
                  <th className="py-3 px-3">المتبقي</th>
                  <th className="py-3 px-3">المسترجع</th>
                  <th className="py-3 px-3">الحالة</th>
                  <th className="py-3 px-3 text-center">إجراءات الخزينة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      {loading ? 'جاري تحميل سجل الفواتير...' : 'لا توجد فواتير مطابقة للبحث أو الفترة المحددة.'}
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        inv.status === 'Voided' ? 'opacity-50 bg-slate-50/40 line-through' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">
                        <bdi dir="ltr">#{inv.id}</bdi>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{inv.patientName}</div>
                        <div className="text-[11px] text-slate-400">
                          <bdi dir="ltr">{inv.fileNumber}</bdi> • <bdi dir="ltr">{inv.patientPhone}</bdi>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-700">{inv.serviceName}</td>
                      <td className="py-3 px-3 font-bold text-slate-800">
                        <bdi dir="ltr">{formatEgp(inv.netTotalPiastres)}</bdi>
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-700">
                        <bdi dir="ltr">{formatEgp(inv.paidPiastres)}</bdi>
                      </td>
                      <td className="py-3 px-3 font-bold text-rose-600">
                        <bdi dir="ltr">{formatEgp(inv.remainingPiastres)}</bdi>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-500">
                        {inv.refundedPiastres > 0 ? (
                          <span className="text-amber-700">
                            <bdi dir="ltr">{formatEgp(inv.refundedPiastres)}</bdi>
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            inv.status === 'Paid'
                              ? 'success'
                              : inv.status === 'Partial'
                              ? 'warning'
                              : inv.status === 'Unpaid'
                              ? 'danger'
                              : 'default'
                          }
                        >
                          {inv.status === 'Paid'
                            ? 'مسددة'
                            : inv.status === 'Partial'
                            ? 'سداد جزئي'
                            : inv.status === 'Unpaid'
                            ? 'غير مسددة'
                            : 'ملغاة'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Record Payment Button */}
                          {inv.status !== 'Voided' && inv.remainingPiastres > 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setIsPaymentModalOpen(true);
                              }}
                              className="h-7 px-2 text-[11px] gap-1 text-sky-700 border-sky-200 hover:bg-sky-50"
                              title="سداد قسط أو كامل المبلغ"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>سداد</span>
                            </Button>
                          )}

                          {/* Refund Button */}
                          {inv.status !== 'Voided' && inv.paidPiastres > (inv.refundedPiastres || 0) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setIsRefundModalOpen(true);
                              }}
                              className="h-7 px-2 text-[11px] gap-1 text-amber-700 hover:bg-amber-50"
                              title="استرجاع مالي"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>استرجاع</span>
                            </Button>
                          )}

                          {/* Print Receipt */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePrintReceipt(inv)}
                            className="h-7 px-1.5 text-slate-500 hover:text-slate-800"
                            title="طباعة إيصال حراري"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>

                          {/* Void Button */}
                          {inv.status !== 'Voided' && canVoid && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setIsVoidModalOpen(true);
                              }}
                              className="h-7 px-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                              title="إلغاء الفاتورة نهائياً"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Partial Payment Modal */}
      <PartialPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        invoice={selectedInvoice}
        onPaymentRecorded={handlePaymentRecorded}
      />

      {/* Refund Modal */}
      <RefundModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        invoice={selectedInvoice}
        onRefundProcessed={handleRefundProcessed}
      />

      {/* Void Invoice Modal */}
      <VoidInvoiceModal
        isOpen={isVoidModalOpen}
        onClose={() => setIsVoidModalOpen(false)}
        invoice={selectedInvoice}
        onInvoiceVoided={handleInvoiceVoided}
      />

      {/* Petty Expense Modal */}
      {activeShift && (
        <PettyExpenseModal
          isOpen={isPettyExpenseOpen}
          onClose={() => setIsPettyExpenseOpen(false)}
          shiftId={activeShift.shiftId || activeShift.id || 1}
          onExpenseRecorded={() => {
            showNotice('تم تسجيل المصروف النثري بنجاح');
            loadAllData();
          }}
        />
      )}
    </div>
  );
}
