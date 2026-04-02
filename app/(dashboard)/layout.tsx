'use client';

import { DashboardNav } from '@/components/dashboard-nav';
import { useSidebar } from '@/lib/sidebar-context';

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isOpen } = useSidebar();

  return (
    <div className="flex min-h-screen">
      <DashboardNav />
      <main className={`flex-1 bg-gray-50 transition-all duration-200 ${
        isOpen ? 'ml-64' : 'ml-20'
      }`}>
        {children}
      </main>
    </div>
  );
}
