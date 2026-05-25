'use client';

import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { Users, BookOpen, Clock, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function DashboardOverview() {
  const { user } = useAuthStore();

  const cards = [
    {
      title: 'Current Semester',
      value: 'Semester 1',
      desc: 'Academic Year 2026',
      icon: Clock,
      color: 'text-primary bg-primary/10 border-primary/20',
    },
    {
      title: 'Registered Courses',
      value: '5 Courses',
      desc: '15.0 Credits Total',
      icon: BookOpen,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Active Students',
      value: '1,240 Enrolled',
      desc: 'Across 3 Departments',
      icon: Users,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-card/30 border border-border/60 p-8 rounded-3xl backdrop-blur-md">
        <div className="absolute -top-[100%] -right-[30%] h-[200%] w-[50%] rounded-full bg-primary/15 blur-[100px]" />
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/15">
            System Online
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Welcome back, {user?.fullName}!
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl">
            You are logged in as <span className="font-semibold text-foreground">{user?.role}</span>
            . Access all student registers, semesters, exam results, and audit trails using the
            sidebar navigation.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-card/25 border border-border/80 p-6 rounded-2xl flex items-center justify-between backdrop-blur-sm"
          >
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {card.title}
              </span>
              <p className="text-2xl font-bold tracking-tight">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.desc}</p>
            </div>
            <div className={`p-3 rounded-xl border ${card.color}`}>
              <card.icon className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Quick Actions Shortcuts</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Link
            href="/users"
            className="p-5 bg-card/20 hover:bg-secondary/40 border border-border/60 hover:border-primary/45 rounded-2xl transition flex items-start gap-4 group"
          >
            <div className="p-3 bg-secondary rounded-xl text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm">User Directory</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Register new student accounts and manage details
              </p>
            </div>
          </Link>

          <div className="p-5 bg-card/10 opacity-60 border border-border/40 rounded-2xl flex items-start gap-4 cursor-not-allowed">
            <div className="p-3 bg-secondary rounded-xl text-muted-foreground">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm">Courses Register</h4>
              <p className="text-xs text-muted-foreground mt-1">
                View curriculum, schedules, and active academic semesters (Phase 4)
              </p>
            </div>
          </div>

          <div className="p-5 bg-card/10 opacity-60 border border-border/40 rounded-2xl flex items-start gap-4 cursor-not-allowed">
            <div className="p-3 bg-secondary rounded-xl text-muted-foreground">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm">Exam Schedules</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Manage exam timetables, halls, and seating arrangements (Phase 4)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
