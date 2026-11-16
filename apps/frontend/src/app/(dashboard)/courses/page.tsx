'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import { useToast } from '../../../hooks/use-toast';
import { useConfirm } from '../../../hooks/use-confirm';
import { useBulkSelection, runBulkDelete } from '../../../hooks/use-bulk-selection';
import { BulkDeleteButton, SelectAllCheckbox } from '../../../components/ui/bulk-delete-button';
import {
  useProgressiveInfiniteQuery,
  useProgressiveList,
} from '../../../hooks/use-progressive-load';
import ProgressiveLoadFooter from '../../../components/ui/progressive-load-footer';
import CourseDialog from '../../../components/courses/course-dialog';
import CourseImportDialog from '../../../components/courses/course-import-dialog';
import LecturerAssignmentDialog from '../../../components/courses/lecturer-assignment-dialog';
import PeriodDialog from '../../../components/courses/period-dialog';
import MarkerDialog from '../../../components/courses/marker-dialog';
import UserDialog from '../../../components/users/user-dialog';
import {
  Search,
  BookOpen,
  Calendar,
  Plus,
  Play,
  Pause,
  StopCircle,
  Edit3,
  SquarePen,
  UserCheck,
  User,
  Check,
  Upload,
  X,
} from 'lucide-react';
import { UserRole } from '@ems/shared';

// Helper to fetch departments for courses filtering
const fetchDepartments = async () => {
  const response = await apiClient.get('/departments');
  return response.data?.data || [];
};

