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
  const [isDownloadingExcel, setIsDownloadingExcel] = useState<boolean>(false);
  const [selectedLecturerStudentModal, setSelectedLecturerStudentModal] = useState<any | null>(
    null,
  );

  // ==========================================
  // STAFF & ADMIN SPECIFIC STATES
  // ==========================================
  const [staffSearch, setStaffSearch] = useState<string>('');
  const [staffStatus, setStaffStatus] = useState<string>('ALL');
  const [staffDegreeId, setStaffDegreeId] = useState<string>('');
  const [staffAcademicYear, setStaffAcademicYear] = useState<string>('');
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

  // Filter lecturer students
  const filteredLecturerStudents = enrolledStudents.filter((student: any) => {
    if (!studentsSearchQuery) return true;
    const query = studentsSearchQuery.toLowerCase();
    const indexNo = (student.index_number || '').toLowerCase();
    const regNo = (student.registration_number || '').toLowerCase();
    const name = (student.user?.full_name || '').toLowerCase();
    const email = (student.user?.email || '').toLowerCase();
    return (
      indexNo.includes(query) ||
      regNo.includes(query) ||
      name.includes(query) ||
      email.includes(query)
    );
  });

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
  React.useEffect(() => {
    if (fullRecordData?.student) {
      setEditingStatus(fullRecordData.student.status || 'ACTIVE');
      setEditingEnrollmentDate(
        fullRecordData.student.enrollment_date
          ? new Date(fullRecordData.student.enrollment_date).toISOString().split('T')[0]
          : '',
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

        {/* Filter and Search Bar */}
        <div className="bg-card/25 border border-border/80 p-5 rounded-2xl backdrop-blur-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by Name, Index No, Reg No..."
              value={staffSearch}
              onChange={(e) => {
                setStaffSearch(e.target.value);
                setStaffPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-xs text-foreground"
            />
          </div>

          <div>
            <select
              value={staffDegreeId}
              onChange={(e) => {
                setStaffDegreeId(e.target.value);
                setStaffPage(1);
              }}
              className="w-full px-4 py-2 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-xs text-foreground"
            >
              <option value="">All Degree Programs</option>
              {degreesList.map((d: any) => (
                <option key={d.degree_id} value={d.degree_id} className="bg-card">
                  {d.degree_code} - {d.degree_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <input
              type="number"
              placeholder="Batch / Academic Year (e.g. 2024)"
              value={staffAcademicYear}
              onChange={(e) => {
                setStaffAcademicYear(e.target.value);
                setStaffPage(1);
              }}
              className="w-full px-4 py-2 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-xs text-foreground"
            />
          </div>

          <div className="flex justify-end items-center">
            <span className="text-xs text-muted-foreground font-semibold">
              Found <strong className="text-foreground">{totalStudents}</strong> student record(s)
            </span>
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
                          {st.academic_year}
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

                <button
                  onClick={() => setSelectedStudentRecordId(null)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-xl transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
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
                        {studentRecord?.academic_year}
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
                          Graduation Date
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
      </div>
    );
  }

  // ==========================================
  // RENDER LECTURER CONSOLE (Allocated Roster)
  // ==========================================
  if (user?.role !== UserRole.LECTURER) {
    return (
      <div className="p-8 text-center bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-2xl">
        Access Denied: Only authorized Staff and Lecturers may view the Student Directory.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Student Directory</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Access complete student rosters registered under your allocated course subjects, run
          searches, and view profiles.
        </p>
      </div>

      {/* Landing Statistics Overview */}
      {studentsOverviewData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card/25 border border-border/80 p-6 rounded-2xl flex items-center justify-between backdrop-blur-sm shadow-md">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Enrolled Students
              </span>
              <p className="text-3xl font-extrabold tracking-tight">
                {studentsOverviewData.totalUniqueStudents}
              </p>
              <p className="text-xs text-muted-foreground">
                Registered across all assigned classes
              </p>
            </div>
            <div className="p-3 rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-card/25 border border-border/80 p-6 rounded-2xl flex items-center justify-between backdrop-blur-sm shadow-md md:col-span-2">
            <div className="space-y-3 w-full">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Registration Distribution by Assigned Course
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {studentsOverviewData.courseDistribution.map((dist: any) => (
                  <div
                    key={dist.courseId}
                    onClick={() => setSelectedLecturerCourseId(dist.courseId.toString())}
                    className="p-3 bg-secondary/10 border border-border/40 hover:border-primary/20 hover:bg-secondary/20 transition rounded-xl flex justify-between items-center cursor-pointer group"
                  >
                    <div className="min-w-0">
                      <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/25 rounded uppercase">
                        {dist.courseCode}
                      </span>
                      <h5 className="font-bold text-xs text-foreground mt-1.5 truncate group-hover:text-primary transition-colors font-sans">
                        {dist.courseName}
                      </h5>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-base font-extrabold text-foreground group-hover:text-primary transition-colors">
                        {dist.studentCount}
                      </span>
                      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
                        Students
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Course Selector & Student List */}
      <div className="bg-card/20 border border-border/60 p-6 rounded-3xl backdrop-blur-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Select Allocated Course
            </h3>
            <p className="text-xs text-muted-foreground">
              Choose a course to load its registered student list.
            </p>
          </div>
          <div className="w-full md:w-80">
            <select
              value={selectedLecturerCourseId}
              onChange={(e) => {
                setSelectedLecturerCourseId(e.target.value);
                setStudentsSearchQuery('');
              }}
              disabled={isLecturerCoursesLoading}
              className="w-full px-4 py-2.5 bg-secondary/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground disabled:opacity-50"
            >
              <option value="">Choose Course Subject...</option>
              {lecturerCourses.map((c: any) => (
                <option key={c.course_id} value={c.course_id} className="bg-card">
                  {c.course_code} - {c.course_name} (Sem {c.semester})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedLecturerCourseId ? (
          <div className="space-y-4 animate-fadeIn">
            {/* Filter and Download Header */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-secondary/15 p-4 rounded-2xl border border-border/60">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by Index, Reg No, Name..."
                  value={studentsSearchQuery}
                  onChange={(e) => setStudentsSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary transition text-xs text-foreground"
                />
              </div>

              <button
                onClick={handleDownloadStudentsExcel}
                disabled={isDownloadingExcel || enrolledStudents.length === 0}
                className="w-full sm:w-auto px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition text-xs flex items-center justify-center gap-1.5 border border-border/60 disabled:opacity-50 cursor-pointer"
              >
                {isDownloadingExcel ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-primary" />
                )}
                Download Roster Excel
              </button>
            </div>

            {/* Students Table */}
            <div className="border border-border/60 rounded-2xl overflow-hidden shadow-md">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-secondary/15 text-muted-foreground font-bold font-mono">
                    <th className="px-6 py-4">Index Number</th>
                    <th className="px-6 py-4">Reg Number</th>
                    <th className="px-6 py-4">Student Name</th>
                    <th className="px-6 py-4">Email Address</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-medium">
                  {isEnrolledStudentsLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-20 text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          Loading enrolled students roster...
                        </span>
                      </td>
                    </tr>
                  ) : filteredLecturerStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-20 text-muted-foreground">
                        {studentsSearchQuery
                          ? 'No students match your search criteria.'
                          : 'No students registered for this course.'}
                      </td>
                    </tr>
                  ) : (
                    filteredLecturerStudents.map((student: any) => (
                      <tr
                        key={student.student_id}
                        className="hover:bg-secondary/10 transition-colors"
                      >
                        <td className="px-6 py-3.5 font-bold text-foreground font-mono">
                          {student.index_number || 'N/A'}
                        </td>
                        <td className="px-6 py-3.5 text-foreground font-mono">
                          {student.registration_number || 'N/A'}
                        </td>
                        <td className="px-6 py-3.5 text-muted-foreground truncate max-w-xs">
                          {student.user?.full_name}
                        </td>
                        <td className="px-6 py-3.5 text-muted-foreground">{student.user?.email}</td>
                        <td className="px-6 py-3.5 text-center">
                          <button
                            onClick={() => setSelectedLecturerStudentModal(student)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 rounded-lg transition-all text-[11px] font-bold cursor-pointer"
                          >
                            <Eye className="h-3 w-3" /> View Profile
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-20 text-center bg-card/10 border border-border/60 rounded-3xl flex flex-col items-center justify-center">
            <Users className="h-10 w-10 text-muted-foreground/45 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">No course selected</p>
            <p className="text-xs text-muted-foreground/75 mt-1 max-w-sm">
              Please choose one of your allocated course subjects from the dropdown list to load the
              registered students directory.
            </p>
          </div>
        )}
      </div>

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
