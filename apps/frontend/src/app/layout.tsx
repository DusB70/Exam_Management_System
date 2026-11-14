import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import QueryProvider from '../components/providers/query-provider';
import AuthProvider from '../components/providers/auth-provider';
import ThemeSwitcher from '../components/theme-switcher';
import { NotificationProvider } from '../components/ui/notifications';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'University Exam Management System',
  description: 'Enterprise-grade university Exam Management System (EMS)',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body className={inter.className}>
        <QueryProvider>
          <AuthProvider>
            <NotificationProvider>
              {children}
              <ThemeSwitcher />
            </NotificationProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
