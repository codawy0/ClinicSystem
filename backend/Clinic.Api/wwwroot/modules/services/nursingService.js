import { api } from '../lib/api';
export const nursingService = {
    /**
     * Initializes or gets the active medical visit for today's appointment
     */
    async initOrGetVisit(appointmentId) {
        return api.post('/visits/init-or-get', { appointmentId });
    },
    /**
     * Gets full visit details by visit ID
     */
    async getVisit(visitId) {
        return api.get(`/visits/${visitId}`);
    },
    /**
     * Gets paginated prior visits for a patient
     */
    async getPatientVisits(patientId, page = 1, pageSize = 20) {
        return api.get(`/visits/patient/${patientId}`, { page, pageSize });
    },
    /**
     * Saves patient vitals with optimistic concurrency version token.
     * If markNursePrepComplete is true, sets appointment status to Waiting and notifies QueueHub.
     */
    async saveVitals(visitId, data) {
        return api.put(`/visits/${visitId}/vitals`, data);
    },
    /**
     * Autosaves draft clinical notes
     */
    async saveDraft(visitId, data) {
        return api.put(`/visits/${visitId}/draft`, data);
    },
    /**
     * Appends an immutable addendum to a completed visit
     */
    async addAddendum(visitId, noteText) {
        return api.post(`/visits/${visitId}/addenda`, { noteText });
    },
    /**
     * Transitions appointment to InNursing (Nurse Prep active)
     */
    async startNursing(appointmentId) {
        return api.put(`/appointments/${appointmentId}/start-nursing`);
    },
    /**
     * Completes nursing triage and marks appointment ready for doctor (Waiting)
     */
    async completeNursing(appointmentId) {
        return api.put(`/appointments/${appointmentId}/complete-nursing`);
    },
    /**
     * Gets clinical profile (allergies, chronic conditions, pregnancy/lactation)
     */
    async getClinicalProfile(patientId) {
        return api.get(`/clinical-profile/${patientId}`);
    },
    /**
     * Adds a drug allergy with lowercased active ingredient
     */
    async addAllergy(patientId, data) {
        return api.post(`/clinical-profile/${patientId}/allergies`, data);
    },
    /**
     * Deletes a drug allergy
     */
    async deleteAllergy(patientId, allergyId) {
        return api.delete(`/clinical-profile/${patientId}/allergies/${allergyId}`);
    },
    /**
     * Adds a chronic condition
     */
    async addChronicCondition(patientId, data) {
        return api.post(`/clinical-profile/${patientId}/chronic-conditions`, data);
    },
    /**
     * Deletes a chronic condition
     */
    async deleteChronicCondition(patientId, conditionId) {
        return api.delete(`/clinical-profile/${patientId}/chronic-conditions/${conditionId}`);
    },
    /**
     * Gets current active live queue items
     */
    async getLiveQueue() {
        return api.get('/appointments/live-queue');
    },
};
