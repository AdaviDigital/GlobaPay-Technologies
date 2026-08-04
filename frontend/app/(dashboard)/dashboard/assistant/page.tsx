'use client';

import { useState } from 'react';
import { Sparkles, Send, AlertTriangle, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import {
  useAiStatus,
  useConversation,
  useSendMessage,
  useHealthScore,
  useSpendingByCategory,
  useBudgets,
  useUpsertBudget,
  useFraudAlerts,
  useDismissFraudAlert,
} from '@/hooks/use-assistant';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

function ChatPanel() {
  const { data: status } = useAiStatus();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const { data: conversation } = useConversation(conversationId);
  const sendMessage = useSendMessage();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setError(null);
    const text = input;
    setInput('');
    try {
      const result = await sendMessage.mutateAsync({ conversationId: conversationId ?? undefined, message: text });
      setConversationId(result.conversationId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Message failed to send.');
    }
  };

  if (status && !status.configured) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        <Sparkles className="h-8 w-8 text-muted" />
        <p className="text-sm text-muted">
          The AI assistant isn&apos;t configured on this deployment yet — an administrator needs to set an API key.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex h-[32rem] flex-col">
      <div className="flex-1 overflow-y-auto">
        {!conversation && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted">
            <Sparkles className="h-6 w-6" />
            Ask about your spending, balances, or financial health.
          </div>
        )}
        <div className="flex flex-col gap-3">
          {conversation?.messages
            .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
            .map((m) => (
              <div
                key={m.id}
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                  m.role === 'USER' ? 'ml-auto bg-gold text-base' : 'bg-surface-2 text-ink',
                )}
              >
                {m.content}
              </div>
            ))}
          {sendMessage.isPending && <div className="max-w-[80%] rounded-2xl bg-surface-2 px-4 py-2.5 text-sm text-muted">Thinking…</div>}
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="How much did I spend on food this month?"
          className="flex-1"
        />
        <Button type="submit" isLoading={sendMessage.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}

function HealthScoreCard() {
  const { data } = useHealthScore();
  if (!data) return null;

  return (
    <Card>
      <p className="text-sm text-muted">Financial health score</p>
      <p className="mt-1 font-mono text-4xl font-semibold tabular-nums text-ink">{data.score}</p>
      <div className="mt-4 flex flex-col gap-2">
        {data.factors.map((f) => (
          <div key={f.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">{f.label}</span>
              <span className="text-ink">{Math.round(f.score)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-2">
              <div className="h-1.5 rounded-full bg-teal" style={{ width: `${f.score}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">{f.note}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SpendingCard() {
  const { data } = useSpendingByCategory();
  return (
    <Card>
      <p className="text-sm font-medium text-ink">Spending by category (30 days)</p>
      <div className="mt-3 flex flex-col divide-y divide-border">
        {data?.length === 0 && <p className="py-3 text-sm text-muted">No spending yet.</p>}
        {data?.map((row) => (
          <div key={row.category} className="flex items-center justify-between py-2 text-sm">
            <span className="text-ink">{row.category}</span>
            <span className="font-mono tabular-nums text-muted">{Number(row.total).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BudgetsCard() {
  const { data } = useBudgets();
  const upsert = useUpsertBudget();
  const [form, setForm] = useState({ category: '', currencyCode: 'USD', monthlyLimit: '' });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await upsert.mutateAsync(form);
      setForm({ category: '', currencyCode: 'USD', monthlyLimit: '' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save budget.');
    }
  };

  return (
    <Card>
      <p className="text-sm font-medium text-ink">Budgets</p>
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        <Input label="Category" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
        <Input label="Currency" value={form.currencyCode} onChange={(e) => setForm((p) => ({ ...p, currencyCode: e.target.value.toUpperCase() }))} />
        <Input label="Monthly limit" inputMode="decimal" value={form.monthlyLimit} onChange={(e) => setForm((p) => ({ ...p, monthlyLimit: e.target.value }))} />
        <Button type="submit" isLoading={upsert.isPending}>
          Save
        </Button>
      </form>

      <div className="mt-4 flex flex-col divide-y divide-border">
        {data?.map((b) => (
          <div key={b.category} className="py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink">{b.category}</span>
              <span className="font-mono text-muted">
                {b.spent} / {b.monthlyLimit} {b.currencyCode}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-surface-2">
              <div
                className={cn('h-1.5 rounded-full', b.percentUsed > 100 ? 'bg-danger' : 'bg-gold')}
                style={{ width: `${Math.min(b.percentUsed, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function FraudAlertsCard() {
  const { data } = useFraudAlerts();
  const dismiss = useDismissFraudAlert();
  const openAlerts = data?.filter((a) => a.status === 'OPEN') ?? [];

  if (openAlerts.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-danger" />
        <p className="text-sm font-medium text-ink">Fraud alerts</p>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {openAlerts.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm">
            <span className="text-ink">{a.reason}</span>
            <button onClick={() => dismiss.mutate(a.id)} className="text-muted hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function AssistantPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-gold">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Assistant</h1>
          <p className="mt-1 text-sm text-muted">Insights and answers grounded in your own data.</p>
        </div>
      </div>

      <FraudAlertsCard />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChatPanel />
        <div className="flex flex-col gap-6">
          <HealthScoreCard />
          <SpendingCard />
        </div>
      </div>

      <BudgetsCard />
    </div>
  );
}
