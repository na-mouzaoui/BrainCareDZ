'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import { appointments, clients, payments } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, Calendar, Wallet, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface DashboardStats {
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyNetProfit: number;
  todayAppointments: number;
  newPatientsMonth: number;
}

interface MonthlyClientPoint {
  month: string;
  clients: number;
}

interface MonthlyAppointmentPoint {
  month: string;
  fixed: number;
  attended: number;
}

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    monthlyRevenue: 0,
    monthlyExpenses: 0,
    monthlyNetProfit: 0,
    todayAppointments: 0,
    newPatientsMonth: 0,
  });
  const [monthlyClientsTrend, setMonthlyClientsTrend] = useState<MonthlyClientPoint[]>([]);
  const [monthlyAppointmentsTrend, setMonthlyAppointmentsTrend] = useState<MonthlyAppointmentPoint[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }

    if (!isLoading && isAuthenticated) {
      void loadDashboardStats();
    }
  }, [isAuthenticated, isLoading, router]);

  async function loadDashboardStats() {
    try {
      const [clientsResponse, appointmentsResponse, paymentsResponse] = await Promise.all([
        clients.getAll(),
        appointments.getAll(),
        payments.getAll(),
      ]);

      const clientsData = clientsResponse.data as any;
      const appointmentsData = appointmentsResponse.data as any;
      const paymentsData = paymentsResponse.data as any;

      const clientItems = Array.isArray(clientsData)
        ? clientsData
        : clientsData?.clients || clientsData?.data?.clients || [];

      const appointmentItems = Array.isArray(appointmentsData)
        ? appointmentsData
        : appointmentsData?.appointments || appointmentsData?.data?.appointments || [];

      const paymentItems = Array.isArray(paymentsData)
        ? paymentsData
        : paymentsData?.payments || paymentsData?.data?.payments || [];

      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const month = now.getMonth();
      const year = now.getFullYear();

      const todayAppointments = appointmentItems.filter((item) => {
        const start = new Date(item.startTime);
        return (
          (item.status === 'scheduled' || item.status === 'completed') &&
          start >= startOfToday &&
          start <= endOfToday
        );
      }).length;

      const isInCurrentMonth = (value?: string) => {
        if (!value) return false;
        const date = new Date(value);
        return date.getFullYear() === year && date.getMonth() === month;
      };

      const monthlyRevenue = paymentItems
        .filter((payment) => {
          const amount = Number(payment.amount || 0);
          const paymentDate = payment.processedDate || payment.createdAt;
          return payment.status === 'completed' && amount > 0 && isInCurrentMonth(paymentDate);
        })
        .reduce((total, payment) => total + Number(payment.amount || 0), 0);

      const monthlyExpenses = Math.abs(
        paymentItems
          .filter((payment) => {
            const amount = Number(payment.amount || 0);
            const paymentDate = payment.processedDate || payment.createdAt;
            return amount < 0 && isInCurrentMonth(paymentDate);
          })
          .reduce((total, payment) => total + Number(payment.amount || 0), 0)
      );

      const newPatientsMonth = clientItems.filter((client) => {
        const createdAt = new Date(client.createdAt || '');
        return createdAt >= startOfMonth && createdAt <= endOfMonth;
      }).length;

      const monthlyNetProfit = monthlyRevenue - monthlyExpenses;

      const months = Array.from({ length: 12 }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
        const monthLabel = date.toLocaleDateString('fr-FR', { month: 'short' });
        return {
          monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          month: date.getMonth(),
          year: date.getFullYear(),
        };
      });

      const monthlyClients = months.map((m) => {
        const count = clientItems.filter((client) => {
          const created = new Date(client.createdAt || '');
          return created.getFullYear() === m.year && created.getMonth() === m.month;
        }).length;
        return {
          month: m.monthLabel,
          clients: count,
        };
      });

      const monthlyAppointments = months.map((m) => {
        const appointmentsForMonth = appointmentItems.filter((appointment) => {
          const start = new Date(appointment.startTime || '');
          return start.getFullYear() === m.year && start.getMonth() === m.month;
        });

        const fixedCount = appointmentsForMonth.filter((appointment) => {
          const status = appointment.status;
          return ['scheduled', 'completed', 'cancelled', 'no-show'].includes(status);
        }).length;

        const attendedCount = appointmentsForMonth.filter((appointment) => appointment.status === 'completed').length;

        return {
          month: m.monthLabel,
          fixed: fixedCount,
          attended: attendedCount,
        };
      });

      setStats({
        monthlyRevenue,
        monthlyExpenses,
        monthlyNetProfit,
        todayAppointments,
        newPatientsMonth,
      });
      setMonthlyClientsTrend(monthlyClients);
      setMonthlyAppointmentsTrend(monthlyAppointments);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
      setStats({
        monthlyRevenue: 0,
        monthlyExpenses: 0,
        monthlyNetProfit: 0,
        todayAppointments: 0,
        newPatientsMonth: 0,
      });
      setMonthlyClientsTrend([]);
      setMonthlyAppointmentsTrend([]);
    }
  }

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires du mois</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.monthlyRevenue.toFixed(2)} DZD</div>
            <p className="text-xs text-gray-600 mt-1">Encaissements du mois</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dépenses du mois</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.monthlyExpenses.toFixed(2)} DZD</div>
            <p className="text-xs text-gray-600 mt-1">Sorties du mois</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bénéfice net</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.monthlyNetProfit.toFixed(2)} DZD</div>
            <p className="text-xs text-gray-600 mt-1">Automatique (CA - Dépenses)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RDV aujourd'hui</CardTitle>
            <Calendar className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayAppointments}</div>
            <p className="text-xs text-gray-600 mt-1">Planifiés et terminés</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nouveaux patients (mois)</CardTitle>
            <Users className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newPatientsMonth}</div>
            <p className="text-xs text-gray-600 mt-1">Créés ce mois</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Evolution du nombre de clients par mois</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyClientsTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="clients"
                  name="Nouveaux clients"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={{ fill: '#059669', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>RDV fixés vs patients venus (par mois)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyAppointmentsTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="fixed" name="RDV fixés" fill="#0f766e" stackId="rdv" />
                <Bar dataKey="attended" name="Patients venus" fill="#10b981" stackId="rdv" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
