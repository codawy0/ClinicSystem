import { authStorage, ApiException } from '../lib/api';
import { PatientAttachmentDto, UploadAttachmentRequest } from '../types/attachments';

export const attachmentService = {
  /**
   * List all attachments for a patient
   */
  async getPatientAttachments(patientId: number): Promise<PatientAttachmentDto[]> {
    const token = authStorage.getToken();
    const response = await fetch(`/api/attachments/patient/${patientId}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new ApiException(response.status, 'FETCH_ATTACHMENTS_FAILED', 'فشل تحميل قائمة المرفقات');
    }
    return response.json();
  },

  /**
   * Upload an attachment with multipart/form-data
   * Validates file size <= 10MB on client before transmission
   */
  async uploadAttachment(data: UploadAttachmentRequest): Promise<PatientAttachmentDto> {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (data.file.size > MAX_SIZE) {
      throw new ApiException(400, 'FILE_TOO_LARGE', 'حجم الملف يتجاوز الحد الأقصى المسموح به (10 ميجابايت)');
    }

    const token = authStorage.getToken();
    const formData = new FormData();
    formData.append('patientId', String(data.patientId));
    if (data.medicalVisitId) {
      formData.append('medicalVisitId', String(data.medicalVisitId));
    }
    formData.append('category', data.fileType);
    formData.append('fileType', data.fileType);
    formData.append('title', data.title);
    formData.append('file', data.file);

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/attachments/upload', {
      method: 'POST',
      headers,
      // DO NOT set Content-Type header; browser sets multipart/form-data with boundary
      body: formData,
    });

    if (!response.ok) {
      let err: any = {};
      try {
        err = await response.json();
      } catch {
        // empty json
      }
      throw new ApiException(
        response.status,
        err.code || err.errorCode || 'UPLOAD_FAILED',
        err.detail || err.message || 'فشل رفع الملف'
      );
    }

    return response.json();
  },

  /**
   * Authenticated blob fetcher:
   * Requests /api/attachments/{id}/file with Authorization Bearer header,
   * converts to Blob, and returns an Object URL.
   */
  async fetchAttachmentBlobUrl(attachmentId: number): Promise<{ url: string; mimeType: string }> {
    const token = authStorage.getToken();
    const response = await fetch(`/api/attachments/${attachmentId}/file`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new ApiException(response.status, 'FETCH_FILE_FAILED', 'فشل تحميل الملف من الخادم');
    }

    const mimeType = response.headers.get('Content-Type') || 'application/octet-stream';
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    return { url, mimeType };
  },

  /**
   * Delete attachment
   */
  async deleteAttachment(attachmentId: number): Promise<void> {
    const token = authStorage.getToken();
    const response = await fetch(`/api/attachments/${attachmentId}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new ApiException(response.status, 'DELETE_FAILED', 'فشل حذف المرفق');
    }
  },
};
