import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Lock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { doctorService } from '../../services/doctorService';
import { MedicalVisitDetailDto, AutosaveDraftNotesRequestDto } from '../../types';
import { ConcurrencyConflictException } from '../../lib/api';

export interface ClinicalNotesState {
  chiefComplaint: string;
  examination: string;
  diagnosis: string;
  icd10Code: string;
  doctorPrivateNotes: string;
  nextVisitDate: string;
}

interface ClinicalNotesEditorProps {
  visitId: number;
  initialNotes: Partial<ClinicalNotesState> & { nurseNotes?: string | null };
  version: number;
  isDraft: boolean;
  onChangeNotes?: (notes: ClinicalNotesState) => void;
  onAutosaveSuccess: (updatedVisit: MedicalVisitDetailDto) => void;
  onVersionConflict: () => void;
}

const COMMON_ICD10_CHIPS = [
  { code: 'J20.9', labelAr: 'نزلة شعبية حادة', labelEn: 'Acute Bronchitis' },
  { code: 'I10', labelAr: 'ضغط دم أساسي', labelEn: 'Essential Hypertension' },
  { code: 'E11.9', labelAr: 'سكري النوع الثاني', labelEn: 'Type 2 Diabetes' },
  { code: 'K29.7', labelAr: 'التهاب المعدة', labelEn: 'Gastritis' },
  { code: 'J02.9', labelAr: 'التهاب الحلق الحاد', labelEn: 'Acute Pharyngitis' },
];

