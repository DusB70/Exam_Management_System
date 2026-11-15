'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/api-client';
import { useToast } from '../../../hooks/use-toast';
import { useConfirm } from '../../../hooks/use-confirm';
import { useProgressiveList } from '../../../hooks/use-progressive-load';
import { ProgressiveLoadFooter } from '../../../components/ui/progressive-load-footer';
import { BookOpen, CheckCircle, Clock, ShieldAlert, AlertCircle } from 'lucide-react';

interface EligibleRepeatCourse {
  course_id: number;
  course_code: string;
  course_name: string;
  credit_value: number;
  semester: string;
  previous_grade: string;
  previous_grade_point: number;
  attempt_count: number;
  next_attempt_number: number;
  max_allowed_grade: string;
  attempt_label: string;
}

export default function ExamRegistrationPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [registeringId, setRegisteringId] = useState<number | null>(null);
  const [activePeriod, setActivePeriod] = useState<any>(null);
  const [eligibleCourses, setEligibleCourses] = useState<EligibleRepeatCourse[]>([]);

  const {
    visibleItems: visibleEligibleCourses,
    visibleCount: visibleEligibleCount,
    totalCount: totalEligibleCount,
    hasMore: hasMoreEligible,
  } = useProgressiveList<EligibleRepeatCourse>(eligibleCourses);
  const setError = (msg: string | null) => {
    if (msg) toast.error(msg);
  };

  const fetchRepeatEligible = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/registrations/repeat-eligible');
      if (res.data?.success) {
        setActivePeriod(res.data.data.activePeriod);
        setEligibleCourses(res.data.data.eligibleCourses || []);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to load repeat registration details.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepeatEligible();
  }, []);

  const handleRegister = async (courseId: number, courseCode: string) => {
    const confirmed = await confirm({
      title: 'Register for Repeat Examination?',
      message: `Are you sure you want to register for repeat examination in ${courseCode}? Your repeat attempt will be officially recorded.`,
      confirmText: 'Register Repeat',
      variant: 'primary',
    });
    if (!confirmed) return;

    setRegisteringId(courseId);

    try {
      const res = await apiClient.post('/registrations/repeat-register', { courseId });
      if (res.data?.success) {
        toast.success(`Successfully registered for repeat examination in ${courseCode}!`);
        fetchRepeatEligible();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to register for repeat examination.');
    } finally {
      setRegisteringId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Repeat Exam Registration</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Register for repeat examinations for eligible subjects (grades below C, up to 3 total
            attempts).
          </p>
        </div>

        <div>
          {activePeriod ? (
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-2xl">
              <Clock className="w-5 h-5 text-emerald-500 animate-pulse" />
              <div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                  Registration Window Open
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(activePeriod.start_date).toLocaleDateString()} -{' '}
                  {new Date(activePeriod.end_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/20 px-4 py-2.5 rounded-2xl">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-xs text-destructive font-bold">Registration Closed</p>
                <p className="text-[11px] text-muted-foreground">
                  No active registration window available
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Repeat Regulations Card */}
      <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-3">
          <ShieldAlert className="w-4 h-4" />
          <span>Repeat Examination Regulations</span>
        </div>
        <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-5">
          <li>
            Students with results below <strong className="text-foreground">C</strong> (GP &lt; 2.0)
            are eligible for repeat examination up to{' '}
            <strong className="text-foreground">
              2 repeat attempts (maximum 3 total attempts)
            </strong>
            .
          </li>
          <li>
            First attempt is the Proper attempt. Second attempt is{' '}
            <strong className="text-foreground">Repeat 1</strong>, and third attempt is{' '}
            <strong className="text-foreground">Repeat 2</strong>.
          </li>
          <li>
            For all repeat attempts, the maximum achievable result is capped at{' '}
            <strong className="text-foreground">C (Grade Point 2.0)</strong> regardless of the
            actual raw score.
          </li>
        </ul>
      </div>

      {/* Course List Section */}
      <div className="bg-card border border-border/80 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/80 flex justify-between items-center bg-secondary/10">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Eligible Repeat Subjects
          </h2>
          <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-bold">
            {eligibleCourses.length} Course{eligibleCourses.length !== 1 ? 's' : ''} Found
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
            Loading eligible repeat courses...
          </div>
        ) : eligibleCourses.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <CheckCircle className="w-12 h-12 text-emerald-500/60 mx-auto mb-3" />
            <p className="text-base font-semibold text-foreground">No Eligible Repeat Subjects</p>
            <p className="text-xs text-muted-foreground mt-1">
              You do not have any subjects with grades below C eligible for repeat registration at
              this time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-secondary/20 text-muted-foreground font-bold uppercase text-[11px] tracking-wider border-b border-border/80">
                <tr>
                  <th className="px-4 py-4 w-12 text-center">#</th>
                  <th className="px-6 py-4">Course Code</th>
                  <th className="px-6 py-4">Course Title</th>
                  <th className="px-6 py-4">Credits</th>
                  <th className="px-6 py-4">Semester</th>
                  <th className="px-6 py-4">Previous Grade</th>
                  <th className="px-6 py-4">Target Attempt</th>
                  <th className="px-6 py-4">Max Grade</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-medium">
                {visibleEligibleCourses.map((c, idx) => (
                  <tr key={c.course_id} className="hover:bg-secondary/15 transition-colors">
                    <td className="px-4 py-4 text-center font-mono text-muted-foreground font-bold">
                      {idx + 1}
                    </td>
                    <td className="px-6 py-4 font-bold font-mono text-primary">{c.course_code}</td>
                    <td className="px-6 py-4 font-semibold text-foreground">{c.course_name}</td>
                    <td className="px-6 py-4 font-mono text-muted-foreground">{c.credit_value}</td>
                    <td className="px-6 py-4 text-muted-foreground">Sem {c.semester}</td>
                    <td className="px-6 py-4">
                      <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2.5 py-1 rounded-lg text-xs font-bold font-mono">
                        {c.previous_grade} ({c.previous_grade_point.toFixed(2)})
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg text-xs font-semibold">
                        {c.attempt_label} (Attempt {c.next_attempt_number}/3)
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-muted-foreground text-xs font-semibold">
                        Max {c.max_allowed_grade}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRegister(c.course_id, c.course_code)}
                        disabled={registeringId === c.course_id || !activePeriod}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-semibold transition-all shadow-md shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {registeringId === c.course_id ? 'Registering...' : 'Register Repeat'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ProgressiveLoadFooter
              loadedCount={visibleEligibleCount}
              totalCount={totalEligibleCount}
              isLoadingMore={hasMoreEligible}
              hasMore={hasMoreEligible}
              entityLabel="repeat courses"
            />
          </div>
        )}
      </div>
    </div>
  );
}
