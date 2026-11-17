import { api } from '../lib/api';
import {
  MedicalVisitDetailDto,
  PaginatedVisitsResponseDto,
  PatientClinicalProfileDto,
  PatientAllergyDto,
  PatientChronicConditionDto,
  SaveVitalsRequestDto,
  AddAllergyRequestDto,
  AddChronicConditionRequestDto,
  VisitAddendumDto,
  LiveQueueItemDto,
} from '../types';

export const nursingService = {
  /**
   * Initializes or gets the active medical visit for today's appointment
   */
  async initOrGetVisit(appointmentId: number): Promise<MedicalVisitDetailDto> {
    return api.post<MedicalVisitDetailDto>('/visits/init-or-get', { appointmentId });
  },

  /**
   * Gets full visit details by visit ID
   */
  async getVisit(visitId: number): Promise<MedicalVisitDetailDto> {
    return api.get<MedicalVisitDetailDto>(`/visits/${visitId}`);
  },

  /**
   * Gets paginated prior visits for a patient
   */
  async getPatientVisits(patientId: number, page: number = 1, pageSize: number = 20): Promise<PaginatedVisitsResponseDto> {
    return api.get<PaginatedVisitsResponseDto>(`/visits/patient/${patientId}`, { page, pageSize });
  },

  /**
   * Saves patient vitals with optimistic concurrency version token.
   * If markNursePrepComplete is true, sets appointment status to Waiting and notifies QueueHub.
   */
  async saveVitals(visitId: number, data: SaveVitalsRequestDto): Promise<MedicalVisitDetailDto> {
    return api.put<MedicalVisitDetailDto>(`/visits/${visitId}/vitals`, data);
  },

  /**
   * Autosaves draft clinical notes
   */
  async saveDraft(visitId: number, data: {
    chiefComplaint?: string | null;
    examination?: string | null;
    diagnosis?: string | null;
    doctorPrivateNotes?: string | null;
    nurseNotes?: string | null;
    version: number;
  }): Promise<MedicalVisitDetailDto> {
    return api.put<MedicalVisitDetailDto>(`/visits/${visitId}/draft`, data);
  },

  /**
   * Appends an immutable addendum to a completed visit
   */
  async addAddendum(visitId: number, noteText: string): Promise<VisitAddendumDto> {
    return api.post<VisitAddendumDto>(`/visits/${visitId}/addenda`, { noteText });
  },

  /**
   * Transitions appointment to InNursing (Nurse Prep active)
   */
  async startNursing(appointmentId: number): Promise<void> {
    return api.put<void>(`/appointments/${appointmentId}/start-nursing`);
  },

  /**
   * Completes nursing triage and marks appointment ready for doctor (Waiting)
   */
  async completeNursing(appointmentId: number): Promise<void> {
    return api.put<void>(`/appointments/${appointmentId}/complete-nursing`);
  },

  /**
   * Gets clinical profile (allergies, chronic conditions, pregnancy/lactation)
   */
  async getClinicalProfile(patientId: number): Promise<PatientClinicalProfileDto> {
    return api.get<PatientClinicalProfileDto>(`/clinical-profile/${patientId}`);
  },

  /**
   * Adds a drug allergy with lowercased active ingredient
   */
  async addAllergy(patientId: number, data: AddAllergyRequestDto): Promise<PatientAllergyDto> {
    return api.post<PatientAllergyDto>(`/clinical-profile/${patientId}/allergies`, data);
  },

  /**
   * Deletes a drug allergy
   */
  async deleteAllergy(patientId: number, allergyId: number): Promise<void> {
    return api.delete<void>(`/clinical-profile/${patientId}/allergies/${allergyId}`);
  },

  /**
   * Adds a chronic condition
   */
  async addChronicCondition(patientId: number, data: AddChronicConditionRequestDto): Promise<PatientChronicConditionDto> {
    return api.post<PatientChronicConditionDto>(`/clinical-profile/${patientId}/chronic-conditions`, data);
  },

  /**
   * Deletes a chronic condition
   */
  async deleteChronicCondition(patientId: number, conditionId: number): Promise<void> {
    return api.delete<void>(`/clinical-profile/${patientId}/chronic-conditions/${conditionId}`);
  },

  /**
   * Gets current active live queue items
   */
  async getLiveQueue(): Promise<LiveQueueItemDto[]> {
    return api.get<LiveQueueItemDto[]>('/appointments/live-queue');
  },
};
