import { api } from '../lib/api';
import {
  DrugDto,
  DrugSafetyCheckResultDto,
  PrescriptionTemplateDto,
  CreatePrescriptionTemplateRequestDto,
  MedicalVisitDetailDto,
  PaginatedVisitsResponseDto,
  CompleteConsultationRequestDto,
  AutosaveDraftNotesRequestDto,
  CallNextResponseDto,
  LiveQueueItemDto,
  PatientClinicalProfileDto,
} from '../types';

export const doctorService = {
  // Drugs & Catalog
  async searchDrugs(query: string): Promise<DrugDto[]> {
    return api.get<DrugDto[]>('/drugs/search', { q: query });
  },

  async getDrug(id: number): Promise<DrugDto> {
    return api.get<DrugDto>(`/drugs/${id}`);
  },

  // Drug Safety Check
  async checkSafety(payload: {
    patientId: number;
    drugIds: number[];
    isPregnant: boolean;
    isLactating: boolean;
  }): Promise<DrugSafetyCheckResultDto> {
    return api.post<DrugSafetyCheckResultDto>('/drugs/safety-check', payload);
  },

  // Prescription Templates
  async getTemplates(): Promise<PrescriptionTemplateDto[]> {
    return api.get<PrescriptionTemplateDto[]>('/prescription-templates');
  },

  async getTemplate(id: number): Promise<PrescriptionTemplateDto> {
    return api.get<PrescriptionTemplateDto>(`/prescription-templates/${id}`);
  },

  async createTemplate(data: CreatePrescriptionTemplateRequestDto): Promise<PrescriptionTemplateDto> {
    return api.post<PrescriptionTemplateDto>('/prescription-templates', data);
  },

  async createTemplateFromVisit(visitId: number, templateName: string): Promise<PrescriptionTemplateDto> {
    return api.post<PrescriptionTemplateDto>(`/prescription-templates/from-visit/${visitId}`, { templateName });
  },

  async deleteTemplate(id: number): Promise<void> {
    return api.delete<void>(`/prescription-templates/${id}`);
  },

  // Consultation Completion
  async completeConsultation(visitId: number, data: CompleteConsultationRequestDto): Promise<MedicalVisitDetailDto> {
    return api.post<MedicalVisitDetailDto>(`/visits/${visitId}/complete`, data);
  },

  // Autosave Draft Notes
  async saveDraft(visitId: number, data: AutosaveDraftNotesRequestDto): Promise<MedicalVisitDetailDto> {
    return api.put<MedicalVisitDetailDto>(`/visits/${visitId}/draft`, data);
  },

  // Queue Operations
  async callNext(doctorUserId: number): Promise<CallNextResponseDto> {
    return api.post<CallNextResponseDto>('/queue/call-next', { doctorUserId });
  },

  async recall(appointmentId: number): Promise<void> {
    return api.post<void>(`/queue/${appointmentId}/recall`, {});
  },

  async skip(appointmentId: number): Promise<void> {
    return api.post<void>(`/queue/${appointmentId}/skip`, {});
  },

  async toggleDoctorBreak(): Promise<void> {
    return api.post<void>('/queue/doctor-break', {});
  },

  async getTodayQueue(doctorId?: number): Promise<LiveQueueItemDto[]> {
    const raw = await api.get<any[]>('/queue/today', { doctorId });
    if (!Array.isArray(raw)) return [];
    return raw.map((a: any) => ({
      appointmentId: a.appointmentId ?? a.id,
      patientId: a.patientId,
      patientName: a.patientName || '',
      fileNumber: a.fileNumber || '',
      phone: a.patientPhone || a.phone || '',
      queueNumber: a.queueNumber,
      status: a.status,
      isUrgent: Boolean(a.isUrgent),
      isConsultation: Boolean(a.isConsultation),
      serviceName: a.serviceName || '',
      doctorName: a.doctorName || '',
      arrivedAtUtc: a.arrivedAtUtc,
      calledAtUtc: a.calledAtUtc,
      invoiceStatus: a.invoiceStatus || 'Paid',
      remainingBalancePiastres: a.remainingPiastres ?? 0,
      netTotalPiastres: a.netTotalPiastres ?? 0,
      paidPiastres: a.paidPiastres ?? 0,
      version: a.version ?? 1,
    }));
  },

  // Patient Clinical History
  async getPatientVisits(patientId: number, page: number = 1, pageSize: number = 10): Promise<PaginatedVisitsResponseDto> {
    return api.get<PaginatedVisitsResponseDto>(`/visits/patient/${patientId}`, { page, pageSize });
  },

  async getVisit(visitId: number): Promise<MedicalVisitDetailDto> {
    return api.get<MedicalVisitDetailDto>(`/visits/${visitId}`);
  },

  async getClinicalProfile(patientId: number): Promise<PatientClinicalProfileDto> {
    return api.get<PatientClinicalProfileDto>(`/clinical-profile/${patientId}`);
  },

  async initOrGetVisit(appointmentId: number): Promise<MedicalVisitDetailDto> {
    return api.post<MedicalVisitDetailDto>('/visits/init-or-get', { appointmentId });
  },
};
