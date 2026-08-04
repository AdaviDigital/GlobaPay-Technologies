'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, Users, BarChart3, Settings, ScrollText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import {
  useAdminUsers,
  useUpdateUserStatus,
  usePlatformSummary,
  useFeatureFlags,
  useUpsertFeatureFlag,
  useFeeRules,
  useSetFeeRuleActive,
  useAuditLog,
} from '@/hooks/use-admin';
import { cn } from '@/lib/utils';

const TABS = ['Analytics', 'Users', 'Settings', 'Audit Log'] as const;
type Tab = (typeof TABS)[number];

function AnalyticsTab() {
  const { data } = usePlatformSummary();
  if (!data) return <p className="text-sm text-muted">Loading…</p>;

  const stats = [
    { label: 'Total users', value: data.userCount },
    { label: 'Active users', value: data.activeUserCount },
    { label: 'Wallets', value: data.walletCount },
    { label: 'Completed transfers', value: data.completedTransferCount },
    { label: 'Open crypto orders', value: data.openCryptoOrders },
    { label: 'Pending KYC', value: data.pendingKycSubmissions },
    { label: 'Open P2P disputes', value: data.openP2pDisputes },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <p className="text-sm font-medium text-ink">Fee revenue by currency</p>
        <div className="mt-3 flex flex-col divide-y divide-border">
          {data.feeRevenueByCurrency.map((r) => (
            <div key={r.currency} className="flex items-center justify-between py-2 text-sm">
              <span className="text-ink">{r.currency}</span>
              <span className="font-mono tabular-nums text-muted">{Number(r.total).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function UsersTab() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const { data } = useAdminUsers(query, status);
  const updateStatus = useUpdateUserStatus();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Input placeholder="Search by name, email, phone" value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1" />
        <select
          className="rounded-xl border border-border bg-surface-2 px-3 py-3 text-sm text-ink focus:border-teal/60 focus:outline-none"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BLOCKED">Blocked</option>
          <option value="PENDING_VERIFICATION">Pending verification</option>
        </select>
      </div>

      <div className="flex flex-col divide-y divide-border">
        {data?.items.map((u) => (
          <div key={u.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-ink">
                {u.firstName} {u.lastName} <span className="text-muted">· {u.email ?? u.phone}</span>
              </p>
              <p className="text-xs text-muted">
                {u.roles.join(', ')} · KYC Tier {u.kycTier} · {u.status}
              </p>
            </div>
            <div className="flex gap-2">
              {u.status === 'ACTIVE' ? (
                <Button variant="danger" onClick={() => updateStatus.mutate({ id: u.id, status: 'SUSPENDED' })}>
                  Suspend
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => updateStatus.mutate({ id: u.id, status: 'ACTIVE' })}>
                  Reactivate
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab() {
  const { data: flags } = useFeatureFlags();
  const upsertFlag = useUpsertFeatureFlag();
  const { data: feeRules } = useFeeRules();
  const setFeeActive = useSetFeeRuleActive();

  const [newFlag, setNewFlag] = useState({ key: '', description: '' });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <p className="text-sm font-medium text-ink">Feature flags</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Input label="Key" value={newFlag.key} onChange={(e) => setNewFlag((p) => ({ ...p, key: e.target.value }))} />
          <Input label="Description" value={newFlag.description} onChange={(e) => setNewFlag((p) => ({ ...p, description: e.target.value }))} />
          <Button
            onClick={() => {
              upsertFlag.mutate({ key: newFlag.key, isEnabled: true, description: newFlag.description });
              setNewFlag({ key: '', description: '' });
            }}
          >
            Add (enabled)
          </Button>
        </div>
        <div className="mt-4 flex flex-col divide-y divide-border">
          {flags?.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className="text-ink">{f.key}</span>
                {f.description && <span className="ml-2 text-xs text-muted">{f.description}</span>}
              </div>
              <button
                onClick={() => upsertFlag.mutate({ key: f.key, isEnabled: !f.isEnabled })}
                className={cn('rounded-full px-3 py-1 text-xs', f.isEnabled ? 'bg-teal/10 text-teal' : 'bg-surface-2 text-muted')}
              >
                {f.isEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <p className="text-sm font-medium text-ink">Fee rules</p>
        <div className="mt-3 flex flex-col divide-y divide-border">
          {feeRules?.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-ink">
                {r.transferType} {r.rail ? `· ${r.rail}` : ''} — {(Number(r.percentageFee) * 100).toFixed(2)}% + {r.flatFee}
              </span>
              <button
                onClick={() => setFeeActive.mutate({ id: r.id, isActive: !r.isActive })}
                className={cn('rounded-full px-3 py-1 text-xs', r.isActive ? 'bg-teal/10 text-teal' : 'bg-surface-2 text-muted')}
              >
                {r.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AuditLogTab() {
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const { data } = useAuditLog(userId, action);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Input placeholder="Filter by user ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
        <Input placeholder="Filter by action (e.g. kyc.review)" value={action} onChange={(e) => setAction(e.target.value)} />
      </div>
      <div className="flex flex-col divide-y divide-border">
        {data?.items.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between py-2 text-sm">
            <span className="text-ink">{entry.action}</span>
            <span className="text-xs text-muted">{new Date(entry.createdAt).toLocaleString()}</span>
          </div>
        ))}
        {data?.items.length === 0 && <p className="py-3 text-sm text-muted">No matching entries.</p>}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('Analytics');

  const canAccess = user?.roles.some((r) => ['ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER'].includes(r));

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <ShieldAlert className="h-8 w-8 text-muted" />
        <p className="text-sm text-muted">This page is only available to platform administrators.</p>
        <Link href="/dashboard" className="text-sm text-teal hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const tabIcons = { Analytics: BarChart3, Users, Settings, 'Audit Log': ScrollText };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Admin</h1>
        <p className="mt-1 text-sm text-muted">Platform-wide management.</p>
      </div>

      <div className="flex gap-2 border-b border-border">
        {TABS.map((tab) => {
          const Icon = tabIcons[tab];
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === tab ? 'border-gold text-ink' : 'border-transparent text-muted hover:text-ink',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab}
            </button>
          );
        })}
      </div>

      {activeTab === 'Analytics' && <AnalyticsTab />}
      {activeTab === 'Users' && <UsersTab />}
      {activeTab === 'Settings' && <SettingsTab />}
      {activeTab === 'Audit Log' && <AuditLogTab />}
    </div>
  );
}
