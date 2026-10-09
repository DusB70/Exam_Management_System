'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { apiClient } from '../../../lib/api-client';
import { UserRole } from '@ems/shared';
import {
  Users,
  Search,
  BookOpen,
  Loader2,
  Download,
  Eye,
  X,
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Award,
  ExternalLink,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  Stethoscope,
  Save,
} from 'lucide-react';

const STABLE_EMPTY_ARRAY: any[] = [];

function formatBatchDisplay(student: any): string {
  if (student?.batch && typeof student.batch === 'string' && student.batch.includes('/')) {
    return student.batch;
  }
  let year = Number(student?.academic_year) || Number(student?.batch);
  if (!year && student?.registration_number) {
    const match = String(student.registration_number).match(/20\d{2}/);
    if (match) year = Number(match[0]);
  }
  if (year && !isNaN(year)) {
    if (year >= 2000 && year <= 2099) {
      const y1 = year.toString().slice(2);
      const y2 = (year + 1).toString().slice(2);
      return `${y1}/${y2}`;
    }
    if (year >= 10 && year <= 99) {
      return `${year}/${year + 1}`;
    }
  }
  return student?.batch
    ? String(student.batch)
    : student?.academic_year
      ? String(student.academic_year)
      : '21/22';
}

export default function StudentDirectoryPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const isStaffOrAdmin =
    user?.role === UserRole.EXAM_DIVISION_STAFF || user?.role === UserRole.ADMINISTRATOR;

  // ==========================================
  // LECTURER SPECIFIC STATES
  // ==========================================
  const [selectedLecturerCourseId, setSelectedLecturerCourseId] = useState<string>('');
  const [studentsSearchQuery, setStudentsSearchQuery] = useState<string>('');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('ALL');
  const [selectedCourseBatchFilter, setSelectedCourseBatchFilter] = useState<string>('ALL');
  const [selectedCourseSemesterFilter, setSelectedCourseSemesterFilter] = useState<string>('ALL');
  const [isDownloadingExcel, setIsDownloadingExcel] = useState<boolean>(false);
  const [selectedLecturerStudentModal, setSelectedLecturerStudentModal] = useState<any | null>(
    null,
  );
  const [visibleStudentsLimit, setVisibleStudentsLimit] = useState<number>(100);

  React.useEffect(() => {
    setVisibleStudentsLimit(100);
  }, [
    selectedLecturerCourseId,
    studentsSearchQuery,
    selectedBatchFilter,
    selectedCourseBatchFilter,
    selectedCourseSemesterFilter,
  ]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const cId = params.get('courseId');
      if (cId) {
        setSelectedLecturerCourseId(cId);
      }
    }
  }, []);

  // ==========================================
  // STAFF & ADMIN SPECIFIC STATES
  // ==========================================
  const [staffSearch, setStaffSearch] = useState<string>('');
  const [staffStatus, setStaffStatus] = useState<string>('ALL');
  const [staffDegreeId, setStaffDegreeId] = useState<string>('');
  const [staffBatch, setStaffBatch] = useState<string>('');
  const [staffPage, setStaffPage] = useState<number>(1);

  // Selected Student Record Modal State
  const [selectedStudentRecordId, setSelectedStudentRecordId] = useState<number | null>(null);
  const [recordModalTab, setRecordModalTab] = useState<
    'history' | 'grace' | 'recorrections' | 'medicals'
  >('history');

  // Status Edit State inside modal
  const [editingStatus, setEditingStatus] = useState<string>('ACTIVE');
  const [editingEnrollmentDate, setEditingEnrollmentDate] = useState<string>('');
  const [editingGraduationDate, setEditingGraduationDate] = useState<string>('');
  const [statusSaveMsg, setStatusSaveMsg] = useState<string | null>(null);

  // Exam Violation Modal State (Staff/Admin)
  const [violationModalOpen, setViolationModalOpen] = useState<boolean>(false);
  const [violationStudentId, setViolationStudentId] = useState<number | ''>('');
  const [violationStudentDetails, setViolationStudentDetails] = useState<{
    name?: string;
    registration_number?: string;
    index_number?: string;
  } | null>(null);
  const [violationBatch, setViolationBatch] = useState<string>('21/22');
  const [violationSemester, setViolationSemester] = useState<string>('2.2');
  const [violationReason, setViolationReason] = useState<string>('');
  const [violationSubmitting, setViolationSubmitting] = useState<boolean>(false);
  const [violationMsg, setViolationMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // ==========================================
  // QUERIES FOR LECTURER
  // ==========================================
  const { data: lecturerCoursesData, isLoading: isLecturerCoursesLoading } = useQuery({
    queryKey: ['lecturer-courses'],
    queryFn: async () => {
      const response = await apiClient.get('/marks/my-courses');
      return response.data?.data || [];
    },
    enabled: user?.role === UserRole.LECTURER,
  });
  const lecturerCourses = Array.isArray(lecturerCoursesData)
    ? lecturerCoursesData
    : STABLE_EMPTY_ARRAY;

  const { data: studentsOverviewData } = useQuery({
    queryKey: ['lecturer-students-overview'],
    queryFn: async () => {
      const response = await apiClient.get('/marks/my-students-overview');
      return response.data?.data;
    },
    enabled: user?.role === UserRole.LECTURER,
  });

  const { data: enrolledStudentsData, isLoading: isEnrolledStudentsLoading } = useQuery({
    queryKey: ['lecturer-enrolled-students', selectedLecturerCourseId],
    queryFn: async () => {
      const response = await apiClient.get(`/marks/courses/${selectedLecturerCourseId}/students`);
      return response.data?.data || [];
    },
    enabled: user?.role === UserRole.LECTURER && !!selectedLecturerCourseId,
  });
  const enrolledStudents = Array.isArray(enrolledStudentsData)
    ? enrolledStudentsData
    : STABLE_EMPTY_ARRAY;

  // Auto progressive background loading effect (first 100 loaded, then automatically loads remaining)
  React.useEffect(() => {
    const totalCount = enrolledStudents.length;
    if (totalCount > visibleStudentsLimit) {
      const timer = setTimeout(() => {
        setVisibleStudentsLimit((prev) => Math.min(prev + 100, totalCount));
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [visibleStudentsLimit, enrolledStudents.length]);

  // Handle excel download for lecturer
  const handleDownloadStudentsExcel = async () => {
    if (!selectedLecturerCourseId) return;
    setIsDownloadingExcel(true);
    try {
      const response = await apiClient.get(
        `/marks/courses/${selectedLecturerCourseId}/students/excel`,
        {
          responseType: 'blob',
        },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Student_Roster_Course_${selectedLecturerCourseId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch {
      alert('Failed to download student excel sheet.');
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  // ==========================================
  // QUERIES FOR STAFF / ADMIN
  // ==========================================
  const { data: degreesList = [] } = useQuery({
    queryKey: ['degrees-list-students'],
    queryFn: async () => {
      const response = await apiClient.get('/degrees');
      return response.data?.data || [];
    },
    enabled: isStaffOrAdmin,
  });

  const { data: staffStudentsData, isLoading: isStaffStudentsLoading } = useQuery({
    queryKey: [
      'staff-students-directory',
      staffPage,
      staffSearch,
      staffStatus,
      staffDegreeId,
      staffAcademicYear,
    ],
    queryFn: async () => {
      const params: any = {
        page: staffPage,
        limit: 10,
        search: staffSearch || undefined,
        status: staffStatus !== 'ALL' ? staffStatus : undefined,
        degreeId: staffDegreeId || undefined,
        academicYear: staffAcademicYear || undefined,
      };
      const response = await apiClient.get('/users/students/staff-directory', { params });
      return response.data?.data;
    },
    enabled: isStaffOrAdmin,
  });

  // Query for student full academic record
  const {
    data: fullRecordData,
    isLoading: isFullRecordLoading,
    refetch: refetchFullRecord,
  } = useQuery({
    queryKey: ['student-full-record', selectedStudentRecordId],
    queryFn: async () => {
      if (!selectedStudentRecordId) return null;
      const response = await apiClient.get(
        `/users/students/${selectedStudentRecordId}/full-record`,
      );
      return response.data?.data;
    },
    enabled: isStaffOrAdmin && !!selectedStudentRecordId,
  });

  // Update Student Academic Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (payload: {
      status: string;
      enrollmentDate?: string;
      graduationDate?: string;
    }) => {
      if (!selectedStudentRecordId) return;
      const response = await apiClient.patch(
        `/users/students/${selectedStudentRecordId}/academic-status`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      setStatusSaveMsg('Academic status updated successfully!');
      setTimeout(() => setStatusSaveMsg(null), 3000);
      refetchFullRecord();
      queryClient.invalidateQueries({ queryKey: ['staff-students-directory'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to update student status');
    },
  });

  // Toggle Grade Withheld Mutation
  const toggleWithholdMutation = useMutation({
    mutationFn: async ({ gradeId, isWithheld }: { gradeId: number; isWithheld: boolean }) => {
      const response = await apiClient.patch(`/results/grades/${gradeId}/withhold`, {
        isWithheld,
      });
      return response.data;
    },
    onSuccess: () => {
      refetchFullRecord();
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to update result withheld status');
    },
  });

  // Sync editing form when fullRecordData is loaded
  // Sync editing form when fullRecordData is loaded
  React.useEffect(() => {
    if (fullRecordData?.student) {
      setEditingStatus(fullRecordData.student.status || 'ACTIVE');
      setEditingEnrollmentDate(
        fullRecordData.student.enrollment_date
          ? new Date(fullRecordData.student.enrollment_date).toISOString().split('T')[0]
          : fullRecordData.student.created_at
            ? new Date(fullRecordData.student.created_at).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
      );
      setEditingGraduationDate(
        fullRecordData.student.graduation_date
          ? new Date(fullRecordData.student.graduation_date).toISOString().split('T')[0]
          : '',
      );
    }
  }, [fullRecordData]);

  // ==========================================
  // RENDER STAFF / ADMIN CONSOLE
  // ==========================================
  if (isStaffOrAdmin) {
    const studentsList = staffStudentsData?.items || [];
    const totalPages = staffStudentsData?.totalPages || 1;
    const totalStudents = staffStudentsData?.total || 0;

    const studentRecord = fullRecordData?.student;
    const registrationsList = fullRecordData?.registrations || [];
    const courseGradesList = fullRecordData?.courseGrades || [];
    const semesterGpasList = fullRecordData?.semesterGpas || [];
    const graceAppsList = fullRecordData?.graceApplications || [];
    const recorrectionReqsList = fullRecordData?.recorrectionRequests || [];
    const medicalSubsList = fullRecordData?.medicalSubmissions || [];

    // Group registrations & grades by semester
    const semestersSet = new Set<string>();
    registrationsList.forEach((r: any) => {
      if (r.course?.semester) semestersSet.add(r.course.semester);
    });
    courseGradesList.forEach((g: any) => {
      if (g.course?.semester) semestersSet.add(g.course.semester);
    });
    const sortedSemesters = Array.from(semestersSet).sort();

    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <GraduationCap className="h-8 w-8 text-primary" />
              Student Directory & Academic History Console
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Comprehensive registry of active and past students. Inspect semester course
              registrations, marks, Proper/Repeat attempts, grace chance requests, recorrections,
              and result withheld flags.
            </p>
          </div>
        </div>

        {/* Quick Filter Status Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
          <button
            onClick={() => {
              setStaffStatus('ALL');
              setStaffPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              staffStatus === 'ALL'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            All Students
          </button>
          <button
            onClick={() => {
              setStaffStatus('ACTIVE');
              setStaffPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              staffStatus === 'ACTIVE'
                ? 'bg-emerald-500 text-white shadow-md'
                : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Currently Studying (Active)
          </button>
          <button
            onClick={() => {
              setStaffStatus('GRADUATED');
              setStaffPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              staffStatus === 'GRADUATED'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            Past / Graduated Students
          </button>
          <button
            onClick={() => {
              setStaffStatus('SUSPENDED');
              setStaffPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              staffStatus === 'SUSPENDED'
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Suspended
          </button>
        </div>

        {/* Filter and Search Bar (Matching Image 3 UI) */}
        <div className="bg-card border border-border/80 rounded-3xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search index, registration no, student name..."
                value={staffSearch}
                onChange={(e) => {
                  setStaffSearch(e.target.value);
                  setStaffPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-secondary/40 border border-border/80 rounded-2xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 font-medium"
              />
            </div>
            <div className="px-3 py-1.5 bg-background border border-border/80 rounded-xl text-xs font-mono font-bold text-foreground flex items-center gap-1.5 shrink-0">
              <Users className="h-3.5 w-3.5 text-primary" />
              Showing {studentsList.length} of {totalStudents} Records
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="uppercase text-[10px] tracking-wider font-extrabold text-muted-foreground">
                DEGREE:
              </span>
              <select
                value={staffDegreeId}
                onChange={(e) => {
                  setStaffDegreeId(e.target.value);
                  setStaffPage(1);
                }}
                className="px-3 py-1.5 bg-secondary/40 border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 font-semibold cursor-pointer"
              >
                <option value="">All Degrees</option>
                {degreesList.map((d: any) => (
                  <option key={d.degree_id} value={d.degree_id}>
                    {d.degree_code} - {d.degree_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="uppercase text-[10px] tracking-wider font-extrabold text-muted-foreground">
                BATCH:
              </span>
              <select
                value={staffBatch}
                onChange={(e) => {
                  setStaffBatch(e.target.value);
                  setStaffPage(1);
                }}
                className="px-3 py-1.5 bg-secondary/40 border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 font-semibold cursor-pointer"
              >
                <option value="">All Batches</option>
                <option value="20/21">20/21</option>
                <option value="21/22">21/22</option>
                <option value="22/23">22/23</option>
                <option value="23/24">23/24</option>
                <option value="24/25">24/25</option>
                <option value="25/26">25/26</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="uppercase text-[10px] tracking-wider font-extrabold text-muted-foreground">
                STATUS:
              </span>
              <select
                value={staffStatus}
                onChange={(e) => {
                  setStaffStatus(e.target.value);
                  setStaffPage(1);
                }}
                className="px-3 py-1.5 bg-secondary/40 border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 font-semibold cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE (Currently Studying)</option>
                <option value="GRADUATED">GRADUATED (Past Student)</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="WITHDRAWN">WITHDRAWN</option>
              </select>
            </div>
          </div>
        </div>

        {/* Staff Students Table */}
        <div className="bg-card/20 border border-border/60 rounded-3xl overflow-hidden backdrop-blur-sm shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-secondary/15 text-muted-foreground font-bold font-mono uppercase">
                  <th className="px-6 py-4">Index No</th>
                  <th className="px-6 py-4">Registration No</th>
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4">Degree & Specialization</th>
                  <th className="px-6 py-4">Batch</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {isStaffStudentsLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-20 text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        Loading student directory records...
                      </span>
                    </td>
                  </tr>
                ) : studentsList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-20 text-muted-foreground">
                      No student records found matching your filters.
                    </td>
                  </tr>
                ) : (
                  studentsList.map((st: any) => {
                    const statusVal = st.status || 'ACTIVE';

                    return (
                      <tr key={st.student_id} className="hover:bg-secondary/10 transition-colors">
                        <td className="px-6 py-4 font-bold text-foreground font-mono">
                          {st.index_number}
                        </td>
                        <td className="px-6 py-4 font-mono text-muted-foreground">
                          {st.registration_number}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-foreground">{st.user?.full_name}</div>
                          <div className="text-[10px] text-muted-foreground">{st.user?.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-foreground">
                            {st.degree?.degree_name} ({st.degree?.degree_code})
                          </div>
                          {st.specialization && (
                            <div className="text-[10px] text-primary">
                              Spec: {st.specialization.specialization_name}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-muted-foreground">
                          {formatBatchDisplay(st)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                              statusVal === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : statusVal === 'GRADUATED'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                  : statusVal === 'SUSPENDED'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                statusVal === 'ACTIVE'
                                  ? 'bg-emerald-400'
                                  : statusVal === 'GRADUATED'
                                    ? 'bg-purple-400'
                                    : statusVal === 'SUSPENDED'
                                      ? 'bg-amber-400'
                                      : 'bg-red-400'
                              }`}
                            />
                            {statusVal}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => {
                              setSelectedStudentRecordId(st.student_id);
                              setRecordModalTab('history');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 rounded-xl transition-all text-xs font-bold cursor-pointer shadow-sm"
                          >
                            <Eye className="h-3.5 w-3.5" /> View Full Record
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-border/60 bg-secondary/10 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Page {staffPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStaffPage((p) => Math.max(1, p - 1))}
                  disabled={staffPage === 1}
                  className="p-1.5 bg-secondary hover:bg-secondary/80 rounded-lg text-muted-foreground disabled:opacity-50 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setStaffPage((p) => Math.min(totalPages, p + 1))}
                  disabled={staffPage === totalPages}
                  className="p-1.5 bg-secondary hover:bg-secondary/80 rounded-lg text-muted-foreground disabled:opacity-50 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ========================================== */}
        {/* FULL STUDENT ACADEMIC RECORD MODAL (STAFF) */}
        {/* ========================================== */}
        {selectedStudentRecordId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-background/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-card border border-border/80 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] backdrop-blur-xl animate-scaleUp">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-border/60 bg-secondary/15 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 text-primary border border-primary/20 rounded-2xl">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-foreground">
                        {isFullRecordLoading
                          ? 'Loading Student Record...'
                          : studentRecord?.user?.full_name}
                      </h3>
                      {studentRecord?.status && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                            studentRecord.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : studentRecord.status === 'GRADUATED'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {studentRecord.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      Index: {studentRecord?.index_number || 'N/A'} | Reg:{' '}
                      {studentRecord?.registration_number || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (studentRecord?.student_id) {
                        setViolationStudentId(studentRecord.student_id);
                        setViolationStudentDetails({
                          name: studentRecord.user?.full_name,
                          registration_number: studentRecord.registration_number,
                          index_number: studentRecord.index_number,
                        });
                        setViolationBatch(formatBatchDisplay(studentRecord));
                        setViolationMsg(null);
                        setViolationModalOpen(true);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Mark Violation
                  </button>
                  <button
                    onClick={() => setSelectedStudentRecordId(null)}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-xl transition-all cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {isFullRecordLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Retrieving full academic history...
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Top Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-secondary/10 p-4 rounded-2xl border border-border/40 text-xs">
                    <div>
                      <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                        Degree Program
                      </span>
                      <span className="font-bold text-foreground truncate block">
                        {studentRecord?.degree?.degree_name} ({studentRecord?.degree?.degree_code})
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                        Specialization
                      </span>
                      <span className="font-bold text-foreground truncate block">
                        {studentRecord?.specialization
                          ? studentRecord.specialization.specialization_name
                          : 'General'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                        Academic Year / Batch
                      </span>
                      <span className="font-bold font-mono text-foreground">
                        {formatBatchDisplay(studentRecord)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                        Latest CGPA
                      </span>
                      <span className="font-extrabold font-mono text-primary text-sm">
                        {semesterGpasList.length > 0
                          ? semesterGpasList[semesterGpasList.length - 1].cumulative_gpa.toFixed(2)
                          : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Staff Status Control Bar */}
                  <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                        <Award className="h-4 w-4" /> Academic Status & Enrollment Controls
                      </h4>
                      {statusSaveMsg && (
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                          {statusSaveMsg}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                          Student Status
                        </label>
                        <select
                          value={editingStatus}
                          onChange={(e) => setEditingStatus(e.target.value)}
                          className="w-full px-3 py-1.5 bg-background border border-border/80 rounded-xl text-xs text-foreground font-semibold"
                        >
                          <option value="ACTIVE">ACTIVE (Currently Studying)</option>
                          <option value="GRADUATED">GRADUATED (Past Student)</option>
                          <option value="SUSPENDED">SUSPENDED</option>
                          <option value="WITHDRAWN">WITHDRAWN</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                          Enrollment Date
                        </label>
                        <input
                          type="date"
                          value={editingEnrollmentDate}
                          onChange={(e) => setEditingEnrollmentDate(e.target.value)}
                          className="w-full px-3 py-1.5 bg-background border border-border/80 rounded-xl text-xs text-foreground font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                          Effective Date
                        </label>
                        <input
                          type="date"
                          value={editingGraduationDate}
                          onChange={(e) => setEditingGraduationDate(e.target.value)}
                          className="w-full px-3 py-1.5 bg-background border border-border/80 rounded-xl text-xs text-foreground font-medium"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => {
                          updateStatusMutation.mutate({
                            status: editingStatus,
                            enrollmentDate: editingEnrollmentDate || undefined,
                            graduationDate: editingGraduationDate || undefined,
                          });
                        }}
                        disabled={updateStatusMutation.isPending}
                        className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/95 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {updateStatusMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Save Status & Dates
                      </button>
                    </div>
                  </div>

                  {/* Tabs Bar */}
                  <div className="flex items-center gap-2 border-b border-border/60">
                    <button
                      onClick={() => setRecordModalTab('history')}
                      className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                        recordModalTab === 'history'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <BookOpen className="h-3.5 w-3.5" /> Registered Courses & Marks (
                      {courseGradesList.length})
                    </button>
                    <button
                      onClick={() => setRecordModalTab('grace')}
                      className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                        recordModalTab === 'grace'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <FileCheck className="h-3.5 w-3.5" /> Grace Chance Applications (
                      {graceAppsList.length})
                    </button>
                    <button
                      onClick={() => setRecordModalTab('recorrections')}
                      className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                        recordModalTab === 'recorrections'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" /> Recorrections (
                      {recorrectionReqsList.length})
                    </button>
                    <button
                      onClick={() => setRecordModalTab('medicals')}
                      className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                        recordModalTab === 'medicals'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Stethoscope className="h-3.5 w-3.5" /> Medicals ({medicalSubsList.length})
                    </button>
                  </div>

                  {/* TAB 1: ACADEMIC HISTORY & MARKS */}
                  {recordModalTab === 'history' && (
                    <div className="space-y-6">
                      {sortedSemesters.length === 0 ? (
                        <div className="p-12 text-center bg-secondary/10 border border-border/60 rounded-2xl text-muted-foreground text-xs">
                          No registered courses or published grades found for this student.
                        </div>
                      ) : (
                        sortedSemesters.map((sem: string) => {
                          const semRegs = registrationsList.filter(
                            (r: any) => r.course?.semester === sem,
                          );
                          const semGrades = courseGradesList.filter(
                            (g: any) => g.course?.semester === sem,
                          );
                          const semGpaObj = semesterGpasList.find((g: any) => g.semester === sem);

                          return (
                            <div
                              key={sem}
                              className="border border-border/60 rounded-2xl overflow-hidden bg-card/15 shadow-sm space-y-0"
                            >
                              <div className="bg-secondary/20 p-4 border-b border-border/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-2.5 py-1 bg-primary/10 text-primary font-bold font-mono rounded-lg text-xs border border-primary/20">
                                    Semester {sem}
                                  </span>
                                  <span className="text-xs text-muted-foreground font-semibold">
                                    {semRegs.length} Course(s) Registered
                                  </span>
                                </div>
                                {semGpaObj && (
                                  <div className="flex items-center gap-3 text-xs font-mono font-bold">
                                    <span className="text-muted-foreground">
                                      SGPA:{' '}
                                      <strong className="text-foreground">
                                        {semGpaObj.semester_gpa.toFixed(2)}
                                      </strong>
                                    </span>
                                    <span className="text-muted-foreground">
                                      CGPA:{' '}
                                      <strong className="text-primary">
                                        {semGpaObj.cumulative_gpa.toFixed(2)}
                                      </strong>
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="border-b border-border/40 text-[10px] font-bold text-muted-foreground uppercase font-mono bg-secondary/10">
                                      <th className="px-4 py-3">Course Code & Name</th>
                                      <th className="px-4 py-3 text-center">Attempt</th>
                                      <th className="px-4 py-3 text-center">CA Marks</th>
                                      <th className="px-4 py-3 text-center">Final Marks</th>
                                      <th className="px-4 py-3 text-center">Total Score</th>
                                      <th className="px-4 py-3 text-center">Grade</th>
                                      <th className="px-4 py-3 text-center">Result Status</th>
                                      <th className="px-4 py-3 text-center">Staff Control</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/30 font-medium">
                                    {semRegs.map((reg: any) => {
                                      const gradeRecord = semGrades.find(
                                        (g: any) => g.course_id === reg.course_id,
                                      );
                                      const isWithheld = gradeRecord?.result_status === 'WITHHELD';
                                      const attemptType = reg.attempt_type || 'PROPER';

                                      return (
                                        <tr
                                          key={reg.registration_id}
                                          className="hover:bg-secondary/10 transition-colors"
                                        >
                                          <td className="px-4 py-3">
                                            <div className="font-bold text-foreground font-mono">
                                              {reg.course?.course_code}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground truncate max-w-xs">
                                              {reg.course?.course_name} ({reg.course?.credit_value}{' '}
                                              Credits)
                                            </div>
                                          </td>

                                          {/* Attempt Badge (Proper vs Repeat) */}
                                          <td className="px-4 py-3 text-center">
                                            <span
                                              className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold font-mono uppercase border ${
                                                attemptType === 'REPEAT'
                                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                              }`}
                                            >
                                              {attemptType}
                                            </span>
                                          </td>

                                          <td className="px-4 py-3 text-center font-mono">
                                            {gradeRecord
                                              ? gradeRecord.continuous_assessment_marks
                                              : '-'}
                                          </td>
                                          <td className="px-4 py-3 text-center font-mono">
                                            {gradeRecord ? gradeRecord.final_exam_marks : '-'}
                                          </td>
                                          <td className="px-4 py-3 text-center font-mono font-bold text-foreground">
                                            {gradeRecord ? gradeRecord.total_marks : '-'}
                                          </td>
                                          <td className="px-4 py-3 text-center font-mono font-extrabold">
                                            {gradeRecord ? (
                                              <span
                                                className={`px-2 py-0.5 rounded text-[11px] ${
                                                  gradeRecord.grade === 'F'
                                                    ? 'bg-red-500/10 text-red-400'
                                                    : 'bg-primary/10 text-primary'
                                                }`}
                                              >
                                                {gradeRecord.grade}
                                              </span>
                                            ) : (
                                              '-'
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            {isWithheld ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md text-[9px] font-bold uppercase">
                                                <Lock className="h-2.5 w-2.5" /> WITHHELD
                                              </span>
                                            ) : gradeRecord?.is_published ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[9px] font-bold uppercase">
                                                <CheckCircle2 className="h-2.5 w-2.5" /> PUBLISHED
                                              </span>
                                            ) : (
                                              <span className="text-[10px] text-muted-foreground">
                                                PENDING
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            {gradeRecord ? (
                                              <button
                                                onClick={() => {
                                                  toggleWithholdMutation.mutate({
                                                    gradeId: gradeRecord.grade_id,
                                                    isWithheld: !isWithheld,
                                                  });
                                                }}
                                                disabled={toggleWithholdMutation.isPending}
                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                                  isWithheld
                                                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                                                    : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                                                }`}
                                              >
                                                {isWithheld ? (
                                                  <>
                                                    <Unlock className="h-3 w-3" /> Un-Withhold
                                                  </>
                                                ) : (
                                                  <>
                                                    <Lock className="h-3 w-3" /> Withhold Result
                                                  </>
                                                )}
                                              </button>
                                            ) : (
                                              <span className="text-[10px] text-muted-foreground/60">
                                                N/A
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* TAB 2: GRACE CHANCE APPLICATIONS */}
                  {recordModalTab === 'grace' && (
                    <div className="space-y-4">
                      {graceAppsList.length === 0 ? (
                        <div className="p-12 text-center bg-secondary/10 border border-border/60 rounded-2xl text-muted-foreground text-xs">
                          No grace chance applications submitted by this student.
                        </div>
                      ) : (
                        graceAppsList.map((app: any) => (
                          <div
                            key={app.grace_id}
                            className="p-5 bg-secondary/10 border border-border/60 rounded-2xl space-y-3 text-xs"
                          >
                            <div className="flex justify-between items-center border-b border-border/40 pb-2">
                              <span className="font-bold text-foreground flex items-center gap-1.5">
                                <FileCheck className="h-4 w-4 text-primary" /> Application #
                                {app.grace_id}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                  app.status === 'APPROVED'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : app.status === 'REJECTED'
                                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }`}
                              >
                                {app.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-muted-foreground">
                              <div>
                                Faculty: <strong className="text-foreground">{app.faculty}</strong>
                              </div>
                              <div>
                                Total Credits:{' '}
                                <strong className="text-foreground">{app.total_credits}</strong>
                              </div>
                              <div>
                                Incomplete Credits:{' '}
                                <strong className="text-foreground">
                                  {app.total_incomplete_credits}
                                </strong>
                              </div>
                              <div>
                                Credit Percentage:{' '}
                                <strong className="text-primary font-mono">
                                  {app.credit_percentage}%
                                </strong>
                              </div>
                            </div>
                            {app.incomplete_subjects && Array.isArray(app.incomplete_subjects) && (
                              <div className="space-y-1 pt-1">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                  Incomplete Subjects Requested:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {app.incomplete_subjects.map((sub: any, idx: number) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 bg-secondary/40 border border-border/60 rounded font-mono text-[10px] text-foreground"
                                    >
                                      {sub.code} - {sub.title} ({sub.credits} credits)
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 3: RECORRECTION REQUESTS */}
                  {recordModalTab === 'recorrections' && (
                    <div className="space-y-4">
                      {recorrectionReqsList.length === 0 ? (
                        <div className="p-12 text-center bg-secondary/10 border border-border/60 rounded-2xl text-muted-foreground text-xs">
                          No recorrection requests submitted by this student.
                        </div>
                      ) : (
                        recorrectionReqsList.map((req: any) => (
                          <div
                            key={req.recorrection_id}
                            className="p-5 bg-secondary/10 border border-border/60 rounded-2xl space-y-3 text-xs"
                          >
                            <div className="flex justify-between items-center border-b border-border/40 pb-2">
                              <span className="font-bold text-foreground flex items-center gap-1.5">
                                <FileText className="h-4 w-4 text-primary" /> Recorrection #
                                {req.recorrection_id} ({req.exam_name})
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                  req.status === 'APPROVED'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : req.status === 'REJECTED'
                                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }`}
                              >
                                {req.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-muted-foreground">
                              <div>
                                Academic Year:{' '}
                                <strong className="text-foreground">{req.academic_year}</strong>
                              </div>
                              <div>
                                Semester:{' '}
                                <strong className="text-foreground">{req.semester}</strong>
                              </div>
                              <div>
                                Total Paid:{' '}
                                <strong className="text-primary font-mono">
                                  LKR {req.total_amount_paid}
                                </strong>
                              </div>
                            </div>
                            {req.subjects && Array.isArray(req.subjects) && (
                              <div className="space-y-1 pt-1">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                  Requested Subjects:
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {req.subjects.map((sub: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="p-2 bg-secondary/30 border border-border/40 rounded-xl flex justify-between items-center"
                                    >
                                      <div>
                                        <span className="font-bold font-mono text-foreground">
                                          {sub.course_code}
                                        </span>
                                        <p className="text-[10px] text-muted-foreground">
                                          {sub.course_name}
                                        </p>
                                      </div>
                                      <div className="text-right font-mono">
                                        <span className="font-bold text-primary">
                                          {sub.grade_received}
                                        </span>
                                        <p className="text-[10px] text-muted-foreground">
                                          {sub.marks_received} Marks
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {req.receipt_url && (
                              <div className="pt-2 border-t border-border/40 flex justify-end">
                                <a
                                  href={req.receipt_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary text-foreground hover:bg-secondary/80 rounded-lg text-xs font-bold transition cursor-pointer"
                                >
                                  <ExternalLink className="h-3 w-3" /> View Payment Receipt
                                </a>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 4: MEDICAL SUBMISSIONS */}
                  {recordModalTab === 'medicals' && (
                    <div className="space-y-4">
                      {medicalSubsList.length === 0 ? (
                        <div className="p-12 text-center bg-secondary/10 border border-border/60 rounded-2xl text-muted-foreground text-xs">
                          No exam medical certificates submitted by this student.
                        </div>
                      ) : (
                        medicalSubsList.map((med: any) => (
                          <div
                            key={med.medical_id}
                            className="p-5 bg-secondary/10 border border-border/60 rounded-2xl space-y-3 text-xs"
                          >
                            <div className="flex justify-between items-center border-b border-border/40 pb-2">
                              <span className="font-bold text-foreground flex items-center gap-1.5">
                                <Stethoscope className="h-4 w-4 text-primary" /> Medical Submission
                                #{med.medical_id} ({med.exam_name})
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                  med.status === 'APPROVED'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : med.status === 'REJECTED'
                                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }`}
                              >
                                {med.status}
                              </span>
                            </div>
                            {med.subjects && Array.isArray(med.subjects) && (
                              <div className="space-y-1 pt-1">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                  Affected Exam Subjects:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {med.subjects.map((s: any, idx: number) => (
                                    <span
                                      key={idx}
                                      className="px-2.5 py-1 bg-secondary/40 border border-border/60 rounded-lg text-foreground font-mono text-[10px]"
                                    >
                                      {s.course_code} - {s.title} ({s.date})
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="pt-2 border-t border-border/40 flex gap-2 justify-end">
                              {med.medical_certificate_url && (
                                <a
                                  href={med.medical_certificate_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-secondary text-foreground hover:bg-secondary/80 rounded-lg text-xs font-bold transition cursor-pointer"
                                >
                                  <ExternalLink className="h-3 w-3" /> Medical Certificate
                                </a>
                              )}
                              {med.request_letter_url && (
                                <a
                                  href={med.request_letter_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-secondary text-foreground hover:bg-secondary/80 rounded-lg text-xs font-bold transition cursor-pointer"
                                >
                                  <ExternalLink className="h-3 w-3" /> Request Letter
                                </a>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end p-4 border-t border-border/60 bg-secondary/15 shrink-0">
                <button
                  onClick={() => setSelectedStudentRecordId(null)}
                  className="px-5 py-2 bg-secondary text-secondary-foreground font-bold rounded-xl hover:bg-secondary/80 transition-colors text-xs cursor-pointer"
                >
                  Close Record View
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STAFF EXAM VIOLATION MODAL */}
        {violationModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="bg-card border border-border/80 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-6 animate-scaleUp">
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
                    setViolationMsg({ type: 'error', text: 'Please select a valid Student.' });
                    return;
                  }

                  if (
                    !confirm(
                      `Are you sure you want to mark an Exam Violation for this student in Semester ${violationSemester}? This will hold results for this semester, cap repeat grades at C, hold next semester exams, and move student records to the bottom of lecturer spreadsheets.`,
                    )
                  ) {
                    return;
                  }

                  setViolationSubmitting(true);
                  setViolationMsg(null);
                  try {
                    // Convert batch string (e.g. 21/22 or 2021) into numeric academic year for backend API
                    let parsedYear = new Date().getFullYear();
                    if (violationBatch) {
                      if (violationBatch.includes('/')) {
                        const parts = violationBatch.split('/');
                        const y1 = parseInt(parts[0], 10);
                        if (!isNaN(y1)) parsedYear = y1 < 100 ? 2000 + y1 : y1;
                      } else {
                        const match = violationBatch.match(/\d{4}/);
                        if (match) parsedYear = parseInt(match[0], 10);
                        else {
                          const val = parseInt(violationBatch, 10);
                          if (!isNaN(val)) parsedYear = val < 100 ? 2000 + val : val;
                        }
                      }
                    }

                    const res = await apiClient.post('/results/violations', {
                      studentId: Number(violationStudentId),
                      academicYear: parsedYear,
                      semester: violationSemester,
                      reason: violationReason || undefined,
                    });
                    if (res.data?.success) {
                      setViolationMsg({ type: 'success', text: res.data.message });
                      setViolationReason('');
                      refetchFullRecord();
                      queryClient.invalidateQueries({ queryKey: ['staff-students-directory'] });
                      setTimeout(() => setViolationModalOpen(false), 1500);
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
                {violationStudentDetails && (
                  <div className="p-3 bg-secondary/30 rounded-xl border border-border/60">
                    <p className="font-bold text-foreground text-xs">
                      {violationStudentDetails.name}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      Reg No: {violationStudentDetails.registration_number} | Index:{' '}
                      {violationStudentDetails.index_number}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-muted-foreground mb-1">Batch</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 21/22"
                      value={violationBatch}
                      onChange={(e) => setViolationBatch(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/60 font-mono"
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

                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[11px] text-rose-300">
                  ⚠️ Marking an exam violation will hold results for Semester {violationSemester},
                  cap repeat grades at C, hold next semester exams, and auto-enroll student in the
                  next batch.
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setViolationModalOpen(false)}
                    className="px-4 py-2 bg-secondary text-secondary-foreground font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={violationSubmitting}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl shadow-md transition disabled:opacity-50"
                  >
                    {violationSubmitting ? 'Saving...' : 'Confirm & Mark Violation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER LECTURER CONSOLE (Allocated Roster)
  // ==========================================
  // Dummy data fallbacks for lecturer view demonstration
  const dummyOverview = {
    courseDistribution: [
      {
        courseId: '101',
        courseCode: 'CS3101',
        courseName: 'Database Management Systems',
        studentCount: 48,
        latestSemesterCount: 48,
        batch: '21/22',
        semester: '3.1',
      },
      {
        courseId: '102',
        courseCode: 'CS3102',
        courseName: 'Advanced Web Engineering',
        studentCount: 42,
        latestSemesterCount: 42,
        batch: '21/22',
        semester: '3.1',
      },
      {
        courseId: '103',
        courseCode: 'CS3103',
        courseName: 'Software Architecture & Design',
        studentCount: 35,
        latestSemesterCount: 35,
        batch: '20/21',
        semester: '3.2',
      },
    ],
  };

  const dummyEnrolledStudents = [
    {
      student_id: 1001,
      index_number: 'S2021001',
      registration_number: '2021/CS/001',
      user: { full_name: 'Kavindu Perera', email: 'kavindu.p@univ.ac.lk' },
      batch: '21/22',
      academic_year: 2021,
      ca_marks: '88.5',
      final_grade: 'A',
    },
    {
      student_id: 1002,
      index_number: 'S2021002',
      registration_number: '2021/CS/002',
      user: { full_name: 'Nipuni Fernando', email: 'nipuni.f@univ.ac.lk' },
      batch: '21/22',
      academic_year: 2021,
      ca_marks: '76.0',
      final_grade: 'B+',
    },
    {
      student_id: 1003,
      index_number: 'S2021003',
      registration_number: '2021/CS/003',
      user: { full_name: 'Tharindu Silva', email: 'tharindu.s@univ.ac.lk' },
      batch: '21/22',
      academic_year: 2021,
      ca_marks: '92.0',
      final_grade: 'A+',
    },
    {
      student_id: 1004,
      index_number: 'S2020045',
      registration_number: '2020/CS/045',
      user: { full_name: 'Dinusha Jayasinghe', email: 'dinusha.j@univ.ac.lk' },
      batch: '20/21',
      academic_year: 2020,
      ca_marks: '65.5',
      final_grade: 'B-',
    },
    {
      student_id: 1005,
      index_number: 'S2021012',
      registration_number: '2021/CS/012',
      user: { full_name: 'Amaya De Silva', email: 'amaya.d@univ.ac.lk' },
      batch: '21/22',
      academic_year: 2021,
      ca_marks: '81.0',
      final_grade: 'A-',
    },
    {
      student_id: 1006,
      index_number: 'S2020088',
      registration_number: '2020/CS/088',
      user: { full_name: 'Rohan Wickramasinghe', email: 'rohan.w@univ.ac.lk' },
      batch: '20/21',
      academic_year: 2020,
      ca_marks: '54.0',
      final_grade: 'C+',
    },
    {
      student_id: 1007,
      index_number: 'S2021054',
      registration_number: '2021/CS/054',
      user: { full_name: 'Sanduni Ratnayake', email: 'sanduni.r@univ.ac.lk' },
      batch: '21/22',
      academic_year: 2021,
      ca_marks: '78.5',
      final_grade: 'B+',
    },
    {
      student_id: 1008,
      index_number: 'S2021099',
      registration_number: '2021/CS/099',
      user: { full_name: 'Pathum Nissanka', email: 'pathum.n@univ.ac.lk' },
      batch: '21/22',
      academic_year: 2021,
      ca_marks: '84.0',
      final_grade: 'A-',
    },
  ];

  // Overview distribution data (real API or dummy)
  const overviewDistribution =
    studentsOverviewData?.courseDistribution && studentsOverviewData.courseDistribution.length > 0
      ? studentsOverviewData.courseDistribution
      : dummyOverview.courseDistribution;

  // Active enrolled students data (real API or dummy)
  const baseStudents = enrolledStudents.length > 0 ? enrolledStudents : dummyEnrolledStudents;

  // Filter student list by Search Query and Batch Filter
  const filteredLecturerStudents = baseStudents.filter((student: any) => {
    // 1. Search Query
    const matchesSearch =
      !studentsSearchQuery ||
      (() => {
        const query = studentsSearchQuery.toLowerCase();
        const indexNo = (student.index_number || '').toLowerCase();
        const regNo = (student.registration_number || '').toLowerCase();
        const name = (student.user?.full_name || student.full_name || '').toLowerCase();
        const email = (student.user?.email || student.email || '').toLowerCase();
        return (
          indexNo.includes(query) ||
          regNo.includes(query) ||
          name.includes(query) ||
          email.includes(query)
        );
      })();

    // 2. Batch Filter
    const studentBatch = student.batch || formatBatchDisplay(student) || '21/22';
    const matchesBatch = selectedBatchFilter === 'ALL' || studentBatch === selectedBatchFilter;

    return matchesSearch && matchesBatch;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Student Directory</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Access student rosters registered under your allocated courses, filter by batch, and
          inspect evaluation marks.
        </p>
      </div>

      {/* Registration Distribution by Assigned Course (Full Width) */}
      <div className="bg-card/25 border border-border/80 p-6 rounded-2xl flex items-center justify-between backdrop-blur-sm shadow-md w-full">
        <div className="space-y-4 w-full">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              enrollment Distribution
            </span>
            <span className="text-xs text-muted-foreground">
              Showing enrolled student count of latest semester
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {overviewDistribution.map((dist: any) => {
              const batchLabel = dist.batch || '21/22';
              const latestCount = dist.latestSemesterCount ?? dist.studentCount ?? 42;

              return (
                <div
                  key={dist.courseId}
                  onClick={() => {
                    setSelectedLecturerCourseId(dist.courseId.toString());
                    setSelectedBatchFilter(dist.batch || '21/22');
                    setStudentsSearchQuery('');
                  }}
                  className={`p-4 border transition-all rounded-2xl flex justify-between items-center cursor-pointer group backdrop-blur-sm ${
                    selectedLecturerCourseId === dist.courseId.toString()
                      ? 'bg-primary/10 border-primary shadow-md'
                      : 'bg-secondary/10 border-border/60 hover:border-primary/40 hover:bg-secondary/20'
                  }`}
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/25 rounded uppercase">
                        {dist.courseCode}
                      </span>
                      {/* Learning Batch Badge */}
                      <span className="text-[9px] font-bold font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
                        Batch {batchLabel}
                      </span>
                    </div>
                    <h5 className="font-bold text-xs text-foreground truncate group-hover:text-primary transition-colors font-sans pt-0.5">
                      {dist.courseName}
                    </h5>
                  </div>
                  <div className="text-right shrink-0 pl-3">
                    <span className="text-lg font-extrabold text-foreground group-hover:text-primary transition-colors font-mono">
                      {latestCount}
                    </span>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                      Students Enrolled
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Course Selector & Student List */}
      {(() => {
        const lecturerAvailableBatches = Array.from(
          new Set(
            lecturerCourses.map((c: any) => String(c.academic_year || c.batch || '2024').trim()),
          ),
        ).sort();

        const lecturerAvailableSemesters = Array.from(
          new Set(lecturerCourses.map((c: any) => (c.semester ? String(c.semester).trim() : ''))),
        )
          .filter(Boolean)
          .sort();

        const filteredLecturerCourses = lecturerCourses.filter((c: any) => {
          const matchBatch =
            selectedCourseBatchFilter === 'ALL' ||
            String(c.academic_year) === selectedCourseBatchFilter ||
            String(c.batch) === selectedCourseBatchFilter;
          const matchSemester =
            selectedCourseSemesterFilter === 'ALL' ||
            String(c.semester) === selectedCourseSemesterFilter;
          return matchBatch && matchSemester;
        });

        const activeCoursesList =
          filteredLecturerCourses.length > 0 ? filteredLecturerCourses : lecturerCourses;

        return (
          <React.Fragment>
            <div className="bg-card/20 border border-border/60 p-6 rounded-3xl backdrop-blur-sm space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Select Allocated Course
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Choose a course to load its enrolled student list.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  {/* Batch Filter */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                      Batch (Academic Year):
                    </label>
                    <select
                      value={selectedCourseBatchFilter}
                      onChange={(e) => setSelectedCourseBatchFilter(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-xs font-semibold text-foreground"
                    >
                      <option value="ALL">All Batches</option>
                      {lecturerAvailableBatches.map((b) => (
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
                      value={selectedCourseSemesterFilter}
                      onChange={(e) => setSelectedCourseSemesterFilter(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-xs font-semibold text-foreground"
                    >
                      <option value="ALL">All Semesters</option>
                      {lecturerAvailableSemesters.map((s) => (
                        <option key={s} value={s} className="bg-card">
                          Semester {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Course Selection Dropdown */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                      Course Subject ({activeCoursesList.length}):
                    </label>
                    <select
                      value={selectedLecturerCourseId}
                      onChange={(e) => {
                        setSelectedLecturerCourseId(e.target.value);
                        setStudentsSearchQuery('');
                        setSelectedBatchFilter('ALL');
                      }}
                      disabled={isLecturerCoursesLoading}
                      className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-xs font-semibold text-foreground disabled:opacity-50"
                    >
                      <option value="">Choose Course Subject...</option>
                      {activeCoursesList.map((c: any) => (
                        <option
                          key={c.course_id || c.courseId}
                          value={c.course_id || c.courseId}
                          className="bg-card"
                        >
                          {c.course_code || c.courseCode} - {c.course_name || c.courseName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {selectedLecturerCourseId ? (
              <div className="space-y-4 animate-fadeIn">
                {/* Filter Controls Bar (Search + Batch Filter + Counter + Download) */}
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-secondary/15 p-4 rounded-2xl border border-border/60">
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-1">
                    {/* Search Input */}
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search by Index, Reg No, Name..."
                        value={studentsSearchQuery}
                        onChange={(e) => setStudentsSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary transition text-xs text-foreground"
                      />
                    </div>

                    {/* Batch Filter Dropdown */}
                    <div className="w-full sm:w-48 flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground shrink-0">
                        Batch:
                      </span>
                      <select
                        value={selectedBatchFilter}
                        onChange={(e) => setSelectedBatchFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary transition text-xs text-foreground font-semibold"
                      >
                        <option value="ALL">All Batches</option>
                        <option value="21/22">Batch 21/22</option>
                        <option value="20/21">Batch 20/21</option>
                        <option value="19/20">Batch 19/20</option>
                      </select>
                    </div>

                    {/* Record Counter Badge */}
                    <div className="px-3 py-1.5 bg-background border border-border/80 rounded-xl text-xs font-mono font-bold text-foreground flex items-center gap-1.5 shrink-0">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      Showing {Math.min(
                        visibleStudentsLimit,
                        filteredLecturerStudents.length,
                      )} of {filteredLecturerStudents.length} Records
                    </div>
                  </div>

                  <button
                    onClick={handleDownloadStudentsExcel}
                    disabled={isDownloadingExcel || baseStudents.length === 0}
                    className="w-full sm:w-auto px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition text-xs flex items-center justify-center gap-1.5 border border-border/60 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isDownloadingExcel ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5 text-primary" />
                    )}
                    Download Student List
                  </button>
                </div>

                {/* Enrolled Students Roster Table */}
                <div className="border border-border/60 rounded-2xl overflow-hidden shadow-md bg-card/10">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 bg-secondary/20 text-muted-foreground font-bold font-mono">
                        <th className="px-4 py-3.5 w-12 text-center border-r border-border/40">
                          #
                        </th>
                        <th className="px-5 py-3.5">Index Number</th>
                        <th className="px-5 py-3.5">Reg Number</th>
                        <th className="px-5 py-3.5">Student Name</th>

                        <th className="px-5 py-3.5 text-center">Batch</th>
                        <th className="px-5 py-3.5 text-center">CA Marks</th>
                        <th className="px-5 py-3.5 text-center">Final Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-medium">
                      {isEnrolledStudentsLoading ? (
                        <tr>
                          <td colSpan={7} className="text-center py-20 text-muted-foreground">
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                              Loading enrolled students roster...
                            </span>
                          </td>
                        </tr>
                      ) : filteredLecturerStudents.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-20 text-muted-foreground">
                            {studentsSearchQuery || selectedBatchFilter !== 'ALL'
                              ? 'No students match your selected search or batch criteria.'
                              : 'No students registered for this course.'}
                          </td>
                        </tr>
                      ) : (
                        filteredLecturerStudents
                          .slice(0, visibleStudentsLimit)
                          .map((student: any, idx: number) => {
                            const gradeObj =
                              student.grades && student.grades.length > 0
                                ? student.grades[0]
                                : null;
                            const caMarks =
                              student.ca_marks ||
                              (gradeObj
                                ? Number(gradeObj.continuous_assessment_marks).toFixed(1)
                                : '82.5');
                            const finalGrade =
                              student.final_grade || (gradeObj ? gradeObj.grade : 'A');
                            const batchDisplay =
                              student.batch || formatBatchDisplay(student) || '21/22';

                            return (
                              <tr
                                key={student.student_id}
                                className="hover:bg-secondary/15 transition-colors"
                              >
                                <td className="px-4 py-3.5 text-center font-mono font-bold text-muted-foreground border-r border-border/30">
                                  {idx + 1}
                                </td>
                                <td className="px-5 py-3.5 font-bold text-foreground font-mono">
                                  {student.index_number || 'N/A'}
                                </td>
                                <td className="px-5 py-3.5 text-foreground font-mono">
                                  {student.registration_number || 'N/A'}
                                </td>
                                <td className="px-5 py-3.5 text-foreground font-semibold truncate max-w-xs">
                                  {student.user?.full_name || student.full_name}
                                </td>

                                <td className="px-5 py-3.5 text-center">
                                  <span className="px-2.5 py-0.5 bg-secondary/50 text-foreground border border-border/60 rounded-md font-mono font-bold text-[11px]">
                                    {batchDisplay}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-center font-mono font-bold text-primary">
                                  {caMarks}
                                </td>
                                <td className="px-5 py-3.5 text-center">
                                  <span className="px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/25 rounded-md font-bold text-xs">
                                    {finalGrade}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>

                  {/* Progressive Auto-Loading Footer Indicator */}
                  {filteredLecturerStudents.length > 100 && (
                    <div className="p-3 bg-secondary/15 border-t border-border/60 flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {filteredLecturerStudents.length > visibleStudentsLimit ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                            <span>
                              Loaded{' '}
                              <strong className="text-foreground">{visibleStudentsLimit}</strong> of{' '}
                              <strong className="text-foreground">
                                {filteredLecturerStudents.length}
                              </strong>{' '}
                              student records (Auto-loading remaining...)
                            </span>
                          </>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1 font-bold">
                            ✓ All {filteredLecturerStudents.length} student records loaded
                            automatically
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-20 text-center bg-card/10 border border-border/60 rounded-3xl flex flex-col items-center justify-center">
                <Users className="h-10 w-10 text-muted-foreground/45 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No course selected</p>
                <p className="text-xs text-muted-foreground/75 mt-1 max-w-sm">
                  Please choose one of your allocated course subjects from the dropdown list to load
                  the registered students directory.
                </p>
              </div>
            )}
          </React.Fragment>
        );
      })()}

      {/* Student Details Glass Modal (Lecturer) */}
      {selectedLecturerStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-card/95 border border-border rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl backdrop-blur-xl animate-scaleUp">
            <div className="flex justify-between items-center p-6 border-b border-border/60 bg-secondary/15">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary border border-primary/15 rounded-2xl">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Student Roster Profile</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    ID: {selectedLecturerStudentModal.registration_number || 'N/A'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLecturerStudentModal(null)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-xl transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto text-xs sm:text-sm">
              <div className="space-y-3">
                <h4 className="font-bold text-primary uppercase tracking-wider text-[10px]">
                  Academic Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-secondary/10 p-4 rounded-2xl border border-border/40 font-medium">
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Index Number
                    </span>
                    <span className="font-mono text-foreground font-semibold">
                      {selectedLecturerStudentModal.index_number || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Registration Number
                    </span>
                    <span className="font-mono text-foreground font-semibold">
                      {selectedLecturerStudentModal.registration_number || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Degree Program
                    </span>
                    <span className="text-foreground font-semibold">
                      {selectedLecturerStudentModal.degree
                        ? `${selectedLecturerStudentModal.degree.degree_name} (${selectedLecturerStudentModal.degree.degree_code})`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Specialization
                    </span>
                    <span className="text-foreground font-semibold">
                      {selectedLecturerStudentModal.specialization
                        ? `${selectedLecturerStudentModal.specialization.specialization_name} (${selectedLecturerStudentModal.specialization.specialization_code})`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 font-medium">
                <h4 className="font-bold text-primary uppercase tracking-wider text-[10px]">
                  Personal Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-secondary/10 p-4 rounded-2xl border border-border/40">
                  <div className="sm:col-span-2">
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Full Name
                    </span>
                    <span className="text-foreground font-semibold">
                      {selectedLecturerStudentModal.user?.full_name || 'N/A'}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Name with Initials
                    </span>
                    <span className="text-foreground font-semibold">
                      {selectedLecturerStudentModal.user?.name_with_initials || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      NIC / Passport No
                    </span>
                    <span className="font-mono text-foreground font-semibold">
                      {selectedLecturerStudentModal.user?.nic_no || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Date of Birth
                    </span>
                    <span className="text-foreground font-semibold">
                      {selectedLecturerStudentModal.user?.date_of_birth
                        ? new Date(
                            selectedLecturerStudentModal.user.date_of_birth,
                          ).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-primary uppercase tracking-wider text-[10px]">
                  Contact Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-secondary/10 p-4 rounded-2xl border border-border/40 font-medium">
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Email Address
                    </span>
                    <span className="text-foreground font-semibold">
                      {selectedLecturerStudentModal.user?.email || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Phone Number
                    </span>
                    <span className="text-foreground font-semibold">
                      {selectedLecturerStudentModal.user?.phone_number || 'N/A'}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Permanent Address
                    </span>
                    <span className="text-foreground font-semibold leading-normal">
                      {selectedLecturerStudentModal.user?.address || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end p-4 border-t border-border/60 bg-secondary/15">
              <button
                onClick={() => setSelectedLecturerStudentModal(null)}
                className="px-4 py-2 bg-secondary text-secondary-foreground font-bold rounded-xl hover:bg-secondary/80 transition-colors text-xs cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
