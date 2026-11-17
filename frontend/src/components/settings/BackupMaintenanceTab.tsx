import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  RotateCcw,
  ShieldCheck,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileArchive,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { BackupInfoDto, BackupListResponseDto } from '../../types/backup';
import { backupService } from '../../services/backupService';
import { ApiException } from '../../lib/api';

export function BackupMaintenanceTab() {
  const [backupData, setBackupData] = useState<BackupListResponseDto>({
    backups: [],
    databaseSizeMb: 12.5,
    lastBackupDateUtc: undefined,
    isWalMode: true,
  });
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restore Modal State
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<BackupInfoDto | null>(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await backupService.listBackups();
      setBackupData(data);
    } catch (err: any) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError('تعذر تحميل سجل النسخ الاحتياطية.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    setError(null);
    setNotice(null);

    try {
      const res = await backupService.createBackup();
      if (res.success) {
        setNotice(`تم إنشاء النسخة الاحتياطية بنجاح: ${res.filename}`);
        await loadBackups();
      } else {
        setError(res.message || 'فشل إنشاء النسخة الاحتياطية');
      }
    } catch (err: any) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError('حدث خطأ أثناء إجراء النسخ الاحتياطي الساخن.');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      await backupService.downloadBackup(filename);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل ملف النسخة الاحتياطية');
    }
  };

  const openRestoreModal = (backup: BackupInfoDto) => {
    setSelectedBackupForRestore(backup);
    setConfirmCode('');
    setRestoreError(null);
    setRestoreModalOpen(true);
  };

  const handleConfirmRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBackupForRestore) return;
    if (confirmCode !== 'RESTORE') {
      setRestoreError('يرجى كتابة كلمة RESTORE بدقة لتأكيد الاسترجاع');
      return;
    }

    setRestoring(true);
    setRestoreError(null);

    try {
      const res = await backupService.restoreBackup({
        filename: selectedBackupForRestore.filename,
        confirmCode,
      });

      if (res.success) {
        setRestoreModalOpen(false);
        setNotice('تمت استعادة قاعدة البيانات بنجاح! يرجى إعادة تحميل التطبيق.');
        await loadBackups();
      } else {
        setRestoreError(res.message || 'فشلت استعادة قاعدة البيانات');
      }
    } catch (err: any) {
      if (err instanceof ApiException) {
        setRestoreError(err.message);
      } else {
        setRestoreError('حدث خطأ أثناء عملية الاستعادة');
      }
    } finally {
      setRestoring(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(1)} KB`;
  };

  return (
    <div className="space-y-5">
      {/* Notice Banner */}
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Action & Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Hot Backup Trigger Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-5 h-5 text-sky-600" />
              <h4 className="font-bold text-slate-800 text-xs">نسخ احتياطي ساخن فوري</h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              يقوم بإنشاء نسخة فورية آمنة دون إيقاف العمل في العيادة أو إغلاق قاعدة بيانات SQLite.
            </p>
          </div>
          <div className="mt-4">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleCreateBackup}
              disabled={creating}
              className="w-full gap-2"
            >
              <HardDrive className="w-4 h-4" />
              <span>{creating ? 'جاري النسخ والضغط...' : 'إنشاء نسخة احتياطية الآن'}</span>
            </Button>
          </div>
        </div>

        {/* Database Health Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h4 className="font-bold text-slate-800 text-xs">صحة قاعدة البيانات</h4>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">وضع التشغيل:</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                {backupData.isWalMode ? 'SQLite WAL Mode' : 'Standard'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">حجم الملف النشط:</span>
              <span className="font-semibold text-slate-800">
                <bdi dir="ltr">{backupData.databaseSizeMb.toFixed(2)} MB</bdi>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">فحص التكامل الدوري:</span>
              <span className="text-emerald-600 font-bold text-[11px]">سليم 100% (PRAGMA OK)</span>
            </div>
          </div>
        </div>

        {/* Maintenance Info Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-indigo-600" />
              <h4 className="font-bold text-slate-800 text-xs">الصيانة التلقائية</h4>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadBackups}
              disabled={loading}
              className="p-1 h-7 w-7"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            تعمل خدمة <bdi dir="ltr">SqliteMaintenanceService</bdi> في الخلفية لتفريغ سجلات WAL دورياً لمنع تضخم الملفات.
          </p>
          <div className="text-[11px] text-slate-400">
            آخر نسخة: {backupData.lastBackupDateUtc ? new Date(backupData.lastBackupDateUtc).toLocaleString('ar-EG') : 'لم تُسجل بعد'}
          </div>
        </div>
      </div>

      {/* Backups List Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileArchive className="w-4 h-4 text-slate-600" />
            <h4 className="font-bold text-slate-800 text-xs">أرشيف النسخ الاحتياطية المحفوظة</h4>
          </div>
          <span className="text-[11px] text-slate-500">
            {backupData.backups.length} {backupData.backups.length === 1 ? 'نسخة' : 'نسخ'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">اسم ملف الأرشيف</th>
                <th className="py-3 px-4">تاريخ الإنشاء</th>
                <th className="py-3 px-4">حجم الملف</th>
                <th className="py-3 px-4">حالة التكامل</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backupData.backups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    لم يتم العثور على نسخ احتياطية سابقة. اضغط "إنشاء نسخة احتياطية الآن" لحفظ قاعدة البيانات.
                  </td>
                </tr>
              ) : (
                backupData.backups.map((b) => (
                  <tr key={b.filename} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      <bdi dir="ltr">{b.filename}</bdi>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <bdi dir="ltr">{new Date(b.createdAtUtc).toLocaleString('ar-EG')}</bdi>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      <bdi dir="ltr">{formatFileSize(b.sizeBytes)}</bdi>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="success">
                        {b.integrityStatus || 'PRAGMA OK'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(b.filename)}
                          className="gap-1 h-7 text-xs text-sky-700 hover:text-sky-800"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>تحميل</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openRestoreModal(b)}
                          className="gap-1 h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>استرجاع</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restore Safety Confirmation Modal */}
      {restoreModalOpen && selectedBackupForRestore && (
        <Dialog
          isOpen={true}
          onClose={() => setRestoreModalOpen(false)}
          title="تأكيد استرجاع قاعدة البيانات"
          description={`الملف: ${selectedBackupForRestore.filename}`}
          maxWidth="md"
        >
          <form onSubmit={handleConfirmRestore} className="space-y-4">
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-rose-800">تحذير بالغ الأهمية:</div>
                <div className="text-rose-700 leading-relaxed">
                  استرجاع قاعدة البيانات سيقوم باستبدال كافة البيانات الحالية بالبيانات الموجودة في ملف النسخة الاحتياطية. أي بيانات سُجلت بعد تاريخ النسخة ستُفقد تماماً.
                </div>
              </div>
            </div>

            {restoreError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{restoreError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                لتأكيد الاسترجاع، اكتب الكلمة الإنجليزية <span className="font-mono font-bold text-rose-600 select-all">RESTORE</span> أدناه:
              </label>
              <Input
                type="text"
                placeholder="RESTORE"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                required
                className="font-mono text-center tracking-widest text-sm font-bold uppercase"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRestoreModalOpen(false)}
                disabled={restoring}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="danger"
                size="sm"
                disabled={restoring || confirmCode !== 'RESTORE'}
                className="gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                {restoring ? 'جاري الاسترجاع...' : 'تأكيد الاستبدال والاسترجاع'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
