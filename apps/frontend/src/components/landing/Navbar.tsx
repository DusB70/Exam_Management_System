'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const entryHref = isAuthenticated ? '/dashboard' : '/login';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    window.addEventListener('scroll', handleScroll);

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const menuItems = [
    { label: 'Home', href: '#' },
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'border-b border-slate-200 bg-white/85 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b111a]/85'
          : 'bg-gradient-to-b from-white/90 to-transparent dark:from-black/70 dark:to-transparent'
      }`}
    >
      <div className="flex h-20 w-full items-center justify-between px-4 md:px-8">
        {/* Brand */}
        <Link href="/" className="flex flex-col">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            ExamMS
          </h1>
          <span className="text-xs text-slate-600 dark:text-gray-300">
            University Examination Management System
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden items-center gap-10 md:flex">
          {menuItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-base font-medium text-slate-700 transition duration-300 hover:text-[#980000] dark:text-gray-200 dark:hover:text-red-400"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Buttons */}
        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/login"
            className="rounded-xl border border-slate-300 bg-white/80 px-6 py-2.5 text-sm font-semibold text-slate-900 backdrop-blur-md transition-all duration-300 hover:bg-slate-900 hover:text-white dark:border-white/30 dark:bg-white/5 dark:text-white dark:hover:border-white dark:hover:bg-white dark:hover:text-black"
          >
            Login
          </Link>

          <Link
            href={entryHref}
            className="rounded-xl bg-[#980000] px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:bg-[#760000]"
          >
            {isAuthenticated ? 'Open Dashboard' : 'Get Started'}
          </Link>
        </div>
      </div>
    </header>
  );
}
