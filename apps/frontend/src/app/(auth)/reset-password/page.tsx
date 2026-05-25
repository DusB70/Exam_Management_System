'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ResetPasswordSchema, ResetPasswordInput, ApiResponse } from '@ems/shared';
import { apiClient } from '../../../lib/api-client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AxiosError } from 'axios';

function ResetPasswordForm() {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
  });

  useEffect(() => {
    if (token) {
      setValue('token', token);
    } else {
      setError('Password reset token is missing from the URL link');
    }
  }, [token, setValue]);

  const onSubmit = async (data: ResetPasswordInput) => {
    if (!data.token) {
      setError('Reset token is missing');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await apiClient.post('/auth/reset-password', {
        token: data.token,
        password: data.password,
      });
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      const axiosError = err as AxiosError<ApiResponse>;
      setError(
        axiosError.response?.data?.message ||
          'Failed to reset password. The link may have expired.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 bg-card/40 backdrop-blur-md border border-border/60 p-8 rounded-3xl shadow-2xl">
      <div className="text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Reset Password</h2>
        <p className="mt-2 text-sm text-muted-foreground">Enter your new academic password below</p>
      </div>

      {success ? (
        <div className="space-y-4 text-center">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl font-medium">
            Password reset successful! Redirecting you to login...
          </div>
        </div>
      ) : (
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl font-medium">
              {error}
            </div>
          )}

          <input type="hidden" {...register('token')} />

          <div className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-muted-foreground mb-1.5"
              >
                New Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
                className="w-full px-4 py-3 bg-secondary/35 border border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 transition"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-destructive font-medium">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-muted-foreground mb-1.5"
              >
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                {...register('confirmPassword')}
                className="w-full px-4 py-3 bg-secondary/35 border border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 transition"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-destructive font-medium">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={isSubmitting || !token}
              className="group relative flex w-full justify-center px-4 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></span>
                  Resetting...
                </span>
              ) : (
                'Save Password'
              )}
            </button>
            <Link
              href="/login"
              className="text-center text-sm text-muted-foreground hover:text-foreground hover:underline transition font-medium py-1"
            >
              Back to Login
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      {/* Background gradients */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[40%] -left-[20%] h-[80%] w-[60%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute -bottom-[40%] -right-[20%] h-[80%] w-[60%] rounded-full bg-violet-600/10 blur-[120px]" />
      </div>
      <Suspense
        fallback={
          <div className="w-full max-w-md space-y-8 bg-card/40 backdrop-blur-md border border-border/60 p-8 rounded-3xl shadow-2xl flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
