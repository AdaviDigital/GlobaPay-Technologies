'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { PinField } from '@/components/dashboard/pin-field';
import { useAuth } from '@/lib/auth-context';
import { useWallets } from '@/hooks/use-wallets';
import { api, ApiError } from '@/lib/api';

interface CheckoutTarget {
  kind: 'link' | 'invoice';
  title: string;
  amount: string;
  currencyCode: string;
  businessName: string;
}

export default function CheckoutPage() {
  const params = useParams<{ reference: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const { data: wallets } = useWallets();

  const [target, setTarget] = useState<CheckoutTarget | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionReference, setSessionReference] = useState<string | null>(null);
  const [walletId, setWalletId] = useState('');
  const [pin, setPin] = useState('');
  const [payError, setPayError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const link = await api.get<{ title: string; amount: string; currencyCode: string; merchant: { businessName: string } }>(
          `/checkout/pay/${params.reference}`,
        );
        setTarget({ kind: 'link', title: link.title, amount: link.amount, currencyCode: link.currencyCode, businessName: link.merchant.businessName });
        return;
      } catch {
        // fall through to invoice lookup
      }

      try {
        const invoice = await api.get<{ reference: string; amount: string; currencyCode: string; merchant: { businessName: string } }>(
          `/checkout/invoice/${params.reference}`,
        );
        setTarget({
          kind: 'invoice',
          title: `Invoice ${invoice.reference}`,
          amount: invoice.amount,
          currencyCode: invoice.currencyCode,
          businessName: invoice.merchant.businessName,
        });
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : 'This checkout link is not available.');
      }
    }
    load();
  }, [params.reference]);

  const startSession = async () => {
    if (!target) return;
    setPayError(null);
    try {
      const path = target.kind === 'link' ? `/checkout/pay/${params.reference}/session` : `/checkout/invoice/${params.reference}/session`;
      const session = await api.post<{ reference: string }>(path);
      setSessionReference(session.reference);
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : 'Could not start checkout.');
    }
  };

  const pay = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sessionReference) return;
    setPayError(null);
    setIsPaying(true);
    try {
      await api.post(`/checkout/sessions/${sessionReference}/pay`, { payerWalletId: walletId, pin });
      setPaid(true);
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : 'Payment failed.');
    } finally {
      setIsPaying(false);
    }
  };

  const matchingWallets = wallets?.filter((w) => w.currency.code === target?.currencyCode) ?? [];

  return (
    <main className="flex min-h-screen items-center justify-center bg-base px-6">
      <Card className="w-full max-w-sm">
        <span className="font-display text-lg font-semibold tracking-tight">
          Globa<span className="text-gold">Pay</span>
        </span>

        {loadError && (
          <div className="mt-6">
            <Alert>{loadError}</Alert>
          </div>
        )}

        {target && !paid && (
          <>
            <p className="mt-6 text-sm text-muted">Pay {target.businessName}</p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink">{target.title}</p>
            <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-ink">
              {target.amount} {target.currencyCode}
            </p>

            {authLoading ? null : !user ? (
              <Link href={`/login?redirect=/checkout/${params.reference}`} className="mt-6 block">
                <Button className="w-full">Sign in to pay</Button>
              </Link>
            ) : !sessionReference ? (
              <Button className="mt-6 w-full" onClick={startSession}>
                Continue to payment
              </Button>
            ) : (
              <form onSubmit={pay} className="mt-6 flex flex-col gap-4">
                {payError && <Alert>{payError}</Alert>}
                {matchingWallets.length === 0 ? (
                  <Alert>{`You don't have a ${target.currencyCode} wallet to pay from.`}</Alert>
                ) : (
                  <div>
                    <label className="text-sm font-medium text-muted">Pay from</label>
                    <select
                      className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink focus:border-teal/60 focus:outline-none"
                      value={walletId}
                      onChange={(e) => setWalletId(e.target.value)}
                      required
                    >
                      <option value="">Select a wallet</option>
                      {matchingWallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.currency.code} — {Number(w.balance).toLocaleString()} available
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <PinField value={pin} onChange={setPin} />
                <Button type="submit" isLoading={isPaying} disabled={matchingWallets.length === 0} className="w-full">
                  Pay {target.amount} {target.currencyCode}
                </Button>
              </form>
            )}
          </>
        )}

        {paid && (
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-teal" />
            <p className="font-display text-lg font-semibold text-ink">Payment complete</p>
            <p className="text-sm text-muted">Thanks — {target?.businessName} has been paid.</p>
          </div>
        )}
      </Card>
    </main>
  );
}
