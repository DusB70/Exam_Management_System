'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';
import {
  BookOpen,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Upload,
  Loader2,
  Award,
  BookMarked,
  FileSpreadsheet,
  GraduationCap,
  Sparkles,
  Download,
  Search,
} from 'lucide-react';
import { UserRole } from '@ems/shared';

export default function ResultsAndImportsPage() {
  const { user } = useAuthStore();
  const role = user?.role;

  const isStudent = role === UserRole.STUDENT;
  const isStaffOrAdmin = role === UserRole.EXAM_DIVISION_STAFF || role === UserRole.ADMINISTRATOR;

  // Notification states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Staff Publisher Form State
  const [publishYear, setPublishYear] = useState<string>(new Date().getFullYear().toString());
  const [publishSemester, setPublishSemester] = useState<string>('1');

  // Staff Import Files State
  const [studentsFile, setStudentsFile] = useState<File | null>(null);
  const [marksFile, setMarksFile] = useState<File | null>(null);
  const [importExamId, setImportExamId] = useState<string>('');

  // Staff Student PDF Search State
  const [studentSearch, setStudentSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingPdfMap, setIsDownloadingPdfMap] = useState<Record<number, boolean>>({});

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

  // ==========================================
  // STAFF LOOKUP DATA
  // ==========================================

  // Fetch all exams (to populate marks import select)
  const { data: examsList = [], isLoading: isExamsLoading } = useQuery({
    queryKey: ['admin-exams-list'],
    queryFn: async () => {
      const response = await apiClient.get('/marks/pending-approvals');
      return response.data?.data || [];
    },
    enabled: isStaffOrAdmin,
  });

  // Fetch searched student users
  const { data: searchedStudents = [], isLoading: isSearchLoading } = useQuery({
    queryKey: ['staff-students-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery) return [];
      const response = await apiClient.get('/users', {
        params: {
          roleId: 4, // Student role ID
          search: searchQuery,
          page: 1,
          limit: 10,
        },
      });
      return response.data?.data?.items || [];
    },
    enabled: isStaffOrAdmin && !!searchQuery,
  });

  // ==========================================
  // MUTATIONS (PUBLISH & BULK UPLOADS)
  // ==========================================

  // Publish results mutation
  const publishMutation = useMutation({
    mutationFn: async (payload: { academicYear: number; semester: number }) => {
      await apiClient.post('/results/publish', payload);
    },
    onSuccess: () => {
      setSuccessMsg('Semester results compiled and published successfully!');
      setErrorMsg(null);
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to publish results.');
      setSuccessMsg(null);
    },
  });

  // Import students mutation
  const importStudentsMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post('/imports/students', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: (data) => {
      setSuccessMsg(data.message || 'Students imported successfully.');
      setErrorMsg(null);
      setStudentsFile(null);
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to import students registry.');
      setSuccessMsg(null);
    },
  });

  // Import marks mutation
  const importMarksMutation = useMutation({
    mutationFn: async ({ examId, file }: { examId: number; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post(`/imports/exams/${examId}/marks`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: (data) => {
      setSuccessMsg(data.message || 'Marksheet marks imported successfully.');
      setErrorMsg(null);
      setMarksFile(null);
      setImportExamId('');
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to import exam marksheet.');
      setSuccessMsg(null);
    },
  });

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishYear || !publishSemester) return;
    if (
      confirm(
        `Are you sure you want to compile and publish results for Year ${publishYear} Semester ${publishSemester}? This will lock the marksheet entries permanently.`,
      )
    ) {
      publishMutation.mutate({
        academicYear: parseInt(publishYear, 10),
        semester: parseInt(publishSemester, 10),
      });
    }
  };

  const handleStudentsUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentsFile) return;
    importStudentsMutation.mutate(studentsFile);
  };

  const handleMarksUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!marksFile || !importExamId) return;
    importMarksMutation.mutate({
      examId: parseInt(importExamId, 10),
      file: marksFile,
    });
  };

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

  const handleDownloadStaffPdf = async (studentId: number, studentName: string) => {
    setIsDownloadingPdfMap((prev) => ({ ...prev, [studentId]: true }));
    try {
      const response = await apiClient.get(`/results/student/${studentId}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transcript_${studentName.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch {
      setErrorMsg('Failed to download student PDF transcript.');
    } finally {
      setIsDownloadingPdfMap((prev) => ({ ...prev, [studentId]: false }));
    }
  };

  // Resolve Student GPA metrics
  const gpas = reportCard?.gpas || [];
  const grades = reportCard?.grades || [];
  const latestGpa = gpas.length > 0 ? gpas[gpas.length - 1] : null;

  const totalCreditsEarned = grades.reduce(
    (sum: number, g: any) => sum + parseFloat(g.course.credit_value),
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

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-2xl font-medium flex gap-2 items-center">
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
          <span>{successMsg}</span>
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
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-foreground">Official Transcript Sheets</h3>
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
                          <th className="px-6 py-4 text-center">Grade Letter</th>
                          <th className="px-6 py-4 text-right">Grade Point</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 text-sm font-medium">
                        {grades.map((grade: any) => (
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
                            <td className="px-6 py-4 text-center">
                              <span className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-md font-extrabold text-xs">
                                {grade.grade}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-bold text-foreground">
                              {grade.grade_point.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Results Publishing Form */}
          <div className="lg:col-span-1 bg-card/25 border border-border/80 p-6 rounded-3xl backdrop-blur-md space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-primary" />
              Publishing Controls
            </h3>

            <form onSubmit={handlePublish} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Academic Year
                </label>
                <input
                  type="number"
                  value={publishYear}
                  onChange={(e) => setPublishYear(e.target.value)}
                  className="w-full px-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Semester (1 - 8)
                </label>
                <select
                  value={publishSemester}
                  onChange={(e) => setPublishSemester(e.target.value)}
                  className="w-full px-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s} className="bg-card">
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={publishMutation.isPending}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-primary/10"
              >
                {publishMutation.isPending ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-4.5 w-4.5" />
                    Compile & Publish
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Bulk Spreadsheet Uploads */}
          <div className="lg:col-span-2 space-y-6">
            {/* Student Search & PDF Download Card */}
            <div className="bg-card/25 border border-border/80 p-6 rounded-3xl backdrop-blur-md space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Search className="h-4.5 w-4.5 text-primary" />
                Student Academic Report Downloader
              </h3>
              <p className="text-xs text-muted-foreground leading-normal">
                Search for a student by name or registration number to download their official PDF
                transcript card.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter name or registration number..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSearchQuery(studentSearch);
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-secondary/30 border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary/60 text-foreground"
                />
                <button
                  onClick={() => setSearchQuery(studentSearch)}
                  className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-1.5"
                >
                  <Search className="h-3.5 w-3.5" />
                  Search
                </button>
              </div>

              {isSearchLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : searchQuery && searchedStudents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No matching students found.
                </p>
              ) : searchedStudents.length > 0 ? (
                <div className="border border-border/50 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-secondary/10 border-b border-border/60 font-bold text-muted-foreground">
                        <th className="p-3">Student Name</th>
                        <th className="p-3">Reg No</th>
                        <th className="p-3">Department</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-medium">
                      {searchedStudents.map((u: any) => {
                        const sId = u.student?.student_id;
                        const regNo = u.student?.registration_number;
                        const dept = u.student?.department?.department_code || 'N/A';
                        if (!sId) return null;

                        return (
                          <tr key={u.user_id} className="hover:bg-secondary/5">
                            <td className="p-3 text-foreground">{u.full_name}</td>
                            <td className="p-3 text-muted-foreground font-mono">{regNo}</td>
                            <td className="p-3 text-muted-foreground">{dept}</td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleDownloadStaffPdf(sId, u.full_name)}
                                disabled={isDownloadingPdfMap[sId]}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground rounded-lg transition-colors font-semibold disabled:opacity-50"
                              >
                                {isDownloadingPdfMap[sId] ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Download className="h-3 w-3" />
                                )}
                                Download PDF
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>

            {/* Student Import Card */}
            <div className="bg-card/25 border border-border/80 p-6 rounded-3xl backdrop-blur-md space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <GraduationCap className="h-4.5 w-4.5 text-primary" />
                Bulk Student Registry Import
              </h3>
              <p className="text-xs text-muted-foreground leading-normal">
                Upload an Excel/CSV spreadsheet to import students in bulk. Required columns in row
                1:{' '}
                <code className="text-primary font-mono bg-primary/5 px-1 py-0.5 rounded font-bold">
                  fullName
                </code>
                ,{' '}
                <code className="text-primary font-mono bg-primary/5 px-1 py-0.5 rounded font-bold">
                  email
                </code>
                ,{' '}
                <code className="text-primary font-mono bg-primary/5 px-1 py-0.5 rounded font-bold">
                  registrationNumber
                </code>
                ,{' '}
                <code className="text-primary font-mono bg-primary/5 px-1 py-0.5 rounded font-bold">
                  departmentCode
                </code>
                ,{' '}
                <code className="text-primary font-mono bg-primary/5 px-1 py-0.5 rounded font-bold">
                  academicYear
                </code>
                ,{' '}
                <code className="text-primary font-mono bg-primary/5 px-1 py-0.5 rounded font-bold">
                  semester
                </code>
                .
              </p>

              <form onSubmit={handleStudentsUpload} className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => setStudentsFile(e.target.files?.[0] || null)}
                  className="px-4 py-2 bg-secondary/30 border border-border rounded-xl text-xs"
                />
                <button
                  type="submit"
                  disabled={!studentsFile || importStudentsMutation.isPending}
                  className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {importStudentsMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Upload Students
                </button>
              </form>
            </div>

            {/* Marks Import Card */}
            <div className="bg-card/25 border border-border/80 p-6 rounded-3xl backdrop-blur-md space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileSpreadsheet className="h-4.5 w-4.5 text-primary" />
                Bulk Exam Marks Import
              </h3>
              <p className="text-xs text-muted-foreground leading-normal">
                Upload a spreadsheet to import marks for a specific assessment. Required columns in
                row 1:{' '}
                <code className="text-primary font-mono bg-primary/5 px-1 py-0.5 rounded font-bold">
                  registrationNumber
                </code>
                ,{' '}
                <code className="text-primary font-mono bg-primary/5 px-1 py-0.5 rounded font-bold">
                  marksObtained
                </code>
                .
              </p>

              <form onSubmit={handleMarksUpload} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Select Exam Target
                    </label>
                    <select
                      value={importExamId}
                      onChange={(e) => setImportExamId(e.target.value)}
                      disabled={isExamsLoading}
                      className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary transition text-xs text-foreground"
                    >
                      <option value="">Select target exam...</option>
                      {examsList.map((exam: any) => (
                        <option key={exam.exam_id} value={exam.exam_id} className="bg-card">
                          {exam.course?.course_code} - {exam.exam_title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={(e) => setMarksFile(e.target.files?.[0] || null)}
                      className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-xl text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!marksFile || !importExamId || importMarksMutation.isPending}
                  className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {importMarksMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Upload Marksheet
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
