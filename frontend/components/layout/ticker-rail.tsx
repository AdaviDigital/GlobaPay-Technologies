const PAIRS: { pair: string; rate: string; direction: 'up' | 'down' }[] = [
  { pair: 'USD → NGN', rate: '1,612.40', direction: 'up' },
  { pair: 'GBP → NGN', rate: '2,048.75', direction: 'up' },
  { pair: 'EUR → NGN', rate: '1,748.20', direction: 'down' },
  { pair: 'BTC / USDT', rate: '67,214.10', direction: 'up' },
  { pair: 'ETH / USDT', rate: '3,381.55', direction: 'down' },
  { pair: 'USD → GHS', rate: '15.42', direction: 'up' },
  { pair: 'SOL / USDT', rate: '148.92', direction: 'up' },
  { pair: 'CAD → NGN', rate: '1,182.05', direction: 'down' },
];

function TickerItem({ pair, rate, direction }: (typeof PAIRS)[number]) {
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="font-mono text-muted">{pair}</span>
      <span
        className={`font-mono tabular-nums ${direction === 'up' ? 'text-teal' : 'text-danger'}`}
      >
        {direction === 'up' ? '▲' : '▼'} {rate}
      </span>
    </span>
  );
}

export function TickerRail() {
  const items = [...PAIRS, ...PAIRS];
  return (
    <div className="overflow-hidden border-y border-border/60 py-3">
      <div className="ticker-track">
        {items.map((item, index) => (
          <TickerItem key={`${item.pair}-${index}`} {...item} />
        ))}
      </div>
    </div>
  );
}
