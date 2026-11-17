'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-100 text-slate-900 transition-colors duration-300 dark:border-white/10 dark:bg-[#050505] dark:text-white">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Brand */}
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#980000] text-xl font-black text-white">
                E
              </div>

              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  Exam<span className="text-[#980000] dark:text-red-500">MS</span>
                </h3>

                <p className="text-sm text-slate-600 dark:text-gray-400">
                  University Examination Management System
                </p>
              </div>
            </div>

            <p className="mt-6 max-w-md leading-7 text-slate-600 dark:text-gray-400">
              A secure and modern platform for managing examinations, schedules, students, hall
              allocation, invigilators and reports from one centralized system.
            </p>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2">
            <h4 className="mb-5 text-lg font-semibold text-slate-900 dark:text-white">
              Quick Links
            </h4>

            <ul className="space-y-3 text-slate-600 dark:text-gray-400">
              <li>
                <a
                  href="#"
                  className="transition-colors hover:text-[#980000] dark:hover:text-red-400"
                >
                  Home
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="transition-colors hover:text-[#980000] dark:hover:text-red-400"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#faq"
                  className="transition-colors hover:text-[#980000] dark:hover:text-red-400"
                >
                  FAQ
                </a>
              </li>
              <li>
                <Link
                  href="/login"
                  className="transition-colors hover:text-[#980000] dark:hover:text-red-400"
                >
                  Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Modules */}
          <div className="lg:col-span-2">
            <h4 className="mb-5 text-lg font-semibold text-slate-900 dark:text-white">Modules</h4>

            <ul className="space-y-3 text-slate-600 dark:text-gray-400">
              <li>Students</li>
              <li>Examinations</li>
              <li>Hall Allocation</li>
              <li>Invigilators</li>
              <li>Reports</li>
            </ul>
          </div>

          {/* Contact */}
          <div className="lg:col-span-3">
            <h4 className="mb-5 text-lg font-semibold text-slate-900 dark:text-white">Contact</h4>

            <ul className="space-y-3 text-slate-600 dark:text-gray-400">
              <li>📍 Faculty of Technology</li>
              <li>📧 examms@university.edu</li>
              <li>📞 +94 11 234 5678</li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 text-sm text-slate-500 dark:border-white/10 dark:text-gray-500 md:flex-row">
          <p>© {new Date().getFullYear()} ExamMS. All rights reserved.</p>

          <p>Developed for the University Examination Management System Project</p>
        </div>
      </div>
    </footer>
  );
}
