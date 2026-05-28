'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';
import {
  User as UserIcon,
  Phone,
  Lock,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
} from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuthStore();

  // Notification States
  const [phoneSuccess, setPhoneSuccess] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  // Form States
  const [phoneNumber, setPhoneNumber] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Fetch current user details from profile endpoint
  const {
    data: profile,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await apiClient.get('/profile');
      const data = response.data?.data;
      if (data) {
        // Pre-populate phone number
        const existingPhone = data.student?.phone_number || data.lecturer?.phone_number || '';
        setPhoneNumber(existingPhone);
      }
      return data;
    },
  });

  // Phone Update Mutation
  const updatePhoneMutation = useMutation({
    mutationFn: async (payload: { phoneNumber: string }) => {
      await apiClient.put('/profile', { phoneNumber: payload.phoneNumber });
    },
    onSuccess: () => {
      setPhoneSuccess('Phone number updated successfully!');
      setPhoneError(null);
      refetch();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setPhoneError(err.response?.data?.message || 'Failed to update phone number.');
      setPhoneSuccess(null);
    },
  });

  // Password Change Mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (payload: any) => {
      await apiClient.post('/profile/change-password', payload);
    },
    onSuccess: () => {
      setPwSuccess('Password has been changed successfully!');
      setPwError(null);
      // Reset password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setPwError(err.response?.data?.message || 'Failed to change password.');
      setPwSuccess(null);
    },
  });

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePhoneMutation.mutate({ phoneNumber });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('All password fields are required.');
      setPwSuccess(null);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      setPwSuccess(null);
      return;
    }
    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters.');
      setPwSuccess(null);
      return;
    }
    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
      confirmPassword,
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Loading profile data...</p>
      </div>
    );
  }

  const isStudent = profile?.role_id === 4;
  const isLecturer = profile?.role_id === 3;
  const deptCode = isStudent
    ? profile?.student?.department?.department_code
    : isLecturer
      ? profile?.lecturer?.department?.department_code
      : 'N/A';

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          View your registered details, edit your contact number, and update security credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Summary Card & Non-editable Information */}
        <div className="lg:col-span-1 space-y-6">
          {/* Main User Card */}
          <div className="bg-card/25 border border-border/80 p-6 rounded-3xl backdrop-blur-md relative overflow-hidden flex flex-col items-center text-center shadow-xl">
            <div className="absolute -top-[50%] -right-[20%] h-[150%] w-[60%] rounded-full bg-primary/10 blur-[80px]" />

            {/* Avatar or Icon */}
            <div className="w-20 h-20 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center text-primary mb-4 relative z-10">
              <UserIcon className="h-10 w-10" />
            </div>

            <h2 className="text-xl font-bold relative z-10 leading-tight">{profile?.full_name}</h2>
            <p className="text-xs text-primary font-bold tracking-widest uppercase mt-1 px-3 py-1 bg-primary/10 border border-primary/15 rounded-full relative z-10">
              {profile?.role?.role_name || user?.role}
            </p>

            <div className="w-full border-t border-border/60 my-5 relative z-10" />

            {/* Read-only User Details List */}
            <div className="w-full text-left space-y-3.5 relative z-10 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span className="font-semibold">Email:</span>
                <span className="text-foreground font-medium select-all">{profile?.email}</span>
              </div>
              {isStudent && (
                <>
                  <div className="flex justify-between">
                    <span className="font-semibold">Registration Number:</span>
                    <span className="text-foreground font-mono font-bold">
                      {profile?.student?.registration_number}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Department:</span>
                    <span className="text-foreground font-medium">
                      {profile?.student?.department?.department_name} ({deptCode})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Academic Year:</span>
                    <span className="text-foreground font-medium">
                      {profile?.student?.academic_year}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Semester:</span>
                    <span className="text-foreground font-medium">
                      Semester {profile?.student?.semester}
                    </span>
                  </div>
                </>
              )}
              {isLecturer && (
                <>
                  <div className="flex justify-between">
                    <span className="font-semibold">Employee ID:</span>
                    <span className="text-foreground font-mono font-bold">
                      {profile?.lecturer?.employee_number}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Department:</span>
                    <span className="text-foreground font-medium">
                      {profile?.lecturer?.department?.department_name} ({deptCode})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Specialization:</span>
                    <span className="text-foreground font-medium">
                      {profile?.lecturer?.specialization || 'N/A'}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex items-center gap-1.5 text-[10px] text-muted-foreground bg-secondary/20 border border-border/55 px-3 py-1.5 rounded-xl font-medium w-full justify-center">
              <Lock className="h-3 w-3 shrink-0" />
              <span>Personal records locked by Academic Office</span>
            </div>
          </div>
        </div>

        {/* Right Side: Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Phone Number form */}
          <div className="bg-card/25 border border-border/80 p-6 rounded-3xl backdrop-blur-md space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Phone className="h-4.5 w-4.5 text-primary" />
              Contact Information
            </h3>
            <p className="text-xs text-muted-foreground leading-normal">
              Keep your contact details up to date so that the university faculty or exam division
              can contact you in emergencies.
            </p>

            {phoneSuccess && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-medium flex gap-2 items-center">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{phoneSuccess}</span>
              </div>
            )}
            {phoneError && (
              <div className="p-3.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl font-medium flex gap-2 items-center">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{phoneError}</span>
              </div>
            )}

            <form onSubmit={handlePhoneSubmit} className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
                    <Phone className="h-4 w-4" />
                  </span>
                  <input
                    type="tel"
                    placeholder="Enter phone number..."
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={updatePhoneMutation.isPending}
                className="py-2.5 px-5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition flex items-center justify-center gap-2 text-xs shadow-lg shadow-primary/10 disabled:opacity-50"
              >
                {updatePhoneMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Save Changes'
                )}
              </button>
            </form>
          </div>

          {/* Change Password form */}
          <div className="bg-card/25 border border-border/80 p-6 rounded-3xl backdrop-blur-md space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Fingerprint className="h-4.5 w-4.5 text-primary" />
              Security Credentials
            </h3>
            <p className="text-xs text-muted-foreground leading-normal">
              Change your password below. You will be prompted to enter your current password to
              verify identity.
            </p>

            {pwSuccess && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-medium flex gap-2 items-center">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{pwSuccess}</span>
              </div>
            )}
            {pwError && (
              <div className="p-3.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl font-medium flex gap-2 items-center">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{pwError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    placeholder="Enter current password..."
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    placeholder="Min 6 characters..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    placeholder="Repeat new password..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="py-2.5 px-5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition flex items-center justify-center gap-2 text-xs shadow-lg shadow-primary/10 disabled:opacity-50"
              >
                {changePasswordMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Change Password'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
