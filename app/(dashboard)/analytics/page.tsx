'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { appointments, invoices, clients } from '../../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { AlertCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChartData {
  appointmentsTrend: any[];
  revenueTrend: any[];
  appointmentStatus: any[];
  serviceDistribution: any[];
}

export default function AnalyticsPage() {
  const [chartData, setChartData] = useState<ChartData>({
    appointmentsTrend: [],
    revenueTrend: [],
    appointmentStatus: [],
    serviceDistribution: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading && isAuthenticated) {
      loadAnalyticsData();
    }
  }, [isAuthenticated, authLoading, router]);

  async function loadAnalyticsData() {
    try {
      setIsLoading(true);

      const [appointmentsRes, invoicesRes, clientsRes] = await Promise.all([
        appointments.getAll(),
        invoices.getAll(),
        clients.getAll(),
      ]);

      const appointmentsList = appointmentsRes.success ? appointmentsRes.data?.appointments || [] : [];
      const invoicesList = invoicesRes.success ? invoicesRes.data?.invoices || [] : [];

      // Prepare appointments trend data (last 7 days)
      const appointmentsTrend = generateLast7DaysTrend(appointmentsList);

      // Prepare revenue trend data
      const revenueTrend = generateRevenueTrend(invoicesList);

      // Appointment status distribution
      const statusCount = {
        scheduled: appointmentsList.filter((a: any) => a.status === 'scheduled').length,
        completed: appointmentsList.filter((a: any) => a.status === 'completed').length,
        cancelled: appointmentsList.filter((a: any) => a.status === 'cancelled').length,
        noshow: appointmentsList.filter((a: any) => a.status === 'no-show').length,
      };

      const appointmentStatus = [
        { name: 'Planifiés', value: statusCount.scheduled, color: '#059669' },
        { name: 'Terminés', value: statusCount.completed, color: '#10b981' },
        { name: 'Annulés', value: statusCount.cancelled, color: '#ef4444' },
        { name: 'Absent', value: statusCount.noshow, color: '#f59e0b' },
      ];

      // Service distribution
      const serviceCount: { [key: string]: number } = {};
      appointmentsList.forEach((apt: any) => {
        const serviceName = apt.service?.name || 'Unknown';
        serviceCount[serviceName] = (serviceCount[serviceName] || 0) + 1;
      });

      const serviceDistribution = Object.entries(serviceCount).map(([name, count]) => ({
        name,
        value: count,
      }));

      setChartData({
        appointmentsTrend,
        revenueTrend,
        appointmentStatus,
        serviceDistribution,
      });
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement des données d\'analytique');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  function generateLast7DaysTrend(appointments: any[]) {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });

      const count = appointments.filter((apt: any) => {
        const aptDate = new Date(apt.startTime).toLocaleDateString();
        return aptDate === date.toLocaleDateString();
      }).length;

      data.push({
        date: dateStr,
        appointments: count,
      });
    }
    return data;
  }

  function generateRevenueTrend(invoices: any[]) {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });

      const revenue = invoices
        .filter((inv: any) => {
          const invDate = new Date(inv.createdAt).toLocaleDateString();
          return invDate === date.toLocaleDateString() && inv.status === 'paid';
        })
        .reduce((sum: number, inv: any) => sum + inv.total, 0);

      data.push({
        date: dateStr,
        revenue: Math.round(revenue),
      });
    }
    return data;
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytique</h1>
        <p className="text-gray-600 mt-1">Insights détaillés et métriques de performance</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Appointments Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Tendance des rendez-vous (7 derniers jours)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData.appointmentsTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="appointments"
                stroke="#059669"
                strokeWidth={2}
                dot={{ fill: '#059669', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Tendance des revenus (7 derniers jours)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData.revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Appointment Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition du statut des rendez-vous</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={chartData.appointmentStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.appointmentStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
