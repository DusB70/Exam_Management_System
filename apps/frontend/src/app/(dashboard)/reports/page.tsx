'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import {
  Users,
  BookOpen,
  GraduationCap,
  Award,
  BarChart3,
  PieChart as PieIcon,
  Loader2,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Download,
  History,
  Layers,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [semesterFilter, setSemesterFilter] = useState<string>('ALL');
  const [batchFilter, setBatchFilter] = useState<string>('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [courseTypeTab, setCourseTypeTab] = useState<'ALL' | 'ACTIVE' | 'PAST'>('ALL');

  // Selected course for detailed grade inspection
  const [selectedCourseIdForGradeView, setSelectedCourseIdForGradeView] = useState<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch comprehensive lecturer analytics
  const {
    data: analytics,
    isLoading: isAnalyticsLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['lecturer-analytics', semesterFilter, batchFilter, courseFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (semesterFilter !== 'ALL') params.append('semester', semesterFilter);
      if (batchFilter !== 'ALL') params.append('batch', batchFilter);
      if (courseFilter !== 'ALL') params.append('courseId', courseFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await apiClient.get(`/reports/lecturer-analytics?${params.toString()}`);
      return res.data?.data;
    },
  });

  // Automatically select the first course for grade breakdown view if not set
  useEffect(() => {
    if (analytics?.courses && analytics.courses.length > 0) {
      if (
        !selectedCourseIdForGradeView ||
        !analytics.courses.some(
          (c: any) => c.courseId.toString() === selectedCourseIdForGradeView,
        )
      ) {
        setSelectedCourseIdForGradeView(analytics.courses[0].courseId.toString());
      }
    }
  }, [analytics?.courses, selectedCourseIdForGradeView]);

  // Filter courses by Active vs Past Taught tabs
  const displayedCourses = useMemo(() => {
    if (!analytics?.courses) return [];
    if (courseTypeTab === 'ACTIVE') {
      return analytics.courses.filter((c: any) => c.isActiveSemester);
    }
    if (courseTypeTab === 'PAST') {
      return analytics.courses.filter((c: any) => !c.isActiveSemester);
    }
    return analytics.courses;
  }, [analytics?.courses, courseTypeTab]);

  // Selected course details for grade breakdown view
  const inspectedCourse = useMemo(() => {
    if (!analytics?.courses || !selectedCourseIdForGradeView) return null;
    return (
      analytics.courses.find(
        (c: any) => c.courseId.toString() === selectedCourseIdForGradeView,
      ) || analytics.courses[0]
    );
  }, [analytics?.courses, selectedCourseIdForGradeView]);

  // Reset all filters helper
  const handleResetFilters = () => {
    setSearchQuery('');
    setSemesterFilter('ALL');
    setBatchFilter('ALL');
    setCourseFilter('ALL');
    setCourseTypeTab('ALL');
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    semesterFilter !== 'ALL' ||
    batchFilter !== 'ALL' ||
    courseFilter !== 'ALL' ||
    courseTypeTab !== 'ALL';

  // Export Analytics Report to CSV
  const handleExportCsv = () => {
    if (!analytics?.courses || analytics.courses.length === 0) return;

    const headers = [
      'Course Code',
      'Course Name',
      'Semester',
      'Batch',
      'Status',
      'Enrolled Students',
      'Graded Students',
      'CA Average (%)',
      'Final Exam Average (%)',
      'Combined Average (%)',
      'Passing Rate (%)',
      'Pass Count',
      'Fail Count',
      'E(CA) Repeat',
      'E(SA) Repeat',
    ];

    const rows = displayedCourses.map((c: any) => [
      `"${c.courseCode}"`,
      `"${c.courseName.replace(/"/g, '""')}"`,
      `"${c.semester}"`,
      `"${c.batches?.join(', ') || '-'}"`,
      c.isActiveSemester ? '"Active Semester"' : '"Past Completed"',
      c.enrolledCount,
      c.gradedCount,
      `${c.avgCaMarks}%`,
      `${c.avgFinalExamMarks}%`,
      `${c.avgCombinedMarks}%`,
      `${c.passRate}%`,
      c.passCount,
      c.failCount,
      c.eCaCount,
      c.eSaCount,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r: (string | number)[]) => r.join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Lecturer_Performance_Report_${new Date().toISOString().split('T')[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!mounted) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getGradeBarColor = (grade: string) => {
    if (grade.startsWith('A')) return '#10b981'; // Emerald
    if (grade.startsWith('B')) return '#0ea5e9'; // Sky
    if (grade.startsWith('C')) return '#8b5cf6'; // Violet
    if (grade === 'D') return '#f59e0b'; // Amber
    if (grade === 'F') return '#ef4444'; // Red
    if (grade === 'E(CA)' || grade === 'E(SA)') return '#f43f5e'; // Rose
    return '#64748b'; // Slate
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            Lecturer Analytics &amp; Reports
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Comprehensive academic performance analytics, student enrollment history across years,
            and subject evaluation metrics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3.5 py-2 bg-secondary/40 border border-border/80 hover:bg-secondary/70 text-foreground font-semibold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="Refresh analytics data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCsv}
            disabled={!analytics?.courses || analytics.courses.length === 0}
            className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-primary/90 transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter and Search Row */}
      <div className="p-5 bg-card/25 border border-border/80 rounded-3xl backdrop-blur-md shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <span className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
            <Filter className="h-4 w-4 text-primary" />
            Analytics Filters &amp; Search
          </span>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search course code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 bg-secondary/35 border border-border/80 rounded-xl text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/50 transition font-medium"
            />
          </div>

          {/* Semester Filter */}
          <div>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="w-full px-3.5 py-2 bg-secondary/35 border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition font-medium"
            >
              <option value="ALL">All Semesters</option>
              {analytics?.availableSemesters?.map((sem: string) => (
                <option key={sem} value={sem}>
                  Semester {sem}
                  {analytics?.activeSemesters?.includes(sem) ? ' (Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Batch Filter */}
          <div>
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="w-full px-3.5 py-2 bg-secondary/35 border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition font-medium"
            >
              <option value="ALL">All Student Batches</option>
              {analytics?.availableBatches?.map((b: string) => (
                <option key={b} value={b}>
                  Batch {b}
                </option>
              ))}
            </select>
          </div>

          {/* Course Specific Filter */}
          <div>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full px-3.5 py-2 bg-secondary/35 border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition font-medium"
            >
              <option value="ALL">All Allocated Courses</option>
              {analytics?.availableCourses?.map((c: any) => (
                <option key={c.courseId} value={c.courseId.toString()}>
                  {c.courseCode} - {c.courseName} (Sem {c.semester})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* High-Level Stat Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1: Total Enrolled Over The Years */}
        <div className="p-5 bg-card/25 border border-border/80 rounded-3xl backdrop-blur-md shadow-sm space-y-2 relative overflow-hidden transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Enrolled (All-Time)
            </span>
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Users className="h-4 w-4" />
            </div>
          </div>
          {isAnalyticsLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <div>
              <p className="text-2xl font-black text-foreground font-mono">
                {analytics?.totalStudentsEnrolledOverYears ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Total students over the years
              </p>
            </div>
          )}
        </div>

        {/* Metric 2: Active Year Enrollment */}
        <div className="p-5 bg-card/25 border border-border/80 rounded-3xl backdrop-blur-md shadow-sm space-y-2 relative overflow-hidden transition-all hover:border-emerald-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Active Year Enrolled
            </span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          {isAnalyticsLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <div>
              <p className="text-2xl font-black text-foreground font-mono">
                {analytics?.totalStudentsEnrolledActiveYear ?? 0}
              </p>
              <p className="text-[11px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                Active AY {analytics?.activeAcademicYear} (Sem {analytics?.activeSemesters?.join(', ') || 'N/A'})
              </p>
            </div>
          )}
        </div>

        {/* Metric 3: Average CA Marks */}
        <div className="p-5 bg-card/25 border border-border/80 rounded-3xl backdrop-blur-md shadow-sm space-y-2 relative overflow-hidden transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Avg CA Marks
            </span>
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Award className="h-4 w-4" />
            </div>
          </div>
          {isAnalyticsLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <div>
              <p className="text-2xl font-black text-foreground font-mono">
                {analytics?.overallCaAvg ? `${analytics.overallCaAvg}%` : '0.0%'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Continuous assessment average
              </p>
            </div>
          )}
        </div>

        {/* Metric 4: Average Final Exam Marks */}
        <div className="p-5 bg-card/25 border border-border/80 rounded-3xl backdrop-blur-md shadow-sm space-y-2 relative overflow-hidden transition-all hover:border-amber-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Avg Final Exam Marks
            </span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
              <GraduationCap className="h-4 w-4" />
            </div>
          </div>
          {isAnalyticsLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <div>
              <p className="text-2xl font-black text-foreground font-mono">
                {analytics?.overallFinalAvg ? `${analytics.overallFinalAvg}%` : '0.0%'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Final examination average
              </p>
            </div>
          )}
        </div>

        {/* Metric 5: Overall Passing Rate */}
        <div className="p-5 bg-card/25 border border-border/80 rounded-3xl backdrop-blur-md shadow-sm space-y-2 relative overflow-hidden transition-all hover:border-cyan-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Overall Pass Rate
            </span>
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          {isAnalyticsLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <div>
              <p className="text-2xl font-black text-foreground font-mono">
                {analytics?.overallPassRate ? `${analytics.overallPassRate}%` : '0.0%'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Combined avg: {analytics?.overallCombinedAvg ? `${analytics.overallCombinedAvg}%` : '0%'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Total Students Enrolled Over The Years (Per Year Breakdown Chart) */}
      <div className="p-6 bg-card/25 border border-border/80 rounded-3xl backdrop-blur-md shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Student Enrollment Over The Years (Per Year &amp; Batch)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Unique student cohort enrollment across previous academic years and batches taught by you.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 bg-secondary/50 border border-border/80 rounded-full text-foreground">
              Total Cohorts: {analytics?.totalStudentsEnrolledPerYear?.length || 0}
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          {isAnalyticsLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : analytics?.totalStudentsEnrolledPerYear &&
            analytics.totalStudentsEnrolledPerYear.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics.totalStudentsEnrolledPerYear}
                margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.4} />
                <XAxis
                  dataKey="year"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `Cohort ${val}`}
                />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => [`${value} Students`, 'Total Enrolled']}
                  labelFormatter={(label) => `Academic Year / Batch: ${label}`}
                />
                <Bar
                  dataKey="count"
                  fill="#0ea5e9"
                  radius={[6, 6, 0, 0]}
                  name="Enrolled Students"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No historical yearly enrollment records compiled yet.
            </div>
          )}
        </div>
      </div>

      {/* Courses Performance Overview & Past Taught Courses */}
      <div className="p-6 bg-card/25 border border-border/80 rounded-3xl backdrop-blur-md shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Taught Courses &amp; Evaluation Performance
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review current and past taught subjects, average CA &amp; Final Exam marks, and pass rates.
            </p>
          </div>

          {/* Active vs Past Courses Tab Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-secondary/35 border border-border/80 rounded-2xl shrink-0">
            <button
              onClick={() => setCourseTypeTab('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                courseTypeTab === 'ALL'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Courses ({analytics?.totalCoursesTaught ?? 0})
            </button>
            <button
              onClick={() => setCourseTypeTab('ACTIVE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                courseTypeTab === 'ACTIVE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              Active Semesters ({analytics?.activeCoursesCount ?? 0})
            </button>
            <button
              onClick={() => setCourseTypeTab('PAST')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                courseTypeTab === 'PAST'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Past Taught ({analytics?.pastCoursesCount ?? 0})
            </button>
          </div>
        </div>

        {/* Courses Table */}
        <div className="overflow-x-auto">
          {isAnalyticsLoading ? (
            <div className="py-12 flex justify-center items-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : displayedCourses.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No courses found matching the selected filter criteria.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                  <th className="pb-3 px-3">Subject / Course</th>
                  <th className="pb-3 px-3">Semester</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Batch</th>
                  <th className="pb-3 px-3 text-right">Enrolled</th>
                  <th className="pb-3 px-3 text-right">Avg CA (%)</th>
                  <th className="pb-3 px-3 text-right">Avg Final Exam (%)</th>
                  <th className="pb-3 px-3 text-right">Combined Avg</th>
                  <th className="pb-3 px-3 text-right">Pass Rate</th>
                  <th className="pb-3 px-3 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                {displayedCourses.map((c: any) => {
                  const isSelected = selectedCourseIdForGradeView === c.courseId.toString();

                  return (
                    <tr
                      key={c.courseId}
                      onClick={() => setSelectedCourseIdForGradeView(c.courseId.toString())}
                      className={`hover:bg-secondary/20 transition cursor-pointer ${
                        isSelected ? 'bg-primary/10 font-medium' : ''
                      }`}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[11px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                            {c.courseCode}
                          </span>
                          <span className="font-bold text-foreground truncate max-w-[220px]">
                            {c.courseName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-xs font-semibold">Sem {c.semester}</span>
                      </td>
                      <td className="py-3 px-3">
                        {c.isActiveSemester ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/80">
                            Past Taught
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground font-mono text-[11px]">
                        {c.batches?.join(', ') || '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                        {c.enrolledCount}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-primary">
                        {c.avgCaMarks}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">
                        {c.avgFinalExamMarks}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-foreground">
                        {c.avgCombinedMarks}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        <span
                          className={
                            c.passRate >= 70
                              ? 'text-emerald-400'
                              : c.passRate >= 50
                              ? 'text-amber-400'
                              : 'text-destructive'
                          }
                        >
                          {c.passRate}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCourseIdForGradeView(c.courseId.toString());
                          }}
                          className="px-2.5 py-1 bg-secondary/50 hover:bg-primary hover:text-primary-foreground border border-border/70 rounded-lg text-[10px] font-bold transition cursor-pointer"
                        >
                          View Grades
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Grade Breakdown & Assessment Correlation for Selected Course */}
      {inspectedCourse && (
        <div className="p-6 bg-card/25 border border-border/80 rounded-3xl backdrop-blur-md shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-xs px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">
                  {inspectedCourse.courseCode}
                </span>
                <h3 className="text-base font-bold text-foreground">
                  {inspectedCourse.courseName}
                </h3>
                {inspectedCourse.isActiveSemester && (
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active Semester
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Semester {inspectedCourse.semester} | Credit: {inspectedCourse.creditValue} | Enrolled:{' '}
                {inspectedCourse.enrolledCount} students | Graded: {inspectedCourse.gradedCount} students
              </p>
            </div>

            {/* Quick stats pills */}
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <div className="px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl text-center">
                <p className="text-[9px] font-bold text-primary uppercase">Avg CA Marks</p>
                <p className="text-sm font-black font-mono text-primary">
                  {inspectedCourse.avgCaMarks}%
                </p>
              </div>
              <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                <p className="text-[9px] font-bold text-amber-400 uppercase">Avg Final Exam</p>
                <p className="text-sm font-black font-mono text-amber-400">
                  {inspectedCourse.avgFinalExamMarks}%
                </p>
              </div>
              <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                <p className="text-[9px] font-bold text-emerald-400 uppercase">Pass Rate</p>
                <p className="text-sm font-black font-mono text-emerald-400">
                  {inspectedCourse.passRate}%
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* Number of Grades per Subject Bar Chart */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Number of Grades per Subject (Grade Distribution)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Graded Cohort: {inspectedCourse.gradedCount}
                </span>
              </div>

              <div className="h-72 w-full">
                {inspectedCourse.gradeDistribution && inspectedCourse.gradeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={inspectedCourse.gradeDistribution}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#334155"
                        opacity={0.3}
                      />
                      <XAxis dataKey="grade" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}
                        formatter={(val: any, name: any, item: any) => [
                          `${val} Students (${item.payload.percentage}%)`,
                          'Grade Count',
                        ]}
                        labelFormatter={(label) => `Grade: ${label}`}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {inspectedCourse.gradeDistribution.map((entry: any) => (
                          <Cell key={entry.grade} fill={getGradeBarColor(entry.grade)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No student grades published yet for this course.
                  </div>
                )}
              </div>
            </div>

            {/* Performance Gauges & Repeat Breakdown */}
            <div className="space-y-4 p-5 bg-secondary/15 rounded-2xl border border-border/60">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider block border-b border-border/60 pb-2">
                Assessment Diagnostics
              </span>

              {/* CA vs Final Exam Side-by-Side Comparison */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-primary">Continuous Assessment (CA)</span>
                    <span className="font-mono text-primary">{inspectedCourse.avgCaMarks}%</span>
                  </div>
                  <div className="w-full h-2 bg-secondary/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, inspectedCourse.avgCaMarks)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-amber-400">Final Semester Exam (SA)</span>
                    <span className="font-mono text-amber-400">{inspectedCourse.avgFinalExamMarks}%</span>
                  </div>
                  <div className="w-full h-2 bg-secondary/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, inspectedCourse.avgFinalExamMarks)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Pass / Repeat Codes Diagnostics */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-border/60">
                <div className="p-3 bg-secondary/30 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-muted-foreground block uppercase">
                    Passed
                  </span>
                  <span className="text-base font-extrabold text-emerald-400 font-mono">
                    {inspectedCourse.passCount}
                  </span>
                </div>
                <div className="p-3 bg-secondary/30 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-muted-foreground block uppercase">
                    Failed (F)
                  </span>
                  <span className="text-base font-extrabold text-rose-400 font-mono">
                    {inspectedCourse.failCount}
                  </span>
                </div>
                <div className="p-3 bg-secondary/30 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-muted-foreground block uppercase">
                    E(CA) Repeats
                  </span>
                  <span className="text-base font-extrabold text-amber-400 font-mono">
                    {inspectedCourse.eCaCount}
                  </span>
                </div>
                <div className="p-3 bg-secondary/30 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-muted-foreground block uppercase">
                    E(SA) Repeats
                  </span>
                  <span className="text-base font-extrabold text-amber-400 font-mono">
                    {inspectedCourse.eSaCount}
                  </span>
                </div>
              </div>

              {/* Grade Counts Pills */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                  Grade Tally:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {inspectedCourse.gradeDistribution
                    ?.filter((g: any) => g.count > 0)
                    .map((g: any) => (
                      <span
                        key={g.grade}
                        className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-secondary/60 border border-border/80 text-foreground"
                      >
                        {g.grade}: {g.count}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
