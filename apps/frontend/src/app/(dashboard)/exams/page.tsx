'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';
import {
  Calendar,
  Building2,
  Plus,
  Trash2,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  ClipboardList,
} from 'lucide-react';

export default function ExamsSchedulingPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'schedules' | 'exams' | 'halls'>('schedules');

  // Messages states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [showExamModal, setShowExamModal] = useState(false);
  const [showHallModal, setShowHallModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Exam Form
  const [examCourseId, setExamCourseId] = useState('');
  const [examType, setExamType] = useState('CA');
  const [examTitle, setExamTitle] = useState('');
  const [examTotalMarks, setExamTotalMarks] = useState('30');
  const [examDate, setExamDate] = useState('');
  const [examStartTime, setExamStartTime] = useState('09:00:00');
  const [examEndTime, setExamEndTime] = useState('11:00:00');

  // Hall Form
  const [hallName, setHallName] = useState('');
  const [hallCapacity, setHallCapacity] = useState('40');

  // Schedule Form
  const [schedExamId, setSchedExamId] = useState('');
  const [schedHallId, setSchedHallId] = useState('');

  // ==========================================
  // DATA QUERIES
  // ==========================================

  // Fetch Exams
  const { data: exams = [], isLoading: isExamsLoading } = useQuery({
    queryKey: ['exams-list'],
    queryFn: async () => {
      const res = await apiClient.get('/exams');
      return res.data?.data || [];
    },
  });

  // Fetch Halls
  const { data: halls = [], isLoading: isHallsLoading } = useQuery({
    queryKey: ['halls-list'],
    queryFn: async () => {
      const res = await apiClient.get('/exams/halls');
      return res.data?.data || [];
    },
  });

  // Fetch Schedules
  const { data: schedules = [], isLoading: isSchedsLoading } = useQuery({
    queryKey: ['schedules-list'],
    queryFn: async () => {
      const res = await apiClient.get('/exams/schedules');
      return res.data?.data || [];
    },
  });

  // Fetch Courses (for Exam dropdown)
  const { data: courses = [] } = useQuery({
    queryKey: ['courses-lookup'],
    queryFn: async () => {
      const res = await apiClient.get('/reports/courses');
      return res.data?.data || [];
    },
  });

  // ==========================================
  // MUTATIONS
  // ==========================================

  // Create Exam
  const createExamMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/exams', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setSuccessMsg(data.message || 'Exam created successfully.');
      setErrorMsg(null);
      setShowExamModal(false);
      // Reset form
      setExamCourseId('');
      setExamTitle('');
      setExamDate('');
      queryClient.invalidateQueries({ queryKey: ['exams-list'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to create exam.');
      setSuccessMsg(null);
    },
  });

  // Delete Exam
  const deleteExamMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/exams/${id}`);
      return res.data;
    },
    onSuccess: () => {
      setSuccessMsg('Exam deleted successfully.');
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['exams-list'] });
      queryClient.invalidateQueries({ queryKey: ['schedules-list'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to delete exam.');
      setSuccessMsg(null);
    },
  });

  // Create Hall
  const createHallMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/exams/halls', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setSuccessMsg(data.message || 'Exam Hall created successfully.');
      setErrorMsg(null);
      setShowHallModal(false);
      setHallName('');
      queryClient.invalidateQueries({ queryKey: ['halls-list'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to create exam hall.');
      setSuccessMsg(null);
    },
  });

  // Delete Hall
  const deleteHallMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/exams/halls/${id}`);
      return res.data;
    },
    onSuccess: () => {
      setSuccessMsg('Exam Hall deleted successfully.');
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['halls-list'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to delete exam hall.');
      setSuccessMsg(null);
    },
  });

  // Create Schedule
  const createScheduleMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/exams/schedules', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setSuccessMsg(data.message || 'Exam scheduled successfully.');
      setErrorMsg(null);
      setShowScheduleModal(false);
      setSchedExamId('');
      setSchedHallId('');
      queryClient.invalidateQueries({ queryKey: ['schedules-list'] });
      queryClient.invalidateQueries({ queryKey: ['exams-list'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to schedule exam.');
      setSuccessMsg(null);
    },
  });

  // Delete Schedule
  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/exams/schedules/${id}`);
      return res.data;
    },
    onSuccess: () => {
      setSuccessMsg('Exam schedule deleted successfully.');
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['schedules-list'] });
      queryClient.invalidateQueries({ queryKey: ['exams-list'] });
    },
    onError: (err: AxiosError<ApiResponse>) => {
      setErrorMsg(err.response?.data?.message || 'Failed to delete schedule.');
      setSuccessMsg(null);
    },
  });

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleCreateExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !examCourseId ||
      !examType ||
      !examTitle ||
      !examTotalMarks ||
      !examDate ||
      !examStartTime ||
      !examEndTime
    )
      return;
    createExamMutation.mutate({
      courseId: parseInt(examCourseId, 10),
      examType,
      examTitle,
      totalMarks: parseInt(examTotalMarks, 10),
      examDate,
      startTime: examStartTime,
      endTime: examEndTime,
    });
  };

  const handleCreateHall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hallName || !hallCapacity) return;
    createHallMutation.mutate({
      hallName,
      capacity: parseInt(hallCapacity, 10),
    });
  };

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedExamId || !schedHallId) return;
    createScheduleMutation.mutate({
      examId: parseInt(schedExamId, 10),
      hallId: parseInt(schedHallId, 10),
    });
  };

  // Helper formatting
  const formatTime = (isoTime: string) => {
    const d = new Date(isoTime);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Exam Scheduling & Hall Allocations
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure halls, manage assessment periods, and link exams to halls with capacity
            checks.
          </p>
        </div>

        {/* Buttons based on active tab */}
        {activeTab === 'schedules' && (
          <button
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center gap-2 px-5 py-3 font-bold text-sm bg-primary text-primary-foreground rounded-xl shadow-lg hover:bg-primary/90 transition"
          >
            <Plus className="h-4 w-4" />
            Schedule Exam
          </button>
        )}
        {activeTab === 'exams' && (
          <button
            onClick={() => setShowExamModal(true)}
            className="flex items-center gap-2 px-5 py-3 font-bold text-sm bg-primary text-primary-foreground rounded-xl shadow-lg hover:bg-primary/90 transition"
          >
            <Plus className="h-4 w-4" />
            Create Exam
          </button>
        )}
        {activeTab === 'halls' && (
          <button
            onClick={() => setShowHallModal(true)}
            className="flex items-center gap-2 px-5 py-3 font-bold text-sm bg-primary text-primary-foreground rounded-xl shadow-lg hover:bg-primary/90 transition"
          >
            <Plus className="h-4 w-4" />
            Add Exam Hall
          </button>
        )}
      </div>
      {/* Alert Notifications */}
      {errorMsg && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-2xl font-medium flex gap-2 items-center">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-2xl font-medium flex gap-2 items-center">
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {/* Tabs Menu */}
      <div className="flex border-b border-border/60">
        <button
          onClick={() => {
            setActiveTab('schedules');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`flex items-center gap-2 px-6 py-4.5 text-sm font-bold border-b-2 transition ${
            activeTab === 'schedules'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Allocated Schedules ({schedules.length})
        </button>

        <button
          onClick={() => {
            setActiveTab('exams');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`flex items-center gap-2 px-6 py-4.5 text-sm font-bold border-b-2 transition ${
            activeTab === 'exams'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Exams List ({exams.length})
        </button>

        <button
          onClick={() => {
            setActiveTab('halls');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`flex items-center gap-2 px-6 py-4.5 text-sm font-bold border-b-2 transition ${
            activeTab === 'halls'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Exam Halls ({halls.length})
        </button>
      </div>
      {/* Tab Panels */}
      <div>
        {/* TAB 1: SCHEDULES */}
        {activeTab === 'schedules' && (
          <div className="bg-card/30 border border-border/80 rounded-3xl shadow-xl overflow-hidden backdrop-blur-md">
            {isSchedsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Calendar className="h-12 w-12 text-muted-foreground/35 mx-auto mb-3" />
                <p className="font-semibold text-sm">No Exams Scheduled Yet</p>
                <p className="text-xs mt-1 text-muted-foreground/75">
                  Click "Schedule Exam" to allocate an exam to a hall.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                      <th className="p-4 pl-6">Exam Info</th>
                      <th className="p-4">Hall</th>
                      <th className="p-4">Date</th>
                      <th className="p-4">Time</th>
                      <th className="p-4 text-center">Hall Capacity</th>
                      <th className="p-4 text-right pr-6">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-sm font-medium text-foreground">
                    {schedules.map((s: any) => (
                      <tr key={s.schedule_id} className="hover:bg-secondary/10 transition-colors">
                        <td className="p-4 pl-6">
                          <div>
                            <span className="text-xs text-primary font-bold font-mono mr-2 bg-primary/10 px-2 py-0.5 rounded">
                              {s.exam?.course?.course_code}
                            </span>
                            <span className="font-bold">{s.exam?.exam_title}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            {s.hall?.hall_name}
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {new Date(s.exam?.exam_date).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime(s.exam?.start_time)} - {formatTime(s.exam?.end_time)}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            {s.hall?.capacity} seats
                          </div>
                        </td>
                        <td className="p-4 text-right pr-6">
                          <button
                            onClick={() => {
                              if (confirm('Cancel this exam schedule?')) {
                                deleteScheduleMutation.mutate(s.schedule_id);
                              }
                            }}
                            className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: EXAMS */}
        {activeTab === 'exams' && (
          <div className="bg-card/30 border border-border/80 rounded-3xl shadow-xl overflow-hidden backdrop-blur-md">
            {isExamsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : exams.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <ClipboardList className="h-12 w-12 text-muted-foreground/35 mx-auto mb-3" />
                <p className="font-semibold text-sm">No Exams Created Yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                      <th className="p-4 pl-6">Course</th>
                      <th className="p-4">Title</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Date</th>
                      <th className="p-4">Time</th>
                      <th className="p-4 text-center">Total Marks</th>
                      <th className="p-4 text-right pr-6">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-sm font-medium text-foreground">
                    {exams.map((e: any) => (
                      <tr key={e.exam_id} className="hover:bg-secondary/10 transition-colors">
                        <td className="p-4 pl-6">
                          <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-xs">
                            {e.course?.course_code}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-foreground">{e.exam_title}</td>
                        <td className="p-4 text-muted-foreground uppercase">{e.exam_type}</td>
                        <td className="p-4 text-muted-foreground">
                          {new Date(e.exam_date).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {formatTime(e.start_time)} - {formatTime(e.end_time)}
                        </td>
                        <td className="p-4 text-center font-bold">{e.total_marks}</td>
                        <td className="p-4 text-right pr-6">
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  'Delete this exam? This will remove all marks sheets and schedule entries.',
                                )
                              ) {
                                deleteExamMutation.mutate(e.exam_id);
                              }
                            }}
                            className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: HALLS */}
        {activeTab === 'halls' && (
          <div className="bg-card/30 border border-border/80 rounded-3xl shadow-xl overflow-hidden backdrop-blur-md">
            {isHallsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : halls.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Building2 className="h-12 w-12 text-muted-foreground/35 mx-auto mb-3" />
                <p className="font-semibold text-sm">No Exam Halls Configured Yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                      <th className="p-4 pl-6">Hall Location / Name</th>
                      <th className="p-4 text-center">Seating Capacity</th>
                      <th className="p-4 text-right pr-6">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-sm font-medium text-foreground">
                    {halls.map((h: any) => (
                      <tr key={h.hall_id} className="hover:bg-secondary/10 transition-colors">
                        <td className="p-4 pl-6 font-bold">{h.hall_name}</td>
                        <td className="p-4 text-center font-bold font-mono text-emerald-500">
                          {h.capacity} seats
                        </td>
                        <td className="p-4 text-right pr-6">
                          <button
                            onClick={() => {
                              if (confirm('Delete this exam hall?')) {
                                deleteHallMutation.mutate(h.hall_id);
                              }
                            }}
                            className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      {/* ========================================================================= */}
      // MODAL FOR CREATING EXAM
      {/* ========================================================================= */}
      {showExamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-lg p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border/60 pb-3">
              <h3 className="text-lg font-bold">Create Course Assessment Exam</h3>
              <button
                onClick={() => setShowExamModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Select Course Unit
                </label>
                <select
                  value={examCourseId}
                  onChange={(e) => setExamCourseId(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/20 border border-border rounded-xl text-sm"
                >
                  <option value="">Choose course...</option>
                  {courses.map((c: any) => (
                    <option key={c.course_id} value={c.course_id}>
                      {c.course_code} - {c.course_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Exam Type
                  </label>
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/20 border border-border rounded-xl text-sm text-foreground"
                  >
                    <option value="CA">Continuous Assessment (CA)</option>
                    <option value="FINAL">Final Exam (FINAL)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Total Marks
                  </label>
                  <input
                    type="number"
                    value={examTotalMarks}
                    onChange={(e) => setExamTotalMarks(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/20 border border-border rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Assessment Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mid Semester Test, End Semester Theory"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/20 border border-border rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Date of Exam
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/20 border border-border rounded-xl text-sm text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Start Time (HH:MM:SS)
                  </label>
                  <input
                    type="text"
                    placeholder="09:00:00"
                    value={examStartTime}
                    onChange={(e) => setExamStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/20 border border-border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    End Time (HH:MM:SS)
                  </label>
                  <input
                    type="text"
                    placeholder="12:00:00"
                    value={examEndTime}
                    onChange={(e) => setExamEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/20 border border-border rounded-xl text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={createExamMutation.isPending}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:bg-primary/95 transition text-sm flex justify-center gap-1.5 disabled:opacity-50"
              >
                {createExamMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Create
              </button>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      // MODAL FOR CREATING HALL
      {/* ========================================================================= */}
      {showHallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-sm p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border/60 pb-3">
              <h3 className="text-lg font-bold">Configure New Exam Hall</h3>
              <button
                onClick={() => setShowHallModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateHall} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Hall Location / Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Block C Hall 3, Main Auditorium"
                  value={hallName}
                  onChange={(e) => setHallName(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/20 border border-border rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Seating Capacity (Students count)
                </label>
                <input
                  type="number"
                  value={hallCapacity}
                  onChange={(e) => setHallCapacity(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/20 border border-border rounded-xl text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={createHallMutation.isPending}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:bg-primary/95 transition text-sm flex justify-center gap-1.5 disabled:opacity-50"
              >
                {createHallMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Add Hall
              </button>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      // MODAL FOR CREATING SCHEDULE
      {/* ========================================================================= */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-sm p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border/60 pb-3">
              <h3 className="text-lg font-bold">Schedule Exam Location</h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Select Exam Assessment
                </label>
                <select
                  value={schedExamId}
                  onChange={(e) => setSchedExamId(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/20 border border-border rounded-xl text-sm"
                >
                  <option value="">Choose exam...</option>
                  {exams
                    .filter((e: any) => !schedules.some((s: any) => s.exam_id === e.exam_id))
                    .map((e: any) => (
                      <option key={e.exam_id} value={e.exam_id}>
                        {e.course?.course_code} - {e.exam_title}
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Only lists exams that have not been scheduled yet.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Select Hall Assignment
                </label>
                <select
                  value={schedHallId}
                  onChange={(e) => setSchedHallId(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/20 border border-border rounded-xl text-sm text-foreground"
                >
                  <option value="">Choose hall...</option>
                  {halls.map((h: any) => (
                    <option key={h.hall_id} value={h.hall_id}>
                      {h.hall_name} (Capacity: {h.capacity})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={createScheduleMutation.isPending}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:bg-primary/95 transition text-sm flex justify-center gap-1.5 disabled:opacity-50"
              >
                {createScheduleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Schedule
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
