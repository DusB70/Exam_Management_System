'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import CourseDialog from '../../../components/courses/course-dialog';
import LecturerAssignmentDialog from '../../../components/courses/lecturer-assignment-dialog';
import PeriodDialog from '../../../components/courses/period-dialog';
import {
  Search,
  BookOpen,
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Trash2,
  AlertCircle,
  Play,
  Pause,
  StopCircle,
} from 'lucide-react';
import { UserRole } from '@ems/shared';

// Helper to fetch departments for courses filtering
const fetchDepartments = async () => {
  const response = await apiClient.get('/departments');
  return response.data?.data || [];
};

export default function CoursesManagementPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'courses' | 'periods' | 'lecturers'>('courses');

  // Filters State for Courses
  const [coursePage, setCoursePage] = useState(1);
  const [courseSearch, setCourseSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [degreeFilter, setDegreeFilter] = useState('');

  // Course Dialog States
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);

  // Lecturer Assignment Dialog States
  const [lecturerAssignmentOpen, setLecturerAssignmentOpen] = useState(false);
  const [assignmentCourse, setAssignmentCourse] = useState<any>(null);

  // Period Dialog States
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);

  const isAdminOrStaff =
    user?.role === UserRole.ADMINISTRATOR || user?.role === UserRole.EXAM_DIVISION_STAFF;

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });

  // Fetch Lecturers for Assignments Tab
  const {
    data: lecturersList = [],
    isLoading: isLecturersLoading,
    refetch: refetchLecturers,
  } = useQuery({
    queryKey: ['lecturers-list-assignment'],
    queryFn: async () => {
      const response = await apiClient.get('/lecturers');
      return response.data?.data || [];
    },
    enabled: activeTab === 'lecturers',
  });

  // Fetch Courses Lookup
  const { data: coursesLookup = [] } = useQuery({
    queryKey: ['courses-lookup-list'],
    queryFn: async () => {
      const response = await apiClient.get('/reports/courses');
      return response.data?.data || [];
    },
    enabled: activeTab === 'lecturers',
  });

  const handleAssignCourseToLecturer = async (courseId: number, lecturerId: number) => {
    try {
      await apiClient.post(`/courses/${courseId}/lecturers`, { lecturerId });
      refetchLecturers();
      refetchCourses();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to assign lecturer.');
    }
  };

  const handleRemoveCourseFromLecturer = async (courseId: number, lecturerId: number) => {
    if (confirm('Are you sure you want to remove this course assignment?')) {
      try {
        await apiClient.delete(`/courses/${courseId}/lecturers/${lecturerId}`);
        refetchLecturers();
        refetchCourses();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to remove lecturer.');
      }
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

  // Fetch Courses with filters
  const {
    data: courseData,
    isLoading: isCoursesLoading,
    refetch: refetchCourses,
  } = useQuery({
    queryKey: ['courses', coursePage, courseSearch, deptFilter, semesterFilter, degreeFilter],
    queryFn: async () => {
      const params: any = {
        page: coursePage,
        limit: 10,
        search: courseSearch || undefined,
        departmentId: deptFilter || undefined,
        semester: semesterFilter || undefined,
        degreeId: degreeFilter || undefined,
      };
      const response = await apiClient.get('/courses', { params });
      return response.data?.data;
    },
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
    enabled: activeTab === 'periods',
  });

  // Delete Course Mutation
  const deleteCourseMutation = useMutation({
    mutationFn: async (courseId: number) => {
      await apiClient.delete(`/courses/${courseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });

  // Update Period Status Mutation
  const updatePeriodStatusMutation = useMutation({
    mutationFn: async ({ periodId, status }: { periodId: number; status: string }) => {
      const response = await apiClient.patch(`/courses/periods/${periodId}/status`, { status });
      return response.data?.data;
    },
    onSuccess: (updatedPeriod) => {
      if (updatedPeriod) {
        queryClient.setQueryData(['registration-periods'], (oldPeriods: any) => {
          if (!Array.isArray(oldPeriods)) return [updatedPeriod];
          return oldPeriods.map((p: any) =>
            p.period_id === updatedPeriod.period_id ? updatedPeriod : p,
          );
        });
      }
      queryClient.invalidateQueries({ queryKey: ['registration-periods'] });
      refetchPeriods();
    },
  });

  const handleCreateCourse = () => {
    setSelectedCourse(null);
    setCourseDialogOpen(true);
  };

  const handleEditCourse = (course: any) => {
    setSelectedCourse(course);
    setCourseDialogOpen(true);
  };

  const handleDeleteCourse = (courseId: number) => {
    if (confirm('Are you sure you want to delete this course? This action is irreversible.')) {
      deleteCourseMutation.mutate(courseId);
    }
  };

  const handleAssignLecturers = (course: any) => {
    setAssignmentCourse(course);
    setLecturerAssignmentOpen(true);
  };

  const handlePeriodStatusChange = (periodId: number, status: string) => {
    updatePeriodStatusMutation.mutate({ periodId, status });
  };

  const courses = courseData?.items || [];
  const totalCoursePages = courseData?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Courses & Semesters</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Manage course curriculum, instructor assignments, and academic enrollment windows
          </p>
        </div>
        {isAdminOrStaff && (
          <div className="flex flex-wrap gap-3">
            {activeTab === 'courses' && (
              <button
                onClick={handleCreateCourse}
                className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition shadow-lg shadow-primary/20 text-sm"
              >
                <Plus className="h-4.5 w-4.5" />
                Add Course
              </button>
            )}
            {activeTab === 'periods' && (
              <button
                onClick={() => setPeriodDialogOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition shadow-lg shadow-primary/20 text-sm"
              >
                <Calendar className="h-4.5 w-4.5" />
                Open Window
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/60 pb-px mb-6">
        <button
          onClick={() => setActiveTab('courses')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'courses'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Course Catalog
        </button>
        <button
          onClick={() => setActiveTab('periods')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'periods'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Registration Windows
        </button>
        {isAdminOrStaff && (
          <button
            onClick={() => setActiveTab('lecturers')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'lecturers'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            Lecturer Assignments
          </button>
        )}
      </div>

      {/* Tabs Content */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-card/20 border border-border/60 p-4 rounded-2xl backdrop-blur-md">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by code or title..."
                value={courseSearch}
                onChange={(e) => {
                  setCourseSearch(e.target.value);
                  setCoursePage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
              />
            </div>

            <div>
              <select
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  setCoursePage(1);
                }}
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
              >
                <option value="">All Departments</option>
                {departments.map((dept: any) => (
                  <option key={dept.department_id} value={dept.department_id} className="bg-card">
                    {dept.department_code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={semesterFilter}
                onChange={(e) => {
                  setSemesterFilter(e.target.value);
                  setCoursePage(1);
                }}
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
              >
                <option value="">All Semesters</option>
                {['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'].map((s) => (
                  <option key={s} value={s} className="bg-card">
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={degreeFilter}
                onChange={(e) => {
                  setDegreeFilter(e.target.value);
                  setCoursePage(1);
                }}
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
              >
                <option value="">All Degrees</option>
                {degrees.map((deg: any) => (
                  <option key={deg.degree_id} value={deg.degree_id} className="bg-card">
                    {deg.degree_code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Courses Table */}
          <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                    <th className="px-6 py-4">Course Code</th>
                    <th className="px-6 py-4">Course Name</th>
                    <th className="px-6 py-4">Lecturer</th>
                    <th className="px-6 py-4">Credits</th>
                    <th className="px-6 py-4">Dept</th>
                    <th className="px-6 py-4">Semester</th>
                    <th className="px-6 py-4">Degree / Specialization</th>
                    {isAdminOrStaff && <th className="px-6 py-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-sm font-medium">
                  {isCoursesLoading ? (
                    <tr>
                      <td
                        colSpan={isAdminOrStaff ? 7 : 6}
                        className="text-center py-20 text-muted-foreground"
                      >
                        <span className="inline-flex items-center gap-2">
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                          Loading courses list...
                        </span>
                      </td>
                    </tr>
                  ) : courses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isAdminOrStaff ? 8 : 7}
                        className="text-center py-20 text-muted-foreground"
                      >
                        No courses found. Add courses to populate database.
                      </td>
                    </tr>
                  ) : (
                    courses.map((course: any) => (
                      <tr
                        key={course.course_id}
                        className="hover:bg-secondary/15 transition-colors"
                      >
                        <td className="px-6 py-4.5 font-bold font-mono text-primary text-xs uppercase">
                          {course.course_code}
                        </td>
                        <td className="px-6 py-4.5 font-semibold text-foreground">
                          {course.course_name}
                        </td>
                        <td className="px-6 py-4.5 text-muted-foreground text-xs font-semibold">
                          {course.lecturers && course.lecturers.length > 0
                            ? course.lecturers
                                .map((l: any) => l.lecturer?.user?.full_name)
                                .filter(Boolean)
                                .join(', ')
                            : 'Assign Later'}
                        </td>
                        <td className="px-6 py-4.5 font-mono text-muted-foreground">
                          {parseFloat(course.credit_value)}
                        </td>
                        <td className="px-6 py-4.5 text-xs text-muted-foreground uppercase">
                          {course.department?.department_code}
                        </td>
                        <td className="px-6 py-4.5 font-mono text-muted-foreground">
                          Sem {course.semester}
                        </td>
                        <td className="px-6 py-4.5 text-xs font-semibold text-muted-foreground">
                          {course.degrees && course.degrees.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {course.degrees.map((cd: any) => (
                                <span
                                  key={cd.degree_id}
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                    cd.status === 'COMPULSORY'
                                      ? 'bg-primary/10 text-primary border-primary/20'
                                      : 'bg-secondary text-secondary-foreground border-border/80'
                                  }`}
                                  title={cd.degree?.degree_name}
                                >
                                  {cd.degree?.degree_code} ({cd.status === 'COMPULSORY' ? 'C' : 'O'}
                                  )
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">No degree assigned</span>
                          )}
                        </td>
                        {isAdminOrStaff && (
                          <td className="px-6 py-4.5 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => handleAssignLecturers(course)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/25 rounded-lg transition text-xs font-bold"
                              title="Assign Lecturers"
                            >
                              <GraduationCap className="h-3.5 w-3.5" />
                              Instructors
                            </button>
                            <button
                              onClick={() => handleEditCourse(course)}
                              className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition text-xs font-semibold"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteCourse(course.course_id)}
                              className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition"
                              title="Delete Course"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            {totalCoursePages > 1 && (
              <div className="px-6 py-4 border-t border-border/80 flex items-center justify-between bg-secondary/10">
                <span className="text-xs font-medium text-muted-foreground">
                  Page {coursePage} of {totalCoursePages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCoursePage((p) => Math.max(p - 1, 1))}
                    disabled={coursePage === 1}
                    className="p-1.5 bg-secondary hover:bg-secondary/90 disabled:opacity-40 text-foreground rounded-lg transition border border-border/60"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setCoursePage((p) => Math.min(p + 1, totalCoursePages))}
                    disabled={coursePage === totalCoursePages}
                    className="p-1.5 bg-secondary hover:bg-secondary/90 disabled:opacity-40 text-foreground rounded-lg transition border border-border/60"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'periods' && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="p-4 bg-primary/5 border border-primary/15 rounded-2xl flex gap-3 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground mb-0.5">Understanding Registration Windows</p>
              <p>
                To register for courses, students must have an <strong>OPEN</strong> window that
                matches their semester. If the status is <strong>SUSPENDED</strong> or{' '}
                <strong>CLOSED</strong>, registration is restricted. Only one window can be active
                (OPEN) per academic year/semester combo.
              </p>
            </div>
          </div>

          {/* Periods Table */}
          <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                    <th className="px-6 py-4">Academic Year</th>
                    <th className="px-6 py-4">Semester</th>
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
                        colSpan={isAdminOrStaff ? 6 : 5}
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
                        colSpan={isAdminOrStaff ? 6 : 5}
                        className="text-center py-20 text-muted-foreground"
                      >
                        No registration periods have been created yet.
                      </td>
                    </tr>
                  ) : (
                    periods.map((p: any) => {
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

                      return (
                        <tr key={p.period_id} className="hover:bg-secondary/15 transition-colors">
                          <td className="px-6 py-4.5 font-semibold text-foreground">
                            {p.academic_year}
                          </td>
                          <td className="px-6 py-4.5 font-mono text-muted-foreground">
                            Semester {p.semester}
                          </td>
                          <td className="px-6 py-4.5 text-muted-foreground">{startStr}</td>
                          <td className="px-6 py-4.5 text-muted-foreground">{endStr}</td>
                          <td className="px-6 py-4.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                isOpen
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : isSuspended
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  isOpen
                                    ? 'bg-emerald-400'
                                    : isSuspended
                                      ? 'bg-amber-400'
                                      : 'bg-red-400'
                                }`}
                              />
                              {p.status}
                            </span>
                          </td>
                          {isAdminOrStaff && (
                            <td className="px-6 py-4.5 text-right space-x-1.5 whitespace-nowrap">
                              {!isOpen && (
                                <button
                                  onClick={() => handlePeriodStatusChange(p.period_id, 'OPEN')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition text-xs font-semibold"
                                >
                                  <Play className="h-3 w-3" />
                                  Open
                                </button>
                              )}
                              {isOpen && (
                                <button
                                  onClick={() => handlePeriodStatusChange(p.period_id, 'SUSPENDED')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg transition text-xs font-semibold"
                                >
                                  <Pause className="h-3 w-3" />
                                  Suspend
                                </button>
                              )}
                              {p.status !== 'CLOSED' && (
                                <button
                                  onClick={() => handlePeriodStatusChange(p.period_id, 'CLOSED')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition text-xs font-semibold"
                                >
                                  <StopCircle className="h-3 w-3" />
                                  Close
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'lecturers' && isAdminOrStaff && (
        <div className="space-y-6 animate-fadeIn">
          {/* Lecturers Table */}
          <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                    <th className="px-6 py-4">Lecturer Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Department</th>
                    <th className="px-6 py-4">Assigned Courses</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-sm font-medium">
                  {isLecturersLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-20 text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                          Loading lecturers list...
                        </span>
                      </td>
                    </tr>
                  ) : lecturersList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-20 text-muted-foreground">
                        No lecturers found in the database.
                      </td>
                    </tr>
                  ) : (
                    lecturersList.map((lec: any) => (
                      <tr key={lec.lecturer_id} className="hover:bg-secondary/15 transition-colors">
                        <td className="px-6 py-4 font-bold text-foreground">
                          {lec.user?.full_name}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground text-xs">
                          {lec.user?.email}
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground uppercase">
                          {lec.department?.department_name}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {lec.courses && lec.courses.length > 0 ? (
                              lec.courses.map((c: any) => (
                                <span
                                  key={c.course?.course_id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-bold font-mono"
                                >
                                  {c.course?.course_code}
                                  <button
                                    onClick={() =>
                                      handleRemoveCourseFromLecturer(
                                        c.course?.course_id,
                                        lec.lecturer_id,
                                      )
                                    }
                                    className="hover:text-destructive hover:bg-destructive/10 rounded p-0.5"
                                    title="Unassign course"
                                  >
                                    ✕
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground/60 italic">
                                No courses assigned
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <select
                            onChange={(e) => {
                              const courseId = parseInt(e.target.value, 10);
                              if (courseId) {
                                handleAssignCourseToLecturer(courseId, lec.lecturer_id);
                                e.target.value = ''; // Reset select
                              }
                            }}
                            className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition text-xs font-semibold"
                          >
                            <option value="">+ Assign Course...</option>
                            {coursesLookup
                              .filter(
                                (c: any) =>
                                  !lec.courses?.some(
                                    (ac: any) => ac.course?.course_id === c.course_id,
                                  ),
                              )
                              .map((c: any) => (
                                <option key={c.course_id} value={c.course_id}>
                                  {c.course_code} - {c.course_name}
                                </option>
                              ))}
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CourseDialog
        open={courseDialogOpen}
        onClose={() => setCourseDialogOpen(false)}
        course={selectedCourse}
        onSuccess={refetchCourses}
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
            queryClient.setQueryData(['registration-periods'], (oldPeriods: any) => {
              if (!Array.isArray(oldPeriods)) return [newPeriod];
              return [newPeriod, ...oldPeriods];
            });
          }
          queryClient.invalidateQueries({ queryKey: ['registration-periods'] });
          refetchPeriods();
          setPeriodDialogOpen(false);
        }}
      />
    </div>
  );
}
