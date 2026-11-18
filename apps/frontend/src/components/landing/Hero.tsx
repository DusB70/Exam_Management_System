'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { apiClient } from '../../lib/api-client';

const heroImages = [
  '/images/hero/hero1.webp',
  '/images/hero/hero2.webp',
  '/images/hero/hero3.webp',
  '/images/hero/hero4.webp',
  '/images/hero/hero5.webp',
  '/images/hero/hero6.webp',
];

/* ── Animated counter hook ── */
function useAnimatedCounter(target: number, duration = 1600) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target <= 0) {
      setCount(0);
      return;
    }

    const startTime = performance.now();
    let rafId: number;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setCount(Math.round(eased * target));
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return count;
}

export default function Hero() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [statsData, setStatsData] = useState({
    students: 57,
    lecturers: 4,
    courses: 222,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get('/public-stats')
      .then((res) => {
        if (isMounted && res.data?.data) {
          setStatsData({
            students: res.data.data.students ?? 57,
            lecturers: res.data.data.lecturers ?? 4,
            courses: res.data.data.courses ?? 222,
          });
        }
      })
      .catch(() => {
        // Keep verified database counts
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const studentsCount = useAnimatedCounter(statsData.students, 1600);
  const lecturersCount = useAnimatedCounter(statsData.lecturers, 1200);
  const coursesCount = useAnimatedCounter(statsData.courses, 1600);

  const stats = [
    { value: studentsCount, label: 'Students' },
    { value: lecturersCount, label: 'Lecturers' },
    { value: coursesCount, label: 'Courses' },
  ];

  return (
    <section className="relative h-screen overflow-hidden bg-slate-50 transition-colors duration-300 dark:bg-[#0b111a]">
      {/* Full-Bleed Background Slider */}
      <div className="absolute inset-0 z-0">
        {heroImages.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 h-screen w-full transition-opacity duration-1000 ${
              index === currentImageIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Image
              src={image}
              alt={`Hero ${index + 1}`}
              fill
              priority={index === 0}
              className="object-cover object-right scale-105"
            />
            {/* Theme-Aware Gradient Masks */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-50 via-slate-50/90 to-transparent dark:from-[#0b111a] dark:via-[#0b111a]/90 dark:to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-white/40 dark:from-[#0b111a] dark:via-transparent dark:to-black/30" />
          </div>
        ))}
      </div>

      {/* Hero Content */}
      <div className="absolute inset-0 z-10 flex items-center pt-20">
        <div className="w-full px-4 md:px-8">
          <div className="max-w-2xl text-slate-900 dark:text-white">
            <h1 className="text-5xl font-black leading-[1.08] tracking-tight sm:text-6xl">
              <span className="block text-slate-900 dark:text-white">Faculty of Technology</span>
              <span className="block">
                <span className="text-[#980000] dark:text-[#ef4444]">Examination</span>{' '}
                <span className="text-amber-600 dark:text-amber-300">Management System</span>
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 dark:text-gray-300 sm:text-lg">
              A centralized platform for semester course registration, marks management, automated
              GPA calculation, result publication, and official academic reporting.
            </p>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="rounded-xl bg-[#980000] px-8 py-3.5 font-semibold text-white shadow-lg transition hover:bg-[#760000]"
              >
                Login
              </Link>

              <Link
                href="#features"
                className="rounded-xl border border-slate-300 bg-white/70 px-8 py-3.5 font-semibold text-slate-900 backdrop-blur-sm transition-all duration-300 hover:bg-slate-900 hover:text-white dark:border-white/35 dark:bg-white/5 dark:text-white dark:hover:bg-white dark:hover:text-black"
              >
                Explore Features
              </Link>
            </div>

            {/* Borderless Stats Row */}
            <div className="mt-12 flex flex-wrap gap-10 border-t border-slate-200 pt-6 dark:border-white/15">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-gray-300">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
        <div className="flex h-10 w-6 justify-center rounded-full border-2 border-slate-700/70 dark:border-white/70">
          <div className="mt-2 h-2 w-2 animate-bounce rounded-full bg-slate-800 dark:bg-white" />
        </div>
      </div>
    </section>
  );
}
