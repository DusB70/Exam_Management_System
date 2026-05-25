'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';
import { Trash2, UserPlus, GraduationCap, Loader2 } from 'lucide-react';

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
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>('');
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

  // Assign lecturer mutation
  const assignMutation = useMutation({
    mutationFn: async (lecturerId: number) => {
      await apiClient.post(`/courses/${courseId}/lecturers`, { lecturerId });
    },
    onSuccess: () => {
      setSelectedLecturerId('');
      setActionError(null);
      refetchCourse();
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setActionError(err.response?.data?.message || 'Failed to assign lecturer');
    },
  });

  // Remove lecturer mutation
  const removeMutation = useMutation({
    mutationFn: async (lecturerId: number) => {
      await apiClient.delete(`/courses/${courseId}/lecturers/${lecturerId}`);
    },
    onSuccess: () => {
      setActionError(null);
      refetchCourse();
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setActionError(err.response?.data?.message || 'Failed to remove lecturer');
    },
  });

  if (!open) return null;

  const currentLecturers = courseDetails?.lecturers || [];
  const assignedIds = new Set(currentLecturers.map((cl: any) => cl.lecturer_id));

  // Filter out lecturers that are already assigned
  const assignableLecturers = allLecturers.filter((l: any) => !assignedIds.has(l.lecturer_id));

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLecturerId) return;
    assignMutation.mutate(parseInt(selectedLecturerId, 10));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border/80 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">Lecturer Assignments</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {courseCode} - {courseName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground"
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
            className="flex items-end gap-3 bg-secondary/15 p-4 rounded-2xl border border-border/40"
          >
            <div className="flex-1">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Assign a Lecturer
              </label>
              <select
                value={selectedLecturerId}
                onChange={(e) => setSelectedLecturerId(e.target.value)}
                disabled={isLecturersLoading || assignMutation.isPending}
                className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground disabled:opacity-50"
              >
                <option value="">Choose lecturer...</option>
                {assignableLecturers.map((l: any) => (
                  <option key={l.lecturer_id} value={l.lecturer_id} className="bg-card">
                    {l.user?.full_name} ({l.employee_number})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={!selectedLecturerId || assignMutation.isPending}
              className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-sm flex items-center gap-2 disabled:opacity-50 shrink-0"
            >
              {assignMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Assign
            </button>
          </form>

          {/* Assigned Lecturers List */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Currently Assigned ({currentLecturers.length})
            </h4>

            {isCourseLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : currentLecturers.length === 0 ? (
              <div className="text-center py-8 bg-secondary/10 rounded-2xl border border-dashed border-border/80 flex flex-col items-center justify-center">
                <GraduationCap className="h-8 w-8 text-muted-foreground/55 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">
                  No lecturers assigned yet
                </p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  Use the selection above to add teachers.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {currentLecturers.map((cl: any) => (
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
                          {cl.lecturer?.user?.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate leading-none mt-1">
                          Emp ID: {cl.lecturer?.employee_number}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(cl.lecturer_id)}
                      disabled={removeMutation.isPending}
                      className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition disabled:opacity-50 shrink-0"
                      title="Remove assignment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/60 flex items-center justify-end bg-secondary/5">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-secondary/90 transition text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
