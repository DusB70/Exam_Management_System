'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';
import {
  CheckCircle,
  XCircle,
  Save,
  Send,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  ClipboardList,
  FileSpreadsheet,
  Edit3,
  Upload,
  Plus,
  Trash2,
  Settings,
  Percent,
  Check,
  RotateCcw,
  Award,
  X,
} from 'lucide-react';
import { UserRole } from '@ems/shared';

const STABLE_EMPTY_ARRAY: any[] = [];

export default function MarksRegistryPage() {
  const { user } = useAuthStore();
  const role = user?.role;

  const isLecturer = role === UserRole.LECTURER;
  const isStaffOrAdmin = role === UserRole.EXAM_DIVISION_STAFF || role === UserRole.ADMINISTRATOR;

  // Lecturer View States
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [gridMarksDraft, setGridMarksDraft] = useState<{
    [studentId: number]: { [examId: number]: string };
  }>({});
  const [customConfig, setCustomConfig] = useState<any>({
    weights: {},
    cutoffs: { ca: 40, final: 35 },
    grade_ranges: [],
  });
  const [newAssessment, setNewAssessment] = useState({
    exam_type: 'CA',
    exam_title: '',
    total_marks: 100,
  });
  const [renamingExamId, setRenamingExamId] = useState<number | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);

  // Review View States (Staff)
  const [selectedCourseReview, setSelectedCourseReview] = useState<any | null>(null);
  const [staffRejectCourseId, setStaffRejectCourseId] = useState<number | null>(null);
  const [staffActionReason, setStaffActionReason] = useState<string>('');
  const [isActioningCA, setIsActioningCA] = useState<boolean>(false);

  // Notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Staff Upgraded View States
  const [activeTab, setActiveTab] = useState<'review' | 'received' | 'approved' | 'combined'>(
    'review',
  );
  const [combinedCourseId, setCombinedCourseId] = useState<string>('');

  // ==========================================
  // LECTURER DATA QUERIES & MUTATIONS
  // ==========================================

  // 1. Fetch lecturer courses
  const { data: myCoursesData, isLoading: isCoursesLoading } = useQuery({
    queryKey: ['my-courses'],
    queryFn: async () => {
      const response = await apiClient.get('/marks/my-courses');
      return response.data?.data || [];
    },
    enabled: isLecturer,
  });
  const myCourses = Array.isArray(myCoursesData) ? myCoursesData : STABLE_EMPTY_ARRAY;

  // 2. Fetch Course Grid Data
  const {
    data: gridData,
    isLoading: isGridLoading,
    refetch: refetchGrid,
  } = useQuery({
    queryKey: ['course-grid', selectedCourseId],
    queryFn: async () => {
      const response = await apiClient.get(`/marks/courses/${selectedCourseId}/grid`);
      return response.data?.data;
    },
    enabled: isLecturer && !!selectedCourseId,
  });

  // Populate local states when gridData is loaded
  useEffect(() => {
    if (gridData) {
      // 1. Populate grid marks draft
      const draft: { [studentId: number]: { [examId: number]: string } } = {};

      if (gridData.marks && Array.isArray(gridData.marks)) {
        gridData.marks.forEach((m: any) => {
          if (!draft[m.student_id]) {
            draft[m.student_id] = {};
          }
          draft[m.student_id][m.exam_id] = m.marks_obtained.toString();
        });
      }

      if (gridData.students && gridData.exams) {
        gridData.students.forEach((s: any) => {
          if (!draft[s.student_id]) {
            draft[s.student_id] = {};
          }
          gridData.exams.forEach((e: any) => {
            if (draft[s.student_id][e.exam_id] === undefined) {
              draft[s.student_id][e.exam_id] = '';
            }
          });
        });
      }
      setGridMarksDraft(draft);

      // 2. Populate config
      const courseConfig = gridData.course?.marks_config || {};
      const defaultRanges = [
        { grade: 'A', min: 85.0 },
        { grade: 'A-', min: 80.0 },
        { grade: 'B+', min: 75.0 },
        { grade: 'B', min: 70.0 },
        { grade: 'B-', min: 65.0 },
        { grade: 'C+', min: 60.0 },
        { grade: 'C', min: 55.0 },
        { grade: 'C-', min: 50.0 },
        { grade: 'D', min: 40.0 },
        { grade: 'F', min: 0.0 },
      ];
      setCustomConfig({
        weights: courseConfig.weights || {},
        cutoffs: courseConfig.cutoffs || { ca: 40, final: 35 },
        grade_ranges: courseConfig.grade_ranges || defaultRanges,
      });
    }
  }, [gridData]);

  // Lecturer Mutations
  const submitGridMutation = useMutation({
    mutationFn: async (payload: {
      marks: { studentId: number; examMarks: { [examId: string]: number } }[];
      submissionType?: 'PROVISIONAL' | 'FINAL' | 'UPDATED' | null;
    }) => {
      await apiClient.post(`/marks/courses/${selectedCourseId}/submit-grid`, payload);
    },
    onSuccess: (_, variables) => {
      const type = variables.submissionType;
      setSuccessMsg(
        type ? `Grades submitted as ${type} successfully!` : 'Marks draft saved successfully.',
      );
      setErrorMsg(null);
      refetchGrid();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to save marks grid.');
      setSuccessMsg(null);
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (payload: any) => {
      await apiClient.post(`/marks/courses/${selectedCourseId}/config`, payload);
    },
    onSuccess: () => {
      setSuccessMsg('Grading configuration updated successfully.');
      setErrorMsg(null);
      refetchGrid();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to update configuration.');
      setSuccessMsg(null);
    },
  });

  const addAssessmentMutation = useMutation({
    mutationFn: async (payload: { exam_type: string; exam_title: string; total_marks: number }) => {
      await apiClient.post(`/marks/courses/${selectedCourseId}/exams`, payload);
    },
    onSuccess: () => {
      setSuccessMsg('New assessment added successfully.');
      setErrorMsg(null);
      refetchGrid();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to add assessment.');
      setSuccessMsg(null);
    },
  });

  const renameAssessmentMutation = useMutation({
    mutationFn: async (payload: { examId: number; exam_title: string }) => {
      await apiClient.patch(`/marks/courses/${selectedCourseId}/exams/${payload.examId}`, {
        exam_title: payload.exam_title,
      });
    },
    onSuccess: () => {
      setSuccessMsg('Assessment renamed successfully.');
      setErrorMsg(null);
      setRenamingExamId(null);
      refetchGrid();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to rename assessment.');
      setSuccessMsg(null);
    },
  });

  const deleteAssessmentMutation = useMutation({
    mutationFn: async (examId: number) => {
      await apiClient.delete(`/marks/courses/${selectedCourseId}/exams/${examId}`);
    },
    onSuccess: () => {
      setSuccessMsg('Assessment deleted successfully.');
      setErrorMsg(null);
      refetchGrid();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to delete assessment.');
      setSuccessMsg(null);
    },
  });

  // ==========================================
  // STAFF DATA QUERIES
  // ==========================================

  // 1. Fetch staff review queue (SUBMITTED_TO_STAFF courses)
  const {
    data: reviewQueueData = [],
    isLoading: isReviewQueueLoading,
    refetch: refetchReviewQueue,
  } = useQuery({
    queryKey: ['staff-review-queue'],
    queryFn: async () => {
      const response = await apiClient.get('/marks/staff/review-queue');
      return response.data?.data || [];
    },
    enabled: isStaffOrAdmin,
  });

  // 2. Fetch staff received queue (RECEIVED_BY_STAFF courses)
  const {
    data: receivedQueueData = [],
    isLoading: isReceivedQueueLoading,
    refetch: refetchReceivedQueue,
  } = useQuery({
    queryKey: ['staff-received-queue'],
    queryFn: async () => {
      const response = await apiClient.get('/marks/staff/received-queue');
      return response.data?.data || [];
    },
    enabled: isStaffOrAdmin,
  });

  // 3. Fetch staff approved directory (APPROVED courses)
  const {
    data: approvedDirectoryData = [],
    isLoading: isApprovedDirectoryLoading,
    refetch: refetchApprovedDirectory,
  } = useQuery({
    queryKey: ['staff-approved-directory'],
    queryFn: async () => {
      const response = await apiClient.get('/marks/staff/approved-directory');
      return response.data?.data || [];
    },
    enabled: isStaffOrAdmin,
  });

  // 4. Fetch selected course grid data for staff review
  const { data: staffGridData, isLoading: isStaffGridLoading } = useQuery({
    queryKey: ['staff-course-grid', selectedCourseReview?.course_id],
    queryFn: async () => {
      const response = await apiClient.get(`/marks/courses/${selectedCourseReview.course_id}/grid`);
      return response.data?.data;
    },
    enabled: isStaffOrAdmin && !!selectedCourseReview,
  });

  // 5. Fetch all courses list (for combined evaluation dropdown)
  const { data: coursesLookupData, isLoading: isCoursesLookupLoading } = useQuery({
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
      const response = await apiClient.get(`/marks/courses/${combinedCourseId}/grid`);
      return response.data?.data;
    },
    enabled: isStaffOrAdmin && !!combinedCourseId,
  });

  const receiveCourseMutation = useMutation({
    mutationFn: async (courseId: number) => {
      await apiClient.post(`/marks/courses/${courseId}/staff-receive`);
    },
    onSuccess: () => {
      setSuccessMsg('Course final marksheet marked as received.');
      setErrorMsg(null);
      refetchReviewQueue();
      refetchReceivedQueue();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to mark marksheet as received.');
    },
  });

  const rejectCourseMutation = useMutation({
    mutationFn: async (payload: { courseId: number; reason: string }) => {
      await apiClient.post(`/marks/courses/${payload.courseId}/staff-reject`, {
        reason: payload.reason,
      });
    },
    onSuccess: () => {
      setSuccessMsg('Course final marksheet rejected.');
      setErrorMsg(null);
      setStaffRejectCourseId(null);
      setStaffActionReason('');
      refetchReviewQueue();
      refetchReceivedQueue();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to reject marksheet.');
    },
  });

  const approveCourseMutation = useMutation({
    mutationFn: async (courseId: number) => {
      await apiClient.post(`/marks/courses/${courseId}/staff-approve`);
    },
    onSuccess: () => {
      setSuccessMsg('Course final marksheet approved and published.');
      setErrorMsg(null);
      refetchReceivedQueue();
      refetchApprovedDirectory();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to approve marksheet.');
    },
  });

  const handleExcelUpload = async (examId: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploadingExcel(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await apiClient.post(`/imports/exams/${examId}/marks`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (response.data?.success) {
        setSuccessMsg(`Successfully imported ${response.data.count} marks from spreadsheet.`);
        refetchGrid();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Failed to parse and import marks sheet.');
    } finally {
      setIsUploadingExcel(false);
      event.target.value = ''; // Reset input
    }
  };

  const handlePublishCA = async () => {
    if (!selectedCourseId || isActioningCA) return;
    if (
      confirm(
        'Are you sure you want to publish Continuous Assessment (CA) marks directly to students? Once published, students will see their CA grades.',
      )
    ) {
      setIsActioningCA(true);
      try {
        await apiClient.post(`/marks/courses/${selectedCourseId}/publish-ca`);
        setSuccessMsg('Continuous Assessment (CA) marks published directly to students!');
        refetchGrid();
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to publish CA marks.');
      } finally {
        setIsActioningCA(false);
      }
    }
  };

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleGridMarkChange = (studentId: number, examId: number, val: string) => {
    setGridMarksDraft((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [examId]: val,
      },
    }));
  };

  const validateAndBuildGridPayload = () => {
    const payload: { studentId: number; examMarks: { [examId: string]: number } }[] = [];
    const students = gridData?.students || [];
    const exams = gridData?.exams || [];

    for (const student of students) {
      const studentMarks: { [examId: string]: number } = {};
      const draft = gridMarksDraft[student.student_id] || {};

      for (const exam of exams) {
        const rawVal = draft[exam.exam_id] || '';
        if (rawVal === '') {
          setErrorMsg(
            `Every student must have a score for all assessments before submission. Missing entry for Student Index ${student.index_number} under "${exam.exam_title}".`,
          );
          return null;
        }
        const val = parseFloat(rawVal);
        if (isNaN(val) || val < 0 || val > exam.total_marks) {
          setErrorMsg(
            `Invalid score for student index ${student.index_number} on assessment "${exam.exam_title}". Must be between 0 and ${exam.total_marks}`,
          );
          return null;
        }
        studentMarks[exam.exam_id.toString()] = val;
      }
      payload.push({
        studentId: student.student_id,
        examMarks: studentMarks,
      });
    }
    return payload;
  };

  const handleSaveGridDraft = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload: { studentId: number; examMarks: { [examId: string]: number } }[] = [];
    const students = gridData?.students || [];
    const exams = gridData?.exams || [];

    for (const student of students) {
      const studentMarks: { [examId: string]: number } = {};
      const draft = gridMarksDraft[student.student_id] || {};

      for (const exam of exams) {
        const rawVal = draft[exam.exam_id] || '';
        if (rawVal !== '') {
          const val = parseFloat(rawVal);
          if (isNaN(val) || val < 0 || val > exam.total_marks) {
            setErrorMsg(
              `Invalid score for student index ${student.index_number} on assessment "${exam.exam_title}". Must be between 0 and ${exam.total_marks}`,
            );
            return;
          }
          studentMarks[exam.exam_id.toString()] = val;
        }
      }
      payload.push({
        studentId: student.student_id,
        examMarks: studentMarks,
      });
    }

    submitGridMutation.mutate({ marks: payload, submissionType: null });
  };

  const handleSubmitProvisional = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = validateAndBuildGridPayload();
    if (!payload) return;

    submitGridMutation.mutate({ marks: payload, submissionType: 'PROVISIONAL' });
  };

  const handleSubmitFinal = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = validateAndBuildGridPayload();
    if (!payload) return;

    if (
      confirm(
        'Are you sure you want to submit FINAL results? This will lock all grades for this course.',
      )
    ) {
      submitGridMutation.mutate({ marks: payload, submissionType: 'FINAL' });
    }
  };

  const handleUpdateResults = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = validateAndBuildGridPayload();
    if (!payload) return;

    submitGridMutation.mutate({ marks: payload, submissionType: 'UPDATED' });
  };

  // Local grade calculation helper
  const calculateStudentGradeLocal = (studentId: number) => {
    if (!gridData || !gridData.exams || gridData.exams.length === 0) {
      return { totalMarks: 0, grade: 'N/A' };
    }

    const studentDraft = gridMarksDraft[studentId] || {};
    const exams = gridData.exams;

    const caExams = exams.filter((e: any) => e.exam_type.toUpperCase() === 'CA');
    const finalExams = exams.filter((e: any) => e.exam_type.toUpperCase() === 'FINAL');

    // Default weight calculations
    const resolvedWeights: { [examId: number]: number } = {};
    const weights = customConfig.weights || {};
    let hasCustomWeights = false;
    if (weights && Object.keys(weights).length > 0) {
      hasCustomWeights = true;
      for (const [examIdStr, w] of Object.entries(weights)) {
        resolvedWeights[parseInt(examIdStr)] = parseFloat(w as string);
      }
    }

    if (!hasCustomWeights) {
      if (caExams.length > 0 && finalExams.length > 0) {
        caExams.forEach((e: any) => {
          resolvedWeights[e.exam_id] = 40 / caExams.length;
        });
        finalExams.forEach((e: any) => {
          resolvedWeights[e.exam_id] = 60 / finalExams.length;
        });
      } else if (caExams.length > 0) {
        caExams.forEach((e: any) => {
          resolvedWeights[e.exam_id] = 100 / caExams.length;
        });
      } else if (finalExams.length > 0) {
        finalExams.forEach((e: any) => {
          resolvedWeights[e.exam_id] = 100 / finalExams.length;
        });
      }
    }

    let totalCAObtained = 0;
    let totalCAMax = 0;
    let totalFinalObtained = 0;
    let totalFinalMax = 0;
    let totalWeightedPercentage = 0;

    exams.forEach((exam: any) => {
      const rawVal = studentDraft[exam.exam_id] || '';
      const score = rawVal !== '' ? parseFloat(rawVal) : 0;

      if (exam.exam_type.toUpperCase() === 'CA') {
        totalCAObtained += score;
        totalCAMax += exam.total_marks;
      } else {
        totalFinalObtained += score;
        totalFinalMax += exam.total_marks;
      }

      const weight = resolvedWeights[exam.exam_id] || 0;
      if (exam.total_marks > 0 && weight > 0) {
        totalWeightedPercentage += (score / exam.total_marks) * weight;
      }
    });

    const cutoffs = customConfig.cutoffs || { ca: 40, final: 35 };
    const caPercentage = totalCAMax > 0 ? (totalCAObtained / totalCAMax) * 100 : 100;
    const finalPercentage = totalFinalMax > 0 ? (totalFinalObtained / totalFinalMax) * 100 : 100;

    const failedCA = totalCAMax > 0 && caPercentage < (cutoffs.ca ?? 40);
    const failedFinal = totalFinalMax > 0 && finalPercentage < (cutoffs.final ?? 35);

    let grade = '';
    if (failedCA && failedFinal) {
      grade = 'E(CA)/E(SA)';
    } else if (failedCA) {
      grade = 'E(CA)';
    } else if (failedFinal) {
      grade = 'E(SA)';
    } else {
      const sortedRanges = [...(customConfig.grade_ranges || [])].sort(
        (a: any, b: any) => b.min - a.min,
      );
      const found = sortedRanges.find((r: any) => totalWeightedPercentage >= r.min);
      grade = found ? found.grade : 'F';
    }

    return {
      totalMarks: parseFloat(totalWeightedPercentage.toFixed(2)),
      grade,
    };
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
        <div className="space-y-6">
          {/* Selectors Panel */}
          <div className="bg-card/30 border border-border/60 p-6 rounded-3xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Select Allocated Course
              </h3>
              <p className="text-xs text-muted-foreground">
                Select a course to record marks, manage columns, and configure boundaries.
              </p>
            </div>
            <div className="w-full md:w-80">
              <select
                value={selectedCourseId}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                disabled={isCoursesLoading}
                className="w-full px-4 py-2.5 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground disabled:opacity-50"
              >
                <option value="">Choose Course Subject...</option>
                {myCourses.map((c: any) => (
                  <option key={c.course_id} value={c.course_id} className="bg-card">
                    {c.course_code} - {c.course_name} (Sem {c.semester})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedCourseId && gridData && (
            <div className="space-y-6 animate-fadeIn">
              {/* Rejection Reason Alert */}
              {gridData.course?.rejection_reason && (
                <div className="p-4 bg-destructive/10 border border-destructive/25 text-destructive rounded-2xl flex flex-col gap-1 text-sm font-semibold animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4.5 w-4.5" />
                    <span>
                      Results Rejected (
                      {gridData.course.result_submission_status === 'REJECTED_BY_HEAD'
                        ? 'Rejected by Department Head'
                        : 'Rejected by Exam Division Staff'}
                      )
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-normal mt-1">
                    Reason for rejection:{' '}
                    <strong className="text-foreground">{gridData.course.rejection_reason}</strong>
                  </p>
                </div>
              )}

              {/* Submission Status & Action Panel */}
              <div className="p-5 bg-secondary/15 border border-border/60 rounded-3xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Course Results Status:
                  </span>
                  <span
                    className={`px-3 py-1 text-xs font-bold rounded-full ${
                      gridData.course?.result_submission_status === 'APPROVED'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : gridData.course?.result_submission_status?.startsWith('SUBMITTED')
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : gridData.course?.result_submission_status === 'PUBLISHED_PROVISIONAL'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : gridData.course?.result_submission_status?.startsWith('REJECTED')
                              ? 'bg-destructive/10 text-destructive border border-destructive/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}
                  >
                    {gridData.course?.result_submission_status || 'DRAFT (UNSUBMITTED)'}
                  </span>
                  {gridData.course?.ca_published && (
                    <span className="px-2.5 py-0.5 text-[10px] font-bold rounded bg-purple-500/15 text-purple-400 border border-purple-500/25 uppercase">
                      CA Published
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={handleSaveGridDraft}
                    disabled={
                      submitGridMutation.isPending ||
                      (gridData.course?.result_submission_status &&
                        ![
                          'DRAFT',
                          'REJECTED_BY_HEAD',
                          'REJECTED_BY_STAFF',
                          'PUBLISHED_PROVISIONAL',
                        ].includes(gridData.course.result_submission_status))
                    }
                    className="px-4 py-2 bg-secondary text-secondary-foreground font-bold rounded-xl hover:bg-secondary/90 transition text-xs flex items-center gap-1.5 border border-border/60 disabled:opacity-40 cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5 text-primary" />
                    Save Draft
                  </button>

                  <button
                    onClick={handleSubmitProvisional}
                    disabled={
                      submitGridMutation.isPending ||
                      (gridData.course?.result_submission_status &&
                        ![
                          'DRAFT',
                          'REJECTED_BY_HEAD',
                          'REJECTED_BY_STAFF',
                          'PUBLISHED_PROVISIONAL',
                        ].includes(gridData.course.result_submission_status))
                    }
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition text-xs flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Submit (Provisional)
                  </button>

                  <button
                    onClick={handleSubmitFinal}
                    disabled={
                      submitGridMutation.isPending ||
                      (gridData.course?.result_submission_status &&
                        ![
                          'DRAFT',
                          'REJECTED_BY_HEAD',
                          'REJECTED_BY_STAFF',
                          'PUBLISHED_PROVISIONAL',
                        ].includes(gridData.course.result_submission_status))
                    }
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition text-xs flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Submit Final
                  </button>

                  {/* Publish CA Marks Button */}
                  {!gridData.course?.ca_published && (
                    <button
                      onClick={handlePublishCA}
                      disabled={
                        isActioningCA ||
                        (gridData.course?.result_submission_status &&
                          ![
                            'DRAFT',
                            'REJECTED_BY_HEAD',
                            'REJECTED_BY_STAFF',
                            'PUBLISHED_PROVISIONAL',
                          ].includes(gridData.course.result_submission_status))
                      }
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                    >
                      <Award className="h-3.5 w-3.5" />
                      Publish CA Marks
                    </button>
                  )}

                  {gridData.course?.result_submission_status === 'APPROVED' && (
                    <button
                      onClick={handleUpdateResults}
                      disabled={submitGridMutation.isPending}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Update Results (Unlock)
                    </button>
                  )}
                </div>
              </div>

              {/* Layout for Configs & Add Assessment */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <div className="lg:col-span-2 bg-card/25 border border-border/80 rounded-3xl p-6 backdrop-blur-md space-y-6">
                  <div className="flex justify-between items-center border-b border-border/60 pb-3">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Settings className="h-4.5 w-4.5 text-primary" />
                      Grading & Evaluation Settings
                    </h3>
                    <button
                      onClick={() => setShowConfigPanel(!showConfigPanel)}
                      className="text-xs text-primary hover:underline font-bold cursor-pointer"
                    >
                      {showConfigPanel ? 'Collapse' : 'Expand Settings'}
                    </button>
                  </div>

                  {showConfigPanel && (
                    <div className="space-y-6 animate-fadeIn text-xs sm:text-sm">
                      {/* Section A: Marks Distribution Weighting */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-foreground flex items-center gap-1">
                          <Percent className="h-4 w-4 text-primary" />
                          1. Assessment Weight Distribution (%)
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Configure the final grade percentage weighting. CAs total 40% and Final
                          Exam totals 60% by default, or set manually.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
                          {gridData.exams.map((exam: any) => {
                            const val =
                              customConfig.weights[exam.exam_id] !== undefined
                                ? customConfig.weights[exam.exam_id]
                                : '';
                            return (
                              <div
                                key={exam.exam_id}
                                className="p-3 bg-secondary/15 rounded-xl border border-border/40 space-y-1.5"
                              >
                                <span className="block text-[10px] font-bold text-muted-foreground uppercase truncate">
                                  {exam.exam_title} ({exam.exam_type})
                                </span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    placeholder="Weight"
                                    value={val}
                                    onChange={(e) => {
                                      const w = e.target.value;
                                      setCustomConfig((prev: any) => ({
                                        ...prev,
                                        weights: {
                                          ...prev.weights,
                                          [exam.exam_id]: w !== '' ? parseFloat(w) : undefined,
                                        },
                                      }));
                                    }}
                                    className="w-full px-2.5 py-1.5 bg-secondary/40 border border-border rounded-lg text-xs"
                                  />
                                  <span className="text-xs font-bold text-muted-foreground">%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between items-center text-xs text-muted-foreground bg-secondary/10 px-4 py-2 rounded-xl">
                          <span>
                            Total Assigned Weight:{' '}
                            <strong>
                              {
                                Object.values(customConfig.weights).reduce(
                                  (acc: number, w: any) => acc + (w || 0),
                                  0,
                                ) as number
                              }
                              %
                            </strong>
                          </span>
                          <span>(Must sum to 100% if manually defined)</span>
                        </div>
                      </div>

                      {/* Section B: Cutoff Marks Configuration */}
                      <div className="space-y-3 border-t border-border/60 pt-4">
                        <h4 className="font-bold text-foreground flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4 text-primary" />
                          2. Minimum Cutoff Marks Required to Pass
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Every student must meet these cutoffs. Otherwise, they will repeat with
                          repeat codes E(CA) or E(SA).
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-3 bg-secondary/15 rounded-xl border border-border/40 space-y-1.5">
                            <span className="block text-xs font-semibold text-foreground">
                              Continuous Assessment (CA) Cutoff (%)
                            </span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={customConfig.cutoffs.ca}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCustomConfig((prev: any) => ({
                                  ...prev,
                                  cutoffs: {
                                    ...prev.cutoffs,
                                    ca: val !== '' ? parseFloat(val) : 0,
                                  },
                                }));
                              }}
                              className="w-full px-3 py-1.5 bg-secondary/40 border border-border rounded-lg text-xs"
                            />
                            <span className="block text-[10px] text-muted-foreground">
                              Students failing this cutoff receive "E(CA)" grade code.
                            </span>
                          </div>

                          <div className="p-3 bg-secondary/15 rounded-xl border border-border/40 space-y-1.5">
                            <span className="block text-xs font-semibold text-foreground">
                              Final Semester Assessment (SA) Cutoff (%)
                            </span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={customConfig.cutoffs.final}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCustomConfig((prev: any) => ({
                                  ...prev,
                                  cutoffs: {
                                    ...prev.cutoffs,
                                    final: val !== '' ? parseFloat(val) : 0,
                                  },
                                }));
                              }}
                              className="w-full px-3 py-1.5 bg-secondary/40 border border-border rounded-lg text-xs"
                            />
                            <span className="block text-[10px] text-muted-foreground">
                              Students failing this cutoff receive "E(SA)" grade code.
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Section C: Grade Boundaries Configuration */}
                      <div className="space-y-3 border-t border-border/60 pt-4">
                        <h4 className="font-bold text-foreground flex items-center gap-1">
                          <Award className="h-4 w-4 text-primary" />
                          3. Letter Grade Mark Ranges (Boundaries)
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Configure the minimum total score required to achieve each final letter
                          grade.
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          {customConfig.grade_ranges.map((range: any, idx: number) => (
                            <div
                              key={range.grade}
                              className="p-2.5 bg-secondary/10 rounded-xl border border-border/45 flex flex-col items-center"
                            >
                              <span className="text-xs font-bold text-primary">{range.grade}</span>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="100"
                                value={range.min}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  const copy = [...customConfig.grade_ranges];
                                  copy[idx] = { ...copy[idx], min: isNaN(val) ? 0 : val };
                                  setCustomConfig((prev: any) => ({
                                    ...prev,
                                    grade_ranges: copy,
                                  }));
                                }}
                                className="w-16 text-center mt-1 py-0.5 bg-secondary/40 border border-border rounded text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Save Button */}
                      <div className="flex justify-end pt-3">
                        <button
                          onClick={() => {
                            const weightValues = Object.values(customConfig.weights).filter(
                              (w) => w !== undefined,
                            ) as number[];
                            if (weightValues.length > 0) {
                              const sum = weightValues.reduce((acc, cur) => acc + cur, 0);
                              if (sum !== 100) {
                                setErrorMsg(
                                  'Manual weight percentages must sum up exactly to 100%.',
                                );
                                return;
                              }
                            }
                            saveConfigMutation.mutate(customConfig);
                          }}
                          disabled={saveConfigMutation.isPending}
                          className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/90 transition-all cursor-pointer"
                        >
                          Save Configurations
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Add Assessment Column Form */}
                <div className="bg-card/25 border border-border/80 rounded-3xl p-6 backdrop-blur-md space-y-4 text-xs sm:text-sm">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
                    <Plus className="h-4.5 w-4.5 text-primary" />
                    Add Assessment Column
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-muted-foreground uppercase font-bold mb-1">
                        Assessment Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CA 2, Quiz 1, Mid Term"
                        value={newAssessment.exam_title}
                        onChange={(e) =>
                          setNewAssessment((prev) => ({ ...prev, exam_title: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-muted-foreground uppercase font-bold mb-1">
                          Type
                        </label>
                        <select
                          value={newAssessment.exam_type}
                          onChange={(e) =>
                            setNewAssessment((prev) => ({ ...prev, exam_type: e.target.value }))
                          }
                          className="w-full px-3 py-2.5 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none"
                        >
                          <option value="CA">CA (Continuous)</option>
                          <option value="FINAL">FINAL Exam</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-muted-foreground uppercase font-bold mb-1">
                          Total Marks
                        </label>
                        <input
                          type="number"
                          value={newAssessment.total_marks}
                          onChange={(e) =>
                            setNewAssessment((prev) => ({
                              ...prev,
                              total_marks: parseInt(e.target.value) || 0,
                            }))
                          }
                          className="w-full px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (!newAssessment.exam_title) {
                          setErrorMsg('Please enter an assessment title.');
                          return;
                        }
                        if (newAssessment.total_marks <= 0) {
                          setErrorMsg('Total marks must be greater than 0.');
                          return;
                        }
                        addAssessmentMutation.mutate(newAssessment);
                        setNewAssessment({ exam_type: 'CA', exam_title: '', total_marks: 100 });
                      }}
                      disabled={addAssessmentMutation.isPending}
                      className="w-full py-2 bg-secondary hover:bg-secondary/80 text-foreground font-bold border border-border/80 rounded-xl transition text-xs cursor-pointer"
                    >
                      Add Column
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic Marks Sheet Grading Grid */}
              <div className="bg-card/20 border border-border/60 rounded-3xl p-6 backdrop-blur-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Student Marks Registry Grid
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Enter grades directly into the table cells. Recalculations are done in
                      real-time.
                    </p>
                  </div>
                </div>

                <div className="border border-border/60 rounded-2xl overflow-x-auto shadow-md">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 bg-secondary/15 text-muted-foreground font-bold font-mono">
                        <th className="px-6 py-4 min-w-32">Index Number</th>
                        <th className="px-6 py-4 min-w-44">Student Name</th>

                        {/* Dynamic Assessment Columns */}
                        {gridData.exams.map((exam: any) => (
                          <th
                            key={exam.exam_id}
                            className="px-4 py-4 min-w-36 text-center border-l border-border/40"
                          >
                            {renamingExamId === exam.exam_id ? (
                              <div className="flex items-center gap-1.5 justify-center">
                                <input
                                  type="text"
                                  value={renamingTitle}
                                  onChange={(e) => setRenamingTitle(e.target.value)}
                                  className="w-24 px-1 py-0.5 bg-card border rounded text-[11px]"
                                />
                                <button
                                  onClick={() =>
                                    renameAssessmentMutation.mutate({
                                      examId: exam.exam_id,
                                      exam_title: renamingTitle,
                                    })
                                  }
                                  className="p-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded border border-emerald-500/20 cursor-pointer"
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => setRenamingExamId(null)}
                                  className="p-1 bg-secondary text-muted-foreground rounded border border-border/60 cursor-pointer"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span className="font-bold text-foreground flex items-center gap-1 text-[11px]">
                                  {exam.exam_title}
                                  <button
                                    onClick={() => {
                                      setRenamingExamId(exam.exam_id);
                                      setRenamingTitle(exam.exam_title);
                                    }}
                                    className="p-0.5 text-muted-foreground hover:text-primary rounded cursor-pointer"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </button>
                                </span>
                                <span className="text-[10px] text-muted-foreground font-semibold">
                                  Max Marks: {exam.total_marks}
                                </span>
                                <div className="mt-1.5 border-t border-border/40 pt-1 flex items-center justify-between w-full gap-2">
                                  <label
                                    htmlFor={`upload-excel-${exam.exam_id}`}
                                    className="text-[9px] text-primary hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Upload className="h-3 w-3" /> Upload
                                  </label>
                                  <input
                                    type="file"
                                    id={`upload-excel-${exam.exam_id}`}
                                    accept=".xlsx,.xls,.csv"
                                    className="hidden"
                                    onChange={(e) => handleExcelUpload(exam.exam_id, e)}
                                  />
                                  <button
                                    onClick={() => {
                                      if (
                                        confirm(
                                          `Are you sure you want to delete assessment column "${exam.exam_title}"? This will delete all registered marks for this column.`,
                                        )
                                      ) {
                                        deleteAssessmentMutation.mutate(exam.exam_id);
                                      }
                                    }}
                                    className="text-[9px] text-destructive hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Trash2 className="h-3 w-3" /> Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </th>
                        ))}

                        <th className="px-6 py-4 text-center min-w-32 border-l border-border/40 bg-secondary/5 font-extrabold text-foreground">
                          Total Weighted
                        </th>
                        <th className="px-6 py-4 text-center min-w-24 border-l border-border/40 bg-secondary/5 font-extrabold text-foreground">
                          Final Grade
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-medium">
                      {isGridLoading ? (
                        <tr>
                          <td
                            colSpan={((gridData as any)?.exams?.length || 0) + 4}
                            className="text-center py-20 text-muted-foreground"
                          >
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                              Loading grading grid data...
                            </span>
                          </td>
                        </tr>
                      ) : !(gridData as any)?.students ||
                        (gridData as any).students.length === 0 ? (
                        <tr>
                          <td
                            colSpan={((gridData as any)?.exams?.length || 0) + 4}
                            className="text-center py-20 text-muted-foreground"
                          >
                            No students registered for this course yet.
                          </td>
                        </tr>
                      ) : (
                        (gridData as any).students.map((student: any) => {
                          const results = calculateStudentGradeLocal(student.student_id);
                          const status = (gridData as any).course?.result_submission_status;
                          const isLocked =
                            status &&
                            ![
                              'DRAFT',
                              'REJECTED_BY_HEAD',
                              'REJECTED_BY_STAFF',
                              'PUBLISHED_PROVISIONAL',
                            ].includes(status);

                          return (
                            <tr
                              key={student.student_id}
                              className="hover:bg-secondary/10 transition-colors"
                            >
                              <td className="px-6 py-3 font-bold text-foreground font-mono">
                                {student.index_number || 'N/A'}
                              </td>
                              <td className="px-6 py-3 text-muted-foreground truncate max-w-xs">
                                {student.user?.full_name}
                              </td>

                              {/* Dynamic Score Input Cells */}
                              {((gridData as any)?.exams || []).map((exam: any) => {
                                const scoreDraft =
                                  gridMarksDraft[student.student_id]?.[exam.exam_id] || '';
                                return (
                                  <td
                                    key={exam.exam_id}
                                    className="px-4 py-2 text-center border-l border-border/30"
                                  >
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0"
                                      max={exam.total_marks}
                                      value={scoreDraft}
                                      disabled={isLocked}
                                      placeholder="0.0"
                                      onChange={(e) =>
                                        handleGridMarkChange(
                                          student.student_id,
                                          exam.exam_id,
                                          e.target.value,
                                        )
                                      }
                                      className="w-20 px-2 py-1 bg-secondary/30 border border-border/80 rounded-lg text-center text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
                                    />
                                  </td>
                                );
                              })}

                              {/* Calculated Total Weighted Marks */}
                              <td className="px-6 py-3 text-center border-l border-border/30 bg-secondary/5 font-mono font-bold text-foreground">
                                {results.totalMarks}%
                              </td>

                              {/* Calculated Grade */}
                              <td className="px-6 py-3 text-center border-l border-border/30 bg-secondary/5">
                                <span
                                  className={`px-2 py-0.5 font-bold rounded text-xs ${
                                    results.grade.startsWith('E')
                                      ? 'bg-destructive/10 text-destructive border border-destructive/20'
                                      : results.grade === 'F'
                                        ? 'bg-destructive/10 text-destructive'
                                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  }`}
                                >
                                  {results.grade}
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
            </div>
          )}
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
                setSelectedCourseReview(null);
              }}
              className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === 'review'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Review Queue ({reviewQueueData.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('received');
                setErrorMsg(null);
                setSuccessMsg(null);
                setSelectedCourseReview(null);
              }}
              className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === 'received'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Received Queue ({receivedQueueData.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('approved');
                setErrorMsg(null);
                setSuccessMsg(null);
                setSelectedCourseReview(null);
              }}
              className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === 'approved'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Approved Directory ({approvedDirectoryData.length})
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

          {/* TAB 1, 2, 3: REVIEW / RECEIVED / APPROVED LISTS */}
          {(activeTab === 'review' || activeTab === 'received' || activeTab === 'approved') && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
              {/* Sidebar list of sheets */}
              <div className="bg-card/25 border border-border/80 p-5 rounded-3xl backdrop-blur-md space-y-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4.5 w-4.5 text-primary" />
                  {activeTab === 'review'
                    ? 'Pending Review'
                    : activeTab === 'received'
                      ? 'Received Sheets'
                      : 'Approved Sheets'}
                </h3>

                {(activeTab === 'review' && isReviewQueueLoading) ||
                (activeTab === 'received' && isReceivedQueueLoading) ||
                (activeTab === 'approved' && isApprovedDirectoryLoading) ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {activeTab === 'review' && reviewQueueData.length === 0 && (
                      <div className="text-center py-8 bg-secondary/10 rounded-2xl text-xs text-muted-foreground">
                        No submissions pending review.
                      </div>
                    )}
                    {activeTab === 'received' && receivedQueueData.length === 0 && (
                      <div className="text-center py-8 bg-secondary/10 rounded-2xl text-xs text-muted-foreground">
                        No results marked as received.
                      </div>
                    )}
                    {activeTab === 'approved' && approvedDirectoryData.length === 0 && (
                      <div className="text-center py-8 bg-secondary/10 rounded-2xl text-xs text-muted-foreground">
                        No approved result sheets found.
                      </div>
                    )}

                    {activeTab === 'review' &&
                      reviewQueueData.map((course: any) => (
                        <div
                          key={course.course_id}
                          onClick={() => setSelectedCourseReview(course)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none text-left ${
                            selectedCourseReview?.course_id === course.course_id
                              ? 'bg-primary/10 border-primary shadow-lg'
                              : 'bg-card/30 border-border/60 hover:bg-card/50 hover:border-border'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md uppercase">
                              {course.course_code}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              Batch {course.academic_year}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-foreground truncate mt-2">
                            {course.course_name}
                          </h4>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Sem: {course.semester} | Department:{' '}
                            {course.department?.department_name}
                          </p>
                        </div>
                      ))}

                    {activeTab === 'received' &&
                      receivedQueueData.map((course: any) => (
                        <div
                          key={course.course_id}
                          onClick={() => setSelectedCourseReview(course)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none text-left ${
                            selectedCourseReview?.course_id === course.course_id
                              ? 'bg-primary/10 border-primary shadow-lg'
                              : 'bg-card/30 border-border/60 hover:bg-card/50 hover:border-border'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md uppercase">
                              {course.course_code}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              Batch {course.academic_year}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-foreground truncate mt-2">
                            {course.course_name}
                          </h4>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Sem: {course.semester} | Department:{' '}
                            {course.department?.department_name}
                          </p>
                        </div>
                      ))}

                    {activeTab === 'approved' &&
                      approvedDirectoryData.map((course: any) => (
                        <div
                          key={course.course_id}
                          onClick={() => setSelectedCourseReview(course)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none text-left ${
                            selectedCourseReview?.course_id === course.course_id
                              ? 'bg-primary/10 border-primary shadow-lg'
                              : 'bg-card/30 border-border/60 hover:bg-card/50 hover:border-border'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md uppercase">
                              {course.course_code}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              Batch {course.academic_year}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-foreground truncate mt-2">
                            {course.course_name}
                          </h4>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Sem: {course.semester} | Department:{' '}
                            {course.department?.department_name}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Sheet Review Grid */}
              <div className="lg:col-span-3">
                {!selectedCourseReview ? (
                  <div className="p-20 text-center bg-card/10 border border-border/60 rounded-3xl flex flex-col items-center justify-center">
                    <ShieldCheck className="h-10 w-10 text-muted-foreground/45 mb-3" />
                    <p className="text-sm font-semibold text-muted-foreground">
                      No course results sheet selected
                    </p>
                    <p className="text-xs text-muted-foreground/75 mt-1 max-w-sm">
                      Select a results sheet from the pending queue on the left to verify and action
                      grades.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Header Action controls */}
                    <div className="p-4 bg-secondary/15 border border-border/60 rounded-2xl flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <h3 className="text-sm font-bold text-foreground">
                          Reviewing: {selectedCourseReview.course_name} (
                          {selectedCourseReview.course_code})
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Semester: <strong>{selectedCourseReview.semester}</strong> | Batch:{' '}
                          <strong>{selectedCourseReview.academic_year}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {activeTab === 'review' && (
                          <>
                            <button
                              onClick={() => setStaffRejectCourseId(selectedCourseReview.course_id)}
                              className="px-4 py-2 bg-destructive/10 text-destructive border border-destructive/20 font-semibold rounded-xl hover:bg-destructive/20 transition text-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </button>
                            <button
                              onClick={() =>
                                receiveCourseMutation.mutate(selectedCourseReview.course_id)
                              }
                              disabled={receiveCourseMutation.isPending}
                              className="px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold rounded-xl hover:bg-indigo-500/20 transition text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                              {receiveCourseMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Mark as Received
                            </button>
                          </>
                        )}

                        {activeTab === 'received' && (
                          <>
                            <button
                              onClick={() => setStaffRejectCourseId(selectedCourseReview.course_id)}
                              className="px-4 py-2 bg-destructive/10 text-destructive border border-destructive/20 font-semibold rounded-xl hover:bg-destructive/20 transition text-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </button>
                            <button
                              onClick={() =>
                                approveCourseMutation.mutate(selectedCourseReview.course_id)
                              }
                              disabled={approveCourseMutation.isPending}
                              className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold rounded-xl hover:bg-emerald-500/20 transition text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                              {approveCourseMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5" />
                              )}
                              Approve & Publish Final
                            </button>
                          </>
                        )}

                        {activeTab === 'approved' && (
                          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5" /> Approved
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rejection Prompt step */}
                    {staffRejectCourseId === selectedCourseReview.course_id && (
                      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl space-y-3 animate-slideUp">
                        <label className="block text-sm font-semibold text-destructive">
                          Reason for Rejection
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Enter rejection explanation to display to the lecturer..."
                          value={staffActionReason}
                          onChange={(e) => setStaffActionReason(e.target.value)}
                          className="w-full px-4 py-2.5 bg-background border border-destructive/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-destructive/60 transition text-sm text-foreground placeholder:text-muted-foreground/60"
                        />
                        <div className="flex gap-3 justify-end">
                          <button
                            onClick={() => {
                              setStaffRejectCourseId(null);
                              setStaffActionReason('');
                            }}
                            className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 rounded-xl transition text-sm font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() =>
                              rejectCourseMutation.mutate({
                                courseId: selectedCourseReview.course_id,
                                reason: staffActionReason,
                              })
                            }
                            disabled={rejectCourseMutation.isPending || !staffActionReason.trim()}
                            className="px-4 py-2 bg-destructive text-white hover:bg-destructive/90 rounded-xl transition text-sm font-semibold flex items-center disabled:opacity-65 cursor-pointer"
                          >
                            {rejectCourseMutation.isPending && (
                              <Loader2 className="h-4.5 w-4.5 animate-spin mr-1.5" />
                            )}
                            Confirm Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Marksheet Entry reviews */}
                    <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                            <th className="px-6 py-4">Reg Number</th>
                            <th className="px-6 py-4">Student Name</th>
                            <th className="px-6 py-4 text-center">CA Marks</th>
                            <th className="px-6 py-4 text-center">Final Exam</th>
                            <th className="px-6 py-4 text-center">Total Marks</th>
                            <th className="px-6 py-4 text-center">Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 text-sm font-medium">
                          {isStaffGridLoading ? (
                            <tr>
                              <td colSpan={6} className="text-center py-20 text-muted-foreground">
                                <span className="inline-flex items-center gap-2">
                                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                  Loading marksheet data...
                                </span>
                              </td>
                            </tr>
                          ) : !staffGridData ||
                            !staffGridData.grades ||
                            staffGridData.grades.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-20 text-muted-foreground">
                                No student grades recorded for this course.
                              </td>
                            </tr>
                          ) : (
                            staffGridData.grades.map((grade: any) => (
                              <tr
                                key={grade.grade_id}
                                className="hover:bg-secondary/15 transition-colors"
                              >
                                <td className="px-6 py-3.5 font-semibold text-foreground font-mono">
                                  {grade.student?.registration_number}
                                </td>
                                <td className="px-6 py-3.5 text-muted-foreground">
                                  {grade.student?.user?.full_name}
                                </td>
                                <td className="px-6 py-3.5 text-center font-mono font-bold">
                                  {Number(grade.continuous_assessment_marks).toFixed(1)}
                                </td>
                                <td className="px-6 py-3.5 text-center font-mono font-bold">
                                  {Number(grade.final_exam_marks).toFixed(1)}
                                </td>
                                <td className="px-6 py-3.5 text-center font-mono font-bold text-primary">
                                  {Number(grade.total_marks).toFixed(1)}
                                </td>
                                <td className="px-6 py-3.5 text-center">
                                  <span className="px-2 py-0.5 font-bold rounded text-xs bg-primary/10 text-primary border border-primary/20">
                                    {grade.grade}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: COMBINED EVALUATION */}
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
              </div>

              {/* Combined Results Display */}
              {!combinedCourseId ? (
                <div className="p-20 text-center bg-card/10 border border-border/60 rounded-3xl flex flex-col items-center justify-center">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground/45 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground">No course selected</p>
                  <p className="text-xs text-muted-foreground/75 mt-1 max-w-sm">
                    Choose a course from the dropdown menu to inspect its full combined student
                    assessment report.
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
                  {/* Course Details */}
                  <div className="p-5 bg-secondary/15 border border-border/60 rounded-2xl">
                    <h3 className="text-sm font-bold text-foreground">
                      {combinedResults?.course?.course_name} ({combinedResults?.course?.course_code}
                      )
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-normal">
                      Semester: <strong>{combinedResults?.course?.semester}</strong> | Batch:{' '}
                      <strong>{combinedResults?.course?.academic_year}</strong>
                    </p>
                  </div>

                  {/* Combined Marks Table */}
                  <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-border/80 font-bold text-muted-foreground uppercase bg-secondary/15">
                            <th className="px-4 py-3.5">Registration No</th>
                            <th className="px-4 py-3.5">Student Name</th>
                            <th className="px-4 py-3.5 text-center">CA Marks</th>
                            <th className="px-4 py-3.5 text-center">Final Exam</th>
                            <th className="px-4 py-3.5 text-center bg-secondary/10">Total Marks</th>
                            <th className="px-4 py-3.5 text-center bg-primary/10 text-primary">
                              Grade
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 text-sm font-medium">
                          {!combinedResults?.grades || combinedResults.grades.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-10 text-muted-foreground">
                                No student marks found.
                              </td>
                            </tr>
                          ) : (
                            combinedResults.grades.map((grade: any) => (
                              <tr
                                key={grade.grade_id}
                                className="hover:bg-secondary/15 transition-colors"
                              >
                                <td className="px-4 py-3 font-semibold text-foreground text-xs">
                                  {grade.student?.registration_number}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                  {grade.student?.user?.full_name}
                                </td>
                                <td className="px-4 py-3 text-center font-mono text-xs">
                                  {Number(grade.continuous_assessment_marks).toFixed(1)}
                                </td>
                                <td className="px-4 py-3 text-center font-mono text-xs">
                                  {Number(grade.final_exam_marks).toFixed(1)}
                                </td>
                                <td className="px-4 py-3 text-center font-mono text-xs bg-secondary/5 font-bold">
                                  {Number(grade.total_marks).toFixed(1)}
                                </td>
                                <td className="px-4 py-3 text-center bg-primary/5">
                                  <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded font-extrabold text-xs">
                                    {grade.grade}
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
        </div>
      )}
    </div>
  );
}
