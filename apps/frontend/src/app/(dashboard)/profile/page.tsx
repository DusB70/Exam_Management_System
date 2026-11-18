'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import { useToast } from '../../../hooks/use-toast';
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
  X,
  KeyRound,
} from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const toast = useToast();

  // Notification States
  const [phoneSuccess, setPhoneSuccess] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  // Form States
  const [phoneNumber, setPhoneNumber] = useState('');
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
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
      return response.data?.data;
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
      toast.success('Phone number updated successfully!');
      refetch();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      const msg = err.response?.data?.message || 'Failed to update phone number.';
      setPhoneError(msg);
      setPhoneSuccess(null);
      toast.error(msg);
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
      toast.success('Password changed successfully!');
      // Reset password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordModalOpen(false);
        setPwSuccess(null);
      }, 1500);
    },
    onError: (err: AxiosError<ApiResponse>) => {
      const msg = err.response?.data?.message || 'Failed to change password.';
      setPwError(msg);
      setPwSuccess(null);
      toast.error(msg);
    },
  });

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setPhoneError('Please enter a valid phone number.');
      return;
    }
    updatePhoneMutation.mutate({ phoneNumber: phoneNumber.trim() });
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

  const isStudent = profile?.role_id === 4;
  const isLecturer = profile?.role_id === 3;

  // Department resolve
  const studentDept =
    profile?.student?.degree?.department || profile?.student?.specialization?.department;
  const lecturerDept = profile?.lecturer?.department;
  const deptDisplay = isStudent
    ? studentDept?.department_code || studentDept?.department_name || 'N/A'
    : isLecturer
      ? lecturerDept?.department_code || lecturerDept?.department_name || 'N/A'
      : 'N/A';

  // Academic Year (batch) resolve
  const academicYearDisplay = profile?.student?.batch || profile?.student?.academic_year || 'N/A';

  // Latest Registered Semester resolve
  const latestRegisteredSemester = useMemo(() => {
    if (profile?.student?.latest_registered_semester) {
      return profile.student.latest_registered_semester;
    }
    const regSems = (profile?.student?.registrations || [])
      .map((r: any) => r.course?.semester)
      .filter(Boolean);
    if (regSems.length > 0) {
      regSems.sort();
      return regSems[regSems.length - 1];
    }
    return null;
  }, [profile?.student]);

  // Specialization resolve
  const specializationDisplay = isStudent
    ? profile?.student?.specialization?.specialization_name || '-'
    : isLecturer
      ? profile?.lecturer?.specialization || '-'
      : '-';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Loading profile data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Top Right Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            View your registered details, edit your contact number, and update security credentials.
          </p>
        </div>

        {/* Top Right: Security Credentials Button */}
        <button
          onClick={() => {
            setPwError(null);
            setPwSuccess(null);
            setPasswordModalOpen(true);
          }}
          className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer self-start sm:self-auto shrink-0"
        >
          <KeyRound className="h-4 w-4" />
          Change Credentials
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Left Side: Summary Card & Non-editable Information */}
        <div className="lg:col-span-1">
          {/* Main User Card */}
          <div className="bg-card/25 border border-border/80 p-5 rounded-3xl backdrop-blur-md relative overflow-hidden flex flex-col items-center text-center shadow-xl h-full justify-between">
            <div className="absolute -top-[50%] -right-[20%] h-[150%] w-[60%] rounded-full bg-primary/10 blur-[80px]" />

            <div className="w-full flex flex-col items-center">
              {/* Avatar */}
              <div className="w-20 h-20 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center text-primary mb-3.5 relative z-10">
                <UserIcon className="h-10 w-10" />
              </div>

              <h2 className="text-xl font-bold relative z-10 leading-tight">{profile?.full_name}</h2>
              <p className="text-xs text-primary font-bold tracking-widest uppercase mt-1 px-2.5 py-0.5 bg-primary/10 border border-primary/20 rounded relative z-10">
                {(profile?.role?.role_name || user?.role) === 'Exam Division Staff'
                  ? 'Staff'
                  : profile?.role?.role_name || user?.role}
              </p>

              <div className="w-full border-t border-border/60 my-4 relative z-10" />

              {/* Read-only User Details List */}
              <div className="w-full text-left space-y-2.5 relative z-10 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span className="font-semibold">Email:</span>
                  <span className="text-foreground font-medium select-all">{profile?.email}</span>
                </div>

                {isStudent && (
                  <>
                    <div className="flex justify-between">
                      <span className="font-semibold">Registration Number:</span>
                      <span className="text-foreground font-mono font-bold">
                        {profile?.student?.registration_number || '-'}
                      </span>
                    </div>
                    {/* Index number placed directly under registration number */}
                    <div className="flex justify-between">
                      <span className="font-semibold">Index Number:</span>
                      <span className="text-foreground font-mono font-bold">
                        {profile?.student?.index_number || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Department:</span>
                      <span
                        className="text-foreground font-medium text-right max-w-[170px] truncate"
                        title={deptDisplay}
                      >
                        {deptDisplay}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Specialization:</span>
                      <span className="text-foreground font-medium">{specializationDisplay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Academic Year:</span>
                      <span className="text-foreground font-medium">{academicYearDisplay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Active Semester:</span>
                      <span className="text-foreground font-medium">
                        {latestRegisteredSemester ? `Semester ${latestRegisteredSemester}` : '-'}
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
                      <span className="text-foreground font-medium">{deptDisplay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Specialization:</span>
                      <span className="text-foreground font-medium">{specializationDisplay}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-1.5 text-[10px] text-muted-foreground bg-secondary/20 border border-border/55 px-3 py-1.5 rounded-xl font-medium w-full justify-center">
              <Lock className="h-3 w-3 shrink-0" />
              <span>Personal records locked by Academic Office</span>
            </div>
          </div>
        </div>

        {/* Right Side: Personal Profile Details Form */}
        <div className="lg:col-span-2">
          <div className="bg-card/25 border border-border/80 p-5 rounded-3xl backdrop-blur-md space-y-3 shadow-xl h-full flex flex-col justify-between">
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <UserIcon className="h-4.5 w-4.5 text-primary" />
                  Personal Profile Details
                </h3>
                <p className="text-xs text-muted-foreground leading-normal mt-0.5">
                  Official registration credentials and personal identification parameters on record.
                  Contact the Academic Registrar's Office to request administrative changes.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-0.5">
                <div className="p-2.5 bg-secondary/15 rounded-xl space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Full Name
                  </span>
                  <p className="text-xs font-semibold text-foreground">{profile?.full_name}</p>
                </div>

                <div className="p-2.5 bg-secondary/15 rounded-xl space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Name with Initials
                  </span>
                  <p className="text-xs font-semibold text-foreground">
                    {profile?.name_with_initials || 'N/A'}
                  </p>
                </div>

                <div className="p-2.5 bg-secondary/15 rounded-xl space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    National Identity Card (NIC)
                  </span>
                  <p className="text-xs font-semibold text-foreground font-mono">
                    {profile?.nic_no || 'N/A'}
                  </p>
                </div>

                <div className="p-2.5 bg-secondary/15 rounded-xl space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Date of Birth
                  </span>
                  <p className="text-xs font-semibold text-foreground">
                    {profile?.date_of_birth
                      ? new Date(profile.date_of_birth).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'N/A'}
                  </p>
                </div>

                <div className="p-2.5 bg-secondary/15 rounded-xl space-y-0.5 md:col-span-2">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Permanent Address
                  </span>
                  <p className="text-xs font-semibold text-foreground leading-normal">
                    {profile?.address || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Information & Phone Editor embedded in Personal Profile Details */}
            <div className="p-3 bg-secondary/20 rounded-2xl border border-border/60 space-y-2 mt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-primary" />
                    Contact Phone Number
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Current on record:{' '}
                    <span className="font-mono font-bold text-foreground">
                      {profile?.phone_number ||
                        profile?.student?.phone_number ||
                        profile?.lecturer?.phone_number ||
                        'Not set'}
                    </span>
                  </p>
                </div>

                {phoneSuccess && (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {phoneSuccess}
                  </span>
                )}
                {phoneError && (
                  <span className="text-xs text-destructive font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {phoneError}
                  </span>
                )}
              </div>

              <form
                onSubmit={handlePhoneSubmit}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-0.5"
              >
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground pointer-events-none">
                    <Phone className="h-4 w-4" />
                  </span>
                  <input
                    type="tel"
                    placeholder="Enter new phone number..."
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-xs font-mono font-medium text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={
                    updatePhoneMutation.isPending ||
                    !phoneNumber.trim() ||
                    phoneNumber.trim() === profile?.phone_number
                  }
                  className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0 shadow-sm"
                >
                  {updatePhoneMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* POPUP MODAL: Security Credentials Dialog */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm !m-0">
          <div className="bg-card border border-border/80 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <Fingerprint className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Change Credentials</h3>
                  <p className="text-xs text-muted-foreground">Change your account password</p>
                </div>
              </div>
              <button
                onClick={() => setPasswordModalOpen(false)}
                className="p-1.5 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {pwSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-medium flex gap-2 items-center">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{pwSuccess}</span>
              </div>
            )}
            {pwError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl font-medium flex gap-2 items-center">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{pwError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="password"
                    placeholder="Enter current password..."
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-xs text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="password"
                    placeholder="Min 6 characters..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-xs text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="password"
                    placeholder="Repeat new password..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-xs text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-medium rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition flex items-center justify-center gap-2 text-xs shadow-lg shadow-primary/10 disabled:opacity-50 cursor-pointer"
                >
                  {changePasswordMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    'Change Password'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
