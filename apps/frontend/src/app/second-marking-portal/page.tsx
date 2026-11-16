'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '../../lib/api-client';
import { useToast } from '../../hooks/use-toast';
import { useConfirm } from '../../hooks/use-confirm';
import { useAuthStore } from '../../store/authStore';
import { useProgressiveList } from '../../hooks/use-progressive-load';
import { ProgressiveLoadFooter } from '../../components/ui/progressive-load-footer';
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  Upload,
  Download,
  Search,
  Check,
  Award,
  Users,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  FileSpreadsheet,
  GraduationCap,
  Menu,
  X,
  User as UserIcon,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelUploadDialog from '../../components/marks/excel-upload-dialog';

export default function SecondMarkingPortalPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const toast = useToast();
  const confirm = useConfirm();

  const { user, setUser, logout } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [courseData, setCourseData] = useState<any>(null);
  const [examTitle, setExamTitle] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);
  const [tokenEmail, setTokenEmail] = useState<string>('');

  const [questions, setQuestions] = useState<any[]>([]);
  const [secondMarks, setSecondMarks] = useState<{
    [studentId: number]: { [qKey: string]: number };
  }>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasExcelAdded, setHasExcelAdded] = useState(false);

  // Authentication Dialog Form States
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isInitialLoad = useRef(true);

  // 1. Verify Magic Link Token with Backend
  useEffect(() => {
    if (!token) {
      setError('No magic token provided in the URL.');
      setIsLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await apiClient.post('/marks/second-marking/verify', { token });
        const data = res.data?.data;
        if (!data) {
          throw new Error('Failed to load course details from token.');
        }

        setCourseData(data.course);
        setExamTitle(data.examTitle || 'End Semester Examination');
        setStudents(data.students || []);
        setTokenEmail(data.tokenEmail || '');

        let config: any = data.course?.marks_config || {};
        if (typeof config === 'string') {
          try {
            config = JSON.parse(config);
          } catch {
            config = {};
          }
        }

        const qList = config.questions || [
          { key: 'q1', label: 'Q1', maxMarks: 20 },
          { key: 'q2', label: 'Q2', maxMarks: 20 },
          { key: 'q3', label: 'Q3', maxMarks: 20 },
          { key: 'q4', label: 'Q4', maxMarks: 20 },
          { key: 'q5', label: 'Q5', maxMarks: 20 },
        ];
        setQuestions(qList);

        const firstMarks = config.firstMarkerSheet?.marks || {};
        const saved2nd = config.secondMarkerSheet?.marks || {};
        const sub = Boolean(
          config.secondMarkerSheet?.submitted ||
          data.course?.publishing_progress?.second_marking_submitted,
        );
        setIsSubmitted(sub);

        // Populate 2nd marks: saved 2nd marks if exist, otherwise pre-fill with 1st marker marks
        const initial2nd: { [studentId: number]: { [qKey: string]: number } } = {};
        const hasSavedMarks = Object.keys(saved2nd).length > 0;
        if (hasSavedMarks) {
          setHasExcelAdded(true);
        }

        (data.students || []).forEach((st: any) => {
          const sId = st.student_id;
          initial2nd[sId] = {};
          qList.forEach((q: any) => {
            const val = saved2nd[sId]?.[q.key] ?? firstMarks[sId]?.[q.key] ?? 0;
            initial2nd[sId][q.key] = Number(val) || 0;
          });
        });
        setSecondMarks(initial2nd);
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Invalid or expired magic link.');
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  // 2. Auto-save 2nd marker draft changes automatically to backend
  useEffect(() => {
    if (isLoading || isSubmitted || !courseData) return;
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsAutoSaving(true);
        await apiClient.post(`/marks/second-marking/save-draft/${courseData.course_id}`, {
          marks: secondMarks,
          config: { questions },
        });
        setLastSaved(new Date());
      } catch (e) {
        console.warn('Auto-save failed:', e);
      } finally {
        setIsAutoSaving(false);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [secondMarks, questions, courseData, isSubmitted, isLoading]);

  // Helper calculations
  const calculateRowTotal = (studentId: number) => {
    const row = secondMarks[studentId] || {};
    return questions.reduce((sum, q) => sum + (Number(row[q.key]) || 0), 0);
  };

  const calculateRowFinal = (studentId: number) => {
    const totalMax = questions.reduce((sum, q) => sum + (Number(q.maxMarks) || 20), 0);
    const rowTotal = calculateRowTotal(studentId);
    if (totalMax === 0) return 0;
    return Math.round((rowTotal / totalMax) * 100 * 10) / 10;
  };

  // 3. Process 2nd Marking Excel Upload
  const handleProcessSecondMarkingExcel = async (file: File) => {
    if (isSubmitted) return;
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsName = wb.SheetNames[0];
          const ws = wb.Sheets[wsName];
          const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

          if (!rows || rows.length < 2) {
            throw new Error('Invalid Excel sheet layout. Ensure valid rows are present.');
          }

          // Search for header row
          let headerRowIdx = 0;
          for (let i = 0; i < Math.min(10, rows.length); i++) {
            const r = rows[i] || [];
            const hasReg = r.some(
              (cell: any) =>
                String(cell).toLowerCase().includes('reg') ||
                String(cell).toLowerCase().includes('index'),
            );
            if (hasReg) {
              headerRowIdx = i;
              break;
            }
          }

          const headers = (rows[headerRowIdx] || []).map((h: any) => String(h || '').trim());
          const lowerHeaders = headers.map((h: string) => h.toLowerCase());

          const regIdx = lowerHeaders.findIndex((h: string) => h.includes('reg'));
          const indexIdx = lowerHeaders.findIndex((h: string) => h.includes('index'));
          const totalIdx = lowerHeaders.findIndex(
            (h: string) => h === 'total' || h.includes('total'),
          );

          if (regIdx < 0 && indexIdx < 0) {
            throw new Error('Could not locate Registration Number or Index Number column.');
          }

          // Question columns between Index Number and Total
          const qColIndices: { key: string; colIdx: number; name: string }[] = [];
          const startQIdx = indexIdx >= 0 ? indexIdx + 1 : 2;
          const endQIdx = totalIdx >= 0 ? totalIdx : headers.length;

          for (let c = startQIdx; c < endQIdx; c++) {
            const headerName = headers[c];
            if (
              headerName &&
              !lowerHeaders[c].includes('proper') &&
              !lowerHeaders[c].includes('p/r') &&
              !lowerHeaders[c].includes('status') &&
              !lowerHeaders[c].includes('name') &&
              !lowerHeaders[c].includes('student') &&
              !lowerHeaders[c].includes('#')
            ) {
              const key = `q_${c}`;
              qColIndices.push({ key, colIdx: c, name: headerName });
            }
          }

          let resolvedQuestions = questions;
          if (qColIndices.length > 0) {
            resolvedQuestions = qColIndices.map((q) => ({
              key: q.key,
              label: q.name,
              maxMarks: 20,
            }));
            setQuestions(resolvedQuestions);
          }

          const updatedMarks = { ...secondMarks };
          let matchedCount = 0;
          for (let i = headerRowIdx + 1; i < rows.length; i++) {
            const rowData = rows[i];
            if (!rowData || rowData.length === 0) continue;

            const regVal = regIdx >= 0 ? String(rowData[regIdx] || '').trim() : '';
            const idxVal = indexIdx >= 0 ? String(rowData[indexIdx] || '').trim() : '';

            const matchingStudent = students.find((s) => {
              if (regVal && s.registration_number?.toLowerCase() === regVal.toLowerCase())
                return true;
              if (idxVal && s.index_number?.toLowerCase() === idxVal.toLowerCase()) return true;
              return false;
            });

            if (matchingStudent) {
              matchedCount++;
              const sId = matchingStudent.student_id;
              updatedMarks[sId] = updatedMarks[sId] || {};
              resolvedQuestions.forEach((q, qIndex) => {
                const col = qColIndices[qIndex]?.colIdx;
                const val = col !== undefined ? parseFloat(rowData[col]) || 0 : 0;
                updatedMarks[sId][q.key] = val;
              });
            }
          }

          setSecondMarks(updatedMarks);
          setHasExcelAdded(true);

          // Immediately persist draft to backend
          await apiClient.post(`/marks/second-marking/save-draft/${courseData.course_id}`, {
            marks: updatedMarks,
            config: { questions: resolvedQuestions },
          });
          setLastSaved(new Date());

          toast.success(
            `Excel spreadsheet imported successfully for ${matchedCount} student(s)! Results auto-saved.`,
          );
          resolve();
        } catch (err: any) {
          toast.error(err.message || 'Failed to parse Excel file.');
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file from disk.'));
      reader.readAsBinaryString(file);
    });
  };

  // 4. Download Student List Template
  const handleDownloadExcel = () => {
    const dataRows = students.map((st, index) => {
      const row: any = {
        '#': index + 1,
        'Registration Number': st.registration_number || '',
        'Index Number': st.index_number || '',
        'Student Name': st.user?.full_name || st.full_name || '',
        'Proper/Repeat (P/R) Status': st.registrations?.[0]?.attempt_type === 'REPEAT' ? 'R' : 'P',
      };
      questions.forEach((q) => {
        row[q.label] =
          secondMarks[st.student_id]?.[q.key] !== undefined
            ? secondMarks[st.student_id]?.[q.key]
            : '';
      });
      row['Total'] = calculateRowTotal(st.student_id);
      row['Final (Out of 100)'] = calculateRowFinal(st.student_id);
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 22 },
      { wch: 18 },
      { wch: 30 },
      { wch: 15 },
      ...questions.map(() => ({ wch: 10 })),
      { wch: 10 },
      { wch: 14 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '2nd_Marking');
    XLSX.writeFile(
      workbook,
      `${courseData?.course_code || 'Course'}_2nd_Marking_Student_List.xlsx`,
    );
    toast.success(`Downloaded student list for ${dataRows.length} registered student(s).`);
  };

  // 5. Submit 2nd Marking to Course In-Charge
  const handleSubmit = async () => {
    if (isSubmitted) return;
    const confirmed = await confirm({
      title: 'Submit 2nd Marking Results?',
      message:
        'Are you sure you want to submit your 2nd marking results to the Course In-Charge? Once submitted, further editing will be permanently prohibited.',
      confirmText: 'Submit Results',
      variant: 'primary',
    });
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      await apiClient.post(`/marks/second-marking/submit/${courseData.course_id}`, {
        marks: secondMarks,
        config: { questions },
      });

      setIsSubmitted(true);
      toast.success('2nd marking submitted successfully! The Course In-Charge has been notified.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to submit 2nd marking.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. Security Authentication Handler
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authPassword) {
      setAuthError('Please enter your password.');
      return;
    }

    try {
      setIsAuthenticating(true);
      setAuthError(null);
      const res = await apiClient.post('/auth/login', {
        email: tokenEmail,
        password: authPassword,
      });

      if (res.data?.success && res.data?.user) {
        setUser(res.data.user);
        toast.success(`Authenticated successfully as 2nd Marker (${tokenEmail})`);
      } else {
        setAuthError(res.data?.message || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setAuthError(
        err.response?.data?.message || 'Invalid password or unable to verify account credentials.',
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.info('Signed out of 2nd Marker session.');
  };

  // Filter students for table search
  const filteredStudents = useMemo(
    () =>
      students.filter((s) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          s.registration_number?.toLowerCase().includes(q) ||
          s.index_number?.toLowerCase().includes(q) ||
          s.user?.full_name?.toLowerCase().includes(q)
        );
      }),
    [students, searchQuery],
  );

  const {
    visibleItems: visibleStudents,
    visibleCount: visibleStudentsCount,
    totalCount: totalFilteredStudents,
    hasMore: hasMoreStudents,
  } = useProgressiveList<any>(filteredStudents, { resetKey: searchQuery });

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="text-sm font-semibold text-muted-foreground">
          Verifying secure magic link token...
        </p>
      </div>
    );
  }

  // Error / Expired Link Barrier
  if (error || !courseData) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card/60 border border-border/80 rounded-3xl p-8 text-center space-y-4 shadow-2xl backdrop-blur-md">
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-2xl w-fit mx-auto text-destructive">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {error || 'Unable to access 2nd marking evaluation sheet.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold rounded-xl transition"
            >
              Return to EMS Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Security Authentication Gate
  const isEmailMatching = user && user.email.toLowerCase() === tokenEmail.toLowerCase();

  if (!isEmailMatching) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card/40 border border-border/80 rounded-3xl p-8 backdrop-blur-xl shadow-2xl space-y-6 animate-fadeIn">
          <div className="text-center space-y-2">
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl w-fit mx-auto text-primary">
              <ShieldCheck className="h-10 w-10" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Second Marker Verification</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              For academic confidentiality and security, you must authenticate with the registered
              2nd marker email address to view or evaluate this course.
            </p>
          </div>

          {user && !isEmailMatching ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <span className="font-bold text-foreground">Account Mismatch:</span> You are
                  currently logged in as{' '}
                  <span className="font-mono font-bold text-foreground">{user.email}</span>, but
                  this evaluation link is restricted to{' '}
                  <span className="font-mono font-bold text-foreground">{tokenEmail}</span>.
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2 bg-secondary hover:bg-secondary/80 text-foreground font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out & Switch Account
              </button>
            </div>
          ) : (
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Registered Evaluator Email
                </label>
                <input
                  type="email"
                  value={tokenEmail}
                  disabled
                  className="w-full px-3.5 py-2.5 bg-secondary/30 border border-border/80 rounded-xl text-xs font-mono font-bold text-foreground cursor-not-allowed opacity-90"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  EMS Account Password
                </label>
                <input
                  type="password"
                  placeholder="Enter your EMS account password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              {authError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive font-semibold">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isAuthenticating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Authenticate & Access Evaluation
              </button>
            </form>
          )}

          <div className="text-center pt-2">
            <span className="text-[11px] text-muted-foreground font-mono">
              Course: {courseData.course_code} &bull; SLIIT EMS Security Gate
            </span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN SECOND MARKING PORTAL WITH SYSTEM SIDEBAR LAYOUT
  // =========================================================================
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar - Dedicated Single Nav Item (Marks Registry) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-card/60 border-r border-border/60 backdrop-blur-xl flex flex-col justify-between transition-transform duration-300 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="h-20 border-b border-border/60 flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-2xl text-primary shadow-sm">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <span className="text-base font-extrabold tracking-tight text-foreground block leading-tight">
                  EMS Portal
                </span>
                <span className="text-[10px] font-mono text-muted-foreground block">
                  Evaluation Division
                </span>
              </div>
            </div>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Items (Only Marks Registry) */}
          <div className="p-4 space-y-1.5">
            <div className="px-3 py-2 text-[10px] font-mono font-bold text-muted-foreground tracking-wider uppercase">
              Evaluator Navigation
            </div>
            <div className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground font-bold rounded-2xl text-xs shadow-md transition">
              <FileSpreadsheet className="h-4 w-4" />
              Marks Registry
            </div>
          </div>
        </div>

        {/* User Card & Sign Out */}
        <div className="p-4 border-t border-border/60 space-y-3">
          <div className="p-3 bg-secondary/30 border border-border/60 rounded-2xl flex items-center gap-3">
            <div className="p-2 bg-secondary rounded-xl text-primary shrink-0">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-foreground truncate">
                {user?.fullName || 'Second Marker'}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono truncate">
                {tokenEmail}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2 bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="h-16 border-b border-border/60 bg-card/20 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 text-muted-foreground hover:text-foreground rounded-xl border border-border/60"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
              <span>Exam Management System</span>
              <span>/</span>
              <span className="text-foreground font-bold">2nd Marker Evaluation Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAutoSaving && (
              <span className="text-[11px] font-mono text-amber-500 flex items-center gap-1.5 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
                <Loader2 className="h-3 w-3 animate-spin" /> Auto-saving draft...
              </span>
            )}
            {!isAutoSaving && lastSaved && (
              <span className="text-[11px] font-mono text-emerald-500 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">
                <Check className="h-3 w-3" /> All changes auto-saved
              </span>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 md:p-8 space-y-6 flex-1 max-w-7xl w-full mx-auto">
          {/* Top Course Information Banner */}
          <div className="bg-card/40 border border-border/60 rounded-3xl p-6 backdrop-blur-md shadow-sm space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/60 pb-5">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 bg-primary/10 border border-primary/20 text-primary text-[11px] font-mono font-bold rounded-lg uppercase">
                    Second Marker Marksheet
                  </span>
                  {isSubmitted ? (
                    <span className="px-2.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-[11px] font-mono font-bold rounded-lg">
                      Submitted to In-Charge (Locked / View-Only)
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-500 text-[11px] font-mono font-bold rounded-lg">
                      Evaluation In Progress
                    </span>
                  )}
                </div>
                <h1 className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight">
                  {courseData.course_code} &mdash; {courseData.course_name}
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Second Marker Evaluation Marksheet. Download the enrolled student list, evaluate
                  the examination papers, and upload your spreadsheet.
                </p>
              </div>

              {/* Action Buttons in Top Banner */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border/80 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-primary" />
                  Download Student List
                </button>

                {!isSubmitted && (
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border/80 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5 text-primary" />
                    Upload 2nd Marking Excel
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitted || isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-md disabled:opacity-40 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5" />
                  )}
                  {isSubmitted ? 'Submitted to In-Charge' : 'Submit to In-Charge'}
                </button>
              </div>
            </div>

            {/* Course & Exam Metadata Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
              <div className="p-3 bg-secondary/20 border border-border/40 rounded-2xl">
                <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                  Examination
                </span>
                <span className="text-xs font-bold text-foreground truncate block mt-0.5">
                  {examTitle}
                </span>
              </div>
              <div className="p-3 bg-secondary/20 border border-border/40 rounded-2xl">
                <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                  Course Code
                </span>
                <span className="text-xs font-mono font-bold text-foreground block mt-0.5">
                  {courseData.course_code}
                </span>
              </div>
              <div className="p-3 bg-secondary/20 border border-border/40 rounded-2xl">
                <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                  Course Name
                </span>
                <span className="text-xs font-bold text-foreground truncate block mt-0.5">
                  {courseData.course_name}
                </span>
              </div>
              <div className="p-3 bg-secondary/20 border border-border/40 rounded-2xl">
                <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                  Semester
                </span>
                <span className="text-xs font-bold text-foreground block mt-0.5">
                  Semester {courseData.semester}
                </span>
              </div>
              <div className="p-3 bg-secondary/20 border border-border/40 rounded-2xl">
                <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                  Batch
                </span>
                <span className="text-xs font-bold text-foreground block mt-0.5">
                  {courseData.batch || 'All Batches'}
                </span>
              </div>
              <div className="p-3 bg-secondary/20 border border-border/40 rounded-2xl">
                <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                  2nd Marker Status
                </span>
                <span
                  className={`text-xs font-bold block mt-0.5 ${
                    isSubmitted ? 'text-emerald-500' : 'text-amber-500'
                  }`}
                >
                  {isSubmitted ? 'Submitted' : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* Submitted View-Only Alert Banner */}
          {isSubmitted && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
              <div className="text-xs text-muted-foreground">
                <span className="font-bold text-foreground">
                  2nd Marking Submitted Successfully:
                </span>{' '}
                Your evaluations have been officially submitted to the Course In-Charge. This sheet
                is now in <span className="font-bold text-foreground">View-Only</span> mode. Further
                edits are prohibited.
              </div>
            </div>
          )}

          {/* Student Marks Registry Grid (Matching Screenshot UI) */}
          <div className="bg-card/25 border border-border/60 rounded-3xl p-6 backdrop-blur-sm space-y-5 animate-fadeIn shadow-sm">
            {/* Top Grid Title & Search Bar */}
            <div className="border-b border-border/60 pb-5">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Student Marks Registry Grid
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage evaluations across different marksheets.
              </p>
            </div>

            {/* Search & Records Counter Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                {/* Search Bar */}
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search students by Reg No or Index No..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-background border border-border/80 rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Count Badge matching exact styling */}
                <div className="px-3 py-1.5 bg-background border border-border/80 rounded-xl text-xs font-mono font-bold text-foreground flex items-center gap-1.5 shrink-0">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  Showing {visibleStudentsCount} of {totalFilteredStudents} Records
                </div>
              </div>

              {/* Action buttons on Right */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                {!isSubmitted && (
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="px-3.5 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-bold rounded-xl transition text-xs border border-border/80 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5 text-primary" />
                    Upload 2nd Marking Excel
                  </button>
                )}
              </div>
            </div>

            {/* Grid Table */}
            <div className="border border-border/60 rounded-2xl overflow-x-auto shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-secondary/15 text-muted-foreground font-bold font-mono">
                    <th className="px-4 py-4 min-w-12 text-center border-r border-border/40">#</th>
                    <th className="px-6 py-4 min-w-36">Registration Number</th>
                    <th className="px-6 py-4 min-w-32 border-l border-border/40">Index Number</th>
                    <th className="px-4 py-4 min-w-20 text-center border-l border-border/40">
                      P/R
                    </th>

                    {questions.map((q) => (
                      <th
                        key={q.key}
                        className="px-4 py-4 min-w-28 text-center border-l border-border/40 font-bold"
                      >
                        {q.label}
                      </th>
                    ))}

                    <th className="px-5 py-4 min-w-28 text-center border-l border-border/40 bg-secondary/10 text-foreground font-bold font-mono">
                      Total
                    </th>
                    <th className="px-5 py-4 min-w-36 text-center border-l border-border/40 bg-rose-500/10 text-rose-600 font-bold font-mono">
                      Final (100)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6 + questions.length}
                        className="px-6 py-12 text-center text-muted-foreground"
                      >
                        No enrolled student records found matching search.
                      </td>
                    </tr>
                  ) : (
                    visibleStudents.map((student: any, idx: number) => {
                      const rowMarks = secondMarks[student.student_id] || {};
                      const total = calculateRowTotal(student.student_id);
                      const final100 = calculateRowFinal(student.student_id);
                      const isRepeat =
                        student.registrations?.[0]?.attempt_type === 'REPEAT' ||
                        student.attempt_type === 'REPEAT';

                      // Once excel file is added or submitted, manual input is disabled/read-only
                      const isLocked = isSubmitted || hasExcelAdded;

                      return (
                        <tr key={student.student_id} className="hover:bg-secondary/10 transition">
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
                              className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                isRepeat
                                  ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {isRepeat ? 'R' : 'P'}
                            </span>
                          </td>

                          {questions.map((q) => (
                            <td
                              key={q.key}
                              className="px-3 py-2 border-l border-border/30 text-center"
                            >
                              <input
                                type="number"
                                min="0"
                                max={q.maxMarks || 100}
                                disabled={isLocked}
                                readOnly={isLocked}
                                value={rowMarks[q.key] ?? ''}
                                className="w-16 px-2 py-1 bg-secondary/30 border border-border/80 rounded text-center text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-75 disabled:cursor-not-allowed"
                              />
                            </td>
                          ))}

                          <td className="px-5 py-3 border-l border-border/30 text-center font-bold text-foreground bg-secondary/5">
                            {total}
                          </td>
                          <td className="px-5 py-3 border-l border-border/30 text-center font-bold text-rose-600 bg-rose-500/5">
                            {final100}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Progressive Load Footer */}
            <ProgressiveLoadFooter
              loadedCount={visibleStudentsCount}
              totalCount={totalFilteredStudents}
              isLoadingMore={hasMoreStudents}
              hasMore={hasMoreStudents}
              entityLabel="student records"
            />
          </div>
        </main>
      </div>

      {/* Upload 2nd Marking Excel Dialog */}
      <ExcelUploadDialog
        open={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload 2nd Marking Evaluation Sheet"
        subtitle={`Upload evaluated spreadsheet for ${courseData.course_code} - ${courseData.course_name}`}
        expectedHeaders={[
          'Registration Number',
          'Index Number',
          'Question Columns (e.g. Q1, Q2...)',
          'Total',
          'Final (Out of 100)',
        ]}
        notes="You can download the enrolled student list template below, input evaluations, and upload it back here. Column headers are case-insensitive."
        onDownloadTemplate={handleDownloadExcel}
        onUpload={handleProcessSecondMarkingExcel}
      />
    </div>
  );
}
