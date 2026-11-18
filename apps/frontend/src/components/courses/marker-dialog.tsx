'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '../../lib/api-client';
import { useToast } from '../../hooks/use-toast';
import { User, UserCheck, ShieldCheck, Loader2, Check, X, Plus, Trash2, Info } from 'lucide-react';
import SearchableLecturerSelect from '../ui/searchable-lecturer-select';

interface AdditionalFirstMarkerItem {
  id: string;
  type: 'INTERNAL' | 'EXTERNAL';
  lecturerId: string;
  name: string;
  email: string;
}

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
  const toast = useToast();

  // Whether 1st Marker and Course In-Charge are the same person
  const [isSameAsInCharge, setIsSameAsInCharge] = useState<boolean>(true);
  const [inChargeLecturerId, setInChargeLecturerId] = useState<string>('');

  // Primary 1st Marker state
  const [firstMarkerType, setFirstMarkerType] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [firstMarkerLecturerId, setFirstMarkerLecturerId] = useState<string>('');
  const [firstMarkerName, setFirstMarkerName] = useState<string>('');
  const [firstMarkerEmail, setFirstMarkerEmail] = useState<string>('');

  // Additional / Emergency 1st Markers
  const [additionalFirstMarkers, setAdditionalFirstMarkers] = useState<AdditionalFirstMarkerItem[]>(
    [],
  );

  // 2nd Marker state
  const [secondMarkerType, setSecondMarkerType] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [secondMarkerLecturerId, setSecondMarkerLecturerId] = useState<string>('');
  const [secondMarkerName, setSecondMarkerName] = useState<string>('');
  const [secondMarkerEmail, setSecondMarkerEmail] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Categorize lecturers under their Department
  const lecturersByDepartment = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const lec of lecturersList || []) {
      const deptName = lec.department?.department_name || 'Other / General Faculty';
      if (!groups[deptName]) {
        groups[deptName] = [];
      }
      groups[deptName].push(lec);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [lecturersList]);

  useEffect(() => {
    if (course && open) {
      const sameFlag =
        course.is_first_marker_same_as_in_charge !== undefined
          ? Boolean(course.is_first_marker_same_as_in_charge)
          : course.first_marker_type !== 'EXTERNAL';

      setIsSameAsInCharge(sameFlag);

      const resolvedInChargeId = course.in_charge_lecturer_id
        ? course.in_charge_lecturer_id.toString()
        : sameFlag && course.first_marker_lecturer_id
          ? course.first_marker_lecturer_id.toString()
          : '';
      setInChargeLecturerId(resolvedInChargeId);

      // Do NOT fallback to course.lecturers[0] or 2nd marker if 1st marker was removed / unassigned
      setFirstMarkerType(
        !sameFlag && course.first_marker_type === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL',
      );
      setFirstMarkerLecturerId(
        course.first_marker_lecturer_id ? course.first_marker_lecturer_id.toString() : '',
      );
      setFirstMarkerName(course.first_marker_name || '');
      setFirstMarkerEmail(course.first_marker_email || '');

      const rawAdditional = Array.isArray(course.additional_first_markers)
        ? course.additional_first_markers
        : [];
      setAdditionalFirstMarkers(
        rawAdditional.map((m: any, idx: number) => ({
          id: m.id || `add-fm-${idx}-${Date.now()}`,
          type: m.type === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL',
          lecturerId: m.lecturerId ? m.lecturerId.toString() : '',
          name: m.type === 'EXTERNAL' ? m.name || '' : '',
          email: m.type === 'EXTERNAL' ? m.email || '' : '',
        })),
      );

      setSecondMarkerType(course.second_marker_type === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL');
      setSecondMarkerLecturerId(
        course.second_marker_lecturer_id ? course.second_marker_lecturer_id.toString() : '',
      );
      setSecondMarkerName(course.second_marker_name || '');
      setSecondMarkerEmail(course.second_marker_email || '');
      setError(null);
    }
  }, [course, open]);

  if (!open || !course || !mounted) return null;

  const handleSameAsInChargeChange = (same: boolean) => {
    setIsSameAsInCharge(same);
    if (same) {
      setFirstMarkerType('INTERNAL');
      if (firstMarkerLecturerId && !inChargeLecturerId) {
        setInChargeLecturerId(firstMarkerLecturerId);
      } else if (inChargeLecturerId && !firstMarkerLecturerId) {
        setFirstMarkerLecturerId(inChargeLecturerId);
      }
    }
  };

  const handleClearPrimaryFirstMarker = () => {
    setFirstMarkerLecturerId('');
    setFirstMarkerName('');
    setFirstMarkerEmail('');
  };

  const handleClearSecondMarker = () => {
    setSecondMarkerLecturerId('');
    setSecondMarkerName('');
    setSecondMarkerEmail('');
  };

  const handleAddAdditionalFirstMarker = () => {
    setAdditionalFirstMarkers((prev) => [
      ...prev,
      {
        id: `add-fm-${Date.now()}-${prev.length}`,
        type: 'INTERNAL',
        lecturerId: '',
        name: '',
        email: '',
      },
    ]);
  };

  const handleUpdateAdditionalFirstMarker = (
    id: string,
    patch: Partial<AdditionalFirstMarkerItem>,
  ) => {
    setAdditionalFirstMarkers((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const handleRemoveAdditionalFirstMarker = (id: string) => {
    setAdditionalFirstMarkers((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isSameAsInCharge) {
      const hasPrimaryMarker =
        (firstMarkerType === 'INTERNAL' && Boolean(firstMarkerLecturerId)) ||
        (firstMarkerType === 'EXTERNAL' && Boolean(firstMarkerName.trim()));
      if (hasPrimaryMarker && !inChargeLecturerId) {
        const msg =
          'Please select the Course In-Charge from the faculty lecturer list when 1st Marker and In-Charge are different.';
        setError(msg);
        toast.error(msg);
        return;
      }
      if (firstMarkerType === 'EXTERNAL' && firstMarkerName.trim() && !firstMarkerEmail.trim()) {
        const msg = 'Please enter the email address of the outside 1st Marker.';
        setError(msg);
        toast.error(msg);
        return;
      }
    }

    for (let i = 0; i < additionalFirstMarkers.length; i++) {
      const m = additionalFirstMarkers[i];
      if (m.type === 'EXTERNAL' && m.name.trim() && !m.email.trim()) {
        const msg = `Please enter the email address for Additional 1st Marker #${i + 2}.`;
        setError(msg);
        toast.error(msg);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const effectiveFirstType = isSameAsInCharge ? 'INTERNAL' : firstMarkerType;
      const effectiveFirstLecId =
        effectiveFirstType === 'INTERNAL' && firstMarkerLecturerId
          ? parseInt(firstMarkerLecturerId, 10)
          : null;
      const effectiveFirstName =
        effectiveFirstType === 'EXTERNAL' && firstMarkerName.trim() ? firstMarkerName.trim() : null;
      const effectiveFirstEmail =
        effectiveFirstType === 'EXTERNAL' && firstMarkerEmail.trim()
          ? firstMarkerEmail.trim()
          : null;

      const hasPrimaryFirstMarker = Boolean(effectiveFirstLecId || effectiveFirstName);

      const effectiveInChargeId = isSameAsInCharge
        ? effectiveFirstLecId || (inChargeLecturerId ? parseInt(inChargeLecturerId, 10) : null)
        : inChargeLecturerId
          ? parseInt(inChargeLecturerId, 10)
          : null;

      const effectiveSecondLecId =
        secondMarkerType === 'INTERNAL' && secondMarkerLecturerId
          ? parseInt(secondMarkerLecturerId, 10)
          : null;
      const effectiveSecondName =
        secondMarkerType === 'EXTERNAL' && secondMarkerName.trim() ? secondMarkerName.trim() : null;
      const effectiveSecondEmail =
        secondMarkerType === 'EXTERNAL' && secondMarkerEmail.trim()
          ? secondMarkerEmail.trim()
          : null;
      const hasSecondMarker = Boolean(effectiveSecondLecId || effectiveSecondName);

      const payload = {
        isFirstMarkerSameAsInCharge: isSameAsInCharge,
        inChargeLecturerId: effectiveInChargeId,
        firstMarkerType: hasPrimaryFirstMarker ? effectiveFirstType : null,
        firstMarkerLecturerId: effectiveFirstLecId,
        firstMarkerName: effectiveFirstName,
        firstMarkerEmail: effectiveFirstEmail,
        additionalFirstMarkers: additionalFirstMarkers
          .filter((m) => (m.type === 'INTERNAL' ? Boolean(m.lecturerId) : Boolean(m.name.trim())))
          .map((m) => ({
            id: m.id,
            type: m.type,
            lecturerId: m.type === 'INTERNAL' && m.lecturerId ? parseInt(m.lecturerId, 10) : null,
            name: m.type === 'EXTERNAL' ? m.name.trim() : null,
            email: m.type === 'EXTERNAL' ? m.email.trim() : null,
          })),
        secondMarkerType: hasSecondMarker ? secondMarkerType : null,
        secondMarkerLecturerId: effectiveSecondLecId,
        secondMarkerName: effectiveSecondName,
        secondMarkerEmail: effectiveSecondEmail,
      };

      await apiClient.put(`/courses/${course.course_id}/markers`, payload);
      toast.success('Course In-Charge & Marker allocations saved successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save marker allocations.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasPrimaryFirstMarkerAssigned =
    (isSameAsInCharge && Boolean(firstMarkerLecturerId)) ||
    (!isSameAsInCharge &&
      ((firstMarkerType === 'INTERNAL' && Boolean(firstMarkerLecturerId)) ||
        (firstMarkerType === 'EXTERNAL' && Boolean(firstMarkerName.trim()))));

  const hasSecondMarkerAssigned =
    (secondMarkerType === 'INTERNAL' && Boolean(secondMarkerLecturerId)) ||
    (secondMarkerType === 'EXTERNAL' && Boolean(secondMarkerName.trim()));

  const modalContent = (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm !m-0"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border/80 w-full max-w-2xl max-h-[92vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl animate-scaleUp"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-secondary/15">
          <div>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded uppercase">
              {course.course_code}
            </span>
            <h3 className="text-base font-bold text-foreground mt-1">{course.course_name}</h3>
            <p className="text-xs text-muted-foreground">
              Semester {course.semester} | Configure Course In-Charge, 1st Marker(s) & 2nd Marker
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-xl transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Step 1: Ask whether 1st Marker and In-Charge are the same */}
          <div className="bg-secondary/10 border border-border/60 p-4 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/50">
              <div>
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> 1st Marker & Course In-Charge Configuration
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Are the 1st Marker and the Course In-Charge the same person?
                </p>
              </div>
              <div className="flex items-center gap-2 bg-background p-1 rounded-xl border border-border/70 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleSameAsInChargeChange(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    isSameAsInCharge
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Yes, Same Person
                </button>
                <button
                  type="button"
                  onClick={() => handleSameAsInChargeChange(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    !isSameAsInCharge
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  No, Different
                </button>
              </div>
            </div>

            {isSameAsInCharge ? (
              /* Same Person: Single Faculty Dropdown for 1st Marker & In-Charge */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase">
                    Select 1st Marker & Course In-Charge (Categorized by Department)
                  </label>
                  {hasPrimaryFirstMarkerAssigned && (
                    <button
                      type="button"
                      onClick={handleClearPrimaryFirstMarker}
                      className="text-[11px] font-bold text-destructive hover:underline flex items-center gap-1 cursor-pointer"
                      title="Remove Primary 1st Marker (keeps slot empty)"
                    >
                      <Trash2 className="h-3 w-3" /> Remove 1st Marker
                    </button>
                  )}
                </div>
                <SearchableLecturerSelect
                  value={firstMarkerLecturerId}
                  onChange={(val) => {
                    setFirstMarkerLecturerId(val);
                    if (val) {
                      setInChargeLecturerId(val);
                    }
                  }}
                  lecturersByDepartment={lecturersByDepartment}
                  placeholder="Search and select 1st Marker & In-Charge..."
                />
                {!firstMarkerLecturerId && inChargeLecturerId && (
                  <p className="text-[11px] text-amber-500 font-medium">
                    Primary 1st Marker slot is currently empty (Unassigned).
                  </p>
                )}
              </div>
            ) : (
              /* Different People: Select In-Charge from Faculty + Select 1st Marker (Faculty or Outside) */
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2.5">
                  <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-muted-foreground leading-relaxed">
                    <span className="font-bold text-foreground">Separate 1st Marker Workflow:</span>{' '}
                    When the 1st Marker is not the In-Charge, the 1st Marker will{' '}
                    <span className="font-semibold text-foreground">not</span> receive a magic link
                    to the Marks Registry. They will receive an email when the exam is marked as{' '}
                    <span className="font-semibold text-foreground">Held</span>, mark the paper
                    packet, and send the marksheet personally to the{' '}
                    <span className="font-semibold text-foreground">Course In-Charge</span>, who is
                    responsible for entering the marks into the system.
                  </div>
                </div>

                {/* Course In-Charge Dropdown */}
                <div className="p-3.5 bg-background/70 border border-border/70 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold text-primary uppercase">
                      Course In-Charge (Faculty Lecturer) *
                    </label>
                    {inChargeLecturerId && (
                      <button
                        type="button"
                        onClick={() => setInChargeLecturerId('')}
                        className="text-[10px] font-bold text-muted-foreground hover:text-destructive transition cursor-pointer"
                      >
                        Clear In-Charge
                      </button>
                    )}
                  </div>
                  <SearchableLecturerSelect
                    value={inChargeLecturerId}
                    onChange={(val) => setInChargeLecturerId(val)}
                    lecturersByDepartment={lecturersByDepartment}
                    placeholder="Search and select Course In-Charge..."
                  />
                </div>

                {/* Separate 1st Marker Selection */}
                <div className="p-3.5 bg-background/70 border border-border/70 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold text-primary uppercase flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5" /> Primary 1st Marker
                    </label>
                    {hasPrimaryFirstMarkerAssigned && (
                      <button
                        type="button"
                        onClick={handleClearPrimaryFirstMarker}
                        className="text-[11px] font-bold text-destructive hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" /> Remove 1st Marker
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="firstMarkerType"
                        value="INTERNAL"
                        checked={firstMarkerType === 'INTERNAL'}
                        onChange={() => setFirstMarkerType('INTERNAL')}
                        className="accent-primary"
                      />
                      Within the Faculty (Internal)
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
                      Outside the Faculty (External)
                    </label>
                  </div>

                  {firstMarkerType === 'INTERNAL' ? (
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                        Select 1st Marker Lecturer (Categorized by Department)
                      </label>
                      <SearchableLecturerSelect
                        value={firstMarkerLecturerId}
                        onChange={(val) => setFirstMarkerLecturerId(val)}
                        lecturersByDepartment={lecturersByDepartment}
                        placeholder="Search and select 1st Marker..."
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                          Outside 1st Marker Name *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Prof. David Miller"
                          value={firstMarkerName}
                          onChange={(e) => setFirstMarkerName(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                          Outside 1st Marker Email *
                        </label>
                        <input
                          type="email"
                          placeholder="e.g. david@external.edu"
                          value={firstMarkerEmail}
                          onChange={(e) => setFirstMarkerEmail(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Additional / Backup 1st Markers Section */}
            <div className="pt-3 border-t border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                    Additional / Backup 1st Markers ({additionalFirstMarkers.length})
                  </h5>
                  <p className="text-[10px] text-muted-foreground">
                    Add another 1st marker while keeping the first assigned one. If from the
                    faculty, either of them can enter marks in the system.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddAdditionalFirstMarker}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Another 1st Marker
                </button>
              </div>

              {additionalFirstMarkers.length > 0 && (
                <div className="space-y-3">
                  {additionalFirstMarkers.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-background/80 border border-border/70 rounded-xl space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                          Additional 1st Marker #{idx + 2}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAdditionalFirstMarker(item.id)}
                          className="text-[11px] font-bold text-destructive hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" /> Remove
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`addFirstMarkerType-${item.id}`}
                            value="INTERNAL"
                            checked={item.type === 'INTERNAL'}
                            onChange={() =>
                              handleUpdateAdditionalFirstMarker(item.id, { type: 'INTERNAL' })
                            }
                            className="accent-primary"
                          />
                          Within the Faculty (Can Enter Marks)
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`addFirstMarkerType-${item.id}`}
                            value="EXTERNAL"
                            checked={item.type === 'EXTERNAL'}
                            onChange={() =>
                              handleUpdateAdditionalFirstMarker(item.id, { type: 'EXTERNAL' })
                            }
                            className="accent-primary"
                          />
                          Outside the Faculty (External)
                        </label>
                      </div>

                      {item.type === 'INTERNAL' ? (
                        <SearchableLecturerSelect
                          value={item.lecturerId}
                          onChange={(val) =>
                            handleUpdateAdditionalFirstMarker(item.id, {
                              lecturerId: val,
                            })
                          }
                          lecturersByDepartment={lecturersByDepartment}
                          placeholder="Search and select additional 1st Marker..."
                        />
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Outside Marker Name *"
                            value={item.name}
                            onChange={(e) =>
                              handleUpdateAdditionalFirstMarker(item.id, { name: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground"
                          />
                          <input
                            type="email"
                            placeholder="Outside Marker Email *"
                            value={item.email}
                            onChange={(e) =>
                              handleUpdateAdditionalFirstMarker(item.id, { email: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2nd Marker Section */}
          <div className="bg-secondary/10 border border-border/60 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-4 w-4" /> 2nd Examiner / Marker (Moderator)
              </h4>
              {hasSecondMarkerAssigned && (
                <button
                  type="button"
                  onClick={handleClearSecondMarker}
                  className="text-[11px] font-bold text-destructive hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" /> Remove 2nd Marker
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-medium pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="secondMarkerType"
                  value="INTERNAL"
                  checked={secondMarkerType === 'INTERNAL'}
                  onChange={() => setSecondMarkerType('INTERNAL')}
                  className="accent-primary"
                />
                Within the Faculty (Internal)
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
                Outside the Faculty (External)
              </label>
            </div>

            {secondMarkerType === 'INTERNAL' ? (
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                  Select Internal 2nd Marker (Categorized by Department)
                </label>
                <SearchableLecturerSelect
                  value={secondMarkerLecturerId}
                  onChange={(val) => setSecondMarkerLecturerId(val)}
                  lecturersByDepartment={lecturersByDepartment}
                  placeholder="Search and select 2nd Marker..."
                />
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
              Save Allocations
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
