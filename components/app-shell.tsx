'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard-nav';
import { useSidebar } from '@/lib/sidebar-context';
import { useAuth } from '@/lib/auth-context';

const PUBLIC_ROUTE_PREFIXES = ['/login', '/change-password'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen } = useSidebar();
  const { user, isLoading } = useAuth();

  // Mot de passe provisoire : aucun écran de l'application n'est accessible
  // tant qu'il n'a pas été remplacé (le serveur renvoie 403 de son côté).
  useEffect(() => {
    if (isLoading) return;
    if (user?.mustChangePassword && pathname !== '/change-password') {
      router.replace('/change-password');
    }
  }, [isLoading, user, pathname, router]);

  const isPublicRoute = PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  );

  if (isPublicRoute) {
    return <>{children}</>;
  }

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
          padding-top: calc(4rem + env(safe-area-inset-top));
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
