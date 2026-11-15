'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useInfiniteQuery, QueryKey } from '@tanstack/react-query';

export const LAZY_LOAD_INITIAL_LIMIT = 50;
export const LAZY_LOAD_BATCH_SIZE = 50;
export const LAZY_LOAD_CLIENT_DELAY_MS = 300;
export const LAZY_LOAD_SERVER_DELAY_MS = 350;

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UseProgressiveListOptions {
  initialLimit?: number;
  batchSize?: number;
  delayMs?: number;
  resetKey?: string | number | boolean | null;
}

export interface UseProgressiveListResult<T> {
  visibleItems: T[];
  visibleLimit: number;
  visibleCount: number;
  totalCount: number;
  hasMore: boolean;
  reset: () => void;
}

/**
 * Progressively reveals an in-memory list: renders the initial batch (default 50)
 * immediately and then loads the remaining items slowly in batches.
 */
export function useProgressiveList<T>(
  items: T[],
  options: UseProgressiveListOptions = {},
): UseProgressiveListResult<T> {
  const {
    initialLimit = LAZY_LOAD_INITIAL_LIMIT,
    batchSize = LAZY_LOAD_BATCH_SIZE,
    delayMs = LAZY_LOAD_CLIENT_DELAY_MS,
    resetKey,
  } = options;

  const [visibleLimit, setVisibleLimit] = useState<number>(initialLimit);

  const reset = useCallback(() => {
    setVisibleLimit(initialLimit);
  }, [initialLimit]);

  useEffect(() => {
    setVisibleLimit(initialLimit);
  }, [initialLimit, resetKey]);

  const totalCount = items.length;

  useEffect(() => {
    if (totalCount > visibleLimit) {
      const timer = setTimeout(() => {
        setVisibleLimit((prev) => Math.min(prev + batchSize, totalCount));
      }, delayMs);
      return () => clearTimeout(timer);
    }
  }, [visibleLimit, totalCount, batchSize, delayMs]);

  const visibleItems = useMemo(() => {
    if (totalCount <= visibleLimit) return items;
    return items.slice(0, visibleLimit);
  }, [items, totalCount, visibleLimit]);

  return {
    visibleItems,
    visibleLimit,
    visibleCount: Math.min(visibleLimit, totalCount),
    totalCount,
    hasMore: totalCount > visibleLimit,
    reset,
  };
}

export interface UseProgressiveInfiniteQueryOptions<T> {
  queryKey: QueryKey;
  queryFn: (page: number, limit: number) => Promise<PaginatedResponse<T>>;
  enabled?: boolean;
  pageSize?: number;
  delayMs?: number;
  getItemKey?: (item: T) => string | number;
}

/**
 * Progressively fetches a server-paginated list: loads the first 50 records initially,
 * then automatically fetches remaining pages slowly in the background.
 */
export function useProgressiveInfiniteQuery<T>({
  queryKey,
  queryFn,
  enabled = true,
  pageSize = LAZY_LOAD_INITIAL_LIMIT,
  delayMs = LAZY_LOAD_SERVER_DELAY_MS,
  getItemKey,
}: UseProgressiveInfiniteQueryOptions<T>) {
  const query = useInfiniteQuery<PaginatedResponse<T>>({
    queryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => queryFn(Number(pageParam) || 1, pageSize),
    getNextPageParam: (lastPage) => {
      if (!lastPage) return undefined;
      return lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined;
    },
    enabled,
  });

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    isError,
    isFetchNextPageError,
    error,
    fetchNextPage,
    refetch,
  } = query;

  useEffect(() => {
    if (!enabled) return;
    if (!isLoading && hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
      const timer = setTimeout(() => {
        fetchNextPage();
      }, delayMs);
      return () => clearTimeout(timer);
    }
  }, [
    enabled,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
    delayMs,
  ]);

  const items = useMemo(() => {
    const pages = data?.pages || [];
    const flattened = pages.flatMap((p) => p?.items || []);
    if (!getItemKey) return flattened;

    const seen = new Set<string | number>();
    const deduped: T[] = [];
    for (const item of flattened) {
      const key = getItemKey(item);
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(item);
      }
    }
    return deduped;
  }, [data?.pages, getItemKey]);

  const total = useMemo(() => {
    const pages = data?.pages;
    if (!pages || pages.length === 0) return 0;
    const latest = pages[pages.length - 1];
    return latest?.total ?? pages[0]?.total ?? items.length;
  }, [data?.pages, items.length]);

  return {
    items,
    total,
    loadedCount: items.length,
    isLoading,
    isFetchingNextPage,
    hasNextPage: Boolean(hasNextPage),
    isError,
    isFetchNextPageError,
    error,
    fetchNextPage,
    refetch,
  };
}
