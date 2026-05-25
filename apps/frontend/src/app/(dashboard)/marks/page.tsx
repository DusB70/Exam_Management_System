'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';
import {
  BookOpen,
  CheckCircle,
  XCircle,
  Save,
  Send,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react';
import { UserRole } from '@ems/shared';

export default function MarksRegistryPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const role = user?.role;

  const isLecturer = role === UserRole.LECTURER;
  const isStaffOrAdmin = role === UserRole.EXAM_DIVISION_STAFF || role === UserRole.ADMINISTRATOR;

  // Lecturer View States
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [marksDraft, setMarksDraft] = useState<{ [studentId: number]: string }>({});

  // Review View States (Staff)
  const [reviewExamId, setReviewExamId] = useState<number | null>(null);
  const [reviewExamDetails, setReviewExamDetails] = useState<any>(null);

  // Notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ==========================================
  // LECTURER DATA QUERIES
  // ==========================================

  // 1. Fetch lecturer courses
  const { data: myCourses = [], isLoading: isCoursesLoading } = useQuery({
    queryKey: ['my-courses'],
    queryFn: async () => {
      const response = await apiClient.get('/marks/my-courses');
      return response.data?.data || [];
    },
    enabled: isLecturer,
  });

  // 2. Fetch exams for selected course
  const { data: courseExams = [], isLoading: isExamsLoading } = useQuery({
    queryKey: ['course-exams', selectedCourseId],
    queryFn: async () => {
      const response = await apiClient.get(`/marks/courses/${selectedCourseId}/exams`);
      return response.data?.data || [];
    },
    enabled: isLecturer && !!selectedCourseId,
  });

  // 3. Fetch registered students for selected course
  const { data: courseStudents = [], isLoading: isStudentsLoading } = useQuery({
    queryKey: ['course-students', selectedCourseId],
    queryFn: async () => {
      const response = await apiClient.get(`/marks/courses/${selectedCourseId}/students`);
      return response.data?.data || [];
    },
    enabled: isLecturer && !!selectedCourseId,
  });

  // 4. Fetch existing marks for selected exam
  const {
    data: examMarks = [],
    isLoading: isMarksLoading,
    refetch: refetchExamMarks,
  } = useQuery({
    queryKey: ['exam-marks', selectedExamId],
    queryFn: async () => {
      const response = await apiClient.get(`/marks/exams/${selectedExamId}`);
      return response.data?.data || [];
    },
    enabled: isLecturer && !!selectedExamId,
  });

  // Populate marks draft from DB
  useEffect(() => {
    if (selectedExamId && examMarks.length > 0) {
      const draft: { [studentId: number]: string } = {};
      examMarks.forEach((m: any) => {
        draft[m.student_id] = m.marks_obtained.toString();
      });
      setMarksDraft(draft);
    } else {
      setMarksDraft({});
    }
  }, [selectedExamId, examMarks]);

  // ==========================================
  // STAFF DATA QUERIES
  // ==========================================

  // 1. Fetch pending approvals list
  const {
    data: pendingApprovals = [],
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: async () => {
      const response = await apiClient.get('/marks/pending-approvals');
      return response.data?.data || [];
    },
    enabled: isStaffOrAdmin,
  });

  // 2. Fetch marksheet for review
  const { data: reviewMarks = [], isLoading: isReviewMarksLoading } = useQuery({
    queryKey: ['review-marks', reviewExamId],
    queryFn: async () => {
      const response = await apiClient.get(`/marks/exams/${reviewExamId}`);
      return response.data?.data || [];
    },
    enabled: isStaffOrAdmin && !!reviewExamId,
  });

  // ==========================================
  // MUTATIONS (RECORD, SUBMIT, APPROVE, REJECT)
  // ==========================================

  // Save marks mutation
  const saveMarksMutation = useMutation({
    mutationFn: async (payload: { studentId: number; marksObtained: number }[]) => {
      await apiClient.post(`/marks/exams/${selectedExamId}/bulk`, { marks: payload });
    },
    onSuccess: () => {
      setSuccessMsg('Marks saved successfully as draft.');
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['exam-marks', selectedExamId] });
      refetchExamMarks();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to save marks.');
      setSuccessMsg(null);
    },
  });

  // Submit marks mutation
  const submitMarksMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/marks/exams/${selectedExamId}/submit`);
    },
    onSuccess: () => {
      setSuccessMsg('Marksheet locked and submitted for approval.');
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['exam-marks', selectedExamId] });
      refetchExamMarks();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to submit marks.');
      setSuccessMsg(null);
    },
  });

  // Approve mutation (Staff)
  const approveMutation = useMutation({
    mutationFn: async (examId: number) => {
      await apiClient.post(`/marks/exams/${examId}/approve`);
    },
    onSuccess: () => {
      setSuccessMsg('Marks approved and final grades compiled successfully!');
      setErrorMsg(null);
      setReviewExamId(null);
      setReviewExamDetails(null);
      refetchPending();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to approve marksheet.');
      setSuccessMsg(null);
    },
  });

  // Reject mutation (Staff)
  const rejectMutation = useMutation({
    mutationFn: async (examId: number) => {
      await apiClient.post(`/marks/exams/${examId}/reject`);
    },
    onSuccess: () => {
      setSuccessMsg('Marksheet returned to pending draft for edits.');
      setErrorMsg(null);
      setReviewExamId(null);
      setReviewExamDetails(null);
      refetchPending();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to return marksheet.');
      setSuccessMsg(null);
    },
  });

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleMarkChange = (studentId: number, val: string) => {
    setMarksDraft((prev) => ({
      ...prev,
      [studentId]: val,
    }));
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload: { studentId: number; marksObtained: number }[] = [];
    const activeExam = courseExams.find((x: any) => x.exam_id.toString() === selectedExamId);

    if (!activeExam) return;

    for (const student of courseStudents) {
      const rawVal = marksDraft[student.student_id];
      if (rawVal !== undefined && rawVal !== '') {
        const val = parseFloat(rawVal);
        if (isNaN(val) || val < 0) {
          setErrorMsg(`Invalid score for student: ${student.registration_number}`);
          return;
        }
        if (val > activeExam.total_marks) {
          setErrorMsg(
            `Score for student ${student.registration_number} (${val}) exceeds exam max marks (${activeExam.total_marks})`,
          );
          return;
        }
        payload.push({
          studentId: student.student_id,
          marksObtained: val,
        });
      }
    }

    if (payload.length === 0) {
      setErrorMsg('No grades recorded to save.');
      return;
    }

    saveMarksMutation.mutate(payload);
  };

  const handleSubmitMarks = () => {
    if (confirm('Once submitted, grades are locked and sent for review. Proceed?')) {
      submitMarksMutation.mutate();
    }
  };

  const handleSelectReview = (exam: any) => {
    setReviewExamId(exam.exam_id);
    setReviewExamDetails(exam);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Status Check helpers
  const getMarksheetStatus = () => {
    if (examMarks.length === 0) return 'PENDING';
    return examMarks[0].grading_status;
  };

  const isSheetLocked = () => {
    const status = getMarksheetStatus();
    return status === 'SUBMITTED' || status === 'APPROVED';
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Marks Registry</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {isLecturer
            ? 'Record student evaluation grades, submit marksheets for verification, and update draft scores'
            : 'Review academic marksheets, approve compiled evaluations, and publish final student grades'}
        </p>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-2xl font-medium flex gap-2 items-center animate-fadeIn">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-2xl font-medium flex gap-2 items-center animate-fadeIn">
          <CheckCircle className="h-4.5 w-4.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LECTURER GRADE ENTRY SCREEN */}
      {/* ========================================================================= */}
      {isLecturer && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Selectors Panel */}
          <div className="bg-card/25 border border-border/80 p-5 rounded-3xl backdrop-blur-md space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="h-4.5 w-4.5 text-primary" />
              Class Registry
            </h3>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Select Course
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value);
                  setSelectedExamId('');
                }}
                disabled={isCoursesLoading}
                className="w-full px-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground disabled:opacity-50"
              >
                <option value="">Choose course...</option>
                {myCourses.map((c: any) => (
                  <option key={c.course_id} value={c.course_id} className="bg-card">
                    {c.course_code} - {c.course_name}
                  </option>
                ))}
              </select>
            </div>

            {selectedCourseId && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Select Exam / Assessment
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  disabled={isExamsLoading}
                  className="w-full px-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground disabled:opacity-50"
                >
                  <option value="">Choose exam...</option>
                  {courseExams.map((x: any) => (
                    <option key={x.exam_id} value={x.exam_id} className="bg-card">
                      {x.exam_title} ({x.exam_type} - Max {x.total_marks})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Grid Grade Editor */}
          <div className="lg:col-span-3">
            {!selectedExamId ? (
              <div className="p-20 text-center bg-card/10 border border-border/60 rounded-3xl flex flex-col items-center justify-center">
                <BookOpen className="h-10 w-10 text-muted-foreground/45 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">
                  No assessment selected
                </p>
                <p className="text-xs text-muted-foreground/75 mt-1 max-w-sm">
                  Please choose an assigned class and choose the specific exam or test component to
                  record student grades.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header Status Bar */}
                <div className="p-4 bg-secondary/15 border border-border/60 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground">SHEET STATUS:</span>
                    <span
                      className={`px-3 py-1 text-xs font-bold rounded-full ${
                        getMarksheetStatus() === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : getMarksheetStatus() === 'SUBMITTED'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {getMarksheetStatus()}
                    </span>
                  </div>

                  {!isSheetLocked() && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveDraft}
                        disabled={saveMarksMutation.isPending}
                        className="px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition text-xs flex items-center gap-1.5"
                      >
                        <Save className="h-3.5 w-3.5" />
                        Save Draft
                      </button>
                      <button
                        onClick={handleSubmitMarks}
                        disabled={submitMarksMutation.isPending}
                        className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Submit Sheet
                      </button>
                    </div>
                  )}
                </div>

                {/* Grade Entry Table */}
                <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                        <th className="px-6 py-4">Reg Number</th>
                        <th className="px-6 py-4">Student Name</th>
                        <th className="px-6 py-4 w-36">Score Obtained</th>
                        <th className="px-6 py-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-sm font-medium">
                      {isStudentsLoading || isMarksLoading ? (
                        <tr>
                          <td colSpan={4} className="text-center py-20 text-muted-foreground">
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                              Loading student list...
                            </span>
                          </td>
                        </tr>
                      ) : courseStudents.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-20 text-muted-foreground">
                            No students registered for this course yet.
                          </td>
                        </tr>
                      ) : (
                        courseStudents.map((student: any) => {
                          const val = marksDraft[student.student_id] || '';
                          const isApproved = getMarksheetStatus() === 'APPROVED';
                          const isSubmitted = getMarksheetStatus() === 'SUBMITTED';

                          return (
                            <tr
                              key={student.student_id}
                              className="hover:bg-secondary/15 transition-colors"
                            >
                              <td className="px-6 py-3 font-semibold text-foreground">
                                {student.registration_number}
                              </td>
                              <td className="px-6 py-3 text-muted-foreground">
                                {student.user?.full_name}
                              </td>
                              <td className="px-6 py-3">
                                <input
                                  type="number"
                                  step="0.5"
                                  placeholder="0.0"
                                  value={val}
                                  onChange={(e) =>
                                    handleMarkChange(student.student_id, e.target.value)
                                  }
                                  disabled={isSheetLocked()}
                                  className="w-full px-3 py-1.5 bg-secondary/30 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
                                />
                              </td>
                              <td className="px-6 py-3 text-center">
                                <span
                                  className={`text-xs ${isApproved ? 'text-emerald-400' : isSubmitted ? 'text-blue-400' : 'text-amber-400'}`}
                                >
                                  {isApproved
                                    ? 'Approved'
                                    : isSubmitted
                                      ? 'Submitted'
                                      : val !== ''
                                        ? 'Draft Saved'
                                        : 'No Entry'}
                                </span>
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
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXAM DIVISION STAFF REVIEW & APPROVALS */}
      {/* ========================================================================= */}
      {isStaffOrAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Review List Queue */}
          <div className="bg-card/25 border border-border/80 p-5 rounded-3xl backdrop-blur-md space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-primary" />
              Approvals Queue
            </h3>

            {isPendingLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : pendingApprovals.length === 0 ? (
              <div className="text-center py-8 bg-secondary/10 rounded-2xl text-xs text-muted-foreground">
                All submitted marksheets have been approved. Clear!
              </div>
            ) : (
              <div className="space-y-2">
                {pendingApprovals.map((exam: any) => (
                  <div
                    key={exam.exam_id}
                    onClick={() => handleSelectReview(exam)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer select-none text-left ${
                      reviewExamId === exam.exam_id
                        ? 'bg-primary/10 border-primary shadow-lg'
                        : 'bg-card/30 border-border/60 hover:bg-card/50 hover:border-border'
                    }`}
                  >
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md uppercase">
                      {exam.course?.course_code}
                    </span>
                    <h4 className="text-xs font-bold text-foreground truncate mt-2">
                      {exam.exam_title}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-normal">
                      Type: <strong>{exam.exam_type}</strong> | Max:{' '}
                      <strong>{exam.total_marks}</strong>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sheet Review Grid */}
          <div className="lg:col-span-3">
            {!reviewExamId ? (
              <div className="p-20 text-center bg-card/10 border border-border/60 rounded-3xl flex flex-col items-center justify-center">
                <ShieldCheck className="h-10 w-10 text-muted-foreground/45 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">
                  No sheet chosen for review
                </p>
                <p className="text-xs text-muted-foreground/75 mt-1 max-w-sm">
                  Select a submitted course marksheet from the pending queue on the left to verify
                  marks and approve grades.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header Action controls */}
                <div className="p-4 bg-secondary/15 border border-border/60 rounded-2xl flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Reviewing: {reviewExamDetails?.course?.course_name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Exam: <strong>{reviewExamDetails?.exam_title}</strong> (
                      {reviewExamDetails?.exam_type} - Max {reviewExamDetails?.total_marks})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => rejectMutation.mutate(reviewExamId)}
                      disabled={rejectMutation.isPending}
                      className="px-4 py-2 bg-destructive/10 text-destructive border border-destructive/20 font-semibold rounded-xl hover:bg-destructive/20 transition text-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject Sheet
                    </button>
                    <button
                      onClick={() => approveMutation.mutate(reviewExamId)}
                      disabled={approveMutation.isPending}
                      className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold rounded-xl hover:bg-emerald-500/20 transition text-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Approve & Compile
                    </button>
                  </div>
                </div>

                {/* Marksheet Entry reviews */}
                <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                        <th className="px-6 py-4">Reg Number</th>
                        <th className="px-6 py-4">Student Name</th>
                        <th className="px-6 py-4 text-center">Score Obtained</th>
                        <th className="px-6 py-4 text-right">Percentage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-sm font-medium">
                      {isReviewMarksLoading ? (
                        <tr>
                          <td colSpan={4} className="text-center py-20 text-muted-foreground">
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                              Loading marksheet data...
                            </span>
                          </td>
                        </tr>
                      ) : reviewMarks.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-20 text-muted-foreground">
                            No recorded marks entries found in this marksheet.
                          </td>
                        </tr>
                      ) : (
                        reviewMarks.map((entry: any) => {
                          const pct = (entry.marks_obtained / reviewExamDetails.total_marks) * 100;
                          return (
                            <tr
                              key={entry.mark_id}
                              className="hover:bg-secondary/15 transition-colors"
                            >
                              <td className="px-6 py-3.5 font-semibold text-foreground">
                                {entry.student?.registration_number}
                              </td>
                              <td className="px-6 py-3.5 text-muted-foreground">
                                {entry.student?.user?.full_name}
                              </td>
                              <td className="px-6 py-3.5 text-center font-mono font-bold text-foreground">
                                {entry.marks_obtained} / {reviewExamDetails.total_marks}
                              </td>
                              <td className="px-6 py-3.5 text-right font-mono text-xs text-primary font-bold">
                                {pct.toFixed(1)}%
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
          </div>
        </div>
      )}
    </div>
  );
}
