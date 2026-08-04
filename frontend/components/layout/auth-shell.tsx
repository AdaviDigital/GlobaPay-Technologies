import Link from 'next/link';
import { Globe2, ShieldCheck, Zap } from 'lucide-react';
import { TickerRail } from './ticker-rail';

const TRUST_POINTS = [
  { icon: ShieldCheck, label: 'Bank-grade encryption on every transfer' },
  { icon: Zap, label: 'Send and settle across 6 fiat currencies' },
  { icon: Globe2, label: 'Trade 9 major cryptocurrencies, 24/7' },
];

export function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-surface p-10 lg:flex">
        <div>
          <Link href="/" className="font-display text-xl font-semibold tracking-tight">
            Globa<span className="text-gold">Pay</span>
          </Link>

          <div className="mt-24 max-w-md">
            <h1 className="font-display text-4xl font-semibold leading-tight text-ink">
              One account. Every currency you move in.
            </h1>
            <p className="mt-4 text-muted">
              Wallets, transfers, and crypto trading for people and businesses moving value
              between Nigeria and the world.
            </p>
          </div>

          <ul className="mt-12 flex flex-col gap-4">
            {TRUST_POINTS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-muted">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-teal">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="-mx-10">
          <TickerRail />
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="font-display text-xl font-semibold tracking-tight">
              Globa<span className="text-gold">Pay</span>
            </Link>
          </div>
          <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
