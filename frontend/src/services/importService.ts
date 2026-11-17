import { authStorage, ApiException } from '../lib/api';
import {
  PatientImportPreviewDto,
  DrugImportPreviewDto,
  ImportResultDto,
} from '../types/import';

async function uploadCsv<T>(endpoint: string, file: File): Promise<T> {
  const token = authStorage.getToken();
  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : endpoint.startsWith('/api')
    ? endpoint
    : `/api${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch {
    throw new ApiException(0, 'NETWORK_ERROR', 'تعذر الاتصال بالخادم لتحميل الملف');
  }

  if (!response.ok) {
    let errData: any = {};
    try {
      errData = await response.json();
    } catch {}
    throw new ApiException(
      response.status,
      errData.errorCode || errData.code || 'IMPORT_FAILED',
      errData.detail || errData.message || 'فشل معالجة ملف البيانات',
      errData
    );
  }

  return response.json() as Promise<T>;
}

export const importService = {
  async previewPatientImport(file: File): Promise<PatientImportPreviewDto> {
    return uploadCsv<PatientImportPreviewDto>('/import/patients?dryRun=true', file);
  },

  async commitPatientImport(file: File): Promise<ImportResultDto> {
    return uploadCsv<ImportResultDto>('/import/patients?dryRun=false', file);
  },

  async previewDrugImport(file: File): Promise<DrugImportPreviewDto> {
    return uploadCsv<DrugImportPreviewDto>('/import/drugs?dryRun=true', file);
  },

  async commitDrugImport(file: File): Promise<ImportResultDto> {
    return uploadCsv<ImportResultDto>('/import/drugs?dryRun=false', file);
  },

  uploadCsv,
};
