// ==========================================
// Phase 3C: Authenticated Attachments Types
// ==========================================

export type AttachmentCategory = 'Ray' | 'Lab' | 'Report' | 'Document';

export interface PatientAttachmentDto {
  id: number;
  patientId: number;
  medicalVisitId?: number | null;
  fileType: AttachmentCategory;
  title: string;
  storageFileName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: number;
  uploadedByUserName?: string;
  uploadedAtUtc: string;
}

export interface UploadAttachmentRequest {
  patientId: number;
  medicalVisitId?: number;
  fileType: AttachmentCategory;
  title: string;
  file: File;
}
