'use client';

import { Loader2 } from 'lucide-react';
import { useWallets } from '@/hooks/use-wallets';
import { WalletCard } from '@/components/dashboard/wallet-card';

export default function WalletsPage() {
  const { data: wallets, isLoading } = useWallets();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Wallets</h1>
        <p className="mt-1 text-sm text-muted">Every currency you hold, in one place.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading wallets…
        </div>
      ) : wallets && wallets.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wallets.map((wallet) => (
            <WalletCard key={wallet.id} wallet={wallet} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">No wallets yet. They&apos;re created automatically when you sign up.</p>
      )}
    </div>
  );
}
