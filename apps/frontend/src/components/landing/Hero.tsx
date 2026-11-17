'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useAuthStore } from '../../store/authStore';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectFade } from 'swiper/modules';

import 'swiper/css';
import 'swiper/css/effect-fade';

const heroImages = [
  '/images/hero/hero1.png',
  '/images/hero/hero2.png',
  '/images/hero/hero3.png',
  '/images/hero/hero4.png',
  '/images/hero/hero5.png',
  '/images/hero/hero6.png',
];

const stats = [
  { value: '50K+', label: 'Students' },
  { value: '500+', label: 'Examinations' },
  { value: '100+', label: 'Exam Halls' },
  { value: '99.9%', label: 'System Uptime' },
];

export default function Hero() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <section className="relative h-screen overflow-hidden bg-slate-50 transition-colors duration-300 dark:bg-[#0b111a]">
      {/* Full-Bleed Background Slider */}
      <Swiper
        modules={[Autoplay, EffectFade]}
        effect="fade"
        loop
        autoplay={{
          delay: 6000,
          disableOnInteraction: false,
        }}
        speed={1500}
        className="absolute inset-0 z-0"
      >
        {heroImages.map((image, index) => (
          <SwiperSlide key={index}>
            <div className="relative h-screen w-full">
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
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Hero Content */}
      <div className="absolute inset-0 z-10 flex items-center pt-20">
        <div className="w-full px-4 md:px-8">
          <div className="max-w-2xl text-slate-900 dark:text-white">
            {/* Logo & Pill Badge */}
            <div className="mb-6 flex items-center gap-4">
              <Image src="/images/logo.png" alt="ExamMS" width={68} height={68} />
              <span className="inline-block rounded-full border border-slate-300 bg-white/80 px-4 py-1.5 text-xs font-semibold text-slate-800 backdrop-blur-md dark:border-white/25 dark:bg-white/10 dark:text-gray-100">
                University Examination Management System
              </span>
            </div>

            <h1 className="text-5xl font-black leading-[1.08] tracking-tight sm:text-6xl">
              <span className="block text-slate-900 dark:text-white">Manage University</span>
              <span className="block">
                <span className="text-[#980000] dark:text-[#ef4444]">Examinations</span>{' '}
                <span className="text-amber-600 dark:text-amber-300">Efficiently</span>
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 dark:text-gray-300 sm:text-lg">
              A centralized platform for scheduling examinations, allocating halls, managing
              students, assigning invigilators, and generating reports securely and efficiently.
            </p>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href={isAuthenticated ? '/dashboard' : '/login'}
                className="rounded-xl bg-[#980000] px-8 py-3.5 font-semibold text-white shadow-lg transition hover:bg-[#760000]"
              >
                {isAuthenticated ? 'Open Dashboard' : 'Get Started'}
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
