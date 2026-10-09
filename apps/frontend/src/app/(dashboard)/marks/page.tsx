'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';
import {
  CheckCircle,
  CheckCircle2,
  Send,
  Loader2,
  AlertTriangle,
  ClipboardList,
  Edit3,
  Upload,
  Plus,
  Trash2,
  Settings,
  Check,
  RotateCcw,
  Award,
  X,
  BookOpen,
  Users,
  Download,
  Search,
  Lock,
} from 'lucide-react';
import { UserRole } from '@ems/shared';
import * as XLSX from 'xlsx';

const STABLE_EMPTY_ARRAY: any[] = [];

export default function MarksRegistryPage() {
  const { user } = useAuthStore();
  const role = user?.role;

  const isLecturer = role === UserRole.LECTURER;
  const isStaffOrAdmin = role === UserRole.EXAM_DIVISION_STAFF || role === UserRole.ADMINISTRATOR;

  // Lecturer Navigation & View States
  const [lecturerTab, setLecturerTab] = useState<'registry' | 'settings'>('registry');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('ALL');
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<string>('ALL');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  // 4 Subparts Navigation for Student Marks Registry Grid
  const [gridSubpart, setGridSubpart] = useState<
    '1st_marker' | '2nd_marker' | 'detailed' | 'final'
  >('1st_marker');
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');

  // 1st Marker Sheet States (Questions default to empty [])
  const [firstMarkerQuestions, setFirstMarkerQuestions] = useState<any[]>([]);
  const [firstMarkerMarks, setFirstMarkerMarks] = useState<{
    [studentId: number]: { [qKey: string]: number };
  }>({});
  const [isFirstMarkingSubmitted, setIsFirstMarkingSubmitted] = useState<boolean>(false);

  // 2nd Marker Sheet States
  const [secondMarkerMarks, setSecondMarkerMarks] = useState<{
    [studentId: number]: { [qKey: string]: number };
  }>({});
  const [isSecondMarkingSubmitted, setIsSecondMarkingSubmitted] = useState<boolean>(false);

  // Reconciliation Choices (MAX | MIN | AVG)
  const [reconciliationDecisions, setReconciliationDecisions] = useState<{
    [studentId: number]: 'MAX' | 'MIN' | 'AVG';
  }>({});

  // Detailed Sheet CA Marks
  const [caMarksData, setCaMarksData] = useState<{ [studentId: number]: number }>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const cId = params.get('courseId');
      if (cId) {
        setSelectedCourseId(cId);
      }
    }
  }, []);

  const [gridMarksDraft, setGridMarksDraft] = useState<{
    [studentId: number]: { [examId: number]: string };
  }>({});
  const [marksVisibleLimit, setMarksVisibleLimit] = useState<number>(100);

  React.useEffect(() => {
    setMarksVisibleLimit(100);
  }, [selectedCourseId, selectedBatchFilter, selectedSemesterFilter]);

  const [customConfig, setCustomConfig] = useState<any>({
    weights: {},
    contributes: {},
    cutoffs: { ca: 40, final: 35 },
    grade_ranges: [],
  });

  // Modal State for Adding New Assessment
  const [showAddAssessmentModal, setShowAddAssessmentModal] = useState<boolean>(false);
  const [newAssessment, setNewAssessment] = useState({
    exam_type: 'CA',
    exam_title: '',
    total_marks: 100,
    weight: 10,
    contributes: true,
  });

  const [renamingExamId, setRenamingExamId] = useState<number | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');

  // Grade Range Editing & CA Modifications Trackers
  const [isEditingGradeRanges, setIsEditingGradeRanges] = useState<boolean>(false);
  const [newGradeName, setNewGradeName] = useState<string>('');
  const [newGradeMin, setNewGradeMin] = useState<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isCaModifiedAfterPublish, _setIsCaModifiedAfterPublish] = useState<boolean>(false);

  // Staff Review View States
  const [selectedCourseReview, setSelectedCourseReview] = useState<any | null>(null);
  const [staffRejectCourseId, setStaffRejectCourseId] = useState<number | null>(null);
  const [staffActionReason, setStaffActionReason] = useState<string>('');
  const [isActioningCA, setIsActioningCA] = useState<boolean>(false);

  // Notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isUploadingExcel, setIsUploadingExcel] = useState<boolean>(false);
  void isUploadingExcel;

  // Staff Tabs
  const [activeTab, setActiveTab] = useState<'review' | 'received' | 'approved' | 'combined'>(
    'review',
  );
  const [combinedCourseId, setCombinedCourseId] = useState<string>('');

  // ==========================================
  // LECTURER DATA QUERIES & MUTATIONS
  // ==========================================

  // 1. Fetch lecturer assigned courses
  const { data: myCoursesData, isLoading: isCoursesLoading } = useQuery({
    queryKey: ['my-courses'],
    queryFn: async () => {
      const response = await apiClient.get('/marks/my-courses');
      return response.data?.data || [];
    },
    enabled: isLecturer,
  });
  const myCourses = Array.isArray(myCoursesData) ? myCoursesData : STABLE_EMPTY_ARRAY;

  // Derive unique batches & semesters for filters
  const availableBatches = Array.from(
    new Set(myCourses.map((c: any) => String(c.academic_year || c.batch || '2024').trim())),
  ).sort();

  const availableSemesters = Array.from(
    new Set(myCourses.map((c: any) => (c.semester ? String(c.semester).trim() : ''))),
  )
    .filter(Boolean)
    .sort();

  const filteredCourses = myCourses.filter((c: any) => {
    const matchBatch =
      selectedBatchFilter === 'ALL' ||
      String(c.academic_year) === selectedBatchFilter ||
      String(c.batch) === selectedBatchFilter;
    const matchSemester =
      selectedSemesterFilter === 'ALL' || String(c.semester) === selectedSemesterFilter;
    return matchBatch && matchSemester;
  });

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

  // Auto progressive background loading effect (first 100 loaded, then automatically loads remaining)
  useEffect(() => {
    const totalCount = gridData?.students?.length || 0;
    if (totalCount > marksVisibleLimit) {
      const timer = setTimeout(() => {
        setMarksVisibleLimit((prev) => Math.min(prev + 100, totalCount));
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [marksVisibleLimit, gridData?.students?.length]);

  // Populate local states when gridData is loaded
  useEffect(() => {
    if (gridData) {
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

      const courseConfig = gridData.course?.marks_config || {};
      const savedWeights = courseConfig.weights || {};
      const savedContributes = courseConfig.contributes || {};

      const defaultWeights: { [examId: number]: number } = {};
      const defaultContributes: { [examId: number]: boolean } = {};
      const caExams = (gridData.exams || []).filter((e: any) => e.exam_type.toUpperCase() === 'CA');
      const finalExams = (gridData.exams || []).filter(
        (e: any) => e.exam_type.toUpperCase() === 'FINAL',
      );

      (gridData.exams || []).forEach((e: any) => {
        defaultContributes[e.exam_id] =
          savedContributes[e.exam_id] !== undefined ? !!savedContributes[e.exam_id] : true;
      });

      if (caExams.length > 0 && finalExams.length > 0) {
        let caSum = 0;
        const activeCa = caExams.filter((e: any) => defaultContributes[e.exam_id]);
        activeCa.forEach((e: any, i: number) => {
          if (i === activeCa.length - 1) {
            defaultWeights[e.exam_id] = parseFloat((40 - caSum).toFixed(1));
          } else {
            const w = parseFloat((40 / (activeCa.length || 1)).toFixed(1));
            defaultWeights[e.exam_id] = w;
            caSum += w;
          }
        });

        let finalSum = 0;
        finalExams.forEach((e: any, i: number) => {
          if (i === finalExams.length - 1) {
            defaultWeights[e.exam_id] = parseFloat((60 - finalSum).toFixed(1));
          } else {
            const w = parseFloat((60 / finalExams.length).toFixed(1));
            defaultWeights[e.exam_id] = w;
            finalSum += w;
          }
        });
      }

      const weights: { [examId: number]: number } = {};
      const contributes: { [examId: number]: boolean } = {};
      const hasSavedWeights = Object.keys(savedWeights).length > 0;

      (gridData.exams || []).forEach((exam: any) => {
        contributes[exam.exam_id] =
          savedContributes[exam.exam_id] !== undefined
            ? !!savedContributes[exam.exam_id]
            : (defaultContributes[exam.exam_id] ?? true);

        const savedVal = savedWeights[exam.exam_id];
        if (savedVal !== undefined && savedVal !== null) {
          weights[exam.exam_id] = parseFloat(savedVal as string);
        } else if (!hasSavedWeights) {
          weights[exam.exam_id] = defaultWeights[exam.exam_id] || 0;
        } else {
          weights[exam.exam_id] = 0;
        }
      });

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
        weights,
        contributes,
        cutoffs: courseConfig.cutoffs || { ca: 40, final: 35 },
        grade_ranges: courseConfig.grade_ranges || defaultRanges,
      });

      // Load 4 Subparts config
      let subConfig: any = gridData.course?.marks_config || {};
      if (typeof subConfig === 'string') {
        try {
          subConfig = JSON.parse(subConfig);
        } catch {
          subConfig = {};
        }
      }

      if (subConfig.questions && subConfig.questions.length > 0) {
        setFirstMarkerQuestions(subConfig.questions);
      }

      const is1stSub = Boolean(
        subConfig.firstMarkerSheet?.submitted ||
        gridData.course?.publishing_progress?.first_marking_submitted,
      );
      setIsFirstMarkingSubmitted(is1stSub);

      const is2ndSub = Boolean(
        subConfig.secondMarkerSheet?.submitted ||
        gridData.course?.publishing_progress?.second_marking_submitted,
      );
      setIsSecondMarkingSubmitted(is2ndSub);

      if (subConfig.firstMarkerSheet?.marks) {
        setFirstMarkerMarks(subConfig.firstMarkerSheet.marks);
      }
      if (subConfig.secondMarkerSheet?.marks) {
        setSecondMarkerMarks(subConfig.secondMarkerSheet.marks);
      }
      if (subConfig.reconciliation) {
        setReconciliationDecisions(subConfig.reconciliation);
      }
      if (subConfig.caMarks) {
        setCaMarksData(subConfig.caMarks);
      }
    }
  }, [gridData]);

  // Auto-save marks draft on user input changes
  useEffect(() => {
    if (!selectedCourseId || !gridData || isGridLoading || !isLecturer) return;
    const status = gridData.course?.result_submission_status;
    if (
      status &&
      [
        'SUBMITTED_FINAL',
        'SUBMITTED_PROVISIONAL',
        'SUBMITTED',
        'APPROVED',
        'PUBLISHED_PROVISIONAL',
        'SUBMITTED_TO_STAFF',
        'RECEIVED_BY_STAFF',
      ].includes(status)
    ) {
      return;
    }

    const timer = setTimeout(() => {
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
            if (!isNaN(val) && val >= 0 && val <= exam.total_marks) {
              studentMarks[exam.exam_id.toString()] = val;
            }
          }
        }
        if (Object.keys(studentMarks).length > 0) {
          payload.push({ studentId: student.student_id, examMarks: studentMarks });
        }
      }

      if (payload.length > 0) {
        submitGridMutation.mutate({ marks: payload, submissionType: null });
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [gridMarksDraft, selectedCourseId]);

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
      if (type) {
        setSuccessMsg(`Grades submitted as ${type} successfully!`);
        setErrorMsg(null);
      }
      refetchGrid();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to save marks grid.');
      setSuccessMsg(null);
    },
  });

  const revokeCourseMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/marks/courses/${selectedCourseId}/revoke`);
    },
    onSuccess: () => {
      setSuccessMsg(
        'Submitted result sheet revoked successfully! You can now edit and re-submit marks.',
      );
      setErrorMsg(null);
      refetchGrid();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to revoke submitted result sheet.');
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
    mutationFn: async (payload: {
      exam_type: string;
      exam_title: string;
      total_marks: number;
      weight?: number;
      contributes?: boolean;
    }) => {
      await apiClient.post(`/marks/courses/${selectedCourseId}/exams`, payload);
    },
    onSuccess: () => {
      setSuccessMsg('New assessment added successfully.');
      setErrorMsg(null);
      setShowAddAssessmentModal(false);
      setNewAssessment({
        exam_type: 'CA',
        exam_title: '',
        total_marks: 100,
        weight: 10,
        contributes: true,
      });
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

  const { data: staffGridData, isLoading: isStaffGridLoading } = useQuery({
    queryKey: ['staff-course-grid', selectedCourseReview?.course_id],
    queryFn: async () => {
      const response = await apiClient.get(`/marks/courses/${selectedCourseReview.course_id}/grid`);
      return response.data?.data;
    },
    enabled: isStaffOrAdmin && !!selectedCourseReview,
  });

  const { data: coursesLookupData } = useQuery({
    queryKey: ['courses-lookup'],
    queryFn: async () => {
      const response = await apiClient.get('/reports/courses');
      return response.data?.data || [];
    },
    enabled: isStaffOrAdmin,
  });
  const coursesLookup = Array.isArray(coursesLookupData) ? coursesLookupData : STABLE_EMPTY_ARRAY;

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleExcelUpload = async (examId: number, event: React.ChangeEvent<HTMLInputElement>) => {
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
      event.target.value = '';
    }
  };

  const handlePublishCA = async () => {
    if (!selectedCourseId || isActioningCA) return;
    if (
      confirm(
        'Are you sure you want to publish Continuous Assessment (CA) marks directly to students? You can publish updated CA marks again as new assessments are graded until final results are submitted.',
      )
    ) {
      setIsActioningCA(true);
      try {
        await apiClient.post(`/marks/courses/${selectedCourseId}/publish-ca`);
        setSuccessMsg('Continuous Assessment (CA) marks published to students!');
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
  // EVENT HANDLERS & CALCULATIONS
  // ==========================================

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleGridMarkChange = (studentId: number, examId: number, val: string) => {
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

  const handleSubmitFinal = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const exams = gridData?.exams || [];
    const weights = customConfig.weights || {};
    const contributes = customConfig.contributes || {};

    const totalAssignedWeight = exams.reduce((acc: number, e: any) => {
      const isContributing = contributes[e.exam_id] !== undefined ? !!contributes[e.exam_id] : true;
      if (!isContributing) return acc;
      return acc + (weights[e.exam_id] || 0);
    }, 0);

    if (Math.round(totalAssignedWeight) !== 100) {
      setErrorMsg(
        `Cannot submit final results until the total weight distribution equals exactly 100% (currently ${totalAssignedWeight}%). Please configure weights in Grading & Evaluation Settings.`,
      );
      return;
    }

    const payload = validateAndBuildGridPayload();
    if (!payload) return;

    if (
      confirm(
        'Are you sure you want to submit FINAL results to the Department Head? This will submit all recorded grades for verification.',
      )
    ) {
      submitGridMutation.mutate({ marks: payload, submissionType: 'FINAL' });
    }
  };

  // Student Evaluation Calculation Helper
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _calculateStudentGradeLocal = (studentId: number) => {
    if (!gridData || !gridData.exams || gridData.exams.length === 0) {
      return {
        caWeightedScore: 0,
        totalCAWeight: 0,
        finalWeightedScore: 0,
        totalFinalWeight: 0,
        totalCombinedMarks: 0,
        grade: 'N/A',
      };
    }

    const studentDraft = gridMarksDraft[studentId] || {};
    const exams = gridData.exams;

    const weights = customConfig.weights || {};
    const contributes = customConfig.contributes || {};

    let totalCAWeightedScore = 0;
    let totalCAWeight = 0;
    let totalCAMax = 0;
    let totalCAObtained = 0;

    let totalFinalWeightedScore = 0;
    let totalFinalWeight = 0;
    let totalFinalMax = 0;
    let totalFinalObtained = 0;

    exams.forEach((exam: any) => {
      const rawVal = studentDraft[exam.exam_id] || '';
      const score = rawVal !== '' ? parseFloat(rawVal) : 0;
      const isContributing =
        contributes[exam.exam_id] !== undefined ? !!contributes[exam.exam_id] : true;
      const weight = isContributing
        ? weights[exam.exam_id] !== undefined
          ? parseFloat(weights[exam.exam_id])
          : 0
        : 0;

      if (exam.exam_type.toUpperCase() === 'CA') {
        if (isContributing) {
          totalCAObtained += score;
          totalCAMax += exam.total_marks;
          totalCAWeight += weight;
          if (exam.total_marks > 0 && weight > 0) {
            totalCAWeightedScore += (score / exam.total_marks) * weight;
          }
        }
      } else {
        totalFinalObtained += score;
        totalFinalMax += exam.total_marks;
        totalFinalWeight += weight;
        if (exam.total_marks > 0 && weight > 0) {
          totalFinalWeightedScore += (score / exam.total_marks) * weight;
        }
      }
    });

    const totalCombinedMarks = parseFloat(
      (totalCAWeightedScore + totalFinalWeightedScore).toFixed(2),
    );

    const cutoffs = customConfig.cutoffs || { ca: 40, final: 35 };

    const caPercentage =
      totalCAWeight > 0
        ? (totalCAWeightedScore / totalCAWeight) * 100
        : totalCAMax > 0
          ? (totalCAObtained / totalCAMax) * 100
          : 100;

    const finalPercentage =
      totalFinalWeight > 0
        ? (totalFinalWeightedScore / totalFinalWeight) * 100
        : totalFinalMax > 0
          ? (totalFinalObtained / totalFinalMax) * 100
          : 100;

    const failedCA = totalCAWeight > 0 && caPercentage < (cutoffs.ca ?? 40);
    const failedFinal = totalFinalWeight > 0 && finalPercentage < (cutoffs.final ?? 35);

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
      const found = sortedRanges.find((r: any) => totalCombinedMarks >= r.min);
      grade = found ? found.grade : 'F';
    }

    return {
      caWeightedScore: parseFloat(totalCAWeightedScore.toFixed(2)),
      totalCAWeight: parseFloat(totalCAWeight.toFixed(1)),
      finalWeightedScore: parseFloat(totalFinalWeightedScore.toFixed(2)),
      totalFinalWeight: parseFloat(totalFinalWeight.toFixed(1)),
      totalCombinedMarks,
      grade,
    };
  };

  // Format Status Badge Helper
  const getStatusBadgeDetails = (status?: string) => {
    switch (status) {
      case 'APPROVED':
      case 'PUBLISHED':
        return {
          label: 'Results Published',
          style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        };
      case 'SUBMITTED_TO_STAFF':
      case 'RECEIVED_BY_STAFF':
        return {
          label: 'Approved by Head (Submitted to Staff)',
          style: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        };
      case 'SUBMITTED_FINAL':
      case 'SUBMITTED_PROVISIONAL':
      case 'SUBMITTED':
        return {
          label: 'Submitted to Head',
          style: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        };
      case 'REJECTED_BY_HEAD':
        return {
          label: 'Rejected by Head',
          style: 'bg-destructive/10 text-destructive border-destructive/25',
        };
      case 'REJECTED_BY_STAFF':
        return {
          label: 'Rejected by Staff',
          style: 'bg-destructive/10 text-destructive border-destructive/25',
        };
      default:
        return {
          label: 'DRAFT (UNSUBMITTED)',
          style: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Student Marks Registry</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {isLecturer
            ? 'Record student evaluation grades, configure assessment weights, and submit marksheets for head approval'
            : 'Review academic marksheets, approve compiled evaluations, and publish final student grades'}
        </p>
      </div>

      {/* Top Sub-Navigation Tabs for Lecturer View */}
      {isLecturer && (
        <div className="border-b border-border/60 flex items-center gap-8 text-sm font-bold pt-2">
          <button
            onClick={() => setLecturerTab('registry')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              lecturerTab === 'registry'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ClipboardList className="h-4.5 w-4.5" />
            Student Marks Registry
          </button>
          <button
            onClick={() => setLecturerTab('settings')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              lecturerTab === 'settings'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings className="h-4.5 w-4.5" />
            Grading & Evaluation Settings
          </button>
        </div>
      )}

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
      {/* LECTURER GRADE ENTRY PORTAL */}
      {/* ========================================================================= */}
      {isLecturer && (
        <div className="space-y-6">
          {/* Allocated Course Selection Bar with Batch & Semester Filters */}
          <div className="bg-card/30 border border-border/60 p-6 rounded-3xl backdrop-blur-md space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Select Allocated Course
              </h3>
              <p className="text-xs text-muted-foreground">
                Filter your allocated courses by Batch and Semester, then choose a course subject.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              {/* Batch Filter */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                  Batch (Academic Year):
                </label>
                <select
                  value={selectedBatchFilter}
                  onChange={(e) => setSelectedBatchFilter(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-xs font-semibold text-foreground"
                >
                  <option value="ALL">All Batches</option>
                  {availableBatches.map((b) => (
                    <option key={b} value={b} className="bg-card">
                      Batch {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester Filter */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                  Semester:
                </label>
                <select
                  value={selectedSemesterFilter}
                  onChange={(e) => setSelectedSemesterFilter(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-xs font-semibold text-foreground"
                >
                  <option value="ALL">All Semesters</option>
                  {availableSemesters.map((s) => (
                    <option key={s} value={s} className="bg-card">
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Course Selection Filter */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                  Course Subject ({filteredCourses.length}):
                </label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => {
                    setSelectedCourseId(e.target.value);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  disabled={isCoursesLoading}
                  className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-xs font-semibold text-foreground disabled:opacity-50"
                >
                  <option value="">Choose Course Subject...</option>
                  {filteredCourses.map((c: any) => (
                    <option key={c.course_id} value={c.course_id} className="bg-card">
                      {c.course_code} - {c.course_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {selectedCourseId && gridData ? (
            <div className="space-y-6 animate-fadeIn">
              {/* Rejection Notification Banner & Course Results Status Card (Only Visible in Registry Tab) */}
              {lecturerTab === 'registry' && (
                <>
                  {gridData.course?.rejection_reason && (
                    <div className="p-4 bg-destructive/10 border border-destructive/25 text-destructive rounded-2xl flex flex-col gap-1 text-sm font-semibold animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4.5 w-4.5" />
                        <span>
                          Results Rejected (
                          {getStatusBadgeDetails(gridData.course.result_submission_status).label})
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-normal mt-1">
                        Reason for rejection:{' '}
                        <strong className="text-foreground">
                          {gridData.course.rejection_reason}
                        </strong>
                        . You may modify student marks and re-submit.
                      </p>
                    </div>
                  )}

                  {/* Status & Action Control Bar */}
                  <div className="p-5 bg-secondary/15 border border-border/60 rounded-3xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Course Results Status:
                      </span>
                      {(() => {
                        const badge = getStatusBadgeDetails(
                          gridData.course?.result_submission_status,
                        );
                        return (
                          <span
                            className={`px-2.5 py-0.5 text-[10px] font-bold rounded uppercase px-3 font-bold border ${badge.style}`}
                          >
                            {badge.label}
                          </span>
                        );
                      })()}

                      {/* CA Published Badge (Hides automatically when results are published) */}
                      {gridData.course?.ca_published &&
                        !['APPROVED', 'PUBLISHED'].includes(
                          gridData.course?.result_submission_status,
                        ) && (
                          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded bg-purple-500/15 text-purple-400 border border-purple-500/25 uppercase">
                            CA Marks Published
                          </span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Revoke Submission Button */}
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              'Are you sure you want to revoke this submitted result sheet? You can make changes before Department Head approval.',
                            )
                          ) {
                            revokeCourseMutation.mutate();
                          }
                        }}
                        disabled={
                          revokeCourseMutation.isPending ||
                          !['SUBMITTED_FINAL', 'SUBMITTED_PROVISIONAL', 'SUBMITTED'].includes(
                            gridData.course?.result_submission_status,
                          )
                        }
                        className="px-4 py-2 bg-secondary text-amber-400 hover:bg-secondary/80 border border-amber-500/30 font-bold rounded-xl transition text-xs flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                      >
                        {revokeCourseMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        Revoke Submission
                      </button>

                      {/* Red-Styled Publish / Re-Publish CA Marks Button */}
                      {(!gridData.course?.result_submission_status ||
                        ['DRAFT', 'REJECTED_BY_HEAD', 'REJECTED_BY_STAFF'].includes(
                          gridData.course.result_submission_status,
                        )) && (
                        <button
                          onClick={handlePublishCA}
                          disabled={
                            isActioningCA ||
                            !(
                              Object.values(caMarksData).some(
                                (v) => typeof v === 'number' && !isNaN(v) && v > 0,
                              ) ||
                              Object.values(gridMarksDraft).some((d: any) =>
                                Object.values(d).some(
                                  (v: any) =>
                                    v !== '' && !isNaN(parseFloat(v)) && parseFloat(v) > 0,
                                ),
                              )
                            ) ||
                            (gridData.course?.ca_published && !isCaModifiedAfterPublish)
                          }
                          className="px-4 py-2 bg-secondary text-red-400 hover:bg-secondary/80 border border-red-500/30 font-bold rounded-xl transition text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-sm"
                        >
                          <Award className="h-3.5 w-3.5" />
                          {gridData.course?.ca_published
                            ? 'Re-Publish CA Marks'
                            : 'Publish CA Marks'}
                        </button>
                      )}

                      {/* Submit to 2nd Marker / Submit Final Button in Course Results Status Card */}
                      {!isSecondMarkingSubmitted ? (
                        <button
                          onClick={async () => {
                            if (
                              isFirstMarkingSubmitted ||
                              [
                                'SUBMITTED_FINAL',
                                'SUBMITTED_PROVISIONAL',
                                'SUBMITTED',
                                'APPROVED',
                                'PUBLISHED',
                              ].includes(gridData?.course?.result_submission_status)
                            )
                              return;
                            if (
                              !confirm(
                                'Are you sure you want to submit 1st marking evaluation to 2nd marker? This will lock the 1st marker sheet and send email notification with magic access link to the 2nd marker.',
                              )
                            )
                              return;
                            try {
                              setErrorMsg(null);
                              await apiClient.post(
                                `/marks/courses/${selectedCourseId}/submit-first-marking`,
                                {
                                  marks: firstMarkerMarks,
                                  config: { questions: firstMarkerQuestions },
                                },
                              );
                              setIsFirstMarkingSubmitted(true);
                              setSuccessMsg(
                                '1st marking submitted successfully! Email notification and Magic Link sent to 2nd marker.',
                              );
                              refetchGrid();
                            } catch (err: any) {
                              setErrorMsg(
                                err.response?.data?.message ||
                                  err.message ||
                                  'Failed to submit 1st marking.',
                              );
                            }
                          }}
                          disabled={
                            isFirstMarkingSubmitted ||
                            !Object.values(firstMarkerMarks).some((row: any) =>
                              Object.values(row).some(
                                (v: any) => typeof v === 'number' && !isNaN(v) && v > 0,
                              ),
                            ) ||
                            [
                              'SUBMITTED_FINAL',
                              'SUBMITTED_PROVISIONAL',
                              'SUBMITTED',
                              'APPROVED',
                              'PUBLISHED',
                            ].includes(gridData?.course?.result_submission_status)
                          }
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition text-xs flex items-center gap-1.5 shadow-md disabled:opacity-40 cursor-pointer"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {isFirstMarkingSubmitted
                            ? 'Submitted to 2nd Marker'
                            : 'Submit to 2nd Marker'}
                        </button>
                      ) : (
                        <button
                          onClick={handleSubmitFinal}
                          disabled={
                            submitGridMutation.isPending ||
                            [
                              'SUBMITTED_FINAL',
                              'SUBMITTED_PROVISIONAL',
                              'SUBMITTED',
                              'APPROVED',
                              'PUBLISHED',
                            ].includes(gridData?.course?.result_submission_status)
                          }
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition text-xs flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-md"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Submit Final
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ===================================================================== */}
              {/* STUDENT MARKS REGISTRY GRID & 4 SUBPARTS */}
              {/* ===================================================================== */}
              {lecturerTab === 'registry' && (
                <div className="bg-card/20 border border-border/60 rounded-3xl p-6 backdrop-blur-sm space-y-5 animate-fadeIn">
                  {/* Top Header & Single Line Marksheet Subpart Switcher */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/60 pb-5">
                    <div>
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        <Award className="h-5 w-5 text-primary" />
                        Student Marks Registry Grid
                        {[
                          'SUBMITTED_FINAL',
                          'SUBMITTED_PROVISIONAL',
                          'SUBMITTED',
                          'APPROVED',
                          'PUBLISHED',
                        ].includes(gridData.course?.result_submission_status) && (
                          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Grid Locked (Read-Only)
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Manage evaluations across different marksheets.
                      </p>
                    </div>

                    {/* Single-Line Subpart Navigation Bar */}
                    <div className="flex items-center gap-1.5 bg-secondary/40 p-1.5 rounded-2xl border border-border/60 overflow-x-auto whitespace-nowrap scrollbar-none flex-nowrap shrink-0">
                      <button
                        onClick={() => setGridSubpart('1st_marker')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                          gridSubpart === '1st_marker'
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        1st Marker Evaluation
                        {isFirstMarkingSubmitted && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        )}
                      </button>

                      <button
                        onClick={() => setGridSubpart('2nd_marker')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                          gridSubpart === '2nd_marker'
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        2nd Marker Evaluation
                        {isSecondMarkingSubmitted && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        )}
                      </button>

                      <button
                        onClick={() => setGridSubpart('detailed')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                          gridSubpart === 'detailed'
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Detailed Marksheet
                      </button>

                      <button
                        onClick={() => setGridSubpart('final')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                          gridSubpart === 'final'
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Final Marksheet
                        <Lock className="h-3 w-3 ml-0.5 text-amber-400" />
                      </button>
                    </div>
                  </div>

                  {/* Search Bar, Count Badge & Contextual Action Controls in One Unified Row */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3 bg-secondary/10 border border-border/40 rounded-2xl">
                    <div className="flex items-center gap-3 w-full md:w-auto flex-1">
                      {/* 1. Search Bar on Left */}
                      <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search students by Reg No or Index No..."
                          value={studentSearchQuery}
                          onChange={(e) => setStudentSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-secondary/30 border border-border/60 rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
                        />
                      </div>

                      {/* 2. Count Badge matching exact Lecturer Allocated Course Student Directory style */}
                      <div className="px-3 py-1.5 bg-background border border-border/80 rounded-xl text-xs font-mono font-bold text-foreground flex items-center gap-1.5 shrink-0">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        Showing{' '}
                        {gridData?.students
                          ? Math.min(
                              marksVisibleLimit,
                              gridData.students.filter((s: any) => {
                                if (!studentSearchQuery) return true;
                                const q = studentSearchQuery.toLowerCase();
                                return (
                                  s.registration_number?.toLowerCase().includes(q) ||
                                  s.index_number?.toLowerCase().includes(q)
                                );
                              }).length,
                            )
                          : 0}{' '}
                        of {gridData?.students?.length || 0} Records
                      </div>
                    </div>

                    {/* Dynamic Action Buttons on Right of Search Bar */}
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end shrink-0">
                      {gridSubpart === '1st_marker' && (
                        <>
                          {!isFirstMarkingSubmitted &&
                            ![
                              'SUBMITTED_FINAL',
                              'SUBMITTED_PROVISIONAL',
                              'SUBMITTED',
                              'APPROVED',
                              'PUBLISHED',
                            ].includes(gridData?.course?.result_submission_status) && (
                              <label className="px-3.5 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-bold rounded-xl transition text-xs border border-border/80 flex items-center gap-1.5 cursor-pointer">
                                <Upload className="h-3.5 w-3.5 text-primary" />
                                Upload 1st Marking Excel
                                <input
                                  type="file"
                                  accept=".xlsx, .xls, .csv"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = (evt) => {
                                      try {
                                        const bstr = evt.target?.result;
                                        const wb = XLSX.read(bstr, { type: 'binary' });
                                        const wsName = wb.SheetNames[0];
                                        const ws = wb.Sheets[wsName];
                                        const rows: any[] = XLSX.utils.sheet_to_json(ws, {
                                          header: 1,
                                        });
                                        if (!rows || rows.length < 2) return;

                                        let headerRowIdx = 0;
                                        for (let i = 0; i < Math.min(10, rows.length); i++) {
                                          const r = rows[i] || [];
                                          if (
                                            r.some(
                                              (c: any) =>
                                                String(c).toLowerCase().includes('reg') ||
                                                String(c).toLowerCase().includes('index'),
                                            )
                                          ) {
                                            headerRowIdx = i;
                                            break;
                                          }
                                        }

                                        const headers = (rows[headerRowIdx] || []).map((h: any) =>
                                          String(h || '').trim(),
                                        );
                                        const lowerHeaders = headers.map((h: string) =>
                                          h.toLowerCase(),
                                        );

                                        const regIdx = lowerHeaders.findIndex((h: string) =>
                                          h.includes('reg'),
                                        );
                                        const indexIdx = lowerHeaders.findIndex((h: string) =>
                                          h.includes('index'),
                                        );
                                        const totalIdx = lowerHeaders.findIndex(
                                          (h: string) => h === 'total' || h.includes('total'),
                                        );

                                        const qCols: {
                                          key: string;
                                          colIdx: number;
                                          name: string;
                                        }[] = [];
                                        const startIdx = indexIdx >= 0 ? indexIdx + 1 : 2;
                                        const endIdx = totalIdx >= 0 ? totalIdx : headers.length;

                                        for (let c = startIdx; c < endIdx; c++) {
                                          const hName = headers[c];
                                          if (
                                            hName &&
                                            !lowerHeaders[c].includes('proper') &&
                                            !lowerHeaders[c].includes('p/r')
                                          ) {
                                            qCols.push({ key: `q_${c}`, colIdx: c, name: hName });
                                          }
                                        }

                                        if (qCols.length > 0) {
                                          setFirstMarkerQuestions(
                                            qCols.map((q) => ({
                                              key: q.key,
                                              label: q.name,
                                              maxMarks: 20,
                                            })),
                                          );
                                        }

                                        const new1st = { ...firstMarkerMarks };
                                        const stList = gridData?.students || [];
                                        for (let i = headerRowIdx + 1; i < rows.length; i++) {
                                          const r = rows[i];
                                          if (!r || r.length === 0) continue;
                                          const rVal =
                                            regIdx >= 0 ? String(r[regIdx] || '').trim() : '';
                                          const iVal =
                                            indexIdx >= 0 ? String(r[indexIdx] || '').trim() : '';

                                          const st = stList.find((s: any) => {
                                            if (
                                              rVal &&
                                              s.registration_number?.toLowerCase() ===
                                                rVal.toLowerCase()
                                            )
                                              return true;
                                            if (
                                              iVal &&
                                              s.index_number?.toLowerCase() === iVal.toLowerCase()
                                            )
                                              return true;
                                            return false;
                                          });

                                          if (st) {
                                            new1st[st.student_id] = new1st[st.student_id] || {};
                                            qCols.forEach((q) => {
                                              new1st[st.student_id][q.key] =
                                                parseFloat(r[q.colIdx]) || 0;
                                            });
                                          }
                                        }
                                        setFirstMarkerMarks(new1st);
                                        setSuccessMsg(
                                          '1st marker evaluation sheet imported successfully from spreadsheet!',
                                        );
                                      } catch (err: any) {
                                        setErrorMsg(
                                          'Failed to parse 1st marker Excel sheet: ' + err.message,
                                        );
                                      }
                                    };
                                    reader.readAsBinaryString(file);
                                  }}
                                  className="hidden"
                                />
                              </label>
                            )}
                        </>
                      )}

                      {gridSubpart === '2nd_marker' && (
                        <>
                          {/* Save Changes button for In-Charge lecturer to save reconciliation choices */}
                          {![
                            'SUBMITTED_FINAL',
                            'SUBMITTED_PROVISIONAL',
                            'SUBMITTED',
                            'APPROVED',
                            'PUBLISHED',
                          ].includes(gridData?.course?.result_submission_status) && (
                            <button
                              onClick={async () => {
                                try {
                                  setErrorMsg(null);
                                  await apiClient.post(
                                    `/marks/second-marking/submit/${selectedCourseId}`,
                                    {
                                      marks: secondMarkerMarks,
                                      decisions: reconciliationDecisions,
                                      config: { questions: firstMarkerQuestions },
                                    },
                                  );
                                  setIsSecondMarkingSubmitted(true);
                                  setSuccessMsg(
                                    '2nd marking reconciliation changes saved successfully!',
                                  );
                                  refetchGrid();
                                } catch (err: any) {
                                  setErrorMsg(
                                    err.response?.data?.message ||
                                      err.message ||
                                      'Failed to save reconciliation changes.',
                                  );
                                }
                              }}
                              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Save Changes
                            </button>
                          )}
                        </>
                      )}

                      {gridSubpart === 'detailed' && (
                        <button
                          onClick={() => {
                            const caExams = (gridData?.exams || []).filter(
                              (e: any) => e.exam_type?.toUpperCase() === 'CA',
                            );
                            const caWeight = gridData?.course?.ca_weight || 40;
                            const saWeight = gridData?.course?.final_weight || 100 - caWeight;

                            const dataRows = (gridData.students || []).map((st: any, i: number) => {
                              const row1st = firstMarkerMarks[st.student_id] || {};
                              const row2nd = secondMarkerMarks[st.student_id] || row1st;
                              const decision = reconciliationDecisions[st.student_id] || 'MAX';
                              const caVal = caMarksData[st.student_id] || 0;

                              const caDetails: any = {};
                              if (caExams.length > 0) {
                                caExams.forEach((caExam: any) => {
                                  caDetails[caExam.exam_title || `CA_${caExam.exam_id}`] =
                                    parseFloat(gridMarksDraft[st.student_id]?.[caExam.exam_id]) ||
                                    caVal ||
                                    0;
                                });
                              } else {
                                caDetails['CA 1'] = caVal;
                              }

                              const resolvedQuestions: any = {};
                              let totalFinal = 0;
                              firstMarkerQuestions.forEach((q) => {
                                const m1 = Number(row1st[q.key]) || 0;
                                const m2 = Number(row2nd[q.key]) || 0;
                                let res = m1;
                                if (decision === 'MAX') res = Math.max(m1, m2);
                                else if (decision === 'MIN') res = Math.min(m1, m2);
                                else res = Math.round(((m1 + m2) / 2) * 10) / 10;
                                resolvedQuestions[q.label] = res;
                                totalFinal += res;
                              });

                              const totalMax = firstMarkerQuestions.reduce(
                                (sum, q) => sum + (Number(q.maxMarks) || 20),
                                0,
                              );
                              const final100 =
                                totalMax > 0
                                  ? Math.round((totalFinal / totalMax) * 100 * 10) / 10
                                  : 0;
                              const caTotalVal = Math.round((caVal / 100) * caWeight * 10) / 10;
                              const saTotalVal = Math.round((final100 / 100) * saWeight * 10) / 10;
                              const totComb = Math.round((caTotalVal + saTotalVal) * 10) / 10;

                              let grade = 'A';
                              if (totComb >= 85) grade = 'A+';
                              else if (totComb >= 80) grade = 'A';
                              else if (totComb >= 75) grade = 'A-';
                              else if (totComb >= 70) grade = 'B+';
                              else if (totComb >= 65) grade = 'B';
                              else if (totComb >= 60) grade = 'B-';
                              else if (totComb >= 55) grade = 'C+';
                              else if (totComb >= 50) grade = 'C';
                              else if (totComb >= 45) grade = 'C-';
                              else if (totComb >= 40) grade = 'D+';
                              else if (totComb >= 35) grade = 'D';
                              else grade = 'F';

                              return {
                                '#': i + 1,
                                'Registration Number': st.registration_number,
                                'Index Number': st.index_number,
                                'P/R': st.registrations?.[0]?.attempt_type === 'REPEAT' ? 'R' : 'P',
                                ...caDetails,
                                [`CA Total (${caWeight}%)`]: caTotalVal,
                                ...resolvedQuestions,
                                Total: totalFinal,
                                'Final (100)': final100,
                                [`SA Total (${saWeight}%)`]: saTotalVal,
                                'Total Combined (%)': totComb,
                                'Final Grade': grade,
                              };
                            });

                            const ws = XLSX.utils.json_to_sheet(dataRows);
                            const wb = XLSX.utils.book_new();
                            XLSX.utils.book_append_sheet(wb, ws, 'Detailed Marksheet');
                            XLSX.writeFile(
                              wb,
                              `${gridData.course?.course_code}_Detailed_Marksheet.xlsx`,
                            );
                          }}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download Detailed Marksheet
                        </button>
                      )}

                      {gridSubpart === 'final' && (
                        <button
                          onClick={() => {
                            const examsList = gridData?.exams || [];
                            const weightsMap = customConfig?.weights || {};
                            const contribsMap = customConfig?.contributes || {};

                            const totalCAWeightAllocated = examsList.reduce(
                              (acc: number, e: any) => {
                                if (e.exam_type?.toUpperCase() !== 'CA') return acc;
                                const isContrib =
                                  contribsMap[e.exam_id] !== undefined
                                    ? !!contribsMap[e.exam_id]
                                    : true;
                                if (!isContrib) return acc;
                                const w =
                                  weightsMap[e.exam_id] !== undefined
                                    ? parseFloat(weightsMap[e.exam_id])
                                    : parseFloat(e.weight) || 0;
                                return acc + (isNaN(w) ? 0 : w);
                              },
                              0,
                            );

                            const totalSAWeightAllocated = examsList.reduce(
                              (acc: number, e: any) => {
                                if (e.exam_type?.toUpperCase() === 'CA') return acc;
                                const isContrib =
                                  contribsMap[e.exam_id] !== undefined
                                    ? !!contribsMap[e.exam_id]
                                    : true;
                                if (!isContrib) return acc;
                                const w =
                                  weightsMap[e.exam_id] !== undefined
                                    ? parseFloat(weightsMap[e.exam_id])
                                    : parseFloat(e.weight) || 0;
                                return acc + (isNaN(w) ? 0 : w);
                              },
                              0,
                            );

                            const effCAWeight =
                              totalCAWeightAllocated > 0
                                ? totalCAWeightAllocated
                                : gridData?.course?.ca_weight || 40;
                            const effSAWeight =
                              totalSAWeightAllocated > 0
                                ? totalSAWeightAllocated
                                : gridData?.course?.final_weight || 100 - effCAWeight;

                            const dataRows = (gridData.students || []).map((st: any, i: number) => {
                              const row1st = firstMarkerMarks[st.student_id] || {};
                              const row2nd = secondMarkerMarks[st.student_id] || row1st;
                              const decision = reconciliationDecisions[st.student_id] || 'MAX';
                              const ca = caMarksData[st.student_id] || 0;

                              let totFinal = 0;
                              firstMarkerQuestions.forEach((q) => {
                                const m1 = Number(row1st[q.key]) || 0;
                                const m2 = Number(row2nd[q.key]) || 0;
                                let res = m1;
                                if (decision === 'MAX') res = Math.max(m1, m2);
                                else if (decision === 'MIN') res = Math.min(m1, m2);
                                else res = Math.round(((m1 + m2) / 2) * 10) / 10;
                                totFinal += res;
                              });

                              const caTot = Math.round((ca / 100) * effCAWeight * 10) / 10;
                              const totalMax = firstMarkerQuestions.reduce(
                                (sum, q) => sum + (Number(q.maxMarks) || 20),
                                0,
                              );
                              const final100 =
                                totalMax > 0
                                  ? Math.round((totFinal / totalMax) * 100 * 10) / 10
                                  : 0;
                              const saTot = Math.round((final100 / 100) * effSAWeight * 10) / 10;
                              const totComb = Math.round((caTot + saTot) * 10) / 10;

                              let grade = 'A';
                              if (totComb >= 85) grade = 'A+';
                              else if (totComb >= 80) grade = 'A';
                              else if (totComb >= 75) grade = 'A-';
                              else if (totComb >= 70) grade = 'B+';
                              else if (totComb >= 65) grade = 'B';
                              else if (totComb >= 60) grade = 'B-';
                              else if (totComb >= 55) grade = 'C+';
                              else if (totComb >= 50) grade = 'C';
                              else if (totComb >= 45) grade = 'C-';
                              else if (totComb >= 40) grade = 'D+';
                              else if (totComb >= 35) grade = 'D';
                              else grade = 'F';

                              return {
                                '#': i + 1,
                                'Registration Number': st.registration_number,
                                'Index Number': st.index_number,
                                'P/R': st.registrations?.[0]?.attempt_type === 'REPEAT' ? 'R' : 'P',
                                [`Total CA (${effCAWeight}%)`]: caTot,
                                [`Total SA (${effSAWeight}%)`]: saTot,
                                'Total Combined (%)': totComb,
                                'Final Grade': grade,
                              };
                            });

                            const ws = XLSX.utils.json_to_sheet(dataRows);
                            const wb = XLSX.utils.book_new();
                            XLSX.utils.book_append_sheet(wb, ws, 'Final Marksheet');
                            XLSX.writeFile(
                              wb,
                              `${gridData.course?.course_code}_Final_Marksheet.xlsx`,
                            );
                          }}
                          className="px-3.5 py-2 bg-primary text-primary-foreground font-bold rounded-xl transition text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download Final Marksheet
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ===================================================================== */}
                  {/* SUBPART 1: 1ST MARKER EVALUATION SHEET */}
                  {/* ===================================================================== */}
                  {gridSubpart === '1st_marker' && (
                    <div className="space-y-4 animate-fadeIn">
                      {/* 1st Marker Table */}
                      <div className="border border-border/60 rounded-2xl overflow-x-auto shadow-md">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border/60 bg-secondary/15 text-muted-foreground font-bold font-mono">
                              <th className="px-4 py-4 min-w-12 text-center border-r border-border/40">
                                #
                              </th>
                              <th className="px-6 py-4 min-w-36">Registration Number</th>
                              <th className="px-6 py-4 min-w-32 border-l border-border/40">
                                Index Number
                              </th>
                              <th className="px-4 py-4 min-w-20 text-center border-l border-border/40">
                                P/R
                              </th>

                              {firstMarkerQuestions.map((q) => (
                                <th
                                  key={q.key}
                                  className="px-4 py-4 min-w-28 text-center border-l border-border/40"
                                >
                                  {q.label}
                                  <div className="text-[10px] text-muted-foreground font-normal">
                                    Max: {q.maxMarks || 20}
                                  </div>
                                </th>
                              ))}

                              <th className="px-5 py-4 min-w-28 text-center border-l border-border/40 bg-secondary/10 font-bold text-foreground">
                                Total
                              </th>
                              <th className="px-5 py-4 min-w-32 text-center border-l border-border/40 bg-primary/10 font-extrabold text-primary">
                                Final (100)
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40 font-mono">
                            {(gridData.students || [])
                              .filter((s: any) => {
                                if (!studentSearchQuery) return true;
                                const q = studentSearchQuery.toLowerCase();
                                return (
                                  s.registration_number?.toLowerCase().includes(q) ||
                                  s.index_number?.toLowerCase().includes(q)
                                );
                              })
                              .slice(0, marksVisibleLimit)
                              .map((student: any, idx: number) => {
                                const rowMarks = firstMarkerMarks[student.student_id] || {};
                                const total = firstMarkerQuestions.reduce(
                                  (sum, q) => sum + (Number(rowMarks[q.key]) || 0),
                                  0,
                                );
                                const totalMax = firstMarkerQuestions.reduce(
                                  (sum, q) => sum + (Number(q.maxMarks) || 20),
                                  0,
                                );
                                const final100 =
                                  totalMax > 0 ? Math.round((total / totalMax) * 100 * 10) / 10 : 0;
                                const isRepeat =
                                  student.registrations?.[0]?.attempt_type === 'REPEAT';
                                const isLocked =
                                  isFirstMarkingSubmitted ||
                                  [
                                    'SUBMITTED_FINAL',
                                    'SUBMITTED_PROVISIONAL',
                                    'SUBMITTED',
                                    'APPROVED',
                                    'PUBLISHED',
                                  ].includes(gridData.course?.result_submission_status);

                                return (
                                  <tr
                                    key={student.student_id}
                                    className="hover:bg-secondary/10 transition"
                                  >
                                    <td className="px-4 py-3 text-center text-muted-foreground border-r border-border/30 font-bold">
                                      {idx + 1}
                                    </td>
                                    <td className="px-6 py-3 font-bold text-foreground">
                                      {student.registration_number}
                                    </td>
                                    <td className="px-6 py-3 border-l border-border/30 text-muted-foreground">
                                      {student.index_number}
                                    </td>
                                    <td className="px-4 py-3 border-l border-border/30 text-center">
                                      <span
                                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${isRepeat ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'}`}
                                      >
                                        {isRepeat ? 'R' : 'P'}
                                      </span>
                                    </td>

                                    {firstMarkerQuestions.map((q) => (
                                      <td
                                        key={q.key}
                                        className="px-3 py-2 border-l border-border/30 text-center"
                                      >
                                        <input
                                          type="number"
                                          min="0"
                                          max={q.maxMarks || 100}
                                          disabled={isLocked}
                                          value={rowMarks[q.key] ?? ''}
                                          onChange={(e) => {
                                            const num = Math.max(
                                              0,
                                              parseFloat(e.target.value) || 0,
                                            );
                                            setFirstMarkerMarks((prev) => ({
                                              ...prev,
                                              [student.student_id]: {
                                                ...(prev[student.student_id] || {}),
                                                [q.key]: num,
                                              },
                                            }));
                                          }}
                                          className="w-16 px-2 py-1 bg-secondary/30 border border-border/80 rounded text-center text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                                        />
                                      </td>
                                    ))}

                                    <td className="px-5 py-3 border-l border-border/30 text-center font-bold text-foreground bg-secondary/5">
                                      {total}
                                    </td>
                                    <td className="px-5 py-3 border-l border-border/30 text-center font-bold text-primary bg-primary/5">
                                      {final100}%
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ===================================================================== */}
                  {/* SUBPART 2: 2ND MARKER EVALUATION & RECONCILIATION */}
                  {/* ===================================================================== */}
                  {gridSubpart === '2nd_marker' && (
                    <div className="space-y-4 animate-fadeIn">
                      {/* 2nd Marker Table with RED Highlights for Discrepancies */}
                      <div className="border border-border/60 rounded-2xl overflow-x-auto shadow-md">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border/60 bg-secondary/15 text-muted-foreground font-bold font-mono">
                              <th className="px-4 py-4 min-w-12 text-center border-r border-border/40">
                                #
                              </th>
                              <th className="px-6 py-4 min-w-36">Registration Number</th>
                              <th className="px-6 py-4 min-w-32 border-l border-border/40">
                                Index Number
                              </th>
                              <th className="px-4 py-4 min-w-20 text-center border-l border-border/40">
                                P/R
                              </th>

                              {firstMarkerQuestions.map((q) => (
                                <th
                                  key={q.key}
                                  className="px-4 py-4 min-w-28 text-center border-l border-border/40"
                                >
                                  {q.label}
                                  <div className="text-[10px] text-muted-foreground font-normal">
                                    Max: {q.maxMarks || 20}
                                  </div>
                                </th>
                              ))}

                              <th className="px-5 py-4 min-w-28 text-center border-l border-border/40 bg-secondary/10 font-bold text-foreground">
                                Total
                              </th>
                              <th className="px-5 py-4 min-w-32 text-center border-l border-border/40 bg-primary/10 font-extrabold text-primary">
                                Final (100)
                              </th>

                              {isSecondMarkingSubmitted && (
                                <th className="px-6 py-4 min-w-64 text-center border-l border-border/40 bg-red-500/10 text-red-400 font-extrabold">
                                  In-Charge Reconciliation Decision (3 Options)
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40 font-mono">
                            {(gridData.students || [])
                              .filter((s: any) => {
                                if (!studentSearchQuery) return true;
                                const q = studentSearchQuery.toLowerCase();
                                return (
                                  s.registration_number?.toLowerCase().includes(q) ||
                                  s.index_number?.toLowerCase().includes(q)
                                );
                              })
                              .slice(0, marksVisibleLimit)
                              .map((student: any, idx: number) => {
                                const row1st = firstMarkerMarks[student.student_id] || {};
                                const row2nd = secondMarkerMarks[student.student_id] || row1st;
                                const tot1 = firstMarkerQuestions.reduce(
                                  (sum, q) => sum + (Number(row1st[q.key]) || 0),
                                  0,
                                );
                                const tot2 = firstMarkerQuestions.reduce(
                                  (sum, q) => sum + (Number(row2nd[q.key]) || 0),
                                  0,
                                );
                                const isChanged = tot1 !== tot2;
                                const chosenOpt =
                                  reconciliationDecisions[student.student_id] || 'MAX';
                                const isRepeat =
                                  student.registrations?.[0]?.attempt_type === 'REPEAT';
                                const isLocked =
                                  isSecondMarkingSubmitted ||
                                  [
                                    'SUBMITTED_FINAL',
                                    'SUBMITTED_PROVISIONAL',
                                    'SUBMITTED',
                                    'APPROVED',
                                    'PUBLISHED',
                                  ].includes(gridData.course?.result_submission_status);

                                return (
                                  <tr
                                    key={student.student_id}
                                    className={`transition ${isChanged && isSecondMarkingSubmitted ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-secondary/10'}`}
                                  >
                                    <td className="px-4 py-3 text-center text-muted-foreground border-r border-border/30 font-bold">
                                      {idx + 1}
                                    </td>
                                    <td className="px-6 py-3 font-bold text-foreground">
                                      {student.registration_number}
                                    </td>
                                    <td className="px-6 py-3 border-l border-border/30 text-muted-foreground">
                                      {student.index_number}
                                    </td>
                                    <td className="px-4 py-3 border-l border-border/30 text-center">
                                      <span
                                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${isRepeat ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'}`}
                                      >
                                        {isRepeat ? 'R' : 'P'}
                                      </span>
                                    </td>

                                    {firstMarkerQuestions.map((q) => {
                                      const cellChanged =
                                        (row1st[q.key] || 0) !== (row2nd[q.key] || 0);
                                      return (
                                        <td
                                          key={q.key}
                                          className={`px-3 py-2 border-l border-border/30 text-center ${cellChanged && isSecondMarkingSubmitted ? 'bg-red-500/15 font-bold text-red-400 border border-red-500/30' : ''}`}
                                        >
                                          <input
                                            type="number"
                                            min="0"
                                            max={q.maxMarks || 100}
                                            disabled={isLocked}
                                            value={row2nd[q.key] ?? row1st[q.key] ?? ''}
                                            onChange={(e) => {
                                              const num = Math.max(
                                                0,
                                                parseFloat(e.target.value) || 0,
                                              );
                                              setSecondMarkerMarks((prev) => ({
                                                ...prev,
                                                [student.student_id]: {
                                                  ...(prev[student.student_id] || row1st),
                                                  [q.key]: num,
                                                },
                                              }));
                                            }}
                                            className="w-16 px-2 py-1 bg-secondary/30 border border-border/80 rounded text-center text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                                          />
                                        </td>
                                      );
                                    })}

                                    <td className="px-5 py-3 border-l border-border/30 text-center font-bold text-foreground bg-secondary/5">
                                      {tot1}
                                    </td>
                                    <td
                                      className={`px-5 py-3 border-l border-border/30 text-center font-bold ${isChanged ? 'text-red-400 bg-red-500/10' : 'text-foreground bg-secondary/5'}`}
                                    >
                                      {tot2}
                                    </td>

                                    {isSecondMarkingSubmitted && (
                                      <td className="px-4 py-3 border-l border-border/30 text-center bg-secondary/5">
                                        {isChanged ? (
                                          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold">
                                            <button
                                              onClick={() =>
                                                ![
                                                  'SUBMITTED_FINAL',
                                                  'SUBMITTED_PROVISIONAL',
                                                  'SUBMITTED',
                                                  'APPROVED',
                                                  'PUBLISHED',
                                                ].includes(
                                                  gridData.course?.result_submission_status,
                                                ) &&
                                                setReconciliationDecisions((prev) => ({
                                                  ...prev,
                                                  [student.student_id]: 'MAX',
                                                }))
                                              }
                                              disabled={[
                                                'SUBMITTED_FINAL',
                                                'SUBMITTED_PROVISIONAL',
                                                'SUBMITTED',
                                                'APPROVED',
                                                'PUBLISHED',
                                              ].includes(gridData.course?.result_submission_status)}
                                              className={`px-2 py-1 rounded-lg border transition cursor-pointer ${chosenOpt === 'MAX' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm' : 'bg-secondary text-muted-foreground border-border/60 hover:text-foreground'}`}
                                            >
                                              Max ({Math.max(tot1, tot2)})
                                            </button>
                                            <button
                                              onClick={() =>
                                                ![
                                                  'SUBMITTED_FINAL',
                                                  'SUBMITTED_PROVISIONAL',
                                                  'SUBMITTED',
                                                  'APPROVED',
                                                  'PUBLISHED',
                                                ].includes(
                                                  gridData.course?.result_submission_status,
                                                ) &&
                                                setReconciliationDecisions((prev) => ({
                                                  ...prev,
                                                  [student.student_id]: 'MIN',
                                                }))
                                              }
                                              disabled={[
                                                'SUBMITTED_FINAL',
                                                'SUBMITTED_PROVISIONAL',
                                                'SUBMITTED',
                                                'APPROVED',
                                                'PUBLISHED',
                                              ].includes(gridData.course?.result_submission_status)}
                                              className={`px-2 py-1 rounded-lg border transition cursor-pointer ${chosenOpt === 'MIN' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-sm' : 'bg-secondary text-muted-foreground border-border/60 hover:text-foreground'}`}
                                            >
                                              Min ({Math.min(tot1, tot2)})
                                            </button>
                                            <button
                                              onClick={() =>
                                                ![
                                                  'SUBMITTED_FINAL',
                                                  'SUBMITTED_PROVISIONAL',
                                                  'SUBMITTED',
                                                  'APPROVED',
                                                  'PUBLISHED',
                                                ].includes(
                                                  gridData.course?.result_submission_status,
                                                ) &&
                                                setReconciliationDecisions((prev) => ({
                                                  ...prev,
                                                  [student.student_id]: 'AVG',
                                                }))
                                              }
                                              disabled={[
                                                'SUBMITTED_FINAL',
                                                'SUBMITTED_PROVISIONAL',
                                                'SUBMITTED',
                                                'APPROVED',
                                                'PUBLISHED',
                                              ].includes(gridData.course?.result_submission_status)}
                                              className={`px-2 py-1 rounded-lg border transition cursor-pointer ${chosenOpt === 'AVG' ? 'bg-purple-500/20 text-purple-400 border-purple-500/40 shadow-sm' : 'bg-secondary text-muted-foreground border-border/60 hover:text-foreground'}`}
                                            >
                                              Avg ({Math.round(((tot1 + tot2) / 2) * 10) / 10})
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="text-muted-foreground text-[10px] font-normal">
                                            Marks match (No discrepancy)
                                          </span>
                                        )}
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ===================================================================== */}
                  {/* SUBPART 3: DETAILED MARKSHEET */}
                  {/* ===================================================================== */}
                  {gridSubpart === 'detailed' && (
                    <div className="space-y-4 animate-fadeIn">
                      {/* Detailed Marksheet Table */}
                      <div className="border border-border/60 rounded-2xl overflow-x-auto shadow-md">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border/60 bg-secondary/15 text-muted-foreground font-bold font-mono">
                              <th className="px-4 py-4 min-w-12 text-center border-r border-border/40">
                                #
                              </th>
                              <th className="px-6 py-4 min-w-36">Registration Number</th>
                              <th className="px-6 py-4 min-w-32 border-l border-border/40">
                                Index Number
                              </th>
                              <th className="px-4 py-4 min-w-20 text-center border-l border-border/40">
                                P/R
                              </th>

                              {/* Display Each Added CA Assessment Column with Per-CA Excel Upload Feature */}
                              {(gridData?.exams || []).filter(
                                (e: any) => e.exam_type?.toUpperCase() === 'CA',
                              ).length > 0 ? (
                                (gridData?.exams || [])
                                  .filter((e: any) => e.exam_type?.toUpperCase() === 'CA')
                                  .map((caExam: any) => (
                                    <th
                                      key={caExam.exam_id}
                                      className="px-4 py-3 min-w-36 text-center border-l border-border/40 bg-secondary/10 font-bold text-foreground"
                                    >
                                      <div className="flex flex-col items-center gap-1.5">
                                        <span>
                                          {caExam.exam_title || `CA (${caExam.weight || 40}%)`}
                                        </span>
                                        {![
                                          'SUBMITTED_FINAL',
                                          'SUBMITTED_PROVISIONAL',
                                          'SUBMITTED',
                                          'APPROVED',
                                          'PUBLISHED',
                                        ].includes(gridData?.course?.result_submission_status) && (
                                          <label className="px-2 py-0.5 bg-secondary hover:bg-secondary/80 text-primary border border-border/60 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer">
                                            <Upload className="h-2.5 w-2.5" />
                                            Upload Excel
                                            <input
                                              type="file"
                                              accept=".xlsx, .xls, .csv"
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const reader = new FileReader();
                                                reader.onload = (evt) => {
                                                  try {
                                                    const bstr = evt.target?.result;
                                                    const wb = XLSX.read(bstr, { type: 'binary' });
                                                    const wsName = wb.SheetNames[0];
                                                    const ws = wb.Sheets[wsName];
                                                    const rows: any[] = XLSX.utils.sheet_to_json(
                                                      ws,
                                                      { header: 1 },
                                                    );
                                                    if (!rows || rows.length < 2) return;

                                                    let headerRowIdx = 0;
                                                    for (
                                                      let i = 0;
                                                      i < Math.min(10, rows.length);
                                                      i++
                                                    ) {
                                                      const r = rows[i] || [];
                                                      if (
                                                        r.some(
                                                          (c: any) =>
                                                            String(c)
                                                              .toLowerCase()
                                                              .includes('reg') ||
                                                            String(c)
                                                              .toLowerCase()
                                                              .includes('index'),
                                                        )
                                                      ) {
                                                        headerRowIdx = i;
                                                        break;
                                                      }
                                                    }

                                                    const headers = (rows[headerRowIdx] || []).map(
                                                      (h: any) => String(h || '').trim(),
                                                    );
                                                    const lowerHeaders = headers.map((h: string) =>
                                                      h.toLowerCase(),
                                                    );

                                                    const regIdx = lowerHeaders.findIndex(
                                                      (h: string) => h.includes('reg'),
                                                    );
                                                    const indexIdx = lowerHeaders.findIndex(
                                                      (h: string) => h.includes('index'),
                                                    );
                                                    const caIdx = lowerHeaders.findIndex(
                                                      (h: string) =>
                                                        h.includes('mark') ||
                                                        h.includes('total') ||
                                                        h.includes('ca') ||
                                                        h.includes('score'),
                                                    );

                                                    const newDraft = { ...gridMarksDraft };
                                                    const newCaData = { ...caMarksData };
                                                    const stList = gridData?.students || [];

                                                    for (
                                                      let i = headerRowIdx + 1;
                                                      i < rows.length;
                                                      i++
                                                    ) {
                                                      const r = rows[i];
                                                      if (!r || r.length === 0) continue;
                                                      const rVal =
                                                        regIdx >= 0
                                                          ? String(r[regIdx] || '').trim()
                                                          : '';
                                                      const iVal =
                                                        indexIdx >= 0
                                                          ? String(r[indexIdx] || '').trim()
                                                          : '';

                                                      const st = stList.find((s: any) => {
                                                        if (
                                                          rVal &&
                                                          s.registration_number?.toLowerCase() ===
                                                            rVal.toLowerCase()
                                                        )
                                                          return true;
                                                        if (
                                                          iVal &&
                                                          s.index_number?.toLowerCase() ===
                                                            iVal.toLowerCase()
                                                        )
                                                          return true;
                                                        return false;
                                                      });

                                                      if (st && caIdx >= 0) {
                                                        const val = parseFloat(r[caIdx]) || 0;
                                                        newDraft[st.student_id] =
                                                          newDraft[st.student_id] || {};
                                                        newDraft[st.student_id][caExam.exam_id] =
                                                          val.toString();
                                                        newCaData[st.student_id] = val;
                                                      }
                                                    }
                                                    setGridMarksDraft(newDraft);
                                                    setCaMarksData(newCaData);
                                                    setSuccessMsg(
                                                      `Marks imported for ${caExam.exam_title || 'CA Component'}!`,
                                                    );
                                                  } catch (err: any) {
                                                    setErrorMsg(
                                                      'Failed to parse CA Excel sheet: ' +
                                                        err.message,
                                                    );
                                                  }
                                                };
                                                reader.readAsBinaryString(file);
                                              }}
                                              className="hidden"
                                            />
                                          </label>
                                        )}
                                      </div>
                                    </th>
                                  ))
                              ) : (
                                <th className="px-4 py-3 min-w-36 text-center border-l border-border/40 bg-secondary/10 font-bold text-foreground">
                                  <div className="flex flex-col items-center gap-1.5">
                                    <span>CA 1</span>
                                    {![
                                      'SUBMITTED_FINAL',
                                      'SUBMITTED_PROVISIONAL',
                                      'SUBMITTED',
                                      'APPROVED',
                                      'PUBLISHED',
                                    ].includes(gridData?.course?.result_submission_status) && (
                                      <label className="px-2 py-0.5 bg-secondary hover:bg-secondary/80 text-primary border border-border/60 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer">
                                        <Upload className="h-2.5 w-2.5" />
                                        Upload Excel
                                        <input
                                          type="file"
                                          accept=".xlsx, .xls, .csv"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const reader = new FileReader();
                                            reader.onload = (evt) => {
                                              try {
                                                const bstr = evt.target?.result;
                                                const wb = XLSX.read(bstr, { type: 'binary' });
                                                const wsName = wb.SheetNames[0];
                                                const ws = wb.Sheets[wsName];
                                                const rows: any[] = XLSX.utils.sheet_to_json(ws, {
                                                  header: 1,
                                                });
                                                if (!rows || rows.length < 2) return;

                                                let headerRowIdx = 0;
                                                for (
                                                  let i = 0;
                                                  i < Math.min(10, rows.length);
                                                  i++
                                                ) {
                                                  const r = rows[i] || [];
                                                  if (
                                                    r.some(
                                                      (c: any) =>
                                                        String(c).toLowerCase().includes('reg') ||
                                                        String(c).toLowerCase().includes('index'),
                                                    )
                                                  ) {
                                                    headerRowIdx = i;
                                                    break;
                                                  }
                                                }

                                                const headers = (rows[headerRowIdx] || []).map(
                                                  (h: any) => String(h || '').trim(),
                                                );
                                                const lowerHeaders = headers.map((h: string) =>
                                                  h.toLowerCase(),
                                                );

                                                const regIdx = lowerHeaders.findIndex((h: string) =>
                                                  h.includes('reg'),
                                                );
                                                const indexIdx = lowerHeaders.findIndex(
                                                  (h: string) => h.includes('index'),
                                                );
                                                const caIdx = lowerHeaders.findIndex(
                                                  (h: string) =>
                                                    h.includes('mark') ||
                                                    h.includes('total') ||
                                                    h.includes('ca') ||
                                                    h.includes('score'),
                                                );

                                                const newCaData = { ...caMarksData };
                                                const stList = gridData?.students || [];

                                                for (
                                                  let i = headerRowIdx + 1;
                                                  i < rows.length;
                                                  i++
                                                ) {
                                                  const r = rows[i];
                                                  if (!r || r.length === 0) continue;
                                                  const rVal =
                                                    regIdx >= 0
                                                      ? String(r[regIdx] || '').trim()
                                                      : '';
                                                  const iVal =
                                                    indexIdx >= 0
                                                      ? String(r[indexIdx] || '').trim()
                                                      : '';

                                                  const st = stList.find((s: any) => {
                                                    if (
                                                      rVal &&
                                                      s.registration_number?.toLowerCase() ===
                                                        rVal.toLowerCase()
                                                    )
                                                      return true;
                                                    if (
                                                      iVal &&
                                                      s.index_number?.toLowerCase() ===
                                                        iVal.toLowerCase()
                                                    )
                                                      return true;
                                                    return false;
                                                  });

                                                  if (st && caIdx >= 0) {
                                                    newCaData[st.student_id] =
                                                      parseFloat(r[caIdx]) || 0;
                                                  }
                                                }
                                                setCaMarksData(newCaData);
                                                setSuccessMsg('CA 1 marks imported successfully!');
                                              } catch (err: any) {
                                                setErrorMsg(
                                                  'Failed to parse CA Excel sheet: ' + err.message,
                                                );
                                              }
                                            };
                                            reader.readAsBinaryString(file);
                                          }}
                                          className="hidden"
                                        />
                                      </label>
                                    )}
                                  </div>
                                </th>
                              )}

                              {(() => {
                                const examsList = gridData?.exams || [];
                                const weightsMap = customConfig?.weights || {};
                                const contribsMap = customConfig?.contributes || {};

                                const totalCAWeightAllocated = examsList.reduce(
                                  (acc: number, e: any) => {
                                    if (e.exam_type?.toUpperCase() !== 'CA') return acc;
                                    const isContrib =
                                      contribsMap[e.exam_id] !== undefined
                                        ? !!contribsMap[e.exam_id]
                                        : true;
                                    if (!isContrib) return acc;
                                    const w =
                                      weightsMap[e.exam_id] !== undefined
                                        ? parseFloat(weightsMap[e.exam_id])
                                        : parseFloat(e.weight) || 0;
                                    return acc + (isNaN(w) ? 0 : w);
                                  },
                                  0,
                                );

                                const totalSAWeightAllocated = examsList.reduce(
                                  (acc: number, e: any) => {
                                    if (e.exam_type?.toUpperCase() === 'CA') return acc;
                                    const isContrib =
                                      contribsMap[e.exam_id] !== undefined
                                        ? !!contribsMap[e.exam_id]
                                        : true;
                                    if (!isContrib) return acc;
                                    const w =
                                      weightsMap[e.exam_id] !== undefined
                                        ? parseFloat(weightsMap[e.exam_id])
                                        : parseFloat(e.weight) || 0;
                                    return acc + (isNaN(w) ? 0 : w);
                                  },
                                  0,
                                );

                                const effectiveCAWeight =
                                  totalCAWeightAllocated > 0
                                    ? totalCAWeightAllocated
                                    : gridData?.course?.ca_weight || 40;
                                const effectiveSAWeight =
                                  totalSAWeightAllocated > 0
                                    ? totalSAWeightAllocated
                                    : gridData?.course?.final_weight || 100 - effectiveCAWeight;

                                return (
                                  <>
                                    <th className="px-5 py-4 min-w-32 text-center border-l border-border/40 bg-secondary/15 font-bold text-foreground">
                                      CA Total ({effectiveCAWeight}%)
                                    </th>

                                    {firstMarkerQuestions.map((q) => (
                                      <th
                                        key={q.key}
                                        className="px-4 py-4 min-w-28 text-center border-l border-border/40"
                                      >
                                        {q.label}
                                      </th>
                                    ))}

                                    <th className="px-5 py-4 min-w-28 text-center border-l border-border/40 bg-secondary/10 font-bold text-foreground">
                                      Total
                                    </th>
                                    <th className="px-5 py-4 min-w-32 text-center border-l border-border/40 bg-secondary/10 font-bold text-foreground">
                                      Final (100)
                                    </th>
                                    <th className="px-5 py-4 min-w-32 text-center border-l border-border/40 bg-secondary/15 font-bold text-foreground">
                                      SA Total ({effectiveSAWeight}%)
                                    </th>
                                  </>
                                );
                              })()}
                              <th className="px-5 py-4 min-w-36 text-center border-l border-border/40 bg-primary/10 font-extrabold text-primary">
                                Total Combined (%)
                              </th>
                              <th className="px-6 py-4 min-w-28 text-center border-l border-border/40 bg-secondary/10 font-extrabold text-foreground">
                                Final Grade
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40 font-mono">
                            {(gridData.students || [])
                              .filter((s: any) => {
                                if (!studentSearchQuery) return true;
                                const q = studentSearchQuery.toLowerCase();
                                return (
                                  s.registration_number?.toLowerCase().includes(q) ||
                                  s.index_number?.toLowerCase().includes(q)
                                );
                              })
                              .slice(0, marksVisibleLimit)
                              .map((student: any, idx: number) => {
                                const row1st = firstMarkerMarks[student.student_id] || {};
                                const row2nd = secondMarkerMarks[student.student_id] || row1st;
                                const decision =
                                  reconciliationDecisions[student.student_id] || 'MAX';
                                const caVal = caMarksData[student.student_id] || 0;
                                const caExams = (gridData?.exams || []).filter(
                                  (e: any) => e.exam_type?.toUpperCase() === 'CA',
                                );
                                const isGridLocked = [
                                  'SUBMITTED_FINAL',
                                  'SUBMITTED_PROVISIONAL',
                                  'SUBMITTED',
                                  'APPROVED',
                                  'PUBLISHED',
                                ].includes(gridData.course?.result_submission_status);
                                const examsList = gridData?.exams || [];
                                const weightsMap = customConfig?.weights || {};
                                const contribsMap = customConfig?.contributes || {};

                                const totalCAWeightAllocated = examsList.reduce(
                                  (acc: number, e: any) => {
                                    if (e.exam_type?.toUpperCase() !== 'CA') return acc;
                                    const isContrib =
                                      contribsMap[e.exam_id] !== undefined
                                        ? !!contribsMap[e.exam_id]
                                        : true;
                                    if (!isContrib) return acc;
                                    const w =
                                      weightsMap[e.exam_id] !== undefined
                                        ? parseFloat(weightsMap[e.exam_id])
                                        : parseFloat(e.weight) || 0;
                                    return acc + (isNaN(w) ? 0 : w);
                                  },
                                  0,
                                );

                                const totalSAWeightAllocated = examsList.reduce(
                                  (acc: number, e: any) => {
                                    if (e.exam_type?.toUpperCase() === 'CA') return acc;
                                    const isContrib =
                                      contribsMap[e.exam_id] !== undefined
                                        ? !!contribsMap[e.exam_id]
                                        : true;
                                    if (!isContrib) return acc;
                                    const w =
                                      weightsMap[e.exam_id] !== undefined
                                        ? parseFloat(weightsMap[e.exam_id])
                                        : parseFloat(e.weight) || 0;
                                    return acc + (isNaN(w) ? 0 : w);
                                  },
                                  0,
                                );

                                const caWeight =
                                  totalCAWeightAllocated > 0
                                    ? totalCAWeightAllocated
                                    : gridData?.course?.ca_weight || 40;
                                const saWeight =
                                  totalSAWeightAllocated > 0
                                    ? totalSAWeightAllocated
                                    : gridData?.course?.final_weight || 100 - caWeight;

                                let totalFinal = 0;
                                const qVals: { [key: string]: number } = {};
                                firstMarkerQuestions.forEach((q) => {
                                  const m1 = Number(row1st[q.key]) || 0;
                                  const m2 = Number(row2nd[q.key]) || 0;
                                  let res = m1;
                                  if (decision === 'MAX') res = Math.max(m1, m2);
                                  else if (decision === 'MIN') res = Math.min(m1, m2);
                                  else res = Math.round(((m1 + m2) / 2) * 10) / 10;
                                  qVals[q.key] = res;
                                  totalFinal += res;
                                });

                                const totalMax = firstMarkerQuestions.reduce(
                                  (sum, q) => sum + (Number(q.maxMarks) || 20),
                                  0,
                                );
                                const final100 =
                                  totalMax > 0
                                    ? Math.round((totalFinal / totalMax) * 100 * 10) / 10
                                    : 0;
                                const caTotalVal = Math.round((caVal / 100) * caWeight * 10) / 10;
                                const saTotalVal =
                                  Math.round((final100 / 100) * saWeight * 10) / 10;
                                const combined = Math.round((caTotalVal + saTotalVal) * 10) / 10;

                                let grade = 'A';
                                if (combined >= 85) grade = 'A+';
                                else if (combined >= 80) grade = 'A';
                                else if (combined >= 75) grade = 'A-';
                                else if (combined >= 70) grade = 'B+';
                                else if (combined >= 65) grade = 'B';
                                else if (combined >= 60) grade = 'B-';
                                else if (combined >= 55) grade = 'C+';
                                else if (combined >= 50) grade = 'C';
                                else if (combined >= 45) grade = 'C-';
                                else if (combined >= 40) grade = 'D+';
                                else if (combined >= 35) grade = 'D';
                                else grade = 'F';

                                const isRepeat =
                                  student.registrations?.[0]?.attempt_type === 'REPEAT';

                                return (
                                  <tr
                                    key={student.student_id}
                                    className="hover:bg-secondary/10 transition"
                                  >
                                    <td className="px-4 py-3 text-center text-muted-foreground border-r border-border/30 font-bold">
                                      {idx + 1}
                                    </td>
                                    <td className="px-6 py-3 font-bold text-foreground">
                                      {student.registration_number}
                                    </td>
                                    <td className="px-6 py-3 border-l border-border/30 text-muted-foreground">
                                      {student.index_number}
                                    </td>
                                    <td className="px-4 py-3 border-l border-border/30 text-center">
                                      <span
                                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${isRepeat ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'}`}
                                      >
                                        {isRepeat ? 'R' : 'P'}
                                      </span>
                                    </td>

                                    {/* Render CA Exam Input cells for each added CA */}
                                    {caExams.length > 0 ? (
                                      caExams.map((caExam: any) => (
                                        <td
                                          key={caExam.exam_id}
                                          className="px-3 py-2 border-l border-border/30 text-center"
                                        >
                                          <input
                                            type="number"
                                            min="0"
                                            max={caExam.total_marks || 100}
                                            disabled={isGridLocked}
                                            value={
                                              gridMarksDraft[student.student_id]?.[
                                                caExam.exam_id
                                              ] ??
                                              caVal ??
                                              ''
                                            }
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value) || 0;
                                              setGridMarksDraft((prev) => ({
                                                ...prev,
                                                [student.student_id]: {
                                                  ...(prev[student.student_id] || {}),
                                                  [caExam.exam_id]: val.toString(),
                                                },
                                              }));
                                              setCaMarksData((prev) => ({
                                                ...prev,
                                                [student.student_id]: val,
                                              }));
                                            }}
                                            className="w-16 px-2 py-1 bg-secondary/30 border border-border/80 rounded text-center text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                                          />
                                        </td>
                                      ))
                                    ) : (
                                      <td className="px-3 py-2 border-l border-border/30 text-center">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          disabled={isGridLocked}
                                          value={caVal || ''}
                                          onChange={(e) =>
                                            setCaMarksData((prev) => ({
                                              ...prev,
                                              [student.student_id]: parseFloat(e.target.value) || 0,
                                            }))
                                          }
                                          className="w-16 px-2 py-1 bg-secondary/30 border border-border/80 rounded text-center text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                                        />
                                      </td>
                                    )}

                                    {/* CA Total (%) */}
                                    <td className="px-5 py-3 border-l border-border/30 text-center font-bold text-foreground bg-secondary/5">
                                      {caTotalVal}%
                                    </td>

                                    {/* Question Numbers */}
                                    {firstMarkerQuestions.map((q) => (
                                      <td
                                        key={q.key}
                                        className="px-4 py-3 border-l border-border/30 text-center font-bold text-foreground"
                                      >
                                        {qVals[q.key]}
                                      </td>
                                    ))}

                                    {/* Total */}
                                    <td className="px-5 py-3 border-l border-border/30 text-center font-bold text-foreground bg-secondary/5">
                                      {totalFinal}
                                    </td>

                                    {/* Final (100) */}
                                    <td className="px-5 py-3 border-l border-border/30 text-center font-bold text-foreground bg-secondary/5">
                                      {final100}%
                                    </td>

                                    {/* SA Total (%) */}
                                    <td className="px-5 py-3 border-l border-border/30 text-center font-bold text-foreground bg-secondary/5">
                                      {saTotalVal}%
                                    </td>

                                    {/* Total Combined (%) */}
                                    <td className="px-5 py-3 border-l border-border/30 text-center font-bold text-primary bg-primary/5">
                                      {combined}%
                                    </td>

                                    {/* Final Grade */}
                                    <td className="px-6 py-3 border-l border-border/30 text-center font-extrabold">
                                      <span
                                        className={`px-2.5 py-0.5 font-bold rounded text-xs ${grade === 'F' ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-400'}`}
                                      >
                                        {grade}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ===================================================================== */}
                  {/* SUBPART 4: FINAL MARKSHEET (READ-ONLY) */}
                  {/* ===================================================================== */}
                  {gridSubpart === 'final' && (
                    <div className="space-y-4 animate-fadeIn">
                      {/* Read-Only Final Marksheet Table */}
                      <div className="border border-border/60 rounded-2xl overflow-x-auto shadow-md">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border/60 bg-secondary/15 text-muted-foreground font-bold font-mono">
                              <th className="px-4 py-4 min-w-12 text-center border-r border-border/40">
                                #
                              </th>
                              <th className="px-6 py-4 min-w-36">Registration Number</th>
                              <th className="px-6 py-4 min-w-32 border-l border-border/40">
                                Index Number
                              </th>
                              <th className="px-4 py-4 min-w-20 text-center border-l border-border/40">
                                P/R
                              </th>
                              {(() => {
                                const examsList = gridData?.exams || [];
                                const weightsMap = customConfig?.weights || {};
                                const contribsMap = customConfig?.contributes || {};

                                const totalCAWeightAllocated = examsList.reduce(
                                  (acc: number, e: any) => {
                                    if (e.exam_type?.toUpperCase() !== 'CA') return acc;
                                    const isContrib =
                                      contribsMap[e.exam_id] !== undefined
                                        ? !!contribsMap[e.exam_id]
                                        : true;
                                    if (!isContrib) return acc;
                                    const w =
                                      weightsMap[e.exam_id] !== undefined
                                        ? parseFloat(weightsMap[e.exam_id])
                                        : parseFloat(e.weight) || 0;
                                    return acc + (isNaN(w) ? 0 : w);
                                  },
                                  0,
                                );

                                const totalSAWeightAllocated = examsList.reduce(
                                  (acc: number, e: any) => {
                                    if (e.exam_type?.toUpperCase() === 'CA') return acc;
                                    const isContrib =
                                      contribsMap[e.exam_id] !== undefined
                                        ? !!contribsMap[e.exam_id]
                                        : true;
                                    if (!isContrib) return acc;
                                    const w =
                                      weightsMap[e.exam_id] !== undefined
                                        ? parseFloat(weightsMap[e.exam_id])
                                        : parseFloat(e.weight) || 0;
                                    return acc + (isNaN(w) ? 0 : w);
                                  },
                                  0,
                                );

                                const effCAWeight =
                                  totalCAWeightAllocated > 0
                                    ? totalCAWeightAllocated
                                    : gridData?.course?.ca_weight || 40;
                                const effSAWeight =
                                  totalSAWeightAllocated > 0
                                    ? totalSAWeightAllocated
                                    : gridData?.course?.final_weight || 100 - effCAWeight;

                                return (
                                  <>
                                    <th className="px-5 py-4 min-w-32 text-center border-l border-border/40 bg-secondary/10 font-bold text-foreground">
                                      Total CA ({effCAWeight}%)
                                    </th>
                                    <th className="px-5 py-4 min-w-32 text-center border-l border-border/40 bg-secondary/10 font-bold text-foreground">
                                      Total SA ({effSAWeight}%)
                                    </th>
                                  </>
                                );
                              })()}
                              <th className="px-5 py-4 min-w-36 text-center border-l border-border/40 bg-primary/10 font-extrabold text-primary">
                                Total Combined (%)
                              </th>
                              <th className="px-6 py-4 min-w-28 text-center border-l border-border/40 bg-secondary/10 font-extrabold text-foreground">
                                Final Grade
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40 font-mono">
                            {(gridData.students || [])
                              .filter((s: any) => {
                                if (!studentSearchQuery) return true;
                                const q = studentSearchQuery.toLowerCase();
                                return (
                                  s.registration_number?.toLowerCase().includes(q) ||
                                  s.index_number?.toLowerCase().includes(q)
                                );
                              })
                              .slice(0, marksVisibleLimit)
                              .map((student: any, idx: number) => {
                                const row1st = firstMarkerMarks[student.student_id] || {};
                                const row2nd = secondMarkerMarks[student.student_id] || row1st;
                                const decision =
                                  reconciliationDecisions[student.student_id] || 'MAX';
                                const caVal = caMarksData[student.student_id] || 0;

                                let totalFinal = 0;
                                firstMarkerQuestions.forEach((q) => {
                                  const m1 = Number(row1st[q.key]) || 0;
                                  const m2 = Number(row2nd[q.key]) || 0;
                                  let res = m1;
                                  if (decision === 'MAX') res = Math.max(m1, m2);
                                  else if (decision === 'MIN') res = Math.min(m1, m2);
                                  else res = Math.round(((m1 + m2) / 2) * 10) / 10;
                                  totalFinal += res;
                                });

                                const examsList = gridData?.exams || [];
                                const weightsMap = customConfig?.weights || {};
                                const contribsMap = customConfig?.contributes || {};

                                const totalCAWeightAllocated = examsList.reduce(
                                  (acc: number, e: any) => {
                                    if (e.exam_type?.toUpperCase() !== 'CA') return acc;
                                    const isContrib =
                                      contribsMap[e.exam_id] !== undefined
                                        ? !!contribsMap[e.exam_id]
                                        : true;
                                    if (!isContrib) return acc;
                                    const w =
                                      weightsMap[e.exam_id] !== undefined
                                        ? parseFloat(weightsMap[e.exam_id])
                                        : parseFloat(e.weight) || 0;
                                    return acc + (isNaN(w) ? 0 : w);
                                  },
                                  0,
                                );

                                const totalSAWeightAllocated = examsList.reduce(
                                  (acc: number, e: any) => {
                                    if (e.exam_type?.toUpperCase() === 'CA') return acc;
                                    const isContrib =
                                      contribsMap[e.exam_id] !== undefined
                                        ? !!contribsMap[e.exam_id]
                                        : true;
                                    if (!isContrib) return acc;
                                    const w =
                                      weightsMap[e.exam_id] !== undefined
                                        ? parseFloat(weightsMap[e.exam_id])
                                        : parseFloat(e.weight) || 0;
                                    return acc + (isNaN(w) ? 0 : w);
                                  },
                                  0,
                                );

                                const effCAWeight =
                                  totalCAWeightAllocated > 0
                                    ? totalCAWeightAllocated
                                    : gridData?.course?.ca_weight || 40;
                                const effSAWeight =
                                  totalSAWeightAllocated > 0
                                    ? totalSAWeightAllocated
                                    : gridData?.course?.final_weight || 100 - effCAWeight;

                                const caTotalVal =
                                  Math.round((caVal / 100) * effCAWeight * 10) / 10;
                                const totalMax = firstMarkerQuestions.reduce(
                                  (sum, q) => sum + (Number(q.maxMarks) || 20),
                                  0,
                                );
                                const final100 =
                                  totalMax > 0
                                    ? Math.round((totalFinal / totalMax) * 100 * 10) / 10
                                    : 0;
                                const saTotalVal =
                                  Math.round((final100 / 100) * effSAWeight * 10) / 10;
                                const combined = Math.round((caTotalVal + saTotalVal) * 10) / 10;

                                let grade = 'A';
                                if (combined >= 85) grade = 'A+';
                                else if (combined >= 80) grade = 'A';
                                else if (combined >= 75) grade = 'A-';
                                else if (combined >= 70) grade = 'B+';
                                else if (combined >= 65) grade = 'B';
                                else if (combined >= 60) grade = 'B-';
                                else if (combined >= 55) grade = 'C+';
                                else if (combined >= 50) grade = 'C';
                                else if (combined >= 45) grade = 'C-';
                                else if (combined >= 40) grade = 'D+';
                                else if (combined >= 35) grade = 'D';
                                else grade = 'F';

                                const isRepeat =
                                  student.registrations?.[0]?.attempt_type === 'REPEAT';

                                return (
                                  <tr
                                    key={student.student_id}
                                    className="hover:bg-secondary/10 transition"
                                  >
                                    <td className="px-4 py-3 text-center text-muted-foreground border-r border-border/30 font-bold">
                                      {idx + 1}
                                    </td>
                                    <td className="px-6 py-3 font-bold text-foreground">
                                      {student.registration_number}
                                    </td>
                                    <td className="px-6 py-3 border-l border-border/30 text-muted-foreground">
                                      {student.index_number}
                                    </td>
                                    <td className="px-4 py-3 border-l border-border/30 text-center">
                                      <span
                                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${isRepeat ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'}`}
                                      >
                                        {isRepeat ? 'R' : 'P'}
                                      </span>
                                    </td>

                                    <td className="px-5 py-3 border-l border-border/30 text-center font-bold text-foreground">
                                      {caTotalVal}%
                                    </td>
                                    <td className="px-5 py-3 border-l border-border/30 text-center font-bold text-foreground">
                                      {saTotalVal}%
                                    </td>
                                    <td className="px-5 py-3 border-l border-border/30 text-center font-bold text-primary bg-primary/5">
                                      {combined}%
                                    </td>
                                    <td className="px-6 py-3 border-l border-border/30 text-center font-extrabold">
                                      <span
                                        className={`px-2.5 py-0.5 font-bold rounded text-xs ${grade === 'F' ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-400'}`}
                                      >
                                        {grade}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===================================================================== */}
              {/* SUB-PAGE 2: GRADING & EVALUATION SETTINGS */}
              {/* ===================================================================== */}
              {lecturerTab === 'settings' && (
                <div className="bg-card/25 border border-border/80 rounded-3xl p-6 backdrop-blur-md space-y-6 animate-fadeIn">
                  <div className="border-b border-border/60 pb-3">
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <Settings className="h-5 w-5 text-primary" />
                      Grading & Evaluation Settings
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Configure weight percentage distributions, minimum cutoff thresholds, and
                      letter grade ranges.
                    </p>
                  </div>

                  {/* Section A: Assessment Weight Distribution */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                        {/*<Percent className="h-4 w-4 text-primary" />*/}
                        Assessment Weight Distribution (%)
                      </h4>
                      {(() => {
                        const exams = gridData.exams || [];
                        const weights = customConfig.weights || {};
                        const contributes = customConfig.contributes || {};
                        const totalAssignedWeight = exams.reduce((acc: number, e: any) => {
                          const isContributing =
                            contributes[e.exam_id] !== undefined ? !!contributes[e.exam_id] : true;
                          if (!isContributing) return acc;
                          return acc + (weights[e.exam_id] || 0);
                        }, 0);

                        return (
                          <span
                            className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
                              totalAssignedWeight > 100
                                ? 'bg-destructive/10 text-destructive border-destructive/25'
                                : 'bg-primary/10 text-primary border-primary/20'
                            }`}
                          >
                            Total Assigned Weight: {totalAssignedWeight}% (Max 100%)
                          </span>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {gridData.exams.map((exam: any) => {
                        const val =
                          customConfig.weights[exam.exam_id] !== undefined
                            ? customConfig.weights[exam.exam_id]
                            : '';
                        const isContrib =
                          customConfig.contributes[exam.exam_id] !== undefined
                            ? !!customConfig.contributes[exam.exam_id]
                            : true;

                        return (
                          <div
                            key={exam.exam_id}
                            className="p-4 bg-secondary/15 rounded-2xl border border-border/40 space-y-3"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                {renamingExamId === exam.exam_id ? (
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <input
                                      type="text"
                                      value={renamingTitle}
                                      onChange={(e) => setRenamingTitle(e.target.value)}
                                      className="px-2 py-1 bg-secondary/40 border border-primary rounded text-xs font-bold text-foreground focus:outline-none"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => {
                                        if (!renamingTitle.trim()) return;
                                        renameAssessmentMutation.mutate({
                                          examId: exam.exam_id,
                                          exam_title: renamingTitle.trim(),
                                        });
                                      }}
                                      disabled={renameAssessmentMutation.isPending}
                                      className="p-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 cursor-pointer"
                                      title="Save title"
                                    >
                                      {renameAssessmentMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Check className="h-3 w-3" />
                                      )}
                                    </button>
                                    <button
                                      onClick={() => setRenamingExamId(null)}
                                      className="p-1 bg-secondary text-muted-foreground rounded hover:text-foreground cursor-pointer"
                                      title="Cancel"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="block text-xs font-bold text-foreground">
                                      {exam.exam_title}
                                    </span>
                                    <button
                                      onClick={() => {
                                        setRenamingExamId(exam.exam_id);
                                        setRenamingTitle(exam.exam_title);
                                      }}
                                      className="p-1 text-muted-foreground hover:text-primary transition cursor-pointer"
                                      title="Edit Assessment Name"
                                    >
                                      <Edit3 className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                                <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                  Type: {exam.exam_type} | Max Mark: {exam.total_marks}
                                </span>
                              </div>

                              <button
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Are you sure you want to delete assessment "${exam.exam_title}"?`,
                                    )
                                  ) {
                                    deleteAssessmentMutation.mutate(exam.exam_id);
                                  }
                                }}
                                disabled={deleteAssessmentMutation.isPending}
                                className="p-1 text-muted-foreground hover:text-destructive transition cursor-pointer"
                                title="Delete Assessment"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Weight (%) Input */}
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="Weight %"
                                disabled={!isContrib}
                                value={isContrib ? val : ''}
                                onChange={(e) => {
                                  const w = e.target.value;
                                  setCustomConfig((prev: any) => ({
                                    ...prev,
                                    weights: {
                                      ...prev.weights,
                                      [exam.exam_id]: w !== '' ? parseFloat(w) : 0,
                                    },
                                  }));
                                }}
                                className="w-full px-3 py-1.5 bg-secondary/40 border border-border rounded-xl text-xs disabled:opacity-40"
                              />
                              <span className="text-xs font-bold text-muted-foreground">%</span>
                            </div>

                            {/* Contribute to Final Mark Toggle */}
                            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer pt-1">
                              <input
                                type="checkbox"
                                checked={isContrib}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setCustomConfig((prev: any) => ({
                                    ...prev,
                                    contributes: {
                                      ...prev.contributes,
                                      [exam.exam_id]: checked,
                                    },
                                  }));
                                }}
                                className="rounded text-primary focus:ring-primary h-4 w-4"
                              />
                              <span
                                className={
                                  isContrib
                                    ? 'text-foreground font-semibold'
                                    : 'text-muted-foreground'
                                }
                              >
                                Contribute to Final CA/Grade
                              </span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section B: Minimum Cutoff Marks Required to Pass */}
                  <div className="space-y-3 border-t border-border/60 pt-5">
                    <h4 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                      {/*<AlertTriangle className="h-4 w-4 text-primary" />*/}
                      Minimum Cutoff Marks Required to Pass
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Students who fail to meet the cutoff for CA or SA will receive repeat codes
                      E(CA), E(SA), or both E(CA)/E(SA).
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-secondary/15 rounded-2xl border border-border/40 space-y-2">
                        <span className="block text-xs font-bold text-foreground">
                          Continuous Assessment (CA) Cutoff (%)
                        </span>
                        <div className="flex items-center gap-2">
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
                            className="w-full px-3 py-1.5 bg-secondary/40 border border-border rounded-xl text-xs font-bold"
                          />
                          <span className="text-xs font-bold text-muted-foreground">%</span>
                        </div>
                        <span className="block text-[10px] text-muted-foreground">
                          Students failing to achieve this percentage of total CA weight receive
                          "E(CA)".
                        </span>
                      </div>

                      <div className="p-4 bg-secondary/15 rounded-2xl border border-border/40 space-y-2">
                        <span className="block text-xs font-bold text-foreground">
                          Final Semester Assessment (SA) Cutoff (%)
                        </span>
                        <div className="flex items-center gap-2">
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
                            className="w-full px-3 py-1.5 bg-secondary/40 border border-border rounded-xl text-xs font-bold"
                          />
                          <span className="text-xs font-bold text-muted-foreground">%</span>
                        </div>
                        <span className="block text-[10px] text-muted-foreground">
                          Students failing to achieve this percentage of final exam weight receive
                          "E(SA)".
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section C: Letter Grade Mark Ranges */}
                  <div className="space-y-3 border-t border-border/60 pt-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                          Letter Grade Mark Ranges (Boundaries)
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Configure minimum total score required to achieve each final letter grade.
                        </p>
                      </div>

                      {/* Edit Button on Top Right Corner */}
                      <button
                        onClick={() => setIsEditingGradeRanges(!isEditingGradeRanges)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          isEditingGradeRanges
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-secondary/40 text-muted-foreground hover:text-foreground border border-border/60'
                        }`}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        {isEditingGradeRanges ? 'Done Editing' : 'Edit Ranges'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {customConfig.grade_ranges.map((range: any, idx: number) => (
                        <div
                          key={range.grade + idx}
                          className="p-3 bg-secondary/10 rounded-xl border border-border/45 flex flex-col items-center relative group"
                        >
                          {isEditingGradeRanges && (
                            <button
                              onClick={() => {
                                const copy = customConfig.grade_ranges.filter(
                                  (_: any, i: number) => i !== idx,
                                );
                                setCustomConfig((prev: any) => ({
                                  ...prev,
                                  grade_ranges: copy,
                                }));
                              }}
                              className="absolute top-1.5 right-1.5 p-1 text-muted-foreground hover:text-destructive rounded transition cursor-pointer"
                              title="Remove Grade"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                          <span className="text-xs font-bold text-primary">{range.grade}</span>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="100"
                            disabled={!isEditingGradeRanges}
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
                            className="w-20 text-center mt-1 py-1 bg-secondary/40 border border-border rounded-lg text-xs font-bold text-foreground disabled:opacity-75"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Add New Grade Option when editing */}
                    {isEditingGradeRanges && (
                      <div className="p-3 bg-secondary/15 rounded-xl border border-dashed border-border/60 flex flex-wrap items-center gap-3 pt-3">
                        <span className="text-xs font-bold text-foreground">
                          Add New Grade Boundary:
                        </span>
                        <input
                          type="text"
                          placeholder="Grade (e.g. A++, B+)"
                          value={newGradeName}
                          onChange={(e) => setNewGradeName(e.target.value)}
                          className="px-2.5 py-1 bg-secondary/40 border border-border rounded-lg text-xs font-bold w-28 uppercase"
                        />
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-muted-foreground font-semibold">Min Score:</span>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="100"
                            value={newGradeMin}
                            onChange={(e) => setNewGradeMin(parseFloat(e.target.value) || 0)}
                            className="px-2.5 py-1 bg-secondary/40 border border-border rounded-lg text-xs font-bold w-20"
                          />
                        </div>
                        <button
                          onClick={() => {
                            if (!newGradeName.trim()) return;
                            const copy = [
                              ...customConfig.grade_ranges,
                              { grade: newGradeName.trim().toUpperCase(), min: newGradeMin },
                            ];
                            copy.sort((a, b) => b.min - a.min);
                            setCustomConfig((prev: any) => ({ ...prev, grade_ranges: copy }));
                            setNewGradeName('');
                            setNewGradeMin(0);
                          }}
                          className="px-3 py-1 bg-primary text-primary-foreground font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer shadow-sm"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Grade
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Save Configuration Button */}
                  <div className="flex justify-end pt-4 border-t border-border/60">
                    <button
                      onClick={() => {
                        const exams = gridData.exams || [];
                        const weights = customConfig.weights || {};
                        const contributes = customConfig.contributes || {};
                        const totalAssignedWeight = exams.reduce((acc: number, e: any) => {
                          const isContributing =
                            contributes[e.exam_id] !== undefined ? !!contributes[e.exam_id] : true;
                          if (!isContributing) return acc;
                          return acc + (weights[e.exam_id] || 0);
                        }, 0);

                        if (totalAssignedWeight > 100) {
                          setErrorMsg(
                            `Assessment weight distribution total cannot exceed 100% (currently ${totalAssignedWeight}%). Please adjust total weight up to a maximum of 100%.`,
                          );
                          return;
                        }

                        saveConfigMutation.mutate(customConfig);
                      }}
                      disabled={saveConfigMutation.isPending}
                      className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/90 transition-all cursor-pointer shadow-md"
                    >
                      {saveConfigMutation.isPending ? 'Saving Configurations...' : 'Save Settings'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-20 text-center bg-card/10 border border-border/60 rounded-3xl flex flex-col items-center justify-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/45 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">No course selected</p>
              <p className="text-xs text-muted-foreground/75 mt-1 max-w-sm">
                Please choose one of your allocated course subjects from the dropdown list above to
                load the marks registry grid.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD ASSESSMENT MODAL */}
      {/* ========================================================================= */}
      {showAddAssessmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-card border border-border shadow-2xl rounded-3xl w-full max-w-lg overflow-hidden animate-slideUp">
            <div className="p-6 border-b border-border/60 flex justify-between items-center">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Add New Assessment
              </h3>
              <button
                onClick={() => setShowAddAssessmentModal(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Assessment Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. CA 1, Quiz 1, Midterm Exam, End Exam"
                  value={newAssessment.exam_title}
                  onChange={(e) =>
                    setNewAssessment((prev) => ({ ...prev, exam_title: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl focus:ring-1 focus:ring-primary focus:outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Assessment Type
                  </label>
                  <select
                    value={newAssessment.exam_type}
                    onChange={(e) =>
                      setNewAssessment((prev) => ({ ...prev, exam_type: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none text-xs"
                  >
                    <option value="CA">Continuous Assessment (CA)</option>
                    <option value="FINAL">FINAL Semester Exam</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Maximum Mark
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
                    className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Weight Percentage (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newAssessment.weight}
                  disabled={!newAssessment.contributes}
                  onChange={(e) =>
                    setNewAssessment((prev) => ({
                      ...prev,
                      weight: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none text-xs disabled:opacity-40"
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={newAssessment.contributes}
                  onChange={(e) =>
                    setNewAssessment((prev) => ({
                      ...prev,
                      contributes: e.target.checked,
                    }))
                  }
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                <span>Contribute to Final CA Mark / Final Grade</span>
              </label>
              <p className="text-[11px] text-muted-foreground">
                If unchecked, no weight will be added for this assessment towards the final grade
                calculation. You can mark/unmark this anytime later.
              </p>

              <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
                <button
                  onClick={() => setShowAddAssessmentModal(false)}
                  className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 rounded-xl transition text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!newAssessment.exam_title.trim()) {
                      setErrorMsg('Please enter an assessment title.');
                      return;
                    }
                    if (newAssessment.total_marks <= 0) {
                      setErrorMsg('Maximum mark must be greater than 0.');
                      return;
                    }
                    addAssessmentMutation.mutate(newAssessment);
                  }}
                  disabled={addAssessmentMutation.isPending}
                  className="px-5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition text-xs cursor-pointer shadow-md"
                >
                  {addAssessmentMutation.isPending ? 'Adding Assessment...' : 'Add Assessment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXAM STAFF / ADMIN MARKSHEET REVIEW PORTAL */}
      {/* ========================================================================= */}
      {isStaffOrAdmin && (
        <div className="space-y-6">
          <div className="flex border-b border-border/60 gap-4 text-xs font-bold">
            <button
              onClick={() => setActiveTab('review')}
              className={`pb-3 transition-colors ${
                activeTab === 'review'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pending Approval Queue ({reviewQueueData.length})
            </button>
            <button
              onClick={() => setActiveTab('received')}
              className={`pb-3 transition-colors ${
                activeTab === 'received'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Received Queue ({receivedQueueData.length})
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`pb-3 transition-colors ${
                activeTab === 'approved'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Approved Directory ({approvedDirectoryData.length})
            </button>
            <button
              onClick={() => setActiveTab('combined')}
              className={`pb-3 transition-colors ${
                activeTab === 'combined'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Combined Evaluation Registry
            </button>
          </div>

          {/* Review Queue Tab */}
          {activeTab === 'review' && (
            <div className="space-y-4 animate-fadeIn">
              {isReviewQueueLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                  Loading review queue...
                </div>
              ) : reviewQueueData.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs border border-dashed border-border/60 rounded-2xl">
                  No submitted marksheets are pending staff review.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {reviewQueueData.map((c: any) => (
                    <div
                      key={c.course_id}
                      className="bg-card/25 border border-border/80 p-5 rounded-2xl flex flex-col justify-between backdrop-blur-sm shadow-md hover:border-primary/30 transition"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded uppercase">
                            {c.course_code}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded uppercase">
                            Pending Receive
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-foreground pt-1 truncate">
                          {c.course_name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Semester: {c.semester} | Batch: {c.academic_year}
                        </p>
                      </div>
                      <div className="border-t border-border/60 pt-4 mt-6 flex items-center justify-between">
                        <button
                          onClick={() => setSelectedCourseReview(c)}
                          className="text-xs text-primary font-bold hover:underline"
                        >
                          Review Marksheet &rarr;
                        </button>
                        <button
                          onClick={() => receiveCourseMutation.mutate(c.course_id)}
                          disabled={receiveCourseMutation.isPending}
                          className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition cursor-pointer"
                        >
                          Mark Received
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Received Queue Tab */}
          {activeTab === 'received' && (
            <div className="space-y-4 animate-fadeIn">
              {isReceivedQueueLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                  Loading received queue...
                </div>
              ) : receivedQueueData.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs border border-dashed border-border/60 rounded-2xl">
                  No received marksheets are waiting for final publishing.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {receivedQueueData.map((c: any) => (
                    <div
                      key={c.course_id}
                      className="bg-card/25 border border-border/80 p-5 rounded-2xl flex flex-col justify-between backdrop-blur-sm shadow-md hover:border-primary/30 transition"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded uppercase">
                            {c.course_code}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded uppercase">
                            Received
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-foreground pt-1 truncate">
                          {c.course_name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Semester: {c.semester} | Batch: {c.academic_year}
                        </p>
                      </div>
                      <div className="border-t border-border/60 pt-4 mt-6 flex items-center justify-between gap-2">
                        <button
                          onClick={() => setSelectedCourseReview(c)}
                          className="text-xs text-primary font-bold hover:underline"
                        >
                          Review Sheet &rarr;
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setStaffRejectCourseId(c.course_id)}
                            className="px-3 py-1.5 bg-destructive text-white text-xs font-bold rounded-lg hover:bg-destructive/90 transition cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => approveCourseMutation.mutate(c.course_id)}
                            disabled={approveCourseMutation.isPending}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 transition cursor-pointer"
                          >
                            Publish
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Approved Directory Tab */}
          {activeTab === 'approved' && (
            <div className="space-y-4 animate-fadeIn">
              {isApprovedDirectoryLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                  Loading approved directory...
                </div>
              ) : approvedDirectoryData.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs border border-dashed border-border/60 rounded-2xl">
                  No courses published yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {approvedDirectoryData.map((c: any) => (
                    <div
                      key={c.course_id}
                      className="bg-card/25 border border-border/80 p-5 rounded-2xl flex flex-col justify-between backdrop-blur-sm shadow-md"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded uppercase">
                            {c.course_code}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded uppercase">
                            Published
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-foreground pt-1 truncate">
                          {c.course_name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Semester: {c.semester} | Batch: {c.academic_year}
                        </p>
                      </div>
                      <div className="border-t border-border/60 pt-4 mt-6 flex items-center justify-between">
                        <button
                          onClick={() => setSelectedCourseReview(c)}
                          className="text-xs text-primary font-bold hover:underline"
                        >
                          View Published Sheet &rarr;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Combined Evaluation Registry Tab */}
          {activeTab === 'combined' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-card/30 border border-border/60 p-6 rounded-3xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Combined Evaluation Registry
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select a course to inspect overall CA marks, final marks, and compiled grade
                    output.
                  </p>
                </div>
                <div className="w-full md:w-80">
                  <select
                    value={combinedCourseId}
                    onChange={(e) => setCombinedCourseId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-xs text-foreground"
                  >
                    <option value="">Select Course...</option>
                    {coursesLookup.map((c: any) => (
                      <option key={c.course_id} value={c.course_id} className="bg-card">
                        {c.course_code} - {c.course_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {combinedCourseId && (
                <div className="bg-card/20 border border-border/60 rounded-3xl p-6 backdrop-blur-sm space-y-4">
                  {isCombinedLoading ? (
                    <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                      Loading combined course data...
                    </div>
                  ) : !combinedResults?.students || combinedResults.students.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-xs border border-dashed border-border/60 rounded-2xl">
                      No registered student evaluation records found for this course.
                    </div>
                  ) : (
                    <div className="border border-border/60 rounded-2xl overflow-x-auto shadow-md">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-border/60 bg-secondary/15 text-muted-foreground font-bold font-mono">
                            <th className="px-6 py-4">Index No</th>
                            <th className="px-6 py-4">Reg No</th>
                            <th className="px-6 py-4 text-center">Continuous Assessment (CA)</th>
                            <th className="px-6 py-4 text-center">Final Exam (SA)</th>
                            <th className="px-6 py-4 text-center">Total Score (%)</th>
                            <th className="px-6 py-4 text-center">Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-medium">
                          {combinedResults.students.map((st: any) => {
                            const gradeRecord = combinedResults.grades?.find(
                              (g: any) => g.student_id === st.student_id,
                            );
                            return (
                              <tr key={st.student_id} className="hover:bg-secondary/10">
                                <td className="px-6 py-3 font-bold font-mono text-foreground">
                                  {st.index_number}
                                </td>
                                <td className="px-6 py-3 font-mono text-muted-foreground">
                                  {st.registration_number}
                                </td>
                                <td className="px-6 py-3 text-center">
                                  {gradeRecord
                                    ? Number(gradeRecord.continuous_assessment_marks).toFixed(1)
                                    : '-'}
                                </td>
                                <td className="px-6 py-3 text-center">
                                  {gradeRecord
                                    ? Number(gradeRecord.final_exam_marks).toFixed(1)
                                    : '-'}
                                </td>
                                <td className="px-6 py-3 text-center font-bold text-foreground">
                                  {gradeRecord
                                    ? `${Number(gradeRecord.total_marks).toFixed(1)}%`
                                    : '-'}
                                </td>
                                <td className="px-6 py-3 text-center">
                                  <span className="px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded font-bold">
                                    {gradeRecord?.grade || 'N/A'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Modal for Staff Reviewing Marksheet */}
          {selectedCourseReview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
              <div className="bg-card border border-border shadow-2xl rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-slideUp">
                <div className="p-6 border-b border-border/60 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded uppercase">
                      {selectedCourseReview.course_code}
                    </span>
                    <h3 className="text-xl font-bold text-foreground mt-2">
                      Review Marksheet: {selectedCourseReview.course_name}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedCourseReview(null)}
                    className="p-2 hover:bg-secondary rounded-full transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {isStaffGridLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                      Loading marksheet details...
                    </div>
                  ) : !staffGridData?.students || staffGridData.students.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground text-sm">
                      No student records found.
                    </div>
                  ) : (
                    <div className="border border-border/80 rounded-2xl overflow-hidden shadow-inner">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-secondary/40 border-b border-border/80">
                            <th className="p-3 font-bold text-muted-foreground uppercase">
                              Reg No
                            </th>
                            <th className="p-3 font-bold text-muted-foreground uppercase">
                              Index No
                            </th>
                            <th className="p-3 font-bold text-muted-foreground uppercase text-center">
                              CA Total
                            </th>
                            <th className="p-3 font-bold text-muted-foreground uppercase text-center">
                              Final Exam
                            </th>
                            <th className="p-3 font-bold text-muted-foreground uppercase text-center">
                              Total Score (%)
                            </th>
                            <th className="p-3 font-bold text-muted-foreground uppercase text-center">
                              Grade
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {staffGridData.students.map((st: any) => {
                            const grade = staffGridData.grades?.find(
                              (g: any) => g.student_id === st.student_id,
                            );
                            return (
                              <tr
                                key={st.student_id}
                                className="hover:bg-secondary/20 transition-colors"
                              >
                                <td className="p-3 font-bold font-mono text-foreground">
                                  {st.registration_number || 'N/A'}
                                </td>
                                <td className="p-3 font-mono text-muted-foreground">
                                  {st.index_number || 'N/A'}
                                </td>
                                <td className="p-3 text-center">
                                  {grade
                                    ? Number(grade.continuous_assessment_marks).toFixed(1)
                                    : '-'}
                                </td>
                                <td className="p-3 text-center">
                                  {grade ? Number(grade.final_exam_marks).toFixed(1) : '-'}
                                </td>
                                <td className="p-3 text-center font-bold text-foreground">
                                  {grade ? `${Number(grade.total_marks).toFixed(1)}%` : '-'}
                                </td>
                                <td className="p-3 text-center">
                                  <span className="px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/25 rounded font-bold">
                                    {grade?.grade || 'N/A'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-border/60 bg-secondary/15 flex justify-end gap-3">
                  <button
                    onClick={() => setSelectedCourseReview(null)}
                    className="px-5 py-2.5 bg-secondary text-foreground hover:bg-secondary/80 rounded-xl transition text-sm font-bold cursor-pointer"
                  >
                    Close Sheet
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal for Staff Rejection Prompt */}
          {staffRejectCourseId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
              <div className="bg-card border border-border shadow-2xl rounded-3xl w-full max-w-md p-6 space-y-4 animate-slideUp">
                <h3 className="text-lg font-bold text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Reject Marksheet
                </h3>
                <p className="text-xs text-muted-foreground">
                  Specify the reason for rejecting this marksheet so the lecturer can correct
                  student grades.
                </p>
                <textarea
                  rows={4}
                  placeholder="Enter rejection reason..."
                  value={staffActionReason}
                  onChange={(e) => setStaffActionReason(e.target.value)}
                  className="w-full px-4 py-2.5 bg-secondary/40 border border-border rounded-xl focus:ring-1 focus:ring-destructive focus:outline-none text-xs text-foreground"
                />
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setStaffRejectCourseId(null);
                      setStaffActionReason('');
                    }}
                    className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 rounded-xl transition text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!staffActionReason.trim()) {
                        setErrorMsg('Please enter a rejection reason.');
                        return;
                      }
                      rejectCourseMutation.mutate({
                        courseId: staffRejectCourseId,
                        reason: staffActionReason.trim(),
                      });
                    }}
                    disabled={rejectCourseMutation.isPending || !staffActionReason.trim()}
                    className="px-4 py-2 bg-destructive text-white hover:bg-destructive/90 rounded-xl transition text-xs font-bold cursor-pointer disabled:opacity-40"
                  >
                    Confirm Rejection
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
