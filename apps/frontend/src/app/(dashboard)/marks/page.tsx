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
  Search,
  FileSpreadsheet,
  Edit3,
} from 'lucide-react';
import { UserRole } from '@ems/shared';

const STABLE_EMPTY_ARRAY: any[] = [];

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

  // Staff Upgraded View States
  const [activeTab, setActiveTab] = useState<'review' | 'approved' | 'combined'>('review');
  const [approvedSearch, setApprovedSearch] = useState<string>('');
  const [selectedApprovedExamId, setSelectedApprovedExamId] = useState<number | null>(null);
  const [selectedApprovedExamDetails, setSelectedApprovedExamDetails] = useState<any>(null);
  const [isApprovedEditMode, setIsApprovedEditMode] = useState<boolean>(false);
  const [approvedMarksDraft, setApprovedMarksDraft] = useState<{ [studentId: number]: string }>({});
  const [combinedCourseId, setCombinedCourseId] = useState<string>('');
  const [showPublishConfirm, setShowPublishConfirm] = useState<boolean>(false);

  // ==========================================
  // LECTURER DATA QUERIES
  // ==========================================

  // 1. Fetch lecturer courses
  const { data: myCoursesData = [], isLoading: isCoursesLoading } = useQuery({
    queryKey: ['my-courses'],
    queryFn: async () => {
      const response = await apiClient.get('/marks/my-courses');
      return response.data?.data || [];
    },
    enabled: isLecturer,
  });
  const myCourses = Array.isArray(myCoursesData) ? myCoursesData : STABLE_EMPTY_ARRAY;

  // 2. Fetch exams for selected course
  const { data: courseExamsData = [], isLoading: isExamsLoading } = useQuery({
    queryKey: ['course-exams', selectedCourseId],
    queryFn: async () => {
      const response = await apiClient.get(`/marks/courses/${selectedCourseId}/exams`);
      return response.data?.data || [];
    },
    enabled: isLecturer && !!selectedCourseId,
  });
  const courseExams = Array.isArray(courseExamsData) ? courseExamsData : STABLE_EMPTY_ARRAY;

  // 3. Fetch registered students for selected course
  const { data: courseStudentsData = [], isLoading: isStudentsLoading } = useQuery({
    queryKey: ['course-students', selectedCourseId],
    queryFn: async () => {
      const response = await apiClient.get(`/marks/courses/${selectedCourseId}/students`);
      return response.data?.data || [];
    },
    enabled: isLecturer && !!selectedCourseId,
  });
  const courseStudents = Array.isArray(courseStudentsData)
    ? courseStudentsData
    : STABLE_EMPTY_ARRAY;

  // 4. Fetch existing marks for selected exam
  const {
    data: examMarksData = [],
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
  const examMarks = Array.isArray(examMarksData) ? examMarksData : STABLE_EMPTY_ARRAY;

  // Populate marks draft from DB
  useEffect(() => {
    if (selectedExamId && Array.isArray(examMarks) && examMarks.length > 0) {
      const draft: { [studentId: number]: string } = {};
      examMarks.forEach((m: any) => {
        if (m && m.student_id !== undefined && m.marks_obtained !== undefined) {
          draft[m.student_id] = m.marks_obtained.toString();
        }
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
    data: pendingApprovalsData = [],
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
  const pendingApprovals = Array.isArray(pendingApprovalsData)
    ? pendingApprovalsData
    : STABLE_EMPTY_ARRAY;

  // 2. Fetch marksheet for review
  const { data: reviewMarksData = [], isLoading: isReviewMarksLoading } = useQuery({
    queryKey: ['review-marks', reviewExamId],
    queryFn: async () => {
      const response = await apiClient.get(`/marks/exams/${reviewExamId}`);
      return response.data?.data || [];
    },
    enabled: isStaffOrAdmin && !!reviewExamId,
  });
  const reviewMarks = Array.isArray(reviewMarksData) ? reviewMarksData : STABLE_EMPTY_ARRAY;

  // 3. Fetch approved marksheets list (for directory)
  const { data: approvedSheetsData = [], isLoading: isApprovedLoading } = useQuery({
    queryKey: ['approved-marksheets'],
    queryFn: async () => {
      const response = await apiClient.get('/marks/approved-marksheets');
      return response.data?.data || [];
    },
    enabled: isStaffOrAdmin,
  });
  const approvedSheets = Array.isArray(approvedSheetsData)
    ? approvedSheetsData
    : STABLE_EMPTY_ARRAY;

  // 4. Fetch marksheet marks for approved sheet select
  const {
    data: approvedMarksData = [],
    isLoading: isApprovedMarksLoading,
    refetch: refetchApprovedMarks,
  } = useQuery({
    queryKey: ['approved-exam-marks', selectedApprovedExamId],
    queryFn: async () => {
      const response = await apiClient.get(`/marks/exams/${selectedApprovedExamId}`);
      return response.data?.data || [];
    },
    enabled: isStaffOrAdmin && !!selectedApprovedExamId,
  });
  const approvedMarks = Array.isArray(approvedMarksData) ? approvedMarksData : STABLE_EMPTY_ARRAY;

  // 5. Fetch all courses list (for combined evaluation dropdown)
  const { data: coursesLookupData = [], isLoading: isCoursesLookupLoading } = useQuery({
    queryKey: ['courses-lookup'],
    queryFn: async () => {
      const response = await apiClient.get('/reports/courses');
      return response.data?.data || [];
    },
    enabled: isStaffOrAdmin,
  });
  const coursesLookup = Array.isArray(coursesLookupData) ? coursesLookupData : STABLE_EMPTY_ARRAY;

  // 6. Fetch combined course results
  const { data: combinedResults, isLoading: isCombinedLoading } = useQuery({
    queryKey: ['combined-results', combinedCourseId],
    queryFn: async () => {
      const response = await apiClient.get(`/results/course/${combinedCourseId}/combined`);
      return response.data?.data;
    },
    enabled: isStaffOrAdmin && !!combinedCourseId,
  });

  // Sync approved marks draft when database marks load/change
  useEffect(() => {
    if (selectedApprovedExamId && Array.isArray(approvedMarks) && approvedMarks.length > 0) {
      const draft: { [studentId: number]: string } = {};
      approvedMarks.forEach((m: any) => {
        if (m && m.student_id !== undefined && m.marks_obtained !== undefined) {
          draft[m.student_id] = m.marks_obtained.toString();
        }
      });
      setApprovedMarksDraft(draft);
    } else {
      setApprovedMarksDraft({});
    }
  }, [selectedApprovedExamId, approvedMarks]);

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

  // Save approved marks mutation (Staff/Admin edit)
  const saveApprovedMarksMutation = useMutation({
    mutationFn: async (payload: { studentId: number; marksObtained: number }[]) => {
      await apiClient.post(`/marks/exams/${selectedApprovedExamId}/bulk`, { marks: payload });
    },
    onSuccess: () => {
      setSuccessMsg('Approved marksheet updated successfully and course grades recompiled.');
      setErrorMsg(null);
      setIsApprovedEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['approved-exam-marks', selectedApprovedExamId] });
      refetchApprovedMarks();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to update approved marks.');
      setSuccessMsg(null);
    },
  });

  // Publish results mutation (Staff/Admin)
  const publishResultsMutation = useMutation({
    mutationFn: async (payload: { academicYear: number; semester: string }) => {
      await apiClient.post('/results/publish', payload);
    },
    onSuccess: () => {
      setSuccessMsg('Semester results compiled and published successfully.');
      setErrorMsg(null);
      setShowPublishConfirm(false);
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to publish results.');
      setSuccessMsg(null);
      setShowPublishConfirm(false);
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

  const handleApprovedMarkChange = (studentId: number, val: string) => {
    setApprovedMarksDraft((prev) => ({
      ...prev,
      [studentId]: val,
    }));
  };

  const handleSaveApprovedChanges = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload: { studentId: number; marksObtained: number }[] = [];
    if (!selectedApprovedExamDetails) return;

    for (const entry of approvedMarks) {
      const studentId = entry.student_id;
      const rawVal = approvedMarksDraft[studentId];
      if (rawVal !== undefined && rawVal !== '') {
        const val = parseFloat(rawVal);
        if (isNaN(val) || val < 0) {
          setErrorMsg(`Invalid score for student: ${entry.student?.registration_number}`);
          return;
        }
        if (val > selectedApprovedExamDetails.total_marks) {
          setErrorMsg(
            `Score for student ${entry.student?.registration_number} (${val}) exceeds exam max marks (${selectedApprovedExamDetails.total_marks})`,
          );
          return;
        }
        payload.push({
          studentId,
          marksObtained: val,
        });
      }
    }

    if (payload.length === 0) {
      setErrorMsg('No grades to update.');
      return;
    }

    saveApprovedMarksMutation.mutate(payload);
  };

  const handleSelectApproved = (exam: any) => {
    setSelectedApprovedExamId(exam.exam_id);
    setSelectedApprovedExamDetails(exam);
    setIsApprovedEditMode(false);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleDownloadCombinedExcel = async (courseId: number, courseCode: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await apiClient.get(`/results/course/${courseId}/combined/excel`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Combined_Evaluation_${courseCode}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      setSuccessMsg('Combined evaluation sheet downloaded successfully!');
    } catch (err) {
      setErrorMsg('Failed to download combined evaluation sheet.');
    }
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
        <div className="space-y-6">
          {/* Tabs Navigation */}
          <div className="flex border-b border-border/60 gap-4 mb-4">
            <button
              onClick={() => {
                setActiveTab('review');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === 'review'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Review Queue
            </button>
            <button
              onClick={() => {
                setActiveTab('approved');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === 'approved'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Approved Directory
            </button>
            <button
              onClick={() => {
                setActiveTab('combined');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === 'combined'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Combined Evaluation
            </button>
          </div>

          {/* TAB 1: REVIEW QUEUE */}
          {activeTab === 'review' && (
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
                      Select a submitted course marksheet from the pending queue on the left to
                      verify marks and approve grades.
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
                              const pct =
                                (entry.marks_obtained / reviewExamDetails.total_marks) * 100;
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

          {/* TAB 2: APPROVED DIRECTORY */}
          {activeTab === 'approved' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
              {/* Directory Sidebar */}
              <div className="bg-card/25 border border-border/80 p-5 rounded-3xl backdrop-blur-md space-y-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <CheckCircle className="h-4.5 w-4.5 text-primary" />
                  Approved Directory
                </h3>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search approved sheets..."
                    value={approvedSearch}
                    onChange={(e) => setApprovedSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-secondary/30 border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                </div>

                {isApprovedLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : approvedSheets.length === 0 ? (
                  <div className="text-center py-8 bg-secondary/10 rounded-2xl text-xs text-muted-foreground">
                    No approved marksheets found.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                    {approvedSheets
                      .filter((sheet: any) => {
                        const search = approvedSearch.toLowerCase();
                        return (
                          sheet.course?.course_code?.toLowerCase()?.includes(search) ||
                          sheet.course?.course_name?.toLowerCase()?.includes(search) ||
                          sheet.exam_title?.toLowerCase()?.includes(search)
                        );
                      })
                      .map((sheet: any) => (
                        <div
                          key={sheet.exam_id}
                          onClick={() => handleSelectApproved(sheet)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer select-none text-left ${
                            selectedApprovedExamId === sheet.exam_id
                              ? 'bg-primary/10 border-primary shadow-lg'
                              : 'bg-card/30 border-border/60 hover:bg-card/50 hover:border-border'
                          }`}
                        >
                          <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md uppercase">
                            {sheet.course?.course_code}
                          </span>
                          <h4 className="text-xs font-bold text-foreground truncate mt-2">
                            {sheet.exam_title}
                          </h4>
                          <p className="text-[10px] text-muted-foreground mt-1 leading-normal">
                            Semester: <strong>{sheet.course?.semester}</strong> | Year:{' '}
                            <strong>{sheet.course?.academic_year}</strong>
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Sheet Details & Marks Edit */}
              <div className="lg:col-span-3">
                {!selectedApprovedExamId ? (
                  <div className="p-20 text-center bg-card/10 border border-border/60 rounded-3xl flex flex-col items-center justify-center">
                    <CheckCircle className="h-10 w-10 text-muted-foreground/45 mb-3" />
                    <p className="text-sm font-semibold text-muted-foreground">
                      No approved sheet selected
                    </p>
                    <p className="text-xs text-muted-foreground/75 mt-1 max-w-sm">
                      Select an approved course marksheet from the directory list on the left to
                      view grades, edit marks, or publish semester results.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Header Action controls */}
                    <div className="p-5 bg-secondary/15 border border-border/60 rounded-2xl flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md uppercase">
                          APPROVED
                        </span>
                        <h3 className="text-lg font-bold text-foreground mt-2">
                          {selectedApprovedExamDetails?.course?.course_name} (
                          {selectedApprovedExamDetails?.course?.course_code})
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          Exam: <strong>{selectedApprovedExamDetails?.exam_title}</strong> (
                          {selectedApprovedExamDetails?.exam_type} - Max{' '}
                          {selectedApprovedExamDetails?.total_marks})
                          <br />
                          Lecturer(s):{' '}
                          <strong>
                            {selectedApprovedExamDetails?.course?.lecturers
                              ?.map((l: any) => l.lecturer?.user?.full_name)
                              .join(', ') || 'Unassigned'}
                          </strong>
                          <br />
                          Semester: <strong>
                            {selectedApprovedExamDetails?.course?.semester}
                          </strong>{' '}
                          | Year:{' '}
                          <strong>{selectedApprovedExamDetails?.course?.academic_year}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {isApprovedEditMode ? (
                          <>
                            <button
                              onClick={() => setIsApprovedEditMode(false)}
                              className="px-4 py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition text-xs"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveApprovedChanges}
                              disabled={saveApprovedMarksMutation.isPending}
                              className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {saveApprovedMarksMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="h-3.5 w-3.5" />
                              )}
                              Save Changes
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setIsApprovedEditMode(true)}
                              className="px-4 py-2.5 bg-secondary border border-border text-foreground font-semibold rounded-xl hover:bg-secondary/90 transition text-xs flex items-center gap-1.5"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Edit Marksheet
                            </button>
                            <button
                              onClick={() => setShowPublishConfirm(true)}
                              className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-1.5"
                            >
                              <Send className="h-3.5 w-3.5" />
                              Publish Results
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Marksheet Entry table */}
                    <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                            <th className="px-6 py-4">Reg Number</th>
                            <th className="px-6 py-4">Index Number</th>
                            <th className="px-6 py-4">Student Name</th>
                            <th className="px-6 py-4 w-40 text-center">Score Obtained</th>
                            <th className="px-6 py-4 text-right">Percentage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 text-sm font-medium">
                          {isApprovedMarksLoading ? (
                            <tr>
                              <td colSpan={5} className="text-center py-20 text-muted-foreground">
                                <span className="inline-flex items-center gap-2">
                                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                  Loading marks data...
                                </span>
                              </td>
                            </tr>
                          ) : approvedMarks.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-20 text-muted-foreground">
                                No student marks recorded for this sheet.
                              </td>
                            </tr>
                          ) : (
                            approvedMarks.map((entry: any) => {
                              const studentId = entry.student_id;
                              const val = approvedMarksDraft[studentId] || '';
                              const pct =
                                (entry.marks_obtained / selectedApprovedExamDetails.total_marks) *
                                100;

                              return (
                                <tr
                                  key={entry.mark_id}
                                  className="hover:bg-secondary/15 transition-colors"
                                >
                                  <td className="px-6 py-3 font-semibold text-foreground">
                                    {entry.student?.registration_number}
                                  </td>
                                  <td className="px-6 py-3 text-muted-foreground font-mono text-xs">
                                    {`IDX-${studentId}`}
                                  </td>
                                  <td className="px-6 py-3 text-muted-foreground">
                                    {entry.student?.user?.full_name}
                                  </td>
                                  <td className="px-6 py-3 text-center">
                                    {isApprovedEditMode ? (
                                      <input
                                        type="number"
                                        step="0.5"
                                        placeholder="0.0"
                                        value={val}
                                        onChange={(e) =>
                                          handleApprovedMarkChange(studentId, e.target.value)
                                        }
                                        className="w-28 mx-auto px-3 py-1.5 bg-secondary/30 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-center"
                                      />
                                    ) : (
                                      <span className="font-mono font-bold text-foreground">
                                        {entry.marks_obtained} /{' '}
                                        {selectedApprovedExamDetails.total_marks}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-6 py-3 text-right font-mono text-xs text-primary font-bold">
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

          {/* TAB 3: COMBINED EVALUATION */}
          {activeTab === 'combined' && (
            <div className="space-y-6">
              {/* Selector Toolbar */}
              <div className="p-6 bg-card/25 border border-border/80 rounded-3xl backdrop-blur-md flex flex-wrap gap-4 items-center justify-between shadow-xl">
                <div className="flex items-center gap-4 flex-1 max-w-md">
                  <div className="w-full">
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Select Course for Combined Summary
                    </label>
                    <select
                      value={combinedCourseId}
                      onChange={(e) => {
                        setCombinedCourseId(e.target.value);
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      disabled={isCoursesLookupLoading}
                      className="w-full px-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground disabled:opacity-50"
                    >
                      <option value="">Choose a course...</option>
                      {coursesLookup.map((c: any) => (
                        <option key={c.course_id} value={c.course_id} className="bg-card">
                          {c.course_code} - {c.course_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {combinedCourseId && combinedResults && (
                  <button
                    onClick={() =>
                      handleDownloadCombinedExcel(
                        combinedResults.course.courseId,
                        combinedResults.course.courseCode,
                      )
                    }
                    className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-emerald-600 text-white rounded-xl shadow-lg hover:bg-emerald-500 transition-colors"
                  >
                    <FileSpreadsheet className="h-4.5 w-4.5" />
                    Download Combined Excel
                  </button>
                )}
              </div>

              {/* Combined Results Display */}
              {!combinedCourseId ? (
                <div className="p-20 text-center bg-card/10 border border-border/60 rounded-3xl flex flex-col items-center justify-center">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground/45 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground">No course selected</p>
                  <p className="text-xs text-muted-foreground/75 mt-1 max-w-sm">
                    Choose a course from the dropdown menu to inspect its full combined student
                    assessment report (CA, Mid, Finals, overall grades).
                  </p>
                </div>
              ) : isCombinedLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-card/10 border border-border/60 rounded-3xl">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Loading combined evaluation report...
                  </p>
                </div>
              ) : !combinedResults ? (
                <div className="p-20 text-center bg-card/10 border border-border/60 rounded-3xl">
                  Failed to load report.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Course Details Alert */}
                  <div className="p-5 bg-secondary/15 border border-border/60 rounded-2xl">
                    <h3 className="text-sm font-bold text-foreground">
                      {combinedResults?.course?.courseName} ({combinedResults?.course?.courseCode})
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-normal">
                      Lecturer(s): <strong>{combinedResults?.course?.lecturers}</strong>
                      <br />
                      Department: <strong>{combinedResults?.course?.departmentName}</strong>
                      <br />
                      Credits: <strong>{combinedResults?.course?.creditValue}</strong> | Semester:{' '}
                      <strong>{combinedResults?.course?.semester}</strong> | Academic Year:{' '}
                      <strong>{combinedResults?.course?.academicYear}</strong>
                    </p>
                  </div>

                  {/* Combined Marks Table */}
                  <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-border/80 font-bold text-muted-foreground uppercase bg-secondary/15">
                            <th className="px-4 py-3.5">Registration No</th>
                            <th className="px-4 py-3.5">Index Number</th>
                            <th className="px-4 py-3.5">Student Name</th>
                            {/* Dynamic Exams headers */}
                            {(combinedResults?.exams || []).map((ex: any) => (
                              <th key={ex.examId} className="px-4 py-3.5 text-center">
                                {ex.examTitle}
                                <span className="block text-[9px] text-muted-foreground font-normal">
                                  ({ex.examType} - Max {ex.totalMarks})
                                </span>
                              </th>
                            ))}
                            <th className="px-4 py-3.5 text-center bg-secondary/10">CA Total</th>
                            <th className="px-4 py-3.5 text-center bg-secondary/10">Final Total</th>
                            <th className="px-4 py-3.5 text-center bg-primary/10 text-primary">
                              Overall %
                            </th>
                            <th className="px-4 py-3.5 text-center bg-primary/10 text-primary">
                              Grade
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 text-sm font-medium">
                          {!combinedResults?.students || combinedResults.students.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6 + (combinedResults?.exams || []).length}
                                className="text-center py-10 text-muted-foreground"
                              >
                                No registered students found.
                              </td>
                            </tr>
                          ) : (
                            combinedResults.students.map((student: any) => (
                              <tr
                                key={student.studentId}
                                className="hover:bg-secondary/15 transition-colors"
                              >
                                <td className="px-4 py-3 font-semibold text-foreground text-xs">
                                  {student.registrationNumber}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                                  {`IDX-${student.studentId}`}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[150px]">
                                  {student.fullName}
                                </td>
                                {/* Dyn exam scores */}
                                {(combinedResults?.exams || []).map((ex: any) => {
                                  const score = student.marks?.[ex.examId];
                                  return (
                                    <td
                                      key={ex.examId}
                                      className="px-4 py-3 text-center font-mono text-xs"
                                    >
                                      {score !== undefined ? score : '-'}
                                    </td>
                                  );
                                })}
                                <td className="px-4 py-3 text-center font-mono text-xs bg-secondary/5 font-bold">
                                  {student.caTotal?.toFixed(1)}
                                </td>
                                <td className="px-4 py-3 text-center font-mono text-xs bg-secondary/5 font-bold">
                                  {student.finalTotal?.toFixed(1)}
                                </td>
                                <td className="px-4 py-3 text-center font-mono text-xs bg-primary/5 text-primary font-extrabold">
                                  {student.totalPercentage?.toFixed(1)}%
                                </td>
                                <td className="px-4 py-3 text-center bg-primary/5">
                                  <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded font-extrabold text-xs">
                                    {student.grade}
                                  </span>
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
            </div>
          )}

          {/* PUBLISH RESULTS CONFIRMATION MODAL */}
          {showPublishConfirm && selectedApprovedExamDetails && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
              <div className="bg-card border border-border/80 p-6 rounded-3xl max-w-md w-full space-y-6 shadow-2xl">
                <div className="space-y-2 text-center">
                  <div className="mx-auto w-12 h-12 bg-primary/10 text-primary border border-primary/20 rounded-full flex items-center justify-center mb-3">
                    <Send className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Confirm Results Publication</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This action compiles overall GPAs and publishes report cards for{' '}
                    <strong>all students</strong> registered under Academic Year{' '}
                    <strong>{selectedApprovedExamDetails?.course?.academic_year}</strong> and
                    Semester <strong>{selectedApprovedExamDetails?.course?.semester}</strong>.
                  </p>
                </div>

                <div className="p-4 bg-secondary/35 rounded-2xl text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-semibold">Course Code:</span>
                    <span className="font-bold text-foreground">
                      {selectedApprovedExamDetails?.course?.course_code}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-semibold">Semester:</span>
                    <span className="font-bold text-foreground">
                      {selectedApprovedExamDetails?.course?.semester}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-semibold">Academic Year:</span>
                    <span className="font-bold text-foreground">
                      {selectedApprovedExamDetails?.course?.academic_year}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPublishConfirm(false)}
                    className="flex-1 py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      publishResultsMutation.mutate({
                        academicYear: selectedApprovedExamDetails?.course?.academic_year,
                        semester: selectedApprovedExamDetails?.course?.semester,
                      })
                    }
                    disabled={publishResultsMutation.isPending}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {publishResultsMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5" />
                    )}
                    Compile & Publish
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
