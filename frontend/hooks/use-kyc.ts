import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface KycDocument {
  id: string;
  type: string;
  status: string;
  fileName: string;
}

export interface KycSubmission {
  id: string;
  targetTier: number;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'NEEDS_MORE_INFO';
  riskScore: number | null;
  amlFlag: boolean;
  sanctionsFlag: boolean;
  pepFlag: boolean;
  reviewNote: string | null;
  submittedAt: string;
  documents: KycDocument[];
}

export interface KycStatus {
  currentTier: number;
  submissions: KycSubmission[];
}

export function useKycStatus() {
  return useQuery({
    queryKey: ['kyc-status'],
    queryFn: () => api.get<KycStatus>('/kyc/status'),
  });
}

function useInvalidateKyc() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['kyc-status'] });
}

export function useSubmitTier1() {
  const invalidate = useInvalidateKyc();
  return useMutation({
    mutationFn: (payload: { bvn: string; nin: string }) => api.post<KycSubmission>('/kyc/tier1', payload),
    onSuccess: invalidate,
  });
}

export function useSubmitTier2() {
  const invalidate = useInvalidateKyc();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<KycSubmission>('/kyc/tier2', payload),
    onSuccess: invalidate,
  });
}

export function useSubmitTier3() {
  const invalidate = useInvalidateKyc();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<KycSubmission>('/kyc/tier3', payload),
    onSuccess: invalidate,
  });
}

export function useUploadKycDocument() {
  const invalidate = useInvalidateKyc();
  return useMutation({
    mutationFn: ({ submissionId, type, file }: { submissionId: string; type: string; file: File }) => {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('file', file);
      return api.upload<KycDocument>(`/kyc/submissions/${submissionId}/documents`, formData);
    },
    onSuccess: invalidate,
  });
}

export function useFinalizeSubmission() {
  const invalidate = useInvalidateKyc();
  return useMutation({
    mutationFn: (submissionId: string) => api.post<KycSubmission>(`/kyc/submissions/${submissionId}/finalize`),
    onSuccess: invalidate,
  });
}

export function useRemoveKycDocument() {
  const invalidate = useInvalidateKyc();
  return useMutation({
    mutationFn: (documentId: string) => api.delete(`/kyc/documents/${documentId}`),
    onSuccess: invalidate,
  });
}
