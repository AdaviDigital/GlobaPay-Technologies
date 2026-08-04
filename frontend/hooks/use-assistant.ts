import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AiMessage {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  createdAt: string;
}

export interface AiConversation {
  id: string;
  title: string | null;
  updatedAt: string;
}

export interface HealthScore {
  score: number;
  factors: { label: string; score: number; weight: number; note: string }[];
}

export interface SpendingRow {
  category: string;
  total: string;
}

export interface BudgetStatus {
  category: string;
  currencyCode: string;
  monthlyLimit: string;
  spent: string;
  remaining: string;
  percentUsed: number;
}

export interface FraudAlert {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'DISMISSED' | 'CONFIRMED';
  reason: string;
  createdAt: string;
}

export function useAiStatus() {
  return useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.get<{ configured: boolean }>('/ai/status'),
  });
}

export function useConversations() {
  return useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => api.get<AiConversation[]>('/ai/conversations'),
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ['ai-conversation', id],
    queryFn: () => api.get<{ id: string; messages: AiMessage[] }>(`/ai/conversations/${id}`),
    enabled: Boolean(id),
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { conversationId?: string; message: string }) =>
      api.post<{ conversationId: string; message: AiMessage }>('/ai/chat', payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['ai-conversation', data.conversationId] });
    },
  });
}

export function useHealthScore() {
  return useQuery({
    queryKey: ['health-score'],
    queryFn: () => api.get<HealthScore>('/ai/insights/health-score'),
  });
}

export function useSpendingByCategory() {
  return useQuery({
    queryKey: ['spending-by-category'],
    queryFn: () => api.get<SpendingRow[]>('/ai/insights/spending'),
  });
}

export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: () => api.get<BudgetStatus[]>('/ai/budgets'),
  });
}

export function useUpsertBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { category: string; currencyCode: string; monthlyLimit: string }) =>
      api.post('/ai/budgets', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] }),
  });
}

export function useFraudAlerts() {
  return useQuery({
    queryKey: ['fraud-alerts'],
    queryFn: () => api.get<FraudAlert[]>('/ai/fraud-alerts'),
  });
}

export function useDismissFraudAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/ai/fraud-alerts/${id}/dismiss`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fraud-alerts'] }),
  });
}
