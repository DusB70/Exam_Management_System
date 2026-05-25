'use client';

import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../lib/api-client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import RouteGuard from '../../components/auth/route-guard';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  FileSpreadsheet,
  FileBarChart,
  LogOut,
  Menu,
  X,
  User as UserIcon,
} from 'lucide-react';
import { UserRole } from '@ems/shared';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Proceed with local logout even if API call fails (for safety)
    } finally {
      logout();
      router.push('/login');
    }
  };

  // Define sidebar navigation items based on User roles
  const getNavItems = () => {
    const common = [{ name: 'Overview', href: '/', icon: LayoutDashboard }];

    if (!user) return common;

    switch (user.role) {
      case UserRole.ADMINISTRATOR:
        return [
          ...common,
          { name: 'User Management', href: '/users', icon: Users },
          { name: 'Courses & Semesters', href: '/courses', icon: BookOpen },
          { name: 'Lecturer Assignments', href: '/lecturers', icon: GraduationCap },
          { name: 'Reports Panel', href: '/reports', icon: FileBarChart },
        ];
      case UserRole.EXAM_DIVISION_STAFF:
        return [
          ...common,
          { name: 'Courses & Batches', href: '/courses', icon: BookOpen },
          { name: 'Marks Registry', href: '/marks', icon: FileSpreadsheet },
          { name: 'Result Sheets', href: '/results', icon: FileBarChart },
          { name: 'Reports Panel', href: '/reports', icon: FileBarChart },
        ];
      case UserRole.LECTURER:
        return [
          ...common,
          { name: 'Marks Registry', href: '/marks', icon: FileSpreadsheet },
          { name: 'Reports Panel', href: '/reports', icon: FileBarChart },
        ];
      case UserRole.STUDENT:
        return [
          ...common,
          { name: 'Course Registration', href: '/registration', icon: BookOpen },
          { name: 'My Academic Results', href: '/results', icon: FileBarChart },
        ];
      default:
        return common;
    }
  };

  const navItems = getNavItems();

  return (
    <RouteGuard>
      <div className="min-h-screen flex bg-background text-foreground">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 bg-card/30 border-r border-border/80 p-5 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 px-2 mb-8">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <GraduationCap className="h-6 w-6" />
            </div>
            <span className="font-bold text-lg tracking-tight">University EMS</span>
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/15'
                      : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border/80 pt-4 mt-auto">
            <div className="flex items-center gap-3 px-2 mb-4">
              <div className="p-2 bg-secondary rounded-full">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate leading-none mb-1">{user?.fullName}</p>
                <p className="text-xs text-muted-foreground truncate leading-none">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Mobile Header / Navigation */}
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <header className="flex items-center justify-between px-6 py-4 bg-card/20 border-b border-border/60 md:hidden">
            <span className="font-bold text-lg">University EMS</span>
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 text-muted-foreground hover:text-foreground"
            >
              <Menu className="h-6 w-6" />
            </button>
          </header>

          {/* Main Area */}
          <main className="flex-1 p-6 md:p-10 relative overflow-y-auto max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>

        {/* Mobile Drawer Backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Mobile Drawer Menu */}
        <aside
          className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-card border-r border-border p-5 flex flex-col transition-transform duration-300 md:hidden ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between mb-8">
            <span className="font-bold text-lg">University EMS</span>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="flex-1 space-y-1" onClick={() => setMobileOpen(false)}>
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-lg'
                      : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border pt-4 mt-auto">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </aside>
      </div>
    </RouteGuard>
  );
}
