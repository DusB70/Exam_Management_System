'use client';

import { BookOpen, FileSpreadsheet, Award } from 'lucide-react';

const steps = [
  {
    number: '01',
    title: 'Course Registration & Enrollment',
    description:
      'Students register for semester courses online within designated periods while administrators oversee course assignments and limits.',
    icon: BookOpen,
  },
  {
    number: '02',
    title: 'Marks Entry & Verification',
    description:
      'Lecturers input continuous assessments and final marks directly or via Excel bulk upload with multi-marker verification workflows.',
    icon: FileSpreadsheet,
  },
  {
    number: '03',
    title: 'GPA Calculation & Publication',
    description:
      'The engine automatically processes letter grades, SGPA, and CGPA, enabling exam staff to review, publish, and issue official result sheets.',
    icon: Award,
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="bg-slate-50 py-28 text-slate-900 transition-colors duration-300 dark:bg-[#0B0B0B] dark:text-white"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center">
          <span className="inline-flex rounded-full border border-red-600/30 bg-red-600/10 px-5 py-2 text-sm font-medium text-[#980000] dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            HOW IT WORKS
          </span>

          <h2 className="mt-6 text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            Manage Exams in Three Simple Steps
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-gray-400">
            Our examination management system streamlines academic examination workflows, from
            semester course registration to verified result publication.
          </p>
        </div>

        {/* Steps */}
        <div className="mt-20 grid gap-10 lg:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <div
                key={step.number}
                className="group relative rounded-3xl border border-slate-200 bg-white p-8 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-[#980000]/40 hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:hover:border-red-500/40 dark:hover:shadow-2xl dark:hover:shadow-red-500/10"
              >
                {/* Step Number */}
                <span className="absolute right-8 top-8 text-5xl font-black text-slate-900/10 dark:text-white/10">
                  {step.number}
                </span>

                {/* Icon */}
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600/10 transition-all duration-300 group-hover:bg-red-600/15 dark:bg-red-500/10 dark:group-hover:bg-red-500/20">
                  <Icon className="h-8 w-8 text-[#980000] dark:text-red-400" />
                </div>

                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{step.title}</h3>

                <p className="mt-5 leading-8 text-slate-600 dark:text-gray-400">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
