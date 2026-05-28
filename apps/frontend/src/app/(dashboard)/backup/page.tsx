'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import {
  Database,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  Server,
  ShieldCheck,
} from 'lucide-react';

export default function BackupPage() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch db stats dynamically
  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['system-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/system/stats');
      return response.data?.data;
    },
  });

  const handleDownloadBackup = async () => {
    setIsDownloading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const response = await apiClient.get('/system/backup', {
        responseType: 'blob',
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ems_backup_${timestamp}.json`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);

      setSuccessMsg('System database backup successfully generated and downloaded!');
    } catch {
      setErrorMsg('Failed to generate system database backup.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Backup Control</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Run and export system database tables, configurations, and logs for archival backups.
        </p>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-2xl font-medium flex gap-2 items-center">
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-2xl font-medium flex gap-2 items-center">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Panel */}
        <div className="lg:col-span-2 bg-card/25 border border-border/80 p-8 rounded-3xl backdrop-blur-md space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute -top-[100%] -right-[30%] h-[200%] w-[50%] rounded-full bg-primary/10 blur-[100px]" />

          <div className="space-y-2 relative z-10">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Full System Data Export
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Exporting the database extracts data from all 17 tables (including users, course
              registrations, academic records, grades, and audit logs) into a single, structured
              JSON document. This document can be used by database administrators to restore state
              in emergencies.
            </p>
          </div>

          <div className="border border-border/60 bg-secondary/10 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                Data Format
              </span>
              <h4 className="font-extrabold text-sm flex items-center gap-1.5 mt-1">
                <FileJson className="h-4 w-4 text-primary" />
                Standard JSON Format (.json)
              </h4>
              <p className="text-[10px] text-muted-foreground">
                Contains schema tables mappings and row data arrays.
              </p>
            </div>
            <button
              onClick={handleDownloadBackup}
              disabled={isDownloading}
              className="py-3 px-6 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-primary/10 disabled:opacity-50"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  Generating Backup...
                </>
              ) : (
                <>
                  <Download className="h-4.5 w-4.5" />
                  Download Backup File
                </>
              )}
            </button>
          </div>
        </div>

        {/* Database Stats Card */}
        <div className="lg:col-span-1 bg-card/25 border border-border/80 p-6 rounded-3xl backdrop-blur-md space-y-5 shadow-xl">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Server className="h-4.5 w-4.5 text-primary" />
            Database Overview
          </h3>

          <div className="space-y-4 text-xs font-medium">
            <div className="flex justify-between border-b border-border/60 pb-2.5">
              <span className="text-muted-foreground">Database Engine:</span>
              <span className="text-foreground">PostgreSQL</span>
            </div>
            <div className="flex justify-between border-b border-border/60 pb-2.5">
              <span className="text-muted-foreground">ORM Provider:</span>
              <span className="text-foreground">Prisma Client</span>
            </div>
            <div className="flex justify-between border-b border-border/60 pb-2.5">
              <span className="text-muted-foreground">Total Database Tables:</span>
              <span className="text-foreground font-bold">17 tables</span>
            </div>
            <div className="flex justify-between border-b border-border/60 pb-2.5">
              <span className="text-muted-foreground">Audit Log Records:</span>
              <span className="text-foreground font-mono font-bold">
                {isStatsLoading ? '...' : stats?.totalLogs || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Connection Status:</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2.5 py-0.5 rounded-full">
                <ShieldCheck className="h-3.5 w-3.5" />
                ONLINE
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
