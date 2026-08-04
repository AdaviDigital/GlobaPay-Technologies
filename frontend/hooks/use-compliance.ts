import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { KycSubmission } from './use-kyc';

export interface QueuedSubmission extends KycSubmission {
  user: { id: string; firstName: string; lastName: string; email: string | null };
}

export function useComplianceQueue() {
  return useQuery({
    queryKey: ['compliance-queue'],
    queryFn: () => api.get<QueuedSubmission[]>('/compliance/kyc/queue'),
  });
}

export function useReviewSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: string; note?: string }) =>
      api.patch<KycSubmission>(`/compliance/kyc/submissions/${id}/review`, { decision, note }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['compliance-queue'] }),
  });
}
