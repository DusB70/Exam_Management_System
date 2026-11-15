'use client';

import React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { LAZY_LOAD_INITIAL_LIMIT, useProgressiveList } from '../../hooks/use-progressive-load';

export interface ProgressiveLoadFooterProps {
  loadedCount: number;
  totalCount: number;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  entityLabel?: string;
  minCountToShow?: number;
  variant?: 'default' | 'dark';
  className?: string;
}

/**
 * Shared progressive auto-loading status footer for lists and tables.
 * Shows live progress while remaining batches load, and a completion badge for lists > 50 records.
 */
export function ProgressiveLoadFooter({
  loadedCount,
  totalCount,
  isLoadingMore = false,
  hasMore = false,
  isError = false,
  onRetry,
  entityLabel = 'records',
  minCountToShow = LAZY_LOAD_INITIAL_LIMIT,
  variant = 'default',
  className = '',
}: ProgressiveLoadFooterProps) {
  if (totalCount === 0 || loadedCount === 0) {
    return null;
  }

  const stillLoading = hasMore || isLoadingMore;

  if (!stillLoading && !isError && totalCount <= minCountToShow) {
    return null;
  }

  const containerStyle =
    variant === 'dark'
      ? 'bg-slate-900/60 border-t border-slate-800 text-slate-400'
      : 'bg-secondary/15 border-t border-border/60 text-muted-foreground';

  const strongStyle = variant === 'dark' ? 'text-slate-100' : 'text-foreground';

  return (
    <div
      className={`px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold ${containerStyle} ${className}`}
    >
      <div className="flex items-center gap-2">
        {isError ? (
          <>
            <span className="text-destructive font-bold">
              Loaded {loadedCount} of {totalCount} {entityLabel}. Auto-loading paused due to an
              error.
            </span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg border border-border/60 text-[11px] font-bold transition cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            )}
          </>
        ) : stillLoading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
            <span>
              Loaded <strong className={strongStyle}>{loadedCount}</strong> of{' '}
              <strong className={strongStyle}>{totalCount}</strong> {entityLabel} (Auto-loading
              remaining...)
            </span>
          </>
        ) : (
          <span className="text-emerald-400 flex items-center gap-1 font-bold">
            ✓ All {totalCount} {entityLabel} loaded automatically
          </span>
        )}
      </div>
    </div>
  );
}

export interface ProgressiveSliceProps<T> {
  items: T[];
  entityLabel?: string;
  resetKey?: string | number | boolean | null;
  variant?: 'default' | 'dark';
  footerClassName?: string;
  children: (visibleItems: T[], footer: React.ReactNode) => React.ReactNode;
}

/**
 * Component wrapper around useProgressiveList for lists inside loops or conditional helpers.
 */
export function ProgressiveSlice<T>({
  items,
  entityLabel = 'records',
  resetKey,
  variant = 'default',
  footerClassName = '',
  children,
}: ProgressiveSliceProps<T>) {
  const { visibleItems, visibleCount, totalCount, hasMore } = useProgressiveList<T>(items, {
    resetKey,
  });

  const footer = (
    <ProgressiveLoadFooter
      loadedCount={visibleCount}
      totalCount={totalCount}
      isLoadingMore={hasMore}
      hasMore={hasMore}
      entityLabel={entityLabel}
      variant={variant}
      className={footerClassName}
    />
  );

  return <>{children(visibleItems, footer)}</>;
}

export default ProgressiveLoadFooter;
