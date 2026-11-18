'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'What is the University Examination Management System?',
    answer:
      'It is a web-based platform designed to streamline academic examination workflows, including semester course registration, marks entry and verification, automated GPA calculation, result publication, and official reporting.',
  },
  {
    question: 'Who can use this system?',
    answer:
      'The system features dedicated role-based portals for Students, Lecturers, Examination Division Staff, and System Administrators, each with strictly controlled permissions.',
  },
  {
    question: 'Can students submit medical or re-correction requests online?',
    answer:
      'Yes. Students can submit medical certificate requests, re-correction applications, and other academic appeals directly through their portal. The examination division reviews each submission and updates its status in real time, so students can track progress without visiting the office.',
  },
  {
    question: 'Does the system generate official academic reports?',
    answer:
      'Yes. Students can view and download official PDF result sheets, while the examination division and administrators can generate comprehensive broadsheets, marks distribution summaries, and performance reports in PDF and CSV formats.',
  },
  {
    question: 'How is student and examination data secured?',
    answer:
      'The system employs secure JWT-based authentication, role-based authorization, comprehensive audit trail logging for all sensitive operations, and automated database backups to ensure data integrity.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="bg-slate-50 py-28 text-slate-900 transition-colors duration-300 dark:bg-[#0B0B0B] dark:text-white"
    >
      <div className="mx-auto max-w-4xl px-6">
        {/* Heading */}
        <div className="text-center">
          <span className="inline-flex rounded-full border border-red-600/30 bg-red-600/10 px-5 py-2 text-sm font-medium text-[#980000] dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            FAQ
          </span>

          <h2 className="mt-6 text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            Frequently Asked Questions
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-gray-400">
            Find answers to the most common questions about the University Examination Management
            System.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="mt-16 space-y-5">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm backdrop-blur-xl transition-colors dark:border-white/10 dark:bg-white/5 dark:shadow-none"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="flex w-full items-center justify-between p-6 text-left transition hover:bg-slate-100/70 dark:hover:bg-white/5"
              >
                <span className="text-lg font-semibold text-slate-900 dark:text-white">
                  {faq.question}
                </span>

                <ChevronDown
                  className={`h-6 w-6 text-slate-500 transition-transform duration-300 dark:text-gray-400 ${
                    openIndex === index ? 'rotate-180 text-[#980000] dark:text-red-400' : ''
                  }`}
                />
              </button>

              <div
                className={`grid transition-all duration-300 ${
                  openIndex === index ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-6 pb-6 leading-7 text-slate-600 dark:text-gray-400">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