export function ClinicalNotesEditor({
  visitId,
  initialNotes,
  version,
  isDraft,
  onChangeNotes,
  onAutosaveSuccess,
  onVersionConflict,
}: ClinicalNotesEditorProps) {
  const [chiefComplaint, setChiefComplaint] = useState(initialNotes.chiefComplaint || '');
  const [examination, setExamination] = useState(initialNotes.examination || '');
  const [diagnosis, setDiagnosis] = useState(initialNotes.diagnosis || '');
  const [icd10Code, setIcd10Code] = useState(initialNotes.icd10Code || '');
  const [doctorPrivateNotes, setDoctorPrivateNotes] = useState(initialNotes.doctorPrivateNotes || '');
  const [nextVisitDate, setNextVisitDate] = useState(initialNotes.nextVisitDate || '');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Sync state if initialNotes or visitId changes
  useEffect(() => {
    setChiefComplaint(initialNotes.chiefComplaint || '');
    setExamination(initialNotes.examination || '');
    setDiagnosis(initialNotes.diagnosis || '');
    setIcd10Code(initialNotes.icd10Code || '');
    setDoctorPrivateNotes(initialNotes.doctorPrivateNotes || '');
    setNextVisitDate(initialNotes.nextVisitDate || '');
    setSaveStatus('idle');
  }, [visitId]);

  // Keep a ref to latest state and version for debounced save
  const currentNotesRef = useRef<ClinicalNotesState>({
    chiefComplaint,
    examination,
    diagnosis,
    icd10Code,
    doctorPrivateNotes,
    nextVisitDate,
  });

  currentNotesRef.current = {
    chiefComplaint,
    examination,
    diagnosis,
    icd10Code,
    doctorPrivateNotes,
    nextVisitDate,
  };

  const versionRef = useRef(version);
  versionRef.current = version;

  // Notify parent of notes change
  const notifyChange = (updated: Partial<ClinicalNotesState>) => {
    const next: ClinicalNotesState = {
      ...currentNotesRef.current,
      ...updated,
    };
    currentNotesRef.current = next;
    setSaveStatus('dirty');
    onChangeNotes?.(next);
  };

  // 5-second debounced autosave effect
  useEffect(() => {
    if (!isDraft || !visitId || saveStatus !== 'dirty') return;

    const timer = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        const payload: AutosaveDraftNotesRequestDto = {
          chiefComplaint: currentNotesRef.current.chiefComplaint,
          examination: currentNotesRef.current.examination,
          diagnosis: currentNotesRef.current.diagnosis,
          icd10Code: currentNotesRef.current.icd10Code,
          doctorPrivateNotes: currentNotesRef.current.doctorPrivateNotes,
          nextVisitDate: currentNotesRef.current.nextVisitDate || null,
          nurseNotes: initialNotes.nurseNotes || null,
          version: versionRef.current,
        };

        const updated = await doctorService.saveDraft(visitId, payload);
        onAutosaveSuccess(updated);
        setSaveStatus('saved');
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        setLastSavedTime(timeStr);
      } catch (err: any) {
        if (err instanceof ConcurrencyConflictException || err?.status === 409) {
          setSaveStatus('conflict');
          onVersionConflict();
        } else {
          setSaveStatus('error');
          console.warn('Autosave failed:', err);
        }
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [chiefComplaint, examination, diagnosis, icd10Code, doctorPrivateNotes, nextVisitDate, saveStatus, visitId, isDraft]);

  // Quick preset dates for Next Consultation
  const handleAddDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const dateStr = d.toISOString().split('T')[0];
    setNextVisitDate(dateStr);
    notifyChange({ nextVisitDate: dateStr });
  };

  const handleSelectIcd10 = (code: string, label: string) => {
    setIcd10Code(code);
    if (!diagnosis.trim()) {
      setDiagnosis(label);
      notifyChange({ icd10Code: code, diagnosis: label });
    } else {
      notifyChange({ icd10Code: code });
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 relative">
      {/* Header & Autosave Status */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-sky-600" />
          <h3 className="font-bold text-slate-900 text-base">الملاحظات الطبية والفحص السريري</h3>
        </div>

        {/* Floating Autosave Indicator */}
        <div className="flex items-center gap-2 text-xs">
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>تم الحفظ تلقائياً {lastSavedTime ? `(${lastSavedTime})` : ''}</span>
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-amber-600 font-medium bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
              <span>جاري الحفظ...</span>
            </span>
          )}
          {saveStatus === 'dirty' && (
            <span className="flex items-center gap-1.5 text-slate-500 font-medium bg-slate-100 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>تغييرات غير محفوظة...</span>
            </span>
          )}
          {saveStatus === 'conflict' && (
            <button
              onClick={onVersionConflict}
              className="flex items-center gap-1.5 text-rose-700 font-bold bg-rose-50 border border-rose-300 px-2.5 py-1 rounded-full hover:bg-rose-100 transition-colors"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>تضارب في البيانات - اضغط للتحديث</span>
              <RefreshCw className="w-3 h-3 text-rose-500" />
            </button>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-rose-600 font-medium bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>تعذر الحفظ التلقائي</span>
            </span>
          )}
        </div>
      </div>

      {/* Grid: Chief Complaint & Examination */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Chief Complaint */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            الشكوى الحالية للمريض (Chief Complaint)
          </label>
          <textarea
            rows={2}
            value={chiefComplaint}
            onChange={(e) => {
              setChiefComplaint(e.target.value);
              notifyChange({ chiefComplaint: e.target.value });
            }}
            placeholder="الشكوى الرئيسية وسبب الزيارة..."
            className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:text-slate-400"
          />
        </div>

        {/* Physical Examination */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            الفحص الإكلينيكي السريري (Physical Examination)
          </label>
          <textarea
            rows={2}
            value={examination}
            onChange={(e) => {
              setExamination(e.target.value);
              notifyChange({ examination: e.target.value });
            }}
            placeholder="نتائج الفحص الإكلينيكي (الصدر، القلب، البطن، الفحص العام)..."
            className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Diagnosis & Quick ICD-10 Helper */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="block text-xs font-bold text-slate-700">
            التشخيص الطبي (Diagnosis) ورمز ICD-10
          </label>
          {/* Quick ICD-10 Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400">تشخيصات شائعة:</span>
            {COMMON_ICD10_CHIPS.map((chip) => (
              <button
                key={chip.code}
                type="button"
                onClick={() => handleSelectIcd10(chip.code, chip.labelAr)}
                className="text-[11px] font-medium bg-slate-100 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md transition-colors"
              >
                {chip.code} - {chip.labelAr}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-3">
            <input
              type="text"
              value={diagnosis}
              onChange={(e) => {
                setDiagnosis(e.target.value);
                notifyChange({ diagnosis: e.target.value });
              }}
              placeholder="التشخيص الإكلينيكي النهائي أو الأولي..."
              className="w-full text-sm font-semibold rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:font-normal placeholder:text-slate-400"
            />
          </div>
          <div>
            <input
              type="text"
              value={icd10Code}
              onChange={(e) => {
                setIcd10Code(e.target.value);
                notifyChange({ icd10Code: e.target.value });
              }}
              placeholder="كود ICD-10 (مثال: J20.9)"
              className="w-full text-sm font-mono uppercase rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 text-center"
            />
          </div>
        </div>
      </div>

      {/* Row: Confidential Doctor Private Notes & Next Consultation Date */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Private Notes */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 mb-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span>ملاحظات سرية خاصة بالطبيب (لا تظهر بالروشتة المطبوعة)</span>
          </div>
          <textarea
            rows={2}
            value={doctorPrivateNotes}
            onChange={(e) => {
              setDoctorPrivateNotes(e.target.value);
              notifyChange({ doctorPrivateNotes: e.target.value });
            }}
            placeholder="ملاحظات سرية خاصة بالعيادة أو متابعة داخلية..."
            className="w-full text-sm rounded-xl border border-amber-200 bg-amber-50/30 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-slate-400"
          />
        </div>

        {/* Next Visit Date */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            موعد الاستشارة القادمة (Next Visit)
          </label>
          <div className="space-y-2">
            <input
              type="date"
              value={nextVisitDate}
              onChange={(e) => {
                setNextVisitDate(e.target.value);
                notifyChange({ nextVisitDate: e.target.value });
              }}
              className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent font-medium"
            />
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleAddDays(7)}
                className="flex-1 text-[11px] font-semibold bg-slate-100 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 rounded-lg py-1 transition-colors"
              >
                +7 أيام
              </button>
              <button
                type="button"
                onClick={() => handleAddDays(14)}
                className="flex-1 text-[11px] font-semibold bg-slate-100 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 rounded-lg py-1 transition-colors"
                title="استشارة مجانية بعد أسبوعين"
              >
                +14 يوم
              </button>
              <button
                type="button"
                onClick={() => handleAddDays(30)}
                className="flex-1 text-[11px] font-semibold bg-slate-100 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 rounded-lg py-1 transition-colors"
              >
                +شهر
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
