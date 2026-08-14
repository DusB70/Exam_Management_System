'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import {
  BookOpen,
  AlertTriangle,
  Loader2,
  Award,
  BookMarked,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { UserRole } from '@ems/shared';

export default function ResultsAndImportsPage() {
  const { user } = useAuthStore();
  const role = user?.role;

  const isStudent = role === UserRole.STUDENT;
  const isStaffOrAdmin = role === UserRole.EXAM_DIVISION_STAFF || role === UserRole.ADMINISTRATOR;

  // Notification states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);

  // ==========================================
  // STUDENT PORTAL QUERIES
  // ==========================================

  // Fetch student report card details
  const { data: reportCard, isLoading: isReportLoading } = useQuery({
    queryKey: ['my-report'],
    queryFn: async () => {
      const response = await apiClient.get('/results/my-report');
      return response.data?.data;
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

  // Resolve Student GPA metrics
  const gpas = reportCard?.gpas || [];
  const grades = reportCard?.grades || [];
  const latestGpa = gpas.length > 0 ? gpas[gpas.length - 1] : null;

  const totalCreditsEarned = grades.reduce(
    (sum: number, g: any) => sum + parseFloat(g.course?.credit_value || '0'),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Academic Results & Tools</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {isStudent
            ? `Welcome, ${user?.fullName}! View your semester GPA cards, letter grades report sheets, and credit logs.`
            : 'Excel bulk spreadsheet imports, results publishing control centers, and database synchronization tools'}
        </p>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-2xl font-medium flex gap-2 items-center">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STUDENT PORTAL VIEWS */}
      {/* ========================================================================= */}
      {isStudent && (
        <div className="space-y-8">
          {isReportLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Loading report card data...</p>
            </div>
          ) : gpas.length === 0 ? (
            <div className="p-20 text-center bg-card/10 border border-border/60 rounded-3xl flex flex-col items-center justify-center">
              <Award className="h-12 w-12 text-muted-foreground/45 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">
                No Published Results Found
              </p>
              <p className="text-xs text-muted-foreground/75 mt-1 max-w-sm">
                Your grades have not been finalized or published by the Exam Division for this
                semester yet.
              </p>
            </div>
          ) : (
            <>
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* CGPA card */}
                <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/25 rounded-3xl flex items-center justify-between shadow-xl">
                  <div>
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">
                      CUMULATIVE GPA (CGPA)
                    </p>
                    <h2 className="text-4xl font-extrabold text-foreground mt-2 font-mono">
                      {latestGpa ? latestGpa.cumulative_gpa.toFixed(2) : '0.00'}
                    </h2>
                    <p className="text-xs text-muted-foreground/80 mt-1">
                      Calculated across all historical semesters
                    </p>
                  </div>
                  <div className="p-4 bg-primary/15 text-primary rounded-2xl">
                    <Award className="h-8 w-8" />
                  </div>
                </div>

                {/* Latest SGPA card */}
                <div className="p-6 bg-card/30 border border-border/80 rounded-3xl flex items-center justify-between shadow-xl">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      LATEST SEMESTER GPA
                    </p>
                    <h2 className="text-4xl font-extrabold text-foreground mt-2 font-mono">
                      {latestGpa ? latestGpa.semester_gpa.toFixed(2) : '0.00'}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Semester {latestGpa?.semester} - Academic Year {latestGpa?.academic_year}
                    </p>
                  </div>
                  <div className="p-4 bg-secondary/35 text-foreground/80 rounded-2xl">
                    <BookMarked className="h-8 w-8" />
                  </div>
                </div>

                {/* Total Credits */}
                <div className="p-6 bg-card/30 border border-border/80 rounded-3xl flex items-center justify-between shadow-xl">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      TOTAL EARNED CREDITS
                    </p>
                    <h2 className="text-4xl font-extrabold text-foreground mt-2 font-mono">
                      {totalCreditsEarned.toFixed(1)}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Completed credit value modules
                    </p>
                  </div>
                  <div className="p-4 bg-secondary/35 text-foreground/80 rounded-2xl">
                    <BookOpen className="h-8 w-8" />
                  </div>
                </div>
              </div>

              {/* Semester SGPAs list */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-foreground">Semester Breakdown</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {gpas.map((gpa: any) => (
                    <div
                      key={gpa.gpa_id}
                      className="p-4 bg-card/20 border border-border/60 rounded-2xl text-center space-y-2"
                    >
                      <p className="text-xs text-muted-foreground font-bold uppercase">
                        Semester {gpa.semester}
                      </p>
                      <h4 className="text-2xl font-extrabold text-foreground font-mono">
                        {gpa.semester_gpa.toFixed(2)}
                      </h4>
                      <p className="text-[10px] text-muted-foreground/75 leading-none mt-1">
                        CGPA to Date: {gpa.cumulative_gpa.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Course Grades table */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-foreground">Official Transcript Sheets</h3>
                  <div className="flex flex-wrap gap-2">
                    {grades.length > 0 && (
                      <>
                        <button
                          onClick={handleDownloadMyPdf}
                          disabled={isDownloadingPdf}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-xl shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          {isDownloadingPdf ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          Download PDF Transcript
                        </button>
                        <button
                          onClick={handleDownloadMyExcel}
                          disabled={isDownloadingExcel}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl shadow-lg hover:bg-emerald-500 transition-colors disabled:opacity-50"
                        >
                          {isDownloadingExcel ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                          )}
                          Download Excel Sheet
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                          <th className="px-6 py-4">Semester</th>
                          <th className="px-6 py-4">Code</th>
                          <th className="px-6 py-4">Module Name</th>
                          <th className="px-6 py-4">Credits</th>
                          <th className="px-6 py-4 text-center">CA Marks</th>
                          <th className="px-6 py-4 text-center">Final Exam</th>
                          <th className="px-6 py-4 text-center">Grade Letter</th>
                          <th className="px-6 py-4 text-right">Grade Point</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 text-sm font-medium">
                        {grades.map((grade: any) => {
                          const showCAOnly =
                            !grade.course?.is_published && grade.course?.ca_published;
                          return (
                            <tr
                              key={grade.grade_id}
                              className="hover:bg-secondary/15 transition-colors"
                            >
                              <td className="px-6 py-4 text-muted-foreground">
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
                              <td className="px-6 py-4 text-center font-mono font-bold text-foreground">
                                {grade.continuous_assessment_marks !== null
                                  ? grade.continuous_assessment_marks.toFixed(1)
                                  : '-'}
                              </td>
                              <td className="px-6 py-4 text-center font-mono font-bold">
                                {showCAOnly ? (
                                  <span className="text-xs text-muted-foreground italic font-normal">
                                    Unpublished
                                  </span>
                                ) : grade.final_exam_marks !== null ? (
                                  grade.final_exam_marks.toFixed(1)
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                {showCAOnly ? (
                                  <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded text-xs font-bold uppercase">
                                    CA Published
                                  </span>
                                ) : (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-md font-extrabold text-xs">
                                      {grade.grade}
                                    </span>
                                    {grade.result_status === 'PROVISIONAL' && (
                                      <span className="px-1.5 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded text-[10px] font-bold uppercase">
                                        Provisional
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right font-mono font-bold text-foreground">
                                {showCAOnly ? '-' : grade.grade_point.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* GPA Calculation Section */}
              <div className="bg-card/25 border border-border/80 p-6 rounded-3xl backdrop-blur-md space-y-6 shadow-xl">
                <div className="border-b border-border/60 pb-4">
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    GPA Calculation Breakdown
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    See the step-by-step mathematical breakdown of how your GPA is calculated.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Semester GPA Calculation */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-secondary/10 border border-border/40 p-4 rounded-2xl">
                      <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Semester {latestGpa?.semester} GPA (SGPA)
                        </h4>
                        <p className="text-2xl font-extrabold text-foreground font-mono mt-1">
                          {latestGpa ? latestGpa.semester_gpa.toFixed(2) : '0.00'}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-semibold">
                        SGPA
                      </span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Formula:</p>
                      <code className="block p-3 bg-secondary/20 border border-border/40 rounded-xl text-xs font-mono text-center text-primary font-bold">
                        SGPA = Σ(Credits × Grade Point) / Σ(Credits)
                      </code>
                    </div>

                    <div className="border border-border/50 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-secondary/15 border-b border-border/60 font-bold text-muted-foreground">
                            <th className="p-3">Course</th>
                            <th className="p-3 text-center">Credits (C)</th>
                            <th className="p-3 text-center">Grade Point (GP)</th>
                            <th className="p-3 text-right">Product (C × GP)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-medium">
                          {grades
                            .filter((g: any) => g.course?.semester === latestGpa?.semester)
                            .map((g: any) => {
                              const credVal = parseFloat(g.course?.credit_value || '0');
                              const gpVal = g.grade_point;
                              const prodVal = credVal * gpVal;
                              return (
                                <tr key={g.grade_id} className="hover:bg-secondary/5">
                                  <td className="p-3 font-semibold text-foreground">
                                    {g.course?.course_code}
                                  </td>
                                  <td className="p-3 text-center font-mono text-muted-foreground">
                                    {credVal.toFixed(1)}
                                  </td>
                                  <td className="p-3 text-center font-mono text-muted-foreground">
                                    {gpVal.toFixed(2)}
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-foreground">
                                    {prodVal.toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                          <tr className="bg-secondary/10 font-bold border-t border-border/60">
                            <td className="p-3 text-foreground font-bold">Total / Sum (Σ)</td>
                            <td className="p-3 text-center font-mono text-primary font-bold">
                              {grades
                                .filter((g: any) => g.course?.semester === latestGpa?.semester)
                                .reduce(
                                  (sum: number, g: any) =>
                                    sum + parseFloat(g.course?.credit_value || '0'),
                                  0,
                                )
                                .toFixed(1)}
                            </td>
                            <td className="p-3 text-center text-muted-foreground font-medium">-</td>
                            <td className="p-3 text-right font-mono text-primary font-bold">
                              {grades
                                .filter((g: any) => g.course?.semester === latestGpa?.semester)
                                .reduce(
                                  (sum: number, g: any) =>
                                    sum + parseFloat(g.course?.credit_value || '0') * g.grade_point,
                                  0,
                                )
                                .toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="p-3 bg-secondary/15 border border-border/45 rounded-xl text-xs space-y-1">
                      <span className="font-semibold text-muted-foreground">Calculation step:</span>
                      <p className="font-mono font-bold text-foreground">
                        SGPA ={' '}
                        {grades
                          .filter((g: any) => g.course?.semester === latestGpa?.semester)
                          .reduce(
                            (sum: number, g: any) =>
                              sum + parseFloat(g.course?.credit_value || '0') * g.grade_point,
                            0,
                          )
                          .toFixed(2)}{' '}
                        /{' '}
                        {grades
                          .filter((g: any) => g.course?.semester === latestGpa?.semester)
                          .reduce(
                            (sum: number, g: any) =>
                              sum + parseFloat(g.course?.credit_value || '0'),
                            0,
                          )
                          .toFixed(1)}{' '}
                        ={' '}
                        <span className="text-primary">
                          {latestGpa ? latestGpa.semester_gpa.toFixed(2) : '0.00'}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Cumulative GPA Calculation */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-primary/5 border border-primary/20 p-4 rounded-2xl">
                      <div>
                        <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
                          Cumulative GPA (CGPA)
                        </h4>
                        <p className="text-2xl font-extrabold text-foreground font-mono mt-1">
                          {latestGpa ? latestGpa.cumulative_gpa.toFixed(2) : '0.00'}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-xs font-semibold shadow-md">
                        CGPA
                      </span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Formula:</p>
                      <code className="block p-3 bg-secondary/20 border border-border/40 rounded-xl text-xs font-mono text-center text-primary font-bold">
                        CGPA = Σ(Credits × Grade Point) / Σ(Credits) [All Semesters]
                      </code>
                    </div>

                    <div className="border border-border/50 rounded-xl p-4 bg-secondary/10 space-y-3.5 text-xs">
                      <h5 className="font-bold text-foreground">All Semesters Totals</h5>
                      <div className="space-y-2.5 font-medium">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Total Cumulative Credits (Σ C):
                          </span>
                          <span className="font-mono font-bold text-foreground">
                            {grades
                              .reduce(
                                (sum: number, g: any) =>
                                  sum + parseFloat(g.course?.credit_value || '0'),
                                0,
                              )
                              .toFixed(1)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Total Grade Point Products (Σ C × GP):
                          </span>
                          <span className="font-mono font-bold text-foreground">
                            {grades
                              .reduce(
                                (sum: number, g: any) =>
                                  sum + parseFloat(g.course?.credit_value || '0') * g.grade_point,
                                0,
                              )
                              .toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-secondary/15 border border-border/45 rounded-xl text-xs space-y-1">
                      <span className="font-semibold text-muted-foreground">Calculation step:</span>
                      <p className="font-mono font-bold text-foreground">
                        CGPA ={' '}
                        {grades
                          .reduce(
                            (sum: number, g: any) =>
                              sum + parseFloat(g.course?.credit_value || '0') * g.grade_point,
                            0,
                          )
                          .toFixed(2)}{' '}
                        /{' '}
                        {grades
                          .reduce(
                            (sum: number, g: any) =>
                              sum + parseFloat(g.course?.credit_value || '0'),
                            0,
                          )
                          .toFixed(1)}{' '}
                        ={' '}
                        <span className="text-primary">
                          {latestGpa ? latestGpa.cumulative_gpa.toFixed(2) : '0.00'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* STAFF / ADMINISTRATOR VIEWS */}
      {/* ========================================================================= */}
      {isStaffOrAdmin && (
        <div className="p-10 text-center bg-card/25 border border-border/80 rounded-3xl backdrop-blur-md">
          <BookMarked className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-foreground">Staff Results Portal</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            Results approval workflows, grading queues, and spreadsheet imports are managed in the
            Marks Registry portal.
          </p>
        </div>
      )}
    </div>
  );
}
