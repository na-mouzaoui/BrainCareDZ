'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState, useRef } from 'react';
import { appointments, patients, payments, expenses } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Calendar, Wallet, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LabelList,
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

interface MonthlyPatientPoint {
  month: string;
  patients: number;
}

interface MonthlyAppointmentPoint {
  month: string;
  fixed: number;
  attended: number;
}

function AnimatedCounter({ value, suffix = '', decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);
  const startTime = useRef<number>(0);
  const duration = 1200;

  useEffect(() => {
    startTime.current = performance.now();
    ref.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ref.current);
  }, [value]);

  function animate(time: number) {
    const elapsed = time - startTime.current;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    setDisplay(Math.round(value * eased * Math.pow(10, decimals)) / Math.pow(10, decimals));
    if (progress < 1) {
      ref.current = requestAnimationFrame(animate);
    }
  }

  return <>{display.toFixed(decimals)}{suffix}</>;
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
  const [monthlyPatientsTrend, setMonthlyPatientsTrend] = useState<MonthlyPatientPoint[]>([]);
  const [monthlyAppointmentsTrend, setMonthlyAppointmentsTrend] = useState<MonthlyAppointmentPoint[]>([]);
  const [referralSources, setReferralSources] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }

    if (!isLoading && isAuthenticated) {
      void loadDashboardStats();
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const handleFocus = () => { void loadDashboardStats(); };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isAuthenticated]);

  async function loadDashboardStats() {
    try {
      const [patientsResponse, appointmentsResponse, paymentsResponse, expensesResponse] = await Promise.all([
        patients.getAll(),
        appointments.getAll(),
        payments.getAll(),
        expenses.getAll(),
      ]);

      let patientItems: any[] = [];
      let appointmentItems: any[] = [];
      let paymentItems: any[] = [];
      let expenseItems: any[] = [];

      if (patientsResponse.success && patientsResponse.data) {
        patientItems = Array.isArray(patientsResponse.data) 
          ? patientsResponse.data 
          : patientsResponse.data.patients || [];
      }

      if (appointmentsResponse.success && appointmentsResponse.data) {
        appointmentItems = Array.isArray(appointmentsResponse.data)
          ? appointmentsResponse.data
          : appointmentsResponse.data.appointments || [];
      }

      if (paymentsResponse.success && paymentsResponse.data) {
        paymentItems = Array.isArray(paymentsResponse.data)
          ? paymentsResponse.data
          : paymentsResponse.data.payments || [];
      }

      if (expensesResponse.success && expensesResponse.data) {
        expenseItems = Array.isArray(expensesResponse.data)
          ? expensesResponse.data
          : expensesResponse.data.expenses || [];
      }

      console.log('patientItems:', patientItems.length);
      console.log('appointmentItems:', appointmentItems.length);
      console.log('paymentItems:', paymentItems.length);

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

      const monthlyExpenses = expenseItems
        .filter((expense) => {
          const date = expense.expenseDate || expense.createdAt;
          return isInCurrentMonth(date);
        })
        .reduce((total, expense) => total + Math.abs(Number(expense.amount || 0)), 0);

      const newPatientsMonth = patientItems.filter((patient) => {
        const createdAt = new Date(patient.createdAt || '');
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

const monthlyPatients = months.map((m) => {
        const count = patientItems.filter((patient) => {
          const created = new Date(patient.createdAt || '');
          return created.getFullYear() === m.year && created.getMonth() === m.month;
        }).length;
        return {
          month: m.monthLabel,
          patients: count,
        };
      });

      const monthlyAppointments = months.map((m) => {
        const fixed = appointmentItems.filter((apt) => {
          const start = new Date(apt.startTime || '');
          return start.getFullYear() === m.year && start.getMonth() === m.month && apt.status === 'scheduled';
        }).length;
        const attended = appointmentItems.filter((apt) => {
          const start = new Date(apt.startTime || '');
          return start.getFullYear() === m.year && start.getMonth() === m.month && apt.status === 'completed';
        }).length;
        return {
          month: m.monthLabel,
          fixed,
          attended,
        };
      });

      setStats({
        monthlyRevenue,
        monthlyExpenses,
        monthlyNetProfit,
        todayAppointments,
        newPatientsMonth,
      });
      setMonthlyPatientsTrend(monthlyPatients);
      setMonthlyAppointmentsTrend(monthlyAppointments);

      const sources: Record<string, number> = {};
      patientItems.forEach((p) => {
        const source = p.sourceOfAcquisition || 'Non renseigné';
        sources[source] = (sources[source] || 0) + 1;
      });
      setReferralSources(
        Object.entries(sources).map(([name, value]) => ({ name, value }))
      );
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
      setStats({
        monthlyRevenue: 0,
        monthlyExpenses: 0,
        monthlyNetProfit: 0,
        todayAppointments: 0,
        newPatientsMonth: 0,
      });
      setMonthlyPatientsTrend([]);
      setMonthlyAppointmentsTrend([]);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pt-6">
        <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
      </div>

      {/* Stats + Sources */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Card className="py-1.5">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 px-3 py-1.5">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires du mois (DZD)</CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-brand-600 mt-0.5 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-2 pt-0">
            <div className="text-lg font-bold"><AnimatedCounter value={stats.monthlyRevenue} decimals={2} /></div>
          </CardContent>
        </Card>

        <Card className="py-1.5">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 px-3 py-1.5">
            <CardTitle className="text-sm font-medium">Dépenses du mois (DZD)</CardTitle>
            <Wallet className="h-3.5 w-3.5 text-brand-600 mt-0.5 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-2 pt-0">
            <div className="text-lg font-bold"><AnimatedCounter value={stats.monthlyExpenses} decimals={2} /></div>
          </CardContent>
        </Card>

        <Card className="py-1.5">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 px-3 py-1.5">
            <CardTitle className="text-sm font-medium">Bénéfice net (DZD)</CardTitle>
            <TrendingUp className="h-3.5 w-3.5 text-brand-600 mt-0.5 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-2 pt-0">
            <div className="text-lg font-bold"><AnimatedCounter value={stats.monthlyNetProfit} decimals={2} /></div>
          </CardContent>
        </Card>

        <Card className="py-1.5">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 px-3 py-1.5">
            <CardTitle className="text-sm font-medium">RDV aujourd'hui</CardTitle>
            <Calendar className="h-3.5 w-3.5 text-brand-600 mt-0.5 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-2 pt-0">
            <div className="text-lg font-bold"><AnimatedCounter value={stats.todayAppointments} /></div>
          </CardContent>
        </Card>
          </div>
        </div>

        <div className="w-full md:w-1/2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Sources d'acquisition des patients</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260} style={{ overflow: 'visible' }}>
                <PieChart>
                  <defs>
                    <radialGradient id="pieGrad0" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#0E4D4B" stopOpacity={1} /><stop offset="100%" stopColor="#0A3634" stopOpacity={0.8} /></radialGradient>
                    <radialGradient id="pieGrad1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#126562" stopOpacity={1} /><stop offset="100%" stopColor="#0E4D4B" stopOpacity={0.8} /></radialGradient>
                    <radialGradient id="pieGrad2" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#167D79" stopOpacity={1} /><stop offset="100%" stopColor="#126562" stopOpacity={0.8} /></radialGradient>
                    <radialGradient id="pieGrad3" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#40A09C" stopOpacity={1} /><stop offset="100%" stopColor="#167D79" stopOpacity={0.8} /></radialGradient>
                    <radialGradient id="pieGrad4" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#6BBBB8" stopOpacity={1} /><stop offset="100%" stopColor="#40A09C" stopOpacity={0.8} /></radialGradient>
                    <radialGradient id="pieGrad5" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#95D5D2" stopOpacity={1} /><stop offset="100%" stopColor="#6BBBB8" stopOpacity={0.8} /></radialGradient>
                    <radialGradient id="pieGrad6" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#0E4D4B" stopOpacity={1} /><stop offset="100%" stopColor="#0E4D4B" stopOpacity={0.8} /></radialGradient>
                    <radialGradient id="pieGrad7" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#061E1D" stopOpacity={1} /><stop offset="100%" stopColor="#0A3634" stopOpacity={0.8} /></radialGradient>
                  </defs>
                  <Pie
                    data={referralSources}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    isAnimationActive={true}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  >
                    {referralSources.map((_, index) => (
                      <Cell key={index} fill={`url(#pieGrad${index % 8})`} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="inside"
                      formatter={(value: number) => {
                        const total = referralSources.reduce((s, v) => s + v.value, 0);
                        return total > 0 ? `${((value / total) * 100).toFixed(0)}%` : '0%';
                      }}
                      fill="#fff"
                      fontSize={12}
                      fontWeight={500}
                    />
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} patient${value > 1 ? 's' : ''}`, name]}
                    contentStyle={{ backgroundColor: '#0A3634', border: '1px solid #0E4D4B', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.875rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    labelStyle={{ color: '#fff', fontWeight: 500 }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" dy="-0.1em" fontSize={28} className="font-bold" fill="#0E4D4B">
                    {referralSources.reduce((sum, s) => sum + s.value, 0)}
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Evolution du nombre de patients par mois</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart key={`patients-${monthlyPatientsTrend.length}`} data={monthlyPatientsTrend}>
                <defs>
                  <linearGradient id="patientGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#126562" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#126562" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Area
                  type="monotone"
                  dataKey="patients"
                  name="Nouveaux patients"
                  stroke="#126562"
                  strokeWidth={2}
                  fill="url(#patientGradient)"
                  dot={{ fill: '#126562', r: 3 }}
                  activeDot={{ r: 5, fill: '#126562' }}
                  isAnimationActive={true}
                  animationDuration={2000}
                  animationEasing="ease-in-out"
                />
              </AreaChart>
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
                <defs>
                  <linearGradient id="fixedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#167D79" stopOpacity={1} />
                    <stop offset="95%" stopColor="#167D79" stopOpacity={0.5} />
                  </linearGradient>
                  <linearGradient id="attendedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#167D79" stopOpacity={1} />
                    <stop offset="95%" stopColor="#167D79" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Legend />
                <Bar dataKey="fixed" name="RDV fixés" fill="url(#fixedGradient)" stackId="rdv" radius={[4, 4, 0, 0]} animationBegin={0} animationDuration={600} />
                <Bar dataKey="attended" name="Patients venus" fill="url(#attendedGradient)" stackId="rdv" radius={[4, 4, 0, 0]} animationBegin={600} animationDuration={600} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
