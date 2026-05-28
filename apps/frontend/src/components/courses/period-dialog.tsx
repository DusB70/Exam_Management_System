'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '../../lib/api-client';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';

const PeriodFormSchema = z
  .object({
    academicYear: z.coerce.number().int().min(2000, 'Academic year must be 2000 or later'),
    semester: z
      .string()
      .regex(
        /^(1\.1|1\.2|2\.1|2\.2|3\.1|3\.2|4\.1|4\.2)$/,
        'Semester must be in format X.Y (1.1 to 4.2)',
      ),
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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PeriodFormInput>({
    resolver: zodResolver(PeriodFormSchema),
    defaultValues: {
      academicYear: new Date().getFullYear(),
      semester: '1.1',
      status: 'CLOSED',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days later
    },
  });

  const onSubmit = async (data: PeriodFormInput) => {
    setError(null);
    setIsSubmitting(true);

    try {
      // Map to ISOString dates
      const payload = {
        ...data,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
      };
      const response = await apiClient.post('/courses/periods', payload);
      onSuccess(response.data?.data);
      reset();
    } catch (err) {
      const axiosError = err as AxiosError<ApiResponse>;
      setError(axiosError.response?.data?.message || 'Failed to open registration window.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border/80 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
          <h3 className="text-lg font-bold">New Registration Period</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground"
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
              Academic Year
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
              Semester
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                {...register('startDate')}
                className="w-full px-3 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm"
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
                className="w-full px-3 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm"
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
              className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
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
              className="px-5 py-2 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-secondary/90 transition text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Opening...' : 'Create Window'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
