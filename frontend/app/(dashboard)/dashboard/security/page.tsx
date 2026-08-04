'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface Session {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  device: { name: string | null } | null;
}

function TwoFactorPanel() {
  const { user, refreshProfile } = useAuth();
  const [setupData, setSetupData] = useState<{ qrCodeDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const startSetup = async () => {
    setMessage(null);
    setIsBusy(true);
    try {
      const data = await api.post<{ qrCodeDataUrl: string; secret: string; otpauthUrl: string }>(
        '/auth/2fa/setup',
      );
      setSetupData(data);
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not start setup.' });
    } finally {
      setIsBusy(false);
    }
  };

  const confirmSetup = async () => {
    setMessage(null);
    setIsBusy(true);
    try {
      await api.post('/auth/2fa/verify-setup', { code });
      setMessage({ tone: 'success', text: 'Two-factor authentication is now enabled.' });
      setSetupData(null);
      setCode('');
      await refreshProfile();
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiError ? err.message : 'Incorrect code.' });
    } finally {
      setIsBusy(false);
    }
  };

  const disable = async () => {
    setMessage(null);
    setIsBusy(true);
    try {
      await api.post('/auth/2fa/disable', { code });
      setMessage({ tone: 'success', text: 'Two-factor authentication has been disabled.' });
      setCode('');
      await refreshProfile();
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiError ? err.message : 'Incorrect code.' });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold text-ink">Two-factor authentication</h2>
      <p className="mt-1 text-sm text-muted">
        {user?.twoFactorEnabled
          ? 'Enabled — an authenticator code is required at sign-in.'
          : 'Add an authenticator app for a second layer of protection at sign-in.'}
      </p>

      {message && (
        <div className="mt-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      {!user?.twoFactorEnabled && !setupData && (
        <Button className="mt-4" onClick={startSetup} isLoading={isBusy}>
          Set up two-factor authentication
        </Button>
      )}

      {setupData && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Image
              src={setupData.qrCodeDataUrl}
              alt="Two-factor setup QR code"
              width={140}
              height={140}
              className="rounded-lg border border-border"
              unoptimized
            />
            <div className="text-xs text-muted">
              <p>Scan with your authenticator app, or enter this key manually:</p>
              <p className="mt-1 font-mono text-ink">{setupData.secret}</p>
            </div>
          </div>
          <Input
            label="Enter the 6-digit code to confirm"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <Button onClick={confirmSetup} isLoading={isBusy} disabled={code.length !== 6} className="w-fit">
            Confirm and enable
          </Button>
        </div>
      )}

      {user?.twoFactorEnabled && (
        <div className="mt-4 flex flex-col gap-3">
          <Input
            label="Enter a code to disable"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <Button variant="danger" onClick={disable} isLoading={isBusy} disabled={code.length !== 6} className="w-fit">
            Disable two-factor authentication
          </Button>
        </div>
      )}
    </Card>
  );
}

function PinPanel() {
  const [pin, setPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const submit = async () => {
    setMessage(null);
    setIsBusy(true);
    try {
      if (currentPin) {
        await api.post('/auth/pin/change', { pin, currentPin });
      } else {
        await api.post('/auth/pin/set', { pin });
      }
      setMessage({ tone: 'success', text: 'Transaction PIN saved.' });
      setPin('');
      setCurrentPin('');
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not save PIN.' });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold text-ink">Transaction PIN</h2>
      <p className="mt-1 text-sm text-muted">A 4-digit PIN confirms transfers and sensitive actions.</p>

      {message && (
        <div className="mt-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Input
          label="Current PIN (leave blank if none set)"
          inputMode="numeric"
          maxLength={4}
          value={currentPin}
          onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
        />
        <Input
          label="New PIN"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      <Button className="mt-4 w-fit" onClick={submit} isLoading={isBusy} disabled={pin.length !== 4}>
        Save PIN
      </Button>
    </Card>
  );
}

function SessionsPanel() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<Session[]>('/auth/sessions'),
  });

  const signOutEverywhere = async () => {
    await api.post('/auth/logout-all');
    queryClient.invalidateQueries({ queryKey: ['sessions'] });
    await logout();
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Active sessions</h2>
          <p className="mt-1 text-sm text-muted">Devices currently signed in to your account.</p>
        </div>
        <Button variant="danger" onClick={signOutEverywhere}>
          Sign out everywhere
        </Button>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-border">
        {isLoading && <p className="py-3 text-sm text-muted">Loading sessions…</p>}
        {sessions?.map((session) => (
          <div key={session.id} className="flex items-center justify-between py-3 text-sm">
            <div>
              <p className="text-ink">{session.device?.name ?? 'Unknown device'}</p>
              <p className="text-xs text-muted">{session.ipAddress ?? 'Unknown location'}</p>
            </div>
            <span className="text-xs text-muted">{new Date(session.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function SecurityPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Security</h1>
        <p className="mt-1 text-sm text-muted">Manage how your account stays protected.</p>
      </div>
      <TwoFactorPanel />
      <PinPanel />
      <SessionsPanel />
    </div>
  );
}
