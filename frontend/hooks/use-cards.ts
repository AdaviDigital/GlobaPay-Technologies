import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface VirtualCard {
  id: string;
  label: string;
  brand: 'VERVE' | 'MASTERCARD';
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  status: 'ACTIVE' | 'FROZEN' | 'TERMINATED';
  spendingLimitAmount: string | null;
  spendingLimitPeriod: string | null;
  wallet: { currency: { code: string; symbol: string } };
}

export interface CardTransaction {
  id: string;
  amount: string;
  currencyCode: string;
  merchantName: string;
  status: 'APPROVED' | 'DECLINED';
  declineReason: string | null;
  createdAt: string;
}

export function useCards() {
  return useQuery({
    queryKey: ['cards'],
    queryFn: () => api.get<VirtualCard[]>('/cards'),
  });
}

function useInvalidateCards() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['cards'] });
}

export function useIssueCard() {
  const invalidate = useInvalidateCards();
  return useMutation({
    mutationFn: (payload: { walletId: string; label: string; brand: string }) =>
      api.post<VirtualCard>('/cards', payload),
    onSuccess: invalidate,
  });
}

export function useFreezeCard() {
  const invalidate = useInvalidateCards();
  return useMutation({
    mutationFn: (id: string) => api.patch<VirtualCard>(`/cards/${id}/freeze`),
    onSuccess: invalidate,
  });
}

export function useUnfreezeCard() {
  const invalidate = useInvalidateCards();
  return useMutation({
    mutationFn: (id: string) => api.patch<VirtualCard>(`/cards/${id}/unfreeze`),
    onSuccess: invalidate,
  });
}

export function useTerminateCard() {
  const invalidate = useInvalidateCards();
  return useMutation({
    mutationFn: (id: string) => api.delete<VirtualCard>(`/cards/${id}`),
    onSuccess: invalidate,
  });
}

export function useSetCardLimit() {
  const invalidate = useInvalidateCards();
  return useMutation({
    mutationFn: ({ id, amount, period }: { id: string; amount: string; period: string }) =>
      api.patch<VirtualCard>(`/cards/${id}/limit`, { amount, period }),
    onSuccess: invalidate,
  });
}

export function useCardStatement(cardId: string | null) {
  return useQuery({
    queryKey: ['card-statement', cardId],
    queryFn: () => api.get<CardTransaction[]>(`/cards/${cardId}/statement`),
    enabled: Boolean(cardId),
  });
}

export function useSimulatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount, merchantName }: { id: string; amount: string; merchantName: string }) =>
      api.post<CardTransaction>(`/cards/${id}/simulate-purchase`, { amount, merchantName }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['card-statement', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
  });
}
