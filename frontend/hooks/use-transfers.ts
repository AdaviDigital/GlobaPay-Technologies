import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TransferRecord {
  id: string;
  reference: string;
  type: 'WALLET_TO_WALLET' | 'CURRENCY_CONVERSION' | 'LOCAL_BANK' | 'INTERNATIONAL_BANK';
  rail: string;
  status: 'SCHEDULED' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  sourceAmount: string;
  sourceCurrencyCode: string;
  destinationAmount: string;
  destinationCurrencyCode: string;
  feeAmount: string;
  totalDebit: string;
  narration: string | null;
  createdAt: string;
  completedAt: string | null;
  beneficiary: { label: string } | null;
}

export function useTransfers() {
  return useQuery({
    queryKey: ['transfers'],
    queryFn: () => api.get<TransferRecord[]>('/transfers'),
  });
}

function useInvalidateAfterTransfer() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['transfers'] });
    queryClient.invalidateQueries({ queryKey: ['wallets'] });
  };
}

export function useWalletToWalletTransfer() {
  const invalidate = useInvalidateAfterTransfer();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<TransferRecord>('/transfers/wallet-to-wallet', payload),
    onSuccess: invalidate,
  });
}

export function useCurrencyConversion() {
  const invalidate = useInvalidateAfterTransfer();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<TransferRecord>('/transfers/convert', payload),
    onSuccess: invalidate,
  });
}

export function useBankTransfer() {
  const invalidate = useInvalidateAfterTransfer();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<TransferRecord>('/transfers/bank', payload),
    onSuccess: invalidate,
  });
}
