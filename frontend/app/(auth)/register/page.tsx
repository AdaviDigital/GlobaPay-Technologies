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

const schema = z
  .object({
    firstName: z.string().min(2, 'Enter your first name'),
    lastName: z.string().min(2, 'Enter your last name'),
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(10, 'At least 10 characters')
      .regex(
        /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/,
        'Include upper and lower case, a number, and a symbol',
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const result = await api.post<{ userId: string; destination: string }>('/auth/register', {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
      });
      router.push(
        `/verify-otp?userId=${result.userId}&purpose=EMAIL_VERIFICATION&destination=${encodeURIComponent(
          result.destination,
        )}`,
      );
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'Registration failed. Please try again.');
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Set up your GlobaPay wallet in a couple of minutes.">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {serverError && <Alert>{serverError}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" {...register('firstName')} error={errors.firstName?.message} />
          <Input label="Last name" {...register('lastName')} error={errors.lastName?.message} />
        </div>
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <Input
          label="Password"
          type="password"
          {...register('password')}
          error={errors.password?.message}
          hint="10+ characters, mixing case, a number, and a symbol"
        />
        <Input
          label="Confirm password"
          type="password"
          {...register('confirmPassword')}
          error={errors.confirmPassword?.message}
        />
        <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
          Create account
        </Button>
        <p className="text-center text-sm text-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-teal hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
