import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Order {
  id: string;
  reference: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP';
  status: 'OPEN' | 'FILLED' | 'CANCELLED' | 'EXPIRED';
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  quantity: string;
  triggerPrice: string | null;
  filledPrice: string | null;
  feeAmount: string;
  createdAt: string;
  filledAt: string | null;
}

export function useOrders() {
  return useQuery({
    queryKey: ['crypto-orders'],
    queryFn: () => api.get<Order[]>('/crypto/orders'),
  });
}

function useInvalidateAfterOrder() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['crypto-orders'] });
    queryClient.invalidateQueries({ queryKey: ['crypto-portfolio'] });
    queryClient.invalidateQueries({ queryKey: ['wallets'] });
  };
}

export function usePlaceOrder() {
  const invalidate = useInvalidateAfterOrder();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<Order>('/crypto/orders', payload),
    onSuccess: invalidate,
  });
}

export function useCancelOrder() {
  const invalidate = useInvalidateAfterOrder();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/crypto/orders/${id}`),
    onSuccess: invalidate,
  });
}
