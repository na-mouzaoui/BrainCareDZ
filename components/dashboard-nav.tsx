'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useSidebar } from '@/lib/sidebar-context';
import { users as usersApi } from '@/lib/api';
import {
  LayoutDashboard,
  Users,
  Calendar,
  CreditCard,
  FileText,
  DollarSign,
  Lock,
  LogOut,
  KeyRound,
} from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Tableau de bord', href: '/', icon: LayoutDashboard },
  { label: 'Patients', href: '/patients', icon: Users },
  { label: 'Rendez-vous', href: '/appointments', icon: Calendar },
  { label: 'Paiements', href: '/payments', icon: CreditCard },
  { label: 'Factures entreprises', href: '/company-invoices', icon: FileText },
  { label: 'Charges et dépenses', href: '/expenses', icon: DollarSign, adminOnly: true },
];

export function DashboardNav() {
  const { isOpen, setIsOpen, toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const closeSidebar = () => setIsOpen(false);

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isOpen && isMobile) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleChangePassword = async () => {
    setPwdError('');
    setPwdSuccess('');
    if (!pwdCurrent || !pwdNew) {
      setPwdError('Veuillez remplir tous les champs');
      return;
    }
    if (pwdNew.length < 6) {
      setPwdError('Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (pwdNew !== pwdConfirm) {
      setPwdError('Les mots de passe ne correspondent pas');
      return;
    }
    setPwdLoading(true);
    try {
      const res = await usersApi.changeMyPassword(pwdCurrent, pwdNew);
      if (res.success) {
        setPwdSuccess('Mot de passe modifié avec succès');
        setPwdCurrent('');
        setPwdNew('');
        setPwdConfirm('');
      } else {
        setPwdError(res.message || res.error || 'Échec de la modification');
      }
    } catch {
      setPwdError('Une erreur est survenue');
    } finally {
      setPwdLoading(false);
    }
  };

  const openPwdDialog = () => {
    setPwdError('');
    setPwdSuccess('');
    setPwdCurrent('');
    setPwdNew('');
    setPwdConfirm('');
    setPwdOpen(true);
  };

  const showLabels = isOpen;

  const sidebarContent = (
    <>
      {/* Logo inside sidebar */}
      <div className="border-b border-brand-900/20 px-1 py-2">
        <button
          onClick={toggleSidebar}
          className="flex flex-col items-center min-w-0 w-full p-2 hover:bg-brand-50 transition-colors rounded-lg"
          title={isOpen ? 'Réduire' : 'Développer'}
        >
          <img src="/LOGO.png" alt="BrainCareDZ" className="h-14 w-14 flex-shrink-0 object-contain" />
          {showLabels && (
            <img src="/desc-logo.png" alt="BrainCareDZ" className="h-10 flex-shrink-0 object-contain mt-2" />
          )}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-2">
        {navItems.map((item) => {
          if (item.adminOnly && user?.role !== 'admin') return null;
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeSidebar}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive ? 'bg-brand-700 text-white shadow-md' : 'text-gray-700 hover:bg-brand-50'
              }`}
            >
              <Icon className="size-5 min-h-5 min-w-5 shrink-0" />
              {showLabels && <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>}
            </Link>
          );
          if (!showLabels) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="bg-brand-800 text-white border border-brand-700 shadow-lg px-3 py-1.5 text-sm font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }
          return linkContent;
        })}
      </nav>

      {/* User Menu */}
      <div className="border-t border-brand-900/20 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {showLabels ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-brand-50 hover:bg-brand-100 transition-colors text-left">
                <div className="h-8 w-8 rounded-full bg-brand-200 flex items-center justify-center text-brand-700 font-semibold text-sm shrink-0">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                  <p className="text-xs text-brand-700 capitalize">{user?.role}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuItem onClick={openPwdDialog} className="gap-2 cursor-pointer">
                <KeyRound className="h-4 w-4" />
                Modifier le mot de passe
              </DropdownMenuItem>
              {user?.role === 'admin' && (
                <DropdownMenuItem onClick={() => { router.push('/admin'); closeSidebar(); }} className="gap-2 cursor-pointer">
                  <Lock className="h-4 w-4" />
                  Admin
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="gap-2 text-red-600 focus:text-red-600 cursor-pointer">
                <LogOut className="h-4 w-4" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="space-y-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex justify-center" title="Menu utilisateur">
                  <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm hover:bg-brand-200 transition-colors">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-56">
                <DropdownMenuItem onClick={openPwdDialog} className="gap-2 cursor-pointer">
                  <KeyRound className="h-4 w-4" />
                  Modifier le mot de passe
                </DropdownMenuItem>
                {user?.role === 'admin' && (
                  <DropdownMenuItem onClick={() => router.push('/admin')} className="gap-2 cursor-pointer">
                    <Lock className="h-4 w-4" />
                    Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="gap-2 text-red-600 focus:text-red-600 cursor-pointer">
                  <LogOut className="h-4 w-4" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </>
  );

  /*
   * SIDEBAR CSS STRATEGY — no dynamic Tailwind classes.
   *
   * Mobile (< md): sidebar uses translate-x to slide in/out.
   *   - translate-x-full  → hidden off-screen to the RIGHT
   *   - translate-x-0     → fully visible
   *   - -translate-x-full → hidden off-screen to the LEFT (our default)
   *
   * Desktop (md+): sidebar is always visible, uses width to collapse.
   *   - w-20 = collapsed (icons only)
   *   - w-64 = expanded (icons + labels)
   *
   * We use inline style for the dynamic parts (translateX, width)
   * so Tailwind JIT is never involved.
   */

  return (
    <>
      {/* Global CSS for sidebar responsive behavior */}
      <style>{`
        /* Mobile: sidebar hidden off-screen by default */
        .app-sidebar {
          transform: translateX(-100%);
          width: 256px;
          transition: transform 0.2s ease-in-out, width 0.2s ease-in-out;
        }
        /* Mobile: open = slide in */
        .app-sidebar[data-open="true"] {
          transform: translateX(0);
        }
        /* Desktop: always visible, width controlled by data attribute */
        @media (min-width: 768px) {
          .app-sidebar {
            transform: translateX(0) !important;
          }
          .app-sidebar[data-open="false"] {
            width: 80px !important;
          }
          .app-sidebar[data-open="true"] {
            width: 256px !important;
          }
        }
      `}</style>

      {/* Mobile logo toggle — always visible on mobile, hidden on desktop */}
      <button
        onClick={toggleSidebar}
        className="md:hidden fixed left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30 bg-white border border-gray-200 rounded-lg shadow-lg active:scale-95 transition-transform p-1"
        style={{ width: 48, height: 48 }}
        aria-label={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
      >
        <img src="/LOGO.png" alt="BrainCareDZ" className="w-full h-full object-contain" />
      </button>

      {/* Mobile backdrop */}
      <div
        className="md:hidden fixed inset-0 bg-black/40 z-40"
        style={{
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.2s ease-in-out',
        }}
        onClick={closeSidebar}
      />

      {/* Sidebar — pure CSS, no dynamic Tailwind classes */}
      <aside
        className="fixed left-0 top-0 h-dvh max-w-[85vw] bg-white border-r border-brand-900/20 text-gray-900 z-50 shadow-lg flex flex-col app-sidebar"
        data-open={isOpen ? 'true' : 'false'}
      >
        {sidebarContent}
      </aside>

      {/* Password change dialog */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le mot de passe</DialogTitle>
            <DialogDescription>
              Entrez votre mot de passe actuel et le nouveau mot de passe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {pwdError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{pwdError}</AlertDescription>
              </Alert>
            )}
            {pwdSuccess && (
              <Alert className="bg-green-50 border-green-200 text-green-800">
                <AlertDescription>{pwdSuccess}</AlertDescription>
              </Alert>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Mot de passe actuel</label>
              <PasswordInput value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)} placeholder="••••••••" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nouveau mot de passe</label>
              <PasswordInput value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} placeholder="••••••••" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Confirmer le mot de passe</label>
              <PasswordInput value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} placeholder="••••••••" />
            </div>
            <Button onClick={handleChangePassword} disabled={pwdLoading} className="w-full bg-brand-700 hover:bg-brand-800">
              {pwdLoading ? 'Enregistrement...' : 'Modifier le mot de passe'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
