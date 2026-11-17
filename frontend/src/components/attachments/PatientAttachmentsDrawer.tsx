import { useState, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import {
  X,
  Upload,
  Trash2,
  Eye,
  Columns,
  Image as ImageIcon,
  FileCheck,
  AlertTriangle,
  Loader2,
  Plus,
} from 'lucide-react';
import { PatientAttachmentDto, AttachmentCategory } from '../../types/attachments';
import { attachmentService } from '../../services/attachmentService';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export interface PatientAttachmentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number | null;
  patientName: string;
  medicalVisitId?: number | null;
  onOpenViewer: (attachmentId: number, compareAttachmentId?: number) => void;
}

export function PatientAttachmentsDrawer({
  isOpen,
  onClose,
  patientId,
  patientName,
  medicalVisitId,
  onOpenViewer,
}: PatientAttachmentsDrawerProps) {
  const [attachments, setAttachments] = useState<PatientAttachmentDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<AttachmentCategory | 'All'>('All');

  // Upload Form State
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadCategory, setUploadCategory] = useState<AttachmentCategory>('Ray');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadAttachments = useCallback(async () => {
    if (!patientId) return;
    setIsLoading(true);
    try {
      const items = await attachmentService.getPatientAttachments(patientId);
      setAttachments(items);
    } catch (err) {
      console.error('Failed to load attachments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (isOpen && patientId) {
      loadAttachments();
    }
  }, [isOpen, patientId, loadAttachments]);

  if (!isOpen) return null;

  const filteredAttachments = attachments.filter(
    (a) => selectedCategory === 'All' || a.fileType === selectedCategory
  );

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('حجم الملف يتجاوز 10 ميجابايت. يرجى اختيار ملف أصغر.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    if (!uploadTitle) {
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!patientId || !selectedFile) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      await attachmentService.uploadAttachment({
        patientId,
        medicalVisitId: medicalVisitId || undefined,
        fileType: uploadCategory,
        title: uploadTitle.trim() || selectedFile.name,
        file: selectedFile,
      });

      // Reset form & reload
      setSelectedFile(null);
      setUploadTitle('');
      await loadAttachments();
    } catch (err: any) {
      setUploadError(err.message || 'فشل رفع الملف. تأكد من نوع الملف (JPG, PNG, WebP, PDF).');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا المرفق نهائياً؟')) return;
    try {
      await attachmentService.deleteAttachment(id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      alert(err.message || 'فشل حذف المرفق');
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-r border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-base">سجل الفحوصات والأشعة والمرفقات</h3>
            <p className="text-xs text-slate-500">المريض: {patientName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 p-2 bg-slate-100 border-b border-slate-200 text-xs overflow-x-auto">
          {(['All', 'Ray', 'Lab', 'Report', 'Document'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
                selectedCategory === cat
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              {cat === 'All' && `الكل (${attachments.length})`}
              {cat === 'Ray' && `أشعة (${attachments.filter((a) => a.fileType === 'Ray').length})`}
              {cat === 'Lab' && `تحاليل (${attachments.filter((a) => a.fileType === 'Lab').length})`}
              {cat === 'Report' && `تقارير (${attachments.filter((a) => a.fileType === 'Report').length})`}
              {cat === 'Document' && `مستندات (${attachments.filter((a) => a.fileType === 'Document').length})`}
            </button>
          ))}
        </div>

        {/* Attachment Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="text-center py-10 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-600" />
              <span className="text-xs">جاري تحميل المرفقات...</span>
            </div>
          ) : filteredAttachments.length === 0 ? (
            <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl">
              <ImageIcon className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
              <p className="text-xs font-semibold">لا توجد ملفات مرفقة في هذا القسم</p>
            </div>
          ) : (
            filteredAttachments.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-slate-200 hover:border-sky-300 rounded-xl p-3 shadow-2xs transition-all flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${
                      item.fileType === 'Ray'
                        ? 'bg-purple-600'
                        : item.fileType === 'Lab'
                        ? 'bg-emerald-600'
                        : 'bg-sky-600'
                    }`}
                  >
                    {item.mimeType.includes('pdf') ? (
                      <FileCheck className="w-5 h-5" />
                    ) : (
                      <ImageIcon className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {new Date(item.uploadedAtUtc).toLocaleDateString('ar-EG')} — {(item.sizeBytes / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenViewer(item.id)}
                    className="p-1.5 h-8 text-sky-700 hover:bg-sky-50"
                    title="معاينة الفحص"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const other = attachments.find((a) => a.id !== item.id);
                      onOpenViewer(item.id, other?.id);
                    }}
                    className="p-1.5 h-8 text-indigo-700 hover:bg-indigo-50"
                    title="مقارنة فحصين"
                  >
                    <Columns className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 h-8 text-rose-600 hover:bg-rose-50 border-rose-200"
                    title="حذف المرفق"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Upload Form Section */}
        <div className="border-t border-slate-200 p-4 bg-slate-50">
          <h4 className="text-xs font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-sky-600" />
            <span>رفع فحص أو ملف جديد (بحد أقصى 10MB)</span>
          </h4>

          {uploadError && (
            <div className="mb-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          <form onSubmit={handleUploadSubmit} className="space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">نوع المرفق</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as AttachmentCategory)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                >
                  <option value="Ray">أشعة (X-Ray / Scan)</option>
                  <option value="Lab">تحاليل طبية (Lab)</option>
                  <option value="Report">تقرير طبي (Report)</option>
                  <option value="Document">مستند آخر (Document)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">عنوان الفحص</label>
                <Input
                  type="text"
                  placeholder="مثال: أشعة صدر أمامية"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="text-xs py-1"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                الملف (JPG, PNG, WebP, PDF)
              </label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!selectedFile || isUploading}
              className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold gap-1.5"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري الرفع والتحقق...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>رفع الملف وحفظه بالسجل</span>
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
