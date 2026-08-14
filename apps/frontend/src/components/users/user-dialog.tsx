'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';
import { GraduationCap, Shield, Users, BookOpen } from 'lucide-react';

const BaseUserFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(1, 'Full name is required'),
  nameWithInitials: z.string().min(1, 'Name with initials is required'),
  nicNo: z.string().min(1, 'NIC number is required'),
  dateOfBirth: z
    .string()
    .min(1, 'Birthday is required')
    .refine((val) => {
      if (!val) return false;
      const birthDate = new Date(val);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return birthDate <= today;
    }, 'Birthday cannot be in the future'),
  phoneNumber: z.string().min(1, 'Contact number is required'),
  address: z.string().min(1, 'Address is required'),
  password: z.string().optional(),
  roleId: z.coerce.number().int().min(1, 'Role is required'),
  isActive: z.boolean().default(true),
});

// Conditionally validate profiles using superRefine
const UserFormSchema = BaseUserFormSchema.extend({
  studentProfile: z
    .object({
      registrationNumber: z.string().optional().or(z.literal('')),
      indexNumber: z.string().optional().or(z.literal('')),
      degreeId: z.coerce.number().optional(),
      specializationId: z.coerce.number().optional().nullable().or(z.literal('')),
      academicYear: z.coerce.number().optional(),
    })
    .optional(),
  lecturerProfile: z
    .object({
      employeeNumber: z.string().optional().or(z.literal('')),
      departmentId: z.coerce.number().optional(),
      specialization: z.string().optional().or(z.literal('')),
      isHead: z.boolean().optional().default(false),
      isDean: z.boolean().optional().default(false),
    })
    .optional(),
}).superRefine((data, ctx) => {
  if (data.roleId === 4) {
    // Student
    const student = data.studentProfile;
    if (!student?.registrationNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studentProfile', 'registrationNumber'],
        message: 'Registration number is required',
      });
    }
    if (!student?.indexNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studentProfile', 'indexNumber'],
        message: 'Index number is required',
      });
    }
    if (!student?.degreeId || student.degreeId === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studentProfile', 'degreeId'],
        message: 'Degree is required',
      });
    }
    if (!student?.academicYear || student.academicYear < 2000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studentProfile', 'academicYear'],
        message: 'Academic year is required',
      });
    }
  } else if (data.roleId === 3) {
    // Lecturer
    const lecturer = data.lecturerProfile;
    if (!lecturer?.employeeNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lecturerProfile', 'employeeNumber'],
        message: 'Employee number is required',
      });
    }
    if (!lecturer?.departmentId || lecturer.departmentId === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lecturerProfile', 'departmentId'],
        message: 'Department is required',
      });
    }
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

const fetchDegrees = async () => {
  const response = await apiClient.get('/degrees');
  return response.data?.data || [];
};

