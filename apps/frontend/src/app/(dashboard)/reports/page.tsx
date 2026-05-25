'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import {
  Users,
  BookOpen,
  GraduationCap,
  Award,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  Loader2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch summary stats
  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['reports-summary'],
    queryFn: async () => {
      const res = await apiClient.get('/reports/summary');
      return res.data?.data;
    },
  });

  // Fetch department performance
  const { data: departments, isLoading: isDeptLoading } = useQuery({
    queryKey: ['reports-departments'],
    queryFn: async () => {
      const res = await apiClient.get('/reports/departments');
      return res.data?.data;
    },
  });

  // Fetch GPA trends
  const { data: trends, isLoading: isTrendsLoading } = useQuery({
    queryKey: ['reports-trends'],
    queryFn: async () => {
      const res = await apiClient.get('/reports/trends');
      return res.data?.data;
    },
  });

  // Fetch courses list
  const { data: courses, isLoading: isCoursesLoading } = useQuery({
    queryKey: ['reports-courses'],
    queryFn: async () => {
      const res = await apiClient.get('/reports/courses');
      return res.data?.data;
    },
  });

  // Automatically select first course when courses load
  useEffect(() => {
    if (courses && courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].course_id.toString());
    }
  }, [courses, selectedCourseId]);

  // Fetch grade distribution for selected course
  const { data: gradeDistribution, isLoading: isGradesLoading } = useQuery({
    queryKey: ['reports-grades', selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return null;
      const res = await apiClient.get(`/reports/course-grades/${selectedCourseId}`);
      return res.data?.data;
    },
    enabled: !!selectedCourseId,
  });

  if (!mounted) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // HSL colors for Pie chart
  const PIE_COLORS = [
    '#0f766e', // Teal 700 (A)
    '#0d9488', // Teal 600 (A-)
    '#14b8a6', // Teal 500 (B+)
    '#38bdf8', // Sky 400 (B)
    '#60a5fa', // Blue 400 (B-)
    '#818cf8', // Indigo 400 (C+)
    '#a78bfa', // Violet 400 (C)
    '#c084fc', // Purple 400 (C-)
    '#fbbf24', // Amber 400 (D)
    '#ef4444', // Red 500 (F)
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Analytics & Performance Reports
        </h1>
        <p className="text-muted-foreground mt-2">
          Real-time metrics, grade distributions, and department-level academic standings.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-card/30 border border-border/80 rounded-2xl backdrop-blur-md flex items-center gap-5 transition-transform hover:scale-[1.02]">
          <div className="p-4 bg-primary/10 text-primary rounded-xl">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Students
            </p>
            {isSummaryLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-1" />
            ) : (
              <p className="text-2xl font-bold tracking-tight mt-1">{summary?.totalStudents}</p>
            )}
          </div>
        </div>

        <div className="p-6 bg-card/30 border border-border/80 rounded-2xl backdrop-blur-md flex items-center gap-5 transition-transform hover:scale-[1.02]">
          <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Courses
            </p>
            {isSummaryLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-1" />
            ) : (
              <p className="text-2xl font-bold tracking-tight mt-1">{summary?.totalCourses}</p>
            )}
          </div>
        </div>

        <div className="p-6 bg-card/30 border border-border/80 rounded-2xl backdrop-blur-md flex items-center gap-5 transition-transform hover:scale-[1.02]">
          <div className="p-4 bg-cyan-500/10 text-cyan-500 rounded-xl">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Lecturers
            </p>
            {isSummaryLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-1" />
            ) : (
              <p className="text-2xl font-bold tracking-tight mt-1">{summary?.totalLecturers}</p>
            )}
          </div>
        </div>

        <div className="p-6 bg-card/30 border border-border/80 rounded-2xl backdrop-blur-md flex items-center gap-5 transition-transform hover:scale-[1.02]">
          <div className="p-4 bg-amber-500/10 text-amber-500 rounded-xl">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Average CGPA
            </p>
            {isSummaryLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-1" />
            ) : (
              <p className="text-2xl font-bold tracking-tight mt-1">
                {summary?.averageCgpa ? summary.averageCgpa.toFixed(2) : '0.00'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Department Performance */}
        <div className="p-6 bg-card/30 border border-border/80 rounded-2xl backdrop-blur-md space-y-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Department CGPA Average</h2>
          </div>
          <div className="h-80 w-full">
            {isDeptLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : departments && departments.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departments} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="departmentCode" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 4]} stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                    labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                  />
                  <Bar
                    dataKey="averageCgpa"
                    fill="#0f766e"
                    radius={[4, 4, 0, 0]}
                    name="Average CGPA"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No performance data compiled yet.
              </div>
            )}
          </div>
        </div>

        {/* GPA Trends */}
        <div className="p-6 bg-card/30 border border-border/80 rounded-2xl backdrop-blur-md space-y-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-pink-500" />
            <h2 className="text-lg font-bold">Academic GPA Trends</h2>
          </div>
          <div className="h-80 w-full">
            {isTrendsLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : trends && trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="semesterLabel" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 4]} stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                    labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="averageGpa"
                    stroke="#ec4899"
                    strokeWidth={3}
                    dot={{ r: 5, stroke: '#ec4899', strokeWidth: 2, fill: '#0f172a' }}
                    name="Average SGPA"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No historical GPA trends available yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grade Distribution Section */}
      <div className="p-6 bg-card/30 border border-border/80 rounded-2xl backdrop-blur-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <PieIcon className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-bold">Course Grade Distribution</h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-medium">Select Course:</span>
            {isCoursesLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="bg-card border border-border rounded-xl text-sm px-3 py-2 outline-none focus:border-primary text-foreground min-w-[200px]"
              >
                {courses?.map((c: any) => (
                  <option key={c.course_id} value={c.course_id}>
                    {c.course_code} - {c.course_name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Chart column */}
          <div className="md:col-span-2 h-72 w-full">
            {isGradesLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : gradeDistribution && gradeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gradeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="grade"
                  >
                    {gradeDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No students graded yet for this course.
              </div>
            )}
          </div>

          {/* Legend and stats column */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Grade Breakdown
            </h3>
            {gradeDistribution && gradeDistribution.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {gradeDistribution.map((entry: any, index: number) => (
                  <div key={entry.grade} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                    />
                    <span className="font-medium text-foreground">{entry.grade}:</span>
                    <span className="text-muted-foreground">{entry.count} student(s)</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Choose a course with published results to view the grading breakdown.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
