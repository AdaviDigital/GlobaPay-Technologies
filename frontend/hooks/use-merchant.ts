import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface MerchantAccount {
  id: string;
  businessName: string;
  walletId: string;
  apiKeyPrefix: string;
  webhookUrl: string | null;
  apiKey?: string; // only present on the create-account response
}

export interface PaymentLink {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  amount: string;
  currencyCode: string;
  isActive: boolean;
  createdAt: string;
}

export interface Invoice {
  id: string;
  reference: string;
  customerName: string | null;
  customerEmail: string | null;
  amount: string;
  currencyCode: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'VOID';
  createdAt: string;
}

export interface DashboardSummary {
  businessName: string;
  settlementBalance: string;
  settlementCurrency: string;
  totalRevenue: string;
  completedTransactions: number;
  paymentLinkCount: number;
  invoiceCount: number;
}

export function useMerchantAccount() {
  return useQuery({
    queryKey: ['merchant-account'],
    queryFn: () => api.get<MerchantAccount>('/merchant/account'),
    retry: false,
  });
}

export function useCreateMerchantAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { businessName: string; walletId: string; webhookUrl?: string }) =>
      api.post<MerchantAccount>('/merchant/account', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['merchant-account'] }),
  });
}

export function useMerchantDashboard() {
  return useQuery({
    queryKey: ['merchant-dashboard'],
    queryFn: () => api.get<DashboardSummary>('/merchant/dashboard'),
  });
}

export function usePaymentLinks() {
  return useQuery({
    queryKey: ['payment-links'],
    queryFn: () => api.get<PaymentLink[]>('/merchant/payment-links'),
  });
}

export function useCreatePaymentLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<PaymentLink>('/merchant/payment-links', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment-links'] }),
  });
}

export function useDeactivatePaymentLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/merchant/payment-links/${id}/deactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment-links'] }),
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get<Invoice[]>('/merchant/invoices'),
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<Invoice>('/merchant/invoices', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useVoidInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/merchant/invoices/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
}
