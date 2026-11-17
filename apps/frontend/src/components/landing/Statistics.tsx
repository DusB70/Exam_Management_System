'use client';

import {
  AcademicCapIcon,
  UserGroupIcon,
  BuildingOffice2Icon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';

const stats = [
  {
    value: '10K+',
    label: 'Students Managed',
    icon: UserGroupIcon,
  },
  {
    value: '500+',
    label: 'Examinations Conducted',
    icon: ClipboardDocumentListIcon,
  },
  {
    value: '150+',
    label: 'Examination Halls',
    icon: BuildingOffice2Icon,
  },
  {
    value: '99.9%',
    label: 'System Reliability',
    icon: AcademicCapIcon,
  },
];

export default function Statistics() {
  return (
    <section className="bg-white py-28 text-slate-900 transition-colors duration-300 dark:bg-[#080808] dark:text-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center">
          <span className="inline-flex rounded-full border border-red-600/30 bg-red-600/10 px-5 py-2 text-sm font-medium text-[#980000] dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            SYSTEM STATISTICS
          </span>

          <h2 className="mt-6 text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            Trusted by Universities
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-gray-400">
            A reliable platform designed to simplify university examination management with speed,
            accuracy and security.
          </p>
        </div>

        {/* Statistics Grid */}
        <div className="mt-20 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="group rounded-3xl border border-slate-200 bg-slate-50/80 p-8 text-center shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-[#980000]/40 hover:bg-white hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:hover:border-red-500/40 dark:hover:bg-white/10 dark:hover:shadow-2xl dark:hover:shadow-red-500/10"
              >
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600/10 transition-all duration-300 group-hover:bg-red-600/15 dark:bg-red-500/10 dark:group-hover:bg-red-500/20">
                  <Icon className="h-8 w-8 text-[#980000] dark:text-red-400" />
                </div>

                <h3 className="text-5xl font-black text-slate-900 dark:text-white">{stat.value}</h3>

                <p className="mt-4 text-slate-600 dark:text-gray-400">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
