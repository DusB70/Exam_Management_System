'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import { UserRole, ApiResponse } from '@ems/shared';
import { AxiosError } from 'axios';
import {
  Calendar,
  Plus,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  ClipboardList,
  Send,
  Save,
  Search,
  FileSpreadsheet,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Edit3,
  Check,
  AlertCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';

function parseFlexibleDate(dateVal: any): Date | null {
  if (dateVal === null || dateVal === undefined || dateVal === '') return null;
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    return dateVal;
  }

  // Handle Excel numeric date serials (e.g., 46310)
  if (typeof dateVal === 'number' && !isNaN(dateVal)) {
    const utcDays = dateVal - 25569;
    const utcValue = utcDays * 86400 * 1000;
    const d = new Date(utcValue);
    if (!isNaN(d.getTime())) return d;
  }

  const str = String(dateVal).trim();
  if (!str) return null;

  // 1. DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY (e.g. 15-10-2026, 15/10/2026)
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10);
    const year = parseInt(ddmmyyyyMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 2. YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD (e.g. 2026-10-15, 2026/10/15)
  const yyyymmddMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (yyyymmddMatch) {
    const year = parseInt(yyyymmddMatch[1], 10);
    const month = parseInt(yyyymmddMatch[2], 10);
    const day = parseInt(yyyymmddMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 3. Fallback standard parse
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    return fallback;
  }
  return null;
}

function formatToDDMMYYYY(dateVal: any): string {
  const d = parseFlexibleDate(dateVal);
  if (!d) return '—';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

function TimePickerInput({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) {
  const [internalVal, setInternalVal] = React.useState(value || '09:00 AM');
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const nativeInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (value) setInternalVal(value);
  }, [value]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const parseCurrentTime = (timeStr: string) => {
    let period = 'AM';
    const rawStr = (timeStr || '09:00 AM').trim();
    if (/pm/i.test(rawStr)) period = 'PM';
    else if (/am/i.test(rawStr)) period = 'AM';

    const match = rawStr.match(/(\d{1,2})[:.](\d{1,2})/);
    let hour = 9;
    let min = 0;
    if (match) {
      hour = parseInt(match[1], 10);
      min = parseInt(match[2], 10);
    }
    if (hour > 12) hour = hour % 12 || 12;
    if (hour === 0) hour = 12;

    return { hour, min, period };
  };

  const stepTime = (currentTime: string, direction: 'up' | 'down', stepMinutes = 30) => {
    let period = 'AM';
    const rawStr = currentTime.trim();
    if (/pm/i.test(rawStr)) period = 'PM';
    else if (/am/i.test(rawStr)) period = 'AM';

    const match = rawStr.match(/(\d{1,2})[:.](\d{1,2})/);
    let hours = 9;
    let mins = 0;
    if (match) {
      hours = parseInt(match[1], 10);
      mins = parseInt(match[2], 10);
    }

    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    let totalMins = hours * 60 + mins;
    if (direction === 'up') {
      totalMins = (totalMins + stepMinutes) % (24 * 60);
    } else {
      totalMins = (totalMins - stepMinutes + 24 * 60) % (24 * 60);
    }

    let newHours = Math.floor(totalMins / 60);
    const newMins = totalMins % 60;
    const newPeriod = newHours >= 12 ? 'PM' : 'AM';
    newHours = newHours % 12;
    if (newHours === 0) newHours = 12;

    const hStr = String(newHours).padStart(2, '0');
    const mStr = String(newMins).padStart(2, '0');
    return `${hStr}:${mStr} ${newPeriod}`;
  };

  const updateTime = (hour: number, min: number, period: string) => {
    const hStr = String(hour).padStart(2, '0');
    const mStr = String(min).padStart(2, '0');
    const formatted = `${hStr}:${mStr} ${period}`;
    setInternalVal(formatted);
    onChange(formatted);
  };

  const handleStep = (direction: 'up' | 'down') => {
    const next = stepTime(internalVal, direction, 30);
    setInternalVal(next);
    onChange(next);
  };

  const triggerClockPicker = () => {
    setIsOpen(!isOpen);
    if (nativeInputRef.current && 'showPicker' in nativeInputRef.current) {
      try {
        (nativeInputRef.current as any).showPicker();
      } catch (err) {
        // ignore browser unsupported showPicker
      }
    }
  };

  const parsed = parseCurrentTime(internalVal);

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Hidden Native Time Input */}
      <input
        ref={nativeInputRef}
        type="time"
        className="sr-only"
        onChange={(e) => {
          if (e.target.value) {
            const [hStr, mStr] = e.target.value.split(':');
            let h = parseInt(hStr, 10);
            const m = parseInt(mStr, 10);
            const p = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            updateTime(h, m, p);
          }
        }}
      />

      {/* Input container matching Image 1: clock icon on far right inside input */}
      <div className="relative flex items-center">
        <input
          type="text"
          value={internalVal}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              handleStep('up');
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              handleStep('down');
            }
          }}
          onChange={(e) => {
            setInternalVal(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="--:--"
          className={`w-36 pl-3 pr-9 py-2 bg-card border border-border/80 rounded-xl text-xs font-mono font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 shadow-xs ${className}`}
        />

        <button
          type="button"
          onClick={triggerClockPicker}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/80 hover:text-primary p-0.5 transition cursor-pointer"
          title="Click to select time"
        >
          <Clock className="h-4 w-4" />
        </button>
      </div>

      {/* Interactive Clock Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border/80 rounded-2xl shadow-xl p-3 w-64 space-y-2 text-xs">
          <div className="flex items-center justify-between font-bold text-[11px] text-muted-foreground uppercase border-b border-border/40 pb-1.5">
            <span className="flex items-center gap-1 text-primary">
              <Clock className="h-3.5 w-3.5" /> Select Time
            </span>
            <span className="font-mono text-foreground font-bold">{internalVal}</span>
          </div>

          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Hour:</div>
            <div className="grid grid-cols-6 gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => updateTime(h, parsed.min, parsed.period)}
                  className={`py-1 rounded-lg text-center font-mono font-bold text-[11px] transition cursor-pointer ${
                    parsed.hour === h
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/40 hover:bg-secondary text-foreground'
                  }`}
                >
                  {String(h).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
              Minute:
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[0, 15, 30, 45].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => updateTime(parsed.hour, m, parsed.period)}
                  className={`py-1 rounded-lg text-center font-mono font-bold text-[11px] transition cursor-pointer ${
                    parsed.min === m
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/40 hover:bg-secondary text-foreground'
                  }`}
                >
                  :{String(m).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
              Period:
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {['AM', 'PM'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => updateTime(parsed.hour, parsed.min, p)}
                  className={`py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                    parsed.period === p
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/40 hover:bg-secondary text-foreground'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const BATCHES = ['20/21', '21/22', '22/23', '23/24', '24/25'];
const SEMESTERS = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'];

export default function ExamsManagementPage() {
  const { user } = useAuthStore();
  const isStudent = user?.role === UserRole.STUDENT;

  // Main Section Tab: Timetable vs Results Tracker
  const [activeTab, setActiveTab] = useState<'timetable' | 'tracker'>('timetable');

  // Messages states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // =========================================================================
  // TIMETABLE SECTION FILTERS & SEARCH
  // =========================================================================
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterBatch, setFilterBatch] = useState<string>('ALL');
  const [filterSemester, setFilterSemester] = useState<string>('ALL');
  const [filterExamName, setFilterExamName] = useState<string>('ALL');

  // Tracker Filter State
  const [trackerSearch, setTrackerSearch] = useState<string>('');
  const [trackerSemFilter, setTrackerSemFilter] = useState<string>('ALL');
  const [trackerBatchFilter, setTrackerBatchFilter] = useState<string>('ALL');
  const [trackerExamNameFilter, setTrackerExamNameFilter] = useState<string>('ALL');
  const [expandedTrackerKeys, setExpandedTrackerKeys] = useState<Record<string, boolean>>({});

  // Student Calendar View State
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  // =========================================================================
  // ADD NEW EXAM TIMETABLE MODAL WIZARD STATE
  // =========================================================================
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [wizardBatch, setWizardBatch] = useState<string>('20/21');
  const [wizardSemester, setWizardSemester] = useState<string>('1.1');
  const [wizardExamName, setWizardExamName] = useState<string>('End Semester Examination 2026');
  const [creationMode, setCreationMode] = useState<'excel' | 'manual'>('excel');
  const [publishImmediately, setPublishImmediately] = useState<boolean>(false);

  // Dedicated Excel Live Error Inspector Popup Modal State
  const [showExcelPreviewModal, setShowExcelPreviewModal] = useState<boolean>(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [isValidatingExcel, setIsValidatingExcel] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Manual Form State: { [courseId]: { examDate, startTime, endTime, venue } }
  const [manualInputs, setManualInputs] = useState<Record<number, any>>({});

  // ==========================================
  // DATA QUERIES
  // ==========================================

  // 1. Fetch All Active Timetables (Staff)
  const {
    data: timetablesData,
    isLoading: isTimetablesLoading,
    refetch: refetchTimetables,
  } = useQuery({
    queryKey: ['all-timetables'],
    queryFn: async () => {
      const res = await apiClient.get('/exams/timetable/all');
      return res.data?.data || { timetables: [], availableCourses: [], examNames: [], batches: [] };
    },
    enabled: !isStudent,
  });

  // 2. Fetch Selected Batch Info (Publish status / changes check)
  const { data: batchInfo, refetch: refetchBatchInfo } = useQuery({
    queryKey: ['batch-timetable-info', filterBatch],
    queryFn: async () => {
      if (filterBatch === 'ALL') return null;
      const res = await apiClient.get(`/exams/timetable/batch/${encodeURIComponent(filterBatch)}`);
      return res.data?.data || null;
    },
    enabled: !isStudent && filterBatch !== 'ALL',
  });

  // 3. Fetch Student Published Timetable (Student)
  const { data: studentTimetable = [] } = useQuery({
    queryKey: ['student-published-timetable'],
    queryFn: async () => {
      const res = await apiClient.get('/exams/timetable/my-schedules');
      return res.data?.data || [];
    },
    enabled: isStudent,
  });

  // 4. Fetch Publishing Progress Matrix (Staff)
  const {
    data: progressMatrix = [],
    isLoading: isTrackerLoading,
    refetch: refetchTracker,
  } = useQuery({
    queryKey: ['publishing-progress-matrix'],
    queryFn: async () => {
      const res = await apiClient.get('/exams/progress');
      return res.data?.data || [];
    },
    enabled: !isStudent,
  });

  const availableCourses: any[] = timetablesData?.availableCourses || [];

  // ==========================================
  // CLIENT-SIDE LIVE EXCEL PARSER & VALIDATOR
  // ==========================================
  const runLiveExcelValidation = (
    file: File,
    targetBatch: string,
    targetSemester: string,
    targetExamName: string,
  ) => {
    setIsValidatingExcel(true);
    setExcelFile(file);
    setShowExcelPreviewModal(true); // IMMEDIATELY OPEN POPUP MODAL!

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rawRows.length === 0) {
          setValidationResult({
            hasHeaderErrors: true,
            headerErrors: ['Spreadsheet contains no data rows.'],
            rows: [],
            totalRows: 0,
            validRowsCount: 0,
            invalidRowsCount: 0,
            hasBlockingErrors: true,
          });
          setIsValidatingExcel(false);
          return;
        }

        const headerRow: string[] = (rawRows[0] || []).map((h: any) => String(h).trim());
        const headerErrors: string[] = [];

        const hasCodeHeader = headerRow.some((h) => /course|subject|code/i.test(h));
        const hasDateHeader = headerRow.some((h) => /date/i.test(h));
        const hasStartHeader = headerRow.some((h) => /start|time/i.test(h));
        const hasEndHeader = headerRow.some((h) => /end/i.test(h));

        if (!hasCodeHeader) headerErrors.push("Missing required column header 'Course Code'");
        if (!hasDateHeader) headerErrors.push("Missing required column header 'Date'");
        if (!hasStartHeader) headerErrors.push("Missing required column header 'Start Time'");
        if (!hasEndHeader) headerErrors.push("Missing required column header 'End Time'");

        const rowsData: any[] = XLSX.utils.sheet_to_json(ws);
        const parsedRows: any[] = [];
        let hasBlockingErrors = headerErrors.length > 0;

        rowsData.forEach((row: any, index: number) => {
          const rowErrors: string[] = [];

          const codeKey = Object.keys(row).find((k) => /course|subject|code/i.test(k));
          const dateKey = Object.keys(row).find((k) => /date/i.test(k));
          const startKey = Object.keys(row).find((k) => /start|time/i.test(k));
          const endKey = Object.keys(row).find((k) => /end/i.test(k));
          const venueKey = Object.keys(row).find((k) => /venue|hall|location/i.test(k));

          const rawCode = codeKey ? String(row[codeKey]).trim() : '';
          const rawDate = dateKey ? row[dateKey] : '';
          const rawStart = startKey ? String(row[startKey]).trim() : '09:00 AM';
          const rawEnd = endKey ? String(row[endKey]).trim() : '12:00 PM';
          const rawVenue = venueKey ? String(row[venueKey]).trim() : 'Main Exam Hall A';

          let matchedCourse: any = null;

          if (!rawCode) {
            rowErrors.push('Course Code is missing or empty.');
          } else {
            matchedCourse = availableCourses.find(
              (c: any) => c.course_code.toLowerCase() === rawCode.toLowerCase(),
            );
            if (!matchedCourse) {
              rowErrors.push(`Course Code '${rawCode}' does not exist in the system.`);
            } else if (
              targetSemester &&
              targetSemester !== 'ALL' &&
              matchedCourse.semester !== targetSemester
            ) {
              rowErrors.push(
                `Course '${rawCode}' belongs to Semester ${matchedCourse.semester}, but target is Semester ${targetSemester}.`,
              );
            }
          }

          if (rawDate === null || rawDate === undefined || rawDate === '') {
            rowErrors.push('Examination Date is missing.');
          } else {
            const parsedDate = parseFlexibleDate(rawDate);
            if (!parsedDate) {
              rowErrors.push(
                `Invalid date format '${rawDate}'. Expected DD-MM-YYYY or YYYY-MM-DD format (e.g. 15-10-2026 or 2026-10-15).`,
              );
            }
          }

          if (rowErrors.length > 0) {
            hasBlockingErrors = true;
          }

          const formattedDisplayDate = formatToDDMMYYYY(rawDate);

          parsedRows.push({
            rowIndex: index + 2,
            courseCode: rawCode,
            courseName: matchedCourse ? matchedCourse.course_name : 'Unknown Course',
            courseId: matchedCourse ? matchedCourse.course_id : null,
            semester: matchedCourse ? matchedCourse.semester : targetSemester || '1.1',
            examDate: formattedDisplayDate !== '—' ? formattedDisplayDate : String(rawDate || ''),
            startTime: rawStart,
            endTime: rawEnd,
            venue: rawVenue,
            errors: rowErrors,
            isValid: rowErrors.length === 0,
          });
        });

        setValidationResult({
          batch: targetBatch,
          semester: targetSemester,
          examName: targetExamName,
          headerRow,
          headerErrors,
          expectedHeaders: ['Course Code', 'Date', 'Start Time', 'End Time', 'Venue'],
          hasHeaderErrors: headerErrors.length > 0,
          hasBlockingErrors,
          totalRows: parsedRows.length,
          validRowsCount: parsedRows.filter((r) => r.isValid).length,
          invalidRowsCount: parsedRows.filter((r) => !r.isValid).length,
          rows: parsedRows,
        });
      } catch (err: any) {
        setErrorMsg('Failed to parse Excel file. Ensure valid spreadsheet format.');
      } finally {
        setIsValidatingExcel(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // ==========================================
  // MUTATIONS (STAFF)
  // ==========================================

  // Helper for human-readable user friendly error messages
  const formatUserFriendlyErrorMessage = (err: any, defaultMsg: string): string => {
    const resMsg = err?.response?.data?.message;
    if (Array.isArray(resMsg)) {
      return resMsg
        .map((m: string) =>
          typeof m === 'string'
            ? m
                .replace(/^items\.\d+\./, '')
                .replace(
                  /must be a valid ISO 8601 date string/i,
                  'must be a valid date format (DD-MM-YYYY)',
                )
                .replace(/must be an integer/i, 'is invalid')
            : String(m),
        )
        .join('. ');
    }
    if (typeof resMsg === 'string' && resMsg.trim().length > 0) {
      const lower = resMsg.toLowerCase();
      if (
        lower.includes('prisma') ||
        lower.includes('invalid date object') ||
        lower.includes('internal server error') ||
        lower.includes('invocation')
      ) {
        return 'Invalid examination date format or missing information. Please ensure dates are selected in DD-MM-YYYY format (e.g. 15-10-2026) and try again.';
      }
      return resMsg;
    }
    return defaultMsg;
  };

  // Save Timetable Batch Mutation
  const saveBatchMutation = useMutation({
    mutationFn: async ({ batch, items }: { batch: string; items: any[] }) => {
      const res = await apiClient.put(`/exams/timetable/batch/${encodeURIComponent(batch)}`, {
        batch,
        items,
      });
      return res.data;
    },
    onSuccess: (_, variables) => {
      setSuccessMsg(`Exam timetable for Batch ${variables.batch} saved successfully!`);
      setErrorMsg(null);
      setShowAddModal(false);
      setShowExcelPreviewModal(false);
      setValidationResult(null);
      setExcelFile(null);
      refetchTimetables();
      refetchBatchInfo();
      refetchTracker();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(
        formatUserFriendlyErrorMessage(
          err,
          'Failed to save exam timetable. Please check entry dates and try again.',
        ),
      );
      setSuccessMsg(null);
    },
  });

  // Commit Excel Import Mutation
  const commitExcelMutation = useMutation({
    mutationFn: async () => {
      if (!validationResult || validationResult.hasBlockingErrors) {
        throw new Error('Spreadsheet has errors and cannot be committed.');
      }

      const itemsToSave = validationResult.rows
        .filter((r: any) => r.isValid && r.courseId)
        .map((r: any) => ({
          courseId: r.courseId,
          examName: wizardExamName,
          examDate: r.examDate,
          startTime: r.startTime,
          endTime: r.endTime,
          venue: r.venue,
        }));

      const res = await apiClient.put(`/exams/timetable/batch/${encodeURIComponent(wizardBatch)}`, {
        batch: wizardBatch,
        items: itemsToSave,
      });

      if (publishImmediately) {
        await apiClient.post(`/exams/timetable/batch/${encodeURIComponent(wizardBatch)}/publish`);
      }

      return res.data;
    },
    onSuccess: () => {
      setSuccessMsg(
        `Successfully imported & committed ${validationResult?.validRowsCount} timetable entries for Batch ${wizardBatch}!${
          publishImmediately ? ' Timetable published to students.' : ''
        }`,
      );
      setErrorMsg(null);
      setShowAddModal(false);
      setShowExcelPreviewModal(false);
      setValidationResult(null);
      setExcelFile(null);
      refetchTimetables();
      refetchBatchInfo();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(
        formatUserFriendlyErrorMessage(err, 'Failed to commit spreadsheet timetable to system.'),
      );
      setSuccessMsg(null);
    },
  });

  // Publish Batch Timetable Mutation
  const publishBatchMutation = useMutation({
    mutationFn: async (batchToPublish: string) => {
      const res = await apiClient.post(
        `/exams/timetable/batch/${encodeURIComponent(batchToPublish)}/publish`,
      );
      return res.data;
    },
    onSuccess: (data, batchToPublish) => {
      setSuccessMsg(
        data.message ||
          `Exam timetable published to students! Notification emails sent to Batch ${batchToPublish}.`,
      );
      setErrorMsg(null);
      refetchTimetables();
      refetchBatchInfo();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(formatUserFriendlyErrorMessage(err, 'Failed to publish exam timetable.'));
      setSuccessMsg(null);
    },
  });

  // Delete Batch Timetable Mutation
  const deleteBatchMutation = useMutation({
    mutationFn: async ({ batch, semester }: { batch: string; semester?: string }) => {
      const url = semester
        ? `/exams/timetable/batch/${encodeURIComponent(batch)}?semester=${encodeURIComponent(semester)}`
        : `/exams/timetable/batch/${encodeURIComponent(batch)}`;
      const res = await apiClient.delete(url);
      return res.data;
    },
    onSuccess: (data) => {
      setSuccessMsg(data.message || 'Exam timetable deleted successfully.');
      setErrorMsg(null);
      refetchTimetables();
      refetchBatchInfo();
      refetchTracker();
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(formatUserFriendlyErrorMessage(err, 'Failed to delete exam timetable.'));
      setSuccessMsg(null);
    },
  });

  // Update Progress Tracker Mutation
  const updateProgressMutation = useMutation({
    mutationFn: async ({ courseId, payload }: { courseId: number; payload: any }) => {
      const res = await apiClient.put(`/exams/progress/${courseId}`, payload);
      return { data: res.data, payload };
    },
    onSuccess: ({ payload }) => {
      refetchTracker();
      refetchTimetables();
      if (payload.examHeld === 'HELD') {
        setSuccessMsg(
          'Exam status updated to HELD. Email notification dispatched to 1st Marker to collect papers from AR Office!',
        );
      } else if (payload.firstMarkingReturned === true) {
        setSuccessMsg(
          '1st marking papers returned to AR Office. Magic Link email dispatched to 2nd Marker!',
        );
      } else if (payload.firstMarkingCollected === true) {
        setSuccessMsg('1st marking paper collection recorded.');
      } else if (payload.secondMarkingCollected === true) {
        setSuccessMsg('2nd marking paper collection recorded.');
      } else if (payload.secondMarkingReturned === true) {
        setSuccessMsg('2nd marking papers returned to AR Office.');
      } else if (payload.examBoard !== undefined) {
        setSuccessMsg(payload.examBoard ? 'Exam Board approved.' : 'Exam Board status updated.');
      } else {
        setSuccessMsg('Publishing progress matrix updated.');
      }
      setErrorMsg(null);
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to update publishing progress.');
      setSuccessMsg(null);
    },
  });

  // Filter Active Timetables
  const allTimetablesList: any[] = timetablesData?.timetables || [];
  const allExamNames: string[] = timetablesData?.examNames || [
    'End Semester Examination 2026',
    'Mid Semester Examination 2026',
  ];

  const filteredTimetables = allTimetablesList.filter((item: any) => {
    const q = searchQuery.toLowerCase().trim();
    const courseCode = item.course?.course_code || '';
    const courseName = item.course?.course_name || '';
    const deptName = item.course?.department?.department_name || '';
    const venue = item.venue || '';
    const examName = item.exam_name || 'End Semester Examination';
    const batch = item.batch || '';
    const semester = item.course?.semester || '';
    const dateStr = item.exam_date ? new Date(item.exam_date).toISOString().split('T')[0] : '';

    const matchesSearch =
      !q ||
      courseCode.toLowerCase().includes(q) ||
      courseName.toLowerCase().includes(q) ||
      deptName.toLowerCase().includes(q) ||
      venue.toLowerCase().includes(q) ||
      examName.toLowerCase().includes(q) ||
      batch.toLowerCase().includes(q) ||
      semester.toLowerCase().includes(q) ||
      dateStr.includes(q);

    const matchesBatch = filterBatch === 'ALL' || batch === filterBatch;
    const matchesSemester = filterSemester === 'ALL' || semester === filterSemester;
    const matchesExamName = filterExamName === 'ALL' || examName === filterExamName;

    return matchesSearch && matchesBatch && matchesSemester && matchesExamName;
  });

  const [expandedGroupKeys, setExpandedGroupKeys] = React.useState<Record<string, boolean>>({});

  const toggleGroupExpand = (key: string) => {
    setExpandedGroupKeys((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };

  const groupedTimetables = React.useMemo(() => {
    const map = new Map<
      string,
      {
        groupKey: string;
        batch: string;
        semester: string;
        examName: string;
        isPublished: boolean;
        hasUnpublishedChanges: boolean;
        items: any[];
      }
    >();

    filteredTimetables.forEach((item: any) => {
      const batch = item.batch || '20/21';
      const semester = item.course?.semester || '1.1';
      const examName = item.exam_name || 'End Semester Examination 2026';
      const groupKey = `${batch}___${semester}___${examName}`;

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          groupKey,
          batch,
          semester,
          examName,
          isPublished: true,
          hasUnpublishedChanges: false,
          items: [],
        });
      }

      const group = map.get(groupKey)!;
      group.items.push(item);
      if (!item.is_published) {
        group.isPublished = false;
      }
      if (item.is_dirty) {
        group.hasUnpublishedChanges = true;
      }
    });

    return Array.from(map.values());
  }, [filteredTimetables]);

  const handleEditGroupTimetable = (group: any) => {
    setWizardBatch(group.batch);
    setWizardSemester(group.semester);
    setWizardExamName(group.examName);
    setCreationMode('manual');

    const inputs: Record<number, any> = {};
    const semCourses = availableCourses.filter((c: any) => c.semester === group.semester);
    semCourses.forEach((c: any) => {
      const existing = group.items.find((item: any) => item.course_id === c.course_id);
      inputs[c.course_id] = {
        courseId: c.course_id,
        examName: group.examName,
        examDate: existing?.exam_date ? formatToDDMMYYYY(existing.exam_date) : '',
        startTime: existing?.start_time || '09:00 AM',
        endTime: existing?.end_time || '12:00 PM',
        venue: existing?.venue || 'Main Exam Hall A',
      };
    });

    setManualInputs(inputs);
    setShowAddModal(true);
  };

  const toggleTrackerExpand = (key: string) => {
    setExpandedTrackerKeys((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };

  // Filter tracker items
  const filteredProgress = progressMatrix.filter((item: any) => {
    const q = trackerSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.course_code.toLowerCase().includes(q) ||
      item.course_name.toLowerCase().includes(q) ||
      item.department_name.toLowerCase().includes(q);
    const matchesSem = trackerSemFilter === 'ALL' || item.semester === trackerSemFilter;
    const matchesBatch = trackerBatchFilter === 'ALL' || item.batch === trackerBatchFilter;
    const matchesExam = trackerExamNameFilter === 'ALL' || item.exam_name === trackerExamNameFilter;

    return matchesSearch && matchesSem && matchesBatch && matchesExam;
  });

  const groupedProgressMatrix = React.useMemo(() => {
    const map = new Map<
      string,
      {
        groupKey: string;
        batch: string;
        semester: string;
        examName: string;
        items: any[];
      }
    >();

    filteredProgress.forEach((item: any) => {
      const batch = item.batch || '20/21';
      const semester = item.semester || '1.1';
      const examName = item.exam_name || 'End Semester Examination 2026';
      const groupKey = `${batch}___${semester}___${examName}`;

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          groupKey,
          batch,
          semester,
          examName,
          items: [],
        });
      }

      map.get(groupKey)!.items.push(item);
    });

    return Array.from(map.values());
  }, [filteredProgress]);

  // Calendar calculations for Student
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // Helper for manual course list population when wizard semester changes
  const wizardCourses = availableCourses.filter((c: any) => c.semester === wizardSemester);

  // Initialize manualInputs when wizard open or semester changes
  React.useEffect(() => {
    if (showAddModal && wizardCourses.length > 0) {
      const initial: Record<number, any> = {};
      wizardCourses.forEach((c: any) => {
        initial[c.course_id] = {
          courseId: c.course_id,
          examName: wizardExamName,
          examDate: '',
          startTime: '09:00 AM',
          endTime: '12:00 PM',
          venue: 'Main Exam Hall A',
        };
      });
      setManualInputs(initial);
    }
  }, [wizardSemester, showAddModal, wizardExamName]);

  // Handle Excel file drop
  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      runLiveExcelValidation(file, wizardBatch, wizardSemester, wizardExamName);
    }
  };

  // =========================================================================
  // STUDENT VIEW: EXAM TIMETABLE CALENDAR
  // =========================================================================
  if (isStudent) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border/80 p-6 rounded-3xl shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
              <Calendar className="h-4 w-4" />
              Student Portal
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Exam Timetable Calendar
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              View official examination dates, start & end times, and hall locations in monthly
              calendar view.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentCalendarDate(new Date(year, month - 1, 1))}
              className="p-2.5 bg-secondary hover:bg-secondary/80 rounded-xl text-foreground transition cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="font-extrabold text-base min-w-[140px] text-center">
              {monthNames[month]} {year}
            </span>

            <button
              onClick={() => setCurrentCalendarDate(new Date(year, month + 1, 1))}
              className="p-2.5 bg-secondary hover:bg-secondary/80 rounded-xl text-foreground transition cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Student Calendar Grid */}
        <div className="bg-card border border-border/80 rounded-3xl shadow-sm overflow-hidden p-6">
          <div className="grid grid-cols-7 gap-2 mb-4 text-center font-bold text-xs uppercase tracking-wider text-muted-foreground">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[100px] bg-secondary/10 rounded-2xl p-2 opacity-30"
              />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

              const dayExams = studentTimetable.filter((t: any) => {
                const d = new Date(t.exam_date).toISOString().split('T')[0];
                return d === dateStr;
              });

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`min-h-[100px] border rounded-2xl p-2 transition flex flex-col justify-between ${
                    dayExams.length > 0
                      ? 'bg-primary/10 border-primary/40'
                      : 'bg-card border-border/60 hover:bg-secondary/20'
                  }`}
                >
                  <div className="font-bold text-xs text-foreground flex items-center justify-between">
                    <span>{dayNum}</span>
                    {dayExams.length > 0 && (
                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>

                  <div className="space-y-1 mt-1">
                    {dayExams.map((exam: any) => (
                      <div
                        key={exam.timetable_id}
                        className="p-1.5 bg-background/90 border border-primary/20 rounded-xl text-[10px] space-y-0.5 shadow-sm"
                      >
                        <div className="font-extrabold text-primary truncate">
                          {exam.course?.course_code}
                        </div>
                        <div className="text-muted-foreground truncate text-[9px]">
                          {exam.course?.course_name}
                        </div>
                        <div className="text-foreground font-mono text-[9px] flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5 text-primary shrink-0" />
                          {exam.start_time} - {exam.end_time}
                        </div>
                        <div className="text-muted-foreground font-mono text-[9px] flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                          {exam.venue || 'Main Hall'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STAFF VIEW: EXAM MANAGEMENT & RESULTS TRACKER
  // =========================================================================

  const isSelectedBatchPublished = batchInfo?.isPublished || false;
  const hasUnpublishedBatchChanges = batchInfo?.hasUnpublishedChanges || false;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-2xl font-medium flex gap-2 items-center">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="ml-auto text-xs hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-2xl font-medium flex gap-2 items-center">
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
          <span>{successMsg}</span>
          <button
            onClick={() => setSuccessMsg(null)}
            className="ml-auto text-xs hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Exams & Results Management
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Manage active exam timetables, validate Excel spreadsheet imports, publish student
            notifications, and track paper results.
          </p>
        </div>

        {activeTab === 'timetable' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setShowAddModal(true);
                setValidationResult(null);
                setExcelFile(null);
              }}
              className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add New Exam Timetable
            </button>
          </div>
        )}
      </div>

      {/* Section Tab Switcher */}
      <div className="flex border-b border-border/60 gap-8 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('timetable')}
          className={`pb-3 transition flex items-center gap-2 relative cursor-pointer ${
            activeTab === 'timetable'
              ? 'text-primary border-b-2 border-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Exam Timetables Section
        </button>

        <button
          onClick={() => setActiveTab('tracker')}
          className={`pb-3 transition flex items-center gap-2 relative cursor-pointer ${
            activeTab === 'tracker'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Results Publishing Workflow Tracker
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EXAM TIMETABLES SECTION */}
      {/* ========================================================================= */}
      {activeTab === 'timetable' && (
        <div className="space-y-6">
          {/* Filter & Search Bar */}
          <div className="bg-card border border-border/80 p-5 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search course code, title, venue, date, exam name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/60 text-foreground"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns Row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Semester Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">
                  Semester:
                </span>
                <select
                  value={filterSemester}
                  onChange={(e) => setFilterSemester(e.target.value)}
                  className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 cursor-pointer"
                >
                  <option value="ALL">All Semesters</option>
                  {SEMESTERS.map((sem) => (
                    <option key={sem} value={sem}>
                      Semester {sem}
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">
                  Batch:
                </span>
                <select
                  value={filterBatch}
                  onChange={(e) => setFilterBatch(e.target.value)}
                  className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 cursor-pointer"
                >
                  <option value="ALL">All Batches</option>
                  {BATCHES.map((b) => (
                    <option key={b} value={b}>
                      Batch {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Exam Name Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">
                  Exam Name:
                </span>
                <select
                  value={filterExamName}
                  onChange={(e) => setFilterExamName(e.target.value)}
                  className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 max-w-[200px] truncate cursor-pointer"
                >
                  <option value="ALL">All Examinations</option>
                  {allExamNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {(filterSemester !== 'ALL' ||
                filterBatch !== 'ALL' ||
                filterExamName !== 'ALL' ||
                searchQuery) && (
                <button
                  onClick={() => {
                    setFilterSemester('ALL');
                    setFilterBatch('ALL');
                    setFilterExamName('ALL');
                    setSearchQuery('');
                  }}
                  className="px-3 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-xl hover:bg-secondary/80 transition cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Batch Specific Publish Action Header (when batch filter is selected) */}
          {filterBatch !== 'ALL' && (
            <div className="bg-primary/10 border border-primary/20 p-4 rounded-3xl flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold text-primary uppercase tracking-wider">
                  Batch {filterBatch} Timetable Lifecycle
                </div>
                <div className="text-sm font-bold text-foreground mt-0.5">
                  Status:{' '}
                  {isSelectedBatchPublished ? (
                    hasUnpublishedBatchChanges ? (
                      <span className="text-amber-400 font-extrabold">
                        Published (Unpublished changes exist)
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-extrabold">Published & Active</span>
                    )
                  ) : (
                    <span className="text-muted-foreground italic">Draft / Unpublished</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => publishBatchMutation.mutate(filterBatch)}
                disabled={
                  publishBatchMutation.isPending ||
                  (isSelectedBatchPublished && !hasUnpublishedBatchChanges)
                }
                className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl shadow-md transition ${
                  isSelectedBatchPublished && !hasUnpublishedBatchChanges
                    ? 'bg-secondary text-muted-foreground opacity-60 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer'
                }`}
              >
                {publishBatchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isSelectedBatchPublished
                  ? hasUnpublishedBatchChanges
                    ? 'Re-Publish Timetable Updates'
                    : 'Published (Up to Date)'
                  : 'Publish Timetable to Students'}
              </button>
            </div>
          )}

          {/* Active Timetables Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Current Active Exam Timetables
                </h3>
                <p className="text-xs text-muted-foreground">
                  View and manage scheduled course examinations grouped by Batch, Semester & Exam
                  Name. Click any timetable header to expand subject details.
                </p>
              </div>
              <span className="text-xs font-bold text-muted-foreground bg-secondary/60 px-3 py-1 rounded-xl">
                {groupedTimetables.length} Timetable Groups
              </span>
            </div>

            {isTimetablesLoading ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2 bg-card border border-border/80 rounded-3xl">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Loading active timetables...</p>
              </div>
            ) : groupedTimetables.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground bg-card border border-border/80 rounded-3xl">
                No active exam timetables match the selected filters. Click &quot;Add New Exam
                Timetable&quot; to create one.
              </div>
            ) : (
              <div className="space-y-4">
                {groupedTimetables.map((group) => {
                  const isExpanded = expandedGroupKeys[group.groupKey] !== false; // expanded by default

                  return (
                    <div
                      key={group.groupKey}
                      className="bg-card border border-border/80 rounded-3xl shadow-sm overflow-hidden transition"
                    >
                      {/* Expandable Header Card */}
                      <div
                        onClick={() => toggleGroupExpand(group.groupKey)}
                        className="px-6 py-4 bg-secondary/20 hover:bg-secondary/30 transition flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer border-b border-border/40"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-primary" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>

                          <span className="px-3 py-1 bg-primary/10 text-primary font-mono font-extrabold rounded-xl border border-primary/20 text-xs">
                            Batch {group.batch}
                          </span>
                          <span className="px-3 py-1 bg-secondary text-foreground font-bold rounded-xl border border-border/60 text-xs">
                            Semester {group.semester}
                          </span>
                          <h4 className="font-bold text-sm md:text-base text-foreground">
                            {group.examName}
                          </h4>

                          {group.isPublished &&
                            (group.hasUnpublishedChanges ? (
                              <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 font-bold rounded-lg border border-amber-500/20 text-[11px]">
                                Published (Modified)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 font-bold rounded-lg border border-emerald-500/20 text-[11px]">
                                Published & Active
                              </span>
                            ))}
                        </div>

                        {/* Actions: Course Count Badge, Edit, Delete & Publish Buttons */}
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-xs font-semibold text-muted-foreground bg-secondary/40 px-2.5 py-1 rounded-lg mr-1">
                            {group.items.length} {group.items.length === 1 ? 'Course' : 'Courses'}
                          </span>
                          <button
                            onClick={() => handleEditGroupTimetable(group)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-secondary text-foreground hover:bg-secondary/80 text-xs font-bold rounded-xl border border-border/80 transition cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5 text-primary" />
                            Edit Timetable
                          </button>

                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Are you sure you want to delete the timetable for Batch ${group.batch} (Semester ${group.semester})? This will remove all timetable entries for this semester.`,
                                )
                              ) {
                                deleteBatchMutation.mutate({
                                  batch: group.batch,
                                  semester: group.semester,
                                });
                              }
                            }}
                            disabled={deleteBatchMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs font-bold rounded-xl border border-destructive/20 transition cursor-pointer"
                            title="Delete Timetable"
                          >
                            {deleteBatchMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Delete
                          </button>

                          <button
                            onClick={() => publishBatchMutation.mutate(group.batch)}
                            disabled={
                              publishBatchMutation.isPending ||
                              (group.isPublished && !group.hasUnpublishedChanges)
                            }
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl shadow-sm transition ${
                              group.isPublished && !group.hasUnpublishedChanges
                                ? 'bg-secondary/50 text-muted-foreground opacity-60 cursor-not-allowed border border-border/40'
                                : 'bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer'
                            }`}
                          >
                            {publishBatchMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            {group.isPublished
                              ? group.hasUnpublishedChanges
                                ? 'Re-Publish Updates'
                                : 'Published'
                              : 'Publish'}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Subject List Table */}
                      {isExpanded && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-border/60 bg-secondary/30 text-xs font-bold uppercase text-muted-foreground tracking-wider">
                                <th className="py-3 px-4 border-r border-border/40">
                                  Course Code & Module
                                </th>
                                <th className="py-3 px-4 border-r border-border/40">Exam Date</th>
                                <th className="py-3 px-4 border-r border-border/40">
                                  Time (Start - End)
                                </th>
                                <th className="py-3 px-4 border-r border-border/40">
                                  Venue / Hall
                                </th>
                                <th className="py-3 px-4 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60 text-xs font-medium">
                              {group.items.map((item: any) => (
                                <tr
                                  key={item.timetable_id}
                                  className="hover:bg-secondary/10 transition"
                                >
                                  <td className="py-3 px-4 border-r border-border/40">
                                    <div className="font-mono font-bold text-primary text-xs">
                                      {item.course?.course_code}
                                    </div>
                                    <div className="text-muted-foreground text-[11px]">
                                      {item.course?.course_name}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 border-r border-border/40 font-mono text-foreground font-semibold">
                                    {item.exam_date ? formatToDDMMYYYY(item.exam_date) : 'Not set'}
                                  </td>
                                  <td className="py-3 px-4 border-r border-border/40 font-mono text-muted-foreground font-semibold">
                                    {item.start_time} - {item.end_time}
                                  </td>
                                  <td className="py-3 px-4 border-r border-border/40 font-semibold text-foreground">
                                    {item.venue || 'Main Exam Hall A'}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    {item.course?.publishing_progress?.exam_held === 'HELD' ||
                                    item.exam_held === 'HELD' ? (
                                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 font-extrabold rounded-lg border border-emerald-500/20 text-[10px] inline-flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        HELD (
                                        {item.exam_date ? formatToDDMMYYYY(item.exam_date) : 'Done'}
                                        )
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-1 bg-secondary text-muted-foreground font-extrabold rounded-lg text-[10px] uppercase">
                                        PENDING
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RESULTS PUBLISHING WORKFLOW TRACKER */}
      {/* ========================================================================= */}
      {activeTab === 'tracker' && (
        <div className="space-y-6">
          {/* Filter & Search Bar */}
          <div className="bg-card border border-border/80 p-5 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search subject code, title, department..."
                value={trackerSearch}
                onChange={(e) => setTrackerSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/60 text-foreground"
              />
              {trackerSearch && (
                <button
                  onClick={() => setTrackerSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns Row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Semester Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">
                  Semester:
                </span>
                <select
                  value={trackerSemFilter}
                  onChange={(e) => setTrackerSemFilter(e.target.value)}
                  className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 cursor-pointer"
                >
                  <option value="ALL">All Semesters</option>
                  {SEMESTERS.map((sem) => (
                    <option key={sem} value={sem}>
                      Semester {sem}
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">
                  Batch:
                </span>
                <select
                  value={trackerBatchFilter}
                  onChange={(e) => setTrackerBatchFilter(e.target.value)}
                  className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 cursor-pointer"
                >
                  <option value="ALL">All Batches</option>
                  {BATCHES.map((b) => (
                    <option key={b} value={b}>
                      Batch {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Exam Name Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">
                  Exam Name:
                </span>
                <select
                  value={trackerExamNameFilter}
                  onChange={(e) => setTrackerExamNameFilter(e.target.value)}
                  className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 max-w-[200px] truncate cursor-pointer"
                >
                  <option value="ALL">All Examinations</option>
                  {allExamNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {(trackerSemFilter !== 'ALL' ||
                trackerBatchFilter !== 'ALL' ||
                trackerExamNameFilter !== 'ALL' ||
                trackerSearch) && (
                <button
                  onClick={() => {
                    setTrackerSemFilter('ALL');
                    setTrackerBatchFilter('ALL');
                    setTrackerExamNameFilter('ALL');
                    setTrackerSearch('');
                  }}
                  className="px-3 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-xl hover:bg-secondary/80 transition cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Grouped Workflow Matrix Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Results Publishing Workflow Matrix
                </h3>
                <p className="text-xs text-muted-foreground">
                  Track paper collection, mark submissions, board approvals, and final result
                  releases categorized by Batch, Semester & Examination.
                </p>
              </div>
              <span className="text-xs font-bold text-muted-foreground bg-secondary/60 px-3 py-1 rounded-xl">
                {groupedProgressMatrix.length} Workflow Groups
              </span>
            </div>

            {isTrackerLoading ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2 bg-card border border-border/80 rounded-3xl">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Loading publishing progress matrix...</p>
              </div>
            ) : groupedProgressMatrix.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground bg-card border border-border/80 rounded-3xl">
                No workflow matrix entries match the selected filters.
              </div>
            ) : (
              <div className="space-y-4">
                {groupedProgressMatrix.map((group) => {
                  const isExpanded = expandedTrackerKeys[group.groupKey] !== false; // expanded by default

                  return (
                    <div
                      key={group.groupKey}
                      className="bg-card border border-border/80 rounded-3xl shadow-sm overflow-hidden transition"
                    >
                      {/* Expandable Group Header */}
                      <div
                        onClick={() => toggleTrackerExpand(group.groupKey)}
                        className="px-6 py-4 bg-secondary/20 hover:bg-secondary/30 transition flex items-center justify-between gap-4 cursor-pointer border-b border-border/40"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-primary" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>

                          <span className="px-3 py-1 bg-primary/10 text-primary font-mono font-extrabold rounded-xl border border-primary/20 text-xs">
                            Batch {group.batch}
                          </span>
                          <span className="px-3 py-1 bg-secondary text-foreground font-bold rounded-xl border border-border/60 text-xs">
                            Semester {group.semester}
                          </span>
                          <h4 className="font-bold text-sm md:text-base text-foreground">
                            {group.examName}
                          </h4>
                        </div>

                        <span className="text-xs font-semibold text-muted-foreground bg-secondary/40 px-2.5 py-1 rounded-lg">
                          {group.items.length} {group.items.length === 1 ? 'Course' : 'Courses'}
                        </span>
                      </div>

                      {/* Expanded Workflow Table */}
                      {isExpanded && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-border/60 bg-secondary/30 text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                                <th className="py-3 px-4 border-r border-border/40" rowSpan={2}>
                                  Subject
                                </th>
                                <th
                                  className="py-3 px-3 border-r border-border/40 text-center"
                                  rowSpan={2}
                                >
                                  Exam Held Status
                                </th>
                                <th
                                  className="py-2 px-3 border-r border-border/40 text-center"
                                  colSpan={3}
                                >
                                  1st Marking
                                </th>
                                <th
                                  className="py-2 px-3 border-r border-border/40 text-center"
                                  colSpan={3}
                                >
                                  2nd Marking
                                </th>
                                <th
                                  className="py-2 px-3 border-r border-border/40 text-center"
                                  colSpan={2}
                                >
                                  Final Submission
                                </th>
                                <th
                                  className="py-3 px-3 border-r border-border/40 text-center"
                                  rowSpan={2}
                                >
                                  Exam Board
                                </th>
                                <th className="py-3 px-3 text-center" rowSpan={2}>
                                  Results Published
                                </th>
                              </tr>

                              <tr className="border-b border-border/60 bg-secondary/20 text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider text-center">
                                <th className="py-2 px-2 border-r border-border/40">Collected</th>
                                <th className="py-2 px-2 border-r border-border/40">Submitted</th>
                                <th className="py-2 px-2 border-r border-border/40">Returned</th>

                                <th className="py-2 px-2 border-r border-border/40">Collected</th>
                                <th className="py-2 px-2 border-r border-border/40">Submitted</th>
                                <th className="py-2 px-2 border-r border-border/40">Returned</th>

                                <th className="py-2 px-2 border-r border-border/40">Submitted</th>
                                <th className="py-2 px-2 border-r border-border/40">
                                  Head Approved
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60 text-xs font-medium">
                              {group.items.map((item: any) => {
                                const isHeld = item.exam_held === 'HELD';
                                const canFirstReturn =
                                  item.first_marking.collected && item.first_marking.submitted;
                                const canSecondCollect = item.first_marking.returned;
                                const canSecondReturn =
                                  item.second_marking.collected && item.second_marking.submitted;
                                const canExamBoard = item.first_marking.returned;

                                return (
                                  <tr
                                    key={item.course_id}
                                    className="hover:bg-secondary/10 transition"
                                  >
                                    <td className="py-3 px-4 border-r border-border/40 font-semibold">
                                      <div className="font-bold text-foreground font-mono text-xs">
                                        {item.course_code}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                                        {item.course_name}
                                      </div>
                                      <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                                        {item.first_marker_name}
                                      </div>
                                    </td>

                                    {/* EXAM HELD STATUS DROPDOWN */}
                                    <td className="py-3 px-3 border-r border-border/40 text-center">
                                      <select
                                        value={item.exam_held || 'PENDING'}
                                        onChange={(e) =>
                                          updateProgressMutation.mutate({
                                            courseId: item.course_id,
                                            payload: { examHeld: e.target.value },
                                          })
                                        }
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border focus:outline-none cursor-pointer ${
                                          item.exam_held === 'HELD'
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                            : item.exam_held === 'POSTPONED'
                                              ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                              : 'bg-secondary text-muted-foreground border-border'
                                        }`}
                                      >
                                        <option value="PENDING" className="bg-card">
                                          Pending
                                        </option>
                                        <option value="HELD" className="bg-card">
                                          Held (Auto)
                                        </option>
                                        <option value="POSTPONED" className="bg-card">
                                          Postponed
                                        </option>
                                      </select>
                                    </td>

                                    {/* 1ST MARKING COLLECTED */}
                                    <td className="py-3 px-2 border-r border-border/40 text-center">
                                      <input
                                        type="checkbox"
                                        checked={item.first_marking.collected}
                                        disabled={!isHeld}
                                        title={
                                          !isHeld
                                            ? 'Exam must be Held before collecting 1st marking papers'
                                            : 'Toggle 1st marking collection'
                                        }
                                        onChange={(e) =>
                                          updateProgressMutation.mutate({
                                            courseId: item.course_id,
                                            payload: { firstMarkingCollected: e.target.checked },
                                          })
                                        }
                                        className={`h-4 w-4 rounded border-border text-primary focus:ring-primary/60 ${!isHeld ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                      />
                                    </td>

                                    {/* 1ST MARKING SUBMITTED */}
                                    <td className="py-3 px-2 border-r border-border/40 text-center">
                                      {item.first_marking.submitted ? (
                                        <span className="inline-flex items-center justify-center p-1 bg-emerald-500/10 text-emerald-400 rounded-md font-bold text-[10px]">
                                          <CheckCircle2 className="h-4 w-4" />
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground/40 font-mono">
                                          —
                                        </span>
                                      )}
                                    </td>

                                    {/* 1ST MARKING RETURNED */}
                                    <td className="py-3 px-2 border-r border-border/40 text-center">
                                      <input
                                        type="checkbox"
                                        checked={item.first_marking.returned}
                                        disabled={!canFirstReturn}
                                        title={
                                          !item.first_marking.collected
                                            ? '1st marking papers not collected yet'
                                            : !item.first_marking.submitted
                                              ? '1st marking marks not submitted by marker yet'
                                              : 'Toggle 1st marking returned'
                                        }
                                        onChange={(e) =>
                                          updateProgressMutation.mutate({
                                            courseId: item.course_id,
                                            payload: { firstMarkingReturned: e.target.checked },
                                          })
                                        }
                                        className={`h-4 w-4 rounded border-border text-primary focus:ring-primary/60 ${!canFirstReturn ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                      />
                                    </td>

                                    {/* 2ND MARKING COLLECTED */}
                                    <td className="py-3 px-2 border-r border-border/40 text-center">
                                      <input
                                        type="checkbox"
                                        checked={item.second_marking.collected}
                                        disabled={!canSecondCollect}
                                        title={
                                          !canSecondCollect
                                            ? '1st marking papers must be returned before 2nd marking collection'
                                            : 'Toggle 2nd marking collection'
                                        }
                                        onChange={(e) =>
                                          updateProgressMutation.mutate({
                                            courseId: item.course_id,
                                            payload: { secondMarkingCollected: e.target.checked },
                                          })
                                        }
                                        className={`h-4 w-4 rounded border-border text-primary focus:ring-primary/60 ${!canSecondCollect ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                      />
                                    </td>

                                    {/* 2ND MARKING SUBMITTED */}
                                    <td className="py-3 px-2 border-r border-border/40 text-center">
                                      {item.second_marking.submitted ? (
                                        <span className="inline-flex items-center justify-center p-1 bg-emerald-500/10 text-emerald-400 rounded-md font-bold text-[10px]">
                                          <CheckCircle2 className="h-4 w-4" />
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground/40 font-mono">
                                          —
                                        </span>
                                      )}
                                    </td>

                                    {/* 2ND MARKING RETURNED */}
                                    <td className="py-3 px-2 border-r border-border/40 text-center">
                                      <input
                                        type="checkbox"
                                        checked={item.second_marking.returned}
                                        disabled={!canSecondReturn}
                                        title={
                                          !item.second_marking.collected
                                            ? '2nd marking papers not collected yet'
                                            : !item.second_marking.submitted
                                              ? '2nd marking marks not submitted by 2nd marker yet'
                                              : 'Toggle 2nd marking returned'
                                        }
                                        onChange={(e) =>
                                          updateProgressMutation.mutate({
                                            courseId: item.course_id,
                                            payload: { secondMarkingReturned: e.target.checked },
                                          })
                                        }
                                        className={`h-4 w-4 rounded border-border text-primary focus:ring-primary/60 ${!canSecondReturn ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                      />
                                    </td>

                                    {/* FINAL SUBMISSION SUBMITTED */}
                                    <td className="py-3 px-2 border-r border-border/40 text-center">
                                      {item.final_submission.submitted ? (
                                        <span className="inline-flex items-center justify-center p-1 bg-emerald-500/10 text-emerald-400 rounded-md font-bold text-[10px]">
                                          <CheckCircle2 className="h-4 w-4" />
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground/40 font-mono">
                                          —
                                        </span>
                                      )}
                                    </td>

                                    {/* HEAD APPROVED */}
                                    <td className="py-3 px-2 border-r border-border/40 text-center">
                                      {item.final_submission.head_approved ? (
                                        <span className="inline-flex items-center justify-center p-1 bg-emerald-500/10 text-emerald-400 rounded-md font-bold text-[10px]">
                                          <CheckCircle2 className="h-4 w-4" />
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground/40 font-mono">
                                          —
                                        </span>
                                      )}
                                    </td>

                                    {/* EXAM BOARD */}
                                    <td className="py-3 px-3 border-r border-border/40 text-center">
                                      <input
                                        type="checkbox"
                                        checked={item.exam_board}
                                        disabled={!canExamBoard}
                                        title={
                                          !canExamBoard
                                            ? '1st marking papers must be returned before Exam Board approval'
                                            : 'Toggle Exam Board approval'
                                        }
                                        onChange={(e) =>
                                          updateProgressMutation.mutate({
                                            courseId: item.course_id,
                                            payload: { examBoard: e.target.checked },
                                          })
                                        }
                                        className={`h-4 w-4 rounded border-border text-primary focus:ring-primary/60 ${!canExamBoard ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                      />
                                    </td>

                                    {/* RESULTS PUBLISHED */}
                                    <td className="py-3 px-3 text-center">
                                      {item.results_published ? (
                                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 font-bold rounded-lg border border-emerald-500/20 text-[10px] inline-flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Published
                                        </span>
                                      ) : (
                                        <span className="px-2.5 py-1 bg-secondary text-muted-foreground font-bold rounded-lg text-[10px]">
                                          In Progress
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD NEW EXAM TIMETABLE SETUP DIALOG */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-card border border-border/80 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] my-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 md:px-8 md:py-5 border-b border-border/60 flex items-center justify-between shrink-0 bg-secondary/10">
              <div>
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Exam Division Setup
                </span>
                <h3 className="text-xl font-bold text-foreground mt-0.5">Add New Exam Timetable</h3>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                }}
                className="p-1.5 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1">
              {/* STEP 1: Context Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-secondary/20 p-4 rounded-2xl border border-border/60">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase">
                    1. Target Batch
                  </label>
                  <select
                    value={wizardBatch}
                    onChange={(e) => setWizardBatch(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border/80 rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 cursor-pointer"
                  >
                    {BATCHES.map((b) => (
                      <option key={b} value={b}>
                        Batch {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase">
                    2. Semester
                  </label>
                  <select
                    value={wizardSemester}
                    onChange={(e) => setWizardSemester(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border/80 rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 cursor-pointer"
                  >
                    {SEMESTERS.map((sem) => (
                      <option key={sem} value={sem}>
                        Semester {sem}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase">
                    3. Examination Name
                  </label>
                  <input
                    type="text"
                    value={wizardExamName}
                    onChange={(e) => setWizardExamName(e.target.value)}
                    placeholder="e.g. End Semester Examination 2026"
                    className="w-full px-3 py-2 bg-card border border-border/80 rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />
                </div>
              </div>

              {/* STEP 2: Mode Switcher */}
              <div className="flex border-b border-border/60 gap-4 text-xs font-semibold">
                <button
                  onClick={() => setCreationMode('excel')}
                  className={`pb-2 transition flex items-center gap-2 cursor-pointer ${
                    creationMode === 'excel'
                      ? 'text-primary border-b-2 border-primary font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Import Spreadsheet
                </button>

                <button
                  onClick={() => setCreationMode('manual')}
                  className={`pb-2 transition flex items-center gap-2 cursor-pointer ${
                    creationMode === 'manual'
                      ? 'text-primary border-b-2 border-primary font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  Manual Course Entry
                </button>
              </div>

              {/* MODE A: EXCEL SPREADSHEET DROP / BROWSE */}
              {creationMode === 'excel' && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDropFile}
                    className={`border-2 border-dashed rounded-3xl p-8 text-center transition flex flex-col items-center justify-center gap-3 ${
                      isDragOver
                        ? 'border-primary bg-primary/10'
                        : 'border-border/80 bg-secondary/20 hover:border-primary/50'
                    }`}
                  >
                    <FileSpreadsheet className="h-10 w-10 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Select or drop your timetable spreadsheet file (`.xlsx` or `.csv`)
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        As soon as you select a file, a live preview popup will display all rows &
                        validate errors in real-time.
                      </p>
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                        Required column headers: Course Code, Date, Start Time, End Time, Venue
                      </p>
                    </div>

                    <input
                      type="file"
                      id="wizardExcelInput"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          runLiveExcelValidation(file, wizardBatch, wizardSemester, wizardExamName);
                        }
                      }}
                      className="hidden"
                    />

                    <label
                      htmlFor="wizardExcelInput"
                      className="px-5 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-md hover:bg-primary/90 transition cursor-pointer mt-2"
                    >
                      Browse Excel Spreadsheet
                    </label>
                  </div>
                </div>
              )}

              {/* MODE B: MANUAL COURSE ENTRY */}
              {creationMode === 'manual' && (
                <div className="space-y-4">
                  <div className="text-xs font-semibold text-muted-foreground">
                    Populate timetable dates & locations for Semester {wizardSemester} courses:
                  </div>

                  <div className="max-h-[300px] overflow-y-auto border border-border/80 rounded-2xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-secondary border-b border-border/60 font-semibold uppercase text-[10px] text-muted-foreground">
                        <tr>
                          <th className="py-2.5 px-3 border-r border-border/40">Course</th>
                          <th className="py-2.5 px-3 border-r border-border/40">Exam Date</th>
                          <th className="py-2.5 px-3 border-r border-border/40">Start Time</th>
                          <th className="py-2.5 px-3 border-r border-border/40">End Time</th>
                          <th className="py-2.5 px-3 border-r border-border/40">Venue</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 font-medium">
                        {wizardCourses.map((c: any) => {
                          const current = manualInputs[c.course_id];
                          const isIncluded = Boolean(current);

                          if (!isIncluded) {
                            return (
                              <tr key={c.course_id} className="bg-secondary/20 opacity-60">
                                <td className="py-2 px-3 border-r border-border/40">
                                  <div className="font-mono font-bold text-muted-foreground line-through">
                                    {c.course_code}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground line-through">
                                    {c.course_name}
                                  </div>
                                </td>
                                <td
                                  colSpan={4}
                                  className="py-2 px-3 border-r border-border/40 text-xs italic text-muted-foreground"
                                >
                                  Subject excluded from timetable
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setManualInputs((prev) => ({
                                        ...prev,
                                        [c.course_id]: {
                                          courseId: c.course_id,
                                          examName: wizardExamName,
                                          examDate: '',
                                          startTime: '09:00 AM',
                                          endTime: '12:00 PM',
                                          venue: 'Main Exam Hall A',
                                        },
                                      }))
                                    }
                                    className="px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-bold rounded-lg transition cursor-pointer"
                                  >
                                    + Include
                                  </button>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={c.course_id} className="hover:bg-secondary/10">
                              <td className="py-2 px-3 border-r border-border/40">
                                <div className="font-mono font-bold text-primary">
                                  {c.course_code}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  {c.course_name}
                                </div>
                              </td>
                              <td className="py-2 px-3 border-r border-border/40">
                                <input
                                  type="date"
                                  value={current.examDate || ''}
                                  onChange={(e) =>
                                    setManualInputs((prev) => ({
                                      ...prev,
                                      [c.course_id]: {
                                        ...prev[c.course_id],
                                        examDate: e.target.value,
                                      },
                                    }))
                                  }
                                  className="px-2 py-1 bg-card border border-border/80 rounded-lg text-xs font-mono focus:outline-none"
                                />
                              </td>
                              <td className="py-2 px-3 border-r border-border/40">
                                <TimePickerInput
                                  value={current.startTime || '09:00 AM'}
                                  onChange={(val) =>
                                    setManualInputs((prev) => ({
                                      ...prev,
                                      [c.course_id]: { ...prev[c.course_id], startTime: val },
                                    }))
                                  }
                                />
                              </td>
                              <td className="py-2 px-3 border-r border-border/40">
                                <TimePickerInput
                                  value={current.endTime || '12:00 PM'}
                                  onChange={(val) =>
                                    setManualInputs((prev) => ({
                                      ...prev,
                                      [c.course_id]: { ...prev[c.course_id], endTime: val },
                                    }))
                                  }
                                />
                              </td>
                              <td className="py-2 px-3 border-r border-border/40">
                                <input
                                  type="text"
                                  value={current.venue || 'Main Exam Hall A'}
                                  onChange={(e) =>
                                    setManualInputs((prev) => ({
                                      ...prev,
                                      [c.course_id]: {
                                        ...prev[c.course_id],
                                        venue: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full px-2 py-1 bg-card border border-border/80 rounded-lg text-xs font-semibold focus:outline-none"
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setManualInputs((prev) => {
                                      const copy = { ...prev };
                                      delete copy[c.course_id];
                                      return copy;
                                    })
                                  }
                                  className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition cursor-pointer"
                                  title="Remove Subject"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="manualPublishImm"
                      checked={publishImmediately}
                      onChange={(e) => setPublishImmediately(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary/60 cursor-pointer"
                    />
                    <label
                      htmlFor="manualPublishImm"
                      className="text-xs font-bold text-foreground cursor-pointer"
                    >
                      Publish to students immediately upon saving
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                    <button
                      type="button"
                      disabled={saveBatchMutation.isPending}
                      onClick={() => {
                        const items = Object.values(manualInputs).filter(
                          (item: any) => item.examDate && String(item.examDate).trim() !== '',
                        );
                        if (items.length === 0) {
                          setErrorMsg(
                            'Please select an examination date for at least one course before saving.',
                          );
                          setSuccessMsg(null);
                          return;
                        }
                        saveBatchMutation.mutate({ batch: wizardBatch, items });
                        if (publishImmediately) {
                          publishBatchMutation.mutate(wizardBatch);
                        }
                      }}
                      className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition text-xs disabled:opacity-40 flex items-center gap-2 shadow-md cursor-pointer"
                    >
                      {saveBatchMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Timetable
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP MODAL 2: DEDICATED EXCEL LIVE ERROR INSPECTOR POPUP DIALOG */}
      {/* ========================================================================= */}
      {showExcelPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-card border border-border/80 w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] my-auto overflow-hidden relative">
            {/* Modal Header */}
            <div className="px-6 py-4 md:px-8 md:py-5 border-b border-border/60 flex items-center justify-between shrink-0 bg-secondary/10">
              <div>
                <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
                  <FileSpreadsheet className="h-4 w-4" />
                  Spreadsheet Live Error Inspector
                </div>
                <h3 className="text-xl font-bold text-foreground mt-0.5">
                  Import Spreadsheet Preview - {excelFile?.name || 'File Upload'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Target: Batch {wizardBatch} | Semester {wizardSemester} | Exam: {wizardExamName}
                </p>
              </div>

              <button
                onClick={() => {
                  setShowExcelPreviewModal(false);
                  setValidationResult(null);
                  setExcelFile(null);
                }}
                className="p-1.5 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1">
              {/* Validation Loading State */}
              {isValidatingExcel && (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm font-semibold text-foreground">
                    Validating column headers & checking course codes in database...
                  </p>
                </div>
              )}

              {/* Validation Results & Preview Table */}
              {validationResult && !isValidatingExcel && (
                <div className="space-y-4">
                  {/* Header Error Warning Banner */}
                  {validationResult.hasHeaderErrors && (
                    <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-2xl text-destructive text-xs space-y-1">
                      <div className="font-bold text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4.5 w-4.5" />
                        Column Header Mismatch Error Detected!
                      </div>
                      <p>
                        Your spreadsheet headers do not match the required format. Found:{' '}
                        <code className="font-mono bg-destructive/20 px-2 py-0.5 rounded font-bold">
                          {validationResult.headerRow?.join(', ')}
                        </code>
                      </p>
                      <p className="font-semibold">
                        Required column headers: Course Code, Date, Start Time, End Time, Venue
                      </p>
                    </div>
                  )}

                  {/* Summary Badges Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-secondary/20 p-4 rounded-2xl border border-border/60 text-xs">
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-foreground">
                        Total Rows: {validationResult.totalRows}
                      </span>
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 font-bold rounded-xl border border-emerald-500/20">
                        Valid Rows: {validationResult.validRowsCount}
                      </span>
                      {validationResult.invalidRowsCount > 0 && (
                        <span className="px-3 py-1 bg-destructive/10 text-destructive font-bold rounded-xl border border-destructive/20">
                          Rows with Errors: {validationResult.invalidRowsCount}
                        </span>
                      )}
                    </div>

                    {validationResult.hasBlockingErrors ? (
                      <div className="text-destructive font-bold text-xs flex items-center gap-1.5 bg-destructive/10 px-3 py-1.5 rounded-xl border border-destructive/20">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>Spreadsheet contains errors. Cannot commit to system.</span>
                      </div>
                    ) : (
                      <div className="text-emerald-400 font-bold text-xs flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>All rows validated cleanly! Ready to commit.</span>
                      </div>
                    )}
                  </div>

                  {/* DEDICATED PREVIEW TABLE WITH SEPARATE ERROR COLUMN */}
                  <div className="max-h-[380px] overflow-y-auto border border-border/80 rounded-2xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-secondary border-b border-border/60 font-semibold uppercase text-[10px] text-muted-foreground z-10">
                        <tr>
                          <th className="py-3 px-3 border-r border-border/40 w-16">Row #</th>
                          <th className="py-3 px-3 border-r border-border/40 w-28">Course Code</th>
                          <th className="py-3 px-3 border-r border-border/40">
                            Course Name (System Match)
                          </th>
                          <th className="py-3 px-3 border-r border-border/40 w-28">Exam Date</th>
                          <th className="py-3 px-3 border-r border-border/40 w-36">Time Range</th>
                          <th className="py-3 px-3 border-r border-border/40 w-32">Venue</th>
                          <th className="py-3 px-4 text-left bg-secondary/90 text-foreground font-bold border-l border-border/40">
                            STATUS
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 font-medium">
                        {validationResult.rows?.map((row: any) => (
                          <tr
                            key={row.rowIndex}
                            className={
                              !row.isValid
                                ? 'bg-destructive/10 border-l-4 border-l-destructive'
                                : 'hover:bg-secondary/10'
                            }
                          >
                            <td className="py-2.5 px-3 border-r border-border/40 font-mono text-muted-foreground">
                              Row {row.rowIndex}
                            </td>
                            <td className="py-2.5 px-3 border-r border-border/40 font-mono font-bold text-foreground">
                              {row.courseCode || '—'}
                            </td>
                            <td className="py-2.5 px-3 border-r border-border/40 font-semibold text-muted-foreground">
                              {row.courseName}
                            </td>
                            <td className="py-2.5 px-3 border-r border-border/40 font-mono">
                              {formatToDDMMYYYY(row.examDate)}
                            </td>
                            <td className="py-2.5 px-3 border-r border-border/40 font-mono text-muted-foreground">
                              {row.startTime} - {row.endTime}
                            </td>
                            <td className="py-2.5 px-3 border-r border-border/40 font-semibold">
                              {row.venue}
                            </td>
                            {/* SEPARATE EXPLICIT ERROR COLUMN */}
                            <td className="py-2.5 px-4 font-semibold border-l border-border/40">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 font-bold rounded-lg text-[11px] border border-emerald-500/20">
                                  <Check className="h-3.5 w-3.5" /> Valid
                                </span>
                              ) : (
                                <div className="space-y-1">
                                  {row.errors.map((errStr: string, idx: number) => (
                                    <div
                                      key={idx}
                                      className="text-destructive font-bold text-[11px] flex items-start gap-1.5"
                                    >
                                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-destructive" />
                                      <span>{errStr}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Immediate Publish Checkbox */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="popupPublishImm"
                      checked={publishImmediately}
                      onChange={(e) => setPublishImmediately(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary/60 cursor-pointer"
                    />
                    <label
                      htmlFor="popupPublishImm"
                      className="text-xs font-bold text-foreground cursor-pointer"
                    >
                      Publish timetable to students immediately upon saving
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 md:px-8 md:py-4 border-t border-border/60 flex items-center justify-end gap-3 shrink-0 bg-secondary/10">
              <button
                type="button"
                onClick={() => {
                  setShowExcelPreviewModal(false);
                  setValidationResult(null);
                  setExcelFile(null);
                }}
                className="px-4 py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition text-xs cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  !validationResult ||
                  validationResult.hasBlockingErrors ||
                  commitExcelMutation.isPending
                }
                onClick={() => commitExcelMutation.mutate()}
                className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 transition text-xs disabled:opacity-40 flex items-center gap-2 shadow-md cursor-pointer"
              >
                {commitExcelMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Timetable to System
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
