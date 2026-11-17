import { api } from '../lib/api';
import {
  InvoiceListItemDto,
  InvoiceDetailDto,
  FinancialTransactionDto,
  RecordPaymentRequest,
  RefundRequest,
  VoidInvoiceRequest,
  TreasuryFilterParams,
} from '../types/treasury';

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const treasuryService = {
  async getInvoices(params?: TreasuryFilterParams): Promise<InvoiceListItemDto[]> {
    return api.get<InvoiceListItemDto[]>('/invoices', params);
  },

  async getInvoiceDetails(id: number): Promise<InvoiceDetailDto> {
    return api.get<InvoiceDetailDto>(`/invoices/${id}`);
  },

  async getTransactions(params?: { startDate?: string; endDate?: string }): Promise<FinancialTransactionDto[]> {
    return api.get<FinancialTransactionDto[]>('/invoices/transactions', params);
  },

  async recordPayment(invoiceId: number, data: RecordPaymentRequest): Promise<InvoiceDetailDto> {
    return api.post<InvoiceDetailDto>(
      `/invoices/${invoiceId}/payments`,
      data,
      { idempotencyKey: generateIdempotencyKey() }
    );
  },

  async refundInvoice(
    invoiceId: number,
    data: RefundRequest
  ): Promise<{ transactionId: number; newBalancePiastres: number; invoice: InvoiceDetailDto }> {
    return api.post(
      `/invoices/${invoiceId}/refund`,
      data,
      { idempotencyKey: generateIdempotencyKey() }
    );
  },

  async voidInvoice(invoiceId: number, data: VoidInvoiceRequest): Promise<InvoiceDetailDto> {
    return api.post<InvoiceDetailDto>(
      `/invoices/${invoiceId}/void`,
      data,
      { idempotencyKey: generateIdempotencyKey() }
    );
  },
};
