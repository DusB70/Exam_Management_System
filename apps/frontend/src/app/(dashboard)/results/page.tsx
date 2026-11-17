'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import { useToast } from '../../../hooks/use-toast';
import { useProgressiveList } from '../../../hooks/use-progressive-load';
import { ProgressiveLoadFooter } from '../../../components/ui/progressive-load-footer';
import {
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  Download,
  Activity,
  X,
  Search,
} from 'lucide-react';
import { UserRole } from '@ems/shared';

export default function ResultsAndImportsPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const role = user?.role;
  const isStudent = role === UserRole.STUDENT;

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);

  // Modal State for Progress Tracker Popup
  const [selectedProgressCourse, setSelectedProgressCourse] = useState<any | null>(null);

  // Filters for results
  const [semesterFilter, setSemesterFilter] = useState('active');
  const [yearFilter, setYearFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Exam Violation Modal State (Staff/Admin)
  const [violationModalOpen, setViolationModalOpen] = useState(false);
  const [violationStudentId, setViolationStudentId] = useState<number | ''>('');
  const [violationYear, setViolationYear] = useState<number>(new Date().getFullYear());
  const [violationSemester, setViolationSemester] = useState<string>('2.2');
  const [violationReason, setViolationReason] = useState<string>('');
  const [violationSubmitting, setViolationSubmitting] = useState(false);
  const [violationMsg, setViolationMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

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
      toast.success('PDF transcript downloaded successfully.');
    } catch {
      toast.error('Failed to download PDF transcript.');
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
      toast.success('Excel transcript downloaded successfully.');
    } catch {
      toast.error('Failed to download Excel transcript.');
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

  const filteredGrades = useMemo(
    () =>
      grades.filter((g: any) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const code = (g.course?.course_code || '').toLowerCase();
          const name = (g.course?.course_name || '').toLowerCase();
          if (!code.includes(q) && !name.includes(q)) return false;
        }
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
      }),
    [grades, searchQuery, semesterFilter, activeSemester, yearFilter, typeFilter],
  );

  const {
    visibleItems: visibleGrades,
    visibleCount: visibleGradesCount,
    totalCount: totalGradesCount,
    hasMore: hasMoreGrades,
  } = useProgressiveList<any>(filteredGrades, {
    resetKey: `${searchQuery}|${semesterFilter}|${yearFilter}|${typeFilter}`,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn">
      {/* Title Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">My Academic Results Sheet</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            View continuous assessment marks, allocated total CA weight, released letter grades, and
            inspect result publishing progress.
          </p>
        </div>

        <div className="flex flex-row flex-nowrap items-center gap-3 shrink-0">
          {!isStudent && (
            <button
              onClick={() => setViolationModalOpen(true)}
              className="px-4 py-2.5 bg-rose-600 text-white font-semibold rounded-xl hover:bg-rose-500 transition text-xs flex items-center gap-2 shadow-lg shadow-rose-600/20 cursor-pointer whitespace-nowrap"
            >
              <AlertTriangle className="h-4 w-4" />
              Mark Exam Violation
            </button>
          )}
          {isStudent && (
            <>
              <button
                onClick={handleDownloadMyPdf}
                disabled={isDownloadingPdf}
                className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50 whitespace-nowrap"
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
                className="px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-500 transition text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isDownloadingExcel ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                Download Excel Sheet
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-card border border-border/80 p-5 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search course code or module name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-8 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/60 text-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Year Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">Year:</span>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 cursor-pointer"
            >
              <option value="all">All Years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          </div>

          {/* Semester Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">Semester:</span>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 cursor-pointer"
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

          {/* Course Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="compulsory">Compulsory Only</option>
              <option value="optional">Optional Only</option>
            </select>
          </div>

          {(yearFilter !== 'all' ||
            semesterFilter !== 'active' ||
            typeFilter !== 'all' ||
            searchQuery) && (
            <button
              onClick={() => {
                setYearFilter('all');
                setSemesterFilter('active');
                setTypeFilter('all');
                setSearchQuery('');
              }}
              className="px-3 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-xl hover:bg-secondary/80 transition cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Results Table */}
      {(() => {
        const hasAnyMultipleAttempts = filteredGrades.some(
          (g: any) => g.hasMultipleAttempts || g.attempts?.repeat_1 || g.attempts?.repeat_2,
        );

        return (
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
                      <th className="px-4 py-4 w-12 text-center">#</th>
                      <th className="px-6 py-4">Semester</th>
                      <th className="px-6 py-4">Course Code</th>
                      <th className="px-6 py-4">Module Name</th>
                      <th className="px-6 py-4">Credits</th>
                      {hasAnyMultipleAttempts ? (
                        <>
                          <th className="px-6 py-4 text-center bg-indigo-500/5 text-indigo-400">
                            Proper
                          </th>
                          <th className="px-6 py-4 text-center bg-amber-500/5 text-amber-400">
                            Repeat 1
                          </th>
                          <th className="px-6 py-4 text-center bg-rose-500/5 text-rose-400">
                            Repeat 2
                          </th>
                        </>
                      ) : (
                        <th className="px-6 py-4 text-center">CA Marks</th>
                      )}
                      <th className="px-6 py-4 text-center">Publishing Progress</th>
                      <th className="px-6 py-4 text-right">Overall Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-sm font-medium">
                    {filteredGrades.length === 0 ? (
                      <tr>
                        <td
                          colSpan={hasAnyMultipleAttempts ? 10 : 8}
                          className="text-center py-12 text-muted-foreground text-xs"
                        >
                          No results match the current filters.
                        </td>
                      </tr>
                    ) : (
                      visibleGrades.map((grade: any, idx: number) => {
                        const prog = myProgress.find(
                          (p: any) => p.course_id === grade.course?.course_id,
                        );

                        const isCaPublished = Boolean(grade.course?.ca_published);
                        const caObtained = Number(grade.continuous_assessment_marks ?? 0);
                        const caWeight = grade.max_ca_weight || 40;
                        const formattedScore =
                          caObtained % 1 === 0 ? caObtained : Number(caObtained.toFixed(1));
                        const formattedCa = isCaPublished
                          ? `${formattedScore} out of ${caWeight}`
                          : 'Pending';

                        return (
                          <tr
                            key={grade.grade_id}
                            className="hover:bg-secondary/15 transition-colors"
                          >
                            <td className="px-4 py-4 text-center font-mono text-muted-foreground font-bold text-xs">
                              {idx + 1}
                            </td>
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

                            {hasAnyMultipleAttempts ? (
                              <>
                                <td className="px-6 py-4 text-center font-mono font-bold">
                                  {grade.attempts?.proper?.is_published ? (
                                    <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-lg text-xs">
                                      {grade.attempts.proper.grade}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-center font-mono font-bold">
                                  {grade.attempts?.repeat_1?.is_published ? (
                                    <span className="px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-lg text-xs">
                                      {grade.attempts.repeat_1.grade}
                                    </span>
                                  ) : grade.attempts?.repeat_1 ? (
                                    <span className="text-amber-400 text-xs italic">Pending</span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-center font-mono font-bold">
                                  {grade.attempts?.repeat_2?.is_published ? (
                                    <span className="px-2.5 py-1 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-lg text-xs">
                                      {grade.attempts.repeat_2.grade}
                                    </span>
                                  ) : grade.attempts?.repeat_2 ? (
                                    <span className="text-rose-400 text-xs italic">Pending</span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </td>
                              </>
                            ) : (
                              <td className="px-6 py-4 text-center font-mono font-extrabold text-foreground">
                                <span
                                  className={`px-3 py-1 rounded-xl text-xs font-bold ${
                                    isCaPublished
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-secondary text-muted-foreground border border-border'
                                  }`}
                                >
                                  {formattedCa}
                                </span>
                              </td>
                            )}

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
                              {grade.is_violated ? (
                                <span className="px-3 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl font-extrabold text-xs">
                                  VIOLATED (Held)
                                </span>
                              ) : grade.is_published ? (
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
                <ProgressiveLoadFooter
                  loadedCount={visibleGradesCount}
                  totalCount={totalGradesCount}
                  isLoadingMore={hasMoreGrades}
                  hasMore={hasMoreGrades}
                  entityLabel="result records"
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* STAFF EXAM VIOLATION MODAL */}
      {violationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm !m-0">
          <div className="bg-card border border-border/80 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <AlertTriangle className="h-5 w-5" />
                <span>Mark Exam Disciplinary Violation</span>
              </div>
              <button
                onClick={() => setViolationModalOpen(false)}
                className="p-1 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {violationMsg && (
              <div
                className={`p-3.5 rounded-xl text-xs font-semibold ${
                  violationMsg.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                {violationMsg.text}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!violationStudentId) {
                  setViolationMsg({ type: 'error', text: 'Please enter a valid Student ID.' });
                  return;
                }
                setViolationSubmitting(true);
                setViolationMsg(null);
                try {
                  const res = await apiClient.post('/results/violations', {
                    studentId: Number(violationStudentId),
                    academicYear: Number(violationYear),
                    semester: violationSemester,
                    reason: violationReason || undefined,
                  });
                  if (res.data?.success) {
                    setViolationMsg({ type: 'success', text: res.data.message });
                    setViolationReason('');
                  }
                } catch (err: any) {
                  setViolationMsg({
                    type: 'error',
                    text: err.response?.data?.message || 'Failed to record violation.',
                  });
                } finally {
                  setViolationSubmitting(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-muted-foreground mb-1">Student ID</label>
                <input
                  type="number"
                  required
                  placeholder="Enter Student ID (e.g. 1)"
                  value={violationStudentId}
                  onChange={(e) =>
                    setViolationStudentId(e.target.value ? Number(e.target.value) : '')
                  }
                  className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">
                    Academic Year
                  </label>
                  <input
                    type="number"
                    required
                    value={violationYear}
                    onChange={(e) => setViolationYear(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/60"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">
                    Violated Semester
                  </label>
                  <select
                    value={violationSemester}
                    onChange={(e) => setViolationSemester(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/60"
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
                </div>
              </div>

              <div>
                <label className="block font-semibold text-muted-foreground mb-1">
                  Violation Reason / Report Details
                </label>
                <textarea
                  rows={3}
                  placeholder="Details of the exam rule violation..."
                  value={violationReason}
                  onChange={(e) => setViolationReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/60"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setViolationModalOpen(false)}
                  className="px-4 py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition text-xs border border-border/80 cursor-pointer shadow-sm"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={violationSubmitting}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl shadow-lg shadow-rose-600/20 transition text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {violationSubmitting ? 'Recording...' : 'Record Violation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP MODAL: RESULT PUBLISHING PROGRESS DIALOG */}
      {/* ========================================================================= */}
      {selectedProgressCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm !m-0">
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
                  className={`px-2 py-0.5 rounded border text-[10px] font-extrabold ${
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
                  className={`px-2 py-0.5 rounded border text-[10px] font-extrabold ${
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
                  className={`px-2 py-0.5 rounded border text-[10px] font-extrabold ${
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
                  className={`px-2.5 py-0.5 rounded border text-[10px] font-extrabold ${
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
                className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
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
