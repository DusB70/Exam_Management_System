'use client';

import React, { useState } from 'react';
import {
  Upload,
  X,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
} from 'lucide-react';

export interface ExcelUploadDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  instructions?: string;
  expectedHeaders: string[];
  notes?: string;
  onDownloadTemplate?: () => Promise<void> | void;
  onUpload: (file: File) => Promise<void> | void;
  isLoading?: boolean;
}

export default function ExcelUploadDialog({
  open,
  onClose,
  title,
  subtitle = 'Upload spreadsheet to import student marks',
  instructions = 'Your Excel sheet must contain a header row with the following column headers (case-insensitive):',
  expectedHeaders,
  notes,
  onDownloadTemplate,
  onUpload,
  isLoading = false,
}: ExcelUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDownloadTemplateClick = async () => {
    if (!onDownloadTemplate || isDownloadingTemplate) return;
    try {
      setIsDownloadingTemplate(true);
      await onDownloadTemplate();
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  if (!open) return null;

  const resetState = () => {
    setFile(null);
    setError(null);
    setSuccess(null);
    setDragActive(false);
  };

  const handleClose = () => {
    if (isSubmitting || isLoading) return;
    resetState();
    onClose();
  };

  const validateFile = (selectedFile: File): boolean => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = selectedFile.name.toLowerCase();
    const isValid =
      validExtensions.some((ext) => fileName.endsWith(ext)) ||
      selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      selectedFile.type === 'application/vnd.ms-excel' ||
      selectedFile.type === 'text/csv';

    if (!isValid) {
      setError('Only Excel and CSV spreadsheet files (.xlsx, .xls, .csv) are supported.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select or drop an Excel spreadsheet to upload.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await onUpload(file);
      setSuccess('Spreadsheet processed and marks imported successfully!');
      setTimeout(() => {
        handleClose();
      }, 700);
    } catch (err: any) {
      const msg = err?.message || 'Failed to process spreadsheet.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeLoading = isLoading || isSubmitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm !m-0">
      <div className="bg-card border border-border/80 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-fadeIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-secondary/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={activeLoading}
            className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition cursor-pointer disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl font-medium flex gap-2.5 items-start">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-medium flex gap-2.5 items-center">
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Instructions Box */}
          <div className="bg-secondary/20 border border-border/40 p-4 rounded-2xl text-xs space-y-2.5 text-muted-foreground">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-foreground">Spreadsheet Formatting Instructions</h4>
              {onDownloadTemplate && (
                <button
                  type="button"
                  onClick={handleDownloadTemplateClick}
                  disabled={isDownloadingTemplate}
                  className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isDownloadingTemplate ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Download Student List Template
                </button>
              )}
            </div>
            <p>{instructions}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px] bg-secondary/35 p-3 rounded-xl border border-border/50 max-h-[140px] overflow-y-auto">
              {expectedHeaders.map((header, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-foreground truncate">
                  <span className="text-primary font-bold">•</span>
                  <span className="truncate">{header}</span>
                </div>
              ))}
            </div>
            {notes && <p className="text-[10px] italic pt-1">{notes}</p>}
          </div>

          {/* Dropzone Area */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : file
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-border/80 hover:border-primary/65'
            }`}
          >
            <input
              type="file"
              id="excel-file-upload"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
              disabled={activeLoading}
            />

            {file ? (
              <div className="space-y-3">
                <FileSpreadsheet className="h-10 w-10 mx-auto text-emerald-400" />
                <div>
                  <p className="text-sm font-bold text-foreground max-w-[280px] truncate mx-auto">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-lg border border-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    File ready for upload
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setError(null);
                    }}
                    disabled={activeLoading}
                    className="px-3 py-1.5 bg-destructive/10 text-destructive text-xs font-semibold rounded-lg hover:bg-destructive/15 transition cursor-pointer disabled:opacity-50"
                  >
                    Remove File
                  </button>
                </div>
              </div>
            ) : (
              <label htmlFor="excel-file-upload" className="cursor-pointer space-y-3">
                <Upload className="h-10 w-10 text-muted-foreground/60 mx-auto transition-transform hover:-translate-y-0.5" />
                <div>
                  <p className="text-sm font-bold text-foreground">
                    Drag & drop your Excel sheet here
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    or{' '}
                    <span className="text-primary hover:underline font-semibold">browse files</span>{' '}
                    from device
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground/60">
                  Supports .xlsx, .xls, .csv spreadsheets up to 10MB
                </p>
              </label>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
            <button
              type="button"
              onClick={handleClose}
              disabled={activeLoading}
              className="px-5 py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition text-sm disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={activeLoading || !file}
              className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-md"
            >
              {activeLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Upload & Import'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
