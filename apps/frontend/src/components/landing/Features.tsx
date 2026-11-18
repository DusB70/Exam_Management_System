'use client';

import { BookOpen, FileSpreadsheet, Calculator, Award, BarChart3, ShieldCheck } from 'lucide-react';

const features = [
  {
    title: 'Effortless Course Registration',
    description:
      'Enroll in semester courses with clarity. Easily select electives, keep track of your credit limits, and get your registration summary in seconds.',
    icon: BookOpen,
  },
  {
    title: 'Simple Marks Entry & Excel Upload',
    description:
      'Lecturers can enter assessment scores directly or upload Excel sheets in bulk, with smooth verification between first and second markers.',
    icon: FileSpreadsheet,
  },
  {
    title: 'Instant Grades & Accurate GPAs',
    description:
      'No more manual calculations. The system converts raw marks into university letter grades and calculates SGPA and CGPA automatically.',
    icon: Calculator,
  },
  {
    title: 'Transparent Result Publishing',
    description:
      'Exam staff can review and approve results with confidence, while students can check their grades and download official PDF result sheets anytime.',
    icon: Award,
  },
  {
    title: 'Clear Reports & Academic Broadsheets',
    description:
      'Get clean, easy-to-read performance reports, pass/fail summaries, and departmental broadsheets ready to export in PDF or CSV.',
    icon: BarChart3,
  },
  {
    title: 'Tailored Portals for Every Role',
    description:
      'A focused, secure experience designed specifically for students, lecturers, exam branch staff, and system administrators.',
    icon: ShieldCheck,
  },
];

export default function Features() {
  return (
    <section
      id="features"
      className="relative bg-white py-28 text-slate-900 transition-colors duration-300 dark:bg-[#080808] dark:text-white"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center">
          <span className="inline-flex items-center rounded-full border border-red-600/30 bg-red-600/10 px-5 py-2 text-sm font-medium text-[#980000] dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            FEATURES
          </span>

          <h2 className="mt-6 text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            Powerful Features
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-gray-400">
            Everything you need to manage university examinations efficiently, securely and
            intelligently.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="mt-20 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className="group rounded-3xl border border-slate-200 bg-slate-50/80 p-8 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-[#980000]/40 hover:bg-white hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:hover:border-red-500/40 dark:hover:bg-white/10 dark:hover:shadow-2xl dark:hover:shadow-red-500/10"
              >
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600/10 transition-all duration-300 group-hover:bg-red-600/15 dark:bg-red-500/10 dark:group-hover:bg-red-500/20">
                  <Icon className="h-8 w-8 text-[#980000] dark:text-red-400" />
                </div>

                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {feature.title}
                </h3>

                <p className="mt-5 leading-8 text-slate-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
