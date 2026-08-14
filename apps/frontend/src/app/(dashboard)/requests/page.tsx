'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import { UserRole } from '@ems/shared';
import { Upload, Plus, Trash2, Download, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';

export default function RequestsPortalPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isStudent = user?.role === UserRole.STUDENT;

  // Active Tab: student history/submissions, staff dashboard
  const [activeTab, setActiveTab] = useState<'submissions' | 'submit'>('submissions');

  // Selected request type for submission
  const [requestType, setRequestType] = useState<'medical' | 'grace' | 'recorrection'>('medical');

  // Detail Modal for reviewing a submission
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [selectedRequestType, setSelectedRequestType] = useState<
    'medical' | 'grace' | 'recorrection' | null
  >(null);

  // -------------------------------------------------------------
  // FORM STATE - MEDICAL SUBMISSION
  // -------------------------------------------------------------
  const [medExamName, setMedExamName] = useState('');
  const [medSubjects, setMedSubjects] = useState<
    Array<{ date: string; course_code: string; title: string }>
  >([{ date: '', course_code: '', title: '' }]);
  const [medCertFile, setMedCertFile] = useState<File | null>(null);
  const [medLetterFile, setMedLetterFile] = useState<File | null>(null);

  // -------------------------------------------------------------
  // FORM STATE - GRACE CHANCE
  // -------------------------------------------------------------
  const [graceRegDate, setGraceRegDate] = useState('');
  const [graceAddress, setGraceAddress] = useState(user?.address || '');
  const [gracePhone, setGracePhone] = useState(user?.phoneNumber || '');
  const [graceFaculty] = useState('Faculty of Technology');
  const [graceTotalCredits] = useState('120');
  const [graceInternCredits, setGraceInternCredits] = useState('0');
  const [graceResearchCredits, setGraceResearchCredits] = useState('0');
  const [graceIndustrialCredits, setGraceIndustrialCredits] = useState('0');
  const [graceCourseCredits, setGraceCourseCredits] = useState('120');
  const [graceIncompleteSubjects, setGraceIncompleteSubjects] = useState<Array<any>>([
    {
      code: '',
      title: '',
      attempts: {
        first: { year: '', semester: '' },
        second: { year: '', semester: '' },
        third: { year: '', semester: '' },
      },
      credits: '',
    },
  ]);
  const [graceTotalIncomplete, setGraceTotalIncomplete] = useState('0');
  const [gracePercentage, setGracePercentage] = useState('0');
  const [graceDeclaration, setGraceDeclaration] = useState(false);

  // -------------------------------------------------------------
  // FORM STATE - RECORRECTION
  // -------------------------------------------------------------
  const [recExamName, setRecExamName] = useState('');
  const [recYear, setRecYear] = useState('');
  const [recSemester, setRecSemester] = useState('');
  const [recSubjects, setRecSubjects] = useState<
    Array<{
      exam_type: string;
      course_code: string;
      course_name: string;
      marks_received: string;
      grade_received: string;
    }>
  >([
    {
      exam_type: 'End-Semester',
      course_code: '',
      course_name: '',
      marks_received: '',
      grade_received: '',
    },
  ]);
  const [recReceiptFile, setRecReceiptFile] = useState<File | null>(null);

  // -------------------------------------------------------------
  // DATA QUERIES
  // -------------------------------------------------------------

  // Student requests list
  const { data: studentRequests, isLoading: isStudentLoading } = useQuery({
    queryKey: ['student-requests'],
    queryFn: async () => {
      const res = await apiClient.get('/requests/student');
      return res.data?.data;
    },
    enabled: isStudent,
  });

  // Staff submissions list
  const { data: staffSubmissions, isLoading: isStaffLoading } = useQuery({
    queryKey: ['staff-submissions'],
    queryFn: async () => {
      const res = await apiClient.get('/requests/all');
      return res.data?.data;
    },
    enabled: !isStudent,
  });

  // -------------------------------------------------------------
  // MUTATIONS (SUBMISSIONS & STATUS UPDATES)
  // -------------------------------------------------------------

  const submitMedicalMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await apiClient.post('/requests/medical', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      alert('Medical submission submitted successfully!');
      queryClient.invalidateQueries({ queryKey: ['student-requests'] });
      // Reset form
      setMedExamName('');
      setMedSubjects([{ date: '', course_code: '', title: '' }]);
      setMedCertFile(null);
      setMedLetterFile(null);
      setActiveTab('submissions');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to submit medical request.');
    },
  });

  const submitGraceMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/requests/grace-chance', payload);
      return res.data;
    },
    onSuccess: () => {
      alert('Grace chance application submitted successfully!');
      queryClient.invalidateQueries({ queryKey: ['student-requests'] });
      // Reset form
      setGraceRegDate('');
      setGraceIncompleteSubjects([
        {
          code: '',
          title: '',
          attempts: {
            first: { year: '', semester: '' },
            second: { year: '', semester: '' },
            third: { year: '', semester: '' },
          },
          credits: '',
        },
      ]);
      setGraceDeclaration(false);
      setActiveTab('submissions');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to submit grace chance request.');
    },
  });

  const submitRecorrectionMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await apiClient.post('/requests/recorrection', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      alert('Recorrection request submitted successfully!');
      queryClient.invalidateQueries({ queryKey: ['student-requests'] });
      // Reset form
      setRecExamName('');
      setRecYear('');
      setRecSemester('');
      setRecSubjects([
        {
          exam_type: 'End-Semester',
          course_code: '',
          course_name: '',
          marks_received: '',
          grade_received: '',
        },
      ]);
      setRecReceiptFile(null);
      setActiveTab('submissions');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to submit recorrection request.');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ type, id, status }: { type: string; id: number; status: string }) => {
      const res = await apiClient.patch(`/requests/${type}/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      alert('Status updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['staff-submissions'] });
      setSelectedRequest(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to update status.');
    },
  });

  // -------------------------------------------------------------
  // HELPER FUNCTIONS
  // -------------------------------------------------------------

  const handleAddMedSubject = () => {
    setMedSubjects([...medSubjects, { date: '', course_code: '', title: '' }]);
  };

  const handleRemoveMedSubject = (index: number) => {
    setMedSubjects(medSubjects.filter((_, i) => i !== index));
  };

  const handleMedSubjectChange = (index: number, field: string, value: string) => {
    const updated = [...medSubjects];
    updated[index] = { ...updated[index], [field]: value };
    setMedSubjects(updated);
  };

  const handleAddGraceSubject = () => {
    setGraceIncompleteSubjects([
      ...graceIncompleteSubjects,
      {
        code: '',
        title: '',
        attempts: {
          first: { year: '', semester: '' },
          second: { year: '', semester: '' },
          third: { year: '', semester: '' },
        },
        credits: '',
      },
    ]);
  };

  const handleRemoveGraceSubject = (index: number) => {
    setGraceIncompleteSubjects(graceIncompleteSubjects.filter((_, i) => i !== index));
  };

  const handleGraceSubjectChange = (
    index: number,
    field: string,
    value: string,
    attemptKey?: 'first' | 'second' | 'third',
    attemptField?: 'year' | 'semester',
  ) => {
    const updated = [...graceIncompleteSubjects];
    if (attemptKey && attemptField) {
      updated[index].attempts[attemptKey][attemptField] = value;
    } else {
      updated[index][field] = value;
    }
    setGraceIncompleteSubjects(updated);
  };

  const handleAddRecSubject = () => {
    setRecSubjects([
      ...recSubjects,
      {
        exam_type: 'End-Semester',
        course_code: '',
        course_name: '',
        marks_received: '',
        grade_received: '',
      },
    ]);
  };

  const handleRemoveRecSubject = (index: number) => {
    setRecSubjects(recSubjects.filter((_, i) => i !== index));
  };

  const handleRecSubjectChange = (index: number, field: string, value: string) => {
    const updated = [...recSubjects];
    updated[index] = { ...updated[index], [field]: value };
    setRecSubjects(updated);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-semibold">
            <CheckCircle className="h-3.5 w-3.5" /> Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-xs font-semibold">
            <XCircle className="h-3.5 w-3.5" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-semibold">
            <Clock className="h-3.5 w-3.5" /> Pending
          </span>
        );
    }
  };

  // -------------------------------------------------------------
  // SUBMISSION DISPATCHERS
  // -------------------------------------------------------------

  const handleMedicalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medExamName) return alert('Please enter the examination name.');
    if (!medCertFile) return alert('Please upload the medical certificate.');

    const formData = new FormData();
    formData.append('exam_name', medExamName);
    formData.append('subjects', JSON.stringify(medSubjects));
    formData.append('medical_certificate', medCertFile);
    if (medLetterFile) {
      formData.append('request_letter', medLetterFile);
    }

    submitMedicalMutation.mutate(formData);
  };

  const handleGraceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!graceRegDate) return alert('Please enter your registration date.');
    if (!graceDeclaration) return alert('Please sign the declaration checkmark.');

    const payload = {
      date_of_registration: graceRegDate,
      address: graceAddress,
      phone: gracePhone,
      faculty: graceFaculty,
      total_credits: graceTotalCredits,
      internship_credits: graceInternCredits,
      research_credits: graceResearchCredits,
      industrial_credits: graceIndustrialCredits,
      course_credits: graceCourseCredits,
      incomplete_subjects: graceIncompleteSubjects,
      total_incomplete_credits: graceTotalIncomplete,
      credit_percentage: gracePercentage,
      declaration_signed: graceDeclaration,
    };

    submitGraceMutation.mutate(payload);
  };

  const handleRecorrectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recExamName) return alert('Please enter the exam name.');
    if (!recYear || !recSemester) return alert('Please fill in year and semester.');
    if (!recReceiptFile) return alert('Please upload your payment receipt.');

    const totalAmount = recSubjects.length * 500;

    const formData = new FormData();
    formData.append('exam_name', recExamName);
    formData.append('academic_year', recYear);
    formData.append('semester', recSemester);
    formData.append('subjects', JSON.stringify(recSubjects));
    formData.append('total_amount_paid', totalAmount.toString());
    formData.append('receipt', recReceiptFile);

    submitRecorrectionMutation.mutate(formData);
  };

  // Trigger Pre-filled PDF Download
  const handleDownloadPdf = (type: string, id: number) => {
    const downloadUrl = `${apiClient.defaults.baseURL || '/api'}/requests/${type}/${id}/pdf`;
    window.open(downloadUrl, '_blank');
  };

  // View Uploaded attachment
  const handleViewAttachment = (filename: string) => {
    const viewUrl = `${apiClient.defaults.baseURL || '/api'}/requests/files/${filename}`;
    window.open(viewUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Student Forms & Requests</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {isStudent
            ? 'Submit exam medical certificates, grace chance applications, and recorrection verification forms online.'
            : 'Review, download filled PDFs, and approve or reject exam-related student requests.'}
        </p>
      </div>

      {isStudent && (
        <div className="flex gap-2 border-b border-border/60 pb-px mb-6">
          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'submissions'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            My Submissions
          </button>
          <button
            onClick={() => setActiveTab('submit')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'submit'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Submit New Request
          </button>
        </div>
      )}

      {/* STUDENT: VIEW SUBMISSIONS */}
      {isStudent && activeTab === 'submissions' && (
        <div className="space-y-6">
          {isStudentLoading ? (
            <div className="text-center py-20 text-muted-foreground">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent inline-block mr-2"></span>
              Loading your request history...
            </div>
          ) : !studentRequests ||
            (studentRequests.medicals.length === 0 &&
              studentRequests.graces.length === 0 &&
              studentRequests.recorrections.length === 0) ? (
            <div className="text-center py-20 bg-card/25 border border-border/80 rounded-2xl p-8">
              <p className="text-muted-foreground">You have not submitted any forms yet.</p>
              <button
                onClick={() => setActiveTab('submit')}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl"
              >
                Submit First Request
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Medical Cards */}
              {studentRequests.medicals.map((req: any) => (
                <div
                  key={req.medical_id}
                  className="bg-card border border-border rounded-2xl p-5 space-y-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-bold rounded-lg uppercase">
                      Medical Form 8.2
                    </span>
                    {getStatusBadge(req.status)}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground line-clamp-1">{req.exam_name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitted: {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <strong>Missed courses:</strong> {req.subjects?.length || 0} subjects
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleDownloadPdf('medical', req.medical_id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground text-xs font-semibold rounded-xl hover:bg-secondary/80 transition"
                    >
                      <Download className="h-3.5 w-3.5" /> PDF
                    </button>
                    <button
                      onClick={() => handleViewAttachment(req.medical_certificate_url)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground text-xs font-semibold rounded-xl hover:bg-secondary/80 transition"
                    >
                      <Eye className="h-3.5 w-3.5" /> Medical cert
                    </button>
                  </div>
                </div>
              ))}

              {/* Grace Cards */}
              {studentRequests.graces.map((req: any) => (
                <div
                  key={req.grace_id}
                  className="bg-card border border-border rounded-2xl p-5 space-y-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-bold rounded-lg uppercase">
                      Grace Chance 8.3
                    </span>
                    {getStatusBadge(req.status)}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Grace Chance Application</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitted: {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <strong>Incomplete Credits:</strong> {req.total_incomplete_credits} (
                    {req.credit_percentage}%)
                  </div>
                  <div className="flex pt-2">
                    <button
                      onClick={() => handleDownloadPdf('grace', req.grace_id)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground text-xs font-semibold rounded-xl hover:bg-secondary/80 transition"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Pre-filled PDF
                    </button>
                  </div>
                </div>
              ))}

              {/* Recorrection Cards */}
              {studentRequests.recorrections.map((req: any) => (
                <div
                  key={req.recorrection_id}
                  className="bg-card border border-border rounded-2xl p-5 space-y-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold rounded-lg uppercase">
                      Recorrection 8.6
                    </span>
                    {getStatusBadge(req.status)}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground line-clamp-1">{req.exam_name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitted: {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <strong>Subjects:</strong> {req.subjects?.length || 0} | Paid: Rs.{' '}
                    {req.total_amount_paid}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleDownloadPdf('recorrection', req.recorrection_id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground text-xs font-semibold rounded-xl hover:bg-secondary/80 transition"
                    >
                      <Download className="h-3.5 w-3.5" /> PDF
                    </button>
                    <button
                      onClick={() => handleViewAttachment(req.receipt_url)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground text-xs font-semibold rounded-xl hover:bg-secondary/80 transition"
                    >
                      <Eye className="h-3.5 w-3.5" /> Receipt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STUDENT: SUBMIT NEW REQUEST */}
      {isStudent && activeTab === 'submit' && (
        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Select Form Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRequestType('medical')}
                className={`py-3 px-4 rounded-xl border text-sm font-bold transition ${
                  requestType === 'medical'
                    ? 'bg-primary/10 text-primary border-primary'
                    : 'bg-secondary/35 border-border hover:bg-secondary/70 text-muted-foreground hover:text-foreground'
                }`}
              >
                Form 8.2: Medical
              </button>
              <button
                type="button"
                onClick={() => setRequestType('grace')}
                className={`py-3 px-4 rounded-xl border text-sm font-bold transition ${
                  requestType === 'grace'
                    ? 'bg-primary/10 text-primary border-primary'
                    : 'bg-secondary/35 border-border hover:bg-secondary/70 text-muted-foreground hover:text-foreground'
                }`}
              >
                Form 8.3: Grace Chance
              </button>
              <button
                type="button"
                onClick={() => setRequestType('recorrection')}
                className={`py-3 px-4 rounded-xl border text-sm font-bold transition ${
                  requestType === 'recorrection'
                    ? 'bg-primary/10 text-primary border-primary'
                    : 'bg-secondary/35 border-border hover:bg-secondary/70 text-muted-foreground hover:text-foreground'
                }`}
              >
                Form 8.6: Recorrection
              </button>
            </div>
          </div>

          <hr className="border-border/60" />

          {/* 1. MEDICAL SUBMISSION FORM */}
          {requestType === 'medical' && (
            <form onSubmit={handleMedicalSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold mb-2">04. Name of the Examination</label>
                <input
                  type="text"
                  placeholder="e.g. 2nd Year 1st Semester September/ October 2022"
                  value={medExamName}
                  onChange={(e) => setMedExamName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold">Details of missed exams</label>
                  <button
                    type="button"
                    onClick={handleAddMedSubject}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold transition"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Course Row
                  </button>
                </div>

                <div className="space-y-3">
                  {medSubjects.map((sub, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="date"
                        value={sub.date}
                        onChange={(e) => handleMedSubjectChange(idx, 'date', e.target.value)}
                        className="flex-1 px-3 py-2 bg-secondary/30 border border-border/80 rounded-lg text-xs"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Course Code"
                        value={sub.course_code}
                        onChange={(e) => handleMedSubjectChange(idx, 'course_code', e.target.value)}
                        className="w-28 px-3 py-2 bg-secondary/30 border border-border/80 rounded-lg text-xs font-mono uppercase"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Course Title"
                        value={sub.title}
                        onChange={(e) => handleMedSubjectChange(idx, 'title', e.target.value)}
                        className="flex-[2] px-3 py-2 bg-secondary/30 border border-border/80 rounded-lg text-xs"
                        required
                      />
                      {medSubjects.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMedSubject(idx)}
                          className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Upload Medical Certificate</label>
                  <div className="relative border-2 border-dashed border-border/80 rounded-xl p-4 text-center hover:bg-secondary/10 transition">
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setMedCertFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      required
                    />
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <Upload className="mx-auto h-5 w-5 text-muted-foreground/80" />
                      <div>
                        {medCertFile ? (
                          <span className="font-bold text-primary">{medCertFile.name}</span>
                        ) : (
                          <span>Click to upload medical certificate (PDF or Image)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">
                    Upload Request Letter (Optional)
                  </label>
                  <div className="relative border-2 border-dashed border-border/80 rounded-xl p-4 text-center hover:bg-secondary/10 transition">
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setMedLetterFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <Upload className="mx-auto h-5 w-5 text-muted-foreground/80" />
                      <div>
                        {medLetterFile ? (
                          <span className="font-bold text-primary">{medLetterFile.name}</span>
                        ) : (
                          <span>Click to upload request letter (PDF or Image)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitMedicalMutation.isPending}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition shadow-lg shadow-primary/10"
              >
                {submitMedicalMutation.isPending
                  ? 'Submitting Form...'
                  : 'Submit Medical Certificate Form'}
              </button>
            </form>
          )}

          {/* 2. GRACE CHANCE FORM */}
          {requestType === 'grace' && (
            <form onSubmit={handleGraceSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Date of Registration</label>
                  <input
                    type="date"
                    value={graceRegDate}
                    onChange={(e) => setGraceRegDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Contact Phone / Mobile No</label>
                  <input
                    type="text"
                    value={gracePhone}
                    onChange={(e) => setGracePhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Address for Communication</label>
                <input
                  type="text"
                  value={graceAddress}
                  onChange={(e) => setGraceAddress(e.target.value)}
                  className="w-full px-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Internship Credits</label>
                  <input
                    type="number"
                    value={graceInternCredits}
                    onChange={(e) => setGraceInternCredits(e.target.value)}
                    className="w-full px-4 py-2 bg-secondary/30 border border-border/80 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Research Credits</label>
                  <input
                    type="number"
                    value={graceResearchCredits}
                    onChange={(e) => setGraceResearchCredits(e.target.value)}
                    className="w-full px-4 py-2 bg-secondary/30 border border-border/80 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Industrial Credits</label>
                  <input
                    type="number"
                    value={graceIndustrialCredits}
                    onChange={(e) => setGraceIndustrialCredits(e.target.value)}
                    className="w-full px-4 py-2 bg-secondary/30 border border-border/80 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Total Course Credits</label>
                  <input
                    type="number"
                    value={graceCourseCredits}
                    onChange={(e) => setGraceCourseCredits(e.target.value)}
                    className="w-full px-4 py-2 bg-secondary/30 border border-border/80 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Total Incomplete Credits</label>
                  <input
                    type="number"
                    value={graceTotalIncomplete}
                    onChange={(e) => setGraceTotalIncomplete(e.target.value)}
                    className="w-full px-4 py-2 bg-secondary/30 border border-border/80 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Credit Percentage (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={gracePercentage}
                    onChange={(e) => setGracePercentage(e.target.value)}
                    className="w-full px-4 py-2 bg-secondary/30 border border-border/80 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold">Details of Incomplete Subjects</label>
                  <button
                    type="button"
                    onClick={handleAddGraceSubject}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold transition"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Subject
                  </button>
                </div>

                <div className="space-y-4">
                  {graceIncompleteSubjects.map((sub, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-secondary/15 border border-border/60 rounded-xl space-y-3"
                    >
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Subject Code"
                          value={sub.code}
                          onChange={(e) => handleGraceSubjectChange(idx, 'code', e.target.value)}
                          className="w-32 px-3 py-2 bg-secondary/30 border border-border/80 rounded-lg text-xs uppercase"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Subject Title"
                          value={sub.title}
                          onChange={(e) => handleGraceSubjectChange(idx, 'title', e.target.value)}
                          className="flex-1 px-3 py-2 bg-secondary/30 border border-border/80 rounded-lg text-xs"
                          required
                        />
                        <input
                          type="number"
                          placeholder="Credits"
                          value={sub.credits}
                          onChange={(e) => handleGraceSubjectChange(idx, 'credits', e.target.value)}
                          className="w-20 px-3 py-2 bg-secondary/30 border border-border/80 rounded-lg text-xs text-center"
                          required
                        />
                        {graceIncompleteSubjects.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGraceSubject(idx)}
                            className="p-1 hover:bg-destructive/10 text-destructive rounded-lg transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="block font-bold mb-1">1st Attempt (Year/Sem)</span>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              placeholder="Year"
                              value={sub.attempts.first.year}
                              onChange={(e) =>
                                handleGraceSubjectChange(idx, '', e.target.value, 'first', 'year')
                              }
                              className="w-1/2 p-1.5 bg-secondary/30 border border-border rounded text-center"
                            />
                            <input
                              type="text"
                              placeholder="Sem"
                              value={sub.attempts.first.semester}
                              onChange={(e) =>
                                handleGraceSubjectChange(
                                  idx,
                                  '',
                                  e.target.value,
                                  'first',
                                  'semester',
                                )
                              }
                              className="w-1/2 p-1.5 bg-secondary/30 border border-border rounded text-center"
                            />
                          </div>
                        </div>
                        <div>
                          <span className="block font-bold mb-1">2nd Attempt (Year/Sem)</span>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              placeholder="Year"
                              value={sub.attempts.second.year}
                              onChange={(e) =>
                                handleGraceSubjectChange(idx, '', e.target.value, 'second', 'year')
                              }
                              className="w-1/2 p-1.5 bg-secondary/30 border border-border rounded text-center"
                            />
                            <input
                              type="text"
                              placeholder="Sem"
                              value={sub.attempts.second.semester}
                              onChange={(e) =>
                                handleGraceSubjectChange(
                                  idx,
                                  '',
                                  e.target.value,
                                  'second',
                                  'semester',
                                )
                              }
                              className="w-1/2 p-1.5 bg-secondary/30 border border-border rounded text-center"
                            />
                          </div>
                        </div>
                        <div>
                          <span className="block font-bold mb-1">3rd Attempt (Year/Sem)</span>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              placeholder="Year"
                              value={sub.attempts.third.year}
                              onChange={(e) =>
                                handleGraceSubjectChange(idx, '', e.target.value, 'third', 'year')
                              }
                              className="w-1/2 p-1.5 bg-secondary/30 border border-border rounded text-center"
                            />
                            <input
                              type="text"
                              placeholder="Sem"
                              value={sub.attempts.third.semester}
                              onChange={(e) =>
                                handleGraceSubjectChange(
                                  idx,
                                  '',
                                  e.target.value,
                                  'third',
                                  'semester',
                                )
                              }
                              className="w-1/2 p-1.5 bg-secondary/30 border border-border rounded text-center"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-secondary/20 rounded-xl border border-border space-y-3">
                <p className="text-xs text-muted-foreground font-bold">
                  DECLARATION OF THE STUDENT:
                </p>
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={graceDeclaration}
                    onChange={(e) => setGraceDeclaration(e.target.checked)}
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary/60 cursor-pointer"
                    id="grace-dec"
                    required
                  />
                  <label htmlFor="grace-dec" className="cursor-pointer">
                    I hereby declare that the information furnished is correct, I am appearing for
                    all failed subjects, I am fully aware that this is a special grace chance, and I
                    will not claim any more chances.
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitGraceMutation.isPending}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition shadow-lg shadow-primary/10"
              >
                {submitGraceMutation.isPending
                  ? 'Submitting Form...'
                  : 'Submit Grace Chance Application'}
              </button>
            </form>
          )}

          {/* 3. RECORRECTION FORM */}
          {requestType === 'recorrection' && (
            <form onSubmit={handleRecorrectionSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold mb-2">Name of the Examination</label>
                  <input
                    type="text"
                    placeholder="e.g. End-Semester Final Examination 2023"
                    value={recExamName}
                    onChange={(e) => setRecExamName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Year / Semester</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Year (e.g. 2)"
                      value={recYear}
                      onChange={(e) => setRecYear(e.target.value)}
                      className="w-1/2 px-3 py-2.5 bg-secondary/30 border border-border rounded-xl text-center"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Sem (e.g. 1)"
                      value={recSemester}
                      onChange={(e) => setRecSemester(e.target.value)}
                      className="w-1/2 px-3 py-2.5 bg-secondary/30 border border-border rounded-xl text-center"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold">Assessments to be verified</label>
                  <button
                    type="button"
                    onClick={handleAddRecSubject}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold transition"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Subject
                  </button>
                </div>

                <div className="space-y-3">
                  {recSubjects.map((sub, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        value={sub.exam_type}
                        onChange={(e) => handleRecSubjectChange(idx, 'exam_type', e.target.value)}
                        className="w-36 px-2 py-2 bg-secondary/30 border border-border rounded-lg text-xs"
                      >
                        <option value="End-Semester">End-Semester</option>
                        <option value="Year-end">Year-end</option>
                        <option value="Final Exam">Final Exam</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Course Code"
                        value={sub.course_code}
                        onChange={(e) => handleRecSubjectChange(idx, 'course_code', e.target.value)}
                        className="w-24 px-3 py-2 bg-secondary/30 border border-border rounded-lg text-xs font-mono uppercase"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Course Name"
                        value={sub.course_name}
                        onChange={(e) => handleRecSubjectChange(idx, 'course_name', e.target.value)}
                        className="flex-1 px-3 py-2 bg-secondary/30 border border-border rounded-lg text-xs"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Marks"
                        value={sub.marks_received}
                        onChange={(e) =>
                          handleRecSubjectChange(idx, 'marks_received', e.target.value)
                        }
                        className="w-16 px-3 py-2 bg-secondary/30 border border-border rounded-lg text-xs text-center"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Grade"
                        value={sub.grade_received}
                        onChange={(e) =>
                          handleRecSubjectChange(idx, 'grade_received', e.target.value)
                        }
                        className="w-14 px-3 py-2 bg-secondary/30 border border-border rounded-lg text-xs text-center uppercase"
                        required
                      />
                      {recSubjects.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRecSubject(idx)}
                          className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 bg-secondary/20 rounded-xl border border-border">
                <div>
                  <span className="block text-xs text-muted-foreground uppercase font-bold">
                    Total Fees Due
                  </span>
                  <span className="text-xl font-bold text-primary">
                    Rs. {recSubjects.length * 500}.00
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    (at the rate of Rs. 500/- per course)
                  </span>
                </div>
                <div className="w-full sm:w-72">
                  <label className="block text-xs font-bold mb-1.5">Upload Payment Receipt</label>
                  <div className="relative border-2 border-dashed border-border/80 rounded-xl p-3 text-center hover:bg-secondary/10 transition">
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setRecReceiptFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      required
                    />
                    <div className="text-[11px] text-muted-foreground">
                      {recReceiptFile ? (
                        <span className="font-bold text-primary">{recReceiptFile.name}</span>
                      ) : (
                        <span>Upload payment slip image/PDF</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitRecorrectionMutation.isPending}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition shadow-lg shadow-primary/10"
              >
                {submitRecorrectionMutation.isPending
                  ? 'Submitting Form...'
                  : 'Submit Verification Form'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* STAFF DASHBOARD VIEW */}
      {!isStudent && (
        <div className="space-y-6">
          {isStaffLoading ? (
            <div className="text-center py-20 text-muted-foreground">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent inline-block mr-2"></span>
              Loading student requests panel...
            </div>
          ) : !staffSubmissions ||
            (staffSubmissions.medicals.length === 0 &&
              staffSubmissions.graces.length === 0 &&
              staffSubmissions.recorrections.length === 0) ? (
            <div className="text-center py-20 bg-card/25 border border-border/80 rounded-2xl p-8 text-muted-foreground">
              No student submissions found in database.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                      <th className="px-6 py-4">Student</th>
                      <th className="px-6 py-4">Form Type</th>
                      <th className="px-6 py-4">Details</th>
                      <th className="px-6 py-4">Submission Date</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-sm font-medium">
                    {/* Medical submissions */}
                    {staffSubmissions.medicals.map((req: any) => (
                      <tr
                        key={`med-${req.medical_id}`}
                        className="hover:bg-secondary/10 transition-colors"
                      >
                        <td className="px-6 py-4.5">
                          <div className="font-bold text-foreground">
                            {req.student?.user?.full_name}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {req.student?.registration_number}
                          </div>
                        </td>
                        <td className="px-6 py-4.5">
                          <span className="px-2 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-bold rounded">
                            Medical Form 8.2
                          </span>
                        </td>
                        <td className="px-6 py-4.5 text-xs text-muted-foreground max-w-xs truncate">
                          {req.exam_name}
                        </td>
                        <td className="px-6 py-4.5 text-xs text-muted-foreground">
                          {new Date(req.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4.5">{getStatusBadge(req.status)}</td>
                        <td className="px-6 py-4.5 text-right space-x-2">
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              setSelectedRequestType('medical');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-xs font-bold transition"
                          >
                            <Eye className="h-3.5 w-3.5" /> Review
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Grace submissions */}
                    {staffSubmissions.graces.map((req: any) => (
                      <tr
                        key={`grace-${req.grace_id}`}
                        className="hover:bg-secondary/10 transition-colors"
                      >
                        <td className="px-6 py-4.5">
                          <div className="font-bold text-foreground">
                            {req.student?.user?.full_name}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {req.student?.registration_number}
                          </div>
                        </td>
                        <td className="px-6 py-4.5">
                          <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-bold rounded">
                            Grace Chance 8.3
                          </span>
                        </td>
                        <td className="px-6 py-4.5 text-xs text-muted-foreground max-w-xs truncate">
                          Faculty: {req.faculty} | Credits: {req.total_incomplete_credits}{' '}
                          incomplete
                        </td>
                        <td className="px-6 py-4.5 text-xs text-muted-foreground">
                          {new Date(req.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4.5">{getStatusBadge(req.status)}</td>
                        <td className="px-6 py-4.5 text-right space-x-2">
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              setSelectedRequestType('grace');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-xs font-bold transition"
                          >
                            <Eye className="h-3.5 w-3.5" /> Review
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Recorrection submissions */}
                    {staffSubmissions.recorrections.map((req: any) => (
                      <tr
                        key={`rec-${req.recorrection_id}`}
                        className="hover:bg-secondary/10 transition-colors"
                      >
                        <td className="px-6 py-4.5">
                          <div className="font-bold text-foreground">
                            {req.student?.user?.full_name}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {req.student?.registration_number}
                          </div>
                        </td>
                        <td className="px-6 py-4.5">
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold rounded">
                            Recorrection 8.6
                          </span>
                        </td>
                        <td className="px-6 py-4.5 text-xs text-muted-foreground max-w-xs truncate">
                          {req.exam_name} | Fee: Rs. {req.total_amount_paid}
                        </td>
                        <td className="px-6 py-4.5 text-xs text-muted-foreground">
                          {new Date(req.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4.5">{getStatusBadge(req.status)}</td>
                        <td className="px-6 py-4.5 text-right space-x-2">
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              setSelectedRequestType('recorrection');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-xs font-bold transition"
                          >
                            <Eye className="h-3.5 w-3.5" /> Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REVIEW DETAILS MODAL */}
      {selectedRequest && selectedRequestType && (
        <div className="fixed inset-0 bg-background/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-foreground">Review Submission Detail</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Form Type: {selectedRequestType.toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setSelectedRequestType(null);
                }}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <hr className="border-border/60" />

            {/* Student Info Box */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-secondary/15 rounded-xl border border-border/40 text-xs">
              <div>
                <span className="block text-muted-foreground">Student Name</span>
                <span className="font-bold">
                  {selectedRequest.student?.user?.full_name || 'N/A'}
                </span>
              </div>
              <div>
                <span className="block text-muted-foreground">Registration No</span>
                <span className="font-bold font-mono">
                  {selectedRequest.student?.registration_number || 'N/A'}
                </span>
              </div>
              <div>
                <span className="block text-muted-foreground">Index No</span>
                <span className="font-bold font-mono">
                  {selectedRequest.student?.index_number || 'N/A'}
                </span>
              </div>
              <div>
                <span className="block text-muted-foreground">Date Submitted</span>
                <span className="font-bold">
                  {new Date(selectedRequest.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Submission specific details */}
            {selectedRequestType === 'medical' && (
              <div className="space-y-4 text-sm">
                <div>
                  <span className="block text-xs text-muted-foreground font-bold uppercase mb-1">
                    04. Name of the Examination
                  </span>
                  <p className="font-semibold">{selectedRequest.exam_name}</p>
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground font-bold uppercase mb-1.5">
                    Missed Exam Subjects
                  </span>
                  <table className="w-full border-collapse border border-border text-xs text-left">
                    <thead>
                      <tr className="bg-secondary/20">
                        <th className="p-2 border border-border">Date of Exam</th>
                        <th className="p-2 border border-border">Course Code</th>
                        <th className="p-2 border border-border">Title</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRequest.subjects?.map((sub: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-2 border border-border">{sub.date}</td>
                          <td className="p-2 border border-border font-mono">{sub.course_code}</td>
                          <td className="p-2 border border-border">{sub.title}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewAttachment(selectedRequest.medical_certificate_url)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-xl hover:bg-secondary/95 transition"
                  >
                    View Medical Certificate
                  </button>
                  {selectedRequest.request_letter_url && (
                    <button
                      onClick={() => handleViewAttachment(selectedRequest.request_letter_url)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-xl hover:bg-secondary/95 transition"
                    >
                      View Request Letter
                    </button>
                  )}
                </div>
              </div>
            )}

            {selectedRequestType === 'grace' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <span className="text-muted-foreground block">Faculty</span>
                    <span className="font-bold">{selectedRequest.faculty}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Phone No</span>
                    <span className="font-bold">{selectedRequest.phone}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Date of Reg</span>
                    <span className="font-bold">
                      {new Date(selectedRequest.date_of_registration).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Credit Percentage</span>
                    <span className="font-bold text-primary">
                      {selectedRequest.credit_percentage}%
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block">Address</span>
                  <span className="font-bold">{selectedRequest.address}</span>
                </div>

                <div className="p-3 bg-secondary/10 border border-border/60 rounded-xl grid grid-cols-5 gap-2 text-center">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Total Program</span>
                    <span className="font-bold">{selectedRequest.total_credits}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Internship</span>
                    <span className="font-bold">{selectedRequest.internship_credits}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Research</span>
                    <span className="font-bold">{selectedRequest.research_credits}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Industrial</span>
                    <span className="font-bold">{selectedRequest.industrial_credits}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Total Courses</span>
                    <span className="font-bold">{selectedRequest.course_credits}</span>
                  </div>
                </div>

                <div>
                  <span className="block font-bold mb-1.5 uppercase text-muted-foreground text-[10px]">
                    Incomplete Subjects Details
                  </span>
                  <table className="w-full border border-border text-left">
                    <thead>
                      <tr className="bg-secondary/20">
                        <th className="p-2 border border-border">Subject Code & Title</th>
                        <th className="p-2 border border-border text-center">1st Attempt</th>
                        <th className="p-2 border border-border text-center">2nd Attempt</th>
                        <th className="p-2 border border-border text-center">3rd Attempt</th>
                        <th className="p-2 border border-border text-center">Credits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRequest.incomplete_subjects?.map((sub: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-2 border border-border font-bold">
                            {sub.code} - {sub.title}
                          </td>
                          <td className="p-2 border border-border text-center font-mono">
                            {sub.attempts?.first?.year
                              ? `${sub.attempts.first.year}/${sub.attempts.first.semester}`
                              : 'N/A'}
                          </td>
                          <td className="p-2 border border-border text-center font-mono">
                            {sub.attempts?.second?.year
                              ? `${sub.attempts.second.year}/${sub.attempts.second.semester}`
                              : 'N/A'}
                          </td>
                          <td className="p-2 border border-border text-center font-mono">
                            {sub.attempts?.third?.year
                              ? `${sub.attempts.third.year}/${sub.attempts.third.semester}`
                              : 'N/A'}
                          </td>
                          <td className="p-2 border border-border text-center font-bold">
                            {sub.credits}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedRequestType === 'recorrection' && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="block text-xs text-muted-foreground uppercase font-bold">
                      Exam Name
                    </span>
                    <span className="font-semibold">{selectedRequest.exam_name}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground uppercase font-bold">
                      Year / Semester
                    </span>
                    <span className="font-semibold">
                      Year {selectedRequest.academic_year} Semester {selectedRequest.semester}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground uppercase font-bold">
                      Amount Paid
                    </span>
                    <span className="font-semibold text-primary">
                      Rs. {selectedRequest.total_amount_paid}.00
                    </span>
                  </div>
                </div>

                <div>
                  <span className="block text-xs text-muted-foreground font-bold uppercase mb-1.5">
                    Assessments to be verified
                  </span>
                  <table className="w-full border border-border text-xs text-left">
                    <thead>
                      <tr className="bg-secondary/20">
                        <th className="p-2 border border-border">Exam Type</th>
                        <th className="p-2 border border-border">Course Code & Name</th>
                        <th className="p-2 border border-border text-center">Marks Received</th>
                        <th className="p-2 border border-border text-center">Grade Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRequest.subjects?.map((sub: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-2 border border-border">{sub.exam_type}</td>
                          <td className="p-2 border border-border font-semibold">
                            {sub.course_code} - {sub.course_name}
                          </td>
                          <td className="p-2 border border-border text-center">
                            {sub.marks_received}
                          </td>
                          <td className="p-2 border border-border text-center font-bold">
                            {sub.grade_received}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex">
                  <button
                    onClick={() => handleViewAttachment(selectedRequest.receipt_url)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-xl hover:bg-secondary/95 transition"
                  >
                    View Original Payment Receipt / Slip
                  </button>
                </div>
              </div>
            )}

            <hr className="border-border/60" />

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pt-2">
              <button
                onClick={() =>
                  handleDownloadPdf(
                    selectedRequestType,
                    selectedRequestType === 'medical'
                      ? selectedRequest.medical_id
                      : selectedRequestType === 'grace'
                        ? selectedRequest.grace_id
                        : selectedRequest.recorrection_id,
                  )
                }
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/25 rounded-xl text-xs font-bold transition"
              >
                <Download className="h-4 w-4" /> Download Official Filled PDF Form
              </button>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() =>
                    updateStatusMutation.mutate({
                      type: selectedRequestType,
                      id:
                        selectedRequestType === 'medical'
                          ? selectedRequest.medical_id
                          : selectedRequestType === 'grace'
                            ? selectedRequest.grace_id
                            : selectedRequest.recorrection_id,
                      status: 'APPROVED',
                    })
                  }
                  disabled={updateStatusMutation.isPending}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl text-xs font-bold transition"
                >
                  Approve Request
                </button>
                <button
                  onClick={() =>
                    updateStatusMutation.mutate({
                      type: selectedRequestType,
                      id:
                        selectedRequestType === 'medical'
                          ? selectedRequest.medical_id
                          : selectedRequestType === 'grace'
                            ? selectedRequest.grace_id
                            : selectedRequest.recorrection_id,
                      status: 'REJECTED',
                    })
                  }
                  disabled={updateStatusMutation.isPending}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-rose-500 text-white hover:bg-rose-600 rounded-xl text-xs font-bold transition"
                >
                  Reject Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
