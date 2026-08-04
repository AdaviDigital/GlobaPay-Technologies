'use client';

import { useState } from 'react';
import { ShoppingBag, Plus, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { PinField } from '@/components/dashboard/pin-field';
import { StatusBadge } from '@/components/dashboard/status-badge';
import {
  useOffers,
  useMyOffers,
  useCreateOffer,
  useSetOfferStatus,
  useCreateP2POrder,
  useP2POrders,
  useDeliverCode,
  useConfirmDelivery,
  useRaiseDispute,
  useGiftCardCode,
  useGiftCardValidation,
  type P2POffer,
  type P2POrder,
} from '@/hooks/use-p2p';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

const TABS = ['Browse', 'My Offers', 'My Orders'] as const;
type Tab = (typeof TABS)[number];

function BuyForm({ offer, onDone }: { offer: P2POffer; onDone: () => void }) {
  const createOrder = useCreateP2POrder();
  const [quantity, setQuantity] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createOrder.mutateAsync({ offerId: offer.id, quantity, pin });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Order failed.');
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
      {error && <Alert>{error}</Alert>}
      <Input
        label={`Quantity (${offer.minOrderQuantity}–${offer.maxOrderQuantity} ${offer.assetCode})`}
        inputMode="decimal"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        required
      />
      <PinField value={pin} onChange={setPin} />
      <Button type="submit" isLoading={createOrder.isPending} className="w-fit">
        Confirm purchase
      </Button>
    </form>
  );
}

function OfferCard({ offer }: { offer: P2POffer }) {
  const [buying, setBuying] = useState(false);
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-ink">
            {offer.assetCode} <span className="text-muted">· {offer.assetType === 'CRYPTO' ? 'Crypto' : 'Gift card'}</span>
          </p>
          <p className="text-xs text-muted">
            by {offer.seller?.firstName} {offer.seller?.lastName?.[0]}.
          </p>
        </div>
        <p className="font-mono text-lg tabular-nums text-ink">
          {offer.pricePerUnit} {offer.quoteCurrencyCode}
        </p>
      </div>
      <p className="mt-2 text-xs text-muted">
        Available: {offer.availableQuantity} · Limits: {offer.minOrderQuantity}–{offer.maxOrderQuantity}
      </p>
      {offer.terms && <p className="mt-1 text-xs text-muted">{offer.terms}</p>}
      {!buying ? (
        <Button variant="secondary" className="mt-3" onClick={() => setBuying(true)}>
          Buy
        </Button>
      ) : (
        <BuyForm offer={offer} onDone={() => setBuying(false)} />
      )}
    </Card>
  );
}

function BrowseTab() {
  const { data: offers, isLoading } = useOffers();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {isLoading && <p className="text-sm text-muted">Loading offers…</p>}
      {!isLoading && offers?.length === 0 && <p className="text-sm text-muted">No active offers right now.</p>}
      {offers?.map((offer) => (
        <OfferCard key={offer.id} offer={offer} />
      ))}
    </div>
  );
}

function CreateOfferForm({ onDone }: { onDone: () => void }) {
  const createOffer = useCreateOffer();
  const [form, setForm] = useState({
    assetType: 'CRYPTO',
    assetCode: 'BTC',
    quoteCurrencyCode: 'USDT',
    pricePerUnit: '',
    availableQuantity: '',
    minOrderQuantity: '',
    maxOrderQuantity: '',
    terms: '',
  });
  const [error, setError] = useState<string | null>(null);
  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createOffer.mutateAsync(form);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create offer.');
    }
  };

  return (
    <Card>
      <h2 className="mb-4 font-display text-lg font-semibold text-ink">List a new offer</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {error && <Alert>{error}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-muted">Asset type</label>
            <select
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink focus:border-teal/60 focus:outline-none"
              value={form.assetType}
              onChange={(e) => setForm((p) => ({ ...p, assetType: e.target.value }))}
            >
              <option value="CRYPTO">Crypto</option>
              <option value="GIFT_CARD">Gift card</option>
            </select>
          </div>
          <Input label="Asset code" value={form.assetCode} onChange={update('assetCode')} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Price per unit" inputMode="decimal" value={form.pricePerUnit} onChange={update('pricePerUnit')} required />
          <Input label="Priced in" value={form.quoteCurrencyCode} onChange={update('quoteCurrencyCode')} required />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Available qty" inputMode="decimal" value={form.availableQuantity} onChange={update('availableQuantity')} required />
          <Input label="Min order" inputMode="decimal" value={form.minOrderQuantity} onChange={update('minOrderQuantity')} required />
          <Input label="Max order" inputMode="decimal" value={form.maxOrderQuantity} onChange={update('maxOrderQuantity')} required />
        </div>
        <Input label="Terms (optional)" value={form.terms} onChange={update('terms')} />
        <Button type="submit" isLoading={createOffer.isPending} className="w-fit">
          List offer
        </Button>
      </form>
    </Card>
  );
}

