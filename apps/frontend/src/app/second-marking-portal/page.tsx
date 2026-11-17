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
  Users,
  LogOut,
  FileSpreadsheet,
  GraduationCap,
  Menu,
  X,
  User as UserIcon,
  Send,
  RefreshCw,
  Mail,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelUploadDialog from '../../components/marks/excel-upload-dialog';

export default function SecondMarkingPortalPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const toast = useToast();
  const confirm = useConfirm();

  const { user, logout } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [courseData, setCourseData] = useState<any>(null);
  const [examTitle, setExamTitle] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);
  const [tokenEmail, setTokenEmail] = useState<string>('');

  const [questions, setQuestions] = useState<any[]>([]);
  const [firstMarkerMarks, setFirstMarkerMarks] = useState<{
    [studentId: number]: { [qKey: string]: number };
  }>({});
  const [secondMarks, setSecondMarks] = useState<{
    [studentId: number]: { [qKey: string]: number };
  }>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [_lastSaved, setLastSaved] = useState<Date | null>(null);
  void _lastSaved;
  const [hasExcelAdded, setHasExcelAdded] = useState(false);

  const [isSignedOut, setIsSignedOut] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isInitialLoad = useRef(true);

  const [retryCount, setRetryCount] = useState(0);

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

        let qList = config.questions || [
          { key: 'q1', label: 'Q1', maxMarks: 20 },
          { key: 'q2', label: 'Q2', maxMarks: 20 },
          { key: 'q3', label: 'Q3', maxMarks: 20 },
          { key: 'q4', label: 'Q4', maxMarks: 20 },
          { key: 'q5', label: 'Q5', maxMarks: 20 },
        ];
        if (
          qList.length > 0 &&
          qList.length !== 5 &&
          qList.every((q: any) => Number(q.maxMarks) === 20)
        ) {
          const fixedMarks = Math.round((100 / qList.length) * 10) / 10;
          qList = qList.map((q: any) => ({ ...q, maxMarks: fixedMarks }));
        }
        setQuestions(qList);

        const firstMarks = config.firstMarkerSheet?.marks || {};
        setFirstMarkerMarks(firstMarks);

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
  }, [token, retryCount]);

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

  // Normalization helper for marks (ensures Excel percentage fractions like 0.6 are scaled to 60)
  const normalizeFinalMark = (val: any): number | undefined => {
    if (val === undefined || val === null || val === '') return undefined;
    const num = Number(val);
    if (isNaN(num)) return undefined;
    if (num > 0 && num <= 1) {
      return Math.round(num * 100 * 10) / 10;
    }
    return num;
  };

  const parseExcelMarkValue = (rawVal: any, cellObj?: XLSX.CellObject): number | undefined => {
    if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
      return undefined;
    }

    // 1. Check formatted text on cell (e.g., "60%", "60.0%", "50%")
    if (cellObj && typeof cellObj.w === 'string' && cellObj.w.includes('%')) {
      const parsed = parseFloat(cellObj.w.replace('%', '').trim());
      if (!isNaN(parsed)) return parsed;
    }

    // 2. Check string representation of raw value (e.g., "60%")
    const strVal = String(rawVal).trim();
    if (strVal.includes('%')) {
      const parsed = parseFloat(strVal.replace('%', '').trim());
      if (!isNaN(parsed)) return parsed;
    }

    const num = parseFloat(strVal);
    if (isNaN(num)) return undefined;

    // 3. Check format code on cell (e.g., "0%", "0.00%")
    if (cellObj && typeof cellObj.z === 'string' && cellObj.z.includes('%')) {
      return Math.round(num * 100 * 10) / 10;
    }

    // 4. In Final (100) or Total percentage context, a decimal <= 1 represents percentage
    if (num > 0 && num <= 1) {
      return Math.round(num * 100 * 10) / 10;
    }

    return num;
  };

  // Helper calculations
  const calculateRowTotal = (studentId: number) => {
    const row = secondMarks[studentId] || {};
    const normTot = normalizeFinalMark(row.total);
    if (normTot !== undefined) return normTot;
    return questions.reduce((sum, q) => sum + (Number(row[q.key]) || 0), 0);
  };

  const parsedMarksConfig = useMemo(() => {
    const cfg = courseData?.marks_config;
    if (typeof cfg === 'string') {
      try {
        return JSON.parse(cfg);
      } catch {
        return {};
      }
    }
    return cfg || {};
  }, [courseData]);

  const expectedTotal = useMemo(() => {
    const saved =
      parsedMarksConfig?.expected_total ||
      parsedMarksConfig?.firstMarkerSheet?.expectedTotal ||
      parsedMarksConfig?.expectedTotal;
    if (saved && !isNaN(Number(saved)) && Number(saved) > 0) {
      return Number(saved);
    }
    return (
      questions.reduce(
        (sum: number, q: any) =>
          sum + (Number(q.maxMarks) || (questions.length > 0 ? 100 / questions.length : 20)),
        0,
      ) || 100
    );
  }, [parsedMarksConfig, questions]);

  const calculateRowFinal = (studentId: number) => {
    const row = secondMarks[studentId] || {};
    const normFinal100 = normalizeFinalMark(row.final100);
    if (normFinal100 !== undefined) return normFinal100;
    const normFinal = normalizeFinalMark(row.final);
    if (normFinal !== undefined) return normFinal;
    const rowTotal = calculateRowTotal(studentId);
    if (expectedTotal === 0) return 0;
    return Math.round((rowTotal / expectedTotal) * 100 * 10) / 10;
  };

  // Derive Batch of students being evaluated
  const evaluatedBatch = useMemo(() => {
    const batches = Array.from(new Set(students.map((s: any) => s.batch).filter(Boolean)));
    if (batches.length === 1) return `Batch ${batches[0]}`;
    if (batches.length > 1) return batches.map((b) => `Batch ${b}`).join(', ');
    const regBatch = students[0]?.registration_number?.match(/\/(\d{4})\//)?.[1];
    if (regBatch) return `Batch ${regBatch}`;
    return courseData?.batch ? `Batch ${courseData.batch}` : 'Batch 21/22';
  }, [students, courseData]);

  // 3. Process 2nd Marking Excel Upload
  const handleProcessSecondMarkingExcel = async (file: File) => {
    if (isSubmitted) return;
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary', cellNF: true, cellText: true });
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

          // Detect Final (100) column
          const finalIdx = lowerHeaders.findIndex(
            (h: string) =>
              h.includes('final') ||
              h.includes('(100)') ||
              h.includes('out of 100') ||
              h === '100%' ||
              h === '100',
          );

          // Detect Total column (excluding final column)
          const totalIdx = lowerHeaders.findIndex(
            (h: string, idx: number) => idx !== finalIdx && (h === 'total' || h.includes('total')),
          );

          if (regIdx < 0 && indexIdx < 0) {
            throw new Error('Could not locate Registration Number or Index Number column.');
          }

          // Question columns between Index Number and Total/Final
          const qColIndices: { key: string; colIdx: number; name: string }[] = [];
          const startQIdx = indexIdx >= 0 ? indexIdx + 1 : regIdx >= 0 ? regIdx + 1 : 2;
          const boundaryIdxs = [totalIdx, finalIdx].filter((idx) => idx >= 0);
          const endQIdx = boundaryIdxs.length > 0 ? Math.min(...boundaryIdxs) : headers.length;

          for (let c = startQIdx; c < endQIdx; c++) {
            const headerName = headers[c];
            if (
              headerName &&
              !lowerHeaders[c].includes('proper') &&
              !lowerHeaders[c].includes('p/r') &&
              !lowerHeaders[c].includes('status') &&
              !lowerHeaders[c].includes('name') &&
              !lowerHeaders[c].includes('student') &&
              !lowerHeaders[c].includes('#') &&
              !lowerHeaders[c].includes('total') &&
              !lowerHeaders[c].includes('final')
            ) {
              const key = `q_${c}`;
              qColIndices.push({ key, colIdx: c, name: headerName });
            }
          }

          let resolvedQuestions = questions;
          if (qColIndices.length > 0) {
            resolvedQuestions = qColIndices.map((q) => {
              const match = q.name.match(/(?:\(|\[|\/)\s*(\d+(?:\.\d+)?)\s*(?:\)|\])?/);
              let maxMarks = match ? parseFloat(match[1]) : undefined;
              if (!maxMarks || isNaN(maxMarks)) {
                maxMarks =
                  qColIndices.length > 0 ? Math.round((100 / qColIndices.length) * 10) / 10 : 20;
              }
              return {
                key: q.key,
                label: q.name,
                maxMarks,
              };
            });
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

              // Read Total if present
              if (totalIdx >= 0) {
                const rawTot = rowData[totalIdx];
                const cellTot = ws[XLSX.utils.encode_cell({ r: i, c: totalIdx })];
                const parsedTot = parseExcelMarkValue(rawTot, cellTot);
                if (parsedTot !== undefined) {
                  updatedMarks[sId]['total'] = parsedTot;
                }
              }

              // Read Final (100) if present
              if (finalIdx >= 0) {
                const rawFin = rowData[finalIdx];
                const cellFin = ws[XLSX.utils.encode_cell({ r: i, c: finalIdx })];
                const parsedFin = parseExcelMarkValue(rawFin, cellFin);
                if (parsedFin !== undefined) {
                  updatedMarks[sId]['final100'] = parsedFin;
                  updatedMarks[sId]['final'] = parsedFin;
                }
              }
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

  // 4. Download Student List Template with 1st Marker's Evaluated Marks
  const handleDownloadExcel = () => {
    const dataRows = students.map((st, index) => {
      const row1st = firstMarkerMarks[st.student_id] || {};
      const row2nd = secondMarks[st.student_id] || {};
      const isRepeat =
        st.registrations?.[0]?.attempt_type === 'REPEAT' ||
        st.attempt_type === 'REPEAT' ||
        st.attempt_number > 1;

      const row: any = {
        '#': index + 1,
        'Registration Number': st.registration_number || '',
        'Index Number': st.index_number || '',
        'Student Name': st.user?.full_name || st.full_name || '',
        'Proper/Repeat (P/R) Status': isRepeat ? 'R' : 'P',
      };

      // Populate each question with the 1st marker's evaluated marks (or 2nd marker's if already edited)
      questions.forEach((q) => {
        const val =
          row2nd[q.key] !== undefined && row2nd[q.key] !== null
            ? row2nd[q.key]
            : row1st[q.key] !== undefined && row1st[q.key] !== null
              ? row1st[q.key]
              : '';
        row[q.label] = val;
      });

      const computedTotal = questions.reduce((sum, q) => sum + (Number(row[q.label]) || 0), 0);
      const norm2ndTot = normalizeFinalMark(row2nd.total);
      const norm1stTot = normalizeFinalMark(row1st.total);
      const total =
        norm2ndTot !== undefined
          ? norm2ndTot
          : norm1stTot !== undefined
            ? norm1stTot
            : computedTotal;

      const computedFinal =
        expectedTotal > 0 ? Math.round((computedTotal / expectedTotal) * 100 * 10) / 10 : 0;
      const norm2ndFin = normalizeFinalMark(row2nd.final100) ?? normalizeFinalMark(row2nd.final);
      const norm1stFin = normalizeFinalMark(row1st.final100) ?? normalizeFinalMark(row1st.final);
      const final100 =
        norm2ndFin !== undefined
          ? norm2ndFin
          : norm1stFin !== undefined
            ? norm1stFin
            : computedFinal;

      row['Total'] = total;
      row['Final (Out of 100)'] = `${final100}%`;
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
    toast.success(
      `Downloaded student list with 1st marker evaluations for ${dataRows.length} registered student(s).`,
    );
  };

  // 5. Submit 2nd Marking to Course In-Charge
  const handleSubmit = async () => {
    if (isSubmitted) return;
    const confirmed = await confirm({
      title: 'Submit 2nd Marking Results?',
      message:
        'Are you sure you want to submit your 2nd marking results to the Course In-Charge? Once submitted, further editing will be permanently prohibited.',
      confirmText: 'Submit to In-Charge',
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

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'Sign Out?',
      message:
        'Are you sure you want to sign out of the 2nd Marker Portal? To access it again later, you will need to use the link received via email.',
      confirmText: 'Sign Out',
      variant: 'warning',
    });
    if (!confirmed) return;

    setIsSignedOut(true);
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
    const isNetworkError =
      error?.toLowerCase().includes('network error') ||
      error?.toLowerCase().includes('connection refused') ||
      error?.toLowerCase().includes('refused');

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card/60 border border-border/80 rounded-3xl p-8 text-center space-y-4 shadow-2xl backdrop-blur-md">
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-2xl w-fit mx-auto text-destructive">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            {isNetworkError ? 'Unable to Connect' : 'Access Restricted'}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isNetworkError
              ? 'Unable to connect to the server at this time. Please check your internet connection and try again.'
              : error || 'Unable to access 2nd marking evaluation sheet.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-2.5">
            {isNetworkError && (
              <button
                type="button"
                onClick={() => setRetryCount((prev) => prev + 1)}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry Connection
              </button>
            )}
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Return to EMS Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Signed Out Screen
  if (isSignedOut) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card/50 border border-border/80 rounded-3xl p-8 text-center space-y-6 shadow-2xl backdrop-blur-xl animate-fadeIn">
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl w-fit mx-auto text-primary">
            <Mail className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Signed Out Successfully</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              If you want to access the 2nd marker portal again, please use the link received via
              email.
            </p>
          </div>
          <div className="p-4 bg-secondary/30 border border-border/60 rounded-2xl text-left space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Registered Evaluator Email
            </p>
            <p className="text-xs font-mono font-bold text-foreground break-all">
              {tokenEmail || 'Second Marker'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const secondMarkerDisplayName =
    courseData?.second_marker_type === 'EXTERNAL'
      ? courseData?.second_marker_name || 'Second Marker (External)'
      : courseData?.second_marker_lecturer?.user?.full_name || user?.fullName || 'Second Marker';

  // =========================================================================
  // MAIN SECOND MARKING PORTAL WITH EXACT SYSTEM SIDEBAR LAYOUT
  // =========================================================================
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Desktop Sidebar - Exact System Layout from DashboardLayout */}
      <aside className="sticky top-0 h-screen hidden md:flex flex-col w-64 bg-card/30 border-r border-border/80 p-5 backdrop-blur-md shrink-0 z-30">
        <div className="flex items-center gap-3 px-2 mb-6 shrink-0">
          <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="font-bold text-lg tracking-tight truncate">University EMS</span>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors bg-primary text-primary-foreground shadow-lg shadow-primary/15 cursor-pointer">
            <FileSpreadsheet className="h-4 w-4 shrink-0" />
            <span className="truncate">Marks Registry</span>
          </div>
        </nav>

        <div className="border-t border-border/80 pt-4 mt-auto shrink-0">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="p-2 bg-secondary rounded-full shrink-0">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate leading-none mb-1">
                {secondMarkerDisplayName}
              </p>
              <p className="text-xs text-muted-foreground truncate leading-none font-mono">
                {tokenEmail || 'Second Marker'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Drawer Menu */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-card border-r border-border p-5 flex flex-col transition-transform duration-300 md:hidden ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between mb-6 shrink-0">
          <span className="font-bold text-lg">University EMS</span>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav
          className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 custom-scrollbar"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors bg-primary text-primary-foreground shadow-lg">
            <FileSpreadsheet className="h-4 w-4 shrink-0" />
            <span className="truncate">Marks Registry</span>
          </div>
        </nav>

        <div className="border-t border-border pt-4 mt-auto shrink-0">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="p-2 bg-secondary rounded-full shrink-0">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate leading-none mb-1">
                {secondMarkerDisplayName}
              </p>
              <p className="text-xs text-muted-foreground truncate leading-none font-mono">
                {tokenEmail || 'Second Marker'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Mobile Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-card/20 border-b border-border/60 md:hidden">
          <span className="font-bold text-lg">University EMS</span>
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-6 w-6" />
          </button>
        </header>

        {/* Desktop Top Header Bar with Breadcrumb and Status Badge */}
        <div className="h-16 border-b border-border/60 bg-card/20 backdrop-blur-md px-6 hidden md:flex items-center justify-between sticky top-0 z-20">
          <div className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
            <span>Exam Management System</span>
            <span>/</span>
            <span className="text-foreground font-bold">2nd Marker Evaluation Portal</span>
          </div>

          <div className="flex items-center gap-3">
            {isAutoSaving ? (
              <span className="text-[11px] font-mono text-amber-500 flex items-center gap-1.5 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
                <Loader2 className="h-3 w-3 animate-spin" /> Auto-saving draft...
              </span>
            ) : isSubmitted ? (
              <span className="px-3 py-1 text-[10px] font-bold rounded-xl uppercase border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 tracking-wider">
                SUBMITTED TO IN-CHARGE
              </span>
            ) : (
              <span className="px-3 py-1 text-[10px] font-bold rounded-xl uppercase border bg-amber-500/10 text-amber-400 border-amber-500/20 tracking-wider">
                DRAFT (UNSUBMITTED)
              </span>
            )}
          </div>
        </div>

        {/* Page Content Area */}
        <main className="flex-1 p-6 md:p-8 space-y-6 relative overflow-y-auto max-w-7xl w-full mx-auto">
          {/* Top Course Information Card */}
          <div className="bg-card/40 border border-border/60 rounded-3xl p-6 backdrop-blur-md shadow-sm space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/60 pb-5">
              <div>
                <h1 className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight">
                  {courseData.course_code} &mdash; {courseData.course_name}
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Second Marker Evaluation Marksheet. Download the enrolled student list, evaluate
                  the examination papers, and upload your spreadsheet.
                </p>
              </div>

              {/* Right Aligned Action Buttons (Exact layout & styling matching submit to 2nd marker) */}
              <div className="flex flex-wrap items-center gap-2.5 justify-end shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border/80 font-bold rounded-xl transition text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download className="h-3.5 w-3.5 text-primary" />
                  Download Student List
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitted || isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition text-xs flex items-center gap-1.5 shadow-md disabled:opacity-40 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isSubmitted ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {isSubmitted ? 'Submitted to In-Charge' : 'Submit to In-Charge'}
                </button>
              </div>
            </div>

            {/* 5 Course & Exam Metadata Cards (2nd Marker Status card removed) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
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
                  {evaluatedBatch}
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

          {/* Student Marks Registry Grid */}
          <div className="bg-card/25 border border-border/60 rounded-3xl p-6 backdrop-blur-sm space-y-5 animate-fadeIn shadow-sm">
            {/* Top Grid Title & Subtitle (No Tabs) */}
            <div className="border-b border-border/60 pb-5">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                Student Marks Registry Grid
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage evaluations across different marksheets.
              </p>
            </div>

            {/* Search & Records Counter Bar & Upload 2nd Marking Excel Button */}
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

                {/* Count Badge */}
                <div className="px-3 py-1.5 bg-background border border-border/80 rounded-xl text-xs font-mono font-bold text-foreground flex items-center gap-1.5 shrink-0">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  Showing {visibleStudentsCount} of {totalFilteredStudents} Records
                </div>
              </div>

              {/* Upload 2nd Marking Excel Button in Grid Toolbar */}
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

                    <th className="px-5 py-3 min-w-32 text-center border-l border-border/40 bg-secondary/10 text-foreground font-bold font-mono">
                      <div>Total</div>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        (Expected: {expectedTotal})
                      </span>
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
