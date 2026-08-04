'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, Repeat, Landmark } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { PinField } from '@/components/dashboard/pin-field';
import { TransferHistory } from '@/components/dashboard/transfer-history';
import { useWallets } from '@/hooks/use-wallets';
import { useBeneficiaries } from '@/hooks/use-beneficiaries';
import { useWalletToWalletTransfer, useCurrencyConversion, useBankTransfer } from '@/hooks/use-transfers';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'wallet', label: 'Send to GlobaPay user', icon: ArrowRightLeft },
  { id: 'convert', label: 'Convert currency', icon: Repeat },
  { id: 'bank', label: 'Bank transfer', icon: Landmark },
] as const;

type TabId = (typeof TABS)[number]['id'];

const RAILS = [
  { value: 'LOCAL_INSTANT', label: 'Local instant' },
  { value: 'SWIFT', label: 'SWIFT' },
  { value: 'ACH', label: 'ACH (US)' },
  { value: 'SEPA', label: 'SEPA (EU)' },
  { value: 'FASTER_PAYMENTS', label: 'Faster Payments (UK)' },
];

function WalletToWalletForm() {
  const { data: wallets } = useWallets();
  const { data: beneficiaries } = useBeneficiaries();
  const globaPayContacts = beneficiaries?.filter((b) => b.type === 'GLOBAPAY_USER') ?? [];
  const mutation = useWalletToWalletTransfer();

  const [sourceWalletId, setSourceWalletId] = useState('');
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [recipientTag, setRecipientTag] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const result = await mutation.mutateAsync({
        sourceWalletId,
        beneficiaryId: beneficiaryId || undefined,
        recipientTag: beneficiaryId ? undefined : recipientTag,
        amount,
        narration: narration || undefined,
        pin,
      });
      setSuccess(`Sent. Reference ${result.reference}.`);
      setAmount('');
      setNarration('');
      setPin('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Transfer failed. Please try again.');
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <div>
        <label className="text-sm font-medium text-muted">From wallet</label>
        <select
          className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink focus:border-teal/60 focus:outline-none"
          value={sourceWalletId}
          onChange={(e) => setSourceWalletId(e.target.value)}
          required
        >
          <option value="">Select a wallet</option>
          {wallets?.map((w) => (
            <option key={w.id} value={w.id}>
              {w.currency.code} — {Number(w.balance).toLocaleString()} available
            </option>
          ))}
        </select>
      </div>

      {globaPayContacts.length > 0 && (
        <div>
          <label className="text-sm font-medium text-muted">Recipient</label>
          <select
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink focus:border-teal/60 focus:outline-none"
            value={beneficiaryId}
            onChange={(e) => setBeneficiaryId(e.target.value)}
          >
            <option value="">Enter email/phone instead</option>
            {globaPayContacts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label} ({b.beneficiaryTag})
              </option>
            ))}
          </select>
        </div>
      )}

      {!beneficiaryId && (
        <Input
          label="Recipient email or phone"
          value={recipientTag}
          onChange={(e) => setRecipientTag(e.target.value)}
          required
        />
      )}

      <Input label="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      <Input label="Note (optional)" value={narration} onChange={(e) => setNarration(e.target.value)} />
      <PinField value={pin} onChange={setPin} />

      <Button type="submit" isLoading={mutation.isPending} className="w-full">
        Send money
      </Button>
    </form>
  );
}