const renderCourseStatus = (course: any) => {
  const specs: any[] = course.course_specializations || [];
  const degs: any[] = course.degrees || [];

  // 1. Group status by degree and its specializations
  // Degree entries: { degreeCode, status }
  // Specialization entries: { specCode, status, degreeCode }
  const compulsoryItems: { label: string; sub?: string }[] = [];
  const optionalItems: { label: string; sub?: string }[] = [];

  const coveredSpecIds = new Set<number>();

  for (const d of degs) {
    const degCode = d.degree?.degree_code || String(d.degree_id);
    const matchingSpecs = specs.filter((cs: any) => cs.specialization?.degree_id === d.degree_id);

    if (matchingSpecs.length > 0) {
      for (const cs of matchingSpecs) {
        coveredSpecIds.add(cs.specialization_id);
        const specCode = cs.specialization?.specialization_code || String(cs.specialization_id);
        const item = { label: specCode, sub: degCode };
        if (cs.status === 'OPTIONAL') {
          optionalItems.push(item);
        } else {
          compulsoryItems.push(item);
        }
      }
    } else {
      const item = { label: degCode };
      if (d.status === 'OPTIONAL') {
        optionalItems.push(item);
      } else {
        compulsoryItems.push(item);
      }
    }
  }

  // Any remaining specs not covered by degrees list
  for (const cs of specs) {
    if (!coveredSpecIds.has(cs.specialization_id)) {
      const specCode = cs.specialization?.specialization_code || String(cs.specialization_id);
      const degCode = cs.specialization?.degree?.degree_code;
      const item = { label: specCode, sub: degCode };
      if (cs.status === 'OPTIONAL') {
        optionalItems.push(item);
      } else {
        compulsoryItems.push(item);
      }
    }
  }

  if (compulsoryItems.length === 0 && optionalItems.length === 0) {
    if (course.specialization) {
      return (
        <span
          title={`Specialization: ${course.specialization.specialization_name}`}
          className="inline-block px-2 py-0.5 bg-secondary text-secondary-foreground border border-border/60 rounded text-[10px] font-bold font-mono"
        >
          {course.specialization.specialization_code}
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground/60 italic">—</span>;
  }

  // If ALL items are COMPULSORY
  if (optionalItems.length === 0) {
    return (
      <div className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-primary/10 text-primary border-primary/30 shrink-0">
          Compulsory
        </span>
      </div>
    );
  }

  // If ALL items are OPTIONAL
  if (compulsoryItems.length === 0) {
    return (
      <div className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-amber-500/10 text-amber-500 border-amber-500/30 shrink-0">
          Optional
        </span>
      </div>
    );
  }

  // Mixed: some compulsory, some optional for specific degrees/specializations
  // Display both sections cleanly separated
  return (
    <div className="flex flex-col gap-1 text-[10px] font-mono whitespace-nowrap">
      {compulsoryItems.length > 0 && (
        <div className="flex items-center gap-1">
          <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider border bg-primary/10 text-primary border-primary/25 rounded">
            C
          </span>
          <div className="flex items-center gap-1">
            {compulsoryItems.map((ci, i) => (
              <span
                key={i}
                title={ci.sub ? `${ci.label} (${ci.sub})` : ci.label}
                className="px-1.5 py-0.5 bg-secondary text-secondary-foreground border border-border/70 rounded text-[10px] font-bold"
              >
                {ci.label}
              </span>
            ))}
          </div>
        </div>
      )}
      {optionalItems.length > 0 && (
        <div className="flex items-center gap-1">
          <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider border bg-amber-500/10 text-amber-500 border-amber-500/25 rounded">
            O
          </span>
          <div className="flex items-center gap-1">
            {optionalItems.map((oi, i) => (
              <span
                key={i}
                title={oi.sub ? `${oi.label} (${oi.sub})` : oi.label}
                className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded text-[10px] font-bold"
              >
                {oi.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function CoursesManagementPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'courses' | 'periods' | 'lecturers'>('courses');

  // Filters State for Courses Catalog
  const [courseSearch, setCourseSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [degreeFilter, setDegreeFilter] = useState('');

  // Filters State for Lecturer & Examiner Allocations (Exam Console layout)
  const [allocSearch, setAllocSearch] = useState('');
  const [allocSemesterFilter, setAllocSemesterFilter] = useState('ALL');
  const [allocDeptFilter, setAllocDeptFilter] = useState('ALL');
  const [updatingCourseId, setUpdatingCourseId] = useState<number | null>(null);

  // Course Dialog States
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [courseImportDialogOpen, setCourseImportDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);

  // Lecturer Assignment Dialog States
  const [lecturerAssignmentOpen, setLecturerAssignmentOpen] = useState(false);
  const [assignmentCourse, setAssignmentCourse] = useState<any>(null);

  // Period Dialog States
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [editingEndDatePeriodId, setEditingEndDatePeriodId] = useState<number | null>(null);
  const [editingEndDateValue, setEditingEndDateValue] = useState<string>('');

  // Marker Dialog States
  const [markerDialogOpen, setMarkerDialogOpen] = useState(false);
  const [markerCourse, setMarkerCourse] = useState<any>(null);

  // User/Lecturer Dialog State for adding new lecturers
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<any>(null);

  const isAdminOrStaff =
    user?.role === UserRole.ADMINISTRATOR || user?.role === UserRole.EXAM_DIVISION_STAFF;

  // Bulk selection states for Courses & Registration Windows
  const [isBulkDeletingCourses, setIsBulkDeletingCourses] = useState(false);
  const [isBulkDeletingPeriods, setIsBulkDeletingPeriods] = useState(false);
  const courseSelection = useBulkSelection<number>();
  const periodSelection = useBulkSelection<number>();

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });

  // Fetch Lecturers for Assignments
  const { data: lecturersList = [], refetch: refetchLecturers } = useQuery({
    queryKey: ['lecturers-list-assignment'],
    queryFn: async () => {
      const response = await apiClient.get('/lecturers');
      return response.data?.data || [];
    },
    enabled: activeTab === 'lecturers' || markerDialogOpen,
  });

  // Group lecturers by department for categorized dropdowns
  const lecturersByDepartment = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const lec of lecturersList || []) {
      const deptName = lec.department?.department_name || 'Other / General Faculty';
      if (!groups[deptName]) {
        groups[deptName] = [];
      }
      groups[deptName].push(lec);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [lecturersList]);

  const getCourseKey = useCallback((c: any) => c.course_id, []);

  // Fetch all courses for Lecturer & Examiner Allocations table using progressive lazy loading
  const {
    items: allocationCourses,
    total: totalAllocationCourses,
    isLoading: isAllocationCoursesLoading,
    isFetchingNextPage: isFetchingNextAllocPage,
    hasNextPage: hasNextAllocPage,
    isFetchNextPageError: isAllocNextError,
    fetchNextPage: fetchNextAllocPage,
    refetch: refetchAllocationCourses,
  } = useProgressiveInfiniteQuery<any>({
    queryKey: ['courses-allocations-all'],
    queryFn: async (page, limit) => {
      const response = await apiClient.get('/courses', {
        params: { page, limit },
      });
      return response.data?.data;
    },
    enabled: activeTab === 'lecturers',
    getItemKey: getCourseKey,
  });

  const handleSetCourseLecturerInline = async (courseId: number, lecturerIdStr: string) => {
    setUpdatingCourseId(courseId);
    try {
      const lecturerId = lecturerIdStr ? parseInt(lecturerIdStr, 10) : null;
      await apiClient.put(`/courses/${courseId}/lecturer`, { lecturerId });
      toast.success(
        lecturerId ? 'Course lecturer assigned successfully.' : 'Course lecturer cleared.',
      );
      refetchAllocationCourses();
      refetchCourses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update course lecturer.');
    } finally {
      setUpdatingCourseId(null);
    }
  };

  const handleSetCourseInChargeInline = async (courseId: number, inChargeIdStr: string) => {
    setUpdatingCourseId(courseId);
    try {
      const inChargeLecturerId = inChargeIdStr ? parseInt(inChargeIdStr, 10) : null;
      await apiClient.patch(`/courses/${courseId}/in-charge`, { inChargeLecturerId });
      toast.success(
        inChargeLecturerId
          ? 'Course In-Charge assigned successfully.'
          : 'Course In-Charge cleared.',
      );
      refetchAllocationCourses();
      refetchCourses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update Course In-Charge.');
    } finally {
      setUpdatingCourseId(null);
    }
  };

  const handleRemovePrimaryFirstMarker = async (c: any) => {
    const confirmed = await confirm({
      title: 'Remove 1st Marker?',
      message: `Are you sure you want to remove the assigned primary 1st Marker from ${c.course_code}? The 1st Marker position will remain empty (2nd Marker will not be shifted).`,
      confirmText: 'Remove 1st Marker',
      variant: 'destructive',
    });
    if (!confirmed) return;

    setUpdatingCourseId(c.course_id);
    try {
      await apiClient.put(`/courses/${c.course_id}/markers`, {
        isFirstMarkerSameAsInCharge: c.is_first_marker_same_as_in_charge ?? true,
        inChargeLecturerId: c.in_charge_lecturer_id || null,
        firstMarkerType: null,
        firstMarkerLecturerId: null,
        firstMarkerName: null,
        firstMarkerEmail: null,
        additionalFirstMarkers: (c.additional_first_markers || []).map((m: any) => ({
          id: m.id,
          type: m.type,
          lecturerId: m.lecturerId || null,
          name: m.name || null,
          email: m.email || null,
        })),
        secondMarkerType: c.second_marker_type || null,
        secondMarkerLecturerId: c.second_marker_lecturer_id || null,
        secondMarkerName: c.second_marker_name || null,
        secondMarkerEmail: c.second_marker_email || null,
      });
      toast.success('1st Marker removed. The 1st Marker slot is now empty.');
      refetchAllocationCourses();
      refetchCourses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove 1st Marker.');
    } finally {
      setUpdatingCourseId(null);
    }
  };

  const handleRemoveAdditionalFirstMarkerInline = async (c: any, markerId: string) => {
    const confirmed = await confirm({
      title: 'Remove Additional 1st Marker?',
      message: `Remove this additional 1st marker from ${c.course_code}?`,
      confirmText: 'Remove',
      variant: 'destructive',
    });
    if (!confirmed) return;

    setUpdatingCourseId(c.course_id);
    try {
      const remaining = (c.additional_first_markers || [])
        .filter((m: any) => m.id !== markerId)
        .map((m: any) => ({
          id: m.id,
          type: m.type,
          lecturerId: m.lecturerId || null,
          name: m.name || null,
          email: m.email || null,
        }));

      await apiClient.put(`/courses/${c.course_id}/markers`, {
        isFirstMarkerSameAsInCharge: c.is_first_marker_same_as_in_charge ?? true,
        inChargeLecturerId: c.in_charge_lecturer_id || null,
        firstMarkerType: c.first_marker_type || null,
        firstMarkerLecturerId: c.first_marker_lecturer_id || null,
        firstMarkerName: c.first_marker_name || null,
        firstMarkerEmail: c.first_marker_email || null,
        additionalFirstMarkers: remaining,
        secondMarkerType: c.second_marker_type || null,
        secondMarkerLecturerId: c.second_marker_lecturer_id || null,
        secondMarkerName: c.second_marker_name || null,
        secondMarkerEmail: c.second_marker_email || null,
      });
      toast.success('Additional 1st Marker removed.');
      refetchAllocationCourses();
      refetchCourses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove additional 1st Marker.');
    } finally {
      setUpdatingCourseId(null);
    }
  };

  const handleRemoveSecondMarkerInline = async (c: any) => {
    const confirmed = await confirm({
      title: 'Remove 2nd Marker?',
      message: `Are you sure you want to remove the assigned 2nd Marker from ${c.course_code}?`,
      confirmText: 'Remove 2nd Marker',
      variant: 'destructive',
    });
    if (!confirmed) return;

    setUpdatingCourseId(c.course_id);
    try {
      await apiClient.put(`/courses/${c.course_id}/markers`, {
        isFirstMarkerSameAsInCharge: c.is_first_marker_same_as_in_charge ?? true,
        inChargeLecturerId: c.in_charge_lecturer_id || null,
        firstMarkerType: c.first_marker_type || null,
        firstMarkerLecturerId: c.first_marker_lecturer_id || null,
        firstMarkerName: c.first_marker_name || null,
        firstMarkerEmail: c.first_marker_email || null,
        additionalFirstMarkers: (c.additional_first_markers || []).map((m: any) => ({
          id: m.id,
          type: m.type,
          lecturerId: m.lecturerId || null,
          name: m.name || null,
          email: m.email || null,
        })),
        secondMarkerType: null,
        secondMarkerLecturerId: null,
        secondMarkerName: null,
        secondMarkerEmail: null,
      });
      toast.success('2nd Marker removed.');
      refetchAllocationCourses();
      refetchCourses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove 2nd Marker.');
    } finally {
      setUpdatingCourseId(null);
    }
  };

  // Fetch Degrees for filtering
  const { data: degrees = [] } = useQuery({
    queryKey: ['degrees-list-filter'],
    queryFn: async () => {
      const response = await apiClient.get('/degrees');
      return response.data?.data || [];
    },
  });

  // Fetch Courses with filters using progressive lazy loading (50 initially, then auto-load remaining slowly)
  const {
    items: courses,
    total: totalCourses,
    loadedCount: loadedCoursesCount,
    isLoading: isCoursesLoading,
    isFetchingNextPage: isFetchingNextCoursesPage,
    hasNextPage: hasNextCoursesPage,
    isFetchNextPageError: isCoursesNextError,
    fetchNextPage: fetchNextCoursesPage,
    refetch: refetchCourses,
  } = useProgressiveInfiniteQuery<any>({
    queryKey: ['courses', courseSearch, deptFilter, semesterFilter, degreeFilter],
    queryFn: async (page, limit) => {
      const params: any = {
        page,
        limit,
        search: courseSearch || undefined,
        departmentId: deptFilter || undefined,
        semester: semesterFilter || undefined,
        degreeId: degreeFilter || undefined,
      };
      const response = await apiClient.get('/courses', { params });
      return response.data?.data;
    },
    getItemKey: getCourseKey,
  });

  // Fetch Registration Periods
  const {
    data: periods = [],
    isLoading: isPeriodsLoading,
    refetch: refetchPeriods,
  } = useQuery({
    queryKey: ['registration-periods'],
    queryFn: async () => {
      const response = await apiClient.get('/courses/periods');
      return response.data?.data || [];
    },
  });

  const {
    visibleItems: visiblePeriods,
    visibleCount: visiblePeriodsCount,
    totalCount: totalPeriodsCount,
    hasMore: hasMorePeriods,
  } = useProgressiveList<any>(periods);

  const filteredAllocCourses = useMemo(() => {
    const rawAllocCourses = allocationCourses.length > 0 ? allocationCourses : courses;
    return rawAllocCourses.filter((c: any) => {
      if (allocSemesterFilter !== 'ALL' && c.semester !== allocSemesterFilter) {
        return false;
      }
      if (allocDeptFilter !== 'ALL' && c.department_id?.toString() !== allocDeptFilter) {
        return false;
      }
      if (allocSearch.trim() !== '') {
        const q = allocSearch.toLowerCase();
        const matchCode = c.course_code?.toLowerCase().includes(q);
        const matchName = c.course_name?.toLowerCase().includes(q);
        const matchDept =
          c.department?.department_name?.toLowerCase().includes(q) ||
          c.department?.department_code?.toLowerCase().includes(q);
        const matchLec = c.lecturers?.some((cl: any) =>
          cl.lecturer?.user?.full_name?.toLowerCase().includes(q),
        );
        const matchInCharge = c.in_charge_lecturer?.user?.full_name?.toLowerCase().includes(q);
        const matchFirst =
          c.first_marker_lecturer?.user?.full_name?.toLowerCase().includes(q) ||
          c.first_marker_name?.toLowerCase().includes(q);
        const matchSecond =
          c.second_marker_lecturer?.user?.full_name?.toLowerCase().includes(q) ||
          c.second_marker_name?.toLowerCase().includes(q);
        if (
          !matchCode &&
          !matchName &&
          !matchDept &&
          !matchLec &&
          !matchInCharge &&
          !matchFirst &&
          !matchSecond
        ) {
          return false;
        }
      }
      return true;
    });
  }, [allocationCourses, courses, allocSemesterFilter, allocDeptFilter, allocSearch]);

  const {
    visibleItems: visibleAllocCourses,
    visibleCount: visibleAllocCount,
    hasMore: hasMoreAllocVisible,
  } = useProgressiveList<any>(filteredAllocCourses, {
    resetKey: `${allocSearch}|${allocSemesterFilter}|${allocDeptFilter}`,
  });

  // Period Actions Handlers
  const handlePeriodStatusChange = async (periodId: number, status: string) => {
    try {
      await apiClient.patch(`/courses/periods/${periodId}/status`, { status });
      toast.success(`Registration window status updated to ${status}.`);
      refetchPeriods();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update period status');
    }
  };

  const handleDeletePeriod = async (periodId: number) => {
    const confirmed = await confirm({
      title: 'Delete Registration Window?',
      message:
        'Are you sure you want to delete this course registration window? Students will no longer be able to register for this semester.',
      confirmText: 'Delete Window',
      variant: 'destructive',
    });
    if (confirmed) {
      try {
        await apiClient.delete(`/courses/periods/${periodId}`);
        toast.success('Registration window deleted successfully.');
        refetchPeriods();
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to delete registration window.');
      }
    }
  };

  const handleSaveEndDate = async (periodId: number) => {
    if (!editingEndDateValue) return;
    try {
      await apiClient.patch(`/courses/periods/${periodId}/end-date`, {
        endDate: new Date(editingEndDateValue).toISOString(),
      });
      toast.success('Registration window end date updated.');
      setEditingEndDatePeriodId(null);
      refetchPeriods();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update end date.');
    }
  };

  // Course Actions
  const handleCreateCourse = () => {
    setSelectedCourse(null);
    setCourseDialogOpen(true);
  };

  const handleEditCourse = (course: any) => {
    setSelectedCourse(course);
    setCourseDialogOpen(true);
  };

  const handleDeleteCourse = async (courseId: number) => {
    const confirmed = await confirm({
      title: 'Delete Course?',
      message:
        'Are you sure you want to delete this course? This action is permanent and cannot be undone.',
      confirmText: 'Delete Course',
      variant: 'destructive',
    });
    if (confirmed) {
      try {
        await apiClient.delete(`/courses/${courseId}`);
        toast.success('Course deleted successfully.');
        refetchCourses();
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to delete course');
      }
    }
  };

  const handleBulkDeleteCourses = async () => {
    if (courseSelection.selectedCount === 0) return;
    const confirmed = await confirm({
      title: 'Delete Selected Courses?',
      message: `Are you sure you want to permanently delete ${courseSelection.selectedCount} selected course(s)? This cannot be undone.`,
      confirmText: `Delete (${courseSelection.selectedCount})`,
      variant: 'destructive',
    });
    if (!confirmed) return;

    setIsBulkDeletingCourses(true);
    try {
      const deletedIds: number[] = [];
      const { deletedCount, failedCount, firstErrorMessage } = await runBulkDelete(
        courseSelection.selectedIds,
        async (id) => {
          await apiClient.delete(`/courses/${id}`);
          deletedIds.push(id);
        },
      );
      if (deletedCount > 0) {
        toast.success(`${deletedCount} course(s) deleted successfully.`);
        courseSelection.removeFromSelection(deletedIds);
        refetchCourses();
      }
      if (failedCount > 0) {
        toast.error(
          `${failedCount} course(s) could not be deleted${firstErrorMessage ? `: ${firstErrorMessage}` : '.'}`,
        );
      }
      if (failedCount === 0) courseSelection.clear();
    } finally {
      setIsBulkDeletingCourses(false);
    }
  };

  const handleBulkDeletePeriods = async () => {
    if (periodSelection.selectedCount === 0) return;
    const confirmed = await confirm({
      title: 'Delete Selected Registration Windows?',
      message: `Are you sure you want to delete ${periodSelection.selectedCount} selected registration window(s)?`,
      confirmText: `Delete (${periodSelection.selectedCount})`,
      variant: 'destructive',
    });
    if (!confirmed) return;

    setIsBulkDeletingPeriods(true);
    try {
      const deletedIds: number[] = [];
      const { deletedCount, failedCount, firstErrorMessage } = await runBulkDelete(
        periodSelection.selectedIds,
        async (id) => {
          await apiClient.delete(`/courses/periods/${id}`);
          deletedIds.push(id);
        },
      );
      if (deletedCount > 0) {
        toast.success(`${deletedCount} registration window(s) deleted successfully.`);
        periodSelection.removeFromSelection(deletedIds);
        refetchPeriods();
      }
      if (failedCount > 0) {
        toast.error(
          `${failedCount} window(s) could not be deleted${firstErrorMessage ? `: ${firstErrorMessage}` : '.'}`,
        );
      }
      if (failedCount === 0) periodSelection.clear();
    } finally {
      setIsBulkDeletingPeriods(false);
    }
  };

  return (
    <>
      <div className="space-y-6 animate-fadeIn">
        {/* Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Courses & Curriculum Management</h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Manage course catalog, registration windows, semester structures, and
              lecturer/examiner allocations.
            </p>
          </div>

          {isAdminOrStaff && (
            <div className="flex flex-wrap items-center gap-3">
              {activeTab === 'courses' && (
                <>
                  <button
                    onClick={() => setCourseImportDialogOpen(true)}
                    className="px-4 py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition text-xs flex items-center gap-2 border border-border/80 cursor-pointer shadow-sm"
                  >
                    <Upload className="h-4 w-4" /> Bulk Import Courses
                  </button>
                  <button
                    onClick={handleCreateCourse}
                    className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" /> Add New Course
                  </button>
                </>
              )}
              {activeTab === 'periods' && (
                <button
                  onClick={() => setPeriodDialogOpen(true)}
                  className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Open Registration Window
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabs Control */}
        <div className="flex border-b border-border/60 gap-8 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('courses')}
            className={`pb-3 transition flex items-center gap-2 relative cursor-pointer ${
              activeTab === 'courses'
                ? 'text-primary border-b-2 border-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="h-4 w-4" /> Course Catalog ({totalCourses})
          </button>
          <button
            onClick={() => setActiveTab('periods')}
            className={`pb-3 transition flex items-center gap-2 relative cursor-pointer ${
              activeTab === 'periods'
                ? 'text-primary border-b-2 border-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calendar className="h-4 w-4" /> Registration Windows ({periods.length})
          </button>
          {isAdminOrStaff && (
            <button
              onClick={() => setActiveTab('lecturers')}
              className={`pb-3 transition flex items-center gap-2 relative cursor-pointer ${
                activeTab === 'lecturers'
                  ? 'text-primary border-b-2 border-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserCheck className="h-4 w-4" /> Lecturer & Examiner Allocations
            </button>
          )}
        </div>

        {/* ========================================== */}
        {/* TAB 1: COURSES CATALOG (ORDERED BY SEMESTER) */}
        {/* ========================================== */}
        {activeTab === 'courses' && (
          <div className="space-y-6 animate-tabSwipeUp">
            {/* Filter & Search Bar */}
            <div className="bg-card border border-border/80 p-5 rounded-3xl shadow-sm space-y-4">
              {/* Search & Bulk Actions Row */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search course code or title..."
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/60 text-foreground"
                  />
                  {courseSearch && (
                    <button
                      onClick={() => setCourseSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                  {isAdminOrStaff && (
                    <BulkDeleteButton
                      count={courseSelection.selectedCount}
                      isDeleting={isBulkDeletingCourses}
                      onClick={handleBulkDeleteCourses}
                    />
                  )}
                  <div className="px-3 py-2 bg-background border border-border/80 rounded-xl text-xs font-mono font-bold text-foreground flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                    Showing {courses.length} of {totalCourses} Records
                  </div>
                </div>
              </div>

              {/* Filter Dropdowns Row */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Department Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">
                    Department:
                  </span>
                  <select
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 max-w-[180px] truncate cursor-pointer"
                  >
                    <option value="">All Departments</option>
                    {departments.map((d: any) => (
                      <option key={d.department_id} value={d.department_id} className="bg-card">
                        {d.department_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Degree Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">
                    Degree:
                  </span>
                  <select
                    value={degreeFilter}
                    onChange={(e) => setDegreeFilter(e.target.value)}
                    className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 max-w-[200px] truncate cursor-pointer"
                  >
                    <option value="">All Degree Programs</option>
                    {degrees.map((deg: any) => (
                      <option key={deg.degree_id} value={deg.degree_id} className="bg-card">
                        {deg.degree_code} - {deg.degree_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Semester Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">
                    Semester:
                  </span>
                  <select
                    value={semesterFilter}
                    onChange={(e) => setSemesterFilter(e.target.value)}
                    className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 cursor-pointer"
                  >
                    <option value="">All Semesters</option>
                    <option value="1.1">Semester 1.1</option>
                    <option value="1.2">Semester 1.2</option>
                    <option value="2.1">Semester 2.1</option>
                    <option value="2.2">Semester 2.2</option>
                    <option value="3.1">Semester 3.1</option>
                    <option value="3.2">Semester 3.2</option>
                    <option value="4.1">Semester 4.1</option>
                    <option value="4.2">Semester 4.2</option>
                  </select>
                </div>

                {(deptFilter || degreeFilter || semesterFilter || courseSearch) && (
                  <button
                    onClick={() => {
                      setDeptFilter('');
                      setDegreeFilter('');
                      setSemesterFilter('');
                      setCourseSearch('');
                    }}
                    className="px-3 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-xl hover:bg-secondary/80 transition cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Courses Table */}
            <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                      {isAdminOrStaff && (
                        <th className="px-3.5 py-3 w-10 text-center">
                          <SelectAllCheckbox
                            checked={courseSelection.isAllSelected(
                              courses.map((c: any) => c.course_id),
                            )}
                            indeterminate={courseSelection.isIndeterminate(
                              courses.map((c: any) => c.course_id),
                            )}
                            disabled={courses.length === 0}
                            onChange={() =>
                              courseSelection.toggleAll(courses.map((c: any) => c.course_id))
                            }
                            ariaLabel="Select all visible courses"
                          />
                        </th>
                      )}
                      <th className="px-3 py-3 w-10 text-center">#</th>
                      <th className="px-4 py-3 whitespace-nowrap">Semester</th>
                      <th className="px-4 py-3 whitespace-nowrap">Course Code</th>
                      <th className="px-4 py-3 whitespace-nowrap">Course Name</th>
                      <th className="px-4 py-3 whitespace-nowrap">Department</th>
                      <th className="px-4 py-3 whitespace-nowrap">Degrees</th>
                      <th className="px-4 py-3 whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center">Credits</th>
                      {isAdminOrStaff && (
                        <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs font-medium">
                    {isCoursesLoading ? (
                      <tr>
                        <td
                          colSpan={isAdminOrStaff ? 10 : 8}
                          className="text-center py-20 text-muted-foreground"
                        >
                          <span className="inline-flex items-center gap-2">
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                            Loading courses catalog (ordered by semester)...
                          </span>
                        </td>
                      </tr>
                    ) : courses.length === 0 ? (
                      <tr>
                        <td
                          colSpan={isAdminOrStaff ? 10 : 8}
                          className="text-center py-20 text-muted-foreground"
                        >
                          No courses found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      courses.map((course: any, idx: number) => (
                        <tr
                          key={course.course_id}
                          className={`hover:bg-secondary/15 transition-colors ${
                            isAdminOrStaff && courseSelection.isSelected(course.course_id)
                              ? 'bg-primary/5'
                              : ''
                          }`}
                        >
                          {isAdminOrStaff && (
                            <td className="px-3.5 py-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={courseSelection.isSelected(course.course_id)}
                                onChange={() => courseSelection.toggle(course.course_id)}
                                aria-label={`Select course ${course.course_code}`}
                                className="h-3.5 w-3.5 rounded border-border/80 accent-primary cursor-pointer"
                              />
                            </td>
                          )}
                          <td className="px-3 py-2.5 text-center font-mono text-muted-foreground font-bold text-xs">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-2.5 font-bold font-mono text-primary text-xs whitespace-nowrap">
                            Sem {course.semester}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-foreground font-mono whitespace-nowrap">
                            {course.course_code}
                          </td>
                          <td
                            className="px-4 py-2.5 text-foreground whitespace-nowrap max-w-sm truncate"
                            title={course.course_name}
                          >
                            {course.course_name}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground uppercase font-semibold whitespace-nowrap">
                            {course.department?.department_code}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <div className="flex flex-nowrap items-center gap-1">
                              {course.degrees && course.degrees.length > 0 ? (
                                course.degrees.map((d: any) => (
                                  <span
                                    key={d.degree_id}
                                    className="inline-block px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded text-[10px] font-bold font-mono whitespace-nowrap"
                                  >
                                    {d.degree?.degree_code || d.degree_id}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground/60 italic whitespace-nowrap">
                                  None
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {renderCourseStatus(course)}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-center whitespace-nowrap">
                            {course.credit_value}
                          </td>
                          {isAdminOrStaff && (
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-2.5 whitespace-nowrap">
                                <button
                                  onClick={() => handleEditCourse(course)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-background border border-border/80 rounded-md text-[11px] font-bold text-foreground hover:bg-secondary/80 transition shadow-2xs cursor-pointer"
                                >
                                  <SquarePen className="h-3 w-3" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteCourse(course.course_id)}
                                  className="text-[11px] font-bold text-red-500 hover:text-red-600 transition cursor-pointer px-1 py-0.5"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Progressive Auto-Loading Footer Indicator */}
              <ProgressiveLoadFooter
                loadedCount={loadedCoursesCount}
                totalCount={totalCourses}
                isLoadingMore={isFetchingNextCoursesPage}
                hasMore={hasNextCoursesPage}
                isError={isCoursesNextError}
                onRetry={() => fetchNextCoursesPage()}
                entityLabel="course records"
              />
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: REGISTRATION WINDOWS */}
        {/* ========================================== */}
        {activeTab === 'periods' && (
          <div className="space-y-6 animate-tabSwipeUp">
            <div className="bg-card border border-border/80 p-4 rounded-3xl shadow-sm flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold text-muted-foreground">
                Course & repeat exam registration windows
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {isAdminOrStaff && (
                  <BulkDeleteButton
                    count={periodSelection.selectedCount}
                    isDeleting={isBulkDeletingPeriods}
                    onClick={handleBulkDeletePeriods}
                  />
                )}
                <div className="px-3 py-2 bg-background border border-border/80 rounded-xl text-xs font-mono font-bold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Showing {visiblePeriods.length} of {totalPeriodsCount} Records
                </div>
              </div>
            </div>
            <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                      {isAdminOrStaff && (
                        <th className="px-4 py-4 w-10 text-center">
                          <SelectAllCheckbox
                            checked={periodSelection.isAllSelected(
                              visiblePeriods.map((p: any) => p.period_id),
                            )}
                            indeterminate={periodSelection.isIndeterminate(
                              visiblePeriods.map((p: any) => p.period_id),
                            )}
                            disabled={visiblePeriods.length === 0}
                            onChange={() =>
                              periodSelection.toggleAll(visiblePeriods.map((p: any) => p.period_id))
                            }
                            ariaLabel="Select all visible registration windows"
                          />
                        </th>
                      )}
                      <th className="px-4 py-4 w-12 text-center">#</th>
                      <th className="px-6 py-4">Batch / Academic Year</th>
                      <th className="px-6 py-4">Semester</th>
                      <th className="px-6 py-4">Window Type</th>
                      <th className="px-6 py-4">Start Date</th>
                      <th className="px-6 py-4">End Date</th>
                      <th className="px-6 py-4">Status</th>
                      {isAdminOrStaff && <th className="px-6 py-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-sm font-medium">
                    {isPeriodsLoading ? (
                      <tr>
                        <td
                          colSpan={isAdminOrStaff ? 9 : 7}
                          className="text-center py-20 text-muted-foreground"
                        >
                          <span className="inline-flex items-center gap-2">
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                            Loading registration windows...
                          </span>
                        </td>
                      </tr>
                    ) : periods.length === 0 ? (
                      <tr>
                        <td
                          colSpan={isAdminOrStaff ? 9 : 7}
                          className="text-center py-20 text-muted-foreground"
                        >
                          No registration periods have been created yet.
                        </td>
                      </tr>
                    ) : (
                      visiblePeriods.map((p: any, idx: number) => {
                        const startStr = new Date(p.start_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        });
                        const endStr = new Date(p.end_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        });

                        const isOpen = p.status === 'OPEN';
                        const isSuspended = p.status === 'SUSPENDED';
                        const isMedicalRepeat =
                          p.window_type === 'MEDICAL_REPEAT_REGISTRATION' ||
                          p.window_type === 'PROPER_REPEAT_REGISTRATION';

                        const isEditingEnd = editingEndDatePeriodId === p.period_id;

                        return (
                          <tr
                            key={p.period_id}
                            className={`hover:bg-secondary/15 transition-colors ${
                              isAdminOrStaff && periodSelection.isSelected(p.period_id)
                                ? 'bg-primary/5'
                                : ''
                            }`}
                          >
                            {isAdminOrStaff && (
                              <td className="px-4 py-4.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={periodSelection.isSelected(p.period_id)}
                                  onChange={() => periodSelection.toggle(p.period_id)}
                                  aria-label={`Select window Semester ${p.semester}`}
                                  className="h-4 w-4 rounded border-border/80 accent-primary cursor-pointer"
                                />
                              </td>
                            )}
                            <td className="px-4 py-4.5 text-center font-mono text-muted-foreground font-bold text-xs">
                              {idx + 1}
                            </td>
                            <td className="px-6 py-4.5 font-semibold text-foreground font-mono">
                              {p.batch ? `Batch ${p.batch}` : `Year ${p.academic_year}`}
                            </td>
                            <td className="px-6 py-4.5 font-mono text-muted-foreground">
                              Semester {p.semester}
                            </td>
                            <td className="px-6 py-4.5">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono border ${
                                  isMedicalRepeat
                                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                }`}
                              >
                                {isMedicalRepeat ? 'Medical / Repeat' : 'Semester Registration'}
                              </span>
                            </td>
                            <td className="px-6 py-4.5 text-muted-foreground">{startStr}</td>
                            <td className="px-6 py-4.5 text-muted-foreground">
                              {isEditingEnd ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="date"
                                    value={editingEndDateValue}
                                    onChange={(e) => setEditingEndDateValue(e.target.value)}
                                    className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground font-medium"
                                  />
                                  <button
                                    onClick={() => handleSaveEndDate(p.period_id)}
                                    className="p-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition cursor-pointer"
                                    title="Save End Date"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingEndDatePeriodId(null)}
                                    className="p-1 bg-secondary text-muted-foreground rounded hover:text-foreground transition cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span>{endStr}</span>
                                  {isAdminOrStaff && (
                                    <button
                                      onClick={() => {
                                        setEditingEndDatePeriodId(p.period_id);
                                        setEditingEndDateValue(
                                          new Date(p.end_date).toISOString().split('T')[0],
                                        );
                                      }}
                                      className="p-1 text-muted-foreground hover:text-primary hover:bg-secondary/40 rounded transition cursor-pointer"
                                      title="Edit End Date"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  isOpen
                                    ? 'bg-emerald-500/10 text-foreground dark:text-emerald-300 border-emerald-400/60 dark:border-emerald-500/40'
                                    : isSuspended
                                      ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/30'
                                      : 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/30'
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            {isAdminOrStaff && (
                              <td className="px-6 py-4.5 text-right space-x-2 whitespace-nowrap">
                                {!isOpen && (
                                  <button
                                    onClick={() => handlePeriodStatusChange(p.period_id, 'OPEN')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition text-xs font-semibold cursor-pointer"
                                  >
                                    <Play className="h-3 w-3" />
                                    Open
                                  </button>
                                )}
                                {isOpen && (
                                  <button
                                    onClick={() =>
                                      handlePeriodStatusChange(p.period_id, 'SUSPENDED')
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg transition text-xs font-semibold cursor-pointer"
                                  >
                                    <Pause className="h-3 w-3" />
                                    Suspend
                                  </button>
                                )}
                                {p.status !== 'CLOSED' && (
                                  <button
                                    onClick={() => handlePeriodStatusChange(p.period_id, 'CLOSED')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition text-xs font-semibold cursor-pointer"
                                  >
                                    <StopCircle className="h-3 w-3" />
                                    Close
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeletePeriod(p.period_id)}
                                  className="text-[11px] font-bold text-red-500 hover:text-red-600 transition cursor-pointer px-1 py-0.5"
                                  title="Delete Window"
                                >
                                  Delete
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <ProgressiveLoadFooter
                loadedCount={visiblePeriodsCount}
                totalCount={totalPeriodsCount}
                isLoadingMore={hasMorePeriods}
                hasMore={hasMorePeriods}
                entityLabel="registration windows"
              />
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: LECTURER & EXAMINER ALLOCATIONS */}
        {/* ========================================== */}
        {activeTab === 'lecturers' && isAdminOrStaff && (
          <div className="space-y-4 animate-tabSwipeUp">
            {/* Filter & Search Bar (Same UI layout as Exam Console) */}
            <div className="bg-card/40 border border-border/80 p-4 rounded-2xl flex flex-wrap items-center gap-4 shadow-sm backdrop-blur-md">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={allocSearch}
                  onChange={(e) => setAllocSearch(e.target.value)}
                  placeholder="Search by Course Code, Subject Name, Lecturer, or Marker..."
                  className="w-full pl-9 pr-4 py-2 bg-background border border-border/80 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Semester:
                </span>
                <select
                  value={allocSemesterFilter}
                  onChange={(e) => setAllocSemesterFilter(e.target.value)}
                  className="px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Semesters</option>
                  {['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'].map((sem) => (
                    <option key={sem} value={sem}>
                      Semester {sem}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Department:
                </span>
                <select
                  value={allocDeptFilter}
                  onChange={(e) => setAllocDeptFilter(e.target.value)}
                  className="px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Departments</option>
                  {departments.map((d: any) => (
                    <option key={d.department_id} value={d.department_id.toString()}>
                      {d.department_name} ({d.department_code})
                    </option>
                  ))}
                </select>
              </div>

              {(allocSearch !== '' ||
                allocSemesterFilter !== 'ALL' ||
                allocDeptFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setAllocSearch('');
                    setAllocSemesterFilter('ALL');
                    setAllocDeptFilter('ALL');
                  }}
                  className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>

            {/* COURSE LECTURER, IN-CHARGE & EXAMINER ALLOCATIONS TABLE */}
            <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
              <div className="px-6 py-4 border-b border-border/60 bg-secondary/15 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Course Examiner Allocations
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Select the Course Lecturer and Course In-Charge directly or configure 1st
                    Examiner (including additional/outside markers) and 2nd Examiner per course
                    subject.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                      <th className="px-4 py-4 w-12 text-center">#</th>
                      <th className="px-5 py-4">Semester</th>
                      <th className="px-5 py-4">Course Code & Name</th>
                      <th className="px-4 py-4">Department</th>
                      <th className="px-5 py-4">Lecturer</th>
                      <th className="px-5 py-4">In-Charge</th>
                      <th className="px-5 py-4">1st Examiner / Marker</th>
                      <th className="px-5 py-4">2nd Examiner / Marker</th>
                      <th className="px-5 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-medium">
                    {isAllocationCoursesLoading ? (
                      <tr>
                        <td colSpan={9} className="text-center py-20 text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                            Loading course marker allocations...
                          </span>
                        </td>
                      </tr>
                    ) : filteredAllocCourses.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-20 text-muted-foreground">
                          No courses match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      visibleAllocCourses.map((c: any, idx: number) => {
                        const assignedLecturerId = c.lecturers?.[0]?.lecturer_id
                          ? c.lecturers[0].lecturer_id.toString()
                          : '';
                        const assignedInChargeId = c.in_charge_lecturer_id
                          ? c.in_charge_lecturer_id.toString()
                          : '';

                        // IMPORTANT: Never fallback to c.lecturers[0] or 2nd marker when 1st marker is unassigned/removed
                        const isFirstExt = c.first_marker_type === 'EXTERNAL';
                        const hasPrimaryFirstMarker = Boolean(
                          (isFirstExt && c.first_marker_name) ||
                          (!isFirstExt && c.first_marker_lecturer_id),
                        );
                        const primaryFirstMarkerName = isFirstExt
                          ? c.first_marker_name
                            ? `${c.first_marker_name} (Outside)`
                            : null
                          : c.first_marker_lecturer?.user?.full_name || null;

                        const additionalFirstMarkers = Array.isArray(c.additional_first_markers)
                          ? c.additional_first_markers
                          : [];

                        const isSecondExt = c.second_marker_type === 'EXTERNAL';
                        const hasSecondMarker = Boolean(
                          (isSecondExt && c.second_marker_name) ||
                          (!isSecondExt && c.second_marker_lecturer_id),
                        );
                        const secondMarkerName = isSecondExt
                          ? c.second_marker_name
                            ? `${c.second_marker_name} (Outside)`
                            : 'Unassigned'
                          : c.second_marker_lecturer?.user?.full_name || 'Unassigned';

                        const isRowUpdating = updatingCourseId === c.course_id;

                        return (
                          <tr key={c.course_id} className="hover:bg-secondary/15 transition-colors">
                            <td className="px-4 py-4 text-center font-mono text-muted-foreground font-bold text-xs">
                              {idx + 1}
                            </td>
                            <td className="px-5 py-4 font-bold font-mono text-primary text-xs whitespace-nowrap">
                              Sem {c.semester}
                            </td>
                            <td className="px-5 py-4 min-w-[200px]">
                              <div className="font-bold text-foreground font-mono">
                                {c.course_code}
                              </div>
                              <div className="text-xs text-muted-foreground">{c.course_name}</div>
                            </td>
                            <td className="px-4 py-4 text-xs text-muted-foreground uppercase font-semibold whitespace-nowrap">
                              {c.department?.department_code}
                            </td>

                            {/* Column: Lecturer (Categorized by Department) */}
                            <td className="px-5 py-4 min-w-[190px]">
                              <select
                                value={assignedLecturerId}
                                disabled={isRowUpdating}
                                onChange={(e) =>
                                  handleSetCourseLecturerInline(c.course_id, e.target.value)
                                }
                                className={`w-full px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                                  assignedLecturerId
                                    ? 'bg-background border-border/80 text-foreground'
                                    : 'bg-secondary/40 border-border/60 text-muted-foreground'
                                }`}
                              >
                                <option value="">Unassigned</option>
                                {lecturersByDepartment.map(([deptName, deptLecturers]) => (
                                  <optgroup
                                    key={deptName}
                                    label={deptName}
                                    className="bg-card font-bold text-foreground"
                                  >
                                    {deptLecturers.map((lec: any) => (
                                      <option
                                        key={lec.lecturer_id}
                                        value={lec.lecturer_id}
                                        className="bg-card font-normal text-foreground"
                                      >
                                        {lec.user?.full_name}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </td>

                            {/* Column: In-Charge (Categorized by Department) */}
                            <td className="px-5 py-4 min-w-[190px]">
                              <select
                                value={assignedInChargeId}
                                disabled={isRowUpdating}
                                onChange={(e) =>
                                  handleSetCourseInChargeInline(c.course_id, e.target.value)
                                }
                                className={`w-full px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                                  assignedInChargeId
                                    ? 'bg-primary/5 border-primary/30 text-foreground'
                                    : 'bg-secondary/40 border-border/60 text-muted-foreground'
                                }`}
                              >
                                <option value="">Unassigned</option>
                                {lecturersByDepartment.map(([deptName, deptLecturers]) => (
                                  <optgroup
                                    key={deptName}
                                    label={deptName}
                                    className="bg-card font-bold text-foreground"
                                  >
                                    {deptLecturers.map((lec: any) => (
                                      <option
                                        key={lec.lecturer_id}
                                        value={lec.lecturer_id}
                                        className="bg-card font-normal text-foreground"
                                      >
                                        {lec.user?.full_name}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </td>

                            {/* Column: 1st Examiner / Marker */}
                            <td className="px-5 py-4 min-w-[200px]">
                              <div className="flex flex-col gap-1.5">
                                {hasPrimaryFirstMarker && primaryFirstMarkerName ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                        isFirstExt
                                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      }`}
                                    >
                                      <UserCheck className="h-3.5 w-3.5 shrink-0" />
                                      <span>{primaryFirstMarkerName}</span>
                                      {c.is_first_marker_same_as_in_charge === false && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25 font-bold">
                                          Separate from In-Charge
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        disabled={isRowUpdating}
                                        onClick={() => handleRemovePrimaryFirstMarker(c)}
                                        className="ml-1 hover:text-destructive transition cursor-pointer"
                                        title="Remove primary 1st Marker (keeps slot empty)"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-secondary text-muted-foreground/60 w-fit">
                                    <UserCheck className="h-3.5 w-3.5" />
                                    Unassigned
                                  </span>
                                )}

                                {/* Additional / Backup 1st Markers */}
                                {additionalFirstMarkers.map((addM: any, idx: number) => {
                                  const isAddExt = addM.type === 'EXTERNAL';
                                  const addLabel = isAddExt
                                    ? `${addM.name || 'External'} (Outside)`
                                    : addM.lecturer?.user?.full_name ||
                                      addM.name ||
                                      'Faculty Marker';
                                  return (
                                    <div key={addM.id || idx} className="flex items-center gap-1">
                                      <span
                                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold ${
                                          isAddExt
                                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                            : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                                        }`}
                                      >
                                        <Plus className="h-3 w-3 shrink-0" />
                                        <span>
                                          1st Marker #{idx + 2}: {addLabel}
                                        </span>
                                        <button
                                          type="button"
                                          disabled={isRowUpdating}
                                          onClick={() =>
                                            handleRemoveAdditionalFirstMarkerInline(c, addM.id)
                                          }
                                          className="ml-1 hover:text-destructive transition cursor-pointer"
                                          title="Remove additional 1st Marker"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>

                            {/* Column: 2nd Examiner / Marker */}
                            <td className="px-5 py-4 min-w-[180px]">
                              {hasSecondMarker && secondMarkerName !== 'Unassigned' ? (
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                    isSecondExt
                                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  }`}
                                >
                                  <User className="h-3.5 w-3.5 shrink-0" />
                                  <span>{secondMarkerName}</span>
                                  <button
                                    type="button"
                                    disabled={isRowUpdating}
                                    onClick={() => handleRemoveSecondMarkerInline(c)}
                                    className="ml-1 hover:text-destructive transition cursor-pointer"
                                    title="Remove 2nd Marker"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-secondary text-muted-foreground/60">
                                  <User className="h-3.5 w-3.5" />
                                  Unassigned
                                </span>
                              )}
                            </td>

                            {/* Column: Action */}
                            <td className="px-5 py-4 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setMarkerCourse(c);
                                  setMarkerDialogOpen(true);
                                }}
                                className="px-3.5 py-1.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-1.5 ml-auto cursor-pointer shadow-md shadow-primary/10"
                              >
                                <Edit3 className="h-3.5 w-3.5" /> Assign Markers
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <ProgressiveLoadFooter
                loadedCount={visibleAllocCount}
                totalCount={
                  allocSearch.trim() !== '' ||
                  allocSemesterFilter !== 'ALL' ||
                  allocDeptFilter !== 'ALL'
                    ? filteredAllocCourses.length
                    : totalAllocationCourses || filteredAllocCourses.length
                }
                isLoadingMore={isFetchingNextAllocPage || hasMoreAllocVisible}
                hasMore={hasNextAllocPage || hasMoreAllocVisible}
                isError={isAllocNextError}
                onRetry={() => fetchNextAllocPage()}
                entityLabel="courses"
              />
            </div>
          </div>
        )}
      </div>

      {/* Dialogs rendered outside animated page containers so fixed overlays anchor to viewport */}
      <CourseDialog
        open={courseDialogOpen}
        onClose={() => setCourseDialogOpen(false)}
        course={selectedCourse}
        onSuccess={() => {
          refetchCourses();
          refetchAllocationCourses();
        }}
      />

      <CourseImportDialog
        open={courseImportDialogOpen}
        onClose={() => setCourseImportDialogOpen(false)}
        onSuccess={() => {
          refetchCourses();
          refetchAllocationCourses();
        }}
      />

      {assignmentCourse && (
        <LecturerAssignmentDialog
          open={lecturerAssignmentOpen}
          onClose={() => {
            setLecturerAssignmentOpen(false);
            setAssignmentCourse(null);
          }}
          courseId={assignmentCourse.course_id}
          courseCode={assignmentCourse.course_code}
          courseName={assignmentCourse.course_name}
        />
      )}

      <PeriodDialog
        open={periodDialogOpen}
        onClose={() => setPeriodDialogOpen(false)}
        onSuccess={(newPeriod) => {
          if (newPeriod) {
            refetchPeriods();
          }
          setPeriodDialogOpen(false);
        }}
      />

      <MarkerDialog
        open={markerDialogOpen}
        onClose={() => {
          setMarkerDialogOpen(false);
          setMarkerCourse(null);
        }}
        course={markerCourse}
        lecturersList={lecturersList}
        onSuccess={() => {
          refetchCourses();
          refetchAllocationCourses();
        }}
      />

      <UserDialog
        open={userDialogOpen}
        onClose={() => {
          setUserDialogOpen(false);
          setSelectedUserForEdit(null);
        }}
        user={selectedUserForEdit}
        onSuccess={() => {
          refetchLecturers();
          setUserDialogOpen(false);
          setSelectedUserForEdit(null);
        }}
      />
    </>
  );
}
