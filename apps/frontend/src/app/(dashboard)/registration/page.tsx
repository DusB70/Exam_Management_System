'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useToast } from '../../../hooks/use-toast';
import { useConfirm } from '../../../hooks/use-confirm';
import { useProgressiveList } from '../../../hooks/use-progressive-load';
import { ProgressiveLoadFooter } from '../../../components/ui/progressive-load-footer';
import { useBulkSelection, runBulkDelete } from '../../../hooks/use-bulk-selection';
import { BulkDeleteButton, SelectAllCheckbox } from '../../../components/ui/bulk-delete-button';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';
import {
  BookOpen,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Trash2,
  Loader2,
  ArrowRight,
  Info,
  Lock,
} from 'lucide-react';

export default function CourseRegistrationPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const regSelection = useBulkSelection<number>();
  const [isBulkDropping, setIsBulkDropping] = useState(false);

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
      toast.success('Course registrations updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['eligible-courses'] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      toast.error(err.response?.data?.message || 'Failed to complete registration');
    },
  });

  // Drop mutation
  const dropMutation = useMutation({
    mutationFn: async (registrationId: number) => {
      await apiClient.delete(`/registrations/${registrationId}`);
    },
    onSuccess: () => {
      toast.success('Course registration dropped successfully.');
      queryClient.invalidateQueries({ queryKey: ['eligible-courses'] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      toast.error(err.response?.data?.message || 'Failed to drop course');
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

  const compulsorySelectedCredits = selectedCourses
    .filter((c: any) => c.is_compulsory)
    .reduce((sum: number, c: any) => sum + parseFloat(c.credit_value), 0);

  const optionalSelectedCredits = selectedCourses
    .filter((c: any) => !c.is_compulsory)
    .reduce((sum: number, c: any) => sum + parseFloat(c.credit_value), 0);

  const selectedCredits = selectedCourses.reduce(
    (sum: number, c: any) => sum + parseFloat(c.credit_value),
    0,
  );

  const totalCreditsCalculated = currentRegisteredCredits + selectedCredits;

  React.useEffect(() => {
    if (eligibleCourses && eligibleCourses.length > 0) {
      const compulsoryIds = eligibleCourses
        .filter((c: any) => c.is_compulsory)
        .map((c: any) => c.course_id);
      setSelectedCourseIds((prev) => {
        const next = new Set([...prev, ...compulsoryIds]);
        return Array.from(next);
      });
    }
  }, [eligibleCourses]);

  const handleToggleCourse = (courseId: number) => {
    const course = eligibleCourses.find((c: any) => c.course_id === courseId);
    if (course?.is_compulsory) {
      toast.info('Compulsory subjects are required and cannot be removed.');
      return;
    }
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId],
    );
  };

  const selectableEligibleIds = React.useMemo(
    () => eligibleCourses.filter((c: any) => !c.is_compulsory).map((c: any) => c.course_id),
    [eligibleCourses],
  );

  const isAllEligibleSelected =
    selectableEligibleIds.length > 0 &&
    selectableEligibleIds.every((id: number) => selectedCourseIds.includes(id));

  const isIndeterminateEligible =
    selectableEligibleIds.some((id: number) => selectedCourseIds.includes(id)) &&
    !isAllEligibleSelected;

  const toggleAllEligible = () => {
    if (isAllEligibleSelected) {
      setSelectedCourseIds((prev) => prev.filter((id) => !selectableEligibleIds.includes(id)));
    } else {
      setSelectedCourseIds((prev) => Array.from(new Set([...prev, ...selectableEligibleIds])));
    }
  };

  const handleRegister = () => {
    const compulsoryIds = eligibleCourses
      .filter((c: any) => c.is_compulsory)
      .map((c: any) => c.course_id);
    const finalCourseIds = Array.from(new Set([...selectedCourseIds, ...compulsoryIds]));
    if (finalCourseIds.length === 0) return;
    registerMutation.mutate(finalCourseIds);
  };

  const handleDrop = async (registrationId: number, courseCode: string, isCompulsory?: boolean) => {
    if (isCompulsory) {
      toast.error('Compulsory courses cannot be dropped.');
      return;
    }
    const confirmed = await confirm({
      title: 'Drop Course?',
      message: `Are you sure you want to drop course ${courseCode}? You can re-register if the registration window is still open.`,
      confirmText: 'Drop Course',
      variant: 'destructive',
    });
    if (confirmed) {
      dropMutation.mutate(registrationId);
    }
  };

  const sortedMyRegistrations = React.useMemo(() => {
    return [...myRegistrations].sort((a: any, b: any) => {
      if (a.is_compulsory && !b.is_compulsory) return -1;
      if (!a.is_compulsory && b.is_compulsory) return 1;
      return 0;
    });
  }, [myRegistrations]);

  const selectableRegistrationIds: number[] = sortedMyRegistrations
    .filter((reg: any) => !reg.is_compulsory)
    .map((reg: any) => reg.registration_id);

  const handleBulkDrop = async () => {
    const ids = Array.from(regSelection.selectedIds);
    if (ids.length === 0) return;

    const confirmed = await confirm({
      title: `Drop ${ids.length} Course${ids.length === 1 ? '' : 's'}?`,
      message: `Are you sure you want to drop ${ids.length} selected course${ids.length === 1 ? '' : 's'}? You can re-register while the registration window is open.`,
      confirmText: `Drop ${ids.length}`,
      variant: 'destructive',
    });
    if (!confirmed) return;

    setIsBulkDropping(true);
    try {
      const result = await runBulkDelete(ids, async (regId) => {
        await apiClient.delete(`/registrations/${regId}`);
      });

      queryClient.invalidateQueries({ queryKey: ['eligible-courses'] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });

      if (result.deletedCount > 0) {
        regSelection.clear();
      }

      if (result.failedCount > 0) {
        toast.warning(
          `Dropped ${result.deletedCount} course(s), but ${result.failedCount} failed${result.firstErrorMessage ? `: ${result.firstErrorMessage}` : '.'}`,
        );
      } else {
        toast.success(`Dropped ${result.deletedCount} course(s) successfully.`);
      }
    } finally {
      setIsBulkDropping(false);
    }
  };

  const {
    visibleItems: visibleEligibleCourses,
    visibleCount: visibleEligibleCount,
    totalCount: totalEligibleCount,
    hasMore: hasMoreEligible,
  } = useProgressiveList<any>(eligibleCourses);

  const {
    visibleItems: visibleMyRegistrations,
    visibleCount: visibleMyRegsCount,
    totalCount: totalMyRegsCount,
    hasMore: hasMoreMyRegs,
  } = useProgressiveList<any>(sortedMyRegistrations);

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
          Browse and register for academic modules, track your semester credit workload, and manage
          enrollments.
        </p>
      </div>

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
              <span>SEMESTER WORKLOAD</span>
              <span className="text-primary font-mono font-bold">
                {totalCreditsCalculated.toFixed(1)} Credits
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground py-1 border-t border-border/30">
              <span>Registered: {currentRegisteredCredits.toFixed(1)}</span>
              <span>Selected: +{selectedCredits.toFixed(1)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground/80 mt-1.5 font-medium">
              You can register for all available courses offered for this semester.
            </p>
          </div>
        </div>
      )}

      {/* 1. Available Modules List View */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">Available Modules</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select the modules you wish to enroll in for this semester. Compulsory modules are
              pre-selected and required.
            </p>
          </div>
          <span className="px-3 py-1 bg-secondary/40 border border-border/80 rounded-xl text-xs font-mono font-bold text-foreground">
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
              course list below.
            </p>
          </div>
        ) : (
          <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/15">
                    <th className="px-3.5 py-3 w-10 text-center">
                      <SelectAllCheckbox
                        checked={isAllEligibleSelected}
                        indeterminate={isIndeterminateEligible}
                        disabled={selectableEligibleIds.length === 0}
                        onChange={toggleAllEligible}
                        ariaLabel="Select all optional courses"
                      />
                    </th>
                    <th className="px-3 py-3 w-10 text-center">#</th>
                    <th className="px-4 py-3 whitespace-nowrap">Course Code</th>
                    <th className="px-4 py-3">Course Name</th>
                    <th className="px-4 py-3 whitespace-nowrap text-center">Credit Value</th>
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3">Lecturer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs font-medium">
                  {visibleEligibleCourses.map((course: any, idx: number) => {
                    const isSelected =
                      selectedCourseIds.includes(course.course_id) || course.is_compulsory;
                    return (
                      <tr
                        key={course.course_id}
                        onClick={() => handleToggleCourse(course.course_id)}
                        className={`hover:bg-secondary/15 transition-colors cursor-pointer ${
                          isSelected ? 'bg-primary/5' : ''
                        }`}
                      >
                        <td
                          className="px-3.5 py-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={course.is_compulsory}
                            onChange={() => handleToggleCourse(course.course_id)}
                            aria-label={`Select ${course.course_code}`}
                            className="h-3.5 w-3.5 rounded border-border/80 accent-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-muted-foreground font-bold text-xs">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md uppercase">
                            {course.course_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-foreground">
                          {course.course_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center font-mono font-semibold text-foreground">
                          {parseFloat(course.credit_value).toFixed(1)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {course.is_compulsory ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/25 inline-flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Compulsory
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/25 inline-flex items-center">
                              Optional
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {course.lecturers?.length > 0
                            ? course.lecturers
                                .map((l: any) => l.lecturer?.user?.full_name)
                                .join(', ')
                            : 'No instructor assigned'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Credits Summary & Confirmation Footer */}
            <div className="p-4 bg-secondary/15 border-t border-border/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 bg-card/60 px-3 py-1.5 rounded-xl border border-border/60">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded shrink-0">
                    C
                  </span>
                  <span className="text-muted-foreground">Compulsory Selected:</span>
                  <span className="font-mono font-bold text-foreground">
                    {compulsorySelectedCredits.toFixed(1)} Credits
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-card/60 px-3 py-1.5 rounded-xl border border-border/60">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded shrink-0">
                    O
                  </span>
                  <span className="text-muted-foreground">Optional Selected:</span>
                  <span className="font-mono font-bold text-foreground">
                    {optionalSelectedCredits.toFixed(1)} Credits
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20">
                  <span className="text-muted-foreground font-semibold">Total Selected:</span>
                  <span className="font-mono font-bold text-primary text-sm">
                    {selectedCredits.toFixed(1)} Credits
                  </span>
                </div>
              </div>

              <button
                onClick={handleRegister}
                disabled={registerMutation.isPending || selectedCourseIds.length === 0}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition flex items-center justify-center gap-2 text-xs shadow-lg shadow-primary/20 disabled:opacity-50 cursor-pointer shrink-0"
              >
                {registerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Confirm Registration</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

            <ProgressiveLoadFooter
              loadedCount={visibleEligibleCount}
              totalCount={totalEligibleCount}
              isLoadingMore={hasMoreEligible}
              hasMore={hasMoreEligible}
              entityLabel="courses"
            />
          </div>
        )}
      </div>

      {/* 2. Registered Modules List View */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-foreground">My Registered Courses</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Modules currently confirmed on your academic record for this semester.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isRegistrationWindowOpen && (
              <BulkDeleteButton
                count={regSelection.selectedCount}
                isDeleting={isBulkDropping}
                onClick={handleBulkDrop}
                label="Drop Selected"
              />
            )}
            <span className="px-3 py-1 bg-secondary/40 border border-border/80 rounded-xl text-xs font-mono font-bold text-foreground">
              {myRegistrations.length} Enrolled Modules ({currentRegisteredCredits.toFixed(1)}{' '}
              Credits)
            </span>
          </div>
        </div>

        {myRegistrations.length === 0 ? (
          <div className="p-8 text-center bg-card/10 rounded-3xl border border-border/60 flex flex-col items-center justify-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/45 mb-2" />
            <p className="text-sm font-semibold text-muted-foreground">No course registrations</p>
            <p className="text-xs text-muted-foreground/75 mt-0.5">
              You are not enrolled in any courses for this semester yet.
            </p>
          </div>
        ) : (
          <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/15">
                    {isRegistrationWindowOpen && (
                      <th className="px-3.5 py-3 w-10 text-center">
                        <SelectAllCheckbox
                          checked={regSelection.isAllSelected(selectableRegistrationIds)}
                          indeterminate={regSelection.isIndeterminate(selectableRegistrationIds)}
                          disabled={isBulkDropping || selectableRegistrationIds.length === 0}
                          onChange={() => regSelection.toggleAll(selectableRegistrationIds)}
                          ariaLabel="Select all registered courses"
                        />
                      </th>
                    )}
                    <th className="px-3 py-3 w-10 text-center">#</th>
                    <th className="px-4 py-3 whitespace-nowrap">Course Code</th>
                    <th className="px-4 py-3">Course Name</th>
                    <th className="px-4 py-3 whitespace-nowrap text-center">Credit Value</th>
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3">Lecturer</th>
                    {isRegistrationWindowOpen && (
                      <th className="px-4 py-3 text-right whitespace-nowrap">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs font-medium">
                  {visibleMyRegistrations.map((reg: any, idx: number) => {
                    const isComp = Boolean(reg.is_compulsory);
                    return (
                      <tr
                        key={reg.registration_id}
                        className={`hover:bg-secondary/15 transition-colors ${
                          regSelection.isSelected(reg.registration_id) ? 'bg-primary/5' : ''
                        }`}
                      >
                        {isRegistrationWindowOpen && (
                          <td className="px-3.5 py-3 text-center">
                            {isComp ? (
                              <div
                                className="h-4 w-4 mx-auto flex items-center justify-center text-amber-400"
                                title="Compulsory course"
                              >
                                <Lock className="h-3.5 w-3.5" />
                              </div>
                            ) : (
                              <input
                                type="checkbox"
                                checked={regSelection.isSelected(reg.registration_id)}
                                disabled={isBulkDropping}
                                onChange={() => regSelection.toggle(reg.registration_id)}
                                aria-label={`Select ${reg.course.course_code}`}
                                className="h-3.5 w-3.5 rounded border-border/80 accent-primary cursor-pointer disabled:opacity-50"
                              />
                            )}
                          </td>
                        )}
                        <td className="px-3 py-3 text-center font-mono text-muted-foreground font-bold text-xs">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md uppercase">
                            {reg.course.course_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-foreground">
                          {reg.course.course_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center font-mono font-semibold text-foreground">
                          {parseFloat(reg.course.credit_value).toFixed(1)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isComp ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/25 inline-flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Compulsory
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/25 inline-flex items-center">
                              Optional
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {reg.course.lecturers?.length > 0
                            ? reg.course.lecturers
                                .map((l: any) => l.lecturer?.user?.full_name)
                                .join(', ')
                            : 'TBD'}
                        </td>
                        {isRegistrationWindowOpen && (
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {isComp ? (
                              <span
                                className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground bg-secondary/30 rounded-lg inline-flex items-center gap-1 cursor-default select-none border border-border/40"
                                title="Compulsory courses cannot be dropped"
                              >
                                <Lock className="h-3 w-3 text-amber-400" />
                                Required
                              </span>
                            ) : (
                              <button
                                onClick={() =>
                                  handleDrop(
                                    reg.registration_id,
                                    reg.course.course_code,
                                    reg.is_compulsory,
                                  )
                                }
                                disabled={dropMutation.isPending}
                                className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition disabled:opacity-50 cursor-pointer"
                                title="Drop course"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ProgressiveLoadFooter
              loadedCount={visibleMyRegsCount}
              totalCount={totalMyRegsCount}
              isLoadingMore={hasMoreMyRegs}
              hasMore={hasMoreMyRegs}
              entityLabel="registered courses"
            />
          </div>
        )}
      </div>
    </div>
  );
}
