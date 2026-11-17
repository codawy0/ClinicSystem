import React, { useState, useEffect } from 'react';
import { Search, UserPlus, AlertCircle, CheckCircle, ShieldAlert, Phone } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useDebounce } from '../../hooks/useDebounce';
import { api, ShiftRequiredException } from '../../lib/api';
import { formatEgp, parseEgpToPiastres } from '../../lib/currency';
import { PatientSearchResultDto, ThermalReceiptDto, PaymentMethod, DiscountReason } from '../../types';

interface SearchBookingPanelProps {
  isShiftOpen: boolean;
  onAppointmentCreated: (receipt: ThermalReceiptDto) => void;
  onShiftRequired: () => void;
}

export function SearchBookingPanel({
  isShiftOpen,
  onAppointmentCreated,
  onShiftRequired,
}: SearchBookingPanelProps) {
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 250);
  const [searchResults, setSearchResults] = useState<PatientSearchResultDto[]>([]);

  // Selected patient
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResultDto | null>(null);

  // Quick new patient form
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAgeYears, setNewAgeYears] = useState('');
  const [newGender, setNewGender] = useState<'Male' | 'Female'>('Male');
  const [isRegisteringPatient, setIsRegisteringPatient] = useState(false);

  // Booking fields
  const [selectedDoctorId] = useState<number>(2);
  const [selectedServiceId, setSelectedServiceId] = useState<number>(1);
  const [serviceType, setServiceType] = useState<'Exam' | 'Consultation'>('Exam');
  const [servicePriceEgp, setServicePriceEgp] = useState<number>(300);
  const [selectedProcedures, setSelectedProcedures] = useState<{ id: number; name: string; priceEgp: number }[]>([]);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isWalkIn, setIsWalkIn] = useState(true);

  // Financial fields
  const [discountReason, setDiscountReason] = useState<DiscountReason>('None');
  const [discountAmountEgp, setDiscountAmountEgp] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search effect
  useEffect(() => {
    if (!debouncedSearch.trim() || debouncedSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    let active = true;

    api.get<PatientSearchResultDto[]>('/patients/search', { q: debouncedSearch.trim() })
      .then((data) => {
        if (active) setSearchResults(data || []);
      })
      .catch((err) => {
        console.warn('Search query error:', err);
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch]);

  // When patient is selected, check consultation eligibility
  const handleSelectPatient = async (patient: PatientSearchResultDto) => {
    setSelectedPatient(patient);
    setSearchTerm('');
    setSearchResults([]);

    try {
      const eligibility = await api.get<{
        isEligible: boolean;
        daysRemaining: number;
        parentExamAppointmentId?: number;
        reason: string;
      }>(`/patients/${patient.id}/consultation-eligibility`);

      if (eligibility && eligibility.isEligible) {
        setServiceType('Consultation');
        setSelectedServiceId(2);
        setServicePriceEgp(0);
        setSelectedPatient({
          ...patient,
          consultationEligibility: eligibility,
        });
      } else {
        setServiceType('Exam');
        setSelectedServiceId(1);
        setServicePriceEgp(300);
        setSelectedPatient({
          ...patient,
          consultationEligibility: eligibility || { isEligible: false, daysRemaining: 0, reason: 'كشف جديد' },
        });
      }
    } catch {
      setServiceType('Exam');
      setSelectedServiceId(1);
      setServicePriceEgp(300);
    }
  };

  // Register new patient
  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newPhone.trim()) {
      setError('يرجى إدخال اسم المريض ورقم الهاتف');
      return;
    }

    setError(null);
    setIsRegisteringPatient(true);

    try {
      const created = await api.post<PatientSearchResultDto>('/patients', {
        fullName: newFullName.trim(),
        phone: newPhone.trim(),
        ageYears: newAgeYears ? parseInt(newAgeYears) : undefined,
        gender: newGender,
      });

      setSelectedPatient(created);
      setShowNewPatientForm(false);
      setNewFullName('');
      setNewPhone('');
      setNewAgeYears('');
      setServiceType('Exam');
      setSelectedServiceId(1);
      setServicePriceEgp(300);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تسجيل المريض');
    } finally {
      setIsRegisteringPatient(false);
    }
  };

  // Calculate pricing
  const totalBaseEgp = servicePriceEgp + selectedProcedures.reduce((sum, p) => sum + p.priceEgp, 0);
  const discountEgp = parseFloat(discountAmountEgp) || 0;
  const netTotalEgp = Math.max(0, totalBaseEgp - discountEgp);

  // Submit appointment & invoice
  const handleSubmitBooking = async () => {
    if (!isShiftOpen) {
      onShiftRequired();
      return;
    }

    if (!selectedPatient) {
      setError('يرجى اختيار مريض أولاً');
      return;
    }

    setError(null);
    setIsSubmittingBooking(true);

    try {
      const res = await api.post<{
        appointmentId: number;
        queueNumber: number | null;
        receipt: ThermalReceiptDto;
      }>('/appointments', {
        patientId: selectedPatient.id,
        doctorUserId: selectedDoctorId || 2,
        serviceId: selectedServiceId || (serviceType === 'Consultation' ? 2 : (isUrgent ? 3 : 1)),
        isConsultation: serviceType === 'Consultation',
        isUrgent,
        isWalkIn,
        procedureIds: selectedProcedures.map((p) => p.id),
        discountReason: discountReason !== 'None' ? discountReason : undefined,
        discountAmountPiastres: parseEgpToPiastres(discountEgp),
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        paidAmountPiastres: parseEgpToPiastres(netTotalEgp),
      });

      // Reset selection
      setSelectedPatient(null);
      setSelectedProcedures([]);
      setDiscountAmountEgp('0');
      setDiscountReason('None');
      setPaymentReference('');

      if (res.receipt) {
        onAppointmentCreated(res.receipt);
      }
    } catch (err: any) {
      if (err instanceof ShiftRequiredException) {
        onShiftRequired();
      } else {
        setError(err.message || 'فشل تسجيل الحجز');
      }
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-sky-600" />
          البحث والحجز الفوري
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowNewPatientForm(!showNewPatientForm);
            setSelectedPatient(null);
          }}
          className="text-xs py-1"
        >
          {showNewPatientForm ? 'العودة للبحث' : '+ تسجيل مريض جديد'}
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Mode A: New Patient Inline Form */}
      {showNewPatientForm ? (
        <form onSubmit={handleRegisterPatient} className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <div className="font-bold text-slate-800">بيانات المريض الجديد</div>
          <Input
            label="الاسم ثلاثي أو رباعي"
            value={newFullName}
            onChange={(e) => setNewFullName(e.target.value)}
            placeholder="مثال: محمد أحمد علي..."
            required
          />
          <Input
            label="رقم الهاتف المحمول"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="01012345678"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="العمر (بالسنوات)"
              type="number"
              value={newAgeYears}
              onChange={(e) => setNewAgeYears(e.target.value)}
              placeholder="35"
            />
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">النوع</label>
              <select
                value={newGender}
                onChange={(e) => setNewGender(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"
              >
                <option value="Male">ذكر</option>
                <option value="Female">أنثى</option>
              </select>
            </div>
          </div>
          <Button type="submit" variant="primary" disabled={isRegisteringPatient} className="w-full text-xs">
            {isRegisteringPatient ? 'جاري الحفظ...' : 'حفظ المريض ومتابعة الحجز'}
          </Button>
        </form>
      ) : (
        /* Mode B: Patient Search & Family Cards */
        <div className="space-y-3">
          <div className="relative">
            <Input
              placeholder="ابحث بالاسم، رقم الموبايل، أو رقم الملف الورقي..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-9 text-xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute top-3 right-3" />
          </div>

          {/* Search Dropdown Results */}
          {searchResults.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg divide-y divide-slate-100">
              {searchResults.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleSelectPatient(p)}
                  className="p-2.5 hover:bg-sky-50/70 cursor-pointer transition-colors text-right"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">{p.fullName}</span>
                    <span className="text-[10px] font-mono text-slate-500">ملف: #{p.fileNumber}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {p.phone}
                    </span>
                    {p.ageYears != null && <span>العمر: {p.ageYears} سنة</span>}
                    <span>{p.gender === 'Male' ? 'ذكر' : 'أنثى'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active Selected Patient Card */}
          {selectedPatient && (
            <div className="p-3 bg-sky-50/60 border border-sky-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sky-950 text-xs">{selectedPatient.fullName}</h4>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    ملف: #{selectedPatient.fileNumber} • {selectedPatient.phone}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPatient(null)}
                  className="text-[10px] text-slate-500 hover:text-rose-600 h-6 px-2"
                >
                  تغيير
                </Button>
              </div>

              {/* Consultation Eligibility Badge */}
              {selectedPatient.consultationEligibility && (
                <div>
                  {selectedPatient.consultationEligibility.isEligible ? (
                    <div className="p-2 bg-emerald-100/70 border border-emerald-300 rounded-lg text-[11px] text-emerald-900 font-semibold flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>
                        استشارة مجانية متاحة (متبقي {selectedPatient.consultationEligibility.daysRemaining} يوم)
                      </span>
                    </div>
                  ) : (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>{selectedPatient.consultationEligibility.reason || 'كشف جديد مطلوب'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Booking Form (Enabled when patient selected) */}
      {selectedPatient && (
        <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
          {/* Service Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">نوع الخدمة الرئيسية</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setServiceType('Exam');
                  setSelectedServiceId(1);
                  setServicePriceEgp(300);
                }}
                className={`p-2 rounded-lg border text-center font-bold transition-all ${
                  serviceType === 'Exam'
                    ? 'border-sky-600 bg-sky-50 text-sky-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                كشف جديد (300 ج.م)
              </button>
              <button
                type="button"
                onClick={() => {
                  setServiceType('Consultation');
                  setSelectedServiceId(2);
                  setServicePriceEgp(0);
                }}
                className={`p-2 rounded-lg border text-center font-bold transition-all ${
                  serviceType === 'Consultation'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                استشارة (0.00 ج.م)
              </button>
            </div>
          </div>

          {/* Quick Procedure Add-ons */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">إجراءات وخدمات إضافية</label>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              {[
                { id: 10, name: 'سونار بطن وحوض', priceEgp: 150 },
                { id: 11, name: 'رسم قلب ECG', priceEgp: 100 },
                { id: 12, name: 'فتح ملف جديد', priceEgp: 50 },
                { id: 13, name: 'غيار جراحي', priceEgp: 80 },
              ].map((proc) => {
                const isSelected = selectedProcedures.some((p) => p.id === proc.id);
                return (
                  <button
                    key={proc.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedProcedures(selectedProcedures.filter((p) => p.id !== proc.id));
                      } else {
                        setSelectedProcedures([...selectedProcedures, proc]);
                      }
                    }}
                    className={`p-1.5 rounded-lg border text-right transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50 text-sky-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{proc.name}</span>
                    <span className="font-mono text-[10px]">+{proc.priceEgp}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Discount Selector */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">سبب الخصم</label>
              <select
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value as DiscountReason)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
              >
                <option value="None">بدون خصم</option>
                <option value="Colleague">طبيب زميل</option>
                <option value="Staff">موظف عيادة</option>
                <option value="Charity">حالة إنسانية</option>
                <option value="DoctorCustom">خصم من الطبيب</option>
              </select>
            </div>
            {discountReason !== 'None' && (
              <div>
                <Input
                  label="قيمة الخصم (ج.م)"
                  type="number"
                  value={discountAmountEgp}
                  onChange={(e) => setDiscountAmountEgp(e.target.value)}
                  min="0"
                  max={totalBaseEgp}
                />
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">طريقة السداد</label>
            <div className="grid grid-cols-4 gap-1 text-[11px]">
              {(['Cash', 'Instapay', 'VodafoneCash', 'Card'] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`p-1.5 rounded-lg border font-semibold text-center transition-all ${
                    paymentMethod === method
                      ? 'border-sky-600 bg-sky-600 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {method === 'Cash' && 'نقدي'}
                  {method === 'Instapay' && 'إنستاباي'}
                  {method === 'VodafoneCash' && 'فودافون'}
                  {method === 'Card' && 'بطاقة'}
                </button>
              ))}
            </div>
          </div>

          {/* Reference Number for electronic payments */}
          {paymentMethod !== 'Cash' && (
            <div>
              <Input
                label={paymentMethod === 'VodafoneCash' ? 'رقم المحفظة المحول منها' : 'رقم العملية / المرجع'}
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="أدخل الرقم المرجعي للتحقق..."
                required
              />
            </div>
          )}

          {/* Checkboxes: Urgent & WalkIn */}
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4"
              />
              <span className="font-semibold text-rose-800">حالة مستعجلة (أولوية الدور)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isWalkIn}
                onChange={(e) => setIsWalkIn(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
              />
              <span className="text-slate-700">حضور مباشر (Walk-In)</span>
            </label>
          </div>

          {/* Pricing Summary */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="flex justify-between text-slate-600 text-xs">
              <span>إجمالي الخدمات:</span>
              <span className="font-mono">{formatEgp(parseEgpToPiastres(totalBaseEgp))}</span>
            </div>
            {discountEgp > 0 && (
              <div className="flex justify-between text-rose-600 text-xs">
                <span>الخصم:</span>
                <span className="font-mono">-{formatEgp(parseEgpToPiastres(discountEgp))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-slate-200">
              <span>الصافي المطلوب سداده:</span>
              <span className="text-emerald-700 font-mono text-base">{formatEgp(parseEgpToPiastres(netTotalEgp))}</span>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="button"
            variant="primary"
            disabled={isSubmittingBooking || !isShiftOpen}
            onClick={handleSubmitBooking}
            className="w-full py-2.5 text-xs font-bold shadow-md bg-emerald-600 hover:bg-emerald-700"
          >
            {!isShiftOpen ? (
              <span className="flex items-center justify-center gap-1">
                <ShieldAlert className="w-4 h-4" />
                يجب فتح وردية أولاً لتسجيل الحجز
              </span>
            ) : isSubmittingBooking ? (
              'جاري إصدار الحجز والإيصال...'
            ) : (
              'تأكيد الحجز وطباعة الإيصال (80mm)'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
