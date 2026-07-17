'use client';

import React, { useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { AxiosError } from 'axios';
import { ApiResponse } from '@ems/shared';
import { Upload, X, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface StudentImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StudentImportDialog({
  open,
  onClose,
  onSuccess,
}: StudentImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) return null;

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
      if (
        droppedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        droppedFile.type === 'application/vnd.ms-excel' ||
        droppedFile.name.endsWith('.xlsx') ||
        droppedFile.name.endsWith('.xls')
      ) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Only Excel spreadsheet files (.xlsx, .xls) are supported.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to import.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiClient.post('/imports/students', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data?.success) {
        setSuccess(response.data?.message || 'Students imported successfully!');
        setFile(null);
        setTimeout(() => {
          onSuccess();
          onClose();
          setSuccess(null);
        }, 2000);
      } else {
        setError(response.data?.message || 'Bulk import failed.');
      }
    } catch (err: any) {
      const axiosError = err as AxiosError<ApiResponse>;
      const errMsg = axiosError.response?.data?.message || 'Error occurred during file upload.';
      setError(Array.isArray(errMsg) ? errMsg.join(', ') : errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border/80 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-fadeIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-secondary/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Bulk Student Import</h3>
              <p className="text-xs text-muted-foreground">
                Upload index register spreadsheet to enroll students
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleUpload} className="flex-1 overflow-y-auto p-6 space-y-5">
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
          <div className="bg-secondary/20 border border-border/40 p-4 rounded-2xl text-xs space-y-2 text-muted-foreground">
            <h4 className="font-bold text-foreground">Spreadsheet Formatting Instructions</h4>
            <p>
              Your Excel sheet must contain a header row with the following column headers exactly
              (case-sensitive):
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] bg-secondary/35 p-3 rounded-lg border border-border/50 max-h-[120px] overflow-y-auto">
              <span>• fullName</span>
              <span>• nameWithInitials</span>
              <span>• email</span>
              <span>• nicNo</span>
              <span>• dateOfBirth</span>
              <span>• phoneNumber</span>
              <span>• address</span>
              <span>• indexNumber</span>
              <span>• registrationNumber</span>
              <span>• academicYear</span>
              <span>• degreeCode</span>
              <span>• specializationCode</span>
            </div>
            <p className="text-[10px] italic pt-1">
              Note: Default account password will be set to student's NIC number.
            </p>
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
              id="file-upload"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
              disabled={isLoading}
            />

            {file ? (
              <div className="space-y-3">
                <FileSpreadsheet className="h-10 w-10 text-emerald-400 mx-auto" />
                <div>
                  <p className="text-sm font-bold text-foreground max-w-[280px] truncate mx-auto">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="px-3 py-1 bg-destructive/10 text-destructive text-xs font-semibold rounded-lg hover:bg-destructive/15 transition"
                >
                  Remove File
                </button>
              </div>
            ) : (
              <label htmlFor="file-upload" className="cursor-pointer space-y-3">
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
                  Supports .xlsx, .xls spreadsheets up to 10MB
                </p>
              </label>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-5 py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !file}
              className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
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
