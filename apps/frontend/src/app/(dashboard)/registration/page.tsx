'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';
import {
  BookOpen,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Loader2,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';

const MAX_CREDITS = 22.0;

export default function CourseRegistrationPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch active registration period status
  const { data: activePeriod, isLoading: isActivePeriodLoading } = useQuery({
    queryKey: ['active-period'],
    queryFn: async () => {
      const response = await apiClient.get('/registrations/active-period');
      return response.data?.data;
    },
  });

  // Fetch eligible courses for registration
  const { data: eligibleCourses = [], isLoading: isEligibleLoading } = useQuery({
    queryKey: ['eligible-courses'],
    queryFn: async () => {
      const response = await apiClient.get('/registrations/eligible-courses');
      return response.data?.data || [];
    },
  });

  // Fetch current registrations
  const { data: myRegistrations = [], isLoading: isMyRegsLoading } = useQuery({
    queryKey: ['my-registrations'],
    queryFn: async () => {
      const response = await apiClient.get('/registrations/my-registrations');
      return response.data?.data || [];
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (courseIds: number[]) => {
      const response = await apiClient.post('/registrations', { courseIds });
      return response.data;
    },
    onSuccess: () => {
      setSelectedCourseIds([]);
      setSuccessMsg('Course registrations updated successfully!');
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['eligible-courses'] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to complete registration');
      setSuccessMsg(null);
    },
  });

  // Drop mutation
  const dropMutation = useMutation({
    mutationFn: async (registrationId: number) => {
      await apiClient.delete(`/registrations/${registrationId}`);
    },
    onSuccess: () => {
      setSuccessMsg('Course registration dropped successfully.');
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['eligible-courses'] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to drop course');
      setSuccessMsg(null);
    },
  });

  // Calculate credits
  const currentRegisteredCredits = myRegistrations.reduce(
    (sum: number, reg: any) => sum + parseFloat(reg.course.credit_value),
    0,
  );

  const selectedCourses = eligibleCourses.filter((c: any) =>
    selectedCourseIds.includes(c.course_id),
  );

  const selectedCredits = selectedCourses.reduce(
    (sum: number, c: any) => sum + parseFloat(c.credit_value),
    0,
  );

  const totalCreditsCalculated = currentRegisteredCredits + selectedCredits;
  const isCreditOverlimit = totalCreditsCalculated > MAX_CREDITS;

  const handleToggleCourse = (courseId: number) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId],
    );
  };

  const handleRegister = () => {
    if (selectedCourseIds.length === 0) return;
    registerMutation.mutate(selectedCourseIds);
  };

  const handleDrop = (registrationId: number, courseCode: string) => {
    if (confirm(`Are you sure you want to drop course ${courseCode}?`)) {
      dropMutation.mutate(registrationId);
    }
  };

  // Loading Screen
  const isGlobalLoading = isActivePeriodLoading || isEligibleLoading || isMyRegsLoading;
  if (isGlobalLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">
          Loading Course Registration portal...
        </p>
      </div>
    );
  }

  const isRegistrationWindowOpen = !!activePeriod;

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Course Registration</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Welcome, <strong className="text-foreground">{user?.fullName}</strong>! Browse and
          register for academic modules, track your semester credit workload, and manage
          enrollments.
        </p>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-2xl font-medium flex gap-2 items-center">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-2xl font-medium flex gap-2 items-center">
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Window Status Banner */}
      {!isRegistrationWindowOpen ? (
        <div className="p-6 bg-amber-500/5 border border-amber-500/15 rounded-3xl flex gap-4 backdrop-blur-md">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl h-fit shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-foreground mb-1">Registration Window Closed</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              There is currently no active registration period open for your academic semester.
              Course enrollment limits and edits are suspended. If you require a manual override or
              need to register past-due backlog modules, please contact the{' '}
              <strong>Exam Division office</strong>.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-primary/5 border border-primary/15 rounded-3xl flex flex-col md:flex-row gap-6 md:items-center justify-between backdrop-blur-md">
          <div className="flex gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl h-fit shrink-0">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-bold text-foreground">Registration Period Active</h4>
                <span className="px-2.5 py-0.5 text-xs font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full animate-pulse">
                  OPEN
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1 leading-normal">
                Academic Year: <strong>{activePeriod.academic_year}</strong> | Semester:{' '}
                <strong>{activePeriod.semester}</strong>
              </p>
              <p className="text-xs text-muted-foreground/75 mt-1.5 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Enrollment window closes on{' '}
                {new Date(activePeriod.end_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Credit WORKLOAD tracker */}
          <div className="w-full md:w-80 bg-secondary/15 border border-border/40 p-4 rounded-2xl flex flex-col justify-center">
            <div className="flex justify-between text-xs font-bold text-muted-foreground mb-2">
              <span>WORKLOAD BUDGET</span>
              <span className={isCreditOverlimit ? 'text-destructive' : 'text-primary'}>
                {totalCreditsCalculated.toFixed(1)} / {MAX_CREDITS.toFixed(1)} Credits
              </span>
            </div>
            <div className="h-2.5 w-full bg-secondary/40 rounded-full overflow-hidden">
              <div
                style={{ width: `${Math.min((totalCreditsCalculated / MAX_CREDITS) * 100, 100)}%` }}
                className={`h-full transition-all duration-300 rounded-full ${
                  isCreditOverlimit ? 'bg-destructive' : 'bg-primary'
                }`}
              />
            </div>
            <p className="text-[10px] text-muted-foreground/80 mt-2 font-medium">
              Maximum allowable registration budget is 22.0 credits per semester.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Eligible Courses List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground">Available Modules</h3>
            <span className="text-xs font-semibold text-muted-foreground">
              {eligibleCourses.length} Offered Modules
            </span>
          </div>

          {!isRegistrationWindowOpen ? (
            <div className="p-8 text-center bg-card/10 rounded-3xl border border-border/60 flex flex-col items-center justify-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">
                Registration not available
              </p>
              <p className="text-xs text-muted-foreground/75 mt-1 max-w-sm">
                Modules list is disabled because the enrollment window is currently closed.
              </p>
            </div>
          ) : eligibleCourses.length === 0 ? (
            <div className="p-8 text-center bg-card/10 rounded-3xl border border-dashed border-border flex flex-col items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400/70 mb-3" />
              <p className="text-sm font-semibold text-foreground">All Modules Registered</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                You have registered for all offered modules in your semester. Check your registered
                course list on the right.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eligibleCourses.map((course: any) => {
                const isSelected = selectedCourseIds.includes(course.course_id);
                return (
                  <div
                    key={course.course_id}
                    onClick={() => handleToggleCourse(course.course_id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between h-44 ${
                      isSelected
                        ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5'
                        : 'bg-card/20 border-border/60 hover:border-border/80 hover:bg-card/45'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md uppercase">
                          {course.course_code}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground font-semibold">
                          {parseFloat(course.credit_value)} Credits
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-foreground line-clamp-2 leading-snug">
                        {course.course_name}
                      </h4>
                    </div>

                    <div className="pt-2 border-t border-border/40 mt-auto flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase leading-none">
                          Instructors
                        </p>
                        <p className="text-xs font-semibold text-foreground/80 truncate mt-1 leading-none">
                          {course.lecturers?.length > 0
                            ? course.lecturers
                                .map((l: any) => l.lecturer?.user?.full_name)
                                .join(', ')
                            : 'No instructor assigned'}
                        </p>
                      </div>
                      <div
                        className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-border/80'
                        }`}
                      >
                        {isSelected && <Sparkles className="h-3 w-3" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Summary & Registered Courses */}
        <div className="space-y-6">
          {/* Action card if window open */}
          {isRegistrationWindowOpen && selectedCourseIds.length > 0 && (
            <div className="p-5 bg-card/40 border border-border/80 rounded-3xl space-y-4 backdrop-blur-md shadow-xl">
              <h3 className="text-sm font-bold text-foreground">Registration Summary</h3>
              <div className="space-y-2">
                {selectedCourses.map((c: any) => (
                  <div
                    key={c.course_id}
                    className="flex justify-between text-xs text-muted-foreground font-medium"
                  >
                    <span className="truncate pr-4">{c.course_name}</span>
                    <span className="font-mono text-foreground font-semibold">
                      {parseFloat(c.credit_value).toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-border/40 flex justify-between items-center text-sm font-bold text-foreground">
                <span>Selected Load:</span>
                <span className={isCreditOverlimit ? 'text-destructive' : 'text-primary'}>
                  +{selectedCredits.toFixed(1)} Credits
                </span>
              </div>

              <button
                onClick={handleRegister}
                disabled={isCreditOverlimit || registerMutation.isPending}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-primary/10 disabled:opacity-50"
              >
                {registerMutation.isPending ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <>
                    Confirm Registration
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Registered Courses list */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-foreground">My Registered Courses</h3>
            {myRegistrations.length === 0 ? (
              <div className="p-6 text-center bg-card/10 rounded-3xl border border-border/60 flex flex-col items-center justify-center">
                <BookOpen className="h-8 w-8 text-muted-foreground/45 mb-2" />
                <p className="text-xs font-semibold text-muted-foreground">
                  No course registrations
                </p>
                <p className="text-[10px] text-muted-foreground/75 mt-0.5">
                  You are not enrolled in any courses for this semester yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myRegistrations.map((reg: any) => (
                  <div
                    key={reg.registration_id}
                    className="p-4 bg-card/30 border border-border/60 rounded-2xl hover:border-border transition flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/15 text-primary rounded-md uppercase">
                          {reg.course.course_code}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground font-medium">
                          {parseFloat(reg.course.credit_value)} Credits
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-foreground truncate">
                        {reg.course.course_name}
                      </h4>
                      <p className="text-[10px] text-muted-foreground mt-2 truncate">
                        Prof:{' '}
                        {reg.course.lecturers?.length > 0
                          ? reg.course.lecturers
                              .map((l: any) => l.lecturer?.user?.full_name)
                              .join(', ')
                          : 'TBD'}
                      </p>
                    </div>

                    {isRegistrationWindowOpen && (
                      <button
                        onClick={() => handleDrop(reg.registration_id, reg.course.course_code)}
                        disabled={dropMutation.isPending}
                        className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition disabled:opacity-50 shrink-0"
                        title="Drop course"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
