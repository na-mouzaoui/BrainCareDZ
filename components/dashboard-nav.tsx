'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Clients', href: '/clients', icon: Users },
  { label: 'Rendez-vous', href: '/appointments', icon: Calendar },
  { label: 'Services', href: '/services', icon: FileText },
  { label: 'Notes de session', href: '/session-notes', icon: FileText },
  { label: 'Factures', href: '/invoices', icon: DollarSign },
  { label: 'Analytique', href: '/analytics', icon: BarChart3 },
  { label: 'Paramètres', href: '/settings', icon: Settings },
];

export function DashboardNav() {
  const [isOpen, setIsOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-white border-r border-emerald-900/20 text-gray-900 transition-all duration-300 z-50 shadow-lg ${
      isOpen ? 'w-64' : 'w-20'
    }`}>
      <div className="flex flex-col h-full">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 p-6 border-b border-emerald-900/20 hover:bg-emerald-50 transition-colors">
          <Brain className="h-8 w-8 flex-shrink-0 text-emerald-700" />
          {isOpen && (
            <div className="flex flex-col">
              <span className="font-bold text-lg text-emerald-900">Brain Caire</span>
              <span className="text-xs text-emerald-600">DZ</span>
            </div>
          )}
        </Link>

        {/* Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="absolute -right-4 top-6 bg-emerald-700 hover:bg-emerald-800 rounded-full p-2 text-white transition-colors shadow-md"
        >
          {isOpen ? <ChevronDown className="h-4 w-4 rotate-90" /> : <ChevronDown className="h-4 w-4 -rotate-90" />}
        </button>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-2">
          {navItems.map((item) => {
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
                <Icon className="h-5 w-5 flex-shrink-0" />
                {isOpen && <span className="text-sm font-medium">{item.label}</span>}
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
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {isOpen && <span>Déconnexion</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
