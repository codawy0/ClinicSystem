import { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  RotateCcw,
  Download,
  Users,
  Pill,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  PatientImportPreviewDto,
  DrugImportPreviewDto,
  ImportResultDto,
} from '../../types/import';
import { importService } from '../../services/importService';
import { ApiException } from '../../lib/api';

type ImportMode = 'Patients' | 'Drugs';

export function DataImportTab() {
  const [mode, setMode] = useState<ImportMode>('Patients');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [committing, setCommitting] = useState(false);

  // Previews
  const [patientPreview, setPatientPreview] = useState<PatientImportPreviewDto | null>(null);
  const [drugPreview, setDrugPreview] = useState<DrugImportPreviewDto | null>(null);

  // Result
  const [importResult, setImportResult] = useState<ImportResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = async (file: File) => {
    if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
      setError('يرجى اختيار ملف بصيغة CSV صالحة.');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setImportResult(null);
    setLoadingPreview(true);

    try {
      if (mode === 'Patients') {
        const preview = await importService.previewPatientImport(file);
        setPatientPreview(preview);
      } else {
        const preview = await importService.previewDrugImport(file);
        setDrugPreview(preview);
      }
    } catch (err: any) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError('تعذر قراءة ملف CSV أو معالجته. تحقق من توافق الأعمدة.');
      }
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCommit = async () => {
    if (!selectedFile) return;

    setCommitting(true);
    setError(null);

    try {
      let result: ImportResultDto;
      if (mode === 'Patients') {
        result = await importService.commitPatientImport(selectedFile);
      } else {
        result = await importService.commitDrugImport(selectedFile);
      }

      setImportResult(result);
    } catch (err: any) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError('حدث خطأ أثناء حفظ البيانات المستوردة.');
      }
    } finally {
      setCommitting(false);
    }
  };

  const resetImport = () => {
    setSelectedFile(null);
    setPatientPreview(null);
    setDrugPreview(null);
    setImportResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadSampleTemplate = () => {
    let csvContent = '';
    let filename = '';

    if (mode === 'Patients') {
      csvContent = 'FullName,Phone,NationalId,Gender,BirthDate,Address,MedicalNotes\n' +
        'أحمد محمد محمود,01012345678,29001011234567,Male,1990-05-15,القاهرة - المعادي,حساسية بنسلين\n' +
        'سارة إبراهيم حسن,01198765432,29502021234568,Female,1995-10-20,الجيزة - الدقي,\n';
      filename = 'patients_template.csv';
    } else {
      csvContent = 'TradeName,ActiveIngredients,Category,Form,Strength,DefaultDosage,PriceEgp\n' +
        'Panadol Extra,Paracetamol + Caffeine,Analgesic,Tablet,500mg/65mg,1 tab every 8h,45.00\n' +
        'Augmentin,Amoxicillin + Clavulanate,Antibiotic,Tablet,1g,1 tab every 12h,120.00\n';
      filename = 'drugs_template.csv';
    }

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Mode Switcher */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => {
            setMode('Patients');
            resetImport();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            mode === 'Patients'
              ? 'bg-white text-sky-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>استيراد سجلات المرضى (Patients)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('Drugs');
            resetImport();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            mode === 'Drugs'
              ? 'bg-white text-sky-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Pill className="w-4 h-4" />
          <span>استيراد دليل الأدوية (Drugs)</span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Banner */}
      {importResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{importResult.message || 'تم إتمام عملية الاستيراد بنجاح!'}</span>
          </div>
          <div className="flex gap-4 text-emerald-700">
            <span>عدد السجلات المضافة: <strong>{importResult.importedCount}</strong></span>
            {importResult.errorsCount > 0 && (
              <span className="text-amber-700">أخطاء متجاوزة: <strong>{importResult.errorsCount}</strong></span>
            )}
          </div>
          <div className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={resetImport}>
              استيراد ملف آخر
            </Button>
          </div>
        </div>
      )}

      {/* Step 1: Upload Dropzone */}
      {!selectedFile && !importResult && (
        <div className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-sky-500 bg-sky-50/50'
                : 'border-slate-300 hover:border-sky-400 bg-white'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".csv,text/csv"
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="p-3 bg-sky-50 text-sky-600 rounded-full">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800">
                  اسحب وأفلت ملف <bdi dir="ltr">CSV</bdi> هنا، أو انقر للتحديد
                </p>
                <p className="text-xs text-slate-400">
                  {mode === 'Patients'
                    ? 'الأعمدة المدعومة: FullName, Phone, NationalId, Gender, BirthDate, Address, MedicalNotes'
                    : 'الأعمدة المدعومة: TradeName, ActiveIngredients, Category, Form, Strength, DefaultDosage, PriceEgp'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-600">
              تحتاج لقالب إكسيل جاهز لتعبئة البيانات؟
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadSampleTemplate}
              className="gap-1.5 h-8 text-xs text-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تحميل قالب CSV النموذجي</span>
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Dry Run Preview & Validation */}
      {selectedFile && !importResult && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-sky-50 text-sky-600 rounded-lg">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">
                  <bdi dir="ltr">{selectedFile.name}</bdi>
                </div>
                <div className="text-[11px] text-slate-400">
                  {(selectedFile.size / 1024).toFixed(1)} KB — المعاينة الأولية (Dry Run)
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetImport}
                disabled={committing}
                className="gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إلغاء الملف</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleCommit}
                disabled={committing || loadingPreview}
                className="gap-1.5"
              >
                <FileCheck className="w-4 h-4" />
                <span>{committing ? 'جاري الاستيراد والتسجيل...' : 'تأكيد وحفظ السجلات'}</span>
              </Button>
            </div>
          </div>

          {/* Loading Preview */}
          {loadingPreview && (
            <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200 text-xs">
              جاري فحص وتدقيق بيانات الملف والمطابقة...
            </div>
          )}

          {/* Patients Preview Details */}
          {mode === 'Patients' && patientPreview && (
            <div className="space-y-3">
              {/* Counter Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                  <div className="text-[11px] text-slate-500 font-medium">إجمالي الصفوف</div>
                  <div className="text-lg font-bold text-slate-800">{patientPreview.totalRows}</div>
                </div>
                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-center">
                  <div className="text-[11px] text-emerald-700 font-medium">سجلات صالحة جديدة</div>
                  <div className="text-lg font-bold text-emerald-700">{patientPreview.validCount}</div>
                </div>
                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 text-center">
                  <div className="text-[11px] text-amber-700 font-medium">مرضى مسجلون مسبقاً</div>
                  <div className="text-lg font-bold text-amber-700">{patientPreview.duplicateCount}</div>
                </div>
                <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200 text-center">
                  <div className="text-[11px] text-rose-700 font-medium">بيانات غير مكتملة</div>
                  <div className="text-lg font-bold text-rose-700">{patientPreview.invalidCount}</div>
                </div>
              </div>

              {/* Rows Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">الاسم بالكامل</th>
                        <th className="py-2.5 px-3">رقم الهاتف</th>
                        <th className="py-2.5 px-3">الرقم القومي</th>
                        <th className="py-2.5 px-3">النوع</th>
                        <th className="py-2.5 px-3">حالة التدقيق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {patientPreview.rows.map((row) => (
                        <tr key={row.rowNumber} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 text-slate-400">{row.rowNumber}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{row.fullName}</td>
                          <td className="py-2 px-3">
                            <bdi dir="ltr">{row.phone}</bdi>
                          </td>
                          <td className="py-2 px-3 text-slate-500">
                            <bdi dir="ltr">{row.nationalId || '-'}</bdi>
                          </td>
                          <td className="py-2 px-3">
                            {row.gender === 'Female' ? 'أنثى' : 'ذكر'}
                          </td>
                          <td className="py-2 px-3">
                            {row.isValid && !row.isDuplicate && (
                              <Badge variant="success">جاهز للإضافة</Badge>
                            )}
                            {row.isDuplicate && (
                              <Badge variant="warning">مسجل سابقاً</Badge>
                            )}
                            {!row.isValid && (
                              <Badge variant="danger">{row.errorMessage || 'خطأ'}</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Drugs Preview Details */}
          {mode === 'Drugs' && drugPreview && (
            <div className="space-y-3">
              {/* Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                  <div className="text-[11px] text-slate-500 font-medium">إجمالي الأدوية</div>
                  <div className="text-lg font-bold text-slate-800">{drugPreview.totalRows}</div>
                </div>
                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-center">
                  <div className="text-[11px] text-emerald-700 font-medium">أدوية جديدة</div>
                  <div className="text-lg font-bold text-emerald-700">{drugPreview.newCount}</div>
                </div>
                <div className="bg-sky-50/70 p-3 rounded-xl border border-sky-200 text-center">
                  <div className="text-[11px] text-sky-700 font-medium">تحديث أسعار</div>
                  <div className="text-lg font-bold text-sky-700">{drugPreview.updateCount}</div>
                </div>
                <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200 text-center">
                  <div className="text-[11px] text-rose-700 font-medium">بيانات خاطئة</div>
                  <div className="text-lg font-bold text-rose-700">{drugPreview.invalidCount}</div>
                </div>
              </div>

              {/* Rows Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">الاسم التجاري (Trade Name)</th>
                        <th className="py-2.5 px-3">المادة الفعالة</th>
                        <th className="py-2.5 px-3">الشكل الصيدلي</th>
                        <th className="py-2.5 px-3">السعر</th>
                        <th className="py-2.5 px-3">حالة الإضافة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {drugPreview.rows.map((row) => (
                        <tr key={row.rowNumber} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 text-slate-400">{row.rowNumber}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            <bdi dir="ltr">{row.tradeName}</bdi>
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            <bdi dir="ltr">{row.activeIngredients}</bdi>
                          </td>
                          <td className="py-2 px-3 text-slate-500">{row.form}</td>
                          <td className="py-2 px-3 font-bold text-emerald-700">
                            <bdi dir="ltr">{row.priceEgp} ج.م</bdi>
                          </td>
                          <td className="py-2 px-3">
                            {row.isValid && row.isNew && (
                              <Badge variant="success">دواء جديد</Badge>
                            )}
                            {row.isValid && !row.isNew && (
                              <Badge variant="info">تحديث</Badge>
                            )}
                            {!row.isValid && (
                              <Badge variant="danger">{row.errorMessage || 'خطأ'}</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
