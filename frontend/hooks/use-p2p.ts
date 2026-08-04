import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface P2POffer {
  id: string;
  assetType: 'CRYPTO' | 'GIFT_CARD';
  assetCode: string;
  quoteCurrencyCode: string;
  pricePerUnit: string;
  availableQuantity: string;
  minOrderQuantity: string;
  maxOrderQuantity: string;
  status: 'ACTIVE' | 'PAUSED' | 'CLOSED';
  terms: string | null;
  seller?: { id: string; firstName: string; lastName: string };
}

export interface P2POrder {
  id: string;
  reference: string;
  assetType: 'CRYPTO' | 'GIFT_CARD';
  assetCode: string;
  quantity: string;
  pricePerUnit: string;
  totalAmount: string;
  quoteCurrencyCode: string;
  status: 'PENDING_DELIVERY' | 'DELIVERED' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED';
  buyerId: string;
  sellerId: string;
  createdAt: string;
  review: { rating: number } | null;
}

export function useOffers(filters?: { assetType?: string; assetCode?: string }) {
  const params = new URLSearchParams();
  if (filters?.assetType) params.set('assetType', filters.assetType);
  if (filters?.assetCode) params.set('assetCode', filters.assetCode);
  const query = params.toString();

  return useQuery({
    queryKey: ['p2p-offers', filters],
    queryFn: () => api.get<P2POffer[]>(`/p2p/offers${query ? `?${query}` : ''}`),
  });
}

export function useMyOffers() {
  return useQuery({
    queryKey: ['p2p-my-offers'],
    queryFn: () => api.get<P2POffer[]>('/p2p/offers/mine'),
  });
}

export function useCreateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<P2POffer>('/p2p/offers', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['p2p-my-offers'] }),
  });
}

export function useSetOfferStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'pause' | 'resume' | 'close' }) =>
      api.patch<P2POffer>(`/p2p/offers/${id}/${action}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['p2p-my-offers'] }),
  });
}

export function useCreateP2POrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, ...payload }: { offerId: string; quantity: string; pin: string }) =>
      api.post<P2POrder>(`/p2p/offers/${offerId}/orders`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['p2p-orders'] });
      queryClient.invalidateQueries({ queryKey: ['p2p-offers'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
  });
}

export function useP2POrders() {
  return useQuery({
    queryKey: ['p2p-orders'],
    queryFn: () => api.get<P2POrder[]>('/p2p/orders'),
  });
}

function useInvalidateOrders() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['p2p-orders'] });
    queryClient.invalidateQueries({ queryKey: ['wallets'] });
  };
}

export function useDeliverCode() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: ({ orderId, code }: { orderId: string; code: string }) =>
      api.post<P2POrder>(`/p2p/orders/${orderId}/deliver`, { code }),
    onSuccess: invalidate,
  });
}

export function useConfirmDelivery() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (orderId: string) => api.post<P2POrder>(`/p2p/orders/${orderId}/confirm`),
    onSuccess: invalidate,
  });
}

export function useRaiseDispute() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      api.post<P2POrder>(`/p2p/orders/${orderId}/dispute`, { reason }),
    onSuccess: invalidate,
  });
}

export function useGiftCardCode(orderId: string | null) {
  return useQuery({
    queryKey: ['p2p-code', orderId],
    queryFn: () => api.get<{ code: string }>(`/p2p/orders/${orderId}/code`),
    enabled: Boolean(orderId),
  });
}

export interface GiftCardValidation {
  status: 'PASSED' | 'FLAGGED' | 'REJECTED';
  riskScore: number;
  formatCheckPassed: boolean;
  duplicateCheckPassed: boolean;
  notes: string | null;
}

export function useGiftCardValidation(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['p2p-validation', orderId],
    queryFn: () => api.get<GiftCardValidation>(`/p2p/orders/${orderId}/validation`),
    enabled,
  });
}
