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
import MarkerDialog from '../../../components/courses/marker-dialog';
import UserDialog from '../../../components/users/user-dialog';
import { formatNameWithTitle } from '../../../lib/nic-utils';
import {
  Search,
  BookOpen,
  Plus,
  Edit3,
  SquarePen,
  UserCheck,
  UserPlus,
  Upload,
  X,
} from 'lucide-react';
import { UserRole } from '@ems/shared';

// Helper to fetch departments for courses filtering
const fetchDepartments = async () => {
  const response = await apiClient.get('/departments');
  return response.data?.data || [];
};

const isStatusOptional = (s?: string) => {
  const v = (s || '').trim().toUpperCase();
  return v === 'OPTIONAL' || v === 'O' || v.startsWith('OPT');
};

const renderCourseStatus = (course: any, activeDegreeFilter?: string) => {
  let specs: any[] = course.course_specializations || [];
  let degs: any[] = course.degrees || [];

  // If a specific degree filter is active, evaluate status strictly for that degree
  if (activeDegreeFilter) {
    const degId = parseInt(activeDegreeFilter, 10);
    degs = degs.filter((d: any) => d.degree_id === degId);
    specs = specs.filter((cs: any) => cs.specialization?.degree_id === degId);
  }

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
        if (isStatusOptional(cs.status)) {
          optionalItems.push(item);
        } else {
          compulsoryItems.push(item);
        }
      }
    } else {
      const item = { label: degCode };
      if (isStatusOptional(d.status)) {
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
      if (isStatusOptional(cs.status)) {
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
  const [activeTab, setActiveTab] = useState<'courses' | 'lecturers'>('courses');

  // Filters State for Courses Catalog
  const [courseSearch, setCourseSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [degreeFilter, setDegreeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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

  // Marker Dialog States
  const [markerDialogOpen, setMarkerDialogOpen] = useState(false);
  const [markerCourse, setMarkerCourse] = useState<any>(null);

  // User/Lecturer Dialog State for adding new lecturers
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<any>(null);

  const isAdminOrStaff =
    user?.role === UserRole.ADMINISTRATOR || user?.role === UserRole.EXAM_DIVISION_STAFF;

  // Bulk selection states for Courses
  const [isBulkDeletingCourses, setIsBulkDeletingCourses] = useState(false);
  const courseSelection = useBulkSelection<number>();

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

  const getCourseKey = useCallback((c: any) => c.course_id, []);

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
    queryKey: ['courses', courseSearch, deptFilter, semesterFilter, degreeFilter, statusFilter],
    queryFn: async (page, limit) => {
      const params: any = {
        page,
        limit,
        search: courseSearch || undefined,
        departmentId: deptFilter || undefined,
        semester: semesterFilter || undefined,
        degreeId: degreeFilter || undefined,
        status: statusFilter || undefined,
      };
      const response = await apiClient.get('/courses', { params });
      return response.data?.data;
    },
    getItemKey: getCourseKey,
  });

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

                {/* Status Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">
                    Status:
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 cursor-pointer"
                  >
                    <option value="">All Statuses</option>
                    <option value="COMPULSORY">Compulsory</option>
                    <option value="OPTIONAL">Optional</option>
                  </select>
                </div>

                {(deptFilter || degreeFilter || semesterFilter || courseSearch || statusFilter) && (
                  <button
                    onClick={() => {
                      setDeptFilter('');
                      setDegreeFilter('');
                      setSemesterFilter('');
                      setCourseSearch('');
                      setStatusFilter('');
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
                              {(() => {
                                const degMap = new Map<number, string>();
                                (course.degrees || []).forEach((d: any) => {
                                  if (d.degree_id) {
                                    degMap.set(
                                      d.degree_id,
                                      d.degree?.degree_code || String(d.degree_id),
                                    );
                                  }
                                });
                                (course.course_specializations || []).forEach((cs: any) => {
                                  const deg = cs.specialization?.degree;
                                  if (deg?.degree_id && !degMap.has(deg.degree_id)) {
                                    degMap.set(
                                      deg.degree_id,
                                      deg.degree_code || String(deg.degree_id),
                                    );
                                  }
                                });
                                if (course.specialization?.degree) {
                                  const deg = course.specialization.degree;
                                  if (deg.degree_id && !degMap.has(deg.degree_id)) {
                                    degMap.set(
                                      deg.degree_id,
                                      deg.degree_code || String(deg.degree_id),
                                    );
                                  }
                                }

                                if (degMap.size === 0) {
                                  return (
                                    <span className="text-xs text-muted-foreground/60 italic whitespace-nowrap">
                                      None
                                    </span>
                                  );
                                }

                                return Array.from(degMap.entries()).map(([degId, degCode]) => {
                                  const isSelected =
                                    degreeFilter && parseInt(degreeFilter, 10) === degId;
                                  return (
                                    <span
                                      key={degId}
                                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono whitespace-nowrap border ${
                                        isSelected
                                          ? 'bg-primary/15 text-primary border-primary/30 ring-1 ring-primary/20'
                                          : 'bg-secondary text-secondary-foreground border-border/60'
                                      }`}
                                    >
                                      {degCode}
                                    </span>
                                  );
                                });
                              })()}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {renderCourseStatus(course, degreeFilter)}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-center whitespace-nowrap">
                            {course.credit_value}
                          </td>
                          {isAdminOrStaff && (
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-2.5 whitespace-nowrap">
                                <button
                                  onClick={() => {
                                    setAssignmentCourse(course);
                                    setLecturerAssignmentOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-background border border-border/80 rounded-md text-[11px] font-bold text-foreground hover:bg-secondary/80 transition shadow-2xs cursor-pointer"
                                  title="Assign Lecturers (Within or Outside Faculty)"
                                >
                                  <UserPlus className="h-3 w-3 text-primary" />
                                  Lecturers
                                </button>
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
        {/* TAB 2: LECTURER & EXAMINER ALLOCATIONS */}
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
                          : c.first_marker_lecturer?.user
                            ? formatNameWithTitle(
                                c.first_marker_lecturer.user.full_name,
                                c.first_marker_lecturer.user.nic_no,
                              )
                            : null;

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
                          : c.second_marker_lecturer?.user
                            ? formatNameWithTitle(
                                c.second_marker_lecturer.user.full_name,
                                c.second_marker_lecturer.user.nic_no,
                              )
                            : 'Unassigned';

                        const inChargeName = c.in_charge_lecturer?.user
                          ? formatNameWithTitle(
                              c.in_charge_lecturer.user.full_name,
                              c.in_charge_lecturer.user.nic_no,
                            )
                          : 'Unassigned';

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

                            {/* Column: Lecturer (Internal & External) */}
                            <td className="px-5 py-4 min-w-[200px]">
                              <div className="flex flex-col gap-1 items-start">
                                {c.lecturers && c.lecturers.length > 0 && (
                                  <div className="space-y-0.5">
                                    {c.lecturers.map((l: any) => (
                                      <div
                                        key={l.lecturer_id}
                                        className="text-xs font-medium text-foreground"
                                      >
                                        {formatNameWithTitle(
                                          l.lecturer?.user?.full_name || l.lecturer?.full_name,
                                          l.lecturer?.user?.nic_no,
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {c.external_lecturers && c.external_lecturers.length > 0 && (
                                  <div className="space-y-0.5">
                                    {c.external_lecturers.map((ext: any) => (
                                      <div
                                        key={ext.id}
                                        className="text-xs font-medium text-foreground"
                                      >
                                        {ext.name}{' '}
                                        <span className="text-[10px] text-muted-foreground font-medium">
                                          (Outside)
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {(!c.lecturers || c.lecturers.length === 0) &&
                                  (!c.external_lecturers || c.external_lecturers.length === 0) && (
                                    <span className="text-xs text-muted-foreground">
                                      Unassigned
                                    </span>
                                  )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssignmentCourse(c);
                                    setLecturerAssignmentOpen(true);
                                  }}
                                  className="text-[11px] font-semibold text-primary hover:underline mt-1 cursor-pointer flex items-center gap-1"
                                >
                                  <UserPlus className="h-3 w-3" /> Assign Lecturers
                                </button>
                              </div>
                            </td>

                            {/* Column: Course In-Charge */}
                            <td className="px-5 py-4 min-w-[180px]">
                              <span className="text-xs font-medium text-foreground">
                                {inChargeName}
                              </span>
                            </td>

                            {/* Column: 1st Examiner / Marker (Displayed as name, not as colorful badge) */}
                            <td className="px-5 py-4 min-w-[200px]">
                              <div className="flex flex-col gap-1">
                                {hasPrimaryFirstMarker && primaryFirstMarkerName ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-medium text-foreground">
                                      {primaryFirstMarkerName}
                                    </span>
                                    {c.is_first_marker_same_as_in_charge === false && (
                                      <span className="text-[10px] text-muted-foreground font-semibold">
                                        (Separate)
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      disabled={isRowUpdating}
                                      onClick={() => handleRemovePrimaryFirstMarker(c)}
                                      className="text-muted-foreground hover:text-destructive transition cursor-pointer p-0.5"
                                      title="Remove primary 1st Marker (keeps slot empty)"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Unassigned</span>
                                )}

                                {/* Additional / Backup 1st Markers */}
                                {additionalFirstMarkers.map((addM: any, idx: number) => {
                                  const isAddExt = addM.type === 'EXTERNAL';
                                  const addLabel = isAddExt
                                    ? `${addM.name || 'External'} (Outside)`
                                    : addM.lecturer?.user
                                      ? formatNameWithTitle(
                                          addM.lecturer.user.full_name,
                                          addM.lecturer.user.nic_no,
                                        )
                                      : addM.name || 'Faculty Marker';
                                  return (
                                    <div
                                      key={addM.id || idx}
                                      className="flex items-center gap-1 text-xs text-foreground"
                                    >
                                      <span>
                                        #{idx + 2}: {addLabel}
                                      </span>
                                      <button
                                        type="button"
                                        disabled={isRowUpdating}
                                        onClick={() =>
                                          handleRemoveAdditionalFirstMarkerInline(c, addM.id)
                                        }
                                        className="text-muted-foreground hover:text-destructive transition cursor-pointer p-0.5"
                                        title="Remove additional 1st Marker"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>

                            {/* Column: 2nd Examiner / Marker (Displayed as name, not as colorful badge) */}
                            <td className="px-5 py-4 min-w-[180px]">
                              {hasSecondMarker && secondMarkerName !== 'Unassigned' ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium text-foreground">
                                    {secondMarkerName}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={isRowUpdating}
                                    onClick={() => handleRemoveSecondMarkerInline(c)}
                                    className="text-muted-foreground hover:text-destructive transition cursor-pointer p-0.5"
                                    title="Remove 2nd Marker"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Unassigned</span>
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
