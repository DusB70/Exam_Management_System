'use client';

import {
  CalendarDaysIcon,
  UserGroupIcon,
  BuildingOffice2Icon,
  ShieldCheckIcon,
  DocumentTextIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

const features = [
  {
    title: 'Exam Scheduling',
    description:
      'Create, organize and manage examination timetables with automatic conflict detection.',
    icon: CalendarDaysIcon,
  },
  {
    title: 'Student Management',
    description:
      'Manage student registrations, seating arrangements and attendance records efficiently.',
    icon: UserGroupIcon,
  },
  {
    title: 'Hall Allocation',
    description: 'Allocate examination halls automatically according to capacity and availability.',
    icon: BuildingOffice2Icon,
  },
  {
    title: 'Invigilator Assignment',
    description: 'Assign invigilators quickly while avoiding timetable conflicts.',
    icon: ShieldCheckIcon,
  },
  {
    title: 'Reports & Analytics',
    description: 'Generate attendance reports, examination summaries and printable documents.',
    icon: DocumentTextIcon,
  },
  {
    title: 'Dashboard Insights',
    description:
      'Monitor examinations, students, halls and overall system performance in real time.',
    icon: ChartBarIcon,
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
