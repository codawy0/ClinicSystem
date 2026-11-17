import { api } from '../lib/api';
export const analyticsService = {
    async getKpis(params) {
        return api.get('/analytics/kpi', params);
    },
};
