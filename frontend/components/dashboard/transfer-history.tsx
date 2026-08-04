import { useTransfers } from '@/hooks/use-transfers';
import { StatusBadge } from './status-badge';
import { Card } from '@/components/ui/card';

const TYPE_LABEL: Record<string, string> = {
  WALLET_TO_WALLET: 'GlobaPay transfer',
  CURRENCY_CONVERSION: 'Currency conversion',
  LOCAL_BANK: 'Local bank transfer',
  INTERNATIONAL_BANK: 'International transfer',
};

export function TransferHistory() {
  const { data: transfers, isLoading } = useTransfers();

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold text-ink">Recent transfers</h2>

      {isLoading && <p className="mt-4 text-sm text-muted">Loading…</p>}

      {!isLoading && transfers?.length === 0 && (
        <p className="mt-4 text-sm text-muted">No transfers yet.</p>
      )}

      <div className="mt-4 flex flex-col divide-y divide-border">
        {transfers?.map((t) => (
          <div key={t.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-ink">
                {TYPE_LABEL[t.type] ?? t.type}
                {t.beneficiary ? ` · ${t.beneficiary.label}` : ''}
              </p>
              <p className="text-xs text-muted">
                {new Date(t.createdAt).toLocaleString()} · {t.reference}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm tabular-nums text-ink">
                -{Number(t.totalDebit).toLocaleString(undefined, { minimumFractionDigits: 2 })} {t.sourceCurrencyCode}
              </span>
              <StatusBadge status={t.status} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
