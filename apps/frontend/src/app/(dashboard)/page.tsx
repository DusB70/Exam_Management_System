'use client';

import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import Link from 'next/link';
import { UserRole } from '@ems/shared';
const STABLE_EMPTY_ARRAY: any[] = [];

export default function DashboardOverview() {
  const { user } = useAuthStore();
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [nonFilledSearch, setNonFilledSearch] = useState<string>('');

  // Lecturer Portal Dashboard States
  const [lecturerActiveTab, setLecturerActiveTab] = useState<'courses' | 'students'>('courses');
  const [selectedLecturerCourseId, setSelectedLecturerCourseId] = useState<string>('');
  const [studentsSearchQuery, setStudentsSearchQuery] = useState<string>('');

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

  // Lecturer students overview statistics (unique counts and distribution)
  const { data: studentsOverviewData, isLoading: isStudentsOverviewLoading } = useQuery({
    queryKey: ['lecturer-students-overview'],
    queryFn: async () => {
      const response = await apiClient.get('/marks/my-students-overview');
      return response.data?.data;
    },
    enabled: user?.role === UserRole.LECTURER,
  });

  // Lecturer enrolled students for selected course query
  const { data: enrolledStudentsData, isLoading: isEnrolledStudentsLoading } = useQuery({
    queryKey: ['lecturer-enrolled-students', selectedLecturerCourseId],
    queryFn: async () => {
      const response = await apiClient.get(`/marks/courses/${selectedLecturerCourseId}/students`);
      return response.data?.data || [];
    },
    enabled: user?.role === UserRole.LECTURER && !!selectedLecturerCourseId,
  });
  const enrolledStudents = Array.isArray(enrolledStudentsData)
    ? enrolledStudentsData
    : STABLE_EMPTY_ARRAY;

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
      <div className="space-y-8">
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
              <span className="font-semibold text-foreground">{user?.role}</span>. Oversee EMS user
              records, trigger system backups, and review audit logs from this central dashboard.
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
                  Generate and download complete PostgreSQL system database exports in JSON formats.
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
              Access your assigned courses, view registered student lists, and manage student exam
              mark sheets from your dashboard overview.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border/60 gap-6">
          <button
            onClick={() => setLecturerActiveTab('courses')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all ${
              lecturerActiveTab === 'courses'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Assigned Courses
          </button>
          <button
            onClick={() => setLecturerActiveTab('students')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all ${
              lecturerActiveTab === 'students'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Students Directory
          </button>
        </div>

        {/* Tab content 1: Assigned Courses */}
        {lecturerActiveTab === 'courses' && (
          <div className="space-y-8">
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
              Object.keys(groupedCourses)
                .sort()
                .map((batch) => (
                  <div key={batch} className="space-y-4">
                    <h3 className="text-lg font-bold border-l-4 border-primary pl-3 text-foreground">
                      {batch}
                    </h3>
                    {Object.keys(groupedCourses[batch])
                      .sort()
                      .map((semester) => (
                        <div key={semester} className="space-y-3">
                          <h4 className="text-sm font-semibold text-muted-foreground pl-1">
                            {semester}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {groupedCourses[batch][semester].map((course: any) => (
                              <div
                                key={course.course_id}
                                className="bg-card/25 border border-border/80 hover:border-primary/45 p-6 rounded-2xl flex flex-col justify-between backdrop-blur-sm shadow-lg hover:shadow-primary/5 transition group"
                              >
                                <div className="space-y-2">
                                  <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md uppercase">
                                      {course.course_code}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {course.credit_value} Credits
                                    </span>
                                  </div>
                                  <h4 className="font-bold text-base text-foreground leading-snug pt-1 group-hover:text-primary transition-colors">
                                    {course.course_name}
                                  </h4>
                                  <p className="text-xs text-muted-foreground">
                                    Department: {course.department?.department_name}
                                  </p>
                                </div>
                                <div className="border-t border-border/60 pt-4 mt-6 flex items-center justify-between">
                                  <button
                                    onClick={() => {
                                      setSelectedLecturerCourseId(course.course_id.toString());
                                      setLecturerActiveTab('students');
                                    }}
                                    className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                                  >
                                    View Enrolled Students
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                ))
            )}
          </div>
        )}

        {/* Tab content 2: Students Directory */}
        {lecturerActiveTab === 'students' && (
          <div className="space-y-6">
            {/* Landing Overview: Total Enrolled Students */}
            {!selectedLecturerCourseId && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
                <div className="bg-card/25 border border-border/80 p-6 rounded-2xl flex items-center justify-between backdrop-blur-sm shadow-md">
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Total Enrolled Students
                    </span>
                    <p className="text-3xl font-extrabold tracking-tight">
                      {isStudentsOverviewLoading
                        ? '...'
                        : studentsOverviewData?.totalUniqueStudents || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Unique students in your classes</p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/10 text-primary">
                    <Users className="h-6 w-6" />
                  </div>
                </div>

                <div className="bg-card/25 border border-border/80 p-6 rounded-2xl flex items-center justify-between backdrop-blur-sm shadow-md">
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Taught Courses
                    </span>
                    <p className="text-3xl font-extrabold tracking-tight">
                      {lecturerCourses.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Assigned academic subjects</p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                    <BookOpen className="h-6 w-6" />
                  </div>
                </div>
              </div>
            )}

            {/* Course Selector */}
            <div className="bg-card/20 border border-border/60 p-6 rounded-3xl backdrop-blur-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Enrolled Students Registers</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select a course to display the complete student roster
                  </p>
                </div>
                <div className="w-full sm:w-72">
                  <select
                    value={selectedLecturerCourseId}
                    onChange={(e) => {
                      setSelectedLecturerCourseId(e.target.value);
                      setStudentsSearchQuery('');
                    }}
                    className="w-full px-4 py-2.5 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                  >
                    <option value="">Choose Course Subject...</option>
                    {lecturerCourses.map((c: any) => (
                      <option key={c.course_id} value={c.course_id} className="bg-card">
                        {c.course_code} - {c.course_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Course Selected: Show students list */}
              {selectedLecturerCourseId ? (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-border/60 pt-4">
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <span>
                        Roster for{' '}
                        {
                          lecturerCourses.find(
                            (c: any) => c.course_id.toString() === selectedLecturerCourseId,
                          )?.course_name
                        }
                      </span>
                      <span className="px-2 py-0.5 text-xs bg-primary/15 text-primary border border-primary/25 rounded-full font-bold">
                        {enrolledStudents.length} Enrolled
                      </span>
                    </h4>
                    <div className="relative w-full sm:w-72">
                      <input
                        type="text"
                        placeholder="Search student roster..."
                        value={studentsSearchQuery}
                        onChange={(e) => setStudentsSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary transition text-xs"
                      />
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="border border-border/60 rounded-xl overflow-hidden shadow-md">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-border/60 bg-secondary/15 text-muted-foreground font-bold">
                          <th className="px-6 py-3.5">Registration Number</th>
                          <th className="px-6 py-3.5">Full Name</th>
                          <th className="px-6 py-3.5">Email Address</th>
                          <th className="px-6 py-3.5">Academic Year</th>
                          <th className="px-6 py-3.5">Semester</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-medium">
                        {isEnrolledStudentsLoading ? (
                          <tr>
                            <td colSpan={5} className="text-center py-12 text-muted-foreground">
                              <Loader2 className="h-5 w-5 animate-spin text-primary inline mr-2" />
                              Loading student roster...
                            </td>
                          </tr>
                        ) : enrolledStudents.filter((s: any) => {
                            const query = studentsSearchQuery.toLowerCase();
                            return (
                              s.registration_number?.toLowerCase().includes(query) ||
                              s.user?.full_name?.toLowerCase().includes(query) ||
                              s.user?.email?.toLowerCase().includes(query)
                            );
                          }).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-12 text-muted-foreground">
                              No matching students enrolled.
                            </td>
                          </tr>
                        ) : (
                          enrolledStudents
                            .filter((s: any) => {
                              const query = studentsSearchQuery.toLowerCase();
                              return (
                                s.registration_number?.toLowerCase().includes(query) ||
                                s.user?.full_name?.toLowerCase().includes(query) ||
                                s.user?.email?.toLowerCase().includes(query)
                              );
                            })
                            .map((student: any) => (
                              <tr
                                key={student.student_id}
                                className="hover:bg-secondary/10 transition-colors"
                              >
                                <td className="px-6 py-3 font-bold text-foreground">
                                  {student.registration_number}
                                </td>
                                <td className="px-6 py-3 text-muted-foreground">
                                  {student.user?.full_name}
                                </td>
                                <td className="px-6 py-3 text-muted-foreground">
                                  {student.user?.email}
                                </td>
                                <td className="px-6 py-3 text-muted-foreground">
                                  Year {student.academic_year}
                                </td>
                                <td className="px-6 py-3 text-muted-foreground">
                                  Sem {student.semester}
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Landing Overview: Courses student counts list */}
                  <div className="border-t border-border/60 pt-6">
                    <h4 className="text-sm font-bold text-foreground mb-4">
                      Enrollment Distribution By Course
                    </h4>
                    {isStudentsOverviewLoading ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                        Loading enrollment breakdown...
                      </div>
                    ) : !studentsOverviewData?.courseDistribution ||
                      studentsOverviewData.courseDistribution.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        No enrollment details available.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {studentsOverviewData.courseDistribution.map((dist: any) => (
                          <div
                            key={dist.courseId}
                            onClick={() => setSelectedLecturerCourseId(dist.courseId.toString())}
                            className="p-4 bg-secondary/10 border border-border/40 hover:border-primary/20 hover:bg-secondary/20 transition rounded-xl flex justify-between items-center cursor-pointer group"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/25 rounded uppercase">
                                  {dist.courseCode}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  Batch {dist.academicYear}
                                </span>
                              </div>
                              <h5 className="font-bold text-xs text-foreground mt-2 truncate max-w-xs group-hover:text-primary transition-colors">
                                {dist.courseName}
                              </h5>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-extrabold text-foreground group-hover:text-primary transition-colors">
                                {dist.studentCount}
                              </span>
                              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                                Students
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="py-12 text-center text-muted-foreground text-xs border border-dashed border-border/60 rounded-2xl">
                    Choose a course from the dropdown above (or click a card) to display the full
                    student roster and perform searches.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Student / Lecturer / Staff Default Dashboard
  return (
    <div className="space-y-8">
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
            You are logged in as <span className="font-semibold text-foreground">{user?.role}</span>
            . Access all student registers, semesters, exam results, and audit trails using the
            sidebar navigation.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-card/25 border border-border/80 p-6 rounded-2xl flex items-center justify-between backdrop-blur-sm"
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
}
