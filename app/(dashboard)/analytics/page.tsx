'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { appointments, expenses } from '../../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { AlertCircle } from 'lucide-react';
import {
  AreaChart,
  Area,
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

      const [appointmentsRes, expensesRes] = await Promise.all([
        appointments.getAll(),
        expenses.getAll(),
      ]);

      const appointmentsList = appointmentsRes.success ? appointmentsRes.data?.appointments || [] : [];
      const expensesList = expensesRes.success ? expensesRes.data?.expenses || [] : [];

      // Prepare appointments trend data (last 7 days)
      const appointmentsTrend = generateLast7DaysTrend(appointmentsList);

      // Prepare revenue trend data
      const revenueTrend = generateRevenueTrend(expensesList);

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

  function generateRevenueTrend(expenses: any[]) {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });

      const revenue = expenses
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
              <AreaChart key={`appointments-${chartData.appointmentsTrend.length}`} data={chartData.appointmentsTrend}>
                <defs>
                  <linearGradient id="aptTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Area
                  type="monotone"
                  dataKey="appointments"
                  name="Rendez-vous"
                  stroke="#059669"
                  strokeWidth={2}
                  fill="url(#aptTrendGradient)"
                  dot={{ fill: '#059669', r: 4 }}
                  activeDot={{ r: 6, fill: '#059669' }}
                  isAnimationActive={true}
                  animationDuration={2000}
                  animationEasing="ease-in-out"
                />
            </AreaChart>
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
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={1} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Legend />
                <Bar dataKey="revenue" fill="url(#revenueGradient)" radius={[4, 4, 0, 0]} />
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
                <defs>
                  <radialGradient id="analyticsPieGrad0" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#166534" stopOpacity={1} /><stop offset="100%" stopColor="#14532d" stopOpacity={0.8} /></radialGradient>
                  <radialGradient id="analyticsPieGrad1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#059669" stopOpacity={1} /><stop offset="100%" stopColor="#047857" stopOpacity={0.8} /></radialGradient>
                  <radialGradient id="analyticsPieGrad2" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ef4444" stopOpacity={1} /><stop offset="100%" stopColor="#dc2626" stopOpacity={0.8} /></radialGradient>
                  <radialGradient id="analyticsPieGrad3" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#f59e0b" stopOpacity={1} /><stop offset="100%" stopColor="#d97706" stopOpacity={0.8} /></radialGradient>
                </defs>
                <Pie
                  data={chartData.appointmentStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.appointmentStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#analyticsPieGrad${index})`} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value}`, '']} />
                <text x="50%" y="48%" textAnchor="middle" fill="#166534" fontSize={24} fontWeight="bold" dominantBaseline="middle">
                  {chartData.appointmentStatus.reduce((sum, s) => sum + s.value, 0)}
                </text>
                <text x="50%" y="58%" textAnchor="middle" fill="#6b7280" fontSize={12} dominantBaseline="middle">
                  total
                </text>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
