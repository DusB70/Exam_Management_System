'use client';

import React, { useMemo } from 'react';
import {
  FileSpreadsheet,
  X,
  Loader2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Check,
  Save,
} from 'lucide-react';
import { useProgressiveList } from '../../hooks/use-progressive-load';
import { ProgressiveLoadFooter } from '../ui/progressive-load-footer';

export interface InspectorColumn {
  key: string;
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  render?: (row: any) => React.ReactNode;
}

export interface SpreadsheetValidationRow {
  rowIndex: number;
  isValid: boolean;
  errors: string[];
  [key: string]: any;
}

export interface SpreadsheetValidationResult<
  T extends SpreadsheetValidationRow = SpreadsheetValidationRow,
> {
  headerRow: string[];
  headerErrors: string[];
  expectedHeaders: string[];
  hasHeaderErrors: boolean;
  hasBlockingErrors: boolean;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  rows: T[];
}

interface SpreadsheetInspectorModalProps {
  open: boolean;
  fileName?: string;
  subtitle: string;
  isValidating: boolean;
  isSubmitting: boolean;
  validationResult: SpreadsheetValidationResult | null;
  columns: InspectorColumn[];
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function SpreadsheetInspectorModal({
  open,
  fileName,
  subtitle,
  isValidating,
  isSubmitting,
  validationResult,
  columns,
  confirmLabel,
  onClose,
  onConfirm,
}: SpreadsheetInspectorModalProps) {
  const rows = useMemo(
    () => (Array.isArray(validationResult?.rows) ? validationResult.rows : []),
    [validationResult],
  );

  const {
    visibleItems: visibleRows,
    visibleCount: visibleRowsCount,
    totalCount: totalRowsCount,
    hasMore: hasMoreRows,
  } = useProgressiveList<any>(rows, {
    resetKey: `${fileName || ''}|${validationResult?.totalRows || 0}|${open}`,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-md overflow-y-auto !m-0">
      <div className="bg-card border border-border/80 w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] my-auto overflow-hidden relative">
        {/* Modal Header */}
        <div className="px-6 py-4 md:px-8 md:py-5 border-b border-border/60 flex items-center justify-between shrink-0 bg-secondary/10">
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
              <FileSpreadsheet className="h-4 w-4" />
              Spreadsheet Live Error Inspector
            </div>
            <h3 className="text-xl font-bold text-foreground mt-0.5">
              Import Spreadsheet Preview - {fileName || 'File Upload'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition cursor-pointer disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1">
          {/* Validation Loading State */}
          {isValidating && (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-semibold text-foreground">
                Validating column headers & checking records in database...
              </p>
            </div>
          )}

          {/* Validation Results & Preview Table */}
          {validationResult && !isValidating && (
            <div className="space-y-4">
              {/* Header Error Warning Banner */}
              {validationResult.hasHeaderErrors && (
                <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-2xl text-destructive text-xs space-y-1.5">
                  <div className="font-bold text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4.5 w-4.5" />
                    Column Header Mismatch Error Detected!
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 font-medium">
                    {validationResult.headerErrors.map((errMsg, idx) => (
                      <li key={idx}>{errMsg}</li>
                    ))}
                  </ul>
                  {validationResult.headerRow?.length > 0 && (
                    <p>
                      Found headers:{' '}
                      <code className="font-mono bg-destructive/20 px-2 py-0.5 rounded font-bold">
                        {validationResult.headerRow.join(', ')}
                      </code>
                    </p>
                  )}
                  <p className="font-semibold">
                    Expected column headers: {validationResult.expectedHeaders.join(', ')}
                  </p>
                </div>
              )}

              {/* Summary Badges Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-secondary/20 p-4 rounded-2xl border border-border/60 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-bold text-foreground">
                    Total Rows: {validationResult.totalRows}
                  </span>
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 font-bold rounded-xl border border-emerald-500/20">
                    Valid Rows: {validationResult.validRowsCount}
                  </span>
                  {validationResult.invalidRowsCount > 0 && (
                    <span className="px-3 py-1 bg-destructive/10 text-destructive font-bold rounded-xl border border-destructive/20">
                      Rows with Errors: {validationResult.invalidRowsCount}
                    </span>
                  )}
                </div>

                {validationResult.hasBlockingErrors ? (
                  <div className="text-destructive font-bold text-xs flex items-center gap-1.5 bg-destructive/10 px-3 py-1.5 rounded-xl border border-destructive/20">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Spreadsheet contains errors. Cannot commit to system.</span>
                  </div>
                ) : (
                  <div className="text-emerald-400 font-bold text-xs flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>All rows validated cleanly! Ready to commit.</span>
                  </div>
                )}
              </div>

              {/* Preview Table with Separate Error Column */}
              <div className="max-h-[380px] overflow-auto border border-border/80 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-secondary border-b border-border/60 font-semibold uppercase text-[10px] text-muted-foreground z-10">
                    <tr>
                      <th className="py-3 px-3 border-r border-border/40 w-16 whitespace-nowrap">
                        Row #
                      </th>
                      {columns.map((col) => (
                        <th
                          key={col.key}
                          className={`py-3 px-3 border-r border-border/40 whitespace-nowrap ${col.headerClassName || ''}`}
                        >
                          {col.label}
                        </th>
                      ))}
                      <th className="py-3 px-4 text-left bg-secondary/90 text-foreground font-bold border-l border-border/40 min-w-[240px]">
                        STATUS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-medium">
                    {validationResult.rows?.length === 0 ? (
                      <tr>
                        <td
                          colSpan={columns.length + 2}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No data rows found in the spreadsheet.
                        </td>
                      </tr>
                    ) : (
                      visibleRows.map((row: any) => (
                        <tr
                          key={row.rowIndex}
                          className={
                            !row.isValid
                              ? 'bg-destructive/10 border-l-4 border-l-destructive'
                              : 'hover:bg-secondary/10'
                          }
                        >
                          <td className="py-2.5 px-3 border-r border-border/40 font-mono text-muted-foreground whitespace-nowrap">
                            Row {row.rowIndex}
                          </td>
                          {columns.map((col) => (
                            <td
                              key={col.key}
                              className={`py-2.5 px-3 border-r border-border/40 ${col.cellClassName || ''}`}
                            >
                              {col.render ? col.render(row) : row[col.key] || '—'}
                            </td>
                          ))}
                          <td className="py-2.5 px-4 font-semibold border-l border-border/40">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 font-bold rounded-lg text-[11px] border border-emerald-500/20">
                                <Check className="h-3.5 w-3.5" /> Valid
                              </span>
                            ) : (
                              <div className="space-y-1">
                                {row.errors.map((errStr: string, idx: number) => (
                                  <div
                                    key={idx}
                                    className="text-destructive font-bold text-[11px] flex items-start gap-1.5"
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-destructive" />
                                    <span>{errStr}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <ProgressiveLoadFooter
                  loadedCount={visibleRowsCount}
                  totalCount={totalRowsCount}
                  isLoadingMore={hasMoreRows}
                  hasMore={hasMoreRows}
                  entityLabel="rows"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 md:px-8 md:py-4 border-t border-border/60 flex items-center justify-end gap-3 shrink-0 bg-secondary/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition text-xs cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={
              isValidating ||
              !validationResult ||
              validationResult.hasBlockingErrors ||
              isSubmitting
            }
            onClick={onConfirm}
            className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 transition text-xs disabled:opacity-40 flex items-center gap-2 shadow-md cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
