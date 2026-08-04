'use client';

import { useState } from 'react';
import { Trash2, User, Building2, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useBeneficiaries, useCreateBeneficiary, useDeleteBeneficiary } from '@/hooks/use-beneficiaries';
import { ApiError } from '@/lib/api';

function AddGlobaPayUserForm({ onDone }: { onDone: () => void }) {
  const [label, setLabel] = useState('');
  const [tag, setTag] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createBeneficiary = useCreateBeneficiary();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await createBeneficiary.mutateAsync({ type: 'GLOBAPAY_USER', label, beneficiaryTag: tag });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add beneficiary.');
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {error && <Alert>{error}</Alert>}
      <Input label="Nickname" value={label} onChange={(e) => setLabel(e.target.value)} required />
      <Input
        label="Their email or phone number"
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        required
      />
      <Button type="submit" isLoading={createBeneficiary.isPending} className="w-fit">
        Save GlobaPay contact
      </Button>
    </form>
  );
}

function AddBankAccountForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    label: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    bankCountry: '',
    currencyCode: 'USD',
    swiftBic: '',
    routingNumber: '',
    iban: '',
    sortCode: '',
  });
  const [error, setError] = useState<string | null>(null);
  const createBeneficiary = useCreateBeneficiary();

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await createBeneficiary.mutateAsync({ type: 'BANK_ACCOUNT', ...form });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add beneficiary.');
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {error && <Alert>{error}</Alert>}
      <Input label="Nickname" value={form.label} onChange={update('label')} required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Bank name" value={form.bankName} onChange={update('bankName')} required />
        <Input label="Account name" value={form.accountName} onChange={update('accountName')} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Account number / IBAN" value={form.accountNumber} onChange={update('accountNumber')} required />
        <Input label="Currency" value={form.currencyCode} onChange={update('currencyCode')} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Bank country (2-letter code)" value={form.bankCountry} onChange={update('bankCountry')} />
        <Input label="SWIFT/BIC" value={form.swiftBic} onChange={update('swiftBic')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Routing number (ACH)" value={form.routingNumber} onChange={update('routingNumber')} />
        <Input label="Sort code (UK)" value={form.sortCode} onChange={update('sortCode')} />
      </div>
      <Input label="IBAN (SEPA)" value={form.iban} onChange={update('iban')} />
      <Button type="submit" isLoading={createBeneficiary.isPending} className="w-fit">
        Save bank account
      </Button>
    </form>
  );
}

export default function BeneficiariesPage() {
  const { data: beneficiaries, isLoading } = useBeneficiaries();
  const deleteBeneficiary = useDeleteBeneficiary();
  const [addingType, setAddingType] = useState<'GLOBAPAY_USER' | 'BANK_ACCOUNT' | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Beneficiaries</h1>
          <p className="mt-1 text-sm text-muted">Saved recipients for transfers and payments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setAddingType('GLOBAPAY_USER')}>
            <User className="h-4 w-4" /> Add GlobaPay user
          </Button>
          <Button variant="primary" onClick={() => setAddingType('BANK_ACCOUNT')}>
            <Plus className="h-4 w-4" /> Add bank account
          </Button>
        </div>
      </div>

      {addingType && (
        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">
            {addingType === 'GLOBAPAY_USER' ? 'Add a GlobaPay contact' : 'Add a bank account'}
          </h2>
          {addingType === 'GLOBAPAY_USER' ? (
            <AddGlobaPayUserForm onDone={() => setAddingType(null)} />
          ) : (
            <AddBankAccountForm onDone={() => setAddingType(null)} />
          )}
          <Button variant="ghost" className="mt-2" onClick={() => setAddingType(null)}>
            Cancel
          </Button>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {isLoading && <p className="text-sm text-muted">Loading beneficiaries…</p>}
        {beneficiaries?.map((b) => (
          <Card key={b.id} className="flex items-start justify-between">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-teal">
                {b.type === 'GLOBAPAY_USER' ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
              </span>
              <div>
                <p className="font-medium text-ink">{b.label}</p>
                <p className="text-xs text-muted">
                  {b.type === 'GLOBAPAY_USER' ? b.beneficiaryTag : `${b.bankName} · ${b.accountNumber}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => deleteBeneficiary.mutate(b.id)}
              className="text-muted hover:text-danger"
              aria-label="Remove beneficiary"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </Card>
        ))}
        {!isLoading && beneficiaries?.length === 0 && !addingType && (
          <p className="text-sm text-muted">No beneficiaries saved yet.</p>
        )}
      </div>
    </div>
  );
}
