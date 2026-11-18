'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useToast } from '../../../hooks/use-toast';
import { useConfirm } from '../../../hooks/use-confirm';
import {
  GraduationCap,
  Sparkles,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Check,
  Clock,
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

  // Trigger evaluation query state
  const [evaluationParams, setEvaluationParams] = useState<{
    batch: string;
    targetSemester: string;
    consideredSemesters: string[];
    minGpa: number;
  }>({
    batch: selectedBatch,
    targetSemester: '3.1',
    consideredSemesters: ['1.1', '1.2', '2.1'],
    minGpa: 2.0,
  });

  // Decisions map: studentId -> { action: 'PROMOTE' | 'HOLD_REMEDIATION' | 'HOLD_BATCH_DEMOTION', remarks?: string }
  const [decisions, setDecisions] = useState<
    Record<number, 'PROMOTE' | 'HOLD_REMEDIATION' | 'HOLD_BATCH_DEMOTION'>
  >({});

  // Filter tabs inside table: 'ALL' | 'ELIGIBLE' | 'INELIGIBLE' | 'RESURFACED'
  const [filterTab, setFilterTab] = useState<'ALL' | 'ELIGIBLE' | 'INELIGIBLE' | 'RESURFACED'>(
    'ALL',
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Evaluation Data
  const {
    data: evalResponse,
    isLoading,
    isFetching,
  } = useQuery<ProgressionEvaluationResponse>({
    queryKey: ['progression-evaluation', evaluationParams],
    queryFn: async () => {
      const res = await apiClient.get('/registrations/progression/evaluate', {
        params: {
          batch: evaluationParams.batch,
          targetSemester: evaluationParams.targetSemester,
          consideredSemesters: evaluationParams.consideredSemesters.join(','),
          minGpa: evaluationParams.minGpa,
        },
      });
      return res.data?.data;
    },
    enabled: Boolean(evaluationParams.batch && evaluationParams.targetSemester),
  });

  // When data loads, auto-populate decisions based on recommendations
  React.useEffect(() => {
    if (evalResponse?.students) {
      const initialDecisions: Record<
        number,
        'PROMOTE' | 'HOLD_REMEDIATION' | 'HOLD_BATCH_DEMOTION'
      > = {};
      evalResponse.students.forEach((s) => {
        initialDecisions[s.studentId] = s.recommendedAction;
      });
      setDecisions(initialDecisions);
    }
  }, [evalResponse]);

  // Apply changes when user clicks "Evaluate Students"
  const handleRunEvaluation = () => {
    const parsedGpa = parseFloat(minGpaInput) || 2.0;
    setEvaluationParams({
      batch: selectedBatch,
      targetSemester,
      consideredSemesters: selectedSemesters,
      minGpa: parsedGpa,
    });
    toast.info('Re-evaluating student progression eligibility...');
  };

  // Toggle discrete semester
  const toggleSemester = (sem: string) => {
    setSelectedSemesters((prev) =>
      prev.includes(sem) ? prev.filter((s) => s !== sem) : [...prev, sem].sort(),
    );
  };

  // Quick Presets
  const setPresetNoGpa = () => setSelectedSemesters([]);
  const setPresetFirstYear = () => setSelectedSemesters(['1.1', '1.2']);
  const setPresetFirstThreeSems = () => setSelectedSemesters(['1.1', '1.2', '2.1']); // Matches 3.1 promotion
  const setPresetFirstFourSems = () => setSelectedSemesters(['1.1', '1.2', '2.1', '2.2']);

  // Change individual decision
  const handleDecisionChange = (
    studentId: number,
    action: 'PROMOTE' | 'HOLD_REMEDIATION' | 'HOLD_BATCH_DEMOTION',
  ) => {
    setDecisions((prev) => ({
      ...prev,
      [studentId]: action,
    }));
  };

  // Bulk actions
  const bulkSetAction = (
    targetList: EvaluatedStudent[],
    action: 'PROMOTE' | 'HOLD_REMEDIATION' | 'HOLD_BATCH_DEMOTION',
  ) => {
    setDecisions((prev) => {
      const updated = { ...prev };
      targetList.forEach((s) => {
        updated[s.studentId] = action;
      });
      return updated;
    });
    toast.success(`Updated ${targetList.length} students to ${action.replace('_', ' ')}`);
  };

  // Mutation for executing promotion
  const promoteMutation = useMutation({
    mutationFn: async () => {
      if (!evalResponse?.students) return;
      const payloadDecisions = evalResponse.students.map((s) => ({
        studentId: s.studentId,
        action: decisions[s.studentId] || s.recommendedAction,
      }));

      const res = await apiClient.post('/registrations/progression/promote', {
        batch: evaluationParams.batch,
        targetSemester: evaluationParams.targetSemester,
        decisions: payloadDecisions,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(
        `Successfully processed promotion for ${data?.data?.processedCount || 0} students!`,
      );
      queryClient.invalidateQueries({ queryKey: ['progression-evaluation'] });
      queryClient.invalidateQueries({ queryKey: ['registration-monitor'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to execute progression');
    },
  });

  const handleConfirmAndPromote = async () => {
    if (!evalResponse?.students || evalResponse.students.length === 0) return;

    const promoteCount = Object.values(decisions).filter((d) => d === 'PROMOTE').length;
    const remediationCount = Object.values(decisions).filter(
      (d) => d === 'HOLD_REMEDIATION',
    ).length;
    const demotionCount = Object.values(decisions).filter(
      (d) => d === 'HOLD_BATCH_DEMOTION',
    ).length;

    const confirmed = await confirm({
      title: `Confirm Progression to Semester ${evaluationParams.targetSemester}?`,
      message: `You are about to execute progression for Batch ${evaluationParams.batch}:\n• ${promoteCount} Students will be PROMOTED to Semester ${evaluationParams.targetSemester}\n• ${remediationCount} Students will be placed on Option 1 Remediation (Retained in current semester, re-evaluated next term)\n• ${demotionCount} Students will be placed on Option 2 Demotion (Held back to Junior Batch)\n\nDo you want to apply these updates?`,
      confirmText: 'Execute Promotion',
      variant: 'primary',
    });

    if (confirmed) {
      promoteMutation.mutate();
    }
  };

  // Filter students for display
  const students = evalResponse?.students || [];
  const filteredStudents = students.filter((s) => {
    // Tab filter
    if (filterTab === 'ELIGIBLE' && !s.isEligible) return false;
    if (filterTab === 'INELIGIBLE' && s.isEligible) return false;
    if (filterTab === 'RESURFACED' && !s.isResurfacedCandidate) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchReg = s.registrationNumber.toLowerCase().includes(q);
      const matchIndex = s.indexNumber.toLowerCase().includes(q);
      const matchName = (s.fullName || '').toLowerCase().includes(q);
      return matchReg || matchIndex || matchName;
    }
    return true;
  });

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

          <button
            onClick={handleRunEvaluation}
            disabled={isLoading || isFetching}
            className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {isFetching ? 'Evaluating...' : 'Evaluate & Preview Cohort'}
          </button>
        </div>

        {/* Filters and Config Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  onChange={(e) => setSelectedBatch(e.target.value)}
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
                  onChange={(e) => setTargetSemester(e.target.value)}
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
              <div className="text-[11px] text-muted-foreground/90 max-w-[130px] pt-4 leading-tight">
                Standard criteria is <strong>2.00</strong> across evaluated semesters.
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2 bg-secondary/20 p-4 rounded-xl border border-border/60">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" /> Criteria Shortcuts
            </h3>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={setPresetFirstThreeSems}
                className="px-2.5 py-1 bg-background hover:bg-primary/10 hover:text-primary border border-border/80 rounded-lg text-[11px] font-semibold transition cursor-pointer"
              >
                1.1, 1.2 & 2.1 (for 3.1)
              </button>
              <button
                type="button"
                onClick={setPresetFirstYear}
                className="px-2.5 py-1 bg-background hover:bg-primary/10 hover:text-primary border border-border/80 rounded-lg text-[11px] font-semibold transition cursor-pointer"
              >
                First Year (1.1, 1.2)
              </button>
              <button
                type="button"
                onClick={setPresetFirstFourSems}
                className="px-2.5 py-1 bg-background hover:bg-primary/10 hover:text-primary border border-border/80 rounded-lg text-[11px] font-semibold transition cursor-pointer"
              >
                Semesters 1 - 4
              </button>
              <button
                type="button"
                onClick={setPresetNoGpa}
                className="px-2.5 py-1 bg-background hover:bg-amber-500/10 hover:text-amber-500 border border-border/80 rounded-lg text-[11px] font-semibold transition cursor-pointer text-muted-foreground"
              >
                No GPA Consideration
              </button>
            </div>
          </div>
        </div>

        {/* Discrete Semesters Checkbox Chips */}
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
                  onClick={() => toggleSemester(sem)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background hover:bg-secondary border-border/80 text-muted-foreground'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${isSelected ? 'bg-white' : 'bg-muted-foreground/40'}`}
                  />
                  Semester {sem}
                </button>
              );
            })}
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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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

          <div className="bg-card/40 border border-border/80 rounded-2xl p-4 shadow-sm backdrop-blur-md flex flex-col justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-semibold">Execute Promotion</span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Apply semester update and hold rules
              </p>
            </div>
            <button
              onClick={handleConfirmAndPromote}
              disabled={promoteMutation.isPending || evalResponse.totalCount === 0}
              className="mt-2 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {promoteMutation.isPending ? 'Executing...' : 'Confirm & Promote Selected'}
            </button>
          </div>
        </div>
      )}

      {/* 3. Decision & Evaluation Table */}
      <div className="bg-card/30 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md space-y-4 p-5">
        {/* Table Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Sub Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setFilterTab('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                filterTab === 'ALL'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              All Students ({students.length})
            </button>
            <button
              onClick={() => setFilterTab('ELIGIBLE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                filterTab === 'ELIGIBLE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              Eligible ({evalResponse?.eligibleCount || 0})
            </button>
            <button
              onClick={() => setFilterTab('INELIGIBLE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                filterTab === 'INELIGIBLE'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              Ineligible ({evalResponse?.ineligibleCount || 0})
            </button>
            {students.some((s) => s.isResurfacedCandidate) && (
              <button
                onClick={() => setFilterTab('RESURFACED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  filterTab === 'RESURFACED'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                Resurfaced Candidates ({students.filter((s) => s.isResurfacedCandidate).length})
              </button>
            )}
          </div>

          {/* Quick Bulk Dropdown Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                bulkSetAction(
                  students.filter((s) => s.isEligible),
                  'PROMOTE',
                )
              }
              className="px-2.5 py-1.5 bg-secondary/50 hover:bg-secondary text-foreground rounded-lg text-xs font-semibold border border-border/60 transition cursor-pointer"
            >
              Set All Eligible &rarr; Promote
            </button>
            <button
              onClick={() =>
                bulkSetAction(
                  students.filter((s) => !s.isEligible),
                  'HOLD_REMEDIATION',
                )
              }
              className="px-2.5 py-1.5 bg-secondary/50 hover:bg-secondary text-foreground rounded-lg text-xs font-semibold border border-border/60 transition cursor-pointer"
            >
              Set Ineligible &rarr; Option 1 (Remediation)
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search by student registration number, index number, or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-secondary/30 border border-border/70 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border/80 bg-secondary/20 text-muted-foreground font-bold uppercase tracking-wider">
                <th className="px-4 py-3">Student</th>
                <th className="px-3 py-3">Batch / Deg</th>
                <th className="px-3 py-3">Current Sem</th>
                <th className="px-4 py-3">Considered Semesters Breakup</th>
                <th className="px-3 py-3 text-center">Released Cr</th>
                <th className="px-3 py-3 text-right">Evaluated CGPA</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Progression Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-medium">
              {isLoading || isFetching ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Evaluating student academic records...
                    </span>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-muted-foreground">
                    No students found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const currentDecision = decisions[student.studentId] || student.recommendedAction;
                  return (
                    <tr
                      key={student.studentId}
                      className={`hover:bg-secondary/15 transition ${
                        student.isResurfacedCandidate ? 'bg-purple-500/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-foreground">
                          {student.registrationNumber}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {student.fullName || student.indexNumber}
                        </div>
                        {student.isResurfacedCandidate && (
                          <span className="inline-block px-1.5 py-0.5 mt-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded text-[10px] font-bold border border-purple-500/30">
                            Remediation Review Candidate
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="font-semibold text-foreground">{student.batch}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {student.degreeCode}
                        </div>
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-secondary text-foreground text-[11px] font-mono font-bold">
                          {student.currentSemester}
                        </span>
                      </td>

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

                      <td className="px-3 py-3 text-center font-mono text-muted-foreground">
                        {student.totalConsideredCredits}
                      </td>

                      <td className="px-3 py-3 text-right">
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
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            student.isEligible
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {student.isEligible ? 'Eligible' : 'Ineligible'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <select
                          value={currentDecision}
                          onChange={(e) =>
                            handleDecisionChange(student.studentId, e.target.value as any)
                          }
                          className={`px-2.5 py-1 rounded-xl text-xs font-semibold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                            currentDecision === 'PROMOTE'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold'
                              : currentDecision === 'HOLD_REMEDIATION'
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40'
                                : 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/40'
                          }`}
                        >
                          <option value="PROMOTE">
                            Promote to Sem {evaluationParams.targetSemester}
                          </option>
                          <option value="HOLD_REMEDIATION">
                            Option 1: Remediation (Hold & Re-eval next sem)
                          </option>
                          <option value="HOLD_BATCH_DEMOTION">
                            Option 2: Demotion (Hold to Junior Batch)
                          </option>
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Legend / Info Footnote */}
        <div className="pt-2 text-[11px] text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-border/50">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <strong>Promote:</strong> Advances student to target semester & allows module
              registration.
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <strong>Option 1 (Remediation):</strong> Retained in current semester, re-evaluated
              when batch reaches next term.
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <strong>Option 2 (Demotion):</strong> Retained for a full cycle, re-evaluated with
              junior batch.
            </span>
          </div>
          <div>
            Showing {filteredStudents.length} of {students.length} students
          </div>
        </div>
      </div>
    </div>
  );
}
