'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ForgotPasswordSchema, ForgotPasswordInput, ApiResponse } from '@ems/shared';
import { apiClient } from '../../../lib/api-client';
import Link from 'next/link';
import { AxiosError } from 'axios';

export default function ForgotPasswordPage() {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setError(null);
    setIsSubmitting(true);

    try {
      await apiClient.post('/auth/forgot-password', data);
      setSuccess(true);
    } catch (err) {
      const axiosError = err as AxiosError<ApiResponse>;
      setError(axiosError.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      {/* Background gradients */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[40%] -left-[20%] h-[80%] w-[60%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute -bottom-[40%] -right-[20%] h-[80%] w-[60%] rounded-full bg-rose-600/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-md space-y-8 bg-card/40 backdrop-blur-md border border-border/60 p-8 rounded-3xl shadow-2xl">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
            Recover Password
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We will email you a password recovery link
          </p>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl font-medium">
              If an account matches this email, a reset link has been dispatched. Please review your
              email inbox (or server logs in development).
            </div>
            <div className="pt-2">
              <Link href="/login" className="text-sm text-primary hover:underline font-medium">
                Return to Login
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl font-medium">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-muted-foreground mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                placeholder="name@university.edu"
                {...register('email')}
                className="w-full px-4 py-3 bg-secondary/35 border border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 transition"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-destructive font-medium">{errors.email.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative flex w-full justify-center px-4 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></span>
                    Sending link...
                  </span>
                ) : (
                  'Send Reset Link'
                )}
              </button>
              <Link
                href="/login"
                className="text-center text-sm text-muted-foreground hover:text-foreground hover:underline transition font-medium py-1"
              >
                Cancel
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
