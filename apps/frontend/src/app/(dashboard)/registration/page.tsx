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
} from 'lucide-react';

// ==========================================
// STAFF & ADMIN REGISTRATION CONSOLE
// ==========================================
function StaffRegistrationView() {
  const toast = useToast();
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState<'windows' | 'monitor'>('windows');

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
// STUDENT COURSE REGISTRATION VIEW
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
      return batch;
    }
    if (!ay) return '22/23';
    const s = String(ay);
    if (s.includes('/')) return s;
    const num = parseInt(s, 10);
    if (!isNaN(num) && num > 2000) {
      const next = (num + 1) % 100;
      return `${String(num).slice(-2)}/${String(next).padStart(2, '0')}`;
    }
    return s;
  };

  const handleSelectAll = () => {
    if (selectedCourseIds.length === eligibleCourses.length) {
      setSelectedCourseIds([]);
    } else {
      setSelectedCourseIds(eligibleCourses.map((c: any) => c.course_id));
    }
  };

  const handleSelectCompulsory = () => {
    const compulsoryIds = eligibleCourses
      .filter((c: any) => c.is_compulsory)
      .map((c: any) => c.course_id);
    setSelectedCourseIds(compulsoryIds);
  };

  const toggleCourse = (courseId: number) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId],
    );
  };

  const handleRegister = () => {
    if (selectedCourseIds.length === 0) {
      toast.error('Please select at least one course to register.');
      return;
    }
    registerMutation.mutate(selectedCourseIds);
  };

  const handleDrop = async (registrationId: number, courseCode: string) => {
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

  const handleBulkDrop = async () => {
    if (regSelection.selectedCount === 0) return;
    const confirmed = await confirm({
      title: 'Drop Selected Courses?',
      message: `Are you sure you want to drop ${regSelection.selectedCount} course(s)? You can re-register while the registration window remains open.`,
      confirmText: `Drop (${regSelection.selectedCount})`,
      variant: 'destructive',
    });
    if (!confirmed) return;

    setIsBulkDropping(true);
    try {
      const droppedIds: number[] = [];
      const { deletedCount, failedCount, firstErrorMessage } = await runBulkDelete(
        regSelection.selectedIds,
        async (id) => {
          await apiClient.delete(`/registrations/${id}`);
          droppedIds.push(id);
        },
      );
      if (deletedCount > 0) {
        toast.success(`${deletedCount} course(s) dropped successfully.`);
        regSelection.removeFromSelection(droppedIds);
        queryClient.invalidateQueries({ queryKey: ['eligible-courses'] });
        queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
      }
      if (failedCount > 0) {
        toast.error(
          `${failedCount} course(s) could not be dropped${firstErrorMessage ? `: ${firstErrorMessage}` : '.'}`,
        );
      }
      if (failedCount === 0) regSelection.clear();
    } finally {
      setIsBulkDropping(false);
    }
  };

  const isWindowOpen = activePeriod && activePeriod.status === 'OPEN';

  const {
    visibleItems: visibleEligibleCourses,
    visibleCount: visibleEligibleCount,
    totalCount: totalEligibleCount,
    hasMore: hasMoreEligible,
  } = useProgressiveList<any>(eligibleCourses);

  const {
    visibleItems: visibleMyRegs,
    visibleCount: visibleMyRegsCount,
    totalCount: totalMyRegsCount,
    hasMore: hasMoreMyRegs,
  } = useProgressiveList<any>(myRegistrations);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Course Registration</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Select and enroll in academic courses for your active semester within the published
            registration window.
          </p>
        </div>
      </div>

      {/* Registration Period Alert / Banner */}
      {isActivePeriodLoading ? (
        <div className="p-5 bg-card/60 border border-border/70 rounded-2xl flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground font-semibold">
            Checking registration window availability...
          </span>
        </div>
      ) : isWindowOpen ? (
        <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-foreground">
                Course Registration is Open (Batch{' '}
                {formatAcademicYear(activePeriod.academic_year, activePeriod.batch)} - Semester{' '}
                {activePeriod.semester})
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Window closes on{' '}
                {new Date(activePeriod.end_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-500 text-white font-bold text-xs rounded-full uppercase tracking-wider self-start sm:self-auto shadow-sm">
            Active Window
          </span>
        </div>
      ) : (
        <div className="p-5 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-destructive">Registration Window Closed</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              There is currently no open course registration period for your batch and semester.
              Course enrollment and drops are disabled.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Eligible Courses vs Selection Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Eligible Courses Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card/40 border border-border/80 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">
                Available Courses ({eligibleCourses.length})
              </h3>
            </div>

            {isWindowOpen && eligibleCourses.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectCompulsory}
                  className="px-2.5 py-1 text-xs font-semibold bg-secondary hover:bg-secondary/80 rounded-lg text-secondary-foreground transition cursor-pointer"
                >
                  Select Compulsory
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition cursor-pointer"
                >
                  {selectedCourseIds.length === eligibleCourses.length
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
              </div>
            )}
          </div>

          <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                    {isWindowOpen && <th className="px-4 py-3.5 w-10 text-center">Select</th>}
                    <th className="px-4 py-3.5 w-12 text-center">#</th>
                    <th className="px-5 py-3.5">Course</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5 text-center">Credits</th>
                    <th className="px-4 py-3.5">Offering Dept</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs font-medium">
                  {isEligibleLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          Loading available courses...
                        </span>
                      </td>
                    </tr>
                  ) : eligibleCourses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-muted-foreground">
                        No eligible courses found for your current degree or semester.
                      </td>
                    </tr>
                  ) : (
                    visibleEligibleCourses.map((c: any, idx: number) => {
                      const isSelected = selectedCourseIds.includes(c.course_id);
                      return (
                        <tr
                          key={c.course_id}
                          onClick={() => isWindowOpen && toggleCourse(c.course_id)}
                          className={`hover:bg-secondary/20 transition-colors ${
                            isSelected ? 'bg-primary/5' : ''
                          } ${isWindowOpen ? 'cursor-pointer' : ''}`}
                        >
                          {isWindowOpen && (
                            <td
                              className="px-4 py-3.5 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCourse(c.course_id)}
                                className="h-4 w-4 rounded border-border/80 accent-primary cursor-pointer"
                              />
                            </td>
                          )}
                          <td className="px-4 py-3.5 text-center font-mono text-muted-foreground font-bold">
                            {idx + 1}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-foreground font-mono">
                              {c.course_code}
                            </div>
                            <div className="text-muted-foreground text-xs">{c.course_name}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                c.is_compulsory
                                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                  : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              }`}
                            >
                              {c.is_compulsory ? 'Compulsory' : 'Optional'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono font-bold text-foreground">
                            {c.credit_value}
                          </td>
                          <td className="px-4 py-3.5 uppercase font-semibold text-muted-foreground">
                            {c.department?.department_code || c.department?.department_name || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <ProgressiveLoadFooter
              loadedCount={visibleEligibleCount}
              totalCount={totalEligibleCount}
              isLoadingMore={hasMoreEligible}
              hasMore={hasMoreEligible}
              entityLabel="courses"
            />
          </div>
        </div>

        {/* Right Column: Enrollment Cart & Summary */}
        <div className="space-y-4">
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Selection Summary
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                <span className="text-muted-foreground">Courses Selected</span>
                <span className="font-bold text-foreground font-mono">
                  {selectedCourseIds.length}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                <span className="text-muted-foreground">Compulsory Credits</span>
                <span className="font-bold text-amber-500 font-mono">
                  {compulsorySelectedCredits.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                <span className="text-muted-foreground">Optional Credits</span>
                <span className="font-bold text-blue-400 font-mono">
                  {optionalSelectedCredits.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/80">
                <span className="font-bold text-foreground">Total Selected Credits</span>
                <span className="font-bold text-primary font-mono text-sm">
                  {selectedCredits.toFixed(1)}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={
                !isWindowOpen || selectedCourseIds.length === 0 || registerMutation.isPending
              }
              onClick={handleRegister}
              className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/95 transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Registering Courses...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Confirm & Register Selected
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Currently Registered Courses Section */}
      <div className="space-y-4 pt-4">
        <div className="bg-card/40 border border-border/80 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-foreground">
              Currently Registered Courses ({myRegistrations.length})
            </h3>
          </div>

          {isWindowOpen && (
            <BulkDeleteButton
              count={regSelection.selectedCount}
              isDeleting={isBulkDropping}
              onClick={handleBulkDrop}
            />
          )}
        </div>

        <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                  {isWindowOpen && (
                    <th className="px-4 py-3.5 w-10 text-center">
                      <SelectAllCheckbox
                        checked={regSelection.isAllSelected(
                          myRegistrations.map((r: any) => r.registration_id),
                        )}
                        indeterminate={regSelection.isIndeterminate(
                          myRegistrations.map((r: any) => r.registration_id),
                        )}
                        disabled={myRegistrations.length === 0}
                        onChange={() =>
                          regSelection.toggleAll(myRegistrations.map((r: any) => r.registration_id))
                        }
                        ariaLabel="Select all registered courses"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3.5 w-12 text-center">#</th>
                  <th className="px-5 py-3.5">Course Code</th>
                  <th className="px-6 py-3.5">Course Name</th>
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5 text-center">Credits</th>
                  {isWindowOpen && <th className="px-4 py-3.5 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs font-medium">
                {isMyRegsLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Loading current registrations...
                      </span>
                    </td>
                  </tr>
                ) : myRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-muted-foreground">
                      You have not registered for any courses in this semester yet.
                    </td>
                  </tr>
                ) : (
                  visibleMyRegs.map((reg: any, idx: number) => (
                    <tr
                      key={reg.registration_id}
                      className="hover:bg-secondary/15 transition-colors"
                    >
                      {isWindowOpen && (
                        <td className="px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={regSelection.isSelected(reg.registration_id)}
                            onChange={() => regSelection.toggle(reg.registration_id)}
                            className="h-4 w-4 rounded border-border/80 accent-primary cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3.5 text-center font-mono text-muted-foreground font-bold">
                        {idx + 1}
                      </td>
                      <td className="px-5 py-3.5 font-bold font-mono text-foreground">
                        {reg.course.course_code}
                      </td>
                      <td className="px-6 py-3.5 text-foreground">{reg.course.course_name}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            reg.course.is_compulsory
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}
                        >
                          {reg.course.is_compulsory ? 'Compulsory' : 'Optional'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-bold text-foreground">
                        {reg.course.credit_value}
                      </td>
                      {isWindowOpen && (
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDrop(reg.registration_id, reg.course.course_code)}
                            className="text-[11px] font-bold text-red-500 hover:text-red-600 transition cursor-pointer px-1 py-0.5"
                          >
                            Drop
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <ProgressiveLoadFooter
            loadedCount={visibleMyRegsCount}
            totalCount={totalMyRegsCount}
            isLoadingMore={hasMoreMyRegs}
            hasMore={hasMoreMyRegs}
            entityLabel="registered courses"
          />
        </div>
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
