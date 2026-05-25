'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';

const StudentProfileSchema = z.object({
  registrationNumber: z.string().min(1, 'Registration number is required'),
  departmentId: z.coerce.number().int().min(1, 'Department is required'),
  academicYear: z.coerce.number().int().min(2000, 'Academic year must be 2000 or later'),
  semester: z.coerce.number().int().min(1).max(8, 'Semester must be between 1 and 8'),
  dateOfBirth: z.string().optional().or(z.literal('')),
  phoneNumber: z.string().optional().or(z.literal('')),
});

const LecturerProfileSchema = z.object({
  employeeNumber: z.string().min(1, 'Employee number is required'),
  departmentId: z.coerce.number().int().min(1, 'Department is required'),
  specialization: z.string().optional().or(z.literal('')),
  phoneNumber: z.string().optional().or(z.literal('')),
});

const UserFormSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    fullName: z.string().min(1, 'Full name is required'),
    password: z.string().optional(),
    roleId: z.coerce.number().int().min(1, 'Role is required'),
    isActive: z.boolean().default(true),
    studentProfile: StudentProfileSchema.optional(),
    lecturerProfile: LecturerProfileSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.roleId === 4 && !data.studentProfile?.registrationNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Student profile details are required',
        path: ['studentProfile', 'registrationNumber'],
      });
    }
    if (data.roleId === 3 && !data.lecturerProfile?.employeeNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Lecturer profile details are required',
        path: ['lecturerProfile', 'employeeNumber'],
      });
    }
  });

type UserFormInput = z.infer<typeof UserFormSchema>;

interface UserDialogProps {
  open: boolean;
  onClose: () => void;
  user: any; // User object if editing
  onSuccess: () => void;
}

const fetchDepartments = async () => {
  const response = await apiClient.get('/departments');
  return response.data?.data || [];
};

