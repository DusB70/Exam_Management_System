'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import CourseDialog from '../../../components/courses/course-dialog';
import LecturerAssignmentDialog from '../../../components/courses/lecturer-assignment-dialog';
import PeriodDialog from '../../../components/courses/period-dialog';
import MarkerDialog from '../../../components/courses/marker-dialog';
import UserDialog from '../../../components/users/user-dialog';
import {
  Search,
  BookOpen,
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Play,
  Pause,
  StopCircle,
  Edit3,
  UserCheck,
  User,
  UserPlus,
  Check,
  Users,
} from 'lucide-react';
import { UserRole } from '@ems/shared';

// Helper to fetch departments for courses filtering
const fetchDepartments = async () => {
  const response = await apiClient.get('/departments');
  return response.data?.data || [];
};

export default function CoursesManagementPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'courses' | 'periods' | 'lecturers'>('courses');
  const [lecturersSubTab, setLecturersSubTab] = useState<'examiners' | 'faculty'>('examiners');

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

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });

  // Fetch Lecturers for Assignments & Faculty Tab
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

  // Fetch Courses Lookup for assigning courses to lecturer
  const { data: coursesLookup = [] } = useQuery({
    queryKey: ['courses-lookup-list'],
    queryFn: async () => {
      const response = await apiClient.get('/reports/courses');
      return response.data?.data || [];
    },
    enabled: activeTab === 'lecturers' && lecturersSubTab === 'faculty',
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

  // Fetch Courses with filters (ordered by semester)
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
  });

  // Period Actions Handlers
  const handlePeriodStatusChange = async (periodId: number, status: string) => {
    try {
      await apiClient.patch(`/courses/periods/${periodId}/status`, { status });
      refetchPeriods();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update period status');
    }
  };

  const handleDeletePeriod = async (periodId: number) => {
    if (confirm('Are you sure you want to delete this registration window?')) {
      try {
        await apiClient.delete(`/courses/periods/${periodId}`);
        refetchPeriods();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to delete registration window.');
      }
    }
  };

  const handleSaveEndDate = async (periodId: number) => {
    if (!editingEndDateValue) return;
    try {
      await apiClient.patch(`/courses/periods/${periodId}/end-date`, {
        endDate: new Date(editingEndDateValue).toISOString(),
      });
      setEditingEndDatePeriodId(null);
      refetchPeriods();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update end date.');
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
    if (confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
      try {
        await apiClient.delete(`/courses/${courseId}`);
        refetchCourses();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to delete course');
      }
    }
  };

  const handleAddNewLecturer = () => {
    setSelectedUserForEdit({ role_id: 3 }); // Preset to Lecturer role
    setUserDialogOpen(true);
  };

  const courses = courseData?.items || [];
  const totalPages = courseData?.totalPages || 1;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Courses & Curriculum Management</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Manage course catalog, registration windows, semester structures, and lecturer/examiner
            allocations.
          </p>
        </div>

        {isAdminOrStaff && (
          <div className="flex items-center gap-3">
            {activeTab === 'courses' && (
              <button
                onClick={handleCreateCourse}
                className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Add New Course
              </button>
            )}
            {activeTab === 'periods' && (
              <button
                onClick={() => setPeriodDialogOpen(true)}
                className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Open Registration Window
              </button>
            )}
            {activeTab === 'lecturers' && (
              <button
                onClick={handleAddNewLecturer}
                className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" /> Add New Lecturer
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs Control */}
      <div className="flex border-b border-border/60">
        <button
          onClick={() => setActiveTab('courses')}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'courses'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="h-4 w-4" /> Course Catalog ({courseData?.total || 0})
        </button>
        <button
          onClick={() => setActiveTab('periods')}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'periods'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="h-4 w-4" /> Registration Windows ({periods.length})
        </button>
        {isAdminOrStaff && (
          <button
            onClick={() => setActiveTab('lecturers')}
            className={`px-6 py-3 font-semibold text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'lecturers'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
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
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-card/25 border border-border/80 p-5 rounded-2xl backdrop-blur-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search course code or title..."
                value={courseSearch}
                onChange={(e) => {
                  setCourseSearch(e.target.value);
                  setCoursePage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-xs text-foreground"
              />
            </div>

            <div>
              <select
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  setCoursePage(1);
                }}
                className="w-full px-4 py-2 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-xs text-foreground"
              >
                <option value="">All Departments</option>
                {departments.map((d: any) => (
                  <option key={d.department_id} value={d.department_id} className="bg-card">
                    {d.department_name}
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
                className="w-full px-4 py-2 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-xs text-foreground"
              >
                <option value="">All Degree Programs</option>
                {degrees.map((deg: any) => (
                  <option key={deg.degree_id} value={deg.degree_id} className="bg-card">
                    {deg.degree_code} - {deg.degree_name}
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
                className="w-full px-4 py-2 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-xs text-foreground"
              >
                <option value="">All Semesters (Ordered)</option>
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
          </div>

          {/* Courses Table */}
          <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                    <th className="px-6 py-4">Semester</th>
                    <th className="px-6 py-4">Course Code</th>
                    <th className="px-6 py-4">Course Name</th>
                    <th className="px-6 py-4">Department</th>
                    <th className="px-6 py-4">Degrees</th>
                    <th className="px-6 py-4">Credits</th>
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
                          Loading courses catalog (ordered by semester)...
                        </span>
                      </td>
                    </tr>
                  ) : courses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isAdminOrStaff ? 7 : 6}
                        className="text-center py-20 text-muted-foreground"
                      >
                        No courses found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    courses.map((course: any) => (
                      <tr
                        key={course.course_id}
                        className="hover:bg-secondary/15 transition-colors"
                      >
                        <td className="px-6 py-4.5 font-bold font-mono text-primary text-xs">
                          Sem {course.semester}
                        </td>
                        <td className="px-6 py-4.5 font-bold text-foreground font-mono">
                          {course.course_code}
                        </td>
                        <td className="px-6 py-4.5 text-foreground">{course.course_name}</td>
                        <td className="px-6 py-4.5 text-xs text-muted-foreground uppercase font-semibold">
                          {course.department?.department_code}
                        </td>
                        <td className="px-6 py-4.5">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {course.degrees && course.degrees.length > 0 ? (
                              course.degrees.map((d: any) => (
                                <span
                                  key={d.degree_id}
                                  className="inline-block px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-[10px] font-bold font-mono"
                                >
                                  {d.degree?.degree_code || d.degree_id}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground/60 italic">None</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4.5 font-mono text-xs">{course.credit_value}</td>
                        {isAdminOrStaff && (
                          <td className="px-6 py-4.5 text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => handleEditCourse(course)}
                              className="px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg transition text-xs font-semibold cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteCourse(course.course_id)}
                              className="px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg transition text-xs font-semibold cursor-pointer"
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-border/80 flex items-center justify-between bg-secondary/10">
                <span className="text-xs text-muted-foreground">
                  Page {coursePage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCoursePage((p) => Math.max(1, p - 1))}
                    disabled={coursePage === 1}
                    className="p-1.5 bg-secondary rounded-lg text-muted-foreground disabled:opacity-50 cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setCoursePage((p) => Math.min(totalPages, p + 1))}
                    disabled={coursePage === totalPages}
                    className="p-1.5 bg-secondary rounded-lg text-muted-foreground disabled:opacity-50 cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: REGISTRATION WINDOWS */}
      {/* ========================================== */}
      {activeTab === 'periods' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
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
                        colSpan={isAdminOrStaff ? 7 : 6}
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
                        colSpan={isAdminOrStaff ? 7 : 6}
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
                      const isMedicalRepeat =
                        p.window_type === 'MEDICAL_REPEAT_REGISTRATION' ||
                        p.window_type === 'PROPER_REPEAT_REGISTRATION';

                      const isEditingEnd = editingEndDatePeriodId === p.period_id;

                      return (
                        <tr key={p.period_id} className="hover:bg-secondary/15 transition-colors">
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
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition text-xs font-semibold cursor-pointer"
                                >
                                  <Play className="h-3 w-3" />
                                  Open
                                </button>
                              )}
                              {isOpen && (
                                <button
                                  onClick={() => handlePeriodStatusChange(p.period_id, 'SUSPENDED')}
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
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg transition text-xs font-semibold cursor-pointer"
                                title="Delete Window"
                              >
                                <Trash2 className="h-3 w-3" />
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
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 3: LECTURER & EXAMINER ALLOCATIONS */}
      {/* ========================================== */}
      {activeTab === 'lecturers' && isAdminOrStaff && (
        <div className="space-y-6 animate-fadeIn">
          {/* Sub-Navigation Bar */}
          <div className="flex border-b border-border/60">
            <button
              onClick={() => setLecturersSubTab('examiners')}
              className={`px-6 py-3 font-semibold text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
                lecturersSubTab === 'examiners'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserCheck className="h-4 w-4" />
              Course Examiner Allocations
            </button>
            <button
              onClick={() => setLecturersSubTab('faculty')}
              className={`px-6 py-3 font-semibold text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
                lecturersSubTab === 'faculty'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-4 w-4" />
              Faculty Lecturers Directory & Management
            </button>
          </div>

          {/* SUB-TAB 1: COURSE EXAMINER ALLOCATIONS */}
          {lecturersSubTab === 'examiners' && (
            <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
              <div className="px-6 py-4 border-b border-border/60 bg-secondary/15 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Course Examiner Allocations
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Assign 1st Examiner (default course lecturer or external 1st marker) and 2nd
                    Examiner (internal or external 2nd marker) per course subject.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                      <th className="px-6 py-4">Semester</th>
                      <th className="px-6 py-4">Course Code & Name</th>
                      <th className="px-6 py-4">Department</th>
                      <th className="px-6 py-4">1st Examiner / Marker</th>
                      <th className="px-6 py-4">2nd Examiner / Marker</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-medium">
                    {isCoursesLoading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-20 text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                            Loading course marker allocations...
                          </span>
                        </td>
                      </tr>
                    ) : courses.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-20 text-muted-foreground">
                          No courses found in the database.
                        </td>
                      </tr>
                    ) : (
                      courses.map((c: any) => {
                        const isFirstExt = c.first_marker_type === 'EXTERNAL';
                        const firstMarkerName = isFirstExt
                          ? c.first_marker_name
                            ? `${c.first_marker_name} (External)`
                            : 'External Marker'
                          : c.first_marker_lecturer?.user?.full_name ||
                            c.lecturers?.[0]?.lecturer?.user?.full_name ||
                            'Unassigned';

                        const isSecondExt = c.second_marker_type === 'EXTERNAL';
                        const secondMarkerName = isSecondExt
                          ? c.second_marker_name
                            ? `${c.second_marker_name} (External)`
                            : 'External 2nd Marker'
                          : c.second_marker_lecturer?.user?.full_name || 'Unassigned';

                        return (
                          <tr key={c.course_id} className="hover:bg-secondary/15 transition-colors">
                            <td className="px-6 py-4 font-bold font-mono text-primary text-xs">
                              Sem {c.semester}
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-foreground font-mono">
                                {c.course_code}
                              </div>
                              <div className="text-xs text-muted-foreground">{c.course_name}</div>
                            </td>
                            <td className="px-6 py-4 text-xs text-muted-foreground uppercase font-semibold">
                              {c.department?.department_code}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                  isFirstExt
                                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                    : firstMarkerName !== 'Unassigned'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-secondary text-muted-foreground/60'
                                }`}
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                {firstMarkerName}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                  isSecondExt
                                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                    : secondMarkerName !== 'Unassigned'
                                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                      : 'bg-secondary text-muted-foreground/60'
                                }`}
                              >
                                <User className="h-3.5 w-3.5" />
                                {secondMarkerName}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
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
            </div>
          )}

          {/* SUB-TAB 2: FACULTY LECTURERS DIRECTORY */}
          {lecturersSubTab === 'faculty' && (
            <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
              <div className="px-6 py-4 border-b border-border/60 bg-secondary/15 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Faculty Lecturers Directory
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Add new academic lecturers, manage department allocations, and view assigned
                    classes.
                  </p>
                </div>
                <button
                  onClick={handleAddNewLecturer}
                  className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <UserPlus className="h-4 w-4" /> Add New Lecturer
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                      <th className="px-6 py-4">Lecturer Name</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Department</th>
                      <th className="px-6 py-4">Assigned Courses</th>
                      <th className="px-6 py-4 text-right">Course Allocation</th>
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
                        <tr
                          key={lec.lecturer_id}
                          className="hover:bg-secondary/15 transition-colors"
                        >
                          <td className="px-6 py-4 font-bold text-foreground">
                            {lec.user?.full_name}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground text-xs">
                            {lec.user?.email}
                          </td>
                          <td className="px-6 py-4 text-xs text-muted-foreground uppercase font-semibold">
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
                                  e.target.value = '';
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
          )}
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
        onSuccess={refetchCourses}
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
    </div>
  );
}
