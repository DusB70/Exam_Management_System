'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Mail, Phone } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-border/80 bg-card/40 text-foreground backdrop-blur-md transition-colors duration-300">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Brand */}
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3">
              <Image
                src="/images/logo.webp"
                alt="FOT EMS"
                width={28}
                height={36}
                className="object-contain shrink-0"
              />

              <div>
                <h3 className="text-xl font-bold tracking-tight text-foreground">FOT EMS</h3>
                <p className="text-xs text-muted-foreground">Examination Management System</p>
              </div>
            </div>

            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
              A secure, centralized platform for semester course registration, marks management,
              automated GPA calculation, result publication, and official academic reporting.
            </p>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-3">
            <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-foreground">
              Quick Links
            </h4>

            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <a href="#" className="transition-colors hover:text-foreground">
                  Home
                </a>
              </li>
              <li>
                <a href="#features" className="transition-colors hover:text-foreground">
                  Features
                </a>
              </li>
              <li>
                <a href="#faq" className="transition-colors hover:text-foreground">
                  FAQ
                </a>
              </li>
              <li>
                <Link href="/login" className="transition-colors hover:text-foreground">
                  Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="lg:col-span-4">
            <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-foreground">
              Contact
            </h4>

            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <span>Faculty of Technology, RUSL</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <a
                  href="mailto:exam@tec.rjt.ac.lk"
                  className="transition-colors hover:text-foreground"
                >
                  exam@tec.rjt.ac.lk
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-primary shrink-0" />
                <span>+94 25 226 6200</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-8 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} FOT EMS. All rights reserved.</p>

          <p>Faculty of Technology, Rajarata University of Sri Lanka</p>
        </div>
      </div>
    </footer>
  );
}