export default function UserDialog({ open, onClose, user, onSuccess }: UserDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roleSelected, setRoleSelected] = useState(false);
  const isEdit = !!user;

  // Retrieve departments list
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    enabled: open,
  });

  // Retrieve degrees list
  const { data: degrees = [] } = useQuery({
    queryKey: ['degrees'],
    queryFn: fetchDegrees,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<UserFormInput>({
    resolver: zodResolver(UserFormSchema),
    defaultValues: {
      isActive: true,
      roleId: 4, // Default to Student
    },
  });

  const selectedRoleId = watch('roleId');
  const watchedNic = watch('nicNo');
  const selectedDegreeId = watch('studentProfile.degreeId');

  // Autofill password with NIC if it's create mode
  useEffect(() => {
    if (!isEdit && watchedNic) {
      setValue('password', watchedNic);
    }
  }, [watchedNic, isEdit, setValue]);

  // Pre-fill form if editing
  useEffect(() => {
    if (user && open) {
      setRoleSelected(true);
      reset({
        email: user.email,
        fullName: user.full_name,
        nameWithInitials: user.name_with_initials || '',
        nicNo: user.nic_no || '',
        dateOfBirth: user.date_of_birth
          ? new Date(user.date_of_birth).toISOString().split('T')[0]
          : '',
        phoneNumber: user.phone_number || '',
        address: user.address || '',
        roleId: user.role_id,
        isActive: user.is_active,
        password: '', // Keep empty unless updating
        studentProfile: user.student
          ? {
              registrationNumber: user.student.registration_number,
              indexNumber: user.student.index_number || '',
              degreeId: user.student.degree_id,
              specializationId: user.student.specialization_id || '',
              academicYear: user.student.academic_year,
            }
          : undefined,
        lecturerProfile: user.lecturer
          ? {
              employeeNumber: user.lecturer.employee_number,
              departmentId: user.lecturer.department_id,
              specialization: user.lecturer.specialization || '',
              isHead: user.lecturer.is_head || false,
              isDean: user.lecturer.is_dean || false,
            }
          : undefined,
      });
    } else if (open) {
      setRoleSelected(false);
      reset({
        email: '',
        fullName: '',
        nameWithInitials: '',
        nicNo: '',
        dateOfBirth: '',
        phoneNumber: '',
        address: '',
        roleId: 4,
        isActive: true,
        password: '',
        studentProfile: {
          registrationNumber: '',
          indexNumber: '',
          degreeId: 0,
          specializationId: '',
          academicYear: new Date().getFullYear(),
        },
        lecturerProfile: {
          employeeNumber: '',
          departmentId: 0,
          specialization: '',
          isHead: false,
          isDean: false,
        },
      });
    }
  }, [user, open, reset]);

  // Specializations filter
  const currentDegree = degrees.find((d: any) => d.degree_id === Number(selectedDegreeId));
  const availableSpecializations = currentDegree?.specializations || [];

  const onSubmit = async (data: UserFormInput) => {
    setError(null);
    setIsSubmitting(true);

    const payload: any = { ...data };
    if (isEdit && !payload.password) {
      delete payload.password;
    }

    // Clean payload of unused profile objects to prevent validation failure on server
    if (Number(data.roleId) !== 4) delete payload.studentProfile;
    if (Number(data.roleId) !== 3) delete payload.lecturerProfile;

    // Convert empty specialization to null
    if (payload.studentProfile && !payload.studentProfile.specializationId) {
      payload.studentProfile.specializationId = null;
    }

    try {
      if (isEdit) {
        await apiClient.put(`/users/${user.user_id}`, payload);
      } else {
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
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-secondary/5">
          <h3 className="text-xl font-bold">{isEdit ? 'Modify Profile' : 'Register User'}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition"
          >
            ✕
          </button>
        </div>

        {/* Step 1: Role Selection Screen */}
        {!isEdit && !roleSelected ? (
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            <div className="text-center max-w-md mx-auto space-y-2">
              <h4 className="text-lg font-bold">Select User Account Role</h4>
              <p className="text-sm text-muted-foreground">
                Before entering user profiles, choose the primary role level to instantiate
                appropriate validation workflows.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
              <button
                type="button"
                onClick={() => {
                  setValue('roleId', 4);
                  setRoleSelected(true);
                }}
                className="flex items-center gap-4 p-4 border border-border/80 rounded-2xl hover:border-primary hover:bg-primary/5 transition text-left"
              >
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-bold text-sm">Student</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enrolls in degrees and registers for courses
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setValue('roleId', 3);
                  setRoleSelected(true);
                }}
                className="flex items-center gap-4 p-4 border border-border/80 rounded-2xl hover:border-primary hover:bg-primary/5 transition text-left"
              >
                <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-bold text-sm">Lecturer</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Conducts exams and records marks
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setValue('roleId', 2);
                  setRoleSelected(true);
                }}
                className="flex items-center gap-4 p-4 border border-border/80 rounded-2xl hover:border-primary hover:bg-primary/5 transition text-left"
              >
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-bold text-sm">Division Staff</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Manages courses, exams, and results sheets
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setValue('roleId', 1);
                  setRoleSelected(true);
                }}
                className="flex items-center gap-4 p-4 border border-border/80 rounded-2xl hover:border-primary hover:bg-primary/5 transition text-left"
              >
                <div className="p-3 bg-red-500/10 text-red-400 rounded-xl">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-bold text-sm">Administrator</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Full root control and backups
                  </p>
                </div>
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Main Details Form */
          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl font-medium">
                {error}
              </div>
            )}

            {/* Back button when creating */}
            {!isEdit && (
              <button
                type="button"
                onClick={() => setRoleSelected(false)}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                ← Back to role selection
              </button>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-primary">Personal Details</h4>
                <span className="text-xs font-bold px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full">
                  Role:{' '}
                  {selectedRoleId === 1
                    ? 'Admin'
                    : selectedRoleId === 2
                      ? 'Staff'
                      : selectedRoleId === 3
                        ? 'Lecturer'
                        : 'Student'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Name with Initials
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. A.B.C. Perera"
                    {...register('nameWithInitials')}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                  />
                  {errors.nameWithInitials && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.nameWithInitials.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Amal Buddhika Perera"
                    {...register('fullName')}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
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
                    placeholder="e.g. amal.perera@university.com"
                    {...register('email')}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    NIC Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 199912345678 or 991234567V"
                    {...register('nicNo')}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                  />
                  {errors.nicNo && (
                    <p className="mt-1 text-xs text-destructive">{errors.nicNo.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Date of Birth (Birthday)
                  </label>
                  <input
                    type="date"
                    max={new Date().toISOString().split('T')[0]}
                    {...register('dateOfBirth')}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                  />
                  {errors.dateOfBirth && (
                    <p className="mt-1 text-xs text-destructive">{errors.dateOfBirth.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Contact Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0712345678"
                    {...register('phoneNumber')}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                  />
                  {errors.phoneNumber && (
                    <p className="mt-1 text-xs text-destructive">{errors.phoneNumber.message}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Residential Address
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter complete permanent residential address..."
                    {...register('address')}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground resize-none"
                  />
                  {errors.address && (
                    <p className="mt-1 text-xs text-destructive">{errors.address.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Conditional Profile Fields - Student */}
            {selectedRoleId === 4 && (
              <div className="border-t border-border/60 pt-6 space-y-4">
                <h4 className="text-sm font-bold text-primary">Student Academic Profile</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Registration Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. STU/2024/001"
                      {...register('studentProfile.registrationNumber')}
                      className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                    />
                    {errors.studentProfile?.registrationNumber && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.studentProfile.registrationNumber.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Index Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. IDX/2024/001"
                      {...register('studentProfile.indexNumber')}
                      className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                    />
                    {errors.studentProfile?.indexNumber && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.studentProfile.indexNumber.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Enrollment Academic Year
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 2024"
                      {...register('studentProfile.academicYear')}
                      className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                    />
                    {errors.studentProfile?.academicYear && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.studentProfile.academicYear.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Enrolled Degree
                    </label>
                    <select
                      {...register('studentProfile.degreeId')}
                      className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                    >
                      <option value={0}>Select Enrolled Degree...</option>
                      {degrees.map((deg: any) => (
                        <option key={deg.degree_id} value={deg.degree_id} className="bg-card">
                          {deg.degree_name} ({deg.degree_code})
                        </option>
                      ))}
                    </select>
                    {errors.studentProfile?.degreeId && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.studentProfile.degreeId.message}
                      </p>
                    )}
                  </div>

                  {Number(selectedDegreeId) > 0 && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                        Degree Specialization (Optional)
                      </label>
                      {availableSpecializations.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic bg-secondary/10 p-3 rounded-xl border border-border/40">
                          No specializations defined for this degree. (All students follow standard
                          core curriculum).
                        </p>
                      ) : (
                        <select
                          {...register('studentProfile.specializationId')}
                          className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                        >
                          <option value="">No Specialization / Common Year</option>
                          {availableSpecializations.map((spec: any) => (
                            <option
                              key={spec.specialization_id}
                              value={spec.specialization_id}
                              className="bg-card"
                            >
                              {spec.specialization_name} ({spec.specialization_code})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Conditional Profile Fields - Lecturer */}
            {selectedRoleId === 3 && (
              <div className="border-t border-border/60 pt-6 space-y-4">
                <h4 className="text-sm font-bold text-primary">Lecturer Academic Profile</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Employee Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. EMP-001"
                      {...register('lecturerProfile.employeeNumber')}
                      className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                    />
                    {errors.lecturerProfile?.employeeNumber && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.lecturerProfile.employeeNumber.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Assigned Department
                    </label>
                    <select
                      {...register('lecturerProfile.departmentId')}
                      className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                    >
                      <option value={0}>Select Assigned Department...</option>
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
                    {errors.lecturerProfile?.departmentId && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.lecturerProfile.departmentId.message}
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Areas of Research Specialization
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Distributed Databases, Machine Learning"
                      {...register('lecturerProfile.specialization')}
                      className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                    />
                  </div>

                  <div className="md:col-span-2 flex flex-wrap gap-6 pt-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isHead"
                        {...register('lecturerProfile.isHead')}
                        className="h-4.5 w-4.5 rounded border-border bg-secondary text-primary focus:ring-2 focus:ring-primary/60"
                      />
                      <label
                        htmlFor="isHead"
                        className="text-sm font-semibold text-muted-foreground select-none cursor-pointer"
                      >
                        Is Department Head
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isDean"
                        {...register('lecturerProfile.isDean')}
                        className="h-4.5 w-4.5 rounded border-border bg-secondary text-primary focus:ring-2 focus:ring-primary/60"
                      />
                      <label
                        htmlFor="isDean"
                        className="text-sm font-semibold text-muted-foreground select-none cursor-pointer"
                      >
                        Is Dean of Faculty
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Active Status Toggle */}
            <div className="flex items-center gap-3 pt-4 border-t border-border/60">
              <input
                type="checkbox"
                id="isActive"
                {...register('isActive')}
                className="h-4.5 w-4.5 rounded border-border bg-secondary text-primary focus:ring-2 focus:ring-primary/60"
              />
              <label
                htmlFor="isActive"
                className="text-sm font-semibold text-muted-foreground select-none cursor-pointer"
              >
                Account Active (Grant immediate system login access)
              </label>
            </div>

            {/* Bottom Button Actions */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-border/60">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition text-sm"
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
        )}
      </div>
    </div>
  );
}
