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
  ClipboardList,
  Lock,
} from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

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
  { label: 'Comptes rendus', href: '/reports', icon: ClipboardList },
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

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-white border-r border-emerald-900/20 text-gray-900 transition-all duration-200 z-50 shadow-lg flex flex-col ${
      isOpen ? 'w-64' : 'w-20'
    }`}>
      {/* Logo + Toggle */}
      <div className="flex items-center justify-between p-4 border-b border-emerald-900/20">
        <button
          onClick={toggleSidebar}
          className="flex items-center gap-3 min-w-0 hover:bg-emerald-50 transition-colors rounded-lg p-1 -ml-1"
          title={isOpen ? 'Réduire' : 'Développer'}
        >
          <Brain className="h-8 w-8 flex-shrink-0 text-emerald-700" />
          {isOpen && (
            <span className="font-bold text-lg text-emerald-900 whitespace-nowrap truncate">BrainCareDZ</span>
          )}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-2">
        {navItems.map((item) => {
          // Only show admin-only items for admin users
          if (item.adminOnly && user?.role !== 'admin') {
            return null;
          }
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-emerald-700 text-white shadow-md'
                  : 'text-gray-700 hover:bg-emerald-50'
              }`}
            >
              <Icon className="size-5 min-h-5 min-w-5 shrink-0" />
              {isOpen && <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>}
            </Link>
          );

          if (!isOpen) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="bg-emerald-800 text-white border border-emerald-700 shadow-lg px-3 py-1.5 text-sm font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      {/* User Info and Logout */}
      <div className="border-t border-emerald-900/20 p-4 space-y-3">
        {isOpen && user && (
          <div className="px-2 py-2 bg-emerald-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
            <p className="text-xs text-emerald-700 capitalize">{user.role}</p>
          </div>
        )}
        {!isOpen && user && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="px-2 py-2 text-center">
                <div className="h-8 w-8 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-sm">
                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8} className="bg-emerald-800 text-white border border-emerald-700 shadow-lg px-3 py-1.5 text-sm font-medium">
              <p>{user.name}</p>
              <p className="text-xs text-emerald-200 capitalize">{user.role}</p>
            </TooltipContent>
          </Tooltip>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 transition-colors text-sm font-medium"
          title={!isOpen ? 'Déconnexion' : ''}
        >
          <LogOut className="size-5 min-h-5 min-w-5 shrink-0" />
          {isOpen && <span className="whitespace-nowrap">Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
}
