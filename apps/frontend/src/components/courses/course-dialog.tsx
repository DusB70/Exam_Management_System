'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useToast } from '../../hooks/use-toast';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';
import { GraduationCap } from 'lucide-react';

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
  semester: z
    .string()
    .regex(
      /^(1\.1|1\.2|2\.1|2\.2|3\.1|3\.2|4\.1|4\.2)$/,
      'Semester must be format X.Y (1.1 to 4.2)',
    ),
});

type CourseFormInput = z.infer<typeof CourseFormSchema>;

interface CourseDialogProps {
  open: boolean;
  onClose: () => void;
  course: any; // Course object if editing
  onSuccess: () => void;
}

export default function CourseDialog({ open, onClose, course, onSuccess }: CourseDialogProps) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | string>('');
  const [selectedDegrees, setSelectedDegrees] = useState<{ degreeId: number; status: string }[]>(
    [],
  );
  const [selectedSpecializations, setSelectedSpecializations] = useState<
    { specializationId: number; status: string; degreeId: number }[]
  >([]);
  const isEdit = !!course;

  const isSpecializationEligibleSemester = (sem: string) => {
    if (!sem) return false;
    return sem !== '1.1' && sem !== '1.2';
  };

  const { data: departments = [] } = useQuery({
    queryKey: ['departments-lookup'],
    queryFn: async () => {
      const response = await apiClient.get('/departments');
      return response.data?.data || [];
    },
    enabled: open,
  });

  const { data: degrees = [] } = useQuery({
    queryKey: ['degrees-lookup'],
    queryFn: async () => {
      const response = await apiClient.get('/degrees');
      return response.data?.data || [];
    },
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CourseFormInput>({
    resolver: zodResolver(CourseFormSchema),
    defaultValues: {
      creditValue: 3,
      semester: '1.1',
    },
  });

  const selectedSemester = watch('semester');

  // Clear specializations if semester is changed to 1.1 or 1.2
  useEffect(() => {
    if (!isSpecializationEligibleSemester(selectedSemester)) {
      if (selectedSpecializations.length > 0) {
        setSelectedSpecializations([]);
      }
    }
  }, [selectedSemester, selectedSpecializations.length]);

  useEffect(() => {
    if (course && open) {
      reset({
        courseCode: course.course_code,
        courseName: course.course_name,
        creditValue: parseFloat(course.credit_value),
        semester: course.semester,
      });
      setSelectedDepartmentId(course.department_id || '');
      setSelectedDegrees(
        course.degrees?.map((cd: any) => ({
          degreeId: cd.degree_id,
          status: cd.status,
        })) || [],
      );

      // Populate specializations if any
      if (course.course_specializations && course.course_specializations.length > 0) {
        setSelectedSpecializations(
          course.course_specializations.map((cs: any) => ({
            specializationId: cs.specialization_id,
            status: cs.status,
            degreeId: cs.specialization?.degree_id,
          })),
        );
      } else if (course.specialization_id) {
        setSelectedSpecializations([
          {
            specializationId: course.specialization_id,
            status: 'COMPULSORY',
            degreeId: course.specialization?.degree_id,
          },
        ]);
      } else {
        setSelectedSpecializations([]);
      }
    } else if (open) {
      reset({
        courseCode: '',
        courseName: '',
        creditValue: 3,
        semester: '1.1',
      });
      setSelectedDegrees([]);
      setSelectedSpecializations([]);
      if (departments.length > 0) {
        setSelectedDepartmentId(departments[0].department_id);
      } else {
        setSelectedDepartmentId('');
      }
    }
  }, [course, open, reset, departments]);

  const handleDepartmentChange = (deptId: string) => {
    setSelectedDepartmentId(deptId);
  };

  const handleDegreeCheckboxChange = (degreeId: number, checked: boolean) => {
    if (checked) {
      setSelectedDegrees((prev) => [...prev, { degreeId, status: 'COMPULSORY' }]);
    } else {
      setSelectedDegrees((prev) => prev.filter((d) => d.degreeId !== degreeId));
    }
  };

  const handleDegreeStatusChange = (degreeId: number, status: string) => {
    setSelectedDegrees((prev) => prev.map((d) => (d.degreeId === degreeId ? { ...d, status } : d)));
  };

  const handleSpecializationToggle = (
    specializationId: number,
    degreeId: number,
    checked: boolean,
  ) => {
    if (checked) {
      setSelectedSpecializations((prev) => [
        ...prev.filter((s) => s.specializationId !== specializationId),
        { specializationId, status: 'COMPULSORY', degreeId },
      ]);
      setSelectedDegrees((prev) => {
        if (!prev.some((d) => d.degreeId === degreeId)) {
          return [...prev, { degreeId, status: 'COMPULSORY' }];
        }
        return prev;
      });
    } else {
      setSelectedSpecializations((prev) => {
        const next = prev.filter((s) => s.specializationId !== specializationId);
        const remainingForDegree = next.filter((s) => s.degreeId === degreeId);
        if (remainingForDegree.length === 0) {
          setSelectedDegrees((prevDegs) => prevDegs.filter((d) => d.degreeId !== degreeId));
        }
        return next;
      });
    }
  };

  const handleSpecializationStatusChange = (specializationId: number, status: string) => {
    setSelectedSpecializations((prev) =>
      prev.map((s) => (s.specializationId === specializationId ? { ...s, status } : s)),
    );
  };

  const onSubmit = async (data: CourseFormInput) => {
    setError(null);
    if (!selectedDepartmentId) {
      const msg = 'Offering department is required.';
      setError(msg);
      toast.error(msg);
      return;
    }

    const isSpecializationActive = isSpecializationEligibleSemester(data.semester);

    // Make sure all degrees that have selected specializations are included in degrees payload
    const effectiveDegrees = [...selectedDegrees];
    if (isSpecializationActive) {
      for (const spec of selectedSpecializations) {
        const parentDegree = degrees.find((d: any) =>
          d.specializations?.some((s: any) => s.specialization_id === spec.specializationId),
        );
        if (parentDegree && !effectiveDegrees.some((d) => d.degreeId === parentDegree.degree_id)) {
          effectiveDegrees.push({
            degreeId: parentDegree.degree_id,
            status: spec.status,
          });
        }
      }
    }

    if (
      effectiveDegrees.length === 0 &&
      (!isSpecializationActive || selectedSpecializations.length === 0)
    ) {
      const msg = 'At least one applicable degree program or specialization must be selected.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);

    const payload = {
      ...data,
      departmentId: Number(selectedDepartmentId),
      degrees: effectiveDegrees,
      specializationId:
        isSpecializationActive && selectedSpecializations.length > 0
          ? selectedSpecializations[0].specializationId
          : null,
      specializations: isSpecializationActive
        ? selectedSpecializations.map((s) => ({
            specializationId: s.specializationId,
            status: s.status,
          }))
        : [],
    };

    try {
      if (isEdit) {
        await apiClient.put(`/courses/${course.course_id}`, payload);
      } else {
        await apiClient.post('/courses', payload);
      }
      toast.success(
        isEdit ? 'Course module updated successfully!' : 'Course module created successfully!',
      );
      onSuccess();
      onClose();
    } catch (err) {
      const axiosError = err as AxiosError<ApiResponse>;
      const msg = axiosError.response?.data?.message || 'Action failed. Check logs.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm !m-0">
      <div className="bg-card border border-border/80 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
          <h3 className="text-xl font-bold">{isEdit ? 'Edit Course' : 'Create Course'}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
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
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm uppercase font-mono"
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
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm font-mono"
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

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Semester Offered
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
                Offering Department
              </label>
              <select
                value={selectedDepartmentId}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground cursor-pointer"
              >
                <option value="">Select Offering Department</option>
                {departments.map((dept: any) => (
                  <option key={dept.department_id} value={dept.department_id}>
                    {dept.department_name} ({dept.department_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="block text-xs font-semibold text-muted-foreground">
                Applicable Degree Programs & Specializations
              </label>
              {degrees.length === 0 ? (
                <p className="text-xs text-muted-foreground italic bg-secondary/15 p-3.5 rounded-xl border border-border/60">
                  No degree programs defined.
                </p>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {degrees.map((deg: any) => {
                    const isDegreeChecked = selectedDegrees.some(
                      (sd) => sd.degreeId === deg.degree_id,
                    );
                    const currentDegreeStatus =
                      selectedDegrees.find((sd) => sd.degreeId === deg.degree_id)?.status ||
                      'COMPULSORY';
                    const hasSpecializations =
                      Array.isArray(deg.specializations) && deg.specializations.length > 0;
                    const showSpecializationsView =
                      hasSpecializations && isSpecializationEligibleSemester(selectedSemester);

                    if (showSpecializationsView) {
                      const anySpecSelected = deg.specializations.some((s: any) =>
                        selectedSpecializations.some(
                          (ss) => ss.specializationId === s.specialization_id,
                        ),
                      );

                      return (
                        <div
                          key={deg.degree_id}
                          className={`p-4 rounded-2xl border transition-all duration-300 space-y-3.5 ${
                            anySpecSelected
                              ? 'bg-primary/5 border-primary/45 shadow-sm shadow-primary/5'
                              : 'bg-secondary/10 border-border/40 hover:border-border/60 hover:bg-secondary/15'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                                <GraduationCap className="h-4 w-4" />
                              </div>
                              <div>
                                <h4 className="font-bold text-sm text-foreground">
                                  {deg.degree_name} ({deg.degree_code})
                                </h4>
                                <p className="text-[11px] text-muted-foreground">
                                  Select applicable specializations and individual status
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border/60 self-start sm:self-auto">
                              {deg.specializations.length} Specializations
                            </span>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-border/40">
                            {deg.specializations.map((spec: any) => {
                              const isSpecChecked = selectedSpecializations.some(
                                (s) => s.specializationId === spec.specialization_id,
                              );
                              const specStatus =
                                selectedSpecializations.find(
                                  (s) => s.specializationId === spec.specialization_id,
                                )?.status || 'COMPULSORY';

                              return (
                                <div
                                  key={spec.specialization_id}
                                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border transition-all gap-3 ${
                                    isSpecChecked
                                      ? 'bg-card border-primary/40 shadow-xs'
                                      : 'bg-secondary/20 border-border/40 hover:border-border/60'
                                  }`}
                                >
                                  <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-foreground select-none flex-1 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isSpecChecked}
                                      onChange={(e) =>
                                        handleSpecializationToggle(
                                          spec.specialization_id,
                                          deg.degree_id,
                                          e.target.checked,
                                        )
                                      }
                                      className="h-4.5 w-4.5 rounded-md border-border/80 text-primary focus:ring-primary/60 bg-secondary/30 transition-transform active:scale-95 cursor-pointer"
                                    />
                                    <span className="truncate">
                                      {spec.specialization_name} ({spec.specialization_code})
                                    </span>
                                  </label>

                                  {isSpecChecked && (
                                    <div className="flex bg-secondary/50 p-1 rounded-xl border border-border/60 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSpecializationStatusChange(
                                            spec.specialization_id,
                                            'COMPULSORY',
                                          )
                                        }
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                          specStatus === 'COMPULSORY'
                                            ? 'bg-card text-foreground shadow-sm border border-border/40 font-extrabold'
                                            : 'text-muted-foreground hover:text-foreground border border-transparent'
                                        }`}
                                      >
                                        Compulsory
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSpecializationStatusChange(
                                            spec.specialization_id,
                                            'OPTIONAL',
                                          )
                                        }
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                          specStatus === 'OPTIONAL'
                                            ? 'bg-card text-foreground shadow-sm border border-border/40 font-extrabold'
                                            : 'text-muted-foreground hover:text-foreground border border-transparent'
                                        }`}
                                      >
                                        Optional
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={deg.degree_id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border transition-all duration-300 gap-3 ${
                          isDegreeChecked
                            ? 'bg-primary/5 border-primary/45 shadow-sm shadow-primary/5'
                            : 'bg-secondary/10 border-border/40 hover:border-border/60 hover:bg-secondary/15'
                        }`}
                      >
                        <label className="flex items-center gap-3 cursor-pointer text-sm font-semibold text-foreground select-none flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isDegreeChecked}
                            onChange={(e) =>
                              handleDegreeCheckboxChange(deg.degree_id, e.target.checked)
                            }
                            className="h-5 w-5 rounded-lg border-border/80 text-primary focus:ring-primary/60 bg-secondary/30 transition-transform active:scale-95"
                          />
                          <span className="truncate pr-2">
                            {deg.degree_name} ({deg.degree_code})
                          </span>
                        </label>
                        {isDegreeChecked && (
                          <div className="flex bg-secondary/50 p-1 rounded-xl border border-border/60 w-full sm:w-auto shrink-0 transition-all">
                            <button
                              type="button"
                              onClick={() => handleDegreeStatusChange(deg.degree_id, 'COMPULSORY')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                                currentDegreeStatus === 'COMPULSORY'
                                  ? 'bg-card text-foreground shadow-sm border border-border/40 font-extrabold'
                                  : 'text-muted-foreground hover:text-foreground border border-transparent'
                              }`}
                            >
                              Compulsory
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDegreeStatusChange(deg.degree_id, 'OPTIONAL')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                                currentDegreeStatus === 'OPTIONAL'
                                  ? 'bg-card text-foreground shadow-sm border border-border/40 font-extrabold'
                                  : 'text-muted-foreground hover:text-foreground border border-transparent'
                              }`}
                            >
                              Optional
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-secondary/90 transition text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-sm disabled:opacity-50 cursor-pointer shadow-lg shadow-primary/20"
            >
              {isSubmitting ? 'Processing...' : isEdit ? 'Update Course' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
