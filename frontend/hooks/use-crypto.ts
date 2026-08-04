import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface CryptoPrice {
  code: string;
  name: string;
  symbol: string;
  price: string;
}

export interface PortfolioHolding {
  currencyCode: string;
  currencyName: string;
  balance: string;
  valueInUsdt: string;
}

export interface Portfolio {
  holdings: PortfolioHolding[];
  totalValueInUsdt: string;
}

export function useCryptoPrices() {
  return useQuery({
    queryKey: ['crypto-prices'],
    queryFn: () => api.get<CryptoPrice[]>('/crypto/prices'),
    refetchInterval: 30_000,
  });
}

export function usePortfolio() {
  return useQuery({
    queryKey: ['crypto-portfolio'],
    queryFn: () => api.get<Portfolio>('/crypto/orders/portfolio'),
  });
}
