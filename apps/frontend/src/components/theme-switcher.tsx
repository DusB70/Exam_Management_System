'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize theme from localStorage on client side
  useEffect(() => {
    const savedTheme = localStorage.getItem('ems-theme') as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme('system');
    }
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;

    const getResolvedTheme = (t: Theme): 'light' | 'dark' => {
      if (t === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return t;
    };

    const resolved = getResolvedTheme(newTheme);

    if (resolved === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  };

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('ems-theme', theme);

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme('system');
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [theme]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getThemeIcon = (t: Theme) => {
    switch (t) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      case 'system':
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getThemeLabel = (t: Theme) => {
    switch (t) {
      case 'light':
        return 'Light Mode';
      case 'dark':
        return 'Dark Mode';
      case 'system':
        return 'System Default';
    }
  };

  const options: Theme[] = ['light', 'dark', 'system'];

  return (
    <div className="fixed bottom-6 right-6 z-[9999]" ref={containerRef}>
      {open && (
        <div className="absolute bottom-14 right-0 bg-card/90 border border-border/80 p-1.5 rounded-2xl backdrop-blur-md shadow-2xl space-y-1 w-40 animate-fadeIn">
          <div className="px-2.5 py-1.5 text-[9px] uppercase font-bold text-muted-foreground tracking-wider border-b border-border/40 mb-1">
            Theme Mode
          </div>
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                setTheme(opt);
                setOpen(false);
              }}
              className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-xs font-bold transition-all ${
                theme === opt
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {getThemeIcon(opt)}
              <span>{getThemeLabel(opt)}</span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center p-3.5 bg-primary text-primary-foreground border border-primary/20 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 group relative"
        aria-label="Toggle Theme Menu"
      >
        <span className="absolute -inset-1 rounded-full bg-primary/25 blur-sm opacity-60 group-hover:opacity-100 transition-opacity" />
        <div className="relative z-10 flex items-center justify-center">{getThemeIcon(theme)}</div>
      </button>
    </div>
  );
}
