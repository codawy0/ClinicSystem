import { api } from '../lib/api';
import { AnalyticsKpiDto, AnalyticsFilterParams } from '../types/analytics';

export const analyticsService = {
  async getKpis(params?: AnalyticsFilterParams): Promise<AnalyticsKpiDto> {
    return api.get<AnalyticsKpiDto>('/analytics/kpi', params);
  },
};
