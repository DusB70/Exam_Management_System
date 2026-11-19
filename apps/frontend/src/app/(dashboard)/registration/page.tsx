'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/authStore';
import { useToast } from '../../../hooks/use-toast';
import { useConfirm } from '../../../hooks/use-confirm';
import { useProgressiveList } from '../../../hooks/use-progressive-load';
import { ProgressiveLoadFooter } from '../../../components/ui/progressive-load-footer';
import { useBulkSelection, runBulkDelete } from '../../../hooks/use-bulk-selection';
import { BulkDeleteButton, SelectAllCheckbox } from '../../../components/ui/bulk-delete-button';
import PeriodDialog from '../../../components/courses/period-dialog';
import { formatNameWithTitle } from '../../../lib/nic-utils';
import { AxiosError } from 'axios';
import { ApiResponse, UserRole } from '@ems/shared';
import { ProgressionConsole } from './progression-console';
import {
  BookOpen,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Loader2,
  Plus,
  Play,
  Pause,
  StopCircle,
  SquarePen,
  Check,
  X,
  Search,
  Users,
  RotateCcw,
  GraduationCap,
  Trash2,
  ArrowRight,
  Info,
  Lock,
} from 'lucide-react';

// ==========================================
// STAFF & ADMIN REGISTRATION CONSOLE
// ==========================================
function StaffRegistrationView() {
  const toast = useToast();
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState<'windows' | 'monitor' | 'progression'>('windows');

  // Tab 1: Registration Windows States & Filters
  const [windowSearch, setWindowSearch] = useState('');
  const [windowSemFilter, setWindowSemFilter] = useState('ALL');
  const [windowBatchFilter, setWindowBatchFilter] = useState('ALL');
  const [windowTypeFilter, setWindowTypeFilter] = useState('ALL');
  const [windowStatusFilter, setWindowStatusFilter] = useState('ALL');
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [editingEndDatePeriodId, setEditingEndDatePeriodId] = useState<number | null>(null);
  const [editingEndDateValue, setEditingEndDateValue] = useState<string>('');
  const [isBulkDeletingPeriods, setIsBulkDeletingPeriods] = useState(false);
  const periodSelection = useBulkSelection<number>();

  // Tab 2: Enrollment Monitor States & Filters
  const [monitorBatch, setMonitorBatch] = useState('ALL');
  const [monitorSem, setMonitorSem] = useState('ALL');
  const [monitorDegree, setMonitorDegree] = useState('ALL');
  const [monitorDept, setMonitorDept] = useState('ALL');
  const [studentSearch, setStudentSearch] = useState('');

  // 1. Fetch Registration Periods
  const {
    data: periods = [],
    isLoading: isPeriodsLoading,
    refetch: refetchPeriods,
  } = useQuery({
    queryKey: ['registration-periods'],
    queryFn: async () => {
      const response = await apiClient.get('/courses/periods');
      return response.data?.data || [];
    },
  });

  // Extract distinct batches from periods for filter
  const periodBatches = useMemo(() => {
    const set = new Set<string>();
    periods.forEach((p: any) => {
      if (p.batch) set.add(p.batch);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [periods]);

  // Filter Registration Periods
  const filteredPeriods = useMemo(() => {
    return periods.filter((p: any) => {
      if (windowSemFilter !== 'ALL' && p.semester !== windowSemFilter) return false;
      if (windowBatchFilter !== 'ALL' && p.batch !== windowBatchFilter) return false;
      if (windowTypeFilter !== 'ALL' && p.window_type !== windowTypeFilter) return false;
      if (windowStatusFilter !== 'ALL' && p.status !== windowStatusFilter) return false;
      if (windowSearch.trim() !== '') {
        const q = windowSearch.toLowerCase();
        const matchBatch = p.batch?.toLowerCase().includes(q);
        const matchSem = p.semester?.toLowerCase().includes(q);
        const matchType = p.window_type?.toLowerCase().includes(q);
        if (!matchBatch && !matchSem && !matchType) return false;
      }
      return true;
    });
  }, [
    periods,
    windowSemFilter,
    windowBatchFilter,
    windowTypeFilter,
    windowStatusFilter,
    windowSearch,
  ]);

  const {
    visibleItems: visiblePeriods,
    visibleCount: visiblePeriodsCount,
    hasMore: hasMorePeriods,
  } = useProgressiveList<any>(filteredPeriods, {
    resetKey: `${windowSearch}|${windowSemFilter}|${windowBatchFilter}|${windowTypeFilter}|${windowStatusFilter}`,
  });

  // Period Actions Handlers
  const handlePeriodStatusChange = async (periodId: number, status: string) => {
    try {
      await apiClient.patch(`/courses/periods/${periodId}/status`, { status });
      toast.success(`Registration window status updated to ${status}.`);
      refetchPeriods();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update period status');
    }
  };

  const handleDeletePeriod = async (periodId: number) => {
    const confirmed = await confirm({
      title: 'Delete Registration Window?',
      message:
        'Are you sure you want to delete this course registration window? Students will no longer be able to register for this semester.',
      confirmText: 'Delete Window',
      variant: 'destructive',
    });
    if (confirmed) {
      try {
        await apiClient.delete(`/courses/periods/${periodId}`);
        toast.success('Registration window deleted successfully.');
        refetchPeriods();
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to delete registration window.');
      }
    }
  };

  const handleSaveEndDate = async (periodId: number) => {
    if (!editingEndDateValue) return;
    try {
      await apiClient.patch(`/courses/periods/${periodId}/end-date`, {
        endDate: new Date(editingEndDateValue).toISOString(),
      });
      toast.success('Registration window end date updated.');
      setEditingEndDatePeriodId(null);
      refetchPeriods();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update end date.');
    }
  };

  const handleBulkDeletePeriods = async () => {
    if (periodSelection.selectedCount === 0) return;
    const confirmed = await confirm({
      title: 'Delete Selected Registration Windows?',
      message: `Are you sure you want to delete ${periodSelection.selectedCount} selected registration window(s)?`,
      confirmText: `Delete (${periodSelection.selectedCount})`,
      variant: 'destructive',
    });
    if (!confirmed) return;

    setIsBulkDeletingPeriods(true);
    try {
      const deletedIds: number[] = [];
      const { deletedCount, failedCount, firstErrorMessage } = await runBulkDelete(
        periodSelection.selectedIds,
        async (id) => {
          await apiClient.delete(`/courses/periods/${id}`);
          deletedIds.push(id);
        },
      );
      if (deletedCount > 0) {
        toast.success(`${deletedCount} registration window(s) deleted successfully.`);
        periodSelection.removeFromSelection(deletedIds);
        refetchPeriods();
      }
      if (failedCount > 0) {
        toast.error(
          `${failedCount} window(s) could not be deleted${firstErrorMessage ? `: ${firstErrorMessage}` : '.'}`,
        );
      }
      if (failedCount === 0) periodSelection.clear();
    } finally {
      setIsBulkDeletingPeriods(false);
    }
  };

  // 2. Fetch Departments & Degrees for Enrollment Monitor Filters
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await apiClient.get('/departments');
      return res.data?.data || [];
    },
  });

  const { data: degrees = [] } = useQuery({
    queryKey: ['degrees'],
    queryFn: async () => {
      const res = await apiClient.get('/degrees');
      return res.data?.data || [];
    },
  });

  // 3. Fetch Enrollment Monitor Data
  const {
    data: monitorData,
    isLoading: isMonitorLoading,
    refetch: refetchMonitor,
  } = useQuery({
    queryKey: ['enrollment-monitor', monitorBatch, monitorSem, monitorDegree, monitorDept],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (monitorBatch && monitorBatch !== 'ALL') params.append('batch', monitorBatch);
      if (monitorSem && monitorSem !== 'ALL') params.append('semester', monitorSem);
      if (monitorDegree && monitorDegree !== 'ALL') params.append('degreeId', monitorDegree);
      if (monitorDept && monitorDept !== 'ALL') params.append('departmentId', monitorDept);
      const res = await apiClient.get(`/registrations/enrollment-monitor?${params.toString()}`);
      return res.data?.data;
    },
  });

  // Filter students by search
  const studentsList = monitorData?.students || [];
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return studentsList;
    const q = studentSearch.toLowerCase().trim();
    return studentsList.filter((s: any) => {
      return (
        s.fullName?.toLowerCase().includes(q) ||
        s.registrationNumber?.toLowerCase().includes(q) ||
        s.indexNumber?.toLowerCase().includes(q) ||
        s.nicNo?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
      );
    });
  }, [studentsList, studentSearch]);

  const {
    visibleItems: visibleStudents,
    visibleCount: visibleStudentsCount,
    hasMore: hasMoreStudents,
  } = useProgressiveList<any>(filteredStudents, {
    resetKey: `${studentSearch}|${monitorBatch}|${monitorSem}|${monitorDegree}|${monitorDept}`,
  });

  // Combine batches from monitor data and periods
  const availableBatches = useMemo(() => {
    const set = new Set<string>();
    (monitorData?.batches || []).forEach((b: string) => set.add(b));
    periodBatches.forEach((b: string) => set.add(b));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [monitorData?.batches, periodBatches]);

  const resetWindowFilters = () => {
    setWindowSearch('');
    setWindowSemFilter('ALL');
    setWindowBatchFilter('ALL');
    setWindowTypeFilter('ALL');
    setWindowStatusFilter('ALL');
  };

  const isWindowFiltered =
    windowSearch.trim() !== '' ||
    windowSemFilter !== 'ALL' ||
    windowBatchFilter !== 'ALL' ||
    windowTypeFilter !== 'ALL' ||
    windowStatusFilter !== 'ALL';

  const resetMonitorFilters = () => {
    setMonitorBatch('ALL');
    setMonitorSem('ALL');
    setMonitorDegree('ALL');
    setMonitorDept('ALL');
    setStudentSearch('');
  };

  const isMonitorFiltered =
    monitorBatch !== 'ALL' ||
    monitorSem !== 'ALL' ||
    monitorDegree !== 'ALL' ||
    monitorDept !== 'ALL' ||
    studentSearch.trim() !== '';

  const registeredPercentage =
    monitorData && monitorData.totalStudentsCount > 0
      ? Math.round((monitorData.registeredCount / monitorData.totalStudentsCount) * 100)
      : 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Registration & Enrollment</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Manage course registration windows, repeat exam periods, and monitor live student batch
            enrollment.
          </p>
        </div>

        {activeTab === 'windows' && (
          <button
            onClick={() => setPeriodDialogOpen(true)}
            className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer self-start md:self-auto"
          >
            <Plus className="h-4 w-4" /> Open Registration Window
          </button>
        )}
      </div>

      {/* Sub Tabs Control */}
      <div className="flex border-b border-border/60 gap-8 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('windows')}
          className={`pb-3 transition flex items-center gap-2 relative cursor-pointer ${
            activeTab === 'windows'
              ? 'text-primary border-b-2 border-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="h-4 w-4" /> Registration Windows ({periods.length})
        </button>
        <button
          onClick={() => setActiveTab('monitor')}
          className={`pb-3 transition flex items-center gap-2 relative cursor-pointer ${
            activeTab === 'monitor'
              ? 'text-primary border-b-2 border-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-4 w-4" /> Enrollment Monitor
        </button>
        <button
          onClick={() => setActiveTab('progression')}
          className={`pb-3 transition flex items-center gap-2 relative cursor-pointer ${
            activeTab === 'progression'
              ? 'text-primary border-b-2 border-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <GraduationCap className="h-4 w-4" /> Academic Progression & Promotion
        </button>
      </div>

      {/* ========================================== */}
      {/* TAB 1: REGISTRATION WINDOWS */}
      {/* ========================================== */}
      {activeTab === 'windows' && (
        <div className="space-y-6 animate-tabSwipeUp">
          {/* Search & Filter Bar */}
          <div className="bg-card border border-border/80 p-5 rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by batch, semester, or window type..."
                  value={windowSearch}
                  onChange={(e) => setWindowSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/60 text-foreground"
                />
                {windowSearch && (
                  <button
                    onClick={() => setWindowSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Bulk Actions & Counter */}
              <div className="flex items-center gap-2 shrink-0 self-start lg:self-auto">
                <BulkDeleteButton
                  count={periodSelection.selectedCount}
                  isDeleting={isBulkDeletingPeriods}
                  onClick={handleBulkDeletePeriods}
                />
                <div className="px-3 py-2 bg-background border border-border/80 rounded-xl text-xs font-mono font-bold text-foreground flex items-center gap-1.5 shadow-2xs">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Showing {visiblePeriods.length} of {filteredPeriods.length} Records
                </div>
              </div>
            </div>

            {/* Filter Dropdowns Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 pt-2 border-t border-border/60">
              {/* Semester Filter */}
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Semester
                </label>
                <select
                  value={windowSemFilter}
                  onChange={(e) => setWindowSemFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Semesters</option>
                  {['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'].map((sem) => (
                    <option key={sem} value={sem}>
                      Semester {sem}
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch Filter */}
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Batch
                </label>
                <select
                  value={windowBatchFilter}
                  onChange={(e) => setWindowBatchFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Batches</option>
                  {availableBatches.map((b) => (
                    <option key={b} value={b}>
                      Batch {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Window Type Filter */}
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Window Type
                </label>
                <select
                  value={windowTypeFilter}
                  onChange={(e) => setWindowTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Window Types</option>
                  <option value="SEMESTER_REGISTRATION">Semester</option>
                  <option value="MEDICAL_REPEAT_REGISTRATION">Repeat Exam</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={windowStatusFilter}
                  onChange={(e) => setWindowStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="OPEN">Open</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              {/* Reset Filters */}
              {isWindowFiltered && (
                <div className="flex items-end col-span-2 sm:col-span-1">
                  <button
                    onClick={resetWindowFilters}
                    className="w-full px-3 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/80 transition text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-border/60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset Filters
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Windows Table */}
          <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                    <th className="px-4 py-4 w-10 text-center">
                      <SelectAllCheckbox
                        checked={periodSelection.isAllSelected(
                          visiblePeriods.map((p: any) => p.period_id),
                        )}
                        indeterminate={periodSelection.isIndeterminate(
                          visiblePeriods.map((p: any) => p.period_id),
                        )}
                        disabled={visiblePeriods.length === 0}
                        onChange={() =>
                          periodSelection.toggleAll(visiblePeriods.map((p: any) => p.period_id))
                        }
                        ariaLabel="Select all visible registration windows"
                      />
                    </th>
                    <th className="px-4 py-4 w-12 text-center">#</th>
                    <th className="px-6 py-4">Batch / Academic Year</th>
                    <th className="px-6 py-4">Semester</th>
                    <th className="px-6 py-4">Window Type</th>
                    <th className="px-6 py-4">Start Date</th>
                    <th className="px-6 py-4">End Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-sm font-medium">
                  {isPeriodsLoading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-20 text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                          Loading registration windows...
                        </span>
                      </td>
                    </tr>
                  ) : filteredPeriods.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-20 text-muted-foreground">
                        No registration windows found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    visiblePeriods.map((p: any, idx: number) => {
                      const startStr = new Date(p.start_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      });
                      const endStr = new Date(p.end_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      });

                      const isOpen = p.status === 'OPEN';
                      const isSuspended = p.status === 'SUSPENDED';

                      // Requirement: "when displaying the window type display only semester for semester registration."
                      const windowTypeDisplay =
                        p.window_type === 'SEMESTER_REGISTRATION'
                          ? 'Semester'
                          : p.window_type === 'MEDICAL_REPEAT_REGISTRATION'
                            ? 'Repeat Exam'
                            : p.window_type?.replace(/_/g, ' ') || 'Semester';

                      return (
                        <tr
                          key={p.period_id}
                          className={`hover:bg-secondary/15 transition-colors ${
                            periodSelection.isSelected(p.period_id) ? 'bg-primary/5' : ''
                          }`}
                        >
                          <td className="px-4 py-4.5 text-center">
                            <input
                              type="checkbox"
                              checked={periodSelection.isSelected(p.period_id)}
                              onChange={() => periodSelection.toggle(p.period_id)}
                              aria-label={`Select window Semester ${p.semester}`}
                              className="h-4 w-4 rounded border-border/80 accent-primary cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-4.5 text-center font-mono text-muted-foreground font-bold text-xs">
                            {idx + 1}
                          </td>
                          <td className="px-6 py-4.5 font-semibold text-foreground font-mono">
                            {p.batch ? `Batch ${p.batch}` : `Year ${p.academic_year}`}
                          </td>
                          <td className="px-6 py-4.5 font-mono text-muted-foreground font-semibold">
                            Semester {p.semester}
                          </td>
                          <td className="px-6 py-4.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono border ${
                                p.window_type === 'MEDICAL_REPEAT_REGISTRATION'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                  : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              }`}
                            >
                              {windowTypeDisplay}
                            </span>
                          </td>
                          <td className="px-6 py-4.5 text-muted-foreground text-xs font-mono">
                            {startStr}
                          </td>
                          <td className="px-6 py-4.5 text-muted-foreground text-xs font-mono">
                            {editingEndDatePeriodId === p.period_id ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="date"
                                  value={editingEndDateValue}
                                  onChange={(e) => setEditingEndDateValue(e.target.value)}
                                  className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground font-medium"
                                />
                                <button
                                  onClick={() => handleSaveEndDate(p.period_id)}
                                  className="p-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition cursor-pointer"
                                  title="Save End Date"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingEndDatePeriodId(null)}
                                  className="p-1 bg-secondary text-muted-foreground rounded hover:text-foreground transition cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span>{endStr}</span>
                                <button
                                  onClick={() => {
                                    setEditingEndDatePeriodId(p.period_id);
                                    setEditingEndDateValue(
                                      new Date(p.end_date).toISOString().split('T')[0],
                                    );
                                  }}
                                  className="p-1 text-muted-foreground hover:text-primary hover:bg-secondary/40 rounded transition cursor-pointer"
                                  title="Edit End Date"
                                >
                                  <SquarePen className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                                isOpen
                                  ? 'bg-emerald-500/10 text-foreground dark:text-emerald-300 border-emerald-400/60 dark:border-emerald-500/40'
                                  : isSuspended
                                    ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/30'
                                    : 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/30'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="px-6 py-4.5 text-right space-x-2 whitespace-nowrap">
                            {!isOpen && (
                              <button
                                onClick={() => handlePeriodStatusChange(p.period_id, 'OPEN')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition text-xs font-semibold cursor-pointer"
                              >
                                <Play className="h-3 w-3" />
                                Open
                              </button>
                            )}
                            {isOpen && (
                              <button
                                onClick={() => handlePeriodStatusChange(p.period_id, 'SUSPENDED')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg transition text-xs font-semibold cursor-pointer"
                              >
                                <Pause className="h-3 w-3" />
                                Suspend
                              </button>
                            )}
                            {p.status !== 'CLOSED' && (
                              <button
                                onClick={() => handlePeriodStatusChange(p.period_id, 'CLOSED')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition text-xs font-semibold cursor-pointer"
                              >
                                <StopCircle className="h-3 w-3" />
                                Close
                              </button>
                            )}
                            <button
                              onClick={() => handleDeletePeriod(p.period_id)}
                              className="text-[11px] font-bold text-red-500 hover:text-red-600 transition cursor-pointer px-1 py-0.5"
                              title="Delete Window"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <ProgressiveLoadFooter
              loadedCount={visiblePeriodsCount}
              totalCount={filteredPeriods.length}
              isLoadingMore={hasMorePeriods}
              hasMore={hasMorePeriods}
              entityLabel="registration windows"
            />
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: ENROLLMENT MONITOR */}
      {/* ========================================== */}
      {activeTab === 'monitor' && (
        <div className="space-y-6 animate-tabSwipeUp">
          {/* Search & Filter Bar */}
          <div className="bg-card border border-border/80 p-5 rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search students by name, reg no, index no, or NIC..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/60 text-foreground"
                />
                {studentSearch && (
                  <button
                    onClick={() => setStudentSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="px-3 py-2 bg-background border border-border/80 rounded-xl text-xs font-mono font-bold text-foreground flex items-center gap-1.5 shadow-2xs self-start lg:self-auto">
                <Users className="h-3.5 w-3.5 text-primary" />
                Showing {visibleStudents.length} of {filteredStudents.length} Students
              </div>
            </div>

            {/* Filter Dropdowns Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 pt-2 border-t border-border/60">
              {/* Batch Filter */}
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Batch
                </label>
                <select
                  value={monitorBatch}
                  onChange={(e) => setMonitorBatch(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Batches</option>
                  {availableBatches.map((b) => (
                    <option key={b} value={b}>
                      Batch {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester Filter */}
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Semester
                </label>
                <select
                  value={monitorSem}
                  onChange={(e) => setMonitorSem(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Semesters</option>
                  {['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'].map((sem) => (
                    <option key={sem} value={sem}>
                      Semester {sem}
                    </option>
                  ))}
                </select>
              </div>

              {/* Degree Filter */}
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Degree
                </label>
                <select
                  value={monitorDegree}
                  onChange={(e) => setMonitorDegree(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Degrees</option>
                  {degrees.map((d: any) => (
                    <option key={d.degree_id} value={d.degree_id.toString()}>
                      {d.degree_name} ({d.degree_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Department Filter */}
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Department
                </label>
                <select
                  value={monitorDept}
                  onChange={(e) => setMonitorDept(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Departments</option>
                  {departments.map((d: any) => (
                    <option key={d.department_id} value={d.department_id.toString()}>
                      {d.department_name} ({d.department_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Reset Filters */}
              {isMonitorFiltered && (
                <div className="flex items-end col-span-2 sm:col-span-1">
                  <button
                    onClick={resetMonitorFilters}
                    className="w-full px-3 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/80 transition text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-border/60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset Filters
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Highlights Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Active Semester */}
            <div className="bg-card border border-border/80 p-5 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Active Semester
                </span>
                <div className="text-2xl font-bold font-mono text-primary mt-1">
                  {monitorData?.activeSemester ? `Sem ${monitorData.activeSemester}` : '—'}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Target Evaluation Period</p>
              </div>
              <div className="p-3 bg-primary/10 text-primary rounded-xl border border-primary/20">
                <Calendar className="h-6 w-6" />
              </div>
            </div>

            {/* Card 2: Offered Courses */}
            <div className="bg-card border border-border/80 p-5 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Offered Courses
                </span>
                <div className="text-2xl font-bold font-mono text-foreground mt-1">
                  {monitorData?.offeredCoursesCount ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Courses in Curriculum</p>
              </div>
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl border border-blue-500/20">
                <BookOpen className="h-6 w-6" />
              </div>
            </div>

            {/* Card 3: Registered Students */}
            <div className="bg-card border border-border/80 p-5 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Registered Students
                </span>
                <div className="text-2xl font-bold font-mono text-emerald-500 mt-1">
                  {monitorData?.registeredCount ?? 0}{' '}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {monitorData?.totalStudentsCount ?? 0}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {registeredPercentage}% Enrollment Rate
                </p>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>

            {/* Card 4: Non-Registered Students */}
            <div className="bg-card border border-border/80 p-5 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Non-Registered Students
                </span>
                <div className="text-2xl font-bold font-mono text-red-500 mt-1">
                  {monitorData?.nonRegisteredCount ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Pending Registration</p>
              </div>
              <div className="p-3 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Student List Table */}
          <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                    <th className="px-4 py-4 w-12 text-center">#</th>
                    <th className="px-5 py-4">Reg No / Index No</th>
                    <th className="px-5 py-4">Student Name</th>
                    <th className="px-5 py-4">NIC Number</th>
                    <th className="px-4 py-4">Batch</th>
                    <th className="px-5 py-4">Degree & Department</th>
                    <th className="px-5 py-4">Registration Status</th>
                    <th className="px-5 py-4">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs font-medium">
                  {isMonitorLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-20 text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                          Loading enrollment details...
                        </span>
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-20 text-muted-foreground">
                        No students found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    visibleStudents.map((st: any, idx: number) => {
                      const displayName = formatNameWithTitle(st.fullName, st.nicNo);

                      return (
                        <tr
                          key={st.studentId || idx}
                          className="hover:bg-secondary/15 transition-colors"
                        >
                          <td className="px-4 py-4 text-center font-mono text-muted-foreground font-bold">
                            {idx + 1}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap font-mono">
                            <div className="font-bold text-foreground">
                              {st.registrationNumber || '—'}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-semibold">
                              {st.indexNumber || '—'}
                            </div>
                          </td>
                          <td
                            className="px-5 py-4 font-semibold text-foreground max-w-[200px] truncate"
                            title={displayName}
                          >
                            {displayName}
                          </td>
                          <td className="px-5 py-4 font-mono text-muted-foreground whitespace-nowrap">
                            {st.nicNo || '—'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap font-mono font-bold text-primary">
                            {st.batch || '—'}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="font-semibold text-foreground">
                              {st.degreeCode || st.degreeName || '—'}
                            </div>
                            <div className="text-[10px] text-muted-foreground uppercase font-bold">
                              {st.departmentCode || st.departmentName || '—'}
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            {st.isRegistered ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Registered ({st.registeredCoursesCount} Courses)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Not Registered
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-xs font-mono text-muted-foreground">
                            <div>{st.email || '—'}</div>
                            {st.phoneNumber && st.phoneNumber !== '—' && (
                              <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                                {st.phoneNumber}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <ProgressiveLoadFooter
              loadedCount={visibleStudentsCount}
              totalCount={filteredStudents.length}
              isLoadingMore={hasMoreStudents}
              hasMore={hasMoreStudents}
              entityLabel="students"
            />
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 3: ACADEMIC PROGRESSION & PROMOTION */}
      {/* ========================================== */}
      {activeTab === 'progression' && (
        <div className="animate-tabSwipeUp">
          <ProgressionConsole availableBatches={availableBatches} />
        </div>
      )}

      {/* Period Dialog Modal */}
      <PeriodDialog
        open={periodDialogOpen}
        onClose={() => setPeriodDialogOpen(false)}
        onSuccess={(newPeriod) => {
          if (newPeriod) {
            refetchPeriods();
            refetchMonitor();
          }
          setPeriodDialogOpen(false);
        }}
      />
    </div>
  );
}

// ==========================================

// ==========================================
// STUDENT COURSE REGISTRATION VIEW
// ==========================================
// ==========================================

function StudentRegistrationView() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const regSelection = useBulkSelection<number>();
  const [isBulkDropping, setIsBulkDropping] = useState(false);

  // Fetch active registration period status
  const { data: activePeriod, isLoading: isActivePeriodLoading } = useQuery({
    queryKey: ['active-period'],
    queryFn: async () => {
      const response = await apiClient.get('/registrations/active-period');
      return response.data?.data;
    },
  });

  // Fetch eligible courses for registration
  const { data: eligibleCourses = [], isLoading: isEligibleLoading } = useQuery({
    queryKey: ['eligible-courses'],
    queryFn: async () => {
      const response = await apiClient.get('/registrations/eligible-courses');
      return response.data?.data || [];
    },
  });

  // Fetch current registrations
  const { data: myRegistrations = [], isLoading: isMyRegsLoading } = useQuery({
    queryKey: ['my-registrations'],
    queryFn: async () => {
      const response = await apiClient.get('/registrations/my-registrations');
      return response.data?.data || [];
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (courseIds: number[]) => {
      const response = await apiClient.post('/registrations', { courseIds });
      return response.data;
    },
    onSuccess: () => {
      setSelectedCourseIds([]);
      toast.success('Course registrations updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['eligible-courses'] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      toast.error(err.response?.data?.message || 'Failed to complete registration');
    },
  });

  // Drop mutation
  const dropMutation = useMutation({
    mutationFn: async (registrationId: number) => {
      await apiClient.delete(`/registrations/${registrationId}`);
    },
    onSuccess: () => {
      toast.success('Course registration dropped successfully.');
      queryClient.invalidateQueries({ queryKey: ['eligible-courses'] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      toast.error(err.response?.data?.message || 'Failed to drop course');
    },
  });

  // Calculate credits
  const currentRegisteredCredits = myRegistrations.reduce(
    (sum: number, reg: any) => sum + parseFloat(reg.course.credit_value),
    0,
  );

  const selectedCourses = eligibleCourses.filter((c: any) =>
    selectedCourseIds.includes(c.course_id),
  );

  const compulsorySelectedCredits = selectedCourses
    .filter((c: any) => c.is_compulsory)
    .reduce((sum: number, c: any) => sum + parseFloat(c.credit_value), 0);

  const optionalSelectedCredits = selectedCourses
    .filter((c: any) => !c.is_compulsory)
    .reduce((sum: number, c: any) => sum + parseFloat(c.credit_value), 0);

  const selectedCredits = selectedCourses.reduce(
    (sum: number, c: any) => sum + parseFloat(c.credit_value),
    0,
  );

  const formatAcademicYear = (ay?: any, batch?: string) => {
    if (batch) {
      const match = String(batch).match(/(\d{2,4})[/-](\d{2,4})/);
      if (match) {
        return `${match[1].slice(-2)}/${match[2].slice(-2)}`;
      }
      return String(batch);
    }
    if (ay === undefined || ay === null || ay === '') return 'N/A';
    const s = String(ay).trim();
    const match = s.match(/(\d{2,4})[/-](\d{2,4})/);
    if (match) {
      const y1 = match[1].slice(-2);
      const y2 = match[2].slice(-2);
      return `${y1}/${y2}`;
    }
    const num = parseInt(s, 10);
    if (!isNaN(num) && num > 1900 && num <= 2100) {
      const next = (num + 1) % 100;
      return `${String(num).slice(-2)}/${String(next).padStart(2, '0')}`;
    }
    return s;
  };

  const availableWorkload = React.useMemo(
    () =>
      eligibleCourses.reduce((sum: number, c: any) => sum + parseFloat(c.credit_value || '0'), 0),
    [eligibleCourses],
  );

  const compulsoryRegisteredCredits = React.useMemo(
    () =>
      myRegistrations
        .filter((r: any) => r.is_compulsory)
        .reduce((sum: number, r: any) => sum + parseFloat(r.course?.credit_value || '0'), 0),
    [myRegistrations],
  );

  const optionalRegisteredCredits = React.useMemo(
    () =>
      myRegistrations
        .filter((r: any) => !r.is_compulsory)
        .reduce((sum: number, r: any) => sum + parseFloat(r.course?.credit_value || '0'), 0),
    [myRegistrations],
  );

  React.useEffect(() => {
    if (eligibleCourses && eligibleCourses.length > 0) {
      const compulsoryIds = eligibleCourses
        .filter((c: any) => c.is_compulsory)
        .map((c: any) => c.course_id);
      setSelectedCourseIds((prev) => {
        const next = new Set([...prev, ...compulsoryIds]);
        return Array.from(next);
      });
    }
  }, [eligibleCourses]);

  const handleToggleCourse = (courseId: number) => {
    const course = eligibleCourses.find((c: any) => c.course_id === courseId);
    if (course?.is_compulsory) {
      toast.info('Compulsory subjects are required and cannot be removed.');
      return;
    }
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId],
    );
  };

  const selectableEligibleIds = React.useMemo(
    () => eligibleCourses.filter((c: any) => !c.is_compulsory).map((c: any) => c.course_id),
    [eligibleCourses],
  );

  const isAllEligibleSelected =
    selectableEligibleIds.length > 0 &&
    selectableEligibleIds.every((id: number) => selectedCourseIds.includes(id));

  const isIndeterminateEligible =
    selectableEligibleIds.some((id: number) => selectedCourseIds.includes(id)) &&
    !isAllEligibleSelected;

  const toggleAllEligible = () => {
    if (isAllEligibleSelected) {
      setSelectedCourseIds((prev) => prev.filter((id) => !selectableEligibleIds.includes(id)));
    } else {
      setSelectedCourseIds((prev) => Array.from(new Set([...prev, ...selectableEligibleIds])));
    }
  };

  const handleRegister = () => {
    const compulsoryIds = eligibleCourses
      .filter((c: any) => c.is_compulsory)
      .map((c: any) => c.course_id);
    const finalCourseIds = Array.from(new Set([...selectedCourseIds, ...compulsoryIds]));
    if (finalCourseIds.length === 0) return;
    registerMutation.mutate(finalCourseIds);
  };

  const handleDrop = async (registrationId: number, courseCode: string, isCompulsory?: boolean) => {
    if (isCompulsory) {
      toast.error('Compulsory courses cannot be dropped.');
      return;
    }
    const confirmed = await confirm({
      title: 'Drop Course?',
      message: `Are you sure you want to drop course ${courseCode}? You can re-register if the registration window is still open.`,
      confirmText: 'Drop Course',
      variant: 'destructive',
    });
    if (confirmed) {
      dropMutation.mutate(registrationId);
    }
  };

  const sortedMyRegistrations = React.useMemo(() => {
    return [...myRegistrations].sort((a: any, b: any) => {
      if (a.is_compulsory && !b.is_compulsory) return -1;
      if (!a.is_compulsory && b.is_compulsory) return 1;
      return 0;
    });
  }, [myRegistrations]);

  const selectableRegistrationIds: number[] = sortedMyRegistrations
    .filter((reg: any) => !reg.is_compulsory)
    .map((reg: any) => reg.registration_id);

  const handleBulkDrop = async () => {
    const ids = Array.from(regSelection.selectedIds);
    if (ids.length === 0) return;

    const confirmed = await confirm({
      title: `Drop ${ids.length} Course${ids.length === 1 ? '' : 's'}?`,
      message: `Are you sure you want to drop ${ids.length} selected course${ids.length === 1 ? '' : 's'}? You can re-register while the registration window is open.`,
      confirmText: `Drop ${ids.length}`,
      variant: 'destructive',
    });
    if (!confirmed) return;

    setIsBulkDropping(true);
    try {
      const result = await runBulkDelete(ids, async (regId) => {
        await apiClient.delete(`/registrations/${regId}`);
      });

      queryClient.invalidateQueries({ queryKey: ['eligible-courses'] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });

      if (result.deletedCount > 0) {
        regSelection.clear();
      }

      if (result.failedCount > 0) {
        toast.warning(
          `Dropped ${result.deletedCount} course(s), but ${result.failedCount} failed${result.firstErrorMessage ? `: ${result.firstErrorMessage}` : '.'}`,
        );
      } else {
        toast.success(`Dropped ${result.deletedCount} course(s) successfully.`);
      }
    } finally {
      setIsBulkDropping(false);
    }
  };

  const {
    visibleItems: visibleEligibleCourses,
    visibleCount: visibleEligibleCount,
    totalCount: totalEligibleCount,
    hasMore: hasMoreEligible,
  } = useProgressiveList<any>(eligibleCourses);

  const {
    visibleItems: visibleMyRegistrations,
    visibleCount: visibleMyRegsCount,
    totalCount: totalMyRegsCount,
    hasMore: hasMoreMyRegs,
  } = useProgressiveList<any>(sortedMyRegistrations);

  // Loading Screen
  const isGlobalLoading = isActivePeriodLoading || isEligibleLoading || isMyRegsLoading;
  if (isGlobalLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">
          Loading Course Registration portal...
        </p>
      </div>
    );
  }

  const isRegistrationWindowOpen = !!activePeriod;

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Course Registration</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Browse and register for academic modules, track your semester credit workload, and manage
          enrollments.
        </p>
      </div>

      {/* Window Status Banner */}
      {!isRegistrationWindowOpen ? (
        <div className="p-6 bg-amber-500/5 border border-amber-500/15 rounded-3xl flex gap-4 backdrop-blur-md">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl h-fit shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-foreground mb-1">Registration Window Closed</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              There is currently no active registration period open for your academic semester.
              Course enrollment limits and edits are suspended. If you require a manual override or
              need to register past-due backlog modules, please contact the{' '}
              <strong>Exam Division office</strong>.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-primary/5 border border-primary/15 rounded-3xl flex flex-col md:flex-row gap-6 md:items-center justify-between backdrop-blur-md">
          <div className="flex gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl h-fit shrink-0">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-bold text-foreground">Registration Period Active</h4>
              </div>
              <p className="text-sm text-muted-foreground mt-1 leading-normal">
                Academic Year:{' '}
                <strong>
                  {formatAcademicYear(activePeriod.academic_year, activePeriod.batch)}
                </strong>{' '}
                | Semester: <strong>{activePeriod.semester}</strong>
              </p>
              <p className="text-xs text-muted-foreground/75 mt-1.5 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Enrollment window closes on{' '}
                {new Date(activePeriod.end_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Credit WORKLOAD tracker */}
          <div className="w-full md:w-80 bg-secondary/15 border border-border/40 p-4 rounded-2xl flex flex-col justify-center space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-semibold">Available Workload</span>
              <span className="font-mono font-bold text-foreground">
                {availableWorkload.toFixed(1)} Credits
              </span>
            </div>
            <div className="flex justify-between items-center text-xs pt-2 border-t border-border/30">
              <span className="text-muted-foreground font-semibold">Registered Workload</span>
              <span className="font-mono font-bold text-primary">
                {currentRegisteredCredits.toFixed(1)} Credits
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 1. Available Modules List View */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">Available Modules</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select the modules you wish to enroll in for this semester. Compulsory modules are
              pre-selected and required.
            </p>
          </div>
        </div>

        {!isRegistrationWindowOpen ? (
          <div className="p-8 text-center bg-card/10 rounded-3xl border border-border/60 flex flex-col items-center justify-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">
              Registration not available
            </p>
            <p className="text-xs text-muted-foreground/75 mt-1 max-w-sm">
              Modules list is disabled because the enrollment window is currently closed.
            </p>
          </div>
        ) : eligibleCourses.length === 0 ? (
          <div className="p-8 text-center bg-card/10 rounded-3xl border border-dashed border-border flex flex-col items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400/70 mb-3" />
            <p className="text-sm font-semibold text-foreground">All Modules Registered</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              You have registered for all offered modules in your semester. Check your registered
              course list below.
            </p>
          </div>
        ) : (
          <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/15">
                    <th className="px-3.5 py-3 w-10 text-center">
                      <SelectAllCheckbox
                        checked={isAllEligibleSelected}
                        indeterminate={isIndeterminateEligible}
                        disabled={selectableEligibleIds.length === 0}
                        onChange={toggleAllEligible}
                        ariaLabel="Select all optional courses"
                      />
                    </th>
                    <th className="px-3 py-3 w-10 text-center">#</th>
                    <th className="px-4 py-3 whitespace-nowrap">Course Code</th>
                    <th className="px-4 py-3">Course Name</th>
                    <th className="px-4 py-3 whitespace-nowrap text-center">Credit Value</th>
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3">Lecturer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs font-medium">
                  {visibleEligibleCourses.map((course: any, idx: number) => {
                    const isSelected =
                      selectedCourseIds.includes(course.course_id) || course.is_compulsory;
                    return (
                      <tr
                        key={course.course_id}
                        onClick={() => handleToggleCourse(course.course_id)}
                        className={`hover:bg-secondary/15 transition-colors cursor-pointer ${
                          isSelected ? 'bg-primary/5' : ''
                        }`}
                      >
                        <td
                          className="px-3.5 py-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={course.is_compulsory}
                            onChange={() => handleToggleCourse(course.course_id)}
                            aria-label={`Select ${course.course_code}`}
                            className="h-3.5 w-3.5 rounded border-border/80 accent-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-muted-foreground font-bold text-xs">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md uppercase">
                            {course.course_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-foreground">
                          {course.course_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center font-mono font-semibold text-foreground">
                          {parseFloat(course.credit_value).toFixed(1)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {course.is_compulsory ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/25 inline-flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Compulsory
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/25 inline-flex items-center">
                              Optional
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {course.lecturers?.length > 0
                            ? course.lecturers
                                .map((l: any) => l.lecturer?.user?.full_name)
                                .join(', ')
                            : 'No instructor assigned'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Credits Summary & Confirmation Footer */}
            <div className="p-4 bg-secondary/15 border-t border-border/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 bg-card/60 px-3 py-1.5 rounded-xl border border-border/60">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded shrink-0">
                    C
                  </span>
                  <span className="text-muted-foreground">Compulsory Selected:</span>
                  <span className="font-mono font-bold text-foreground">
                    {compulsorySelectedCredits.toFixed(1)} Credits
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-card/60 px-3 py-1.5 rounded-xl border border-border/60">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded shrink-0">
                    O
                  </span>
                  <span className="text-muted-foreground">Optional Selected:</span>
                  <span className="font-mono font-bold text-foreground">
                    {optionalSelectedCredits.toFixed(1)} Credits
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20">
                  <span className="text-muted-foreground font-semibold">Total Selected:</span>
                  <span className="font-mono font-bold text-primary text-sm">
                    {selectedCredits.toFixed(1)} Credits
                  </span>
                </div>
              </div>

              <button
                onClick={handleRegister}
                disabled={registerMutation.isPending || selectedCourseIds.length === 0}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition flex items-center justify-center gap-2 text-xs shadow-lg shadow-primary/20 disabled:opacity-50 cursor-pointer shrink-0"
              >
                {registerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Confirm Registration</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

            <ProgressiveLoadFooter
              loadedCount={visibleEligibleCount}
              totalCount={totalEligibleCount}
              isLoadingMore={hasMoreEligible}
              hasMore={hasMoreEligible}
              entityLabel="courses"
            />
          </div>
        )}
      </div>

      {/* 2. Registered Modules List View */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-foreground">My Registered Courses</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Modules currently confirmed on your academic record for this semester.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isRegistrationWindowOpen && (
              <BulkDeleteButton
                count={regSelection.selectedCount}
                isDeleting={isBulkDropping}
                onClick={handleBulkDrop}
                label="Drop Selected"
              />
            )}
          </div>
        </div>

        {myRegistrations.length === 0 ? (
          <div className="p-8 text-center bg-card/10 rounded-3xl border border-border/60 flex flex-col items-center justify-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/45 mb-2" />
            <p className="text-sm font-semibold text-muted-foreground">No course registrations</p>
            <p className="text-xs text-muted-foreground/75 mt-0.5">
              You are not enrolled in any courses for this semester yet.
            </p>
          </div>
        ) : (
          <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/15">
                    {isRegistrationWindowOpen && (
                      <th className="px-3.5 py-3 w-10 text-center">
                        <SelectAllCheckbox
                          checked={regSelection.isAllSelected(selectableRegistrationIds)}
                          indeterminate={regSelection.isIndeterminate(selectableRegistrationIds)}
                          disabled={isBulkDropping || selectableRegistrationIds.length === 0}
                          onChange={() => regSelection.toggleAll(selectableRegistrationIds)}
                          ariaLabel="Select all registered courses"
                        />
                      </th>
                    )}
                    <th className="px-3 py-3 w-10 text-center">#</th>
                    <th className="px-4 py-3 whitespace-nowrap">Course Code</th>
                    <th className="px-4 py-3">Course Name</th>
                    <th className="px-4 py-3 whitespace-nowrap text-center">Credit Value</th>
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3">Lecturer</th>
                    {isRegistrationWindowOpen && (
                      <th className="px-4 py-3 text-right whitespace-nowrap">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs font-medium">
                  {visibleMyRegistrations.map((reg: any, idx: number) => {
                    const isComp = Boolean(reg.is_compulsory);
                    return (
                      <tr
                        key={reg.registration_id}
                        className={`hover:bg-secondary/15 transition-colors ${
                          regSelection.isSelected(reg.registration_id) ? 'bg-primary/5' : ''
                        }`}
                      >
                        {isRegistrationWindowOpen && (
                          <td className="px-3.5 py-3 text-center">
                            {isComp ? (
                              <div
                                className="h-4 w-4 mx-auto flex items-center justify-center text-amber-400"
                                title="Compulsory course"
                              >
                                <Lock className="h-3.5 w-3.5" />
                              </div>
                            ) : (
                              <input
                                type="checkbox"
                                checked={regSelection.isSelected(reg.registration_id)}
                                disabled={isBulkDropping}
                                onChange={() => regSelection.toggle(reg.registration_id)}
                                aria-label={`Select ${reg.course.course_code}`}
                                className="h-3.5 w-3.5 rounded border-border/80 accent-primary cursor-pointer disabled:opacity-50"
                              />
                            )}
                          </td>
                        )}
                        <td className="px-3 py-3 text-center font-mono text-muted-foreground font-bold text-xs">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md uppercase">
                            {reg.course.course_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-foreground">
                          {reg.course.course_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center font-mono font-semibold text-foreground">
                          {parseFloat(reg.course.credit_value).toFixed(1)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isComp ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/25 inline-flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Compulsory
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/25 inline-flex items-center">
                              Optional
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {reg.course.lecturers?.length > 0
                            ? reg.course.lecturers
                                .map((l: any) => l.lecturer?.user?.full_name)
                                .join(', ')
                            : 'TBD'}
                        </td>
                        {isRegistrationWindowOpen && (
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {isComp ? (
                              <span
                                className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground bg-secondary/30 rounded-lg inline-flex items-center gap-1 cursor-default select-none border border-border/40"
                                title="Compulsory courses cannot be dropped"
                              >
                                <Lock className="h-3 w-3 text-amber-400" />
                                Required
                              </span>
                            ) : (
                              <button
                                onClick={() =>
                                  handleDrop(
                                    reg.registration_id,
                                    reg.course.course_code,
                                    reg.is_compulsory,
                                  )
                                }
                                disabled={dropMutation.isPending}
                                className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition disabled:opacity-50 cursor-pointer"
                                title="Drop course"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Registered Courses Credit Summary Footer */}
            <div className="p-4 bg-secondary/15 border-t border-border/70 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 bg-card/60 px-3 py-1.5 rounded-xl border border-border/60">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded shrink-0">
                    C
                  </span>
                  <span className="text-muted-foreground">Compulsory Registered:</span>
                  <span className="font-mono font-bold text-foreground">
                    {compulsoryRegisteredCredits.toFixed(1)} Credits
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-card/60 px-3 py-1.5 rounded-xl border border-border/60">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded shrink-0">
                    O
                  </span>
                  <span className="text-muted-foreground">Optional Registered:</span>
                  <span className="font-mono font-bold text-foreground">
                    {optionalRegisteredCredits.toFixed(1)} Credits
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20">
                  <span className="text-muted-foreground font-semibold">Total Registered:</span>
                  <span className="font-mono font-bold text-primary text-sm">
                    {currentRegisteredCredits.toFixed(1)} Credits
                  </span>
                </div>
              </div>
            </div>

            <ProgressiveLoadFooter
              loadedCount={visibleMyRegsCount}
              totalCount={totalMyRegsCount}
              isLoadingMore={hasMoreMyRegs}
              hasMore={hasMoreMyRegs}
              entityLabel="registered courses"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// ROOT PAGE COMPONENT
// ==========================================
export default function RegistrationPage() {
  const { user } = useAuthStore();
  const isStudent = user?.role === UserRole.STUDENT;

  if (isStudent) {
    return <StudentRegistrationView />;
  }

  return <StaffRegistrationView />;
}
