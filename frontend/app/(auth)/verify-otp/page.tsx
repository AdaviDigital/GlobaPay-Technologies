'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/layout/auth-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { api, ApiError } from '@/lib/api';

function OtpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const userId = params.get('userId') ?? '';
  const purpose = params.get('purpose') ?? 'EMAIL_VERIFICATION';
  const destination = params.get('destination') ?? 'your account';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/auth/verify-otp', { userId, purpose, code });
      router.push('/login?verified=1');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResend = async () => {
    setError(null);
    setNotice(null);
    setIsResending(true);
    try {
      await api.post('/auth/resend-otp', { userId, purpose });
      setNotice('A new code is on its way.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend the code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthShell title="Verify your account" subtitle={`Enter the 6-digit code we sent to ${destination}.`}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
        <Input
          label="Verification code"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
        />
        <Button type="submit" isLoading={isSubmitting} disabled={code.length !== 6} className="w-full">
          Verify account
        </Button>
        <Button type="button" variant="ghost" isLoading={isResending} onClick={onResend} className="w-full">
          Resend code
        </Button>
      </form>
    </AuthShell>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={null}>
      <OtpForm />
    </Suspense>
  );
}
