'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useToast } from '../../../hooks/use-toast';
import { useConfirm } from '../../../hooks/use-confirm';
import { useBulkSelection } from '../../../hooks/use-bulk-selection';
import { SelectAllCheckbox } from '../../../components/ui/bulk-delete-button';
import {
  GraduationCap,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Check,
  Search,
  X,
  Users,
  ChevronDown,
} from 'lucide-react';

interface EvaluatedStudent {
  studentId: number;
  registrationNumber: string;
  indexNumber: string;
  fullName: string;
  batch: string;
  degreeCode: string;
  currentSemester: string;
  progressionStatus: 'REGULAR' | 'HOLD_REMEDIATION' | 'HOLD_BATCH_DEMOTION';
  isResurfacedCandidate: boolean;
  consideredDetails: {
    semester: string;
    gpa: number | null;
    credits: number;
    isReleased: boolean;
  }[];
  totalConsideredCredits: number;
  calculatedCgpa: number | null;
  isEligible: boolean;
  recommendedAction: 'PROMOTE' | 'HOLD_REMEDIATION';
}

interface ProgressionEvaluationResponse {
  batch: string;
  targetSemester: string;
  minGpa: number;
  consideredSemesters: string[];
  totalCount: number;
  eligibleCount: number;
  ineligibleCount: number;
  students: EvaluatedStudent[];
}

const ALL_SEMESTERS = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2'];

