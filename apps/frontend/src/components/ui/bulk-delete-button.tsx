'use client';

import React, { useEffect, useRef } from 'react';
import { Trash2, Loader2 } from 'lucide-react';

interface BulkDeleteButtonProps {
  count: number;
  isDeleting?: boolean;
  onClick: () => void;
  label?: string;
  className?: string;
}

/**
 * Conditional bulk delete action button — hidden when nothing is selected.
 */
export function BulkDeleteButton({
  count,
  isDeleting = false,
  onClick,
  label = 'Delete Selected',
  className = '',
}: BulkDeleteButtonProps) {
  if (count <= 0) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDeleting}
      className={`inline-flex items-center gap-2 px-3.5 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs font-bold shadow-md shadow-destructive/20 transition cursor-pointer disabled:opacity-60 ${className}`}
    >
      {isDeleting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
      <span>
        {label} ({count})
      </span>
    </button>
  );
}

interface SelectAllCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: () => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Table/list header checkbox supporting indeterminate partial selection state.
 */
export function SelectAllCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  onChange,
  ariaLabel = 'Select all visible records',
  className = '',
}: SelectAllCheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label={ariaLabel}
      className={`h-4 w-4 rounded border-border/80 accent-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    />
  );
}