export default function UserDialog({ open, onClose, user, onSuccess }: UserDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = !!user;

  // Retrieve departments list
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<UserFormInput>({
    resolver: zodResolver(UserFormSchema),
    defaultValues: {
      isActive: true,
      roleId: 4, // Default to Student
    },
  });

  const selectedRoleId = watch('roleId');

  // Pre-fill form if editing
  useEffect(() => {
    if (user && open) {
      reset({
        email: user.email,
        fullName: user.full_name,
        roleId: user.role_id,
        isActive: user.is_active,
        password: '', // Keep empty unless updating
        studentProfile: user.student
          ? {
              registrationNumber: user.student.registration_number,
              departmentId: user.student.department_id,
              academicYear: user.student.academic_year,
              semester: user.student.semester,
              dateOfBirth: user.student.date_of_birth
                ? new Date(user.student.date_of_birth).toISOString().split('T')[0]
                : '',
              phoneNumber: user.student.phone_number || '',
            }
          : undefined,
        lecturerProfile: user.lecturer
          ? {
              employeeNumber: user.lecturer.employee_number,
              departmentId: user.lecturer.department_id,
              specialization: user.lecturer.specialization || '',
              phoneNumber: user.lecturer.phone_number || '',
            }
          : undefined,
      });
    } else if (open) {
      reset({
        email: '',
        fullName: '',
        roleId: 4,
        isActive: true,
        password: '',
        studentProfile: {
          registrationNumber: '',
          departmentId: 1,
          academicYear: new Date().getFullYear(),
          semester: 1,
          dateOfBirth: '',
          phoneNumber: '',
        },
        lecturerProfile: {
          employeeNumber: '',
          departmentId: 1,
          specialization: '',
          phoneNumber: '',
        },
      });
    }
  }, [user, open, reset]);

  const onSubmit = async (data: UserFormInput) => {
    setError(null);
    setIsSubmitting(true);

    // Format optional password out if it is empty during update
    const payload: any = { ...data };
    if (isEdit && !payload.password) {
      delete payload.password;
    }

    // Clean payload of unused profile objects to prevent validation failure on server
    if (data.roleId !== 4) delete payload.studentProfile;
    if (data.roleId !== 3) delete payload.lecturerProfile;

    try {
      if (isEdit) {
        await apiClient.put(`/users/${user.user_id}`, payload);
      } else {
        if (!payload.password) {
          setError('Password is required for new users');
          setIsSubmitting(false);
          return;
        }
        await apiClient.post('/users', payload);
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
      <div className="bg-card border border-border/80 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
          <h3 className="text-xl font-bold">{isEdit ? 'Modify Profile' : 'Register User'}</h3>
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

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                {...register('fullName')}
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm"
              />
              {errors.fullName && (
                <p className="mt-1 text-xs text-destructive">{errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                {...register('email')}
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Password {isEdit && '(Leave blank to retain current)'}
              </label>
              <input
                type="password"
                placeholder={isEdit ? '••••••••' : 'Password (min 6)'}
                {...register('password')}
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Access Level (Role)
              </label>
              <select
                {...register('roleId')}
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
              >
                <option value={4} className="bg-card">
                  Student
                </option>
                <option value={3} className="bg-card">
                  Lecturer
                </option>
                <option value={2} className="bg-card">
                  Exam Division Staff
                </option>
                <option value={1} className="bg-card">
                  Administrator
                </option>
              </select>
            </div>
          </div>

          {/* Conditional Profile Fields */}
          {selectedRoleId === 4 && (
            <div className="border-t border-border/60 pt-6 space-y-4">
              <h4 className="text-sm font-bold text-primary mb-2">Student Profile Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    {...register('studentProfile.registrationNumber')}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm"
                  />
                  {errors.studentProfile?.registrationNumber && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.studentProfile.registrationNumber.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Department
                  </label>
                  <select
                    {...register('studentProfile.departmentId')}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                  >
                    {departments.map((dept: any) => (
                      <option
                        key={dept.department_id}
                        value={dept.department_id}
                        className="bg-card"
                      >
                        {dept.department_name} ({dept.department_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Academic Enrollment Year
                  </label>
                  <input
                    type="number"
                    {...register('studentProfile.academicYear')}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Active Semester (1 to 8)
                  </label>
                  <input
                    type="number"
                    {...register('studentProfile.semester')}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    {...register('studentProfile.dateOfBirth')}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Contact Phone Number
                  </label>
                  <input
                    type="text"
                    {...register('studentProfile.phoneNumber')}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedRoleId === 3 && (
            <div className="border-t border-border/60 pt-6 space-y-4">
              <h4 className="text-sm font-bold text-primary mb-2">Lecturer Profile Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Employee Number
                  </label>
                  <input
                    type="text"
                    {...register('lecturerProfile.employeeNumber')}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm"
                  />
                  {errors.lecturerProfile?.employeeNumber && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.lecturerProfile.employeeNumber.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Department Assignment
                  </label>
                  <select
                    {...register('lecturerProfile.departmentId')}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                  >
                    {departments.map((dept: any) => (
                      <option
                        key={dept.department_id}
                        value={dept.department_id}
                        className="bg-card"
                      >
                        {dept.department_name} ({dept.department_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Specialization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Artificial Intelligence"
                    {...register('lecturerProfile.specialization')}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Contact Phone Number
                  </label>
                  <input
                    type="text"
                    {...register('lecturerProfile.phoneNumber')}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Active Status */}
          <div className="flex items-center gap-3 pt-4 border-t border-border/60">
            <input
              type="checkbox"
              id="isActive"
              {...register('isActive')}
              className="h-4.5 w-4.5 bg-secondary text-primary border-border focus:ring-primary focus:ring-2 rounded-md"
            />
            <label
              htmlFor="isActive"
              className="text-sm font-semibold text-muted-foreground select-none"
            >
              Account Active Status (Enabled)
            </label>
          </div>

          {/* Action Row */}
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
              {isSubmitting ? 'Processing...' : isEdit ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
