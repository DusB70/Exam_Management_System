'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '../../lib/api-client';
import { Loader2, CheckCircle, AlertTriangle, Upload, Download, Search, Check } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function SecondMarkingPortalPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [courseData, setCourseData] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [tokenEmail, setTokenEmail] = useState<string>('');

  const [questions, setQuestions] = useState<any[]>([]);
  const [secondMarks, setSecondMarks] = useState<{
    [studentId: number]: { [qKey: string]: number };
  }>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No magic token provided in the URL.');
      setIsLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        setIsLoading(true);
        const res = await apiClient.post('/marks/second-marking/verify', { token });
        const data = res.data?.data;
        if (!data) {
          throw new Error('Failed to load course details from token.');
        }

        setCourseData(data.course);
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

        const qList = config.questions || [
          { key: 'q1', label: 'Q1', maxMarks: 20 },
          { key: 'q2', label: 'Q2', maxMarks: 20 },
          { key: 'q3', label: 'Q3', maxMarks: 20 },
          { key: 'q4', label: 'Q4', maxMarks: 20 },
          { key: 'q5', label: 'Q5', maxMarks: 20 },
        ];
        setQuestions(qList);

        const firstMarks = config.firstMarkerSheet?.marks || {};
        const saved2nd = config.secondMarkerSheet?.marks || {};
        const sub = Boolean(
          config.secondMarkerSheet?.submitted ||
          data.course?.publishing_progress?.second_marking_submitted,
        );
        setIsSubmitted(sub);

        // Pre-fill 2nd marking with saved 2nd marks, or default to 1st marker marks
        const initial2nd: { [studentId: number]: { [qKey: string]: number } } = {};
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
  }, [token]);

  const handleCellChange = (studentId: number, qKey: string, valStr: string) => {
    if (isSubmitted) return;
    const num = Math.max(0, parseFloat(valStr) || 0);
    setSecondMarks((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [qKey]: num,
      },
    }));
  };

  const calculateRowTotal = (studentId: number) => {
    const row = secondMarks[studentId] || {};
    return questions.reduce((sum, q) => sum + (Number(row[q.key]) || 0), 0);
  };

  const calculateRowFinal = (studentId: number) => {
    const totalMax = questions.reduce((sum, q) => sum + (Number(q.maxMarks) || 20), 0);
    const rowTotal = calculateRowTotal(studentId);
    if (totalMax === 0) return 0;
    return Math.round((rowTotal / totalMax) * 100 * 10) / 10;
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSubmitted) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rows || rows.length < 2) {
          alert('Invalid Excel sheet layout.');
          return;
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
        const totalIdx = lowerHeaders.findIndex(
          (h: string) => h === 'total' || h.includes('total'),
        );

        // Identify question columns between Index Number and Total
        const qColIndices: { key: string; colIdx: number; name: string }[] = [];
        const startQIdx = indexIdx >= 0 ? indexIdx + 1 : 2;
        const endQIdx = totalIdx >= 0 ? totalIdx : headers.length;

        for (let c = startQIdx; c < endQIdx; c++) {
          const headerName = headers[c];
          if (
            headerName &&
            !lowerHeaders[c].includes('proper') &&
            !lowerHeaders[c].includes('p/r')
          ) {
            const key = `q_${c}`;
            qColIndices.push({ key, colIdx: c, name: headerName });
          }
        }

        if (qColIndices.length > 0) {
          setQuestions(qColIndices.map((q) => ({ key: q.key, label: q.name, maxMarks: 20 })));
        }

        const updatedMarks = { ...secondMarks };
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
            const sId = matchingStudent.student_id;
            updatedMarks[sId] = updatedMarks[sId] || {};
            qColIndices.forEach((q) => {
              const val = parseFloat(rowData[q.colIdx]) || 0;
              updatedMarks[sId][q.key] = val;
            });
          }
        }

        setSecondMarks(updatedMarks);
        setSuccess('Excel spreadsheet imported successfully! Review marks below.');
      } catch (err: any) {
        alert('Failed to parse Excel file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadExcel = () => {
    const dataRows = students.map((st, index) => {
      const row: any = {
        '#': index + 1,
        'Registration Number': st.registration_number || '',
        'Index Number': st.index_number || '',
        'P/R': st.registrations?.[0]?.attempt_type === 'REPEAT' ? 'R' : 'P',
      };
      questions.forEach((q) => {
        row[q.label] = secondMarks[st.student_id]?.[q.key] || 0;
      });
      row['Total'] = calculateRowTotal(st.student_id);
      row['Final (Out of 100)'] = calculateRowFinal(st.student_id);
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '2nd Marking');
    XLSX.writeFile(workbook, `${courseData?.course_code}_2nd_Marking_Sheet.xlsx`);
  };

  const handleSubmit = async () => {
    if (isSubmitted) return;
    if (
      !confirm(
        'Are you sure you want to submit your 2nd marking results? Once submitted, you cannot edit this sheet further.',
      )
    ) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await apiClient.post(`/marks/second-marking/submit/${courseData.course_id}`, {
        marks: secondMarks,
        config: { questions },
      });

      setIsSubmitted(true);
      setSuccess('2nd marking submitted successfully! The Course In-Charge has been notified.');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to submit 2nd marking.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.registration_number?.toLowerCase().includes(q) ||
      s.index_number?.toLowerCase().includes(q) ||
      s.user?.full_name?.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <Loader2 className="h-10 w-10 text-emerald-400 animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-400">Verifying secure magic link token...</p>
      </div>
    );
  }

  if (error || !courseData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-rose-400 mx-auto" />
          <h2 className="text-xl font-bold text-slate-100">Access Restricted</h2>
          <p className="text-xs text-slate-400">
            {error || 'Unable to access 2nd marking evaluation sheet.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg uppercase tracking-wider">
                2nd Marker Portal
              </span>
              {tokenEmail && (
                <span className="text-xs text-slate-400 font-mono">({tokenEmail})</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-100 mt-2">
              {courseData.course_code} &mdash; {courseData.course_name}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Second Marker Evaluation Marksheet. Enter marks manually or upload modified
              spreadsheet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleDownloadExcel}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer"
            >
              <Download className="h-4 w-4 text-emerald-400" />
              Download Excel
            </button>

            {!isSubmitted && (
              <label className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer">
                <Upload className="h-4 w-4 text-blue-400" />
                Upload Spreadsheet
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelUpload}
                  className="hidden"
                />
              </label>
            )}

            <button
              onClick={handleSubmit}
              disabled={isSubmitted || isSubmitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-lg disabled:opacity-40 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSubmitted ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {isSubmitted ? 'Submitted to In-Charge' : 'Submit to In-Charge'}
            </button>
          </div>
        </div>

        {/* Notifications */}
        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Search & Counter Bar */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Reg No or Index No..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="text-xs text-slate-400 font-mono font-semibold">
            Showing {filteredStudents.length} of {students.length} Records
          </div>
        </div>

        {/* Grid Table */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold font-mono">
                  <th className="px-4 py-4 min-w-12 text-center border-r border-slate-800">#</th>
                  <th className="px-6 py-4 min-w-36">Registration Number</th>
                  <th className="px-6 py-4 min-w-32 border-l border-slate-800">Index Number</th>
                  <th className="px-4 py-4 min-w-20 text-center border-l border-slate-800">P/R</th>

                  {questions.map((q) => (
                    <th
                      key={q.key}
                      className="px-4 py-4 min-w-28 text-center border-l border-slate-800"
                    >
                      <div>{q.label}</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        Max: {q.maxMarks || 20}
                      </div>
                    </th>
                  ))}

                  <th className="px-5 py-4 min-w-28 text-center border-l border-slate-800 bg-slate-900/40 text-emerald-400">
                    Total
                  </th>
                  <th className="px-5 py-4 min-w-36 text-center border-l border-slate-800 bg-slate-900/40 text-emerald-400">
                    Final (100)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5 + questions.length}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      No matching student records found.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st, idx) => {
                    const rowMarks = secondMarks[st.student_id] || {};
                    const total = calculateRowTotal(st.student_id);
                    const final100 = calculateRowFinal(st.student_id);
                    const isRepeat = st.registrations?.[0]?.attempt_type === 'REPEAT';

                    return (
                      <tr key={st.student_id} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 text-center text-slate-500 border-r border-slate-800/60 font-bold">
                          {idx + 1}
                        </td>
                        <td className="px-6 py-3 font-semibold text-slate-200">
                          {st.registration_number}
                        </td>
                        <td className="px-6 py-3 border-l border-slate-800/60 text-slate-300">
                          {st.index_number}
                        </td>
                        <td className="px-4 py-3 border-l border-slate-800/60 text-center">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                              isRepeat
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {isRepeat ? 'R' : 'P'}
                          </span>
                        </td>

                        {questions.map((q) => (
                          <td
                            key={q.key}
                            className="px-3 py-2 border-l border-slate-800/60 text-center"
                          >
                            <input
                              type="number"
                              min="0"
                              max={q.maxMarks || 100}
                              value={rowMarks[q.key] ?? ''}
                              disabled={isSubmitted}
                              onChange={(e) =>
                                handleCellChange(st.student_id, q.key, e.target.value)
                              }
                              className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-center text-xs font-bold text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                            />
                          </td>
                        ))}

                        <td className="px-5 py-3 border-l border-slate-800/60 text-center font-bold text-emerald-400 bg-slate-900/20">
                          {total}
                        </td>
                        <td className="px-5 py-3 border-l border-slate-800/60 text-center font-bold text-emerald-300 bg-slate-900/20">
                          {final100}%
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
    </div>
  );
}
