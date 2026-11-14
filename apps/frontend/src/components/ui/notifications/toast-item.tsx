'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { ToastItemData, ToastType } from './toast.types';

interface ToastItemProps {
  toast: ToastItemData;
  onDismiss: (id: string) => void;
}

const icons: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: AlertTriangle,
  warning: AlertCircle,
  info: Info,
};

const styles: Record<
  ToastType,
  {
    iconClass: string;
    badgeClass: string;
    borderClass: string;
    progressBarClass: string;
    titleColor: string;
  }
> = {
  success: {
    iconClass: 'text-emerald-500 dark:text-emerald-400',
    badgeClass:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
    borderClass: 'border-emerald-500/30 dark:border-emerald-500/20 shadow-emerald-500/5',
    progressBarClass: 'bg-emerald-500 dark:bg-emerald-400',
    titleColor: 'text-emerald-600 dark:text-emerald-400',
  },
  error: {
    iconClass: 'text-rose-500 dark:text-rose-400',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
    borderClass: 'border-rose-500/30 dark:border-rose-500/20 shadow-rose-500/5',
    progressBarClass: 'bg-rose-500 dark:bg-rose-400',
    titleColor: 'text-rose-600 dark:text-rose-400',
  },
  warning: {
    iconClass: 'text-amber-500 dark:text-amber-400',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    borderClass: 'border-amber-500/30 dark:border-amber-500/20 shadow-amber-500/5',
    progressBarClass: 'bg-amber-500 dark:bg-amber-400',
    titleColor: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    iconClass: 'text-sky-500 dark:text-sky-400',
    badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20',
    borderClass: 'border-sky-500/30 dark:border-sky-500/20 shadow-sky-500/5',
    progressBarClass: 'bg-sky-500 dark:bg-sky-400',
    titleColor: 'text-sky-600 dark:text-sky-400',
  },
};

export const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const { id, type, title, message, duration } = toast;
  const Icon = icons[type];
  const typeStyle = styles[type];

  const [isHovered, setIsHovered] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [progress, setProgress] = useState(100);

  const remainingRef = useRef<number>(duration);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const closeToast = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onDismiss(id);
    }, 200);
  }, [id, onDismiss]);

  // Main countdown and progress loop
  useEffect(() => {
    if (duration <= 0) return;

    if (!isHovered) {
      startTimeRef.current = Date.now();

      // Set timeout for remaining duration
      timerRef.current = setTimeout(() => {
        closeToast();
      }, remainingRef.current);

      // Smooth progress bar update
      const totalDuration = duration;
      const initialRemaining = remainingRef.current;
      const start = Date.now();

      const updateProgress = () => {
        const elapsed = Date.now() - start;
        const currentRemaining = Math.max(0, initialRemaining - elapsed);
        setProgress((currentRemaining / totalDuration) * 100);

        if (currentRemaining > 0) {
          animationFrameRef.current = requestAnimationFrame(updateProgress);
        }
      };

      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isHovered, duration, closeToast]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    // Calculate how much remaining time is left
    const elapsedSinceStart = Date.now() - startTimeRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsedSinceStart);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl transition-all duration-200 ease-out select-none ${
        isClosing ? 'opacity-0 scale-95 translate-x-4' : 'opacity-100 scale-100 translate-x-0'
      } bg-card/85 dark:bg-card/75 backdrop-blur-xl border ${typeStyle.borderClass} shadow-xl shadow-black/10 dark:shadow-black/40 hover:shadow-2xl hover:scale-[1.01]`}
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div className="p-4 flex items-start gap-3.5">
        {/* Status Icon */}
        <div className={`p-2 rounded-xl shrink-0 ${typeStyle.badgeClass}`}>
          <Icon className={`h-5 w-5 ${typeStyle.iconClass}`} />
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          {title ? (
            <h4
              className={`text-xs font-bold uppercase tracking-wider mb-1 ${typeStyle.titleColor}`}
            >
              {title}
            </h4>
          ) : (
            <h4
              className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${typeStyle.titleColor}`}
            >
              {type}
            </h4>
          )}
          <p className="text-sm font-medium text-foreground/90 leading-snug break-words">
            {message}
          </p>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={closeToast}
          aria-label="Close notification"
          className="shrink-0 p-1 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-secondary/60 transition cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Glassmorphic Animated Remaining Progress Bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5 dark:bg-white/5 overflow-hidden">
          <div
            className={`h-full transition-all duration-75 ${typeStyle.progressBarClass}`}
            style={{
              width: `${progress}%`,
              opacity: isHovered ? 0.9 : 0.6,
            }}
          />
        </div>
      )}
    </div>
  );
};
