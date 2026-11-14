'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, AlertCircle, HelpCircle, X } from 'lucide-react';
import { ConfirmOptions } from './toast.types';

interface ConfirmModalProps {
  isOpen: boolean;
  options: ConfirmOptions | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  options,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen || !options) return null;

  const {
    title = 'Confirm Action',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'primary',
  } = options;

  const variantConfigs = {
    destructive: {
      badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      icon: AlertTriangle,
      iconColor: 'text-rose-500 dark:text-rose-400',
      confirmBtn:
        'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 focus:ring-rose-500',
      glowBorder: 'border-rose-500/20 dark:border-rose-500/10',
    },
    warning: {
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      icon: AlertCircle,
      iconColor: 'text-amber-500 dark:text-amber-400',
      confirmBtn:
        'bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20 focus:ring-amber-500',
      glowBorder: 'border-amber-500/20 dark:border-amber-500/10',
    },
    primary: {
      badgeBg: 'bg-primary/10 text-primary border-primary/20',
      icon: HelpCircle,
      iconColor: 'text-primary',
      confirmBtn:
        'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 focus:ring-primary',
      glowBorder: 'border-border/80 dark:border-white/10',
    },
  };

  const config = variantConfigs[variant] || variantConfigs.primary;
  const VariantIcon = config.icon;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Glassmorphic Backdrop */}
      <div
        onClick={onCancel}
        className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-md transition-opacity duration-200 animate-fadeIn cursor-pointer"
        style={{
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* Glassmorphic Modal Dialog Box */}
      <div
        className={`relative w-full max-w-md rounded-3xl bg-card/90 dark:bg-card/80 backdrop-blur-2xl border ${config.glowBorder} shadow-2xl p-6 overflow-hidden transition-all duration-200 scale-100 animate-fadeIn`}
        style={{
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-2xl shrink-0 border ${config.badgeBg}`}>
            <VariantIcon className={`h-6 w-6 ${config.iconColor}`} />
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-lg font-bold text-foreground tracking-tight">{title}</h3>
            <div className="mt-2 text-sm text-muted-foreground leading-relaxed">{message}</div>
          </div>

          <button
            onClick={onCancel}
            aria-label="Close modal"
            className="p-1 rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-secondary/60 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-border/80 bg-secondary/40 hover:bg-secondary text-sm font-semibold text-foreground transition cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer ${config.confirmBtn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
