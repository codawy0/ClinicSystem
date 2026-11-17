export type UserRole = 'Doctor' | 'AssistantDoctor' | 'Nurse' | 'Receptionist' | 'Admin';
export type TvPrivacyMode = 'FirstNameAndInitial' | 'QueueNumberOnly' | 'FullName';
export type AppointmentStatus = 'Booked' | 'Waiting' | 'InNursing' | 'WithDoctor' | 'Skipped' | 'Completed' | 'Cancelled';
export type PaymentMethod = 'Cash' | 'Instapay' | 'VodafoneCash' | 'Card';
export type DiscountReason = 'None' | 'Colleague' | 'Staff' | 'Charity' | 'DoctorCustom';
export type InvoiceStatus = 'Unpaid' | 'Partial' | 'Paid' | 'Voided';

export interface UserDto {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface AuthResponseDto {
  token: string;
  user: UserDto;
  clinicSetting: ClinicSettingDto;
}

export interface DevAccountDto {
  role: string;
  roleTitleAr?: string;
  username: string;
  password?: string;
  defaultPassword?: string;
  fullName: string;
  description?: string;
}

export interface ClinicSettingDto {
  clinicName: string;
  doctorName: string;
  doctorTitle: string;
  specialty: string;
  consultationValidityDays: number;
  maxConsultationsPerExam: number;
  defaultExamPricePiastres: number;
  defaultConsultPricePiastres: number;
  enableNursingStage: boolean;
  tvPrivacyMode: TvPrivacyMode;
  tvDeviceToken: string;
  isDoctorOnBreak: boolean;
}

export interface ShiftSummaryDto {
  id?: number;
  shiftId: number;
  userId: number;
  username?: string;
  fullName?: string;
  businessDate: string;
  openedAtUtc: string;
  closedAtUtc?: string | null;
  openingBalancePiastres: number;
  expectedClosingCashPiastres: number;
  cashPaymentsPiastres: number;
  cashRefundsPiastres: number;
  cashExpensesPiastres: number;
  totalInstapayPiastres?: number;
  instapayTotalPiastres?: number;
  totalVodafoneCashPiastres?: number;
  vodafoneCashTotalPiastres?: number;
  totalCardPiastres?: number;
  cardTotalPiastres?: number;
  totalNonCashPiastres?: number;
  totalRevenuePiastres?: number;
  transactionsCount?: number;
  isClosed: boolean;
  actualClosingCashPiastres?: number | null;
  cashDifferencePiastres?: number | null;
  differenceType?: string | null;
  closingNotes?: string | null;
  version: number;
}

export interface CurrentShiftStatusDto {
  hasActiveShift: boolean;
  shift: ShiftSummaryDto | null;
}

export interface PatientSearchResultDto {
  id: number;
  fileNumber: string;
  fullName: string;
  phone: string;
  ageYears?: number;
  birthDate?: string;
  gender: 'Male' | 'Female';
  lastVisitDate?: string;
  guardianName?: string;
  version: number;
  consultationEligibility?: {
    isEligible: boolean;
    daysRemaining: number;
    parentExamAppointmentId?: number;
    reason: string;
  };
}

export interface LiveQueueItemDto {
  appointmentId: number;
  patientId: number;
  patientName: string;
  fileNumber: string;
  phone: string;
  queueNumber: number | null;
  status: AppointmentStatus;
  isUrgent: boolean;
  isConsultation: boolean;
  serviceName: string;
  doctorName: string;
  arrivedAtUtc: string | null;
  calledAtUtc: string | null;
  invoiceStatus: 'Unpaid' | 'Partial' | 'Paid';
  remainingBalancePiastres: number;
  netTotalPiastres: number;
  paidPiastres: number;
  version: number;
}

export interface ServiceCatalogItemDto {
  id: number;
  name: string;
  code: string;
  category: 'Consultation' | 'Examination' | 'Procedure' | 'Other';
  pricePiastres: number;
  isActive: boolean;
}

export interface ThermalReceiptDto {
  clinicName: string;
  doctorName: string;
  specialty: string;
  receiptNumber: string;
  date: string;
  patientName: string;
  fileNumber: string;
  queueNumber: number | null;
  serviceName: string;
  procedures: string[];
  totalPiastres: number;
  discountPiastres: number;
  netTotalPiastres: number;
  paidPiastres: number;
  remainingPiastres: number;
  paymentMethod: PaymentMethod;
  receptionistName: string;
}

export interface CallNextResponseDto {
  appointmentId: number;
  queueNumber: number;
  patientName: string;
  doctorName: string;
  status: AppointmentStatus;
}

export interface PatientCalledPayload {
  callSequence: number;
  queueNumber: number;
  displayName: string;
  doctorName: string;
  roomName: string;
  appointmentId: number;
  calledAtUtc: string;
}

export interface QueueUpdatedPayload {
  sequenceId: number;
  businessDate: string;
  waitingCount: number;
  inNursingCount: number;
  withDoctorCount: number;
  timestampUtc: string;
}

export interface DoctorBreakPayload {
  isDoctorOnBreak: boolean;
  message?: string;
  timestampUtc: string;
}

export interface UpcomingPatientDto {
  appointmentId: number;
  queueNumber: number;
  displayName: string;
  isUrgent: boolean;
}

export interface TvStateDto {
  currentCalled?: PatientCalledPayload | null;
  currentCall?: PatientCalledPayload | null;
  upcomingWaiting: UpcomingPatientDto[];
  waitingPatients?: UpcomingPatientDto[];
  isDoctorOnBreak: boolean;
  breakMessage?: string | null;
  clinicName: string;
  doctorName: string;
  specialty: string;
}

// ==========================================
// Phase 3A: Clinical, Vitals & Nursing Types
// ==========================================

export type AllergySeverity = 'Mild' | 'Moderate' | 'Severe';
export type BloodSugarType = 'Fasting' | 'Random' | 'PostPrandial';

export interface PatientAllergyDto {
  id: number;
  patientId: number;
  activeIngredient: string;
  allergyName: string;
  severity: AllergySeverity;
  notes?: string;
  createdAtUtc: string;
}

export interface PatientChronicConditionDto {
  id: number;
  patientId: number;
  conditionCode: string;
  conditionName: string;
  notes?: string;
  createdAtUtc: string;
}

export interface PatientClinicalProfileDto {
  patientId: number;
  fullName: string;
  fileNumber: string;
  phone: string;
  gender: 'Male' | 'Female';
  ageYears?: number;
  birthDate?: string;
  bloodType?: string;
  isPregnant: boolean;
  isLactating: boolean;
  allergies: PatientAllergyDto[];
  chronicConditions: PatientChronicConditionDto[];
}

export interface VitalsDto {
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  tempCelsius?: number | null;
  bloodSugarMgDl?: number | null;
  bloodSugarType?: BloodSugarType | null;
  pulseBpm?: number | null;
  spo2Pct?: number | null;
  lmpDate?: string | null;
  isPregnant?: boolean;
  isLactating?: boolean;
  chiefComplaint?: string | null;
  nurseNotes?: string | null;
}

export interface VisitAddendumDto {
  id: number;
  authorName: string;
  content: string;
  createdAtUtc: string;
}

export interface MedicalVisitSummaryDto {
  id: number;
  appointmentId: number;
  patientId: number;
  doctorUserId: number;
  doctorName?: string;
  visitDate: string;
  isDraft: boolean;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  tempCelsius?: number | null;
  bloodSugarMgDl?: number | null;
  bloodSugarType?: BloodSugarType | null;
  pulseBpm?: number | null;
  spo2Pct?: number | null;
  bmi?: number | null;
  chiefComplaint?: string | null;
  nurseNotes?: string | null;
  diagnosis?: string | null;
  completedAtUtc?: string | null;
  version: number;
}

export interface MedicalVisitDetailDto extends MedicalVisitSummaryDto {
  examination?: string | null;
  doctorPrivateNotes?: string | null;
  icd10Code?: string | null;
  specialtyDataJson?: string | null;
  nextVisitDate?: string | null;
  isPregnant?: boolean;
  isLactating?: boolean;
  addenda: VisitAddendumDto[];
  patient?: PatientClinicalProfileDto | any;
  prescriptionItems?: PrescriptionItemDto[];
  clinicalRequests?: ClinicalRequestItemDto[];
}

export interface SaveVitalsRequestDto {
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  tempCelsius?: number | null;
  bloodSugarMgDl?: number | null;
  bloodSugarType?: BloodSugarType | null;
  pulseBpm?: number | null;
  spo2Pct?: number | null;
  lmpDate?: string | null;
  isPregnant?: boolean;
  isLactating?: boolean;
  chiefComplaint?: string | null;
  nurseNotes?: string | null;
  markNursePrepComplete?: boolean;
  version: number;
}

export interface AddAllergyRequestDto {
  activeIngredient: string;
  allergyName: string;
  severity: AllergySeverity;
  notes?: string;
}

export interface AddChronicConditionRequestDto {
  conditionCode: string;
  conditionName: string;
  notes?: string;
}

export interface InitOrGetVisitRequestDto {
  appointmentId: number;
}

export interface PaginatedVisitsResponseDto {
  items: MedicalVisitSummaryDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}


// ==========================================
// Phase 3B: Doctor Cockpit & Drug Safety Types
// ==========================================

export type DrugForm =
  | 'Tablet'
  | 'Capsule'
  | 'Syrup'
  | 'Suspension'
  | 'Injection'
  | 'Drops'
  | 'Ointment'
  | 'Cream'
  | 'Gel'
  | 'Inhaler'
  | 'Suppository'
  | 'Sachet'
  | 'Patch'
  | 'Other';

export interface DrugDto {
  id: number;
  tradeName: string;
  searchTradeName: string;
  activeIngredient: string;
  strength: string;
  form: DrugForm | string;
  category?: string | null;
  defaultDosage?: string | null;
  defaultTiming?: string | null;
  defaultDuration?: string | null;
  avoidInPregnancy: boolean;
  avoidInLactation: boolean;
  isDiscontinued: boolean;
  isDemoSeed?: boolean;
}

export type SafetyWarningType =
  | 'AllergyConflict'
  | 'PregnancyContraindication'
  | 'LactationWarning'
  | 'DuplicateIngredient'
  | 'Discontinued';

export type SafetyWarningSeverity = 'Severe' | 'Moderate' | 'Info';

export interface SafetyWarningDto {
  drugId: number;
  tradeName: string;
  activeIngredient: string;
  type: SafetyWarningType;
  severity: SafetyWarningSeverity;
  titleAr: string;
  messageAr: string;
  requiresOverride: boolean;
}

export type DrugSafetyWarningDto = SafetyWarningDto;

export interface DrugSafetyCheckResultDto {
  hasWarnings: boolean;
  requiresOverride: boolean;
  warnings: SafetyWarningDto[];
}

export interface PrescriptionItemInputDto {
  drugId?: number | null;
  drugName: string;
  activeIngredient?: string | null;
  strength?: string | null;
  form?: string | null;
  dosage: string;
  timing: string;
  duration: string;
  route?: string | null;
  instructions?: string | null;
  warningOverridden?: boolean;
  overrideReason?: string | null;
}

export interface PrescriptionItemDto extends PrescriptionItemInputDto {
  id: number;
  medicalVisitId: number;
  drugNameSnapshot: string;
  strengthSnapshot?: string | null;
  formSnapshot?: string | null;
  activeIngredientSnapshot?: string | null;
}

export interface ClinicalRequestInputDto {
  id?: number;
  requestType: 'Lab' | 'Radiology';
  catalogCode?: string | null;
  nameAr: string;
  nameEn?: string | null;
  notes?: string | null;
}

export interface ClinicalRequestItemDto extends ClinicalRequestInputDto {
  id: number;
  medicalVisitId: number;
  resultSummary?: string | null;
}

export interface PrescriptionTemplateItemDto {
  drugId?: number | null;
  drugName: string;
  activeIngredient?: string | null;
  dosage: string;
  form?: string | null;
  route?: string | null;
  timing: string;
  duration: string;
  instructions?: string | null;
}

export interface PrescriptionTemplateDto {
  id: number;
  templateName: string;
  defaultDiagnosis?: string | null;
  items: PrescriptionTemplateItemDto[];
  labRadiologyOrders?: ClinicalRequestInputDto[];
  doctorUserId: number;
  createdAtUtc: string;
}

export interface CreatePrescriptionTemplateRequestDto {
  templateName: string;
  defaultDiagnosis?: string | null;
  items: PrescriptionTemplateItemDto[];
  labRadiologyOrders?: ClinicalRequestInputDto[];
}

export interface CompleteConsultationRequestDto {
  prescriptionItems: PrescriptionItemInputDto[];
  clinicalRequests: ClinicalRequestInputDto[];
  diagnosis?: string | null;
  icd10Code?: string | null;
  chiefComplaint?: string | null;
  examination?: string | null;
  doctorPrivateNotes?: string | null;
  specialtyDataJson?: string | null;
  nextVisitDate?: string | null;
  version: number;
}

export interface AutosaveDraftNotesRequestDto {
  chiefComplaint?: string | null;
  examination?: string | null;
  diagnosis?: string | null;
  icd10Code?: string | null;
  doctorPrivateNotes?: string | null;
  specialtyDataJson?: string | null;
  nextVisitDate?: string | null;
  nurseNotes?: string | null;
  version: number;
}
