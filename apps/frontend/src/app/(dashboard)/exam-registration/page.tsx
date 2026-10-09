'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/api-client';
import { BookOpen, AlertCircle, CheckCircle, Clock, ShieldAlert, Award } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [registeringId, setRegisteringId] = useState<number | null>(null);
  const [activePeriod, setActivePeriod] = useState<any>(null);
  const [eligibleCourses, setEligibleCourses] = useState<EligibleRepeatCourse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
      setError(err.response?.data?.message || 'Failed to load repeat registration details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepeatEligible();
  }, []);

  const handleRegister = async (courseId: number) => {
    setRegisteringId(courseId);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await apiClient.post('/registrations/repeat-register', { courseId });
      if (res.data?.success) {
        setSuccessMsg('Successfully registered for repeat examination!');
        fetchRepeatEligible();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to register for repeat examination.');
    } finally {
      setRegisteringId(null);
    }
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900/50 p-6 rounded-2xl border border-indigo-500/20 backdrop-blur-md shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600/20 rounded-xl border border-indigo-500/30 text-indigo-400">
                <Award className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-wide">
                  Repeat Exam Registration
                </h1>
                <p className="text-sm text-indigo-200/80 mt-1">
                  Register for repeat examinations for eligible subjects (grades below C, up to 3
                  total attempts).
                </p>
              </div>
            </div>
          </div>
          {activePeriod ? (
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 rounded-xl">
              <Clock className="w-5 h-5 text-emerald-400 animate-pulse" />
              <div>
                <p className="text-xs text-emerald-300 font-medium">Registration Window Open</p>
                <p className="text-xs text-emerald-200/70">
                  {new Date(activePeriod.start_date).toLocaleDateString()} -{' '}
                  {new Date(activePeriod.end_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 rounded-xl">
              <Clock className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-xs text-amber-300 font-medium">Window Info</p>
                <p className="text-xs text-amber-200/70">
                  Check period dates for active registrations
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl flex items-center gap-3 text-rose-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex items-center gap-3 text-emerald-300">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{successMsg}</p>
        </div>
      )}

      {/* Repeat Regulations Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm mb-3">
          <ShieldAlert className="w-4 h-4" />
          <span>Repeat Examination Regulations</span>
        </div>
        <ul className="text-xs text-slate-300 space-y-2 list-disc pl-5">
          <li>
            Students with results below <strong>C</strong> (GP &lt; 2.0) are eligible for repeat
            examination up to <strong>2 repeat attempts (maximum 3 total attempts)</strong>.
          </li>
          <li>
            First attempt is the Proper attempt. Second attempt is <strong>Repeat 1</strong>, and
            third attempt is <strong>Repeat 2</strong>.
          </li>
          <li>
            For all repeat attempts, the maximum achievable result is capped at{' '}
            <strong>C (Grade Point 2.0)</strong> regardless of the actual raw score.
          </li>
        </ul>
      </div>

      {/* Course List Section */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            Eligible Repeat Subjects
          </h2>
          <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full">
            {eligibleCourses.length} Course{eligibleCourses.length !== 1 ? 's' : ''} Found
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            Loading eligible repeat courses...
          </div>
        ) : eligibleCourses.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CheckCircle className="w-12 h-12 text-emerald-500/50 mx-auto mb-3" />
            <p className="text-base font-medium text-slate-200">No Eligible Repeat Subjects</p>
            <p className="text-xs text-slate-400 mt-1">
              You do not have any subjects with grades below C eligible for repeat registration at
              this time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs tracking-wider">
                <tr>
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
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {eligibleCourses.map((c) => (
                  <tr key={c.course_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-semibold text-indigo-300">{c.course_code}</td>
                    <td className="px-6 py-4 font-medium text-white">{c.course_name}</td>
                    <td className="px-6 py-4">{c.credit_value}</td>
                    <td className="px-6 py-4">{c.semester}</td>
                    <td className="px-6 py-4">
                      <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">
                        {c.previous_grade} ({c.previous_grade_point.toFixed(2)})
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-md text-xs font-medium">
                        {c.attempt_label} (Attempt {c.next_attempt_number}/3)
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-400 text-xs font-semibold">
                        Max {c.max_allowed_grade}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRegister(c.course_id)}
                        disabled={registeringId === c.course_id}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-all shadow-md disabled:opacity-50"
                      >
                        {registeringId === c.course_id ? 'Registering...' : 'Register Repeat'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
