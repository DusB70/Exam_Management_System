'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api-client';
import { User, UserCheck, Loader2, Check, X } from 'lucide-react';

interface MarkerDialogProps {
  open: boolean;
  onClose: () => void;
  course: any;
  lecturersList: any[];
  onSuccess: () => void;
}

export default function MarkerDialog({
  open,
  onClose,
  course,
  lecturersList,
  onSuccess,
}: MarkerDialogProps) {
  const [firstMarkerType, setFirstMarkerType] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [firstMarkerLecturerId, setFirstMarkerLecturerId] = useState<string>('');
  const [firstMarkerName, setFirstMarkerName] = useState<string>('');
  const [firstMarkerEmail, setFirstMarkerEmail] = useState<string>('');

  const [secondMarkerType, setSecondMarkerType] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [secondMarkerLecturerId, setSecondMarkerLecturerId] = useState<string>('');
  const [secondMarkerName, setSecondMarkerName] = useState<string>('');
  const [secondMarkerEmail, setSecondMarkerEmail] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (course) {
      setFirstMarkerType(course.first_marker_type === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL');
      setFirstMarkerLecturerId(
        course.first_marker_lecturer_id
          ? course.first_marker_lecturer_id.toString()
          : course.lecturers?.[0]?.lecturer_id
            ? course.lecturers[0].lecturer_id.toString()
            : '',
      );
      setFirstMarkerName(course.first_marker_name || '');
      setFirstMarkerEmail(course.first_marker_email || '');

      setSecondMarkerType(course.second_marker_type === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL');
      setSecondMarkerLecturerId(
        course.second_marker_lecturer_id ? course.second_marker_lecturer_id.toString() : '',
      );
      setSecondMarkerName(course.second_marker_name || '');
      setSecondMarkerEmail(course.second_marker_email || '');
      setError(null);
    }
  }, [course]);

  if (!open || !course) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        firstMarkerType,
        firstMarkerLecturerId:
          firstMarkerType === 'INTERNAL' && firstMarkerLecturerId
            ? parseInt(firstMarkerLecturerId, 10)
            : null,
        firstMarkerName: firstMarkerType === 'EXTERNAL' ? firstMarkerName : null,
        firstMarkerEmail: firstMarkerType === 'EXTERNAL' ? firstMarkerEmail : null,
        secondMarkerType,
        secondMarkerLecturerId:
          secondMarkerType === 'INTERNAL' && secondMarkerLecturerId
            ? parseInt(secondMarkerLecturerId, 10)
            : null,
        secondMarkerName: secondMarkerType === 'EXTERNAL' ? secondMarkerName : null,
        secondMarkerEmail: secondMarkerType === 'EXTERNAL' ? secondMarkerEmail : null,
      };

      await apiClient.put(`/courses/${course.course_id}/markers`, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to assign course markers.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-card border border-border/80 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl animate-scaleUp">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-secondary/15">
          <div>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded uppercase">
              {course.course_code}
            </span>
            <h3 className="text-base font-bold text-foreground mt-1">{course.course_name}</h3>
            <p className="text-xs text-muted-foreground">
              Semester {course.semester} | Assign 1st and 2nd Examiners / Markers
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-xl transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* 1st Marker Section */}
          <div className="bg-secondary/10 border border-border/60 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="h-4 w-4" /> 1st Examiner / Marker (Primary)
              </h4>
              <span className="text-[10px] text-muted-foreground font-semibold">
                Default: Course Lecturer
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="firstMarkerType"
                  value="INTERNAL"
                  checked={firstMarkerType === 'INTERNAL'}
                  onChange={() => setFirstMarkerType('INTERNAL')}
                  className="accent-primary"
                />
                Faculty Lecturer (Internal)
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="firstMarkerType"
                  value="EXTERNAL"
                  checked={firstMarkerType === 'EXTERNAL'}
                  onChange={() => setFirstMarkerType('EXTERNAL')}
                  className="accent-primary"
                />
                Add External 1st Marker (Outside Faculty)
              </label>
            </div>

            {firstMarkerType === 'INTERNAL' ? (
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                  Select Internal Lecturer
                </label>
                <select
                  value={firstMarkerLecturerId}
                  onChange={(e) => setFirstMarkerLecturerId(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground font-medium"
                >
                  <option value="">Choose Faculty Lecturer...</option>
                  {lecturersList.map((lec: any) => (
                    <option key={lec.lecturer_id} value={lec.lecturer_id}>
                      {lec.user?.full_name} ({lec.department?.department_name || 'Faculty'})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                    External Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Prof. David Miller"
                    value={firstMarkerName}
                    onChange={(e) => setFirstMarkerName(e.target.value)}
                    required={firstMarkerType === 'EXTERNAL'}
                    className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                    External Email *
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. david@external.edu"
                    value={firstMarkerEmail}
                    onChange={(e) => setFirstMarkerEmail(e.target.value)}
                    required={firstMarkerType === 'EXTERNAL'}
                    className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2nd Marker Section */}
          <div className="bg-secondary/10 border border-border/60 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-4 w-4" /> 2nd Examiner / Marker
              </h4>
              <span className="text-[10px] text-muted-foreground font-semibold">Moderator</span>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="secondMarkerType"
                  value="INTERNAL"
                  checked={secondMarkerType === 'INTERNAL'}
                  onChange={() => setSecondMarkerType('INTERNAL')}
                  className="accent-primary"
                />
                Faculty Lecturer (Internal)
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="secondMarkerType"
                  value="EXTERNAL"
                  checked={secondMarkerType === 'EXTERNAL'}
                  onChange={() => setSecondMarkerType('EXTERNAL')}
                  className="accent-primary"
                />
                Add External 2nd Marker (Outside Faculty)
              </label>
            </div>

            {secondMarkerType === 'INTERNAL' ? (
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                  Select Internal 2nd Marker
                </label>
                <select
                  value={secondMarkerLecturerId}
                  onChange={(e) => setSecondMarkerLecturerId(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground font-medium"
                >
                  <option value="">Choose 2nd Marker Lecturer...</option>
                  {lecturersList.map((lec: any) => (
                    <option key={lec.lecturer_id} value={lec.lecturer_id}>
                      {lec.user?.full_name} ({lec.department?.department_name || 'Faculty'})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                    External 2nd Marker Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Sarah Jenkins"
                    value={secondMarkerName}
                    onChange={(e) => setSecondMarkerName(e.target.value)}
                    required={secondMarkerType === 'EXTERNAL'}
                    className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                    External 2nd Marker Email *
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. sarah@external.edu"
                    value={secondMarkerEmail}
                    onChange={(e) => setSecondMarkerEmail(e.target.value)}
                    required={secondMarkerType === 'EXTERNAL'}
                    className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition text-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save Marker Assignments
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