export function ProgressionConsole({ availableBatches }: { availableBatches: string[] }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();

  // Selection controls
  const [selectedBatch, setSelectedBatch] = useState<string>(availableBatches[0] || '21/22');
  const [targetSemester, setTargetSemester] = useState<string>('3.1');
  const [selectedSemesters, setSelectedSemesters] = useState<string[]>(['1.1', '1.2', '2.1']);
  const [minGpaInput, setMinGpaInput] = useState<string>('2.00');

  // Search & Filter controls
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'ELIGIBLE' | 'INELIGIBLE' | 'RESURFACED'
  >('ALL');

  // Multi-selection state for student checkboxes
  const studentSelection = useBulkSelection<number>();

  // Action selected by user to apply to selected students
  const [selectedAction, setSelectedAction] = useState<
    'PROMOTE' | 'HOLD_REMEDIATION' | 'HOLD_BATCH_DEMOTION' | ''
  >('');

  // Fetch Evaluation Data automatically when batch, targetSemester, selectedSemesters, or minGpa changes
  const {
    data: evalResponse,
    isLoading,
    isFetching,
  } = useQuery<ProgressionEvaluationResponse>({
    queryKey: [
      'progression-evaluation',
      selectedBatch,
      targetSemester,
      selectedSemesters,
      minGpaInput,
    ],
    queryFn: async () => {
      const parsedGpa = parseFloat(minGpaInput);
      const res = await apiClient.get('/registrations/progression/evaluate', {
        params: {
          batch: selectedBatch,
          targetSemester,
          consideredSemesters: selectedSemesters.join(','),
          minGpa: isNaN(parsedGpa) ? 2.0 : parsedGpa,
        },
      });
      return res.data?.data;
    },
    enabled: Boolean(selectedBatch && targetSemester),
  });

  // Cumulative Discrete Semesters Handler:
  // If user selects a semester in the middle, select all semesters before that.
  // If user unchecks the last selected semester, remove it; if they uncheck an earlier one, keep preceding ones.
  const handleSemesterClick = (sem: string) => {
    const targetIndex = ALL_SEMESTERS.indexOf(sem);
    if (targetIndex === -1) return;

    const isAlreadySelected = selectedSemesters.includes(sem);

    if (isAlreadySelected) {
      // If clicking an already selected semester:
      // If it's the latest selected semester, toggle it off (keep all before it).
      // Otherwise, select up to the semester immediately before it.
      const currentIndices = selectedSemesters
        .map((s) => ALL_SEMESTERS.indexOf(s))
        .filter((i) => i !== -1);
      const maxIndex = Math.max(...currentIndices);

      if (targetIndex === maxIndex) {
        setSelectedSemesters(ALL_SEMESTERS.slice(0, targetIndex));
      } else {
        setSelectedSemesters(ALL_SEMESTERS.slice(0, targetIndex));
      }
    } else {
      // Select all semesters from 0 up to and including targetIndex
      setSelectedSemesters(ALL_SEMESTERS.slice(0, targetIndex + 1));
    }
  };

  // Mutation for executing promotion on selected students with chosen action
  const executeActionMutation = useMutation({
    mutationFn: async ({
      studentIds,
      action,
    }: {
      studentIds: number[];
      action: 'PROMOTE' | 'HOLD_REMEDIATION' | 'HOLD_BATCH_DEMOTION';
    }) => {
      const payloadDecisions = studentIds.map((id) => ({
        studentId: id,
        action,
      }));

      const res = await apiClient.post('/registrations/progression/promote', {
        batch: selectedBatch,
        targetSemester,
        decisions: payloadDecisions,
      });
      return res.data;
    },
    onSuccess: (data, variables) => {
      const actionName =
        variables.action === 'PROMOTE'
          ? 'Promoted'
          : variables.action === 'HOLD_REMEDIATION'
            ? 'Placed on Option 1 Remediation'
            : 'Placed on Option 2 Demotion';

      toast.success(`Successfully ${actionName} for ${variables.studentIds.length} students!`);
      // Clear selection after execution
      studentSelection.toggleAll([]);
      setSelectedAction('');
      queryClient.invalidateQueries({ queryKey: ['progression-evaluation'] });
      queryClient.invalidateQueries({ queryKey: ['registration-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['registration-periods'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to execute progression action');
    },
  });

  const handleApplyAction = async () => {
    if (!selectedAction) {
      toast.error('Please select an action to apply to the selected students.');
      return;
    }

    const targetStudentIds = studentSelection.selectedIds;
    if (targetStudentIds.length === 0) {
      toast.error('Please select at least one student from the list.');
      return;
    }

    const actionTitle =
      selectedAction === 'PROMOTE'
        ? `Promote to Semester ${targetSemester}`
        : selectedAction === 'HOLD_REMEDIATION'
          ? 'Apply Option 1: Remediation Hold'
          : 'Apply Option 2: Demotion Hold';

    const actionDesc =
      selectedAction === 'PROMOTE'
        ? `advance ${targetStudentIds.length} students to Semester ${targetSemester} and authorize normal lecture course enrollment.`
        : selectedAction === 'HOLD_REMEDIATION'
          ? `retain ${targetStudentIds.length} students in their current semester under Option 1 Remediation. Module registrations will be restricted until re-evaluated next term.`
          : `place ${targetStudentIds.length} students under Option 2 Demotion (held back a full academic cycle with the junior cohort).`;

    const confirmed = await confirm({
      title: `${actionTitle}?`,
      message: `You are about to ${actionDesc}\n\nAre you sure you want to proceed?`,
      confirmText: 'Apply Action',
      variant: selectedAction === 'PROMOTE' ? 'primary' : 'destructive',
    });

    if (confirmed) {
      executeActionMutation.mutate({
        studentIds: targetStudentIds,
        action: selectedAction,
      });
    }
  };

  // Filter students for display
  const students = evalResponse?.students || [];
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Status filter
      if (statusFilter === 'ELIGIBLE' && !s.isEligible) return false;
      if (statusFilter === 'INELIGIBLE' && s.isEligible) return false;
      if (statusFilter === 'RESURFACED' && !s.isResurfacedCandidate) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchReg = s.registrationNumber.toLowerCase().includes(q);
        const matchIndex = s.indexNumber.toLowerCase().includes(q);
        const matchName = (s.fullName || '').toLowerCase().includes(q);
        const matchDeg = (s.degreeCode || '').toLowerCase().includes(q);
        return matchReg || matchIndex || matchName || matchDeg;
      }
      return true;
    });
  }, [students, statusFilter, searchQuery]);

  const visibleStudentIds = useMemo(
    () => filteredStudents.map((s) => s.studentId),
    [filteredStudents],
  );

  return (
    <div className="space-y-6">
      {/* 1. Configuration Console Card */}
      <div className="bg-card/40 border border-border/80 rounded-2xl p-6 shadow-xl backdrop-blur-md space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Academic Progression & Promotion Console
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Evaluate student Cumulative GPAs across discrete semesters and promote eligible
                cohorts to the next semester.
              </p>
            </div>
          </div>

          {(isLoading || isFetching) && (
            <div className="flex items-center gap-2 text-xs font-semibold text-primary px-3 py-1.5 bg-primary/10 rounded-xl">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Evaluating cohort...
            </div>
          )}
        </div>

        {/* Filters and Config Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Target Selection */}
          <div className="space-y-3 bg-secondary/20 p-4 rounded-xl border border-border/60">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ArrowRight className="h-3.5 w-3.5 text-primary" /> Target Progression
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Batch
                </label>
                <select
                  value={selectedBatch}
                  onChange={(e) => {
                    setSelectedBatch(e.target.value);
                    studentSelection.toggleAll([]);
                  }}
                  className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  {availableBatches.map((b) => (
                    <option key={b} value={b}>
                      Batch {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Promote To
                </label>
                <select
                  value={targetSemester}
                  onChange={(e) => {
                    setTargetSemester(e.target.value);
                    studentSelection.toggleAll([]);
                  }}
                  className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  {ALL_SEMESTERS.map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* GPA Threshold Input */}
          <div className="space-y-3 bg-secondary/20 p-4 rounded-xl border border-border/60">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-primary" /> Minimum GPA Requirement
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Min Evaluated CGPA
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="4.0"
                  value={minGpaInput}
                  onChange={(e) => setMinGpaInput(e.target.value)}
                  placeholder="2.00"
                  className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                />
              </div>
              <div className="text-[11px] text-muted-foreground/90 max-w-[140px] pt-4 leading-tight">
                Standard criteria is <strong>2.00</strong> across evaluated semesters.
              </div>
            </div>
          </div>
        </div>

        {/* Discrete Semesters Cumulative Selector */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <label className="block text-xs font-bold text-foreground">
            Select Discrete Semesters to Calculate Cumulative GPA (Only released marks are factored
            in):
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {ALL_SEMESTERS.map((sem) => {
              const isSelected = selectedSemesters.includes(sem);
              return (
                <button
                  key={sem}
                  type="button"
                  onClick={() => handleSemesterClick(sem)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background hover:bg-secondary border-border/80 text-muted-foreground'
                  }`}
                  title={`Select Semester ${sem} (automatically includes all previous semesters)`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${isSelected ? 'bg-white' : 'bg-muted-foreground/40'}`}
                  />
                  Semester {sem}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setSelectedSemesters([])}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                selectedSemesters.length === 0
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/40 font-bold'
                  : 'bg-background hover:bg-secondary border-border/80 text-muted-foreground'
              }`}
            >
              Clear All
            </button>
            {selectedSemesters.length === 0 && (
              <span className="text-xs text-amber-500 font-semibold px-2 py-1 bg-amber-500/10 rounded-lg border border-amber-500/30">
                (All students will be marked eligible without GPA requirements)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Metrics & Decision Summary Cards */}
      {evalResponse && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card/40 border border-border/80 rounded-2xl p-4 shadow-sm backdrop-blur-md">
            <span className="text-xs text-muted-foreground font-semibold">
              Total Evaluated Cohort
            </span>
            <div className="text-2xl font-bold font-mono text-foreground mt-1">
              {evalResponse.totalCount}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Batch {evalResponse.batch} candidates
            </div>
          </div>

          <div className="bg-card/40 border border-emerald-500/30 rounded-2xl p-4 shadow-sm backdrop-blur-md bg-emerald-500/5">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Eligible for Promotion
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {evalResponse.eligibleCount}
            </div>
            <div className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
              CGPA &ge; {evalResponse.minGpa.toFixed(2)} on released marks
            </div>
          </div>

          <div className="bg-card/40 border border-amber-500/30 rounded-2xl p-4 shadow-sm backdrop-blur-md bg-amber-500/5">
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Needs Review / Ineligible
            </span>
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
              {evalResponse.ineligibleCount}
            </div>
            <div className="text-[11px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">
              CGPA &lt; {evalResponse.minGpa.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* 3. Students Table Card with Search, Filter & Bulk Action Toolbar */}
      <div className="bg-card/30 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md space-y-4 p-5">
        {/* Search, Filter Bar & Standard Counter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input & Status Filter Dropdown */}
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by student registration number, index number, or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2 bg-secondary/30 border border-border/70 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Eligibility Status Filter Dropdown */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-bold text-muted-foreground uppercase">Filter:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-background border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground cursor-pointer min-w-[150px]"
              >
                <option value="ALL">All Students ({students.length})</option>
                <option value="ELIGIBLE">Eligible ({evalResponse?.eligibleCount || 0})</option>
                <option value="INELIGIBLE">
                  Ineligible ({evalResponse?.ineligibleCount || 0})
                </option>
                {students.some((s) => s.isResurfacedCandidate) && (
                  <option value="RESURFACED">
                    Resurfaced Candidates ({students.filter((s) => s.isResurfacedCandidate).length})
                  </option>
                )}
              </select>
            </div>
          </div>

          {/* Standard Counter */}
          <div className="px-3 py-2 bg-background border border-border/80 rounded-xl text-xs font-mono font-bold text-foreground flex items-center gap-1.5 shadow-2xs self-start lg:self-auto shrink-0">
            <Users className="h-3.5 w-3.5 text-primary" />
            Showing {filteredStudents.length} of {students.length} Students
          </div>
        </div>

        {/* Action Selection & Execution Toolbar with Contextual Help Text */}
        <div className="p-4 bg-secondary/20 border border-border/70 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                Action for Selected ({studentSelection.selectedCount}):
              </span>
              <div className="relative">
                <select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value as any)}
                  className="px-3 py-2 bg-background border border-border/80 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground cursor-pointer pr-8"
                >
                  <option value="">— Choose Action to Perform —</option>
                  <option value="PROMOTE">Promote Selected to Semester {targetSemester}</option>
                  <option value="HOLD_REMEDIATION">
                    Option 1: Remediation Hold (Re-evaluate next term)
                  </option>
                  <option value="HOLD_BATCH_DEMOTION">
                    Option 2: Demotion Hold (Hold to Junior Batch)
                  </option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <button
              type="button"
              onClick={handleApplyAction}
              disabled={
                executeActionMutation.isPending ||
                !selectedAction ||
                studentSelection.selectedCount === 0
              }
              className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-xl text-xs transition shadow-md shadow-primary/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {executeActionMutation.isPending ? 'Applying...' : 'Apply Action to Selected'}
            </button>
          </div>

          {/* Contextual Action Help Text displayed next to the options and action button */}
          <div className="text-[11px] text-muted-foreground leading-snug max-w-xl">
            {selectedAction === 'PROMOTE' && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                <strong>Promote:</strong> Advances selected students to Semester {targetSemester}{' '}
                and permits module registration when the window opens.
              </span>
            )}
            {selectedAction === 'HOLD_REMEDIATION' && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                <strong>Option 1 (Remediation):</strong> Retains selected students in their current
                semester. Lecture module registration is suspended until re-evaluated when the batch
                reaches the next semester.
              </span>
            )}
            {selectedAction === 'HOLD_BATCH_DEMOTION' && (
              <span className="text-red-600 dark:text-red-400 font-medium">
                <strong>Option 2 (Demotion):</strong> Retains selected students for a full academic
                cycle to be re-evaluated when the junior cohort reaches this level.
              </span>
            )}
            {!selectedAction && (
              <span>
                Select students via checkboxes, choose an action from the dropdown, and click{' '}
                <strong>Apply Action to Selected</strong>.
              </span>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border/80 bg-secondary/20 text-muted-foreground font-bold uppercase tracking-wider">
                <th className="px-4 py-3 w-10 text-center">
                  <SelectAllCheckbox
                    checked={studentSelection.isAllSelected(visibleStudentIds)}
                    indeterminate={studentSelection.isIndeterminate(visibleStudentIds)}
                    disabled={visibleStudentIds.length === 0}
                    onChange={() => studentSelection.toggleAll(visibleStudentIds)}
                    ariaLabel="Select all visible students"
                  />
                </th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Reg No &amp; Index No</th>
                <th className="px-4 py-3">Degree &amp; Academic Year</th>
                <th className="px-4 py-3">Considered Semesters Breakup</th>
                <th className="px-4 py-3 text-right">Evaluated CGPA</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-medium">
              {isLoading || isFetching ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Evaluating student academic records...
                    </span>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-muted-foreground">
                    No students found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const isChecked = studentSelection.isSelected(student.studentId);
                  return (
                    <tr
                      key={student.studentId}
                      className={`hover:bg-secondary/15 transition ${
                        isChecked
                          ? 'bg-primary/5'
                          : student.isResurfacedCandidate
                            ? 'bg-purple-500/5'
                            : ''
                      }`}
                    >
                      {/* Checkbox column */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => studentSelection.toggle(student.studentId)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer"
                          aria-label={`Select ${student.fullName || student.registrationNumber}`}
                        />
                      </td>

                      {/* Name column */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-foreground">{student.fullName || '—'}</div>
                        {student.isResurfacedCandidate && (
                          <span className="inline-block px-1.5 py-0.5 mt-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded text-[10px] font-bold border border-purple-500/30">
                            Remediation Review Candidate
                          </span>
                        )}
                      </td>

                      {/* Reg No & Index No column */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-foreground">
                          {student.registrationNumber}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {student.indexNumber || '—'}
                        </div>
                      </td>

                      {/* Degree & Academic Year column */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-foreground">
                          {student.degreeCode || '—'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Batch {student.batch}
                        </div>
                      </td>

                      {/* Considered Semesters Breakup column */}
                      <td className="px-4 py-3">
                        {student.consideredDetails.length === 0 ? (
                          <span className="text-muted-foreground text-[11px]">
                            No GPA Requirement
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {student.consideredDetails.map((det) => (
                              <span
                                key={det.semester}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                                  det.isReleased
                                    ? 'bg-background text-foreground border-border/80'
                                    : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                                }`}
                                title={
                                  det.isReleased
                                    ? `Semester ${det.semester}: GPA ${det.gpa} (${det.credits} credits)`
                                    : `Semester ${det.semester}: Results Pending`
                                }
                              >
                                {det.semester}:{' '}
                                <strong>{det.isReleased ? det.gpa?.toFixed(2) : 'Pending'}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Evaluated CGPA column */}
                      <td className="px-4 py-3 text-right">
                        {student.calculatedCgpa !== null ? (
                          <div
                            className={`font-mono font-bold text-sm ${
                              student.isEligible
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {student.calculatedCgpa.toFixed(2)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground font-mono">—</span>
                        )}
                      </td>

                      {/* Status column */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            student.isEligible
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {student.isEligible ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" /> Eligible
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-3 w-3" /> Ineligible
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
