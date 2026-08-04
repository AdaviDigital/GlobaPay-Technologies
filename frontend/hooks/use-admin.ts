import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AdminUserSummary {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: string;
  kycTier: number;
  roles: string[];
  createdAt: string;
}

export interface PlatformSummary {
  userCount: number;
  activeUserCount: number;
  walletCount: number;
  completedTransferCount: number;
  openCryptoOrders: number;
  pendingKycSubmissions: number;
  openP2pDisputes: number;
  feeRevenueByCurrency: { currency: string; total: string }[];
  transferVolumeByCurrency: { currency: string; total: string }[];
}

export interface FeatureFlag {
  id: string;
  key: string;
  isEnabled: boolean;
  description: string | null;
}

export interface FeeRule {
  id: string;
  transferType: string;
  rail: string | null;
  percentageFee: string;
  flatFee: string;
  isActive: boolean;
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  createdAt: string;
}

export function useAdminUsers(query: string, status: string) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (status) params.set('status', status);
  return useQuery({
    queryKey: ['admin-users', query, status],
    queryFn: () => api.get<{ total: number; items: AdminUserSummary[] }>(`/admin/users?${params.toString()}`),
  });
}

export function useAdminUserDetail(id: string | null) {
  return useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => api.get(`/admin/users/${id}`),
    enabled: Boolean(id),
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      api.patch(`/admin/users/${id}/status`, { status, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user'] });
    },
  });
}

export function usePlatformSummary() {
  return useQuery({
    queryKey: ['platform-summary'],
    queryFn: () => api.get<PlatformSummary>('/admin/analytics/summary'),
  });
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => api.get<FeatureFlag[]>('/admin/platform/feature-flags'),
  });
}

export function useUpsertFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { key: string; isEnabled: boolean; description?: string }) =>
      api.post('/admin/platform/feature-flags', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feature-flags'] }),
  });
}

export function useFeeRules() {
  return useQuery({
    queryKey: ['fee-rules'],
    queryFn: () => api.get<FeeRule[]>('/admin/platform/fee-rules'),
  });
}

export function useSetFeeRuleActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/platform/fee-rules/${id}/active`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fee-rules'] }),
  });
}

export function useAuditLog(userId: string, action: string) {
  const params = new URLSearchParams();
  if (userId) params.set('userId', userId);
  if (action) params.set('action', action);
  return useQuery({
    queryKey: ['audit-log', userId, action],
    queryFn: () => api.get<{ total: number; items: AuditLogEntry[] }>(`/admin/audit-log?${params.toString()}`),
  });
}
