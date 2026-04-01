'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, DollarSign, Users, Calendar } from 'lucide-react';

interface DashboardStats {
  totalClients: number;
  upcomingAppointments: number;
  monthlyRevenue: number;
  completedSessions: number;
}

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 12,
    upcomingAppointments: 5,
    monthlyRevenue: 2500,
    completedSessions: 48,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pt-6">
        <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-600 mt-2">Bienvenue dans votre cabinet de psychologie</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total des clients</CardTitle>
            <Users className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-gray-600 mt-1">Clients enregistrés</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rendez-vous à venir</CardTitle>
            <Calendar className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingAppointments}</div>
            <p className="text-xs text-gray-600 mt-1">Cette semaine</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenus mensuels</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.monthlyRevenue}</div>
            <p className="text-xs text-gray-600 mt-1">Revenue total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions terminées</CardTitle>
            <BarChart3 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedSessions}</div>
            <p className="text-xs text-gray-600 mt-1">Ce mois</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={() => router.push('/clients')} className="p-4 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-left transition-colors">
              <p className="font-medium text-emerald-900">Ajouter un client</p>
              <p className="text-sm text-emerald-700">Créer un nouveau profil client</p>
            </button>
            <button onClick={() => router.push('/appointments')} className="p-4 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-left transition-colors">
              <p className="font-medium text-emerald-900">Planifier un rendez-vous</p>
              <p className="text-sm text-emerald-700">Ajouter un nouveau rendez-vous</p>
            </button>
            <button onClick={() => router.push('/invoices')} className="p-4 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-left transition-colors">
              <p className="font-medium text-emerald-900">Créer une facture</p>
              <p className="text-sm text-emerald-700">Générer un document de facturation</p>
            </button>
            <button onClick={() => router.push('/session-notes')} className="p-4 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-left transition-colors">
              <p className="font-medium text-emerald-900">Ajouter une note de session</p>
              <p className="text-sm text-emerald-700">Documenter une nouvelle session</p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
