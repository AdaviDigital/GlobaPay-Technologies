'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/layout/auth-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function TwoFactorChallenge() {
  const router = useRouter();
  const params = useSearchParams();
  const { setSession } = useAuth();
  const userId = params.get('userId') ?? '';
  const loginToken = params.get('loginToken') ?? '';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: {
          id: string;
          email: string | null;
          phone: string | null;
          firstName: string;
          lastName: string;
          roles: string[];
          kycTier: number;
          twoFactorEnabled: boolean;
        };
      }>('/auth/login/2fa', { userId, loginToken, code });
      setSession(result.accessToken, result.refreshToken, result.user);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Two-factor verification"
      subtitle="Enter the 6-digit code from your authenticator app."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Input
          label="Authentication code"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
        />
        <Button type="submit" isLoading={isSubmitting} disabled={code.length !== 6} className="w-full">
          Verify and sign in
        </Button>
      </form>
    </AuthShell>
  );
}

export default function LoginTwoFactorPage() {
  return (
    <Suspense fallback={null}>
      <TwoFactorChallenge />
    </Suspense>
  );
}
