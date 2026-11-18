'use client';

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useToast } from '../../hooks/use-toast';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';

const DEFAULT_ACADEMIC_YEARS = [
  '19/20',
  '20/21',
  '21/22',
  '22/23',
  '23/24',
  '24/25',
  '25/26',
  '26/27',
  '27/28',
];

const PeriodFormSchema = z
  .object({
    academicYear: z.string().min(1, 'Please select an academic year'),
    semester: z
      .string()
      .regex(
        /^(1\.1|1\.2|2\.1|2\.2|3\.1|3\.2|4\.1|4\.2)$/,
        'Semester must be in format X.Y (1.1 to 4.2)',
      ),
    windowType: z
      .enum(['SEMESTER_REGISTRATION', 'MEDICAL_REPEAT_REGISTRATION'])
      .default('SEMESTER_REGISTRATION'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    status: z.enum(['OPEN', 'CLOSED', 'SUSPENDED']).default('CLOSED'),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (start >= end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Start date must be strictly before end date',
        path: ['endDate'],
      });
    }
  });

type PeriodFormInput = z.infer<typeof PeriodFormSchema>;

interface PeriodDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (newPeriod: any) => void;
}

export default function PeriodDialog({ open, onClose, onSuccess }: PeriodDialogProps) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch existing periods to include any existing batches in dropdown options
  const { data: existingPeriods = [] } = useQuery({
    queryKey: ['registration-periods-for-dialog'],
    queryFn: async () => {
      const response = await apiClient.get('/courses/periods');
      return response.data?.data || [];
    },
    enabled: open,
  });

  const academicYearOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_ACADEMIC_YEARS);
    existingPeriods.forEach((p: any) => {
      if (p.batch && typeof p.batch === 'string') {
        set.add(p.batch.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [existingPeriods]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PeriodFormInput>({
    resolver: zodResolver(PeriodFormSchema),
    defaultValues: {
      academicYear: '21/22',
      semester: '1.1',
      windowType: 'SEMESTER_REGISTRATION',
      status: 'CLOSED',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days later
    },
  });

  const onSubmit = async (data: PeriodFormInput) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const match = data.academicYear.match(/^(\d{2,4})[/-](\d{2,4})$/);
      const numericYear = match
        ? match[1].length === 2
          ? 2000 + parseInt(match[1], 10)
          : parseInt(match[1], 10)
        : new Date().getFullYear();

      // Map to ISOString dates
      const payload = {
        academicYear: numericYear,
        batch: data.academicYear,
        semester: data.semester,
        windowType: data.windowType,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        status: data.status,
      };

      const response = await apiClient.post('/courses/periods', payload);
      toast.success('Course registration window opened successfully!');
      onSuccess(response.data?.data);
      reset();
    } catch (err) {
      const axiosError = err as AxiosError<ApiResponse>;
      const msg = axiosError.response?.data?.message || 'Failed to open registration window.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm !m-0">
      <div className="bg-card border border-border/80 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
          <h3 className="text-lg font-bold">New Registration Period</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Academic Year (e.g. 21/22)
            </label>
            <select
              {...register('academicYear')}
              className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground font-semibold cursor-pointer"
            >
              {academicYearOptions.map((ay) => (
                <option key={ay} value={ay} className="bg-card">
                  {ay}
                </option>
              ))}
            </select>
            {errors.academicYear && (
              <p className="mt-1 text-xs text-destructive">{errors.academicYear.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Semester
            </label>
            <select
              {...register('semester')}
              className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground cursor-pointer"
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

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Registration Window Type
            </label>
            <select
              {...register('windowType')}
              className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground cursor-pointer"
            >
              <option value="SEMESTER_REGISTRATION">Semester Course Registration</option>
              <option value="MEDICAL_REPEAT_REGISTRATION">
                Medical / Repeat Exam Registration
              </option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                {...register('startDate')}
                className="w-full px-3 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
              />
              {errors.startDate && (
                <p className="mt-1 text-xs text-destructive">{errors.startDate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                End Date
              </label>
              <input
                type="date"
                {...register('endDate')}
                className="w-full px-3 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
              />
              {errors.endDate && (
                <p className="mt-1 text-xs text-destructive">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Initial Status
            </label>
            <select
              {...register('status')}
              className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground cursor-pointer"
            >
              <option value="CLOSED" className="bg-card">
                CLOSED
              </option>
              <option value="OPEN" className="bg-card">
                OPEN
              </option>
              <option value="SUSPENDED" className="bg-card">
                SUSPENDED
              </option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-secondary/90 transition text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-sm disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Opening...' : 'Create Window'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
