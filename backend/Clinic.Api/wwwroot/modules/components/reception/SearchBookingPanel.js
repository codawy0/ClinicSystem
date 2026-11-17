import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Search, UserPlus, AlertCircle, CheckCircle, ShieldAlert, Phone } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useDebounce } from '../../hooks/useDebounce';
import { api, ShiftRequiredException } from '../../lib/api';
import { formatEgp, parseEgpToPiastres } from '../../lib/currency';
export function SearchBookingPanel({ isShiftOpen, onAppointmentCreated, onShiftRequired, }) {
    // Search state
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 250);
    const [searchResults, setSearchResults] = useState([]);
    // Selected patient
    const [selectedPatient, setSelectedPatient] = useState(null);
    // Quick new patient form
    const [showNewPatientForm, setShowNewPatientForm] = useState(false);
    const [newFullName, setNewFullName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newAgeYears, setNewAgeYears] = useState('');
    const [newGender, setNewGender] = useState('Male');
    const [isRegisteringPatient, setIsRegisteringPatient] = useState(false);
    // Booking fields
    const [selectedDoctorId] = useState(2);
    const [selectedServiceId, setSelectedServiceId] = useState(1);
    const [serviceType, setServiceType] = useState('Exam');
    const [servicePriceEgp, setServicePriceEgp] = useState(300);
    const [selectedProcedures, setSelectedProcedures] = useState([]);
    const [isUrgent, setIsUrgent] = useState(false);
    const [isWalkIn, setIsWalkIn] = useState(true);
    // Financial fields
    const [discountReason, setDiscountReason] = useState('None');
    const [discountAmountEgp, setDiscountAmountEgp] = useState('0');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [paymentReference, setPaymentReference] = useState('');
    const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
    const [error, setError] = useState(null);
    // Search effect
    useEffect(() => {
        if (!debouncedSearch.trim() || debouncedSearch.length < 2) {
            setSearchResults([]);
            return;
        }
        let active = true;
        api.get('/patients/search', { q: debouncedSearch.trim() })
            .then((data) => {
            if (active)
                setSearchResults(data || []);
        })
            .catch((err) => {
            console.warn('Search query error:', err);
        });
        return () => {
            active = false;
        };
    }, [debouncedSearch]);
    // When patient is selected, check consultation eligibility
    const handleSelectPatient = async (patient) => {
        setSelectedPatient(patient);
        setSearchTerm('');
        setSearchResults([]);
        try {
            const eligibility = await api.get(`/patients/${patient.id}/consultation-eligibility`);
            if (eligibility && eligibility.isEligible) {
                setServiceType('Consultation');
                setSelectedServiceId(2);
                setServicePriceEgp(0);
                setSelectedPatient({
                    ...patient,
                    consultationEligibility: eligibility,
                });
            }
            else {
                setServiceType('Exam');
                setSelectedServiceId(1);
                setServicePriceEgp(300);
                setSelectedPatient({
                    ...patient,
                    consultationEligibility: eligibility || { isEligible: false, daysRemaining: 0, reason: 'كشف جديد' },
                });
            }
        }
        catch {
            setServiceType('Exam');
            setSelectedServiceId(1);
            setServicePriceEgp(300);
        }
    };
    // Register new patient
    const handleRegisterPatient = async (e) => {
        e.preventDefault();
        if (!newFullName.trim() || !newPhone.trim()) {
            setError('يرجى إدخال اسم المريض ورقم الهاتف');
            return;
        }
        setError(null);
        setIsRegisteringPatient(true);
        try {
            const created = await api.post('/patients', {
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
        }
        catch (err) {
            setError(err.message || 'حدث خطأ أثناء تسجيل المريض');
        }
        finally {
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
            const res = await api.post('/appointments', {
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
        }
        catch (err) {
            if (err instanceof ShiftRequiredException) {
                onShiftRequired();
            }
            else {
                setError(err.message || 'فشل تسجيل الحجز');
            }
        }
        finally {
            setIsSubmittingBooking(false);
        }
    };
    return (_jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between pb-2 border-b border-slate-100", children: [_jsxs("h3", { className: "font-bold text-slate-900 text-sm flex items-center gap-2", children: [_jsx(UserPlus, { className: "w-4 h-4 text-sky-600" }), "\u0627\u0644\u0628\u062D\u062B \u0648\u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0641\u0648\u0631\u064A"] }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => {
                            setShowNewPatientForm(!showNewPatientForm);
                            setSelectedPatient(null);
                        }, className: "text-xs py-1", children: showNewPatientForm ? 'العودة للبحث' : '+ تسجيل مريض جديد' })] }), error && (_jsxs("div", { className: "p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("span", { children: error })] })), showNewPatientForm ? (_jsxs("form", { onSubmit: handleRegisterPatient, className: "space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs", children: [_jsx("div", { className: "font-bold text-slate-800", children: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0631\u064A\u0636 \u0627\u0644\u062C\u062F\u064A\u062F" }), _jsx(Input, { label: "\u0627\u0644\u0627\u0633\u0645 \u062B\u0644\u0627\u062B\u064A \u0623\u0648 \u0631\u0628\u0627\u0639\u064A", value: newFullName, onChange: (e) => setNewFullName(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: \u0645\u062D\u0645\u062F \u0623\u062D\u0645\u062F \u0639\u0644\u064A...", required: true }), _jsx(Input, { label: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0627\u0644\u0645\u062D\u0645\u0648\u0644", value: newPhone, onChange: (e) => setNewPhone(e.target.value), placeholder: "01012345678", required: true }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Input, { label: "\u0627\u0644\u0639\u0645\u0631 (\u0628\u0627\u0644\u0633\u0646\u0648\u0627\u062A)", type: "number", value: newAgeYears, onChange: (e) => setNewAgeYears(e.target.value), placeholder: "35" }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u0627\u0644\u0646\u0648\u0639" }), _jsxs("select", { value: newGender, onChange: (e) => setNewGender(e.target.value), className: "w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs", children: [_jsx("option", { value: "Male", children: "\u0630\u0643\u0631" }), _jsx("option", { value: "Female", children: "\u0623\u0646\u062B\u0649" })] })] })] }), _jsx(Button, { type: "submit", variant: "primary", disabled: isRegisteringPatient, className: "w-full text-xs", children: isRegisteringPatient ? 'جاري الحفظ...' : 'حفظ المريض ومتابعة الحجز' })] })) : (
            /* Mode B: Patient Search & Family Cards */
            _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "relative", children: [_jsx(Input, { placeholder: "\u0627\u0628\u062D\u062B \u0628\u0627\u0644\u0627\u0633\u0645\u060C \u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0628\u0627\u064A\u0644\u060C \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0648\u0631\u0642\u064A...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), className: "pr-9 text-xs" }), _jsx(Search, { className: "w-4 h-4 text-slate-400 absolute top-3 right-3" })] }), searchResults.length > 0 && (_jsx("div", { className: "max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg divide-y divide-slate-100", children: searchResults.map((p) => (_jsxs("div", { onClick: () => handleSelectPatient(p), className: "p-2.5 hover:bg-sky-50/70 cursor-pointer transition-colors text-right", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "font-bold text-slate-900 text-xs", children: p.fullName }), _jsxs("span", { className: "text-[10px] font-mono text-slate-500", children: ["\u0645\u0644\u0641: #", p.fileNumber] })] }), _jsxs("div", { className: "flex items-center gap-3 text-[11px] text-slate-500 mt-1", children: [_jsxs("span", { className: "flex items-center gap-1 font-mono", children: [_jsx(Phone, { className: "w-3 h-3 text-slate-400" }), p.phone] }), p.ageYears != null && _jsxs("span", { children: ["\u0627\u0644\u0639\u0645\u0631: ", p.ageYears, " \u0633\u0646\u0629"] }), _jsx("span", { children: p.gender === 'Male' ? 'ذكر' : 'أنثى' })] })] }, p.id))) })), selectedPatient && (_jsxs("div", { className: "p-3 bg-sky-50/60 border border-sky-200 rounded-xl space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-bold text-sky-950 text-xs", children: selectedPatient.fullName }), _jsxs("p", { className: "text-[10px] text-slate-500 font-mono mt-0.5", children: ["\u0645\u0644\u0641: #", selectedPatient.fileNumber, " \u2022 ", selectedPatient.phone] })] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setSelectedPatient(null), className: "text-[10px] text-slate-500 hover:text-rose-600 h-6 px-2", children: "\u062A\u063A\u064A\u064A\u0631" })] }), selectedPatient.consultationEligibility && (_jsx("div", { children: selectedPatient.consultationEligibility.isEligible ? (_jsxs("div", { className: "p-2 bg-emerald-100/70 border border-emerald-300 rounded-lg text-[11px] text-emerald-900 font-semibold flex items-center gap-1.5", children: [_jsx(CheckCircle, { className: "w-4 h-4 text-emerald-600 flex-shrink-0" }), _jsxs("span", { children: ["\u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0645\u062C\u0627\u0646\u064A\u0629 \u0645\u062A\u0627\u062D\u0629 (\u0645\u062A\u0628\u0642\u064A ", selectedPatient.consultationEligibility.daysRemaining, " \u064A\u0648\u0645)"] })] })) : (_jsxs("div", { className: "p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-center gap-1.5", children: [_jsx(AlertCircle, { className: "w-4 h-4 text-amber-600 flex-shrink-0" }), _jsx("span", { children: selectedPatient.consultationEligibility.reason || 'كشف جديد مطلوب' })] })) }))] }))] })), selectedPatient && (_jsxs("div", { className: "space-y-3 pt-2 border-t border-slate-100 text-xs", children: [_jsxs("div", { children: [_jsx("label", { className: "block font-semibold text-slate-700 mb-1", children: "\u0646\u0648\u0639 \u0627\u0644\u062E\u062F\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx("button", { type: "button", onClick: () => {
                                            setServiceType('Exam');
                                            setSelectedServiceId(1);
                                            setServicePriceEgp(300);
                                        }, className: `p-2 rounded-lg border text-center font-bold transition-all ${serviceType === 'Exam'
                                            ? 'border-sky-600 bg-sky-50 text-sky-900 shadow-xs'
                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`, children: "\u0643\u0634\u0641 \u062C\u062F\u064A\u062F (300 \u062C.\u0645)" }), _jsx("button", { type: "button", onClick: () => {
                                            setServiceType('Consultation');
                                            setSelectedServiceId(2);
                                            setServicePriceEgp(0);
                                        }, className: `p-2 rounded-lg border text-center font-bold transition-all ${serviceType === 'Consultation'
                                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`, children: "\u0627\u0633\u062A\u0634\u0627\u0631\u0629 (0.00 \u062C.\u0645)" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block font-semibold text-slate-700 mb-1", children: "\u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0648\u062E\u062F\u0645\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629" }), _jsx("div", { className: "grid grid-cols-2 gap-1.5 text-[11px]", children: [
                                    { id: 10, name: 'سونار بطن وحوض', priceEgp: 150 },
                                    { id: 11, name: 'رسم قلب ECG', priceEgp: 100 },
                                    { id: 12, name: 'فتح ملف جديد', priceEgp: 50 },
                                    { id: 13, name: 'غيار جراحي', priceEgp: 80 },
                                ].map((proc) => {
                                    const isSelected = selectedProcedures.some((p) => p.id === proc.id);
                                    return (_jsxs("button", { type: "button", onClick: () => {
                                            if (isSelected) {
                                                setSelectedProcedures(selectedProcedures.filter((p) => p.id !== proc.id));
                                            }
                                            else {
                                                setSelectedProcedures([...selectedProcedures, proc]);
                                            }
                                        }, className: `p-1.5 rounded-lg border text-right transition-all flex items-center justify-between ${isSelected
                                            ? 'border-sky-500 bg-sky-50 text-sky-900 font-bold'
                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`, children: [_jsx("span", { children: proc.name }), _jsxs("span", { className: "font-mono text-[10px]", children: ["+", proc.priceEgp] })] }, proc.id));
                                }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block font-semibold text-slate-700 mb-1", children: "\u0633\u0628\u0628 \u0627\u0644\u062E\u0635\u0645" }), _jsxs("select", { value: discountReason, onChange: (e) => setDiscountReason(e.target.value), className: "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs", children: [_jsx("option", { value: "None", children: "\u0628\u062F\u0648\u0646 \u062E\u0635\u0645" }), _jsx("option", { value: "Colleague", children: "\u0637\u0628\u064A\u0628 \u0632\u0645\u064A\u0644" }), _jsx("option", { value: "Staff", children: "\u0645\u0648\u0638\u0641 \u0639\u064A\u0627\u062F\u0629" }), _jsx("option", { value: "Charity", children: "\u062D\u0627\u0644\u0629 \u0625\u0646\u0633\u0627\u0646\u064A\u0629" }), _jsx("option", { value: "DoctorCustom", children: "\u062E\u0635\u0645 \u0645\u0646 \u0627\u0644\u0637\u0628\u064A\u0628" })] })] }), discountReason !== 'None' && (_jsx("div", { children: _jsx(Input, { label: "\u0642\u064A\u0645\u0629 \u0627\u0644\u062E\u0635\u0645 (\u062C.\u0645)", type: "number", value: discountAmountEgp, onChange: (e) => setDiscountAmountEgp(e.target.value), min: "0", max: totalBaseEgp }) }))] }), _jsxs("div", { children: [_jsx("label", { className: "block font-semibold text-slate-700 mb-1", children: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0633\u062F\u0627\u062F" }), _jsx("div", { className: "grid grid-cols-4 gap-1 text-[11px]", children: ['Cash', 'Instapay', 'VodafoneCash', 'Card'].map((method) => (_jsxs("button", { type: "button", onClick: () => setPaymentMethod(method), className: `p-1.5 rounded-lg border font-semibold text-center transition-all ${paymentMethod === method
                                        ? 'border-sky-600 bg-sky-600 text-white shadow-xs'
                                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`, children: [method === 'Cash' && 'نقدي', method === 'Instapay' && 'إنستاباي', method === 'VodafoneCash' && 'فودافون', method === 'Card' && 'بطاقة'] }, method))) })] }), paymentMethod !== 'Cash' && (_jsx("div", { children: _jsx(Input, { label: paymentMethod === 'VodafoneCash' ? 'رقم المحفظة المحول منها' : 'رقم العملية / المرجع', value: paymentReference, onChange: (e) => setPaymentReference(e.target.value), placeholder: "\u0623\u062F\u062E\u0644 \u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0645\u0631\u062C\u0639\u064A \u0644\u0644\u062A\u062D\u0642\u0642...", required: true }) })), _jsxs("div", { className: "flex items-center gap-4 pt-1", children: [_jsxs("label", { className: "flex items-center gap-1.5 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: isUrgent, onChange: (e) => setIsUrgent(e.target.checked), className: "rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4" }), _jsx("span", { className: "font-semibold text-rose-800", children: "\u062D\u0627\u0644\u0629 \u0645\u0633\u062A\u0639\u062C\u0644\u0629 (\u0623\u0648\u0644\u0648\u064A\u0629 \u0627\u0644\u062F\u0648\u0631)" })] }), _jsxs("label", { className: "flex items-center gap-1.5 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: isWalkIn, onChange: (e) => setIsWalkIn(e.target.checked), className: "rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4" }), _jsx("span", { className: "text-slate-700", children: "\u062D\u0636\u0648\u0631 \u0645\u0628\u0627\u0634\u0631 (Walk-In)" })] })] }), _jsxs("div", { className: "p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1", children: [_jsxs("div", { className: "flex justify-between text-slate-600 text-xs", children: [_jsx("span", { children: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062E\u062F\u0645\u0627\u062A:" }), _jsx("span", { className: "font-mono", children: formatEgp(parseEgpToPiastres(totalBaseEgp)) })] }), discountEgp > 0 && (_jsxs("div", { className: "flex justify-between text-rose-600 text-xs", children: [_jsx("span", { children: "\u0627\u0644\u062E\u0635\u0645:" }), _jsxs("span", { className: "font-mono", children: ["-", formatEgp(parseEgpToPiastres(discountEgp))] })] })), _jsxs("div", { className: "flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-slate-200", children: [_jsx("span", { children: "\u0627\u0644\u0635\u0627\u0641\u064A \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0633\u062F\u0627\u062F\u0647:" }), _jsx("span", { className: "text-emerald-700 font-mono text-base", children: formatEgp(parseEgpToPiastres(netTotalEgp)) })] })] }), _jsx(Button, { type: "button", variant: "primary", disabled: isSubmittingBooking || !isShiftOpen, onClick: handleSubmitBooking, className: "w-full py-2.5 text-xs font-bold shadow-md bg-emerald-600 hover:bg-emerald-700", children: !isShiftOpen ? (_jsxs("span", { className: "flex items-center justify-center gap-1", children: [_jsx(ShieldAlert, { className: "w-4 h-4" }), "\u064A\u062C\u0628 \u0641\u062A\u062D \u0648\u0631\u062F\u064A\u0629 \u0623\u0648\u0644\u0627\u064B \u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062D\u062C\u0632"] })) : isSubmittingBooking ? ('جاري إصدار الحجز والإيصال...') : ('تأكيد الحجز وطباعة الإيصال (80mm)') })] }))] }));
}
