'use client';

import { useEffect, useState } from 'react';
import { Star, Wallet, Bell, Trash2, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { PinField } from '@/components/dashboard/pin-field';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { useCryptoPrices, usePortfolio } from '@/hooks/use-crypto';
import { useOrders, usePlaceOrder, useCancelOrder } from '@/hooks/use-orders';
import { useWatchlist, useToggleWatchlist, useAlerts, useCreateAlert, useDeleteAlert } from '@/hooks/use-watchlist';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

function formatPrice(price: string | null) {
  if (price === null) return '—';
  const num = Number(price);
  return num < 1 ? num.toFixed(4) : num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function PortfolioSummary() {
  const { data: portfolio, isLoading } = usePortfolio();

  return (
    <Card className="bg-gradient-to-br from-surface to-surface-2">
      <p className="text-sm text-muted">Total crypto value</p>
      <p className="mt-2 font-mono text-4xl font-semibold tabular-nums text-ink">
        ${isLoading ? '—' : Number(portfolio?.totalValueInUsdt ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </p>
      <p className="mt-1 text-xs text-muted">Valued in USDT</p>

      {portfolio && portfolio.holdings.length > 0 && (
        <div className="mt-4 flex flex-col divide-y divide-border">
          {portfolio.holdings.map((h) => (
            <div key={h.currencyCode} className="flex items-center justify-between py-2 text-sm">
              <span className="text-ink">{h.currencyCode}</span>
              <span className="font-mono tabular-nums text-muted">
                {Number(h.balance).toLocaleString(undefined, { maximumFractionDigits: 8 })} · $
                {Number(h.valueInUsdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DepositModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [address, setAddress] = useState<{ address: string; network: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ address: string; network: string }>(`/crypto/deposit-address/${code}`)
      .then(setAddress)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load deposit address.'));
  }, [code]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">Deposit {code}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        {error && (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        )}
        {address && (
          <div className="mt-4">
            <p className="text-xs text-muted">Network: {address.network}</p>
            <p className="mt-2 break-all rounded-xl border border-border bg-surface-2 p-3 font-mono text-xs text-ink">
              {address.address}
            </p>
            <p className="mt-3 text-xs text-danger">
              Demo address for this build — do not send real funds to it.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

function PricesPanel({ onDeposit }: { onDeposit: (code: string) => void }) {
  const { data: prices, isLoading } = useCryptoPrices();
  const { data: watchlist } = useWatchlist();
  const { add, remove } = useToggleWatchlist();
  const watchedCodes = new Set(watchlist?.map((w) => w.currencyCode));

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold text-ink">Prices (USDT)</h2>
      <div className="mt-4 flex flex-col divide-y divide-border">
        {isLoading && <p className="py-3 text-sm text-muted">Loading prices…</p>}
        {prices?.map((p) => {
          const isWatched = watchedCodes.has(p.code);
          return (
            <div key={p.code} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => (isWatched ? remove.mutate(p.code) : add.mutate(p.code))}
                  className={cn('text-muted hover:text-gold', isWatched && 'text-gold')}
                  aria-label="Toggle watchlist"
                >
                  <Star className="h-4 w-4" fill={isWatched ? 'currentColor' : 'none'} />
                </button>
                <div>
                  <p className="text-sm font-medium text-ink">{p.code}</p>
                  <p className="text-xs text-muted">{p.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm tabular-nums text-ink">${formatPrice(p.price)}</span>
                <button onClick={() => onDeposit(p.code)} className="text-muted hover:text-teal" aria-label="Deposit">
                  <Wallet className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TradePanel() {
  const { data: prices } = useCryptoPrices();
  const placeOrder = usePlaceOrder();

  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [type, setType] = useState<'MARKET' | 'LIMIT' | 'STOP'>('MARKET');
  const [baseCurrencyCode, setBaseCurrencyCode] = useState('BTC');
  const [quoteCurrencyCode, setQuoteCurrencyCode] = useState('USDT');
  const [quantity, setQuantity] = useState('');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentPrice = prices?.find((p) => p.code === baseCurrencyCode)?.price;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const result = await placeOrder.mutateAsync({
        side,
        type,
        baseCurrencyCode,
        quoteCurrencyCode,
        quantity,
        triggerPrice: type === 'MARKET' ? undefined : triggerPrice,
        pin,
      });
      setSuccess(
        result.status === 'FILLED'
          ? `Filled at ${result.filledPrice} ${quoteCurrencyCode}. Reference ${result.reference}.`
          : `Order placed. Reference ${result.reference}.`,
      );
      setQuantity('');
      setTriggerPrice('');
      setPin('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Order failed. Please try again.');
    }
  };

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold text-ink">Trade</h2>

      <div className="mt-4 flex gap-2">
        {(['BUY', 'SELL'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={cn(
              'flex-1 rounded-xl border px-4 py-2 text-sm font-medium',
              side === s
                ? s === 'BUY'
                  ? 'border-teal bg-teal/10 text-teal'
                  : 'border-danger bg-danger/10 text-danger'
                : 'border-border text-muted',
            )}
          >
            {s === 'BUY' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Asset"
            value={baseCurrencyCode}
            onChange={(e) => setBaseCurrencyCode(e.target.value.toUpperCase())}
            required
          />
          <Input
            label="Priced in"
            value={quoteCurrencyCode}
            onChange={(e) => setQuoteCurrencyCode(e.target.value.toUpperCase())}
            required
          />
        </div>

        {currentPrice && (
          <p className="text-xs text-muted">
            Current price: <span className="font-mono text-ink">${formatPrice(currentPrice)}</span>
          </p>
        )}

        <div>
          <label className="text-sm font-medium text-muted">Order type</label>
          <select
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink focus:border-teal/60 focus:outline-none"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="MARKET">Market — fills instantly</option>
            <option value="LIMIT">Limit — fills at your price or better</option>
            <option value="STOP">Stop — triggers once your price is reached</option>
          </select>
        </div>

        <Input
          label={`Quantity (${baseCurrencyCode})`}
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />

        {type !== 'MARKET' && (
          <Input
            label={`Trigger price (${quoteCurrencyCode})`}
            inputMode="decimal"
            value={triggerPrice}
            onChange={(e) => setTriggerPrice(e.target.value)}
            required
          />
        )}

        <PinField value={pin} onChange={setPin} />

        <Button type="submit" isLoading={placeOrder.isPending} className="w-full">
          {type === 'MARKET' ? `${side === 'BUY' ? 'Buy' : 'Sell'} now` : 'Place order'}
        </Button>
      </form>
    </Card>
  );
}

function OrdersPanel() {
  const { data: orders, isLoading } = useOrders();
  const cancelOrder = useCancelOrder();

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold text-ink">Orders</h2>
      <div className="mt-4 flex flex-col divide-y divide-border">
        {isLoading && <p className="py-3 text-sm text-muted">Loading…</p>}
        {orders?.length === 0 && <p className="py-3 text-sm text-muted">No orders yet.</p>}
        {orders?.map((o) => (
          <div key={o.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-ink">
                {o.side === 'BUY' ? 'Buy' : 'Sell'} {Number(o.quantity)} {o.baseCurrencyCode}
                <span className="text-muted"> · {o.type.toLowerCase()}</span>
              </p>
              <p className="text-xs text-muted">
                {new Date(o.createdAt).toLocaleString()}
                {o.filledPrice ? ` · filled at ${formatPrice(o.filledPrice)}` : ''}
                {o.triggerPrice && !o.filledPrice ? ` · trigger ${formatPrice(o.triggerPrice)}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={o.status} />
              {o.status === 'OPEN' && (
                <button onClick={() => cancelOrder.mutate(o.id)} className="text-muted hover:text-danger">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AlertsPanel() {
  const { data: alerts } = useAlerts();
  const createAlert = useCreateAlert();
  const deleteAlert = useDeleteAlert();

  const [currencyCode, setCurrencyCode] = useState('BTC');
  const [direction, setDirection] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [targetPrice, setTargetPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await createAlert.mutateAsync({ currencyCode, direction, targetPrice });
      setTargetPrice('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create alert.');
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-gold" />
        <h2 className="font-display text-lg font-semibold text-ink">Price alerts</h2>
      </div>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input label="Asset" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} />
        <div>
          <label className="text-sm font-medium text-muted">Direction</label>
          <select
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink focus:border-teal/60 focus:outline-none"
            value={direction}
            onChange={(e) => setDirection(e.target.value as typeof direction)}
          >
            <option value="ABOVE">Rises above</option>
            <option value="BELOW">Falls below</option>
          </select>
        </div>
        <Input
          label="Target price (USDT)"
          inputMode="decimal"
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
          required
        />
        <Button type="submit" isLoading={createAlert.isPending}>
          Add alert
        </Button>
      </form>

      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-4 flex flex-col divide-y divide-border">
        {alerts?.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-3 text-sm">
            <span className="text-ink">
              {a.currencyCode} {a.direction === 'ABOVE' ? '≥' : '≤'} {formatPrice(a.targetPrice)} {a.quoteCurrencyCode}
            </span>
            <div className="flex items-center gap-3">
              {a.isTriggered && <StatusBadge status="COMPLETED" />}
              <button onClick={() => deleteAlert.mutate(a.id)} className="text-muted hover:text-danger">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function CryptoPage() {
  const [depositCode, setDepositCode] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Crypto</h1>
        <p className="mt-1 text-sm text-muted">Buy, sell, and track digital assets.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <PortfolioSummary />
          <PricesPanel onDeposit={setDepositCode} />
        </div>
        <TradePanel />
      </div>

      <OrdersPanel />
      <AlertsPanel />

      {depositCode && <DepositModal code={depositCode} onClose={() => setDepositCode(null)} />}
    </div>
  );
}
