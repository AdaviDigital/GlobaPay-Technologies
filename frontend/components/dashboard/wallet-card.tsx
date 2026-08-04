import { cn } from '@/lib/utils';

export interface WalletSummary {
  id: string;
  balance: string;
  frozenBalance: string;
  isPrimary: boolean;
  currency: { code: string; symbol: string; name: string; type: 'FIAT' | 'CRYPTO' };
}

export function WalletCard({ wallet }: { wallet: WalletSummary }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium',
            wallet.currency.type === 'CRYPTO' ? 'bg-teal/10 text-teal' : 'bg-gold/10 text-gold',
          )}
        >
          {wallet.currency.code}
        </span>
        {wallet.isPrimary && (
          <span className="text-xs text-muted">Primary</span>
        )}
      </div>
      <p className="mt-4 font-mono text-2xl font-semibold tabular-nums text-ink">
        {wallet.currency.symbol}
        {Number(wallet.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className="mt-1 text-xs text-muted">{wallet.currency.name}</p>
      {Number(wallet.frozenBalance) > 0 && (
        <p className="mt-2 text-xs text-danger">
          {wallet.currency.symbol}
          {Number(wallet.frozenBalance).toLocaleString()} frozen
        </p>
      )}
    </div>
  );
}
