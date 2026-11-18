'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useToast } from '../../hooks/use-toast';
import { useConfirm } from '../../hooks/use-confirm';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';
import { Trash2, UserPlus, GraduationCap, Loader2, User } from 'lucide-react';
import { formatNameWithTitle } from '../../lib/nic-utils';
import SearchableLecturerSelect from '../ui/searchable-lecturer-select';

interface LecturerAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  courseId: number;
  courseCode: string;
  courseName: string;
}

export default function LecturerAssignmentDialog({
  open,
  onClose,
  courseId,
  courseCode,
  courseName,
}: LecturerAssignmentDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [lecturerType, setLecturerType] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>('');
  const [externalName, setExternalName] = useState<string>('');
  const [externalEmail, setExternalEmail] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch course details with assigned lecturers
  const {
    data: courseDetails,
    isLoading: isCourseLoading,
    refetch: refetchCourse,
  } = useQuery({
    queryKey: ['course-details', courseId],
    queryFn: async () => {
      const response = await apiClient.get(`/courses/${courseId}`);
      return response.data?.data;
    },
    enabled: open && !!courseId,
  });

  // Fetch all lecturers for dropdown
  const { data: allLecturers = [], isLoading: isLecturersLoading } = useQuery({
    queryKey: ['lecturers'],
    queryFn: async () => {
      const response = await apiClient.get('/lecturers');
      return response.data?.data || [];
    },
    enabled: open,
  });

  // Assign internal lecturer mutation
  const assignMutation = useMutation({
    mutationFn: async (lecturerId: number) => {
      await apiClient.post(`/courses/${courseId}/lecturers`, { lecturerId });
    },
    onSuccess: () => {
      setSelectedLecturerId('');
      setActionError(null);
      toast.success('Internal lecturer assigned to course module.');
      refetchCourse();
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['courses-allocation-list'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      const msg = err.response?.data?.message || 'Failed to assign lecturer';
      setActionError(msg);
      toast.error(msg);
    },
  });

  // Assign external lecturer mutation
  const assignExternalMutation = useMutation({
    mutationFn: async ({ name, email }: { name: string; email?: string }) => {
      await apiClient.post(`/courses/${courseId}/lecturers/external`, { name, email });
    },
    onSuccess: () => {
      setExternalName('');
      setExternalEmail('');
      setActionError(null);
      toast.success('Outside faculty lecturer assigned to course module.');
      refetchCourse();
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['courses-allocation-list'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      const msg = err.response?.data?.message || 'Failed to assign external lecturer';
      setActionError(msg);
      toast.error(msg);
    },
  });

  // Remove internal lecturer mutation
  const removeMutation = useMutation({
    mutationFn: async (lecturerId: number) => {
      await apiClient.delete(`/courses/${courseId}/lecturers/${lecturerId}`);
    },
    onSuccess: () => {
      setActionError(null);
      toast.success('Lecturer removed from course module.');
      refetchCourse();
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['courses-allocation-list'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      const msg = err.response?.data?.message || 'Failed to remove lecturer';
      setActionError(msg);
      toast.error(msg);
    },
  });

  // Remove external lecturer mutation
  const removeExternalMutation = useMutation({
    mutationFn: async (externalId: string) => {
      await apiClient.delete(`/courses/${courseId}/lecturers/external/${externalId}`);
    },
    onSuccess: () => {
      setActionError(null);
      toast.success('Outside lecturer removed from course module.');
      refetchCourse();
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['courses-allocation-list'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      const msg = err.response?.data?.message || 'Failed to remove external lecturer';
      setActionError(msg);
      toast.error(msg);
    },
  });

  if (!open) return null;

  const currentLecturers = courseDetails?.lecturers || [];
  const assignedIds = new Set(currentLecturers.map((cl: any) => cl.lecturer_id));
  const externalLecturers: any[] =
    courseDetails?.external_lecturers || courseDetails?.marks_config?.externalLecturers || [];

  // Filter out lecturers that are already assigned
  const assignableLecturers = allLecturers.filter((l: any) => !assignedIds.has(l.lecturer_id));

  // Group assignable lecturers by department
  const lecturersByDepartment: [string, any[]][] = (() => {
    const groups: Record<string, any[]> = {};
    for (const lec of assignableLecturers) {
      const deptName = lec.department?.department_name || 'Other / General Faculty';
      if (!groups[deptName]) groups[deptName] = [];
      groups[deptName].push(lec);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  })();

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (lecturerType === 'INTERNAL') {
      if (!selectedLecturerId) return;
      assignMutation.mutate(parseInt(selectedLecturerId, 10));
    } else {
      if (!externalName.trim()) {
        toast.error('Please enter the outside lecturer name.');
        return;
      }
      assignExternalMutation.mutate({
        name: externalName.trim(),
        email: externalEmail.trim() || undefined,
      });
    }
  };

  const isSubmitting = assignMutation.isPending || assignExternalMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm !m-0">
      <div className="bg-card border border-border/80 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-secondary/15">
          <div>
            <h3 className="text-lg font-bold text-foreground">Lecturer Assignments</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {courseCode} - {courseName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {actionError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl font-medium">
              {actionError}
            </div>
          )}

          {/* Assignment Form */}
          <form
            onSubmit={handleAssign}
            className="bg-secondary/15 p-4 rounded-2xl border border-border/40 space-y-3.5"
          >
            <div className="flex items-center justify-between pb-1">
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                Assign a Lecturer
              </label>
              <span className="text-[11px] text-muted-foreground">Select origin</span>
            </div>

            {/* Origin Radio Switch (Same layout as 2nd Marker allocation) */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="lecturerOrigin"
                  value="INTERNAL"
                  checked={lecturerType === 'INTERNAL'}
                  onChange={() => setLecturerType('INTERNAL')}
                  className="accent-primary"
                />
                Within the Faculty (Internal)
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="lecturerOrigin"
                  value="EXTERNAL"
                  checked={lecturerType === 'EXTERNAL'}
                  onChange={() => setLecturerType('EXTERNAL')}
                  className="accent-primary"
                />
                Outside the Faculty (External)
              </label>
            </div>

            {/* Internal Lecturer Searchable Selector */}
            {lecturerType === 'INTERNAL' ? (
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase">
                  Faculty Lecturer (Categorized by Department)
                </label>
                <SearchableLecturerSelect
                  value={selectedLecturerId}
                  onChange={(val) => setSelectedLecturerId(val)}
                  lecturersByDepartment={lecturersByDepartment}
                  placeholder="Search and select faculty lecturer..."
                  disabled={isLecturersLoading || isSubmitting}
                />
              </div>
            ) : (
              /* Outside Lecturer Name & Email Inputs */
              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                    Outside Lecturer Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Arthur Weerasinghe"
                    value={externalName}
                    onChange={(e) => setExternalName(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                    Outside Lecturer Email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. arthur@external-uni.lk"
                    value={externalEmail}
                    onChange={(e) => setExternalEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={
                  (lecturerType === 'INTERNAL' && !selectedLecturerId) ||
                  (lecturerType === 'EXTERNAL' && !externalName.trim()) ||
                  isSubmitting
                }
                className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Assign Lecturer
              </button>
            </div>
          </form>

          {/* Assigned Lecturers List */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Currently Assigned ({currentLecturers.length + externalLecturers.length})
            </h4>

            {isCourseLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : currentLecturers.length === 0 && externalLecturers.length === 0 ? (
              <div className="text-center py-8 bg-secondary/10 rounded-2xl border border-dashed border-border/80 flex flex-col items-center justify-center">
                <GraduationCap className="h-8 w-8 text-muted-foreground/55 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">
                  No lecturers assigned yet
                </p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  Use the selection above to assign teachers.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Internal Lecturers */}
                {currentLecturers.map((cl: any) => {
                  const displayName = formatNameWithTitle(
                    cl.lecturer?.user?.full_name,
                    cl.lecturer?.user?.nic_no,
                  );
                  return (
                    <div
                      key={cl.lecturer_id}
                      className="flex items-center justify-between p-3.5 bg-card/60 border border-border/60 hover:border-border hover:bg-secondary/15 rounded-xl transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-primary/10 text-primary rounded-xl">
                          <GraduationCap className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate text-foreground leading-snug">
                            {displayName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate leading-none mt-1">
                            Emp ID: {cl.lecturer?.employee_number || '—'} |{' '}
                            {cl.lecturer?.department?.department_code || 'Faculty'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          const confirmed = await confirm({
                            title: 'Remove Assigned Lecturer?',
                            message: `Are you sure you want to remove ${displayName} from ${courseCode}?`,
                            confirmText: 'Remove Lecturer',
                            variant: 'destructive',
                          });
                          if (confirmed) {
                            removeMutation.mutate(cl.lecturer_id);
                          }
                        }}
                        disabled={removeMutation.isPending}
                        className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition disabled:opacity-50 shrink-0 cursor-pointer"
                        title="Remove assignment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}

                {/* External Lecturers */}
                {externalLecturers.map((el: any) => (
                  <div
                    key={el.id}
                    className="flex items-center justify-between p-3.5 bg-card/60 border border-border/60 hover:border-border hover:bg-secondary/15 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold truncate text-foreground leading-snug">
                            {el.name}
                          </p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            Outside Faculty
                          </span>
                        </div>
                        {el.email && (
                          <p className="text-xs text-muted-foreground truncate leading-none mt-1">
                            {el.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        const confirmed = await confirm({
                          title: 'Remove Outside Lecturer?',
                          message: `Are you sure you want to remove ${el.name} from ${courseCode}?`,
                          confirmText: 'Remove Lecturer',
                          variant: 'destructive',
                        });
                        if (confirmed) {
                          removeExternalMutation.mutate(el.id);
                        }
                      }}
                      disabled={removeExternalMutation.isPending}
                      className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition disabled:opacity-50 shrink-0 cursor-pointer"
                      title="Remove outside lecturer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
