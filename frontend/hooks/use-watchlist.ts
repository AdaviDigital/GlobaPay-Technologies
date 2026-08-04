import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface WatchlistEntry {
  currencyCode: string;
  price: string | null;
}

export interface PriceAlert {
  id: string;
  currencyCode: string;
  quoteCurrencyCode: string;
  direction: 'ABOVE' | 'BELOW';
  targetPrice: string;
  isTriggered: boolean;
  createdAt: string;
}

export function useWatchlist() {
  return useQuery({
    queryKey: ['watchlist'],
    queryFn: () => api.get<WatchlistEntry[]>('/crypto/watchlist'),
  });
}

export function useToggleWatchlist() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['watchlist'] });

  const add = useMutation({
    mutationFn: (code: string) => api.post(`/crypto/watchlist/${code}`),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (code: string) => api.delete(`/crypto/watchlist/${code}`),
    onSuccess: invalidate,
  });

  return { add, remove };
}

export function useAlerts() {
  return useQuery({
    queryKey: ['price-alerts'],
    queryFn: () => api.get<PriceAlert[]>('/crypto/alerts'),
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<PriceAlert>('/crypto/alerts', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['price-alerts'] }),
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/crypto/alerts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['price-alerts'] }),
  });
}
