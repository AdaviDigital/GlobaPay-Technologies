import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Beneficiary {
  id: string;
  type: 'GLOBAPAY_USER' | 'BANK_ACCOUNT';
  label: string;
  isFavorite: boolean;
  beneficiaryTag: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  bankCountry: string | null;
  currencyCode: string | null;
  swiftBic: string | null;
  routingNumber: string | null;
  iban: string | null;
  sortCode: string | null;
}

export function useBeneficiaries() {
  return useQuery({
    queryKey: ['beneficiaries'],
    queryFn: () => api.get<Beneficiary[]>('/beneficiaries'),
  });
}

export function useCreateBeneficiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<Beneficiary>('/beneficiaries', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['beneficiaries'] }),
  });
}

export function useDeleteBeneficiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/beneficiaries/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['beneficiaries'] }),
  });
}
