'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Search, Activity, ChevronLeft, ChevronRight, Loader2, Info } from 'lucide-react';

const fetchLogs = async (page: number, search: string) => {
  const response = await apiClient.get('/audit-logs', {
    params: {
      page,
      limit: 10,
      search: search || undefined,
    },
  });
  return response.data?.data;
};

export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // Fetch logs via react-query
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search],
    queryFn: () => fetchLogs(page, search),
  });

  const logs = data?.items || [];
  const totalPages = data?.totalPages || 1;

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

      {/* Search Filter */}
      <div className="relative max-w-md bg-card/20 border border-border/60 p-1.5 rounded-2xl backdrop-blur-md">
        <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by action, user name, or entity..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full pl-11 pr-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground placeholder:text-muted-foreground/60"
        />
      </div>

      {/* Logs Table */}
      <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
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
                  <td colSpan={7} className="text-center py-20 text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      Loading system logs...
                    </span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-20 text-muted-foreground">
                    No log records found.
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => (
                  <tr key={log.log_id} className="hover:bg-secondary/15 transition-colors text-xs">
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-border/80 flex items-center justify-between bg-secondary/10">
            <span className="text-xs font-medium text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-1.5 bg-secondary hover:bg-secondary/90 disabled:opacity-40 text-foreground rounded-lg transition border border-border/60"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="p-1.5 bg-secondary hover:bg-secondary/90 disabled:opacity-40 text-foreground rounded-lg transition border border-border/60"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Overlay Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
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
