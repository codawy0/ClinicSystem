// ==========================================
// Phase 3C: Unified Print Service Types
// ==========================================

export type PrintRoleTarget = 'DoctorPrinter' | 'ReceptionReceiptPrinter';
export type PrintDocType = 'Prescription' | 'Receipt' | 'LabSlip' | 'SickLeave';
export type PageSize = 'A4' | 'A5' | 'Thermal80mm';

export interface PrintJobCreateDto {
  targetRole: PrintRoleTarget;
  documentType: PrintDocType;
  payloadJson: string;
  htmlContent: string;
  targetPrinterName?: string;
}

export interface SickLeaveData {
  patientName: string;
  fileNumber: string;
  ageYears?: number;
  gender?: 'Male' | 'Female';
  doctorName: string;
  doctorTitle: string;
  clinicName: string;
  diagnosis: string;
  leaveDays: number;
  startDate: string;       // YYYY-MM-DD
  endDate: string;         // YYYY-MM-DD
  returnToWorkDate: string;// YYYY-MM-DD
  notes?: string;
  issueDate: string;
}

export interface LabSlipData {
  patientName: string;
  fileNumber: string;
  ageYears?: number;
  gender?: 'Male' | 'Female';
  doctorName: string;
  doctorTitle: string;
  clinicName: string;
  date: string;
  provisionalDiagnosis?: string;
  requests: {
    requestType: 'Lab' | 'Radiology';
    nameAr: string;
    nameEn?: string | null;
    notes?: string | null;
  }[];
  clinicalNotes?: string;
}

export interface PrescriptionPrintOptions {
  pageSize?: 'A4' | 'A5';
  mode?: 'digital' | 'letterhead'; // letterhead suppresses clinic header and applies 45mm top margin
  targetPrinter?: string;
}

export interface PrintResult {
  success: boolean;
  tier: 'WebView2Silent' | 'LanPrintJob' | 'IframeFallback';
  jobId?: number;
  message?: string;
}
