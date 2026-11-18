'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
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
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-border/80 bg-card/85 backdrop-blur-xl shadow-sm text-foreground'
          : 'border-b border-border/40 bg-card/40 backdrop-blur-md text-foreground'
      }`}
    >
      <div className="flex h-20 w-full items-center justify-between px-4 md:px-8">
        {/* Brand matching other pages */}
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/images/logo.webp"
            alt="FOT EMS"
            width={30}
            height={38}
            className="object-contain transition-transform duration-200 group-hover:scale-105 shrink-0"
          />
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight truncate text-foreground">
              FOT EMS
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline-block">
              Examination Management System
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          {menuItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Action Button */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
          >
            Login
          </Link>
        </div>

        {/* Mobile Menu Toggle Button */}
        <div className="flex items-center md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border/80 bg-card/95 backdrop-blur-xl px-4 py-4 space-y-3 animate-fadeIn">
          <nav className="flex flex-col space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="pt-2 border-t border-border/60">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full text-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all"
            >
              Login
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
