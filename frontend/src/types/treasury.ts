import { PaymentMethod, InvoiceStatus, DiscountReason } from './index';

export interface InvoiceListItemDto {
  id: number;
  appointmentId?: number | null;
  patientId: number;
  patientName: string;
  fileNumber: string;
  patientPhone: string;
  doctorName: string;
  doctorUserId?: number;
  serviceName: string;
  totalPiastres: number;
  discountPiastres: number;
  discountReason: DiscountReason;
  netTotalPiastres: number;
  paidPiastres: number;
  remainingPiastres: number;
  refundedPiastres: number;
  status: InvoiceStatus;
  version: number;
  createdAtUtc: string;
}

export interface InvoiceLineDto {
  id: number;
  serviceCatalogId?: number;
  serviceName: string;
  quantity: number;
  unitPricePiastres: number;
  totalPricePiastres: number;
}

export interface FinancialTransactionDto {
  id: number;
  shiftId: number;
  invoiceId?: number | null;
  type: 'Payment' | 'Refund' | 'Expense' | 'VoidReversal';
  amountPiastres: number;
  paymentMethod: PaymentMethod;
  expenseCategory?: string | null;
  referenceNumber?: string | null;
  description?: string | null;
  createdByUserId: number;
  createdByName?: string;
  createdAtUtc: string;
}

export interface InvoiceDetailDto extends InvoiceListItemDto {
  lines: InvoiceLineDto[];
  transactions: FinancialTransactionDto[];
}

export interface RecordPaymentRequest {
  amountPiastres: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  version: number;
}

export interface RefundRequest {
  amountPiastres: number;
  reason: string;
  paymentMethod?: PaymentMethod;
  version: number;
}

export interface VoidInvoiceRequest {
  reason: string;
  version: number;
}

export interface TreasuryFilterParams {
  startDate?: string;
  endDate?: string;
  status?: string;
  paymentMethod?: string;
  doctorId?: number;
  search?: string;
}
