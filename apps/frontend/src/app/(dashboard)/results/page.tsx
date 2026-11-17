'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import { useToast } from '../../../hooks/use-toast';
import {
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  Download,
  Activity,
  X,
  Search,
  BookOpen,
  CheckCircle2,
  GraduationCap,
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

  // Search query filter for results
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

  // Summary Metrics:
  // 1. Total Registered Credits
  const totalRegisteredCredits = useMemo(
    () =>
      grades.reduce((sum: number, g: any) => sum + (parseFloat(g.course?.credit_value) || 0), 0),
    [grades],
  );
  const registeredCompulsoryCredits = useMemo(
    () =>
      grades
        .filter((g: any) => g.type === 'COMPULSORY')
        .reduce((sum: number, g: any) => sum + (parseFloat(g.course?.credit_value) || 0), 0),
    [grades],
  );
  const registeredOptionalCredits = useMemo(
    () =>
      grades
        .filter((g: any) => g.type !== 'COMPULSORY')
        .reduce((sum: number, g: any) => sum + (parseFloat(g.course?.credit_value) || 0), 0),
    [grades],
  );

  // 2. Total Completed Credits (updates once results are published)
  const isPassedGrade = (g: any) =>
    Boolean(g.is_published) &&
    !g.is_violated &&
    !g.is_held &&
    g.grade &&
    g.grade !== 'F' &&
    g.grade !== 'E' &&
    g.grade !== 'AB' &&
    g.grade !== 'Pending';

  const totalCompletedCredits = useMemo(
    () =>
      grades
        .filter(isPassedGrade)
        .reduce((sum: number, g: any) => sum + (parseFloat(g.course?.credit_value) || 0), 0),
    [grades],
  );
  const completedCompulsoryCredits = useMemo(
    () =>
      grades
        .filter((g: any) => isPassedGrade(g) && g.type === 'COMPULSORY')
        .reduce((sum: number, g: any) => sum + (parseFloat(g.course?.credit_value) || 0), 0),
    [grades],
  );
  const completedOptionalCredits = useMemo(
    () =>
      grades
        .filter((g: any) => isPassedGrade(g) && g.type !== 'COMPULSORY')
        .reduce((sum: number, g: any) => sum + (parseFloat(g.course?.credit_value) || 0), 0),
    [grades],
  );

  // 3. CGPA
  const cgpaDisplay = useMemo(() => {
    const publishedGpas = (reportCard?.gpas || []).filter((gpa: any) => gpa.is_published);
    if (publishedGpas.length > 0) {
      const latestGpa = publishedGpas[publishedGpas.length - 1];
      return Number(latestGpa.cumulative_gpa).toFixed(2);
    }
    let totalGpProduct = 0;
    let totalCredits = 0;
    grades.forEach((g: any) => {
      if (g.is_published && !g.is_violated && !g.is_held) {
        const cred = parseFloat(g.course?.credit_value) || 0;
        const gp = Number(g.grade_point) || 0;
        totalGpProduct += gp * cred;
        totalCredits += cred;
      }
    });
    return totalCredits > 0 ? (totalGpProduct / totalCredits).toFixed(2) : '0.00';
  }, [reportCard?.gpas, grades]);

  // Semester ordering: 1.1 to 4.2
  const ORDERED_SEMESTERS = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'];

  const studentSemesters = useMemo(() => {
    const present = new Set(grades.map((g: any) => g.course?.semester).filter(Boolean));
    const sorted = ORDERED_SEMESTERS.filter((s) => present.has(s));
    present.forEach((s: any) => {
      if (!ORDERED_SEMESTERS.includes(s) && !sorted.includes(s)) {
        sorted.push(s);
      }
    });
    return sorted;
  }, [grades]);

  const getSemesterGpa = (sem: string, semGrades: any[]) => {
    const semGpaRecord = (reportCard?.gpas || []).find(
      (gpa: any) => gpa.semester === sem && gpa.is_published,
    );
    if (semGpaRecord) {
      return Number(semGpaRecord.semester_gpa).toFixed(2);
    }
    const publishedInSem = semGrades.filter(
      (g: any) => g.is_published && !g.is_violated && !g.is_held,
    );
    if (publishedInSem.length > 0) {
      let gpProduct = 0;
      let creds = 0;
      publishedInSem.forEach((g: any) => {
        const c = parseFloat(g.course?.credit_value) || 0;
        const gp = Number(g.grade_point) || 0;
        gpProduct += gp * c;
        creds += c;
      });
      if (creds > 0) return (gpProduct / creds).toFixed(2);
    }
    return null;
  };

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

      {/* 3 Summary Cards */}
      {isStudent && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Total Registered Credits */}
          <div className="bg-card/30 border border-border/80 p-5 rounded-3xl shadow-sm backdrop-blur-md flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Total Registered Credits
              </span>
              <div className="text-2xl font-extrabold font-mono text-foreground">
                {totalRegisteredCredits.toFixed(1)}{' '}
                <span className="text-xs font-semibold text-muted-foreground">Credits</span>
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-2 pt-0.5">
                <span className="flex items-center gap-1">
                  <span className="px-1 py-0.2 bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 rounded text-[9px] font-bold">
                    C
                  </span>
                  <span>{registeredCompulsoryCredits.toFixed(1)}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className="px-1 py-0.2 bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 rounded text-[9px] font-bold">
                    O
                  </span>
                  <span>{registeredOptionalCredits.toFixed(1)}</span>
                </span>
              </div>
            </div>
            <div className="p-3.5 bg-primary/10 text-primary rounded-2xl shrink-0">
              <BookOpen className="h-6 w-6" />
            </div>
          </div>

          {/* Card 2: Total Completed Credits */}
          <div className="bg-card/30 border border-border/80 p-5 rounded-3xl shadow-sm backdrop-blur-md flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Total Completed Credits
              </span>
              <div className="text-2xl font-extrabold font-mono text-foreground">
                {totalCompletedCredits.toFixed(1)}{' '}
                <span className="text-xs font-semibold text-muted-foreground">Credits</span>
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-2 pt-0.5">
                <span className="flex items-center gap-1">
                  <span className="px-1 py-0.2 bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 rounded text-[9px] font-bold">
                    C
                  </span>
                  <span>{completedCompulsoryCredits.toFixed(1)}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className="px-1 py-0.2 bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 rounded text-[9px] font-bold">
                    O
                  </span>
                  <span>{completedOptionalCredits.toFixed(1)}</span>
                </span>
              </div>
            </div>
            <div className="p-3.5 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-2xl shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>

          {/* Card 3: CGPA */}
          <div className="bg-card/30 border border-border/80 p-5 rounded-3xl shadow-sm backdrop-blur-md flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Cumulative GPA (CGPA)
              </span>
              <div className="text-2xl font-extrabold font-mono text-primary">{cgpaDisplay}</div>
              <p className="text-[11px] text-muted-foreground pt-0.5">
                Overall academic performance index
              </p>
            </div>
            <div className="p-3.5 bg-primary/10 text-primary rounded-2xl shrink-0">
              <GraduationCap className="h-6 w-6" />
            </div>
          </div>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="bg-card border border-border/80 p-4 rounded-3xl shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search course code or module name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-8 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/60 text-foreground"
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
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="px-3 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-xl hover:bg-secondary/80 transition cursor-pointer"
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Semester Results Cards (Ordered 1.1 to 4.2) */}
      {isReportLoading ? (
        <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-3 bg-card/25 border border-border/80 rounded-3xl">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Loading academic records...</p>
        </div>
      ) : studentSemesters.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground bg-card/25 border border-border/80 rounded-3xl flex flex-col items-center justify-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <h4 className="text-sm font-bold text-foreground">No Academic Records Found</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            There are no registered course records or published examination results for your
            profile.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {studentSemesters.map((sem) => {
            const rawSemGrades = grades.filter((g: any) => g.course?.semester === sem);
            const semGrades = rawSemGrades.filter((g: any) => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase().trim();
              const code = (g.course?.course_code || '').toLowerCase();
              const name = (g.course?.course_name || '').toLowerCase();
              return code.includes(q) || name.includes(q);
            });

            if (searchQuery.trim() && semGrades.length === 0) {
              return null;
            }

            const semGpa = getSemesterGpa(sem, rawSemGrades);

            return (
              <div
                key={sem}
                className="bg-card/25 border border-border/80 rounded-3xl shadow-xl overflow-hidden backdrop-blur-md space-y-0"
              >
                {/* Semester Card Header */}
                <div className="p-5 border-b border-border/80 bg-secondary/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-bold text-foreground">Semester {sem}</h3>
                      <span className="px-2 py-0.5 bg-secondary border border-border/60 rounded-md text-[10px] font-mono font-semibold text-muted-foreground">
                        {rawSemGrades.length} Modules
                      </span>
                    </div>
                  </div>

                  {/* Top Right: Semester GPA */}
                  <div>
                    {semGpa ? (
                      <div className="flex items-center gap-2 bg-primary/10 border border-primary/25 px-3 py-1.5 rounded-xl">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                          SGPA:
                        </span>
                        <span className="font-mono text-sm font-extrabold text-primary">
                          {semGpa}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-secondary/30 border border-border/60 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground">
                        <span>SGPA: Results Pending</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Semester Courses Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/10">
                        <th className="px-3.5 py-3 w-10 text-center">#</th>
                        <th className="px-4 py-3 whitespace-nowrap">Course Code</th>
                        <th className="px-4 py-3">Module Name</th>
                        <th className="px-4 py-3 whitespace-nowrap text-center">Credits</th>
                        <th className="px-4 py-3 whitespace-nowrap text-center">Status</th>
                        <th className="px-4 py-3 whitespace-nowrap text-center">CA Marks</th>
                        <th className="px-4 py-3 whitespace-nowrap text-center">Final Grade</th>
                        <th className="px-4 py-3 whitespace-nowrap text-right">
                          Publishing Progress
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-xs font-medium">
                      {semGrades.map((grade: any, idx: number) => {
                        const prog = myProgress.find(
                          (p: any) => p.course_id === grade.course?.course_id,
                        );

                        const isCaPublished = Boolean(grade.course?.ca_published);
                        const caObtained = Number(grade.continuous_assessment_marks ?? 0);
                        const caWeight = grade.max_ca_weight || 40;
                        const formattedScore =
                          caObtained % 1 === 0 ? caObtained : Number(caObtained.toFixed(1));
                        const displayCa = isCaPublished
                          ? `${formattedScore}/${caWeight}`
                          : 'Pending';

                        const isComp = grade.type === 'COMPULSORY';

                        return (
                          <tr
                            key={grade.grade_id}
                            className="hover:bg-secondary/15 transition-colors"
                          >
                            <td className="px-3.5 py-3 text-center font-mono text-muted-foreground font-bold text-xs">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md uppercase">
                                {grade.course?.course_code}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-foreground">
                              {grade.course?.course_name}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center font-mono font-semibold text-foreground">
                              {parseFloat(grade.course?.credit_value)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              {isComp ? (
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-bold border bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/25"
                                  title="Compulsory"
                                >
                                  C
                                </span>
                              ) : (
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-bold border bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/25"
                                  title="Optional"
                                >
                                  O
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center font-mono font-bold">
                              {isCaPublished ? (
                                <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  {displayCa}
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs text-muted-foreground font-medium italic">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              {grade.is_violated ? (
                                <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl font-extrabold text-xs">
                                  VIOLATED (Held)
                                </span>
                              ) : grade.is_published ? (
                                <span className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-xl font-extrabold text-xs">
                                  {grade.grade}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground italic font-medium">
                                  Processing
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
              <div className="p-4 bg-secondary/20 border border-border/60 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase">
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
