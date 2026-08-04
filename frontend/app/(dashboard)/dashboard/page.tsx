'use client';

import Link from 'next/link';
import { Loader2, ArrowRight } from 'lucide-react';
import { useWallets } from '@/hooks/use-wallets';
import { WalletCard } from '@/components/dashboard/wallet-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DashboardOverviewPage() {
  const { data: wallets, isLoading } = useWallets();

  const totalUsdEquivalent = wallets?.find((w) => w.currency.code === 'USD')?.balance ?? '0.00';

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Overview</h1>
          <p className="mt-1 text-sm text-muted">A snapshot of everything across your wallets.</p>
        </div>
        <Link href="/dashboard/transfer">
          <Button variant="primary">
            Send money <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <Card className="bg-gradient-to-br from-surface to-surface-2">
        <p className="text-sm text-muted">Primary balance (USD)</p>
        <p className="mt-2 font-mono text-4xl font-semibold tabular-nums text-ink">
          ${Number(totalUsdEquivalent).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </Card>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Your wallets</h2>
          <Link href="/dashboard/wallets" className="text-sm text-teal hover:underline">
            View all
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading wallets…
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {wallets?.slice(0, 6).map((wallet) => (
              <WalletCard key={wallet.id} wallet={wallet} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
