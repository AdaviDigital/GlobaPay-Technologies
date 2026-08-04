import Link from 'next/link';
import { ArrowRight, Wallet, Repeat, Bitcoin, ShieldCheck } from 'lucide-react';
import { TickerRail } from '@/components/layout/ticker-rail';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const FEATURES = [
  {
    icon: Wallet,
    title: 'Multi-currency wallets',
    body: 'Hold and manage USD, GBP, EUR, CAD, NGN, and AUD in one place, each with its own balance and statement.',
  },
  {
    icon: Repeat,
    title: 'Cross-border transfers',
    body: 'Send by SWIFT, ACH, SEPA, or Faster Payments, with live rates and a fee calculator before you confirm.',
  },
  {
    icon: Bitcoin,
    title: 'Crypto trading',
    body: 'Buy, sell, and swap BTC, ETH, USDT, and more, with real-time pricing and a full trading history.',
  },
  {
    icon: ShieldCheck,
    title: 'Built on verified identity',
    body: 'Tiered KYC, device management, and two-factor authentication protect every account by default.',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-base">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-semibold tracking-tight">
          Globa<span className="text-gold">Pay</span>
        </span>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="px-4 py-2 text-sm font-medium text-muted hover:text-ink">
            Sign in
          </Link>
          <Link href="/register">
            <Button variant="primary" className="px-5 py-2.5">
              Get started
            </Button>
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="max-w-2xl">
          <span className="inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-teal">
            Nigeria ⇄ the world
          </span>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink">
            One account to move money everywhere it needs to go.
          </h1>
          <p className="mt-6 text-lg text-muted">
            GlobaPay brings fiat wallets, cross-border transfers, and crypto trading into a single
            platform, built for people and businesses who don't stop at one currency.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link href="/register">
              <Button variant="primary" className="px-6 py-3">
                Open an account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login" className="text-sm font-medium text-muted hover:text-ink">
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      <TickerRail />

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-2xl font-semibold text-ink">Everything in one wallet</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-gold">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-sm text-muted">
          <span>© {new Date().getFullYear()} GlobaPay</span>
          <span>Secured with end-to-end encryption</span>
        </div>
      </footer>
    </main>
  );
}
