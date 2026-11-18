'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, User } from 'lucide-react';
import { formatNameWithTitle } from '../../lib/nic-utils';

interface SearchableLecturerSelectProps {
  value?: string | number | null;
  onChange: (value: string, lecturerObj?: any) => void;
  lecturersByDepartment: [string, any[]][];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
}

export default function SearchableLecturerSelect({
  value,
  onChange,
  lecturersByDepartment,
  placeholder = 'Select a lecturer...',
  disabled = false,
  className = '',
  allowClear = true,
}: SearchableLecturerSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const strValue = value !== undefined && value !== null ? String(value) : '';

  // Flatten all lecturers for easy lookup
  const allLecturers = useMemo(() => {
    const list: any[] = [];
    for (const [, lecs] of lecturersByDepartment) {
      list.push(...lecs);
    }
    return list;
  }, [lecturersByDepartment]);

  // Find currently selected lecturer
  const selectedLecturer = useMemo(() => {
    if (!strValue) return null;
    return allLecturers.find((l) => String(l.lecturer_id) === strValue) || null;
  }, [strValue, allLecturers]);

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return lecturersByDepartment;

    const result: [string, any[]][] = [];
    for (const [deptName, lecs] of lecturersByDepartment) {
      const matchingLecs = lecs.filter((l) => {
        const name = l.user?.full_name?.toLowerCase() || '';
        const email = l.user?.email?.toLowerCase() || '';
        const empNo = l.employee_number?.toLowerCase() || '';
        const dept = deptName.toLowerCase();
        return name.includes(q) || email.includes(q) || empNo.includes(q) || dept.includes(q);
      });
      if (matchingLecs.length > 0) {
        result.push([deptName, matchingLecs]);
      }
    }
    return result;
  }, [lecturersByDepartment, searchTerm]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Auto focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const selectedDisplayName = selectedLecturer
    ? formatNameWithTitle(selectedLecturer.user?.full_name, selectedLecturer.user?.nic_no)
    : '';

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <div
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`w-full flex items-center justify-between px-3 py-2 bg-background border rounded-xl text-xs font-medium transition cursor-pointer select-none ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-border/40 bg-secondary/30 text-muted-foreground'
            : isOpen
              ? 'border-primary ring-2 ring-primary/20 text-foreground'
              : 'border-border/80 hover:border-border text-foreground'
        }`}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {selectedLecturer ? (
            <span className="truncate font-semibold text-foreground">
              {selectedDisplayName}{' '}
              <span className="text-[10px] text-muted-foreground font-mono">
                ({selectedLecturer.department?.department_code || 'Faculty'})
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {allowClear && selectedLecturer && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-1 hover:bg-secondary rounded-md text-muted-foreground hover:text-foreground transition cursor-pointer"
              title="Clear selection"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-primary' : ''
            }`}
          />
        </div>
      </div>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-full min-w-[280px] max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col backdrop-blur-xl animate-scaleUp">
          {/* Search Header */}
          <div className="p-2.5 border-b border-border/60 bg-secondary/20">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search lecturer by name, dept, email..."
                className="w-full pl-8 pr-3 py-1.5 bg-background border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1.5 divide-y divide-border/30">
            {allowClear && (
              <div
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition ${
                  !strValue
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                }`}
              >
                <span>-- Unassigned --</span>
                {!strValue && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
            )}

            {filteredGroups.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No lecturers match &quot;{searchTerm}&quot;
              </div>
            ) : (
              filteredGroups.map(([deptName, lecs]) => (
                <div key={deptName} className="pt-1.5 pb-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/15 rounded-md mb-1">
                    {deptName}
                  </div>
                  <div className="space-y-0.5">
                    {lecs.map((lec: any) => {
                      const isSelected = String(lec.lecturer_id) === strValue;
                      const displayName = formatNameWithTitle(
                        lec.user?.full_name,
                        lec.user?.nic_no,
                      );
                      return (
                        <div
                          key={lec.lecturer_id}
                          onClick={() => {
                            onChange(String(lec.lecturer_id), lec);
                            setIsOpen(false);
                          }}
                          className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition ${
                            isSelected
                              ? 'bg-primary/15 text-primary font-bold'
                              : 'text-foreground hover:bg-secondary/70'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="truncate font-medium">{displayName}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {lec.user?.email || lec.employee_number || 'Faculty'}
                            </p>
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
