import { api } from '../lib/api';
export const doctorService = {
    // Drugs & Catalog
    async searchDrugs(query) {
        return api.get('/drugs/search', { q: query });
    },
    async getDrug(id) {
        return api.get(`/drugs/${id}`);
    },
    // Drug Safety Check
    async checkSafety(payload) {
        return api.post('/drugs/safety-check', payload);
    },
    // Prescription Templates
    async getTemplates() {
        return api.get('/prescription-templates');
    },
    async getTemplate(id) {
        return api.get(`/prescription-templates/${id}`);
    },
    async createTemplate(data) {
        return api.post('/prescription-templates', data);
    },
    async createTemplateFromVisit(visitId, templateName) {
        return api.post(`/prescription-templates/from-visit/${visitId}`, { templateName });
    },
    async deleteTemplate(id) {
        return api.delete(`/prescription-templates/${id}`);
    },
    // Consultation Completion
    async completeConsultation(visitId, data) {
        return api.post(`/visits/${visitId}/complete`, data);
    },
    // Autosave Draft Notes
    async saveDraft(visitId, data) {
        return api.put(`/visits/${visitId}/draft`, data);
    },
    // Queue Operations
    async callNext(doctorUserId) {
        return api.post('/queue/call-next', { doctorUserId });
    },
    async recall(appointmentId) {
        return api.post(`/queue/${appointmentId}/recall`, {});
    },
    async skip(appointmentId) {
        return api.post(`/queue/${appointmentId}/skip`, {});
    },
    async toggleDoctorBreak() {
        return api.post('/queue/doctor-break', {});
    },
    async getTodayQueue(doctorId) {
        const raw = await api.get('/queue/today', { doctorId });
        if (!Array.isArray(raw))
            return [];
        return raw.map((a) => ({
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
    async getPatientVisits(patientId, page = 1, pageSize = 10) {
        return api.get(`/visits/patient/${patientId}`, { page, pageSize });
    },
    async getVisit(visitId) {
        return api.get(`/visits/${visitId}`);
    },
    async getClinicalProfile(patientId) {
        return api.get(`/clinical-profile/${patientId}`);
    },
    async initOrGetVisit(appointmentId) {
        return api.post('/visits/init-or-get', { appointmentId });
    },
};
