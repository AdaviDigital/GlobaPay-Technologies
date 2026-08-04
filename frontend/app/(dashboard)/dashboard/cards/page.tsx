'use client';

import { useState } from 'react';
import { CreditCard, Plus, Snowflake, Play, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useWallets } from '@/hooks/use-wallets';
import {
  useCards,
  useIssueCard,
  useFreezeCard,
  useUnfreezeCard,
  useTerminateCard,
  useSetCardLimit,
  useCardStatement,
  useSimulatePurchase,
  type VirtualCard,
} from '@/hooks/use-cards';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

function IssueCardForm({ onDone }: { onDone: () => void }) {
  const { data: wallets } = useWallets();
  const fiatWallets = wallets?.filter((w) => w.currency.type === 'FIAT') ?? [];
  const issueCard = useIssueCard();
  const [walletId, setWalletId] = useState('');
  const [label, setLabel] = useState('');
  const [brand, setBrand] = useState('VERVE');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await issueCard.mutateAsync({ walletId, label, brand });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not issue card.');
    }
  };

  return (
    <Card>
      <h2 className="mb-4 font-display text-lg font-semibold text-ink">Issue a virtual card</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {error && <Alert>{error}</Alert>}
        <Input label="Card label" value={label} onChange={(e) => setLabel(e.target.value)} required />
        <div>
          <label className="text-sm font-medium text-muted">Linked wallet</label>
          <select
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink focus:border-teal/60 focus:outline-none"
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
            required
          >
            <option value="">Select a fiat wallet</option>
            {fiatWallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.currency.code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-muted">Brand</label>
          <select
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink focus:border-teal/60 focus:outline-none"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          >
            <option value="VERVE">Verve</option>
            <option value="MASTERCARD">Mastercard</option>
          </select>
        </div>
        <Button type="submit" isLoading={issueCard.isPending} className="w-fit">
          Issue card
        </Button>
      </form>
    </Card>
  );
}

function CardTile({ card }: { card: VirtualCard }) {
  const freeze = useFreezeCard();
  const unfreeze = useUnfreezeCard();
  const terminate = useTerminateCard();
  const setLimit = useSetCardLimit();
  const simulate = useSimulatePurchase();

  const [showStatement, setShowStatement] = useState(false);
  const { data: statement } = useCardStatement(showStatement ? card.id : null);
  const [limitAmount, setLimitAmount] = useState('');
  const [limitPeriod, setLimitPeriod] = useState('MONTHLY');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  return (
    <Card>
      <div
        className={cn(
          'rounded-2xl bg-gradient-to-br p-5',
          card.brand === 'VERVE' ? 'from-gold/20 to-surface-2' : 'from-teal/20 to-surface-2',
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">{card.brand}</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs',
              card.status === 'ACTIVE' && 'bg-teal/10 text-teal',
              card.status === 'FROZEN' && 'bg-gold/10 text-gold',
              card.status === 'TERMINATED' && 'bg-danger/10 text-danger',
            )}
          >
            {card.status}
          </span>
        </div>
        <p className="mt-6 font-mono text-lg tracking-widest text-ink">•••• •••• •••• {card.last4}</p>
        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span>{card.label}</span>
          <span>
            {String(card.expiryMonth).padStart(2, '0')}/{String(card.expiryYear).slice(-2)}
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {lastResult && (
        <div className="mt-3">
          <Alert tone={lastResult.includes('Declined') ? 'error' : 'success'}>{lastResult}</Alert>
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        {card.spendingLimitAmount
          ? `Limit: ${card.spendingLimitAmount} ${card.wallet.currency.code} / ${card.spendingLimitPeriod?.toLowerCase()}`
          : 'No spending limit set'}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {card.status === 'ACTIVE' && (
          <Button variant="secondary" onClick={() => freeze.mutate(card.id)} isLoading={freeze.isPending}>
            <Snowflake className="h-4 w-4" /> Freeze
          </Button>
        )}
        {card.status === 'FROZEN' && (
          <Button variant="secondary" onClick={() => unfreeze.mutate(card.id)} isLoading={unfreeze.isPending}>
            <Play className="h-4 w-4" /> Unfreeze
          </Button>
        )}
        {card.status !== 'TERMINATED' && (
          <Button variant="danger" onClick={() => terminate.mutate(card.id)} isLoading={terminate.isPending}>
            <Trash2 className="h-4 w-4" /> Terminate
          </Button>
        )}
        <Button variant="ghost" onClick={() => setShowStatement((v) => !v)}>
          Statement
        </Button>
      </div>

      {card.status !== 'TERMINATED' && (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <Input label="Limit amount" inputMode="decimal" value={limitAmount} onChange={(e) => setLimitAmount(e.target.value)} />
          <select
            className="rounded-xl border border-border bg-surface-2 px-3 py-3 text-sm text-ink focus:border-teal/60 focus:outline-none"
            value={limitPeriod}
            onChange={(e) => setLimitPeriod(e.target.value)}
          >
            <option value="DAILY">Daily</option>
            <option value="MONTHLY">Monthly</option>
          </select>
          <Button
            variant="secondary"
            onClick={() => setLimit.mutate({ id: card.id, amount: limitAmount, period: limitPeriod })}
            isLoading={setLimit.isPending}
          >
            Set limit
          </Button>
        </div>
      )}

      {card.status === 'ACTIVE' && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Input label="Test purchase amount" inputMode="decimal" value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value)} />
          <Input label="Merchant" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} />
          <Button
            variant="secondary"
            isLoading={simulate.isPending}
            onClick={async () => {
              setError(null);
              try {
                const result = await simulate.mutateAsync({ id: card.id, amount: purchaseAmount, merchantName });
                setLastResult(result.status === 'APPROVED' ? 'Approved' : `Declined — ${result.declineReason}`);
              } catch (err) {
                setError(err instanceof ApiError ? err.message : 'Simulation failed.');
              }
            }}
          >
            Simulate purchase
          </Button>
        </div>
      )}

      {showStatement && (
        <div className="mt-4 flex flex-col divide-y divide-border border-t border-border">
          {statement?.length === 0 && <p className="py-3 text-sm text-muted">No transactions yet.</p>}
          {statement?.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-ink">{tx.merchantName}</span>
              <span className={cn('font-mono tabular-nums', tx.status === 'DECLINED' ? 'text-danger' : 'text-ink')}>
                {tx.amount} {tx.currencyCode}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function CardsPage() {
  const { data: cards, isLoading } = useCards();
  const [issuing, setIssuing] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-gold">
            <CreditCard className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Virtual Cards</h1>
            <p className="mt-1 text-sm text-muted">Spend from a wallet with adjustable limits.</p>
          </div>
        </div>
        <Button variant="primary" onClick={() => setIssuing((v) => !v)}>
          <Plus className="h-4 w-4" /> Issue card
        </Button>
      </div>

      {issuing && <IssueCardForm onDone={() => setIssuing(false)} />}

      {isLoading && <p className="text-sm text-muted">Loading cards…</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {cards?.map((card) => (
          <CardTile key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
