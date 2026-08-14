'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { apiClient } from '../../../lib/api-client';
import { UserRole } from '@ems/shared';
import { Users, Search, BookOpen, Loader2, Download, Eye, X } from 'lucide-react';

const STABLE_EMPTY_ARRAY: any[] = [];

export default function LecturerStudentsPage() {
  const { user } = useAuthStore();
  const [selectedLecturerCourseId, setSelectedLecturerCourseId] = useState<string>('');
  const [studentsSearchQuery, setStudentsSearchQuery] = useState<string>('');
  const [isDownloadingExcel, setIsDownloadingExcel] = useState<boolean>(false);
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<any | null>(null);

  // 1. Fetch lecturer assigned courses
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

  // 2. Lecturer students overview statistics (unique counts and distribution)
  const { data: studentsOverviewData } = useQuery({
    queryKey: ['lecturer-students-overview'],
    queryFn: async () => {
      const response = await apiClient.get('/marks/my-students-overview');
      return response.data?.data;
    },
    enabled: user?.role === UserRole.LECTURER,
  });

  // 3. Lecturer enrolled students for selected course query
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

  // Filter students based on search query
  const filteredStudents = enrolledStudents.filter((student: any) => {
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

  // Handle excel download of student list
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

  if (user?.role !== UserRole.LECTURER) {
    return (
      <div className="p-8 text-center bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-2xl">
        Access Denied: Only Lecturers are authorized to view the Student Directory.
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
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-20 text-muted-foreground">
                        {studentsSearchQuery
                          ? 'No students match your search criteria.'
                          : 'No students registered for this course.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student: any) => (
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
                            onClick={() => setSelectedStudentForModal(student)}
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

      {/* Student Details Glass Modal */}
      {selectedStudentForModal && (
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
                    ID: {selectedStudentForModal.registration_number || 'N/A'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudentForModal(null)}
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
                      {selectedStudentForModal.index_number || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Registration Number
                    </span>
                    <span className="font-mono text-foreground font-semibold">
                      {selectedStudentForModal.registration_number || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Degree Program
                    </span>
                    <span className="text-foreground font-semibold">
                      {selectedStudentForModal.degree
                        ? `${selectedStudentForModal.degree.degree_name} (${selectedStudentForModal.degree.degree_code})`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Specialization
                    </span>
                    <span className="text-foreground font-semibold">
                      {selectedStudentForModal.specialization
                        ? `${selectedStudentForModal.specialization.specialization_name} (${selectedStudentForModal.specialization.specialization_code})`
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
                      {selectedStudentForModal.user?.full_name || 'N/A'}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Name with Initials
                    </span>
                    <span className="text-foreground font-semibold">
                      {selectedStudentForModal.user?.name_with_initials || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      NIC / Passport No
                    </span>
                    <span className="font-mono text-foreground font-semibold">
                      {selectedStudentForModal.user?.nic_no || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Date of Birth
                    </span>
                    <span className="text-foreground font-semibold">
                      {selectedStudentForModal.user?.date_of_birth
                        ? new Date(selectedStudentForModal.user.date_of_birth).toLocaleDateString(
                            undefined,
                            { year: 'numeric', month: 'long', day: 'numeric' },
                          )
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
                      {selectedStudentForModal.user?.email || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Phone Number
                    </span>
                    <span className="text-foreground font-semibold">
                      {selectedStudentForModal.user?.phone_number || 'N/A'}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Permanent Address
                    </span>
                    <span className="text-foreground font-semibold leading-normal">
                      {selectedStudentForModal.user?.address || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end p-4 border-t border-border/60 bg-secondary/15">
              <button
                onClick={() => setSelectedStudentForModal(null)}
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
