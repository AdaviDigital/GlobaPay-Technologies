'use client';

import { useState } from 'react';
import { Store, Copy, Plus, Ban } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useWallets } from '@/hooks/use-wallets';
import {
  useMerchantAccount,
  useCreateMerchantAccount,
  useMerchantDashboard,
  usePaymentLinks,
  useCreatePaymentLink,
  useDeactivatePaymentLink,
  useInvoices,
  useCreateInvoice,
  useVoidInvoice,
} from '@/hooks/use-merchant';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

function SetupForm() {
  const { data: wallets } = useWallets();
  const fiatWallets = wallets?.filter((w) => w.currency.type === 'FIAT') ?? [];
  const create = useCreateMerchantAccount();
  const [businessName, setBusinessName] = useState('');
  const [walletId, setWalletId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await create.mutateAsync({ businessName, walletId, webhookUrl: webhookUrl || undefined });
      setApiKey(result.apiKey ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create merchant account.');
    }
  };

  if (apiKey) {
    return (
      <Card>
        <h2 className="font-display text-lg font-semibold text-ink">Merchant account created</h2>
        <p className="mt-2 text-sm text-muted">
          Your API key is shown once — copy it now. It won&apos;t be shown again.
        </p>
        <p className="mt-3 break-all rounded-xl border border-border bg-surface-2 p-3 font-mono text-xs text-ink">{apiKey}</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-4 font-display text-lg font-semibold text-ink">Set up your merchant account</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {error && <Alert>{error}</Alert>}
        <Input label="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
        <div>
          <label className="text-sm font-medium text-muted">Settlement wallet</label>
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
        <Input label="Webhook URL (optional)" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
        <Button type="submit" isLoading={create.isPending} className="w-fit">
          Create merchant account
        </Button>
      </form>
    </Card>
  );
}

function PaymentLinksPanel() {
  const { data: links } = usePaymentLinks();
  const create = useCreatePaymentLink();
  const deactivate = useDeactivatePaymentLink();
  const [form, setForm] = useState({ title: '', amount: '', currencyCode: 'USD', description: '' });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync(form);
      setForm({ title: '', amount: '', currencyCode: 'USD', description: '' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create link.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">Create a payment link</h2>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {error && <Alert>{error}</Alert>}
          <Input label="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              required
            />
            <Input
              label="Currency"
              value={form.currencyCode}
              onChange={(e) => setForm((p) => ({ ...p, currencyCode: e.target.value.toUpperCase() }))}
              required
            />
          </div>
          <Button type="submit" isLoading={create.isPending} className="w-fit">
            <Plus className="h-4 w-4" /> Create link
          </Button>
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {links?.map((link) => {
          const url = typeof window !== 'undefined' ? `${window.location.origin}/checkout/${link.slug}` : '';
          return (
            <Card key={link.id}>
              <div className="flex items-center justify-between">
                <p className="font-medium text-ink">{link.title}</p>
                <span className={cn('rounded-full px-2 py-0.5 text-xs', link.isActive ? 'bg-teal/10 text-teal' : 'bg-surface-2 text-muted')}>
                  {link.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="mt-1 font-mono text-sm text-ink">
                {link.amount} {link.currencyCode}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(url)}
                  className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted hover:text-ink"
                >
                  <Copy className="h-3 w-3" /> Copy link
                </button>
                {link.isActive && (
                  <button
                    onClick={() => deactivate.mutate(link.id)}
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted hover:text-danger"
                  >
                    <Ban className="h-3 w-3" /> Deactivate
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function InvoicesPanel() {
  const { data: invoices } = useInvoices();
  const create = useCreateInvoice();
  const voidInvoice = useVoidInvoice();
  const [form, setForm] = useState({ customerName: '', customerEmail: '', amount: '', currencyCode: 'USD' });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync(form);
      setForm({ customerName: '', customerEmail: '', amount: '', currencyCode: 'USD' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create invoice.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">Create an invoice</h2>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {error && <Alert>{error}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Customer name (optional)"
              value={form.customerName}
              onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
            />
            <Input
              label="Customer email (optional)"
              value={form.customerEmail}
              onChange={(e) => setForm((p) => ({ ...p, customerEmail: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              required
            />
            <Input
              label="Currency"
              value={form.currencyCode}
              onChange={(e) => setForm((p) => ({ ...p, currencyCode: e.target.value.toUpperCase() }))}
              required
            />
          </div>
          <Button type="submit" isLoading={create.isPending} className="w-fit">
            <Plus className="h-4 w-4" /> Create invoice
          </Button>
        </form>
      </Card>

      <div className="flex flex-col gap-3">
        {invoices?.map((inv) => {
          const url = typeof window !== 'undefined' ? `${window.location.origin}/checkout/${inv.reference}` : '';
          return (
            <Card key={inv.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink">
                  {inv.customerName ?? inv.customerEmail ?? 'Invoice'} · {inv.amount} {inv.currencyCode}
                </p>
                <p className="text-xs text-muted">{inv.reference}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn('rounded-full px-2 py-0.5 text-xs', inv.status === 'PAID' ? 'bg-teal/10 text-teal' : 'bg-surface-2 text-muted')}>
                  {inv.status}
                </span>
                {inv.status === 'SENT' && (
                  <>
                    <button onClick={() => navigator.clipboard.writeText(url)} className="text-muted hover:text-ink">
                      <Copy className="h-4 w-4" />
                    </button>
                    <button onClick={() => voidInvoice.mutate(inv.id)} className="text-muted hover:text-danger">
                      <Ban className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

const TABS = ['Dashboard', 'Payment Links', 'Invoices'] as const;

export default function MerchantPage() {
  const { data: account, isLoading, isError } = useMerchantAccount();
  const { data: summary } = useMerchantDashboard();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Dashboard');

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;

  if (isError || !account) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-gold">
            <Store className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Merchant tools</h1>
            <p className="mt-1 text-sm text-muted">Accept payments with links, invoices, and checkout.</p>
          </div>
        </div>
        <SetupForm />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-gold">
          <Store className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{account.businessName}</h1>
          <p className="mt-1 text-sm text-muted">Merchant dashboard</p>
        </div>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-sm text-muted">Settlement balance</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">
              {summary.settlementBalance} {summary.settlementCurrency}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-muted">Total revenue</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{summary.totalRevenue}</p>
          </Card>
          <Card>
            <p className="text-sm text-muted">Completed transactions</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{summary.completedTransactions}</p>
          </Card>
        </div>
      )}

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

      {activeTab === 'Payment Links' && <PaymentLinksPanel />}
      {activeTab === 'Invoices' && <InvoicesPanel />}
      {activeTab === 'Dashboard' && (
        <p className="text-sm text-muted">Switch to Payment Links or Invoices to manage checkout options.</p>
      )}
    </div>
  );
}
