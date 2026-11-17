export interface PatientImportRowDto {
  rowNumber: number;
  fullName: string;
  phone: string;
  nationalId?: string;
  gender: string;
  birthDate?: string;
  address?: string;
  medicalNotes?: string;
  isValid: boolean;
  isDuplicate: boolean;
  errorMessage?: string;
}

export interface PatientImportPreviewDto {
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
  rows: PatientImportRowDto[];
}

export interface DrugImportRowDto {
  rowNumber: number;
  tradeName: string;
  activeIngredients: string;
  category: string;
  form: string;
  strength?: string;
  defaultDosage?: string;
  priceEgp: number;
  isNew: boolean;
  isValid: boolean;
  errorMessage?: string;
}

export interface DrugImportPreviewDto {
  totalRows: number;
  newCount: number;
  updateCount: number;
  invalidCount: number;
  rows: DrugImportRowDto[];
}

export interface ImportResultDto {
  success: boolean;
  importedCount: number;
  errorsCount: number;
  message: string;
}