function MyOffersTab() {
  const { data: offers, isLoading } = useMyOffers();
  const setStatus = useSetOfferStatus();
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {!creating ? (
        <Button variant="primary" className="w-fit" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> List a new offer
        </Button>
      ) : (
        <CreateOfferForm onDone={() => setCreating(false)} />
      )}

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {offers?.map((offer) => (
          <Card key={offer.id}>
            <div className="flex items-center justify-between">
              <p className="font-medium text-ink">
                {offer.assetCode} · {offer.pricePerUnit} {offer.quoteCurrencyCode}
              </p>
              <StatusBadge status={offer.status} />
            </div>
            <p className="mt-2 text-xs text-muted">Available: {offer.availableQuantity}</p>
            <div className="mt-3 flex gap-2">
              {offer.status === 'ACTIVE' && (
                <Button variant="secondary" onClick={() => setStatus.mutate({ id: offer.id, action: 'pause' })}>
                  Pause
                </Button>
              )}
              {offer.status === 'PAUSED' && (
                <Button variant="secondary" onClick={() => setStatus.mutate({ id: offer.id, action: 'resume' })}>
                  Resume
                </Button>
              )}
              {offer.status !== 'CLOSED' && (
                <Button variant="danger" onClick={() => setStatus.mutate({ id: offer.id, action: 'close' })}>
                  Close
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function OrderActions({ order }: { order: P2POrder }) {
  const { user } = useAuth();
  const isSeller = user?.id === order.sellerId;
  const isBuyer = user?.id === order.buyerId;

  const deliver = useDeliverCode();
  const confirm = useConfirmDelivery();
  const dispute = useRaiseDispute();
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const [showCode, setShowCode] = useState(false);
  const { data: codeData } = useGiftCardCode(showCode ? order.id : null);
  const [error, setError] = useState<string | null>(null);
  const showValidation = order.assetType === 'GIFT_CARD' && ['DELIVERED', 'DISPUTED'].includes(order.status);
  const { data: validation } = useGiftCardValidation(order.id, showValidation);

  if (order.assetType === 'CRYPTO' || order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    return null;
  }

  return (
    <>
    {validation && (
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs">
        <span className="text-muted">Code check:</span>
        <StatusBadge status={validation.status} />
        <span className="text-muted">Risk score {validation.riskScore}</span>
      </div>
    )}
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      {error && <Alert>{error}</Alert>}

      {isSeller && order.status === 'PENDING_DELIVERY' && (
        <div className="flex flex-wrap items-end gap-2">
          <Input label="Gift card code" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button
            onClick={async () => {
              setError(null);
              try {
                await deliver.mutateAsync({ orderId: order.id, code });
              } catch (err) {
                setError(err instanceof ApiError ? err.message : 'Could not deliver code.');
              }
            }}
            isLoading={deliver.isPending}
          >
            Mark delivered
          </Button>
        </div>
      )}

      {isBuyer && order.status === 'DELIVERED' && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setShowCode(true)}>
            View code
          </Button>
          {showCode && codeData && <span className="font-mono text-sm text-ink">{codeData.code}</span>}
          <Button
            onClick={async () => {
              setError(null);
              try {
                await confirm.mutateAsync(order.id);
              } catch (err) {
                setError(err instanceof ApiError ? err.message : 'Could not confirm.');
              }
            }}
            isLoading={confirm.isPending}
          >
            Confirm receipt
          </Button>
        </div>
      )}

      {isBuyer && ['PENDING_DELIVERY', 'DELIVERED'].includes(order.status) && (
        <div className="flex flex-wrap items-end gap-2">
          <Input label="Dispute reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button
            variant="danger"
            onClick={async () => {
              setError(null);
              try {
                await dispute.mutateAsync({ orderId: order.id, reason });
              } catch (err) {
                setError(err instanceof ApiError ? err.message : 'Could not raise dispute.');
              }
            }}
            isLoading={dispute.isPending}
          >
            Raise dispute
          </Button>
        </div>
      )}
    </div>
    </>
  );
}

function MyOrdersTab() {
  const { data: orders, isLoading } = useP2POrders();

  return (
    <div className="flex flex-col gap-4">
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {!isLoading && orders?.length === 0 && <p className="text-sm text-muted">No orders yet.</p>}
      {orders?.map((order) => (
        <Card key={order.id}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink">
                {order.quantity} {order.assetCode} · {order.totalAmount} {order.quoteCurrencyCode}
              </p>
              <p className="text-xs text-muted">
                {order.reference} · {new Date(order.createdAt).toLocaleString()}
              </p>
            </div>
            <StatusBadge status={order.status} />
          </div>
          {order.review && (
            <p className="mt-2 flex items-center gap-1 text-xs text-gold">
              <Star className="h-3 w-3" fill="currentColor" /> Reviewed {order.review.rating}/5
            </p>
          )}
          <OrderActions order={order} />
        </Card>
      ))}
    </div>
  );
}

export default function P2pPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Browse');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-gold">
          <ShoppingBag className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">P2P Marketplace</h1>
          <p className="mt-1 text-sm text-muted">Trade crypto and gift cards directly with other users.</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === tab ? 'border-gold text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Browse' && <BrowseTab />}
      {activeTab === 'My Offers' && <MyOffersTab />}
      {activeTab === 'My Orders' && <MyOrdersTab />}
    </div>
  );
}
