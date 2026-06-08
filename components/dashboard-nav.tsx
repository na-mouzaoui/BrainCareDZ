'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useSidebar } from '@/lib/sidebar-context';
import {
  LayoutDashboard,
  Users,
  Calendar,
  DollarSign,
  LogOut,
  Brain,
  Package,
  CreditCard,
  FileText,
  Lock,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Patients', href: '/patients', icon: Users },
  { label: 'Rendez-vous', href: '/appointments', icon: Calendar },
  { label: 'Prestations et packs', href: '/services', icon: Package },
  { label: 'Paiements', href: '/payments', icon: CreditCard },
  { label: 'Factures entreprises', href: '/company-invoices', icon: FileText },
  { label: 'Charges et dépenses', href: '/expenses', icon: DollarSign, adminOnly: true },
  { label: 'Admin', href: '/admin', icon: Lock, adminOnly: true },
];

export function DashboardNav() {
  const { isOpen, setIsOpen } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  const handleBlurCapture = (event: React.FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsOpen(false);
    }
  };

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-white border-r border-emerald-900/20 text-gray-900 transition-all duration-200 z-50 shadow-lg ${
      isOpen ? 'w-64' : 'w-20'
    }`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocusCapture={() => setIsOpen(true)}
      onBlurCapture={handleBlurCapture}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 p-6 border-b border-emerald-900/20 hover:bg-emerald-50 transition-colors">
          <Brain className="h-8 w-8 flex-shrink-0 text-emerald-700" />
          {isOpen && (
            <span className="font-bold text-lg text-emerald-900 whitespace-nowrap">BrainCareDZ</span>
          )}
        </Link>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-2">
          {navItems.map((item) => {
            // Only show admin-only items for admin users
            if (item.adminOnly && user?.role !== 'admin') {
              return null;
            }
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-md'
                    : 'text-gray-700 hover:bg-emerald-50'
                }`}
                title={!isOpen ? item.label : ''}
              >
                <Icon className="size-5 min-h-5 min-w-5 shrink-0" />
                {isOpen && <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Info and Logout */}
        <div className="border-t border-emerald-900/20 p-4 space-y-3">
          {isOpen && (
            <div className="px-2 py-2 bg-emerald-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-emerald-700 capitalize">{user?.role}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 transition-colors text-sm font-medium"
            title="Déconnexion"
          >
            <LogOut className="size-5 min-h-5 min-w-5 shrink-0" />
            {isOpen && <span className="whitespace-nowrap">Déconnexion</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
