'use client';

import { useState, useCallback, useMemo } from 'react';

export interface BulkDeleteResult {
  deletedCount: number;
  failedCount: number;
  firstErrorMessage: string | null;
}

/**
 * Manages multi-record selection state for list views and tables.
 */
export function useBulkSelection<T extends string | number = number>() {
  const [selectedIds, setSelectedIds] = useState<T[]>([]);

  const selectedSet = useMemo(() => new Set<T>(selectedIds), [selectedIds]);

  const isSelected = useCallback((id: T) => selectedSet.has(id), [selectedSet]);

  const toggle = useCallback((id: T) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const isAllSelected = useCallback(
    (visibleIds: T[]) => visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id)),
    [selectedSet],
  );

  const isIndeterminate = useCallback(
    (visibleIds: T[]) => {
      if (visibleIds.length === 0) return false;
      const selectedVisible = visibleIds.filter((id) => selectedSet.has(id)).length;
      return selectedVisible > 0 && selectedVisible < visibleIds.length;
    },
    [selectedSet],
  );

  const toggleAll = useCallback((visibleIds: T[]) => {
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => prevSet.has(id));
      if (allVisibleSelected) {
        const visibleSet = new Set(visibleIds);
        return prev.filter((id) => !visibleSet.has(id));
      }
      const next = [...prev];
      for (const id of visibleIds) {
        if (!prevSet.has(id)) {
          next.push(id);
        }
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds([]), []);

  const removeFromSelection = useCallback((idsToRemove: T[]) => {
    const removeSet = new Set(idsToRemove);
    setSelectedIds((prev) => prev.filter((id) => !removeSet.has(id)));
  }, []);

  return {
    selectedIds,
    selectedCount: selectedIds.length,
    isSelected,
    toggle,
    isAllSelected,
    isIndeterminate,
    toggleAll,
    clear,
    removeFromSelection,
    setSelectedIds,
  };
}

/**
 * Runs a bulk deletion in small batches, collecting per-item successes and errors.
 */
export async function runBulkDelete<T>(
  ids: T[],
  deleteFn: (id: T) => Promise<unknown>,
  batchSize = 10,
): Promise<BulkDeleteResult> {
  let deletedCount = 0;
  let failedCount = 0;
  let firstErrorMessage: string | null = null;

  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const settled = await Promise.allSettled(chunk.map((id) => deleteFn(id)));
    for (const res of settled) {
      if (res.status === 'fulfilled') {
        deletedCount += 1;
      } else {
        failedCount += 1;
        if (!firstErrorMessage) {
          const err: any = res.reason;
          firstErrorMessage =
            err?.response?.data?.message || err?.message || 'Failed to delete some selected items.';
        }
      }
    }
  }

  return { deletedCount, failedCount, firstErrorMessage };
}
