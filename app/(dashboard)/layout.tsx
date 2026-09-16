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
      {/*
        Main content margin:
        Mobile: always ml-0, pt-16 for the logo button
        Desktop: ml-20 (collapsed) or ml-64 (expanded)
        Using inline styles to avoid Tailwind JIT dynamic class issues.
      */}
      <style>{`
        .app-main {
          margin-left: 0;
          padding-top: 4rem;
          transition: margin-left 0.2s ease-in-out;
        }
        @media (min-width: 768px) {
          .app-main {
            padding-top: 1.5rem;
          }
          .app-main[data-sidebar="false"] {
            margin-left: 5rem;
          }
          .app-main[data-sidebar="true"] {
            margin-left: 16rem;
          }
        }
      `}</style>
      <main
        className="flex-1 bg-gray-50 min-w-0 p-4 md:p-6 app-main"
        data-sidebar={isOpen ? 'true' : 'false'}
      >
        {children}
      </main>
    </div>
  );
}
