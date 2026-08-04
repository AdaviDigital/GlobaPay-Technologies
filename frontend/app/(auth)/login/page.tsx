'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { AuthShell } from '@/components/layout/auth-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

type FormValues = z.infer<typeof schema>;

interface LoginResult {
  requires2fa?: boolean;
  userId?: string;
  loginToken?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string | null;
    phone: string | null;
    firstName: string;
    lastName: string;
    roles: string[];
    kycTier: number;
    twoFactorEnabled: boolean;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const result = await api.post<LoginResult>('/auth/login', values);

      if (result.requires2fa && result.userId && result.loginToken) {
        router.push(`/setup-2fa?userId=${result.userId}&loginToken=${encodeURIComponent(result.loginToken)}`);
        return;
      }

      if (result.accessToken && result.refreshToken && result.user) {
        setSession(result.accessToken, result.refreshToken, result.user);
        router.push('/dashboard');
      }
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'Sign in failed. Please try again.');
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your wallets and transfers.">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {serverError && <Alert>{serverError}</Alert>}
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <Input label="Password" type="password" {...register('password')} error={errors.password?.message} />
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-teal hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Sign in
        </Button>
        <p className="text-center text-sm text-muted">
          New to GlobaPay?{' '}
          <Link href="/register" className="text-teal hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
