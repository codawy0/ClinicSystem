import { api } from '../lib/api';
function generateIdempotencyKey() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
export const treasuryService = {
    async getInvoices(params) {
        return api.get('/invoices', params);
    },
    async getInvoiceDetails(id) {
        return api.get(`/invoices/${id}`);
    },
    async getTransactions(params) {
        return api.get('/invoices/transactions', params);
    },
    async recordPayment(invoiceId, data) {
        return api.post(`/invoices/${invoiceId}/payments`, data, { idempotencyKey: generateIdempotencyKey() });
    },
    async refundInvoice(invoiceId, data) {
        return api.post(`/invoices/${invoiceId}/refund`, data, { idempotencyKey: generateIdempotencyKey() });
    },
    async voidInvoice(invoiceId, data) {
        return api.post(`/invoices/${invoiceId}/void`, data, { idempotencyKey: generateIdempotencyKey() });
    },
};
