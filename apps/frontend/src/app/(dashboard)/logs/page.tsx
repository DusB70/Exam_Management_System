'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useToast } from '../../../hooks/use-toast';
import { useConfirm } from '../../../hooks/use-confirm';
import { useBulkSelection } from '../../../hooks/use-bulk-selection';
import { BulkDeleteButton, SelectAllCheckbox } from '../../../components/ui/bulk-delete-button';
import { useProgressiveInfiniteQuery } from '../../../hooks/use-progressive-load';
import ProgressiveLoadFooter from '../../../components/ui/progressive-load-footer';
import { Search, Activity, Loader2, Info, X } from 'lucide-react';

const fetchLogs = async (page: number, limit: number, search: string) => {
  const response = await apiClient.get('/audit-logs', {
    params: {
      page,
      limit,
      search: search || undefined,
    },
  });
  return response.data?.data;
};

export default function LogsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const {
    selectedIds: selectedLogIds,
    selectedCount,
    isSelected,
    toggle,
    isAllSelected,
    isIndeterminate,
    toggleAll,
    clear,
  } = useBulkSelection<number>();

  const getLogKey = useCallback((l: any) => l.log_id, []);

  // Fetch logs via progressive lazy loading (50 initially, then auto-load remaining slowly)
  const {
    items: logs,
    total: totalLogs,
    loadedCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useProgressiveInfiniteQuery<any>({
    queryKey: ['audit-logs', search],
    queryFn: (page, limit) => fetchLogs(page, limit, search),
    getItemKey: getLogKey,
  });

  const visibleLogIds = useMemo(() => logs.map((l: any) => l.log_id), [logs]);

  const handleBulkDeleteLogs = async () => {
    if (selectedCount === 0) return;
    const confirmed = await confirm({
      title: 'Delete Selected Audit Logs?',
      message: `Are you sure you want to permanently delete ${selectedCount} selected audit log record(s)? This cannot be undone.`,
      confirmText: `Delete (${selectedCount})`,
      variant: 'destructive',
    });
    if (!confirmed) return;

    setIsBulkDeleting(true);
    try {
      await apiClient.post('/audit-logs/bulk-delete', { ids: selectedLogIds });
      toast.success(`${selectedCount} audit log record(s) deleted.`);
      clear();
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete selected audit logs.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Audit Logs</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Review log trails tracking all user registry insertions, grade updates, and configuration
          actions.
        </p>
      </div>

      {/* Search Filter & Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md bg-card/20 border border-border/60 p-1.5 rounded-2xl backdrop-blur-md">
          <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by action, user name, or entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-9 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground placeholder:text-muted-foreground/60"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <BulkDeleteButton
            count={selectedCount}
            isDeleting={isBulkDeleting}
            onClick={handleBulkDeleteLogs}
          />
          <div className="px-3 py-2 bg-background border border-border/80 rounded-xl text-xs font-mono font-bold text-foreground flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-primary" />
            Showing {logs.length} of {totalLogs} Records
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                <th className="px-4 py-4 w-10 text-center">
                  <SelectAllCheckbox
                    checked={isAllSelected(visibleLogIds)}
                    indeterminate={isIndeterminate(visibleLogIds)}
                    disabled={logs.length === 0}
                    onChange={() => toggleAll(visibleLogIds)}
                    ariaLabel="Select all visible audit logs"
                  />
                </th>
                <th className="px-4 py-4 w-12 text-center">#</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Entity</th>
                <th className="px-6 py-4">Entity ID</th>
                <th className="px-6 py-4">IP Address</th>
                <th className="px-6 py-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-sm font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="text-center py-20 text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      Loading system logs...
                    </span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-20 text-muted-foreground">
                    No log records found.
                  </td>
                </tr>
              ) : (
                logs.map((log: any, idx: number) => (
                  <tr
                    key={log.log_id}
                    className={`hover:bg-secondary/15 transition-colors text-xs ${
                      isSelected(log.log_id) ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected(log.log_id)}
                        onChange={() => toggle(log.log_id)}
                        aria-label={`Select audit log ${log.log_id}`}
                        className="h-4 w-4 rounded border-border/80 accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-4 text-center font-mono text-muted-foreground font-bold">
                      {idx + 1}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      {log.user ? (
                        <div className="space-y-0.5">
                          <p className="font-semibold text-foreground">{log.user.full_name}</p>
                          <p className="text-[10px] text-muted-foreground">{log.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/75 font-italic font-bold">
                          System
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-primary">{log.action}</td>
                    <td className="px-6 py-4 text-foreground capitalize">{log.entity_name}</td>
                    <td className="px-6 py-4 font-mono text-muted-foreground">{log.entity_id}</td>
                    <td className="px-6 py-4 font-mono text-muted-foreground">
                      {log.ip_address || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 bg-secondary hover:bg-secondary/80 rounded-lg text-primary transition"
                        title="Inspect Data Changes"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Progressive Auto-Loading Footer Indicator */}
        <ProgressiveLoadFooter
          loadedCount={loadedCount}
          totalCount={totalLogs}
          isLoadingMore={isFetchingNextPage}
          hasMore={hasNextPage}
          isError={isFetchNextPageError}
          onRetry={() => fetchNextPage()}
          entityLabel="log records"
        />
      </div>

      {/* Details Overlay Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm !m-0">
          <div className="bg-card border border-border/80 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-secondary/10">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Audit Log Details: {selectedLog.action}
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground text-xs"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Meta details list */}
              <div className="grid grid-cols-2 gap-4 border-b border-border/60 pb-4 font-medium text-muted-foreground">
                <div className="space-y-1">
                  <span>Executor User:</span>
                  <p className="text-foreground font-bold">
                    {selectedLog.user?.full_name || 'System'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span>Timestamp:</span>
                  <p className="text-foreground">
                    {new Date(selectedLog.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <span>Target Table / ID:</span>
                  <p className="text-foreground font-mono">
                    {selectedLog.entity_name} / {selectedLog.entity_id}
                  </p>
                </div>
                <div className="space-y-1">
                  <span>User Agent / Browser:</span>
                  <p className="text-foreground truncate" title={selectedLog.user_agent}>
                    {selectedLog.user_agent || '-'}
                  </p>
                </div>
              </div>

              {/* Inspect Old/New values */}
              <div className="space-y-4 pt-1">
                {selectedLog.old_values && (
                  <div className="space-y-1.5">
                    <span className="font-bold text-muted-foreground">
                      Previous State (Old Values):
                    </span>
                    <pre className="p-4 bg-secondary/35 border border-border/50 rounded-xl overflow-x-auto font-mono text-[10px] text-destructive leading-relaxed whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.old_values, null, 2)}
                    </pre>
                  </div>
                )}
                <div className="space-y-1.5">
                  <span className="font-bold text-muted-foreground">
                    Changes Applied (New Values):
                  </span>
                  <pre className="p-4 bg-secondary/35 border border-border/50 rounded-xl overflow-x-auto font-mono text-[10px] text-emerald-400 leading-relaxed whitespace-pre-wrap">
                    {JSON.stringify(selectedLog.new_values || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
