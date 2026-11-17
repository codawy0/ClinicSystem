import { api, authStorage, ApiException } from '../lib/api';
import {
  BackupListResponseDto,
  CreateBackupResponseDto,
  RestoreBackupRequestDto,
} from '../types/backup';

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const backupService = {
  async listBackups(): Promise<BackupListResponseDto> {
    return api.get<BackupListResponseDto>('/backup/list');
  },

  async createBackup(): Promise<CreateBackupResponseDto> {
    return api.post<CreateBackupResponseDto>(
      '/backup/create',
      {},
      { idempotencyKey: generateIdempotencyKey() }
    );
  },

  async downloadBackup(filename: string): Promise<void> {
    const token = authStorage.getToken();
    const response = await fetch(`/api/backup/download/${encodeURIComponent(filename)}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      let errData: any = {};
      try {
        errData = await response.json();
      } catch {}
      throw new ApiException(
        response.status,
        errData.errorCode || 'DOWNLOAD_FAILED',
        errData.detail || errData.message || 'فشل تحميل ملف النسخة الاحتياطية'
      );
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async restoreBackup(data: RestoreBackupRequestDto): Promise<{ success: boolean; message: string }> {
    return api.post<{ success: boolean; message: string }>(
      '/backup/restore',
      data,
      { idempotencyKey: generateIdempotencyKey() }
    );
  },
};
