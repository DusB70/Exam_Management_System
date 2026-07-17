'use client';

import React, { useState } from 'react';
import { UserRole } from '@ems/shared';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';
import { Shield, Users, BookOpen, GraduationCap, Loader2, ArrowRight } from 'lucide-react';

const DEVELOPMENT_USERS = [
  {
    role: UserRole.STUDENT,
    email: 'student@ems.com',
    password: 'StudentPassword123',
    title: 'Demo Student',
    desc: 'Register for courses and view your semester academic grades & results.',
    icon: GraduationCap,
    color:
      'from-blue-600/20 to-indigo-600/5 border-blue-500/20 hover:border-blue-400/50 hover:shadow-blue-500/5',
    iconColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  {
    role: UserRole.LECTURER,
    email: 'lecturer@ems.com',
    password: 'LecturerPassword123',
    title: 'Demo Lecturer',
    desc: 'Manage assigned course lists, rosters, and submit student exam marks.',
    icon: BookOpen,
    color:
      'from-emerald-600/20 to-teal-600/5 border-emerald-500/20 hover:border-emerald-400/50 hover:shadow-emerald-500/5',
    iconColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    role: UserRole.EXAM_DIVISION_STAFF,
    email: 'staff@ems.com',
    password: 'StaffPassword123',
    title: 'Exam Staff',
    desc: 'Verify registrations, publish results, and view batch-wise statistics.',
    icon: Users,
    color:
      'from-amber-600/20 to-orange-600/5 border-amber-500/20 hover:border-amber-400/50 hover:shadow-amber-500/5',
    iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  {
    role: UserRole.ADMINISTRATOR,
    email: 'admin@ems.com',
    password: 'AdminPassword123',
    title: 'Administrator',
    desc: 'Add/manage system users, monitor audit logs, and trigger database backups.',
    icon: Shield,
    color:
      'from-violet-600/20 to-purple-600/5 border-violet-500/20 hover:border-violet-400/50 hover:shadow-violet-500/5',
    iconColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  },
];

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [signingInRole, setSigningInRole] = useState<string | null>(null);
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();

  const handleQuickLogin = async (userConfig: (typeof DEVELOPMENT_USERS)[0]) => {
    setError(null);
    setSigningInRole(userConfig.role);

    try {
      const response = await apiClient.post('/auth/login', {
        email: userConfig.email,
        password: userConfig.password,
      });
      if (response.data?.success && response.data?.user) {
        setUser(response.data.user);
        router.push('/');
      } else {
        setError(response.data?.message || 'Login failed');
      }
    } catch (err) {
      const axiosError = err as AxiosError<ApiResponse>;
      setError(
        axiosError.response?.data?.message ||
          'An error occurred during sign-in. Please ensure backend is running.',
      );
    } finally {
      setSigningInRole(null);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[40%] -left-[20%] h-[80%] w-[60%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-[40%] -right-[20%] h-[80%] w-[60%] rounded-full bg-rose-600/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-5xl space-y-10 z-10">
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Welcome to EMS Portal
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Credentials bypassed for testing. Click any of the academic profiles below to sign in
            instantly.
          </p>
        </div>

        {error && (
          <div className="max-w-md mx-auto p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-2xl font-medium text-center shadow-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {DEVELOPMENT_USERS.map((roleConfig) => {
            const Icon = roleConfig.icon;
            const isCurrentSigning = signingInRole === roleConfig.role;

            return (
              <button
                key={roleConfig.role}
                onClick={() => !signingInRole && handleQuickLogin(roleConfig)}
                disabled={!!signingInRole}
                className={`relative flex flex-col justify-between text-left p-6 bg-card/40 border rounded-3xl transition-all duration-300 backdrop-blur-md shadow-lg group hover:scale-[1.02] active:scale-[0.98] ${roleConfig.color} ${
                  signingInRole ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <div className="space-y-4 w-full">
                  <div className={`p-3 rounded-2xl border w-fit ${roleConfig.iconColor}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                      {roleConfig.title}
                    </h3>
                    <p className="text-[11px] font-mono text-muted-foreground/60 mt-1">
                      {roleConfig.email}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{roleConfig.desc}</p>
                </div>

                <div className="mt-8 flex items-center justify-between w-full border-t border-border/40 pt-4 text-xs font-semibold">
                  <span className="text-muted-foreground/80 group-hover:text-foreground transition-colors">
                    {isCurrentSigning ? 'Connecting...' : 'Sign In'}
                  </span>
                  {isCurrentSigning ? (
                    <Loader2 className="h-4.5 w-4.5 animate-spin text-primary" />
                  ) : (
                    <ArrowRight className="h-4.5 w-4.5 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
