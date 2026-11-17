export interface RevenueTrendPointDto {
  date: string;
  grossPiastres: number;
  netPiastres: number;
  paidPiastres: number;
  patientCount: number;
}

export interface PaymentMethodBreakdownDto {
  cashPiastres: number;
  instapayPiastres: number;
  vodafoneCashPiastres: number;
  cardPiastres: number;
  cashCount: number;
  instapayCount: number;
  vodafoneCashCount: number;
  cardCount: number;
}

export interface DiscountBreakdownDto {
  colleaguePiastres: number;
  staffPiastres: number;
  charityPiastres: number;
  doctorCustomPiastres: number;
}

export interface ServiceCategoryBreakdownDto {
  examCount: number;
  examRevenuePiastres: number;
  consultationCount: number;
  consultationRevenuePiastres: number;
  procedureCount: number;
  procedureRevenuePiastres: number;
}

export interface AnalyticsKpiDto {
  grossRevenuePiastres: number;
  foregoneDiscountsPiastres: number;
  netRevenuePiastres: number;
  paidRevenuePiastres: number;
  refundedPiastres: number;
  pettyCashExpensesPiastres: number;
  netClinicProfitPiastres: number;
  paymentMethods: PaymentMethodBreakdownDto;
  discounts: DiscountBreakdownDto;
  serviceCategories: ServiceCategoryBreakdownDto;
  totalAppointmentsCount: number;
  completedVisitsCount: number;
  uniquePatientsCount: number;
  averageConsultationDurationMinutes: number;
  averageWaitTimeMinutes: number;
  dailyTrends: RevenueTrendPointDto[];
}

export interface AnalyticsFilterParams {
  startDate?: string;
  endDate?: string;
  doctorId?: number;
}