function ConvertCurrencyForm() {
  const { data: wallets } = useWallets();
  const mutation = useCurrencyConversion();

  const [sourceWalletId, setSourceWalletId] = useState('');
  const [destinationCurrencyCode, setDestinationCurrencyCode] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const result = await mutation.mutateAsync({ sourceWalletId, destinationCurrencyCode, amount, pin });
      setSuccess(`Converted. Reference ${result.reference}.`);
      setAmount('');
      setPin('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Conversion failed. Please try again.');
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <div>
        <label className="text-sm font-medium text-muted">From wallet</label>
        <select
          className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink focus:border-teal/60 focus:outline-none"
          value={sourceWalletId}
          onChange={(e) => setSourceWalletId(e.target.value)}
          required
        >
          <option value="">Select a wallet</option>
          {wallets?.map((w) => (
            <option key={w.id} value={w.id}>
              {w.currency.code} — {Number(w.balance).toLocaleString()} available
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Convert to (currency code)"
        placeholder="e.g. NGN, BTC, USDT"
        value={destinationCurrencyCode}
        onChange={(e) => setDestinationCurrencyCode(e.target.value.toUpperCase())}
        required
      />
      <Input label="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      <PinField value={pin} onChange={setPin} />

      <Button type="submit" isLoading={mutation.isPending} className="w-full">
        Convert
      </Button>
    </form>
  );
}

function BankTransferForm() {
  const { data: wallets } = useWallets();
  const { data: beneficiaries } = useBeneficiaries();
  const bankBeneficiaries = beneficiaries?.filter((b) => b.type === 'BANK_ACCOUNT') ?? [];
  const mutation = useBankTransfer();

  const [sourceWalletId, setSourceWalletId] = useState('');
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [rail, setRail] = useState('LOCAL_INSTANT');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const result = await mutation.mutateAsync({
        sourceWalletId,
        beneficiaryId,
        rail,
        amount,
        narration: narration || undefined,
        scheduledFor: scheduledFor || undefined,
        pin,
      });
      setSuccess(
        scheduledFor ? `Scheduled. Reference ${result.reference}.` : `Transfer initiated. Reference ${result.reference}.`,
      );
      setAmount('');
      setNarration('');
      setPin('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Transfer failed. Please try again.');
    }
  };

  if (bankBeneficiaries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-muted">Add a bank account beneficiary before sending a bank transfer.</p>
        <Link href="/dashboard/beneficiaries">
          <Button variant="secondary">Add a beneficiary</Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <div>
        <label className="text-sm font-medium text-muted">From wallet</label>
        <select
          className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink focus:border-teal/60 focus:outline-none"
          value={sourceWalletId}
          onChange={(e) => setSourceWalletId(e.target.value)}
          required
        >
          <option value="">Select a wallet</option>
          {wallets?.map((w) => (
            <option key={w.id} value={w.id}>
              {w.currency.code} — {Number(w.balance).toLocaleString()} available
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-muted">Beneficiary</label>
        <select
          className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink focus:border-teal/60 focus:outline-none"
          value={beneficiaryId}
          onChange={(e) => setBeneficiaryId(e.target.value)}
          required
        >
          <option value="">Select a beneficiary</option>
          {bankBeneficiaries.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label} — {b.bankName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-muted">Rail</label>
        <select
          className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink focus:border-teal/60 focus:outline-none"
          value={rail}
          onChange={(e) => setRail(e.target.value)}
        >
          {RAILS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <Input label="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      <Input label="Note (optional)" value={narration} onChange={(e) => setNarration(e.target.value)} />
      <Input
        label="Schedule for later (optional)"
        type="datetime-local"
        value={scheduledFor}
        onChange={(e) => setScheduledFor(e.target.value)}
      />
      <PinField value={pin} onChange={setPin} />

      <Button type="submit" isLoading={mutation.isPending} className="w-full">
        {scheduledFor ? 'Schedule transfer' : 'Send transfer'}
      </Button>
    </form>
  );
}

export default function TransferPage() {
  const [activeTab, setActiveTab] = useState<TabId>('wallet');

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Transfer</h1>
        <p className="mt-1 text-sm text-muted">Move money between wallets and to other accounts.</p>
      </div>

      <div className="flex gap-2 border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === id ? 'border-gold text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <Card className="max-w-lg">
        {activeTab === 'wallet' && <WalletToWalletForm />}
        {activeTab === 'convert' && <ConvertCurrencyForm />}
        {activeTab === 'bank' && <BankTransferForm />}
      </Card>

      <TransferHistory />
    </div>
  );
}
