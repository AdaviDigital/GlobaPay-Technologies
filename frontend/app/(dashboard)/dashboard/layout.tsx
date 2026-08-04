'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  Repeat,
  Users,
  Bitcoin,
  ShoppingBag,
  CreditCard,
  Store,
  BadgeCheck,
  ClipboardCheck,
  ShieldCheck,
  Sparkles,
  LayoutGrid,
  Settings,
  LogOut,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/wallets', label: 'Wallets', icon: Wallet },
  { href: '/dashboard/transfer', label: 'Transfer', icon: Repeat },
  { href: '/dashboard/crypto', label: 'Crypto', icon: Bitcoin },
  { href: '/dashboard/p2p', label: 'P2P', icon: ShoppingBag },
  { href: '/dashboard/cards', label: 'Cards', icon: CreditCard },
  { href: '/dashboard/merchant', label: 'Merchant', icon: Store },
  { href: '/dashboard/assistant', label: 'Assistant', icon: Sparkles },
  { href: '/dashboard/beneficiaries', label: 'Beneficiaries', icon: Users },
  { href: '/dashboard/verification', label: 'Verification', icon: BadgeCheck },
  { href: '/dashboard/security', label: 'Security', icon: ShieldCheck },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const COMPLIANCE_ROLES = ['COMPLIANCE_OFFICER', 'ADMIN', 'SUPER_ADMIN'];
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER'];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  let navItems = NAV_ITEMS;
  if (user.roles.some((r) => COMPLIANCE_ROLES.includes(r))) {
    navItems = [...navItems, { href: '/dashboard/compliance', label: 'Compliance', icon: ClipboardCheck }];
  }
  if (user.roles.some((r) => ADMIN_ROLES.includes(r))) {
    navItems = [...navItems, { href: '/dashboard/admin', label: 'Admin', icon: LayoutGrid }];
  }

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-base">
      <aside className="flex flex-col border-r border-border bg-surface px-4 py-6">
        <Link href="/" className="px-2 font-display text-lg font-semibold tracking-tight">
          Globa<span className="text-gold">Pay</span>
        </Link>

        <nav className="mt-10 flex flex-1 flex-col gap-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => logout()}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:text-danger"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </aside>

      <div className="flex flex-col">
        <header className="flex items-center justify-between border-b border-border px-8 py-4">
          <div>
            <p className="text-sm text-muted">Welcome back,</p>
            <p className="font-display text-lg font-semibold text-ink">
              {user.firstName} {user.lastName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/verification"
              className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:text-ink"
            >
              KYC Tier {user.kycTier}
            </Link>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 font-display text-sm font-semibold text-gold">
              {user.firstName[0]}
              {user.lastName[0]}
            </span>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
