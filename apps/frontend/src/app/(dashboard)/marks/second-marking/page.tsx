'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '../../../../lib/api-client';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
  Upload,
  Send,
} from 'lucide-react';
import * as XLSX from 'xlsx';

function SecondMarkingContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [courseData, setCourseData] = useState<any | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [gridData, setGridData] = useState<any | null>(null);

  // 2nd Marking Draft: { [studentId]: { [examId]: scoreString } }
  const [secondMarksDraft, setSecondMarksDraft] = useState<{
    [studentId: number]: { [examId: number]: string };
  }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMsg('No access token provided in the link. Please check your email magic link.');
      setIsLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        setIsLoading(true);
        const res = await apiClient.post('/marks/second-marking/verify', { token });
        const data = res.data?.data;
        if (data) {
          setCourseData(data.course);
          setStudents(data.students || []);
          setGridData(data.grid || null);

          // Populate initial 2nd marks draft from existing grid
          const draft: { [studentId: number]: { [examId: number]: string } } = {};
          if (data.grid?.marks && Array.isArray(data.grid.marks)) {
            data.grid.marks.forEach((m: any) => {
              if (!draft[m.student_id]) draft[m.student_id] = {};
              draft[m.student_id][m.exam_id] = m.marks_obtained.toString();
            });
          }
          setSecondMarksDraft(draft);
        }
      } catch (err: any) {
        setErrorMsg(
          err.response?.data?.message ||
            'Invalid or expired magic token. Please request a new access link.',
        );
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleDownloadNominalList = () => {
    if (!courseData || !students.length) return;

    const rows: any[][] = [
      ['2nd Marking Nominal Student List'],
      ['Course Code:', courseData.course_code],
      ['Course Name:', courseData.course_name],
      ['Department:', courseData.department?.department_name || ''],
      [],
      [
        'Registration Number',
        'Index Number',
        'Student Name',
        '1st Marking Score',
        '2nd Marking Score',
      ],
    ];

    const exams = gridData?.exams || [];
    const finalExam = exams.find((e: any) => e.exam_type.toUpperCase() === 'FINAL') || exams[0];

    students.forEach((s: any) => {
      const firstMarkObj = gridData?.marks?.find(
        (m: any) => m.student_id === s.student_id && m.exam_id === finalExam?.exam_id,
      );
      const firstScore = firstMarkObj ? firstMarkObj.marks_obtained : '';
      const existingSecond =
        secondMarksDraft[s.student_id]?.[finalExam?.exam_id] || firstScore || '';

      rows.push([
        s.registration_number,
        s.index_number,
        s.user?.full_name || '',
        firstScore,
        existingSecond,
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 35 }, { wch: 20 }, { wch: 20 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '2nd Marking');

    XLSX.writeFile(workbook, `2nd_Marking_${courseData.course_code}_Nominal_List.xlsx`);
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        const exams = gridData?.exams || [];
        const finalExam = exams.find((e: any) => e.exam_type.toUpperCase() === 'FINAL') || exams[0];
        if (!finalExam) return;

        const updatedDraft = { ...secondMarksDraft };

        data.forEach((row: any) => {
          const indexNo = String(row['Index Number'] || row['index_number'] || '').trim();
          const regNo = String(
            row['Registration Number'] || row['registration_number'] || '',
          ).trim();
          const secondMarkVal =
            row['2nd Marking Score'] || row['second_marking_score'] || row['Score'] || row['Marks'];

          const student = students.find(
            (s: any) =>
              (indexNo && s.index_number.trim() === indexNo) ||
              (regNo && s.registration_number.trim() === regNo),
          );

          if (student && secondMarkVal !== undefined && secondMarkVal !== null) {
            if (!updatedDraft[student.student_id]) updatedDraft[student.student_id] = {};
            updatedDraft[student.student_id][finalExam.exam_id] = String(secondMarkVal);
          }
        });

        setSecondMarksDraft(updatedDraft);
        setSuccessMsg('Imported 2nd marking scores from spreadsheet successfully!');
        setErrorMsg(null);
      } catch {
        setErrorMsg('Failed to parse uploaded Excel file. Ensure valid headers are present.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSubmitSecondMarking = async () => {
    if (!courseData) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payloadMarks: { studentId: number; examMarks: { [examId: string]: number } }[] = [];

      Object.entries(secondMarksDraft).forEach(([studentIdStr, examMap]) => {
        const studentId = parseInt(studentIdStr);
        const parsedExams: { [examId: string]: number } = {};

        Object.entries(examMap).forEach(([examIdStr, val]) => {
          const score = parseFloat(val);
          if (!isNaN(score)) {
            parsedExams[examIdStr] = score;
          }
        });

        if (Object.keys(parsedExams).length > 0) {
          payloadMarks.push({ studentId, examMarks: parsedExams });
        }
      });

      const res = await apiClient.post(`/marks/second-marking/submit/${courseData.course_id}`, {
        marks: payloadMarks,
      });

      setSuccessMsg(
        res.data?.message ||
          'Second marking evaluation submitted successfully! Notification sent to 1st Marker for final review.',
      );
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit second marking evaluation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">
          Verifying magic token & loading course evaluation data...
        </p>
      </div>
    );
  }

  if (errorMsg && !courseData) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-card border border-destructive/30 rounded-3xl shadow-xl text-center space-y-4">
        <div className="p-4 bg-destructive/10 text-destructive rounded-full w-16 h-16 mx-auto flex items-center justify-center">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Authentication Error</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{errorMsg}</p>
        <p className="text-xs text-muted-foreground/80">
          Please check your email for the correct Magic Link or contact the Examinations Division.
        </p>
      </div>
    );
  }

  const exams = gridData?.exams || [];
  const mainExam = exams.find((e: any) => e.exam_type.toUpperCase() === 'FINAL') || exams[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 pt-4 px-4">
      {/* Top Banner */}
      <div className="bg-card border border-border/80 p-6 md:p-8 rounded-3xl shadow-sm space-y-4 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary font-extrabold text-xs tracking-wider uppercase mb-1">
              <ShieldCheck className="h-4 w-4" />
              Secure 2nd Marker Portal
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">
              {courseData?.course_code} — {courseData?.course_name}
            </h1>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              <span>Department: {courseData?.department?.department_name}</span>
              <span>•</span>
              <span>Semester {courseData?.semester}</span>
              <span>•</span>
              <span>1st Marker: {courseData?.first_marker_name || 'Assigned Lecturer'}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadNominalList}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-secondary text-secondary-foreground rounded-xl border border-border/60 hover:bg-secondary/80 transition cursor-pointer"
            >
              <Download className="h-4 w-4 text-primary" />
              Download Nominal Excel
            </button>

            <label className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-emerald-600 text-white rounded-xl shadow-md hover:bg-emerald-500 transition cursor-pointer">
              <Upload className="h-4 w-4" />
              Import 2nd Marks Excel
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelImport}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-2xl font-medium flex gap-2 items-center">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-2xl font-medium flex gap-2 items-center">
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Evaluation Grid Table */}
      <div className="bg-card border border-border/80 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60 bg-secondary/10 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-foreground">Second Marking Evaluation Sheet</h3>
            <p className="text-xs text-muted-foreground">
              Review 1st Marker evaluated scores and enter your 2nd Marking evaluation below.
            </p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {students.length} Enrolled Students
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-secondary/30 text-xs font-bold uppercase text-muted-foreground tracking-wider">
                <th className="py-3.5 px-4 border-r border-border/40">#</th>
                <th className="py-3.5 px-4 border-r border-border/40">Registration No</th>
                <th className="py-3.5 px-4 border-r border-border/40">Index Number</th>
                <th className="py-3.5 px-4 border-r border-border/40">Student Name</th>
                <th className="py-3.5 px-4 border-r border-border/40 text-center">
                  1st Marking Score
                </th>
                <th className="py-3.5 px-4 text-center">2nd Marking Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-xs font-medium">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    No registered students found for this course.
                  </td>
                </tr>
              ) : (
                students.map((student: any, idx: number) => {
                  const firstMarkObj = gridData?.marks?.find(
                    (m: any) =>
                      m.student_id === student.student_id && m.exam_id === mainExam?.exam_id,
                  );
                  const firstScore = firstMarkObj ? firstMarkObj.marks_obtained : 'N/A';
                  const currentSecondScore =
                    secondMarksDraft[student.student_id]?.[mainExam?.exam_id] ?? '';

                  return (
                    <tr key={student.student_id} className="hover:bg-secondary/10 transition">
                      <td className="py-3 px-4 border-r border-border/40 text-muted-foreground font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 border-r border-border/40 font-mono font-bold text-foreground">
                        {student.registration_number}
                      </td>
                      <td className="py-3 px-4 border-r border-border/40 font-mono text-primary font-bold">
                        {student.index_number}
                      </td>
                      <td className="py-3 px-4 border-r border-border/40 font-semibold text-foreground">
                        {student.user?.full_name || 'N/A'}
                      </td>

                      {/* 1st Marking Score Reference */}
                      <td className="py-3 px-4 border-r border-border/40 text-center font-mono font-bold text-muted-foreground">
                        <span className="px-3 py-1 bg-secondary border border-border/60 rounded-xl text-xs">
                          {firstScore}
                        </span>
                      </td>

                      {/* 2nd Marking Input */}
                      <td className="py-3 px-4 text-center">
                        {mainExam ? (
                          <input
                            type="number"
                            min="0"
                            max={mainExam.total_marks || 100}
                            placeholder="0 - 100"
                            value={currentSecondScore}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSecondMarksDraft((prev) => ({
                                ...prev,
                                [student.student_id]: {
                                  ...prev[student.student_id],
                                  [mainExam.exam_id]: val,
                                },
                              }));
                            }}
                            className="w-28 px-3 py-1.5 bg-secondary/40 border border-border/80 rounded-xl text-center font-mono font-extrabold text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
                          />
                        ) : (
                          <span className="text-muted-foreground italic">No Exam Configured</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-border/60 bg-secondary/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Submitting 2nd marking will notify the 1st Marker to review side-by-side marks and
            finalize evaluation for HOD.
          </p>

          <button
            onClick={handleSubmitSecondMarking}
            disabled={isSubmitting || students.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-xs font-extrabold rounded-xl shadow-lg hover:bg-primary/90 transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit 2nd Marking Evaluation
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SecondMarkingPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <SecondMarkingContent />
    </Suspense>
  );
}
