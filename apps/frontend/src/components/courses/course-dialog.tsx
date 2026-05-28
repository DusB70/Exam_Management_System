'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';

const CourseFormSchema = z.object({
  courseCode: z
    .string()
    .min(1, 'Course code is required')
    .max(10, 'Course code must be 10 characters or less')
    .regex(/^[A-Z0-9-]+$/, 'Course code must only contain uppercase letters, numbers, and hyphens'),
  courseName: z.string().min(1, 'Course name is required'),
  creditValue: z.coerce
    .number()
    .min(0, 'Credit value must be at least 0')
    .max(10, 'Credit value cannot exceed 10'),
  departmentId: z.coerce.number().int().min(1, 'Department is required'),
  semester: z
    .string()
    .regex(
      /^(1\.1|1\.2|2\.1|2\.2|3\.1|3\.2|4\.1|4\.2)$/,
      'Semester must be format X.Y (1.1 to 4.2)',
    ),
  academicYear: z.coerce.number().int().min(2000, 'Academic year must be 2000 or later'),
  lecturerId: z.preprocess(
    (val) => (val === '' || val === undefined ? 0 : Number(val)),
    z.number().int().optional(),
  ),
});

type CourseFormInput = z.infer<typeof CourseFormSchema>;

interface CourseDialogProps {
  open: boolean;
  onClose: () => void;
  course: any; // Course object if editing
  onSuccess: () => void;
}

const fetchDepartments = async () => {
  const response = await apiClient.get('/departments');
  return response.data?.data || [];
};

export default function CourseDialog({ open, onClose, course, onSuccess }: CourseDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = !!course;

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    enabled: open,
  });

  const { data: lecturers = [] } = useQuery({
    queryKey: ['lecturers-lookup'],
    queryFn: async () => {
      const response = await apiClient.get('/lecturers');
      return response.data?.data || [];
    },
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CourseFormInput>({
    resolver: zodResolver(CourseFormSchema),
    defaultValues: {
      creditValue: 3,
      semester: '1.1',
      academicYear: new Date().getFullYear(),
      lecturerId: 0,
    },
  });

  useEffect(() => {
    if (course && open) {
      reset({
        courseCode: course.course_code,
        courseName: course.course_name,
        creditValue: parseFloat(course.credit_value),
        departmentId: course.department_id,
        semester: course.semester,
        academicYear: course.academic_year,
        lecturerId: course.lecturers?.[0]?.lecturer_id || 0,
      });
    } else if (open) {
      reset({
        courseCode: '',
        courseName: '',
        creditValue: 3,
        departmentId: departments[0]?.department_id || 1,
        semester: '1.1',
        academicYear: new Date().getFullYear(),
        lecturerId: 0,
      });
    }
  }, [course, open, reset, departments]);

  const onSubmit = async (data: CourseFormInput) => {
    setError(null);
    setIsSubmitting(true);

    try {
      if (isEdit) {
        await apiClient.put(`/courses/${course.course_id}`, data);
      } else {
        await apiClient.post('/courses', data);
      }
      onSuccess();
      onClose();
    } catch (err) {
      const axiosError = err as AxiosError<ApiResponse>;
      setError(axiosError.response?.data?.message || 'Action failed. Check logs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border/80 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
          <h3 className="text-xl font-bold">{isEdit ? 'Edit Course' : 'Create Course'}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Course Code
              </label>
              <input
                type="text"
                placeholder="e.g. CS-101"
                {...register('courseCode')}
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm uppercase"
              />
              {errors.courseCode && (
                <p className="mt-1 text-xs text-destructive">{errors.courseCode.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Credit Value
              </label>
              <input
                type="number"
                step="0.5"
                {...register('creditValue')}
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm"
              />
              {errors.creditValue && (
                <p className="mt-1 text-xs text-destructive">{errors.creditValue.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Course Name
              </label>
              <input
                type="text"
                placeholder="e.g. Introduction to Computer Science"
                {...register('courseName')}
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm"
              />
              {errors.courseName && (
                <p className="mt-1 text-xs text-destructive">{errors.courseName.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Department
              </label>
              <select
                {...register('departmentId')}
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
              >
                {departments.map((dept: any) => (
                  <option key={dept.department_id} value={dept.department_id} className="bg-card">
                    {dept.department_name} ({dept.department_code})
                  </option>
                ))}
              </select>
              {errors.departmentId && (
                <p className="mt-1 text-xs text-destructive">{errors.departmentId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Academic Year Offered
              </label>
              <input
                type="number"
                {...register('academicYear')}
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm"
              />
              {errors.academicYear && (
                <p className="mt-1 text-xs text-destructive">{errors.academicYear.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Semester Offered
              </label>
              <select
                {...register('semester')}
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
              >
                <option value="1.1">Semester 1.1</option>
                <option value="1.2">Semester 1.2</option>
                <option value="2.1">Semester 2.1</option>
                <option value="2.2">Semester 2.2</option>
                <option value="3.1">Semester 3.1</option>
                <option value="3.2">Semester 3.2</option>
                <option value="4.1">Semester 4.1</option>
                <option value="4.2">Semester 4.2</option>
              </select>
              {errors.semester && (
                <p className="mt-1 text-xs text-destructive">{errors.semester.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Assigned Lecturer (Optional)
              </label>
              <select
                {...register('lecturerId')}
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
              >
                <option value="0">Assign Later (None)</option>
                {lecturers.map((lec: any) => (
                  <option key={lec.lecturer_id} value={lec.lecturer_id}>
                    {lec.user?.full_name} ({lec.employee_number || 'No EMP ID'})
                  </option>
                ))}
              </select>
              {errors.lecturerId && (
                <p className="mt-1 text-xs text-destructive">{errors.lecturerId.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-secondary/90 transition text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : isEdit ? 'Update Course' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
