'use client';

import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import {
  Users,
  BookOpen,
  Clock,
  Calendar,
  Database,
  Activity,
  Search,
  Loader2,
  Shield,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  X,
} from 'lucide-react';
import Link from 'next/link';
import { UserRole } from '@ems/shared';

const STABLE_EMPTY_ARRAY: any[] = [];

export default function DashboardOverview() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [nonFilledSearch, setNonFilledSearch] = useState<string>('');
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Lecturer Portal Dashboard States
  const [reviewCourse, setReviewCourse] = useState<any>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isActioning, setIsActioning] = useState(false);

  // Admin stats query
  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['system-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/system/stats');
      return response.data?.data;
    },
    enabled: user?.role === UserRole.ADMINISTRATOR,
  });

  // Staff overview query
  const { data: staffOverview, isLoading: isStaffOverviewLoading } = useQuery({
    queryKey: ['staff-overview', selectedBatch],
    queryFn: async () => {
      const response = await apiClient.get('/reports/staff-overview', {
        params: selectedBatch ? { batch: selectedBatch } : undefined,
      });
      return response.data?.data;
    },
    enabled: user?.role === UserRole.EXAM_DIVISION_STAFF,
  });

  // Staff pending approvals query
  const { data: pendingApprovalsData, isLoading: isPendingApprovalsLoading } = useQuery({
    queryKey: ['pending-approvals-staff'],
    queryFn: async () => {
      const response = await apiClient.get('/marks/pending-approvals');
      return response.data?.data || [];
    },
    enabled: user?.role === UserRole.EXAM_DIVISION_STAFF,
  });
  const pendingApprovals = Array.isArray(pendingApprovalsData)
    ? pendingApprovalsData
    : STABLE_EMPTY_ARRAY;

  // Lecturer assigned courses query
  const { data: lecturerCoursesData, isLoading: isLecturerCoursesLoading } = useQuery({
    queryKey: ['lecturer-courses'],
    queryFn: async () => {
      const response = await apiClient.get('/marks/my-courses');
      return response.data?.data || [];
    },
    enabled: user?.role === UserRole.LECTURER,
  });
  const lecturerCourses = Array.isArray(lecturerCoursesData)
    ? lecturerCoursesData
    : STABLE_EMPTY_ARRAY;

  // HOD / Dean pending approvals query
  const {
    data: headPendingApprovalsData = [],
    isLoading: isHeadPendingApprovalsLoading,
    refetch: refetchHeadPending,
  } = useQuery({
    queryKey: ['head-pending-approvals'],
    queryFn: async () => {
      const response = await apiClient.get('/marks/head/pending-approvals');
      return response.data?.data || [];
    },
    enabled: user?.role === UserRole.LECTURER && (user?.isHead || user?.isDean),
  });

  // Review course grid data query
  const { data: gridData, isLoading: isGridLoading } = useQuery({
    queryKey: ['review-course-grid', reviewCourse?.course_id],
    queryFn: async () => {
      const response = await apiClient.get(`/marks/courses/${reviewCourse.course_id}/grid`);
      return response.data?.data;
    },
    enabled: !!reviewCourse,
  });

  const handleReviewCourse = (course: any) => {
    setReviewCourse(course);
    setIsRejecting(false);
    setRejectReason('');
  };

  const submitApproval = async () => {
    if (!reviewCourse || isActioning) return;
    setIsActioning(true);
    try {
      await apiClient.post(`/marks/courses/${reviewCourse.course_id}/head-approve`);
      await refetchHeadPending();
      setReviewCourse(null);
    } catch (err) {
      console.error('Error approving marksheet:', err);
    } finally {
      setIsActioning(false);
    }
  };

  const submitRejection = async () => {
    if (!reviewCourse || !rejectReason.trim() || isActioning) return;
    setIsActioning(true);
    try {
      await apiClient.post(`/marks/courses/${reviewCourse.course_id}/head-reject`, {
        reason: rejectReason.trim(),
      });
      await refetchHeadPending();
      setReviewCourse(null);
    } catch (err) {
      console.error('Error rejecting marksheet:', err);
    } finally {
      setIsActioning(false);
    }
  };

  // Fetch active registration period (only for student)
  const { data: activePeriod } = useQuery({
    queryKey: ['active-period-dashboard'],
    queryFn: async () => {
      const response = await apiClient.get('/registrations/active-period');
      return response.data?.data;
    },
    enabled: user?.role === UserRole.STUDENT,
  });

  // Fetch eligible courses for registration (only for student)
  const { data: eligibleCourses = [] } = useQuery({
    queryKey: ['eligible-courses-dashboard'],
    queryFn: async () => {
      const response = await apiClient.get('/registrations/eligible-courses');
      return response.data?.data || [];
    },
    enabled: user?.role === UserRole.STUDENT,
  });

  // Fetch current registrations (only for student)
  const { data: myRegistrations = [] } = useQuery({
    queryKey: ['my-registrations-dashboard'],
    queryFn: async () => {
      const response = await apiClient.get('/registrations/my-registrations');
      return response.data?.data || [];
    },
    enabled: user?.role === UserRole.STUDENT,
  });

  // Group courses by batch and semester
  const groupedCourses: { [batch: string]: { [semester: string]: any[] } } = {};
  lecturerCourses.forEach((course: any) => {
    const batch = `Batch ${course.academic_year}`;
    const semester = `Semester ${course.semester}`;
    if (!groupedCourses[batch]) {
      groupedCourses[batch] = {};
    }
    if (!groupedCourses[batch][semester]) {
      groupedCourses[batch][semester] = [];
    }
    groupedCourses[batch][semester].push(course);
  });

  const cards = [
    {
      title: 'Current Semester',
      value: 'Semester 1',
      desc: 'Academic Year 2026',
      icon: Clock,
      color: 'text-primary bg-primary/10 border-primary/20',
    },
    {
      title: 'Registered Courses',
      value: '5 Courses',
      desc: '15.0 Credits Total',
      icon: BookOpen,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Active Students',
      value: '1,240 Enrolled',
      desc: 'Across 3 Departments',
      icon: Users,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    },
  ];

  const handleSwitchRole = async (role: UserRole) => {
    if (user?.role === role || isSwitching) return;
    setIsSwitching(true);
    setSwitchError(null);

    const credentialsMap = {
      [UserRole.ADMINISTRATOR]: { email: 'admin@ems.com', password: 'AdminPassword123' },
      [UserRole.EXAM_DIVISION_STAFF]: { email: 'staff@ems.com', password: 'StaffPassword123' },
      [UserRole.LECTURER]: { email: 'lecturer@ems.com', password: 'LecturerPassword123' },
      [UserRole.STUDENT]: { email: 'student@ems.com', password: 'StudentPassword123' },
    };

    const creds = credentialsMap[role];
    try {
      const response = await apiClient.post('/auth/login', creds);
      if (response.data?.success && response.data?.user) {
        setUser(response.data.user);
        // Clear all cached query data and trigger refetch
        await queryClient.invalidateQueries();
      } else {
        setSwitchError('Failed to switch role session.');
      }
    } catch (err) {
      console.error('Error switching role:', err);
      setSwitchError('Connection error occurred while switching role.');
    } finally {
      setIsSwitching(false);
    }
  };

  const renderDashboardContent = () => {
    // Administrator Dashboard
    if (user?.role === UserRole.ADMINISTRATOR) {
      const adminCards = [
        {
          title: 'Total System Users',
          value: isStatsLoading ? '...' : `${stats?.totalUsers || 0} Registered`,
          desc: `Students: ${stats?.totalStudents || 0} | Lecturers: ${stats?.totalLecturers || 0}`,
          icon: Users,
          color: 'text-primary bg-primary/10 border-primary/20',
        },
        {
          title: 'Database Status',
          value: isStatsLoading ? '...' : 'Online & Healthy',
          desc: 'Prisma ORM | PostgreSQL',
          icon: Database,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        },
        {
          title: 'System Audit Logs',
          value: isStatsLoading ? '...' : `${stats?.totalLogs || 0} Actions`,
          desc: 'Tracking admin & staff actions',
          icon: Activity,
          color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        },
      ];

      return (
        <div className="space-y-8 animate-fadeIn">
          {/* Admin Welcome Banner */}
          <div className="relative overflow-hidden bg-card/30 border border-border/60 p-8 rounded-3xl backdrop-blur-md">
            <div className="absolute -top-[100%] -right-[30%] h-[200%] w-[50%] rounded-full bg-primary/15 blur-[100px]" />
            <div className="relative z-10 space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/15">
                Admin Overseer Active
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Welcome back, {user?.fullName}!
              </h1>
              <p className="text-muted-foreground text-sm max-w-xl">
                You are logged in as{' '}
                <span className="font-semibold text-foreground">{user?.role}</span>. Oversee EMS
                user records, trigger system backups, and review audit logs from this central
                dashboard.
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {adminCards.map((card) => (
              <div
                key={card.title}
                className="bg-card/25 border border-border/80 p-6 rounded-2xl flex items-center justify-between backdrop-blur-sm shadow-lg"
              >
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {card.title}
                  </span>
                  <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.desc}</p>
                </div>
                <div className={`p-3 rounded-xl border ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
            ))}
          </div>

          {/* Functional Admin Actions Grid */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold">System Overseer Operations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link
                href="/users"
                className="p-5 bg-card/20 hover:bg-secondary/40 border border-border/60 hover:border-primary/45 rounded-2xl transition flex items-start gap-4 group shadow-md"
              >
                <div className="p-3 bg-secondary rounded-xl text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">User Directory</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add, modify, or disable academic student, lecturer, or staff accounts.
                  </p>
                </div>
              </Link>

              <Link
                href="/backup"
                className="p-5 bg-card/20 hover:bg-secondary/40 border border-border/60 hover:border-primary/45 rounded-2xl transition flex items-start gap-4 group shadow-md"
              >
                <div className="p-3 bg-secondary rounded-xl text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Database Backup</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Generate and download complete PostgreSQL system database exports in JSON
                    formats.
                  </p>
                </div>
              </Link>

              <Link
                href="/logs"
                className="p-5 bg-card/20 hover:bg-secondary/40 border border-border/60 hover:border-primary/45 rounded-2xl transition flex items-start gap-4 group shadow-md"
              >
                <div className="p-3 bg-secondary rounded-xl text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">System Audit Logs</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check log records tracking all faculty and admin database updates.
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      );
    }

    // Exam Division Staff Dashboard
    if (user?.role === UserRole.EXAM_DIVISION_STAFF) {
      const staffCards = [
        {
          title: 'Students Currently Learning',
          value: isStaffOverviewLoading
            ? '...'
            : `${staffOverview?.studentsCurrentlyLearning || 0} Enrolled`,
          desc: 'Based on latest course registrations',
          icon: Users,
          color: 'text-primary bg-primary/10 border-primary/20',
        },
        {
          title: 'Total Faculty Students',
          value: isStaffOverviewLoading ? '...' : `${staffOverview?.totalStudents || 0} Total`,
          desc: 'Registered student accounts',
          icon: Users,
          color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        },
        {
          title: 'Total Available Courses',
          value: isStaffOverviewLoading ? '...' : `${staffOverview?.totalCourses || 0} Courses`,
          desc: 'Curriculum catalog total',
          icon: BookOpen,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        },
      ];

      const filteredNonFilled =
        staffOverview?.batchDetails?.nonFilledStudents?.filter((s: any) => {
          const search = nonFilledSearch.toLowerCase();
          return (
            s.fullName?.toLowerCase()?.includes(search) ||
            s.registrationNumber?.toLowerCase()?.includes(search) ||
            s.email?.toLowerCase()?.includes(search)
          );
        }) || [];

      return (
        <div className="space-y-8 animate-fadeIn">
          {/* Welcome Banner */}
          <div className="relative overflow-hidden bg-card/30 border border-border/60 p-8 rounded-3xl backdrop-blur-md">
            <div className="absolute -top-[100%] -right-[30%] h-[200%] w-[50%] rounded-full bg-primary/15 blur-[100px]" />
            <div className="relative z-10 space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/15">
                Exam Division Staff Console
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Welcome back, {user?.fullName}!
              </h1>
              <p className="text-muted-foreground text-sm max-w-xl">
                Monitor student enrollments, track registrations per batch, manage evaluations, and
                publish semester results from this overview panel.
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {staffCards.map((card) => (
              <div
                key={card.title}
                className="bg-card/25 border border-border/80 p-6 rounded-2xl flex items-center justify-between backdrop-blur-sm shadow-lg animate-fadeIn"
              >
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {card.title}
                  </span>
                  <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.desc}</p>
                </div>
                <div className={`p-3 rounded-xl border ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
            ))}
          </div>

          {/* Batch Filter & Statistics Section */}
          <div className="bg-card/20 border border-border/60 p-6 rounded-3xl backdrop-blur-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Batch Enrollment Monitor</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select an academic year to check registration progress
                </p>
              </div>
              <div className="w-full sm:w-60">
                <select
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  className="w-full px-4 py-2.5 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                >
                  <option value="">Choose Batch (Academic Year)...</option>
                  {staffOverview?.batches?.map((b: number) => (
                    <option key={b} value={b} className="bg-card">
                      Batch {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedBatch && staffOverview?.batchDetails && (
              <div className="space-y-6 animate-fadeIn">
                {/* Batch Stat Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-secondary/20 border border-border/40 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                      Current Semester
                    </span>
                    <p className="text-lg font-extrabold text-foreground mt-1">
                      Semester {staffOverview.batchDetails.semester}
                    </p>
                  </div>
                  <div className="p-4 bg-secondary/20 border border-border/40 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                      Offered Courses
                    </span>
                    <p className="text-lg font-extrabold text-foreground mt-1">
                      {staffOverview.batchDetails.availableCoursesCount} Courses
                    </p>
                  </div>
                  <div className="p-4 bg-secondary/20 border border-border/40 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                      Registered Students
                    </span>
                    <p className="text-lg font-extrabold text-emerald-400 mt-1">
                      {staffOverview.batchDetails.registeredCount} /{' '}
                      {staffOverview.batchDetails.totalStudentsCount}
                    </p>
                  </div>
                  <div className="p-4 bg-secondary/20 border border-border/40 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                      Non-Registered Students
                    </span>
                    <p className="text-lg font-extrabold text-destructive mt-1">
                      {staffOverview.batchDetails.nonFilledStudents.length} Students
                    </p>
                  </div>
                </div>

                {/* Non Filled Students Table */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <h4 className="text-sm font-bold text-foreground">
                      Non-Registered Students List
                    </h4>
                    <div className="relative w-full sm:w-72">
                      <input
                        type="text"
                        placeholder="Search non-registered..."
                        value={nonFilledSearch}
                        onChange={(e) => setNonFilledSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary transition text-xs"
                      />
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="border border-border/60 rounded-xl overflow-hidden shadow-md">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-border/60 bg-secondary/15 text-muted-foreground font-bold">
                          <th className="px-4 py-3">Registration No</th>
                          <th className="px-4 py-3">Full Name</th>
                          <th className="px-4 py-3">Email Address</th>
                          <th className="px-4 py-3">Phone Number</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-medium">
                        {filteredNonFilled.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center py-8 text-muted-foreground">
                              No students matching criteria are pending registration.
                            </td>
                          </tr>
                        ) : (
                          filteredNonFilled.map((student: any) => (
                            <tr
                              key={student.studentId}
                              className="hover:bg-secondary/10 transition-colors"
                            >
                              <td className="px-4 py-2.5 font-bold text-foreground">
                                {student.registrationNumber}
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground">
                                {student.fullName}
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground">{student.email}</td>
                              <td className="px-4 py-2.5 text-muted-foreground">
                                {student.phoneNumber}
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

            {!selectedBatch && (
              <div className="py-12 text-center text-muted-foreground text-sm border border-dashed border-border/60 rounded-2xl">
                Please choose a batch academic year from the dropdown above to display enrollment
                statistics and pending students.
              </div>
            )}
          </div>

          {/* Pending Marksheet Approvals section */}
          <div className="bg-card/20 border border-border/60 p-6 rounded-3xl backdrop-blur-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-foreground">Pending Marksheet Approvals</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review and approve marks submitted by lecturers to publish overall grades
              </p>
            </div>

            {isPendingApprovalsLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                Loading pending marksheets...
              </div>
            ) : pendingApprovals.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs border border-dashed border-border/60 rounded-2xl">
                No submitted marksheets are pending approval.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingApprovals.map((exam: any) => (
                  <div
                    key={exam.exam_id}
                    className="bg-card/25 border border-border/80 p-5 rounded-2xl flex flex-col justify-between backdrop-blur-sm shadow-md"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md uppercase">
                          {exam.course?.course_code}
                        </span>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md uppercase">
                          {exam.exam_type}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-foreground pt-1 truncate">
                        {exam.exam_title}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Course: {exam.course?.course_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Date: {new Date(exam.exam_date).toLocaleDateString()} | Max Marks:{' '}
                        {exam.total_marks}
                      </p>
                    </div>
                    <div className="border-t border-border/60 pt-4 mt-6 flex items-center justify-between">
                      <Link
                        href="/marks"
                        className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                      >
                        Go to Review Queue &rarr;
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Lecturer Specific Dashboard
    if (user?.role === UserRole.LECTURER) {
      return (
        <div className="space-y-8 animate-fadeIn">
          {/* Lecturer Welcome Banner */}
          <div className="relative overflow-hidden bg-card/30 border border-border/60 p-8 rounded-3xl backdrop-blur-md">
            <div className="absolute -top-[100%] -right-[30%] h-[200%] w-[50%] rounded-full bg-primary/15 blur-[100px]" />
            <div className="relative z-10 space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/15">
                Lecturer Portal Console
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Welcome back, {user?.fullName}!
              </h1>
              <p className="text-muted-foreground text-sm max-w-xl">
                Access your assigned courses and manage student exam mark sheets from your dashboard
                overview.
              </p>
            </div>
          </div>

          {/* Head of Department / Dean pending approvals */}
          {(user?.isHead || user?.isDean) && (
            <div className="space-y-6">
              <div className="border-b border-border/60 pb-3">
                <h3 className="text-lg font-bold text-foreground">Pending Marksheet Approvals</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Review and approve results submitted by lecturers in your department/faculty.
                </p>
              </div>

              {isHeadPendingApprovalsLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                  Loading submitted marksheets...
                </div>
              ) : headPendingApprovalsData.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-xs border border-dashed border-border/60 rounded-2xl">
                  No submitted marksheets are pending your approval.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 animate-fadeIn">
                  {headPendingApprovalsData.map((course: any) => (
                    <div
                      key={course.course_id}
                      className="bg-card/25 border border-border/80 p-5 rounded-2xl flex flex-col justify-between backdrop-blur-sm shadow-md hover:border-primary/20 transition-all duration-305 group"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/25 rounded uppercase">
                            {course.course_code}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 border rounded uppercase ${
                              course.result_submission_status === 'SUBMITTED_PROVISIONAL'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            }`}
                          >
                            {course.result_submission_status === 'SUBMITTED_PROVISIONAL'
                              ? 'Provisional'
                              : 'Final'}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-foreground pt-1 truncate leading-snug group-hover:text-primary transition-colors duration-300">
                            {course.course_name}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Semester: {course.semester} | Batch: {course.academic_year}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Department: {course.department?.department_name}
                          </p>
                        </div>
                      </div>
                      <div className="border-t border-border/60 pt-4 mt-6 flex items-center justify-between">
                        <button
                          onClick={() => handleReviewCourse(course)}
                          className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                        >
                          Review Marksheet &rarr;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Assigned Courses Section */}
          <div className="space-y-8">
            <div className="border-b border-border/60 pb-3">
              <h3 className="text-lg font-bold text-foreground">Assigned Courses</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Courses you are currently teaching in the active semesters.
              </p>
            </div>

            {isLecturerCoursesLoading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                Loading assigned courses...
              </div>
            ) : Object.keys(groupedCourses).length === 0 ? (
              <div className="p-20 text-center bg-card/10 border border-border/60 rounded-3xl flex flex-col items-center justify-center">
                <BookOpen className="h-10 w-10 text-muted-foreground/45 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No assigned courses</p>
                <p className="text-xs text-muted-foreground/75 mt-1 max-w-sm">
                  You are not currently assigned as a lecturer to any active courses.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.keys(groupedCourses)
                  .sort()
                  .map((batch) => (
                    <div key={batch} className="space-y-4">
                      <h4 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1.5 h-3.5 bg-primary rounded-full" />
                        {batch}
                      </h4>
                      {Object.keys(groupedCourses[batch])
                        .sort()
                        .map((semester) => (
                          <div
                            key={semester}
                            className="space-y-3 pl-3.5 border-l border-border/60"
                          >
                            <span className="text-xs font-bold text-muted-foreground">
                              {semester}
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                              {groupedCourses[batch][semester].map((course: any) => (
                                <div
                                  key={course.course_id}
                                  className="bg-card/25 border border-border/80 p-5 rounded-2xl flex flex-col justify-between backdrop-blur-sm shadow-md hover:border-primary/20 transition-all duration-300 group"
                                >
                                  <div>
                                    <div className="flex justify-between items-start">
                                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/25 rounded uppercase">
                                        {course.course_code}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground font-semibold">
                                        Credits: {Number(course.credit_value).toFixed(1)}
                                      </span>
                                    </div>
                                    <h4 className="font-bold text-sm text-foreground mt-3 leading-snug group-hover:text-primary transition-colors duration-300">
                                      {course.course_name}
                                    </h4>
                                    {course.department && (
                                      <p className="text-[11px] text-muted-foreground mt-1.5 font-medium uppercase tracking-wider">
                                        {course.department.department_name}
                                      </p>
                                    )}
                                  </div>
                                  <div className="border-t border-border/60 pt-4 mt-5 flex items-center justify-between">
                                    <span className="text-[10px] text-muted-foreground">
                                      Registered students:{' '}
                                      <strong>{course.student_count ?? 0}</strong>
                                    </span>
                                    <Link
                                      href="/students"
                                      className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                                    >
                                      View Enrolled Students
                                    </Link>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Review Marks Modal for Head/Dean */}
          {reviewCourse && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
              <div className="bg-card border border-border shadow-2xl rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-slideUp">
                {/* Modal Header */}
                <div className="p-6 border-b border-border/60 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded uppercase">
                        {reviewCourse.course_code}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 border rounded uppercase ${
                          reviewCourse.result_submission_status === 'SUBMITTED_PROVISIONAL'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        }`}
                      >
                        {reviewCourse.result_submission_status === 'SUBMITTED_PROVISIONAL'
                          ? 'Provisional'
                          : 'Final'}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-foreground mt-2">
                      Review Marks: {reviewCourse.course_name}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setReviewCourse(null);
                      setIsRejecting(false);
                      setRejectReason('');
                    }}
                    className="p-2 hover:bg-secondary rounded-full transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {isGridLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                      Loading student marksheet...
                    </div>
                  ) : !gridData || !gridData.grades || gridData.grades.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground text-sm">
                      No student evaluations recorded for this course yet.
                    </div>
                  ) : (
                    <div className="border border-border/80 rounded-2xl overflow-hidden shadow-inner">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-secondary/40 border-b border-border/80">
                            <th className="p-3 text-xs font-bold text-muted-foreground uppercase">
                              Reg. Number
                            </th>
                            <th className="p-3 text-xs font-bold text-muted-foreground uppercase">
                              Name
                            </th>
                            <th className="p-3 text-xs font-bold text-muted-foreground uppercase text-center">
                              CA Marks
                            </th>
                            <th className="p-3 text-xs font-bold text-muted-foreground uppercase text-center">
                              Final Exam
                            </th>
                            <th className="p-3 text-xs font-bold text-muted-foreground uppercase text-center">
                              Total Marks
                            </th>
                            <th className="p-3 text-xs font-bold text-muted-foreground uppercase text-center">
                              Grade
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {gridData.grades.map((grade: any) => (
                            <tr
                              key={grade.grade_id}
                              className="hover:bg-secondary/20 transition-colors"
                            >
                              <td className="p-3 text-sm font-semibold font-mono text-foreground">
                                {grade.student?.registration_number}
                              </td>
                              <td className="p-3 text-sm text-muted-foreground">
                                {grade.student?.user?.full_name}
                              </td>
                              <td className="p-3 text-sm text-center font-medium">
                                {Number(grade.continuous_assessment_marks).toFixed(1)}
                              </td>
                              <td className="p-3 text-sm text-center font-medium">
                                {Number(grade.final_exam_marks).toFixed(1)}
                              </td>
                              <td className="p-3 text-sm text-center font-bold text-foreground">
                                {Number(grade.total_marks).toFixed(1)}
                              </td>
                              <td className="p-3 text-sm text-center">
                                <span className="px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/25 rounded-md font-bold text-xs">
                                  {grade.grade}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Rejection Prompt step */}
                  {isRejecting && (
                    <div className="p-5 bg-destructive/10 border border-destructive/20 rounded-2xl space-y-3 animate-slideUp">
                      <label className="block text-sm font-semibold text-destructive">
                        Reason for Rejection
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Enter the reason for rejecting this marksheet so the lecturer knows what to fix..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full px-4 py-2.5 bg-background border border-destructive/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-destructive/60 transition text-sm text-foreground placeholder:text-muted-foreground/60"
                      />
                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={() => setIsRejecting(false)}
                          className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 rounded-xl transition text-sm font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={submitRejection}
                          disabled={isActioning || !rejectReason.trim()}
                          className="px-4 py-2 bg-destructive text-white hover:bg-destructive/90 rounded-xl transition text-sm font-semibold flex items-center disabled:opacity-65"
                        >
                          {isActioning && <Loader2 className="h-4.5 w-4.5 animate-spin mr-1.5" />}
                          Confirm Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                {!isRejecting && (
                  <div className="p-6 border-t border-border/60 bg-secondary/15 flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setReviewCourse(null);
                        setIsRejecting(false);
                        setRejectReason('');
                      }}
                      className="px-5 py-2.5 bg-secondary text-foreground hover:bg-secondary/80 rounded-xl transition text-sm font-bold"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => setIsRejecting(true)}
                      disabled={isActioning}
                      className="px-5 py-2.5 bg-destructive text-white hover:bg-destructive/90 rounded-xl transition text-sm font-bold disabled:opacity-65"
                    >
                      Reject Marksheet
                    </button>
                    <button
                      onClick={submitApproval}
                      disabled={isActioning}
                      className="px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl transition text-sm font-bold flex items-center disabled:opacity-65"
                    >
                      {isActioning && <Loader2 className="h-4.5 w-4.5 animate-spin mr-1.5" />}
                      Approve & Publish
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Student Specific Dashboard
    if (user?.role === UserRole.STUDENT) {
      const isRegistrationWindowOpen = !!activePeriod;
      const registeredCredits = myRegistrations.reduce(
        (sum: number, reg: any) => sum + parseFloat(reg.course.credit_value),
        0,
      );

      const studentCards = [
        {
          title: 'Registration Window',
          value: isRegistrationWindowOpen
            ? `Semester ${activePeriod.semester}`
            : 'Registration Closed',
          desc: isRegistrationWindowOpen
            ? `Closes on ${new Date(activePeriod.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
            : 'No active registration window',
          icon: Clock,
          color: isRegistrationWindowOpen
            ? 'text-primary bg-primary/10 border-primary/20'
            : 'text-muted-foreground bg-secondary/10 border-border/40',
        },
        {
          title: 'Registered Workload',
          value: `${registeredCredits.toFixed(1)} Credits`,
          desc: 'Total Workload Load (22.0 Max)',
          icon: BookOpen,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        },
        {
          title: 'Allocated Modules',
          value: `${myRegistrations.length} Modules`,
          desc: 'Registered academic subjects',
          icon: Shield,
          color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        },
      ];

      return (
        <div className="space-y-8 animate-fadeIn">
          {/* Welcome Banner */}
          <div className="relative overflow-hidden bg-card/30 border border-border/60 p-8 rounded-3xl backdrop-blur-md">
            <div className="absolute -top-[100%] -right-[30%] h-[200%] w-[50%] rounded-full bg-primary/15 blur-[100px]" />
            <div className="relative z-10 space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/15">
                Student Portal Console
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Welcome back, {user?.fullName}!
              </h1>
              <p className="text-muted-foreground text-sm max-w-xl">
                Browse available modules, monitor registration window deadlines, and keep track of
                your semester workload.
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {studentCards.map((card) => (
              <div
                key={card.title}
                className="bg-card/25 border border-border/80 p-6 rounded-2xl flex items-center justify-between backdrop-blur-sm shadow-lg animate-fadeIn"
              >
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {card.title}
                  </span>
                  <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.desc}</p>
                </div>
                <div className={`p-3 rounded-xl border ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
            ))}
          </div>

          {/* Available Modules Section */}
          <div className="bg-card/20 border border-border/60 p-6 rounded-3xl backdrop-blur-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-foreground">Available Modules</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                List of course modules offered for your degree and specialization in the current
                semester.
              </p>
            </div>

            {!isRegistrationWindowOpen ? (
              <div className="py-12 text-center text-muted-foreground text-sm border border-dashed border-border/60 rounded-2xl">
                Available modules list is currently hidden because the course registration window is
                closed.
              </div>
            ) : eligibleCourses.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm border border-dashed border-border/60 rounded-2xl">
                No eligible modules available. You may have registered for all subjects, or none are
                assigned for this semester.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {eligibleCourses.map((course: any) => (
                  <div
                    key={course.course_id}
                    className="bg-card/25 border border-border/80 p-5 rounded-2xl flex flex-col justify-between backdrop-blur-sm shadow-md hover:border-primary/20 transition-all duration-300 group"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/25 rounded uppercase">
                          {course.course_code}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          Credits: {Number(course.credit_value).toFixed(1)}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-foreground mt-3 leading-snug group-hover:text-primary transition-colors duration-300">
                        {course.course_name}
                      </h4>
                      {course.department && (
                        <p className="text-[11px] text-muted-foreground mt-1.5 font-medium uppercase tracking-wider">
                          {course.department.department_name}
                        </p>
                      )}
                    </div>
                    <div className="border-t border-border/60 pt-4 mt-5 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        Semester: <strong>{course.semester}</strong>
                      </span>
                      <Link
                        href="/registration"
                        className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                      >
                        Register Modules &rarr;
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Student / Lecturer / Staff Default Dashboard
    return (
      <div className="space-y-8 animate-fadeIn">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden bg-card/30 border border-border/60 p-8 rounded-3xl backdrop-blur-md">
          <div className="absolute -top-[100%] -right-[30%] h-[200%] w-[50%] rounded-full bg-primary/15 blur-[100px]" />
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/15">
              System Online
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Welcome back, {user?.fullName}!
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl">
              You are logged in as{' '}
              <span className="font-semibold text-foreground">{user?.role}</span>. Access all
              student registers, semesters, exam results, and audit trails using the sidebar
              navigation.
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {cards.map((card) => (
            <div
              key={card.title}
              className="bg-card/25 border border-border/80 p-6 rounded-2xl flex items-center justify-between backdrop-blur-sm shadow-lg"
            >
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {card.title}
                </span>
                <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.desc}</p>
              </div>
              <div className={`p-3 rounded-xl border ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions Grid */}
        {user?.role !== UserRole.STUDENT && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Quick Actions Shortcuts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Link
                href="/users"
                className="p-5 bg-card/20 hover:bg-secondary/40 border border-border/60 hover:border-primary/45 rounded-2xl transition flex items-start gap-4 group"
              >
                <div className="p-3 bg-secondary rounded-xl text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">User Directory</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Register new student accounts and manage details
                  </p>
                </div>
              </Link>

              <div className="p-5 bg-card/10 opacity-60 border border-border/40 rounded-2xl flex items-start gap-4 cursor-not-allowed">
                <div className="p-3 bg-secondary rounded-xl text-muted-foreground">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Courses Register</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    View curriculum, schedules, and active academic semesters (Phase 4)
                  </p>
                </div>
              </div>

              <div className="p-5 bg-card/10 opacity-60 border border-border/40 rounded-2xl flex items-start gap-4 cursor-not-allowed">
                <div className="p-3 bg-secondary rounded-xl text-muted-foreground">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Exam Schedules</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Manage exam timetables, halls, and seating arrangements (Phase 4)
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const switcherItems = [
    { role: UserRole.STUDENT, label: 'Student View', icon: Clock },
    { role: UserRole.LECTURER, label: 'Lecturer Portal', icon: BookOpen },
    { role: UserRole.EXAM_DIVISION_STAFF, label: 'Staff Console', icon: Users },
    { role: UserRole.ADMINISTRATOR, label: 'Admin Control', icon: Shield },
  ];

  return (
    <div className="space-y-8 relative">
      {/* Dev Switcher Bar */}
      <div className="relative bg-card/30 border border-border/60 p-5 rounded-3xl backdrop-blur-md shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 overflow-hidden border-t-primary/20">
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-primary/5 via-transparent to-transparent" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <h2 className="text-sm font-bold text-foreground tracking-tight">
              Development Portal Switcher
            </h2>
          </div>
          <p className="text-xs text-muted-foreground max-w-md">
            Instantly authenticate as any role in the background. The dashboard metrics and sidebar
            options will sync dynamically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {switcherItems.map((item) => {
            const Icon = item.icon;
            const active = user?.role === item.role;
            return (
              <button
                key={item.role}
                onClick={() => handleSwitchRole(item.role)}
                disabled={isSwitching}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-[1.02]'
                    : 'bg-secondary/40 text-muted-foreground border-border/80 hover:border-primary/30 hover:text-foreground hover:bg-secondary/60'
                } ${isSwitching ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {switchError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-2xl font-semibold text-center">
          {switchError}
        </div>
      )}

      {/* Loading Overlay */}
      {isSwitching && (
        <div className="absolute inset-x-0 top-36 bottom-0 z-40 bg-background/60 backdrop-blur-[1.5px] rounded-3xl flex items-center justify-center transition-all duration-300 min-h-[300px]">
          <div className="flex flex-col items-center gap-3 p-8 bg-card/90 border border-border/80 rounded-3xl shadow-2xl backdrop-blur-md">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm font-bold text-foreground">Re-authenticating session...</span>
            <p className="text-xs text-muted-foreground">
              Updating JWT cookies and reloading data structures.
            </p>
          </div>
        </div>
      )}

      {/* Dashboard Content */}
      <div
        className={
          isSwitching
            ? 'opacity-20 pointer-events-none transition-opacity duration-300'
            : 'transition-opacity duration-300'
        }
      >
        {renderDashboardContent()}
      </div>
    </div>
  );
}
