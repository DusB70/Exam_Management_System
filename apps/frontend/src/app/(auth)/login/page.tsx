'use client';

import React, { useState } from 'react';
import { UserRole } from '@ems/shared';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';
import {
  Shield,
  Users,
  BookOpen,
  GraduationCap,
  Loader2,
  ArrowRight,
  Mail,
  Lock,
} from 'lucide-react';

const DEVELOPMENT_USERS = [
  {
    role: UserRole.STUDENT,
    email: 'student@ems.com',
    password: 'StudentPassword123',
    title: 'Demo Student',
    desc: 'Register for courses & check grades.',
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
    desc: 'Manage courses, submit marks.',
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
    desc: 'Publish results, view stats.',
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
    desc: 'Manage users, view audit logs.',
    icon: Shield,
    color:
      'from-violet-600/20 to-purple-600/5 border-violet-500/20 hover:border-violet-400/50 hover:shadow-violet-500/5',
    iconColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signingInRole, setSigningInRole] = useState<string | null>(null);

  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await apiClient.post('/auth/login', { email, password });
      if (response.data?.success && response.data?.user) {
        setUser(response.data.user);
        router.push('/');
      } else {
        setError(response.data?.message || 'Login failed');
      }
    } catch (err) {
      const axiosError = err as AxiosError<ApiResponse>;
      setError(axiosError.response?.data?.message || 'Invalid credentials or backend is offline.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        axiosError.response?.data?.message || 'Connection failed. Ensure the server is online.',
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

      <div className="w-full max-w-5xl space-y-8 z-10">
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Welcome to EMS Portal
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Log in with your academic credentials or use a quick developer bypass profile below.
          </p>
        </div>

        {error && (
          <div className="max-w-md mx-auto p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-2xl font-medium text-center shadow-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Traditional Login Form */}
          <div className="lg:col-span-5 bg-card/25 border border-border/80 p-8 rounded-3xl backdrop-blur-md shadow-xl flex flex-col justify-center">
            <h3 className="text-xl font-bold text-foreground mb-6">Account Sign In</h3>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="name@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                    required
                  />
                  <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground/60" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                    required
                  />
                  <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground/60" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !!signingInRole}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed mt-6 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  'Sign In to Portal'
                )}
              </button>
            </form>
          </div>

          {/* Divider line for desktop */}
          <div className="hidden lg:flex lg:col-span-1 justify-center items-center">
            <div className="h-full w-[1px] bg-border/40" />
          </div>

          {/* Right Column: Developer Bypass Cards */}
          <div className="lg:col-span-6 space-y-4 flex flex-col justify-center">
            <h3 className="text-xl font-bold text-foreground">Developer Quick Bypass</h3>
            <p className="text-xs text-muted-foreground">
              Bypass typing credentials. Click any profile to log in immediately during development.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {DEVELOPMENT_USERS.map((roleConfig) => {
                const Icon = roleConfig.icon;
                const isCurrentSigning = signingInRole === roleConfig.role;

                return (
                  <button
                    key={roleConfig.role}
                    type="button"
                    onClick={() => !signingInRole && !isSubmitting && handleQuickLogin(roleConfig)}
                    disabled={!!signingInRole || isSubmitting}
                    className={`relative flex flex-col justify-between text-left p-5 bg-card/40 border rounded-3xl transition-all duration-300 backdrop-blur-md shadow-md group hover:scale-[1.02] active:scale-[0.98] ${roleConfig.color} ${
                      signingInRole || isSubmitting
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer'
                    }`}
                  >
                    <div className="space-y-3 w-full">
                      <div className={`p-2.5 rounded-xl border w-fit ${roleConfig.iconColor}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground leading-snug group-hover:text-primary transition-colors">
                          {roleConfig.title}
                        </h4>
                        <p className="text-[10px] font-mono text-muted-foreground/60">
                          {roleConfig.email}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        {roleConfig.desc}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between w-full border-t border-border/40 pt-3 text-[10px] font-semibold">
                      <span className="text-muted-foreground/80 group-hover:text-foreground transition-colors">
                        {isCurrentSigning ? 'Connecting...' : 'Quick Login'}
                      </span>
                      {isCurrentSigning ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
