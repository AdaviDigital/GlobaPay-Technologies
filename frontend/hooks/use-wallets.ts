import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { WalletSummary } from '@/components/dashboard/wallet-card';

export function useWallets() {
  return useQuery({
    queryKey: ['wallets'],
    queryFn: () => api.get<WalletSummary[]>('/wallets'),
  });
}
