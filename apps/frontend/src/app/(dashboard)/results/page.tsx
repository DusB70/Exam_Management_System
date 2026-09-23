'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import {
  AlertTriangle,
  Loader2,
  Award,
  FileSpreadsheet,
  Download,
  Activity,
  X,
} from 'lucide-react';
import { UserRole } from '@ems/shared';

export default function ResultsAndImportsPage() {
  const { user } = useAuthStore();
  const role = user?.role;
  const isStudent = role === UserRole.STUDENT;

  // Notification states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);

  // Modal State for Progress Tracker Popup
  const [selectedProgressCourse, setSelectedProgressCourse] = useState<any | null>(null);

  // Filters for results
  const [semesterFilter, setSemesterFilter] = useState('active');
  const [yearFilter, setYearFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // ==========================================
  // STUDENT PORTAL QUERIES
  // ==========================================

  // 1. Fetch student report card details
  const { data: reportCard, isLoading: isReportLoading } = useQuery({
    queryKey: ['my-report'],
    queryFn: async () => {
      const response = await apiClient.get('/results/my-report');
      return response.data?.data;
    },
    enabled: isStudent,
  });

  // 2. Fetch student course publishing progress
  const { data: myProgress = [] } = useQuery({
    queryKey: ['my-course-progress'],
    queryFn: async () => {
      const response = await apiClient.get('/exams/progress/my-courses');
      return response.data?.data || [];
    },
    enabled: isStudent,
  });

  const handleDownloadMyPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const response = await apiClient.get('/results/my-report/pdf', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transcript_${user?.fullName || 'student'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch {
      setErrorMsg('Failed to download PDF transcript.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadMyExcel = async () => {
    setIsDownloadingExcel(true);
    try {
      const response = await apiClient.get('/results/my-report/excel', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transcript_${user?.fullName || 'student'}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch {
      setErrorMsg('Failed to download Excel transcript.');
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  // Resolve Student Metrics
  const grades = reportCard?.grades || [];
  const semesters = Array.from(new Set(grades.map((g: any) => g.course?.semester)))
    .filter(Boolean)
    .sort() as string[];
  const activeSemester = semesters.length > 0 ? semesters[semesters.length - 1] : '';

  const filteredGrades = grades.filter((g: any) => {
    if (semesterFilter === 'active') {
      if (activeSemester && g.course?.semester !== activeSemester) return false;
    } else if (semesterFilter !== 'all') {
      if (g.course?.semester !== semesterFilter) return false;
    }
    if (yearFilter !== 'all') {
      if (!g.course?.semester?.startsWith(yearFilter)) return false;
    }
    if (typeFilter === 'compulsory') {
      if (g.type !== 'COMPULSORY') return false;
    } else if (typeFilter === 'optional') {
      if (g.type !== 'OPTIONAL') return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border/80 p-6 rounded-3xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
            <Award className="h-4 w-4" />
            Student Portal
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            My Academic Results Sheet
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View continuous assessment marks, allocated total CA weight, released letter grades, and
            inspect result publishing progress.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownloadMyPdf}
            disabled={isDownloadingPdf}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-primary text-primary-foreground rounded-xl shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isDownloadingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download PDF Transcript
          </button>
          <button
            onClick={handleDownloadMyExcel}
            disabled={isDownloadingExcel}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-emerald-600 text-white rounded-xl shadow-md hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {isDownloadingExcel ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            Download Excel Sheet
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-2xl font-medium flex gap-2 items-center">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-card border border-border/80 p-4 rounded-3xl flex flex-wrap gap-4 items-center justify-between shadow-sm">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="space-y-1">
            <label className="block text-[10px] text-muted-foreground uppercase font-extrabold tracking-wider">
              Year Filter
            </label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-3.5 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 transition font-semibold"
            >
              <option value="all">All Years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] text-muted-foreground uppercase font-extrabold tracking-wider">
              Semester Filter
            </label>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="px-3.5 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 transition font-semibold"
            >
              <option value="all">All Semesters</option>
              <option value="active">Active Semester ({activeSemester || 'N/A'})</option>
              {semesters.map((sem: string) => (
                <option key={sem} value={sem}>
                  Semester {sem}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] text-muted-foreground uppercase font-extrabold tracking-wider">
              Course Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3.5 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 transition font-semibold"
            >
              <option value="all">All Types</option>
              <option value="compulsory">Compulsory Only</option>
              <option value="optional">Optional Only</option>
            </select>
          </div>
        </div>

        {(yearFilter !== 'all' || semesterFilter !== 'active' || typeFilter !== 'all') && (
          <button
            onClick={() => {
              setYearFilter('all');
              setSemesterFilter('active');
              setTypeFilter('all');
            }}
            className="px-3.5 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-xl border border-border/60 hover:bg-secondary/90 transition cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Results Table (Without Progress Status column, with View Progress button) */}
      <div className="bg-card border border-border/80 rounded-3xl shadow-sm overflow-hidden">
        {isReportLoading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Loading report card data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/20">
                  <th className="px-6 py-4">Semester</th>
                  <th className="px-6 py-4">Course Code</th>
                  <th className="px-6 py-4">Module Name</th>
                  <th className="px-6 py-4">Credits</th>
                  <th className="px-6 py-4 text-center">CA Marks (Obtained / Weight)</th>
                  <th className="px-6 py-4 text-center">Publishing Progress</th>
                  <th className="px-6 py-4 text-right">Overall Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-sm font-medium">
                {filteredGrades.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                      No results match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredGrades.map((grade: any) => {
                    const prog = myProgress.find(
                      (p: any) => p.course_id === grade.course?.course_id,
                    );

                    const caObtained = grade.continuous_assessment_marks ?? 0;
                    const caWeight = grade.max_ca_weight || 40;
                    const formattedCa = `${caObtained.toFixed(1)} / ${caWeight}`;

                    return (
                      <tr key={grade.grade_id} className="hover:bg-secondary/15 transition-colors">
                        <td className="px-6 py-4 text-muted-foreground font-semibold">
                          Sem {grade.course?.semester}
                        </td>
                        <td className="px-6 py-4 font-bold font-mono text-primary text-xs uppercase">
                          {grade.course?.course_code}
                        </td>
                        <td className="px-6 py-4 font-semibold text-foreground">
                          {grade.course?.course_name}
                        </td>
                        <td className="px-6 py-4 font-mono text-muted-foreground">
                          {parseFloat(grade.course?.credit_value)}
                        </td>
                        <td className="px-6 py-4 text-center font-mono font-extrabold text-foreground">
                          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs">
                            {formattedCa}
                          </span>
                        </td>

                        {/* View Progress Button Action */}
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() =>
                              setSelectedProgressCourse({
                                ...grade,
                                progress: prog,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold text-xs rounded-xl border border-border/60 transition cursor-pointer"
                          >
                            <Activity className="h-3.5 w-3.5 text-primary" />
                            View Progress
                          </button>
                        </td>

                        <td className="px-6 py-4 text-right">
                          {grade.is_published ? (
                            <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-xl font-extrabold text-xs">
                              {grade.grade}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic font-medium">
                              Processing
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* POPUP MODAL: RESULT PUBLISHING PROGRESS DIALOG */}
      {/* ========================================================================= */}
      {selectedProgressCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border/80 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Subject Progress Pipeline
                </span>
                <h3 className="text-xl font-extrabold text-foreground mt-0.5">
                  {selectedProgressCourse.course?.course_code} -{' '}
                  {selectedProgressCourse.course?.course_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedProgressCourse(null)}
                className="p-1.5 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Step 1: Exam Held */}
              <div className="p-4 bg-secondary/20 border border-border/60 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase">
                    1. Examination Status
                  </div>
                  <div className="text-sm font-extrabold text-foreground mt-0.5">
                    Main Paper Conducted
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full border text-xs font-extrabold ${
                    selectedProgressCourse.progress?.exam_held === 'HELD'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : selectedProgressCourse.progress?.exam_held === 'POSTPONED'
                        ? 'bg-red-500/10 text-red-400 border-red-500/30'
                        : 'bg-secondary text-muted-foreground border-border'
                  }`}
                >
                  {selectedProgressCourse.progress?.exam_held || 'PENDING'}
                </span>
              </div>

              {/* Step 2: 1st Marking */}
              <div className="p-4 bg-secondary/20 border border-border/60 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase">
                    2. First Marking Stage
                  </div>
                  <div className="text-sm font-extrabold text-foreground mt-0.5">
                    1st Marker Evaluation
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full border text-xs font-extrabold ${
                    selectedProgressCourse.progress?.first_marking === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : selectedProgressCourse.progress?.first_marking === 'IN_PROGRESS'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-secondary text-muted-foreground border-border'
                  }`}
                >
                  {selectedProgressCourse.progress?.first_marking || 'PENDING'}
                </span>
              </div>

              {/* Step 3: 2nd Marking */}
              <div className="p-4 bg-secondary/20 border border-border/60 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase">
                    3. Second Marking Stage
                  </div>
                  <div className="text-sm font-extrabold text-foreground mt-0.5">
                    2nd Marker Verification
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full border text-xs font-extrabold ${
                    selectedProgressCourse.progress?.second_marking === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : selectedProgressCourse.progress?.second_marking === 'IN_PROGRESS'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-secondary text-muted-foreground border-border'
                  }`}
                >
                  {selectedProgressCourse.progress?.second_marking || 'PENDING'}
                </span>
              </div>

              {/* Step 4: Final Release */}
              <div className="p-4 bg-primary/10 border border-primary/30 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-primary uppercase">
                    4. Final Results Release
                  </div>
                  <div className="text-sm font-extrabold text-foreground mt-0.5">
                    Board Approval & Student Release
                  </div>
                </div>
                <span
                  className={`px-3.5 py-1 rounded-full border text-xs font-extrabold ${
                    selectedProgressCourse.progress?.published === 'PUBLISHED' ||
                    selectedProgressCourse.is_published
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                      : 'bg-secondary text-muted-foreground border-border'
                  }`}
                >
                  {selectedProgressCourse.progress?.published === 'PUBLISHED' ||
                  selectedProgressCourse.is_published
                    ? 'PUBLISHED'
                    : 'IN PROGRESS'}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border/60">
              <button
                onClick={() => setSelectedProgressCourse(null)}
                className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-sm hover:bg-primary/95 transition"
              >
                Close Progress View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
