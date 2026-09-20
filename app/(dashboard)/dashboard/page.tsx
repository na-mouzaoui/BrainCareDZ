'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState, useRef, useMemo } from 'react';
import { appointments, patients, payments, patientPacks, sessionNotes as sessionNotesApi, waitingList as waitingListApi, expenses as expensesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, Calendar as CalendarIcon, Users, TrendingUp, Wallet, AlertCircle, Clock, UserPlus, UserMinus, Baby, Brain, ChevronRight, ChevronLeft } from 'lucide-react';
import { DashboardSkeleton } from '@/components/page-skeletons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';

const PALETTE = ['#126562', '#40A09C', '#6BBBB8', '#0E4D4B', '#167D79', '#95D5D2'];

function OverlayBar(props: any) {
  const { x, y, width, height, payload, fixedKey, completedKey } = props;
  const fixedVal = payload?.[fixedKey] || 0;
  const completedVal = payload?.[completedKey] || 0;
  const completedH = fixedVal > 0 ? (height * completedVal) / fixedVal : 0;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill="#95D5D2" rx={4} ry={4} />
      <rect x={x} y={y + height - completedH} width={width} height={completedH} fill="#0E4D4B" rx={4} ry={4} />
    </g>
  );
}

function AnimatedCounter({ value, suffix = '', decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const start = performance.now();
    const duration = 1200;
    let cancelled = false;

    function animate(time: number) {
      if (cancelled) return;
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(valueRef.current * eased * Math.pow(10, decimals)) / Math.pow(10, decimals));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => { cancelled = true; cancelAnimationFrame(rafRef.current); };
  }, [value, decimals]);

  const formatted = display.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return <>{formatted}{suffix}</>;
}

interface KpiTile {
  id: string;
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  icon: React.ReactNode;
  secondary?: string;
  selectValue?: string;
  onSelectChange?: (value: string) => void;
  tooltip?: string;
  dateValue?: string;
  onDateChange?: (value: string) => void;
}

function KpiCard({ tile }: { tile: KpiTile }) {
  const hasDate = tile.dateValue !== undefined && tile.onDateChange;

  const cardContent = (
    <Card className="py-1.5 cursor-default">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 px-3 py-1.5">
        <CardTitle className="text-xs font-medium leading-tight">{tile.label}</CardTitle>
        {tile.icon}
      </CardHeader>
      <CardContent className="px-3 pb-2 pt-0">
        <div className="text-lg font-bold">
          <AnimatedCounter value={tile.value} decimals={tile.decimals || 0} suffix={tile.suffix || ''} />
        </div>
        {hasDate ? (
          <input
            type="date"
            value={tile.dateValue}
            onChange={(e) => tile.onDateChange!(e.target.value)}
            className="text-xs text-muted-foreground mt-0.5 border-0 bg-transparent p-0 h-auto cursor-pointer focus:ring-0 focus-visible:ring-0 w-full"
          />
        ) : tile.selectValue && tile.onSelectChange ? (
          <Select value={tile.selectValue} onValueChange={tile.onSelectChange}>
            <SelectTrigger className="h-5 text-xs w-full mt-0.5 border-0 bg-transparent px-1 py-0 text-muted-foreground hover:text-foreground focus:ring-0 focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="day">Aujourd'hui</SelectItem>
            </SelectContent>
          </Select>
        ) : tile.secondary ? (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{tile.secondary}</p>
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {cardContent}
      </TooltipTrigger>
      {tile.tooltip && (
        <TooltipContent side="bottom" className="max-w-xs whitespace-pre-line">
          {tile.tooltip}
        </TooltipContent>
      )}
    </Tooltip>
  );
}

interface DashboardData {
  monthlyRevenue: number;
  dailyRevenue: number;
  packsMonth: number;
  packsDay: number;
  sessionsMonth: number;
  sessionsDay: number;
  cancellationsMonth: number;
  cancellationsDay: number;
  psyConsultMonth: number;
  psyWaiting: number;
  newClientsMonth: number;
  newClientsDay: number;
  maleCount: number;
  femaleCount: number;
  childrenCount: number;
  outstandingCount: number;
  outstandingTotal: number;
  expensesMonth: number;
  revenueMonthDetail: string;
  revenueDayDetail: string;
  packsMonthDetail: string;
  packsDayDetail: string;
  sessionsMonthDetail: string;
  sessionsDayDetail: string;
  cancellationsMonthDetail: string;
  cancellationsDayDetail: string;
  psyConsultDetail: string;
  psyWaitingDetail: string;
  newClientsMonthDetail: string;
  newClientsDayDetail: string;
  outstandingDetail: string;
  prospectsCount: number;
  prospectsConvertedMonth: number;
  prospectsDetail: string;
  prospectsConvertedDetail: string;
}

const emptyData: DashboardData = {
  monthlyRevenue: 0, dailyRevenue: 0,
  packsMonth: 0, packsDay: 0,
  sessionsMonth: 0, sessionsDay: 0,
  cancellationsMonth: 0, cancellationsDay: 0,
  psyConsultMonth: 0, psyWaiting: 0,
  newClientsMonth: 0, newClientsDay: 0,
  maleCount: 0, femaleCount: 0, childrenCount: 0,
  outstandingCount: 0, outstandingTotal: 0,
  expensesMonth: 0,
  revenueMonthDetail: '', revenueDayDetail: '',
  packsMonthDetail: '', packsDayDetail: '',
  sessionsMonthDetail: '', sessionsDayDetail: '',
  cancellationsMonthDetail: '', cancellationsDayDetail: '',
  psyConsultDetail: '', psyWaitingDetail: '',
  newClientsMonthDetail: '', newClientsDayDetail: '',
  outstandingDetail: '',
  prospectsCount: 0, prospectsConvertedMonth: 0,
  prospectsDetail: 'Aucun prospect',
  prospectsConvertedDetail: 'Aucune conversion',
};

export default function DashboardPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData>(emptyData);
  const [carouselPage, setCarouselPage] = useState(0);
  const [tileToggles, setTileToggles] = useState<Record<string, boolean>>({});

  const toggleTile = (key: string) => {
    setTileToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [referralSources, setReferralSources] = useState<{ name: string; value: number }[]>([]);
  const [chartBarPage, setChartBarPage] = useState(0);
  const [monthlyPractitionerData, setMonthlyPractitionerData] = useState<Record<string, string | number>[]>([]);
  const [practitionerNames, setPractitionerNames] = useState<string[]>([]);
  const [rawNotes, setRawNotes] = useState<any[]>([]);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<'all' | 'psy' | 'neurofeedback'>('all');
  const [monthlyPatientsTrend, setMonthlyPatientsTrend] = useState<{ month: string; patients: number }[]>([]);
  const [monthlyAppointmentsTrend, setMonthlyAppointmentsTrend] = useState<{ month: string; scheduled: number; completed: number }[]>([]);
  const [monthlyActivePatients, setMonthlyActivePatients] = useState<{ month: string; patients: number }[]>([]);
  const [rawAppointments, setRawAppointments] = useState<any[]>([]);
  const overcrowdingRef = useRef<Record<string, Record<string, number>>>({});
  const ocMonthsRef = useRef<string[]>([]);
  const overflowSlotsRef = useRef<Record<string, Record<string, Set<string>>>>({});
  const [neuroDate, setNeuroDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [psyDate, setPsyDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  interface PracPatient {
    firstName: string;
    lastName: string;
    appointmentId: string;
    startTime: string;
    serviceName: string;
  }
  const [practitionerPatients, setPractitionerPatients] = useState<Record<string, Record<string, PracPatient[]>>>({});
  const [pracPatientsOpen, setPracPatientsOpen] = useState(false);
  const [pracPatientsTitle, setPracPatientsTitle] = useState('');
  const [pracPatientsList, setPracPatientsList] = useState<PracPatient[]>([]);
  const [pracPatientsPage, setPracPatientsPage] = useState(0);
  const [pracPatientsOC, setPracPatientsOC] = useState<string[]>([]);

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

  const isSameDay = (iso: string, dateStr: string) => {
    if (!iso) return false;
    const d = new Date(iso);
    const [y, m, d2] = dateStr.split('-').map(Number);
    return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === d2;
  };

  const neuroDayCount = useMemo(() =>
    rawAppointments.filter((apt: any) =>
      apt.status !== 'completed' && apt.status !== 'cancelled' && isSameDay(apt.startTime, neuroDate) && apt.serviceType === 'neurofeedback'
    ).length,
    [rawAppointments, neuroDate]
  );

  const psyDayCount = useMemo(() =>
    rawAppointments.filter((apt: any) =>
      apt.status !== 'completed' && apt.status !== 'cancelled' && isSameDay(apt.startTime, psyDate) && apt.practitionerRole === 'psy'
    ).length,
    [rawAppointments, psyDate]
  );

  const psyDayDetail = useMemo(() => {
    const map: Record<string, number> = {};
    rawAppointments.filter((apt: any) =>
      apt.status !== 'completed' && apt.status !== 'cancelled' && isSameDay(apt.startTime, psyDate) && apt.practitionerRole === 'psy'
    ).forEach((apt: any) => {
      const name = apt.practitionerName || 'Non assigné';
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => `${name}: ${count}`).join('\n') || 'Aucun RDV restant';
  }, [rawAppointments, psyDate]);

  const neuroDayDetail = useMemo(() => {
    const map: Record<string, number> = {};
    rawAppointments.filter((apt: any) =>
      apt.status !== 'completed' && apt.status !== 'cancelled' && isSameDay(apt.startTime, neuroDate) && apt.serviceType === 'neurofeedback'
    ).forEach((apt: any) => {
      const name = apt.practitionerName || 'Non assigné';
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => `${name}: ${count}`).join('\n') || 'Aucun RDV restant';
  }, [rawAppointments, neuroDate]);

  const { filteredPractitionerData, filteredPractitionerNames, filteredPractitionerPatients } = useMemo(() => {
    const now = new Date();
    const months12 = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
      const monthLabel = date.toLocaleDateString('fr-FR', { month: 'short' });
      return {
        month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        m: date.getMonth(),
        y: date.getFullYear(),
      };
    });

    const filtered = rawNotes.filter((note: any) => {
      if (serviceTypeFilter === 'all') return true;
      return note.serviceType === serviceTypeFilter;
    });

    const pNames = new Set<string>();
    const pMonthMap: Record<string, Record<string, number>> = {};
    months12.forEach((m) => { pMonthMap[m.month] = {}; });
    filtered.forEach((note: any) => {
      const d = new Date(note.createdAt || note.appointmentStartTime);
      const mKey = months12.find((m) => d.getMonth() === m.m && d.getFullYear() === m.y)?.month;
      if (!mKey) return;
      const name = note.practitionerName || 'Inconnu';
      pNames.add(name);
      pMonthMap[mKey][name] = (pMonthMap[mKey][name] || 0) + 1;
    });
    const pNameList = Array.from(pNames).sort();

    const pPatientsMap: Record<string, Record<string, PracPatient[]>> = {};
    months12.forEach((m) => { pPatientsMap[m.month] = {}; });
    filtered.forEach((note: any) => {
      const d = new Date(note.createdAt || note.appointmentStartTime);
      const mKey = months12.find((m2) => d.getMonth() === m2.m && d.getFullYear() === m2.y)?.month;
      if (!mKey) return;
      const name = note.practitionerName || 'Inconnu';
      if (!pPatientsMap[mKey][name]) pPatientsMap[mKey][name] = [];
      pPatientsMap[mKey][name].push({
        firstName: note.patientFirstName || '',
        lastName: note.patientLastName || '',
        appointmentId: note.appointmentId || '',
        startTime: note.appointmentStartTime || note.createdAt || '',
        serviceName: note.serviceName || '',
      });
    });

    const ocMap: Record<string, Record<string, number>> = {};
    months12.forEach((m) => { ocMap[m.month] = {}; });
    const slotCounts: Record<string, Record<string, number>> = {};
    rawAppointments.forEach((apt: any) => {
      if (apt.status === 'cancelled') return;
      const d = new Date(apt.startTime);
      const mKey = months12.find((m) => d.getMonth() === m.m && d.getFullYear() === m.y)?.month;
      if (!mKey) return;
      const pracName = apt.practitionerName || 'Inconnu';
      const slotKey = `${pracName}__${apt.startTime}`;
      if (!slotCounts[slotKey]) slotCounts[slotKey] = {};
      slotCounts[slotKey][mKey] = (slotCounts[slotKey][mKey] || 0) + 1;
    });
    const overflowSlots: Record<string, Record<string, Set<string>>> = {};
    months12.forEach((m) => { overflowSlots[m.month] = {}; });
    Object.entries(slotCounts).forEach(([slotKey, monthCounts]) => {
      const pracName = slotKey.split('__')[0];
      const startTime = slotKey.split('__').slice(1).join('__');
      Object.entries(monthCounts).forEach(([month, count]) => {
        if (count > 2) {
          ocMap[month][pracName] = (ocMap[month][pracName] || 0) + 1;
          if (!overflowSlots[month][pracName]) overflowSlots[month][pracName] = new Set();
          overflowSlots[month][pracName].add(startTime);
        }
      });
    });

    overcrowdingRef.current = ocMap;
    ocMonthsRef.current = months12.map(m => m.month);
    overflowSlotsRef.current = overflowSlots;

    return {
      filteredPractitionerData: months12.map((m) => {
        const row: Record<string, string | number> = { month: m.month };
        pNameList.forEach((name) => {
          row[name] = pMonthMap[m.month]?.[name] || 0;
        });
        return row;
      }),
      filteredPractitionerNames: pNameList,
      filteredPractitionerPatients: pPatientsMap,
    };
  }, [rawNotes, rawAppointments, serviceTypeFilter]);

  useEffect(() => {
    setPractitionerNames(filteredPractitionerNames);
    setMonthlyPractitionerData(filteredPractitionerData);
    setPractitionerPatients(filteredPractitionerPatients);
  }, [filteredPractitionerNames, filteredPractitionerData, filteredPractitionerPatients]);

  async function loadDashboardStats() {
    try {
      const expensesPromise = user?.role === 'admin'
        ? expensesApi.getAll()
        : Promise.resolve({ success: true, data: [] } as any);

      const [patientsResponse, appointmentsResponse, paymentsResponse, packsResponse, notesResponse, waitingResponse, expensesResponse] = await Promise.all([
        patients.getAll(),
        appointments.getAll(),
        payments.getAll(),
        patientPacks.getAll(),
        sessionNotesApi.getAll(),
        waitingListApi.getAll(),
        expensesPromise,
      ]);

      let patientItems: any[] = [];
      let appointmentItems: any[] = [];
      let paymentItems: any[] = [];
      let packItems: any[] = [];
      let noteItems: any[] = [];

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
      if (packsResponse.success && packsResponse.data) {
        packItems = Array.isArray(packsResponse.data)
          ? packsResponse.data
          : packsResponse.data.packs || [];
      }
      if (notesResponse.success && notesResponse.data) {
        noteItems = Array.isArray(notesResponse.data)
          ? notesResponse.data
          : notesResponse.data.notes || [];
      }

      let waitingItems: any[] = [];
      if (waitingResponse.success && waitingResponse.data) {
        waitingItems = Array.isArray(waitingResponse.data)
          ? waitingResponse.data
          : waitingResponse.data.entries || [];
      }

      let expenseItems: any[] = [];
      if (expensesResponse.success && expensesResponse.data) {
        expenseItems = Array.isArray(expensesResponse.data)
          ? expensesResponse.data
          : expensesResponse.data.expenses || [];
      }

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const month = now.getMonth();
      const year = now.getFullYear();

      const isInCurrentMonth = (value?: string) => {
        if (!value) return false;
        const d = new Date(value);
        return d.getFullYear() === year && d.getMonth() === month;
      };

      const isToday = (value?: string) => {
        if (!value) return false;
        const d = new Date(value);
        return d >= startOfToday && d <= endOfToday;
      };

      // --- Revenue ---
      const monthlyRevenue = paymentItems
        .filter((p: any) => p.status === 'completed' && Number(p.amount || 0) > 0 && isInCurrentMonth(p.processedDate || p.createdAt))
        .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

      const dailyRevenue = paymentItems
        .filter((p: any) => p.status === 'completed' && Number(p.amount || 0) > 0 && isToday(p.processedDate || p.createdAt))
        .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

      // --- Packs vendus (depuis patient_packs, date de création) ---
      const packsMonth = packItems.filter((p: any) => isInCurrentMonth(p.createdAt)).length;
      const packsDay = packItems.filter((p: any) => isToday(p.createdAt)).length;

      // --- Séances effectuées (completed) ---
      const sessionsMonth = appointmentItems.filter((apt: any) =>
        apt.status === 'completed' && isInCurrentMonth(apt.startTime)
      ).length;
      const sessionsDay = appointmentItems.filter((apt: any) =>
        apt.status === 'completed' && isToday(apt.startTime)
      ).length;

      // --- Annulations ---
      const cancellationsMonth = appointmentItems.filter((apt: any) =>
        apt.status === 'cancelled' && isInCurrentMonth(apt.startTime)
      ).length;
      const cancellationsDay = appointmentItems.filter((apt: any) =>
        apt.status === 'cancelled' && isToday(apt.startTime)
      ).length;

      // --- Consultations Psy ---
      const psyConsultMonth = appointmentItems.filter((apt: any) =>
        apt.status === 'completed' && isInCurrentMonth(apt.startTime) && apt.practitionerRole === 'psy'
      ).length;

      // --- Liste d'attente Psy ---
      const psyWaiting = waitingItems.length;

      // --- Nouveaux clients ---
      const newClientsMonth = patientItems.filter((p: any) => isInCurrentMonth(p.createdAt)).length;
      const newClientsDay = patientItems.filter((p: any) => isToday(p.createdAt)).length;

      // --- Prospects ---
      const prospectsCount = patientItems.filter((p: any) => p.isProspect === true).length;
      const prospectsConvertedMonth = patientItems.filter((p: any) => {
        if (p.isProspect !== false) return false;
        const completedApts = appointmentItems.filter((apt: any) =>
          apt.status === 'completed' &&
          Array.isArray(apt.patients) &&
          apt.patients.some((pt: any) => pt.patientId === p.id)
        );
        if (completedApts.length === 0) return false;
        const earliest = completedApts.reduce((min: any, apt: any) =>
          new Date(apt.startTime) < new Date(min.startTime) ? apt : min
        );
        return isInCurrentMonth(earliest.startTime);
      }).length;

      const prospectsDetail = patientItems
        .filter((p: any) => p.isProspect === true)
        .map((p: any) => `${p.firstName} ${p.lastName}`)
        .join('\n') || 'Aucun prospect';

      const prospectsConvertedDetail = patientItems
        .filter((p: any) => {
          if (p.isProspect !== false) return false;
          const completedApts = appointmentItems.filter((apt: any) =>
            apt.status === 'completed' &&
            Array.isArray(apt.patients) &&
            apt.patients.some((pt: any) => pt.patientId === p.id)
          );
          if (completedApts.length === 0) return false;
          const earliest = completedApts.reduce((min: any, apt: any) =>
            new Date(apt.startTime) < new Date(min.startTime) ? apt : min
          );
          return isInCurrentMonth(earliest.startTime);
        })
        .map((p: any) => `${p.firstName} ${p.lastName}`)
        .join('\n') || 'Aucune conversion';

      // --- Dépenses du mois ---
      const expensesMonth = expenseItems
        .filter((e: any) => isInCurrentMonth(e.date || e.createdAt))
        .reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

      // --- Genre / Enfants ---
      const ageFromDob = (dob?: string) => {
        if (!dob) return null;
        const birth = new Date(dob);
        const diff = Date.now() - birth.getTime();
        return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
      };
      // --- Patients ayant complété au moins 1 RDV (par genre/âge) ---
      const completedPatientIds = new Set<string>();
      appointmentItems.forEach((apt: any) => {
        if (apt.status === 'completed') {
          apt.patients?.forEach((p: any) => completedPatientIds.add(p.patientId));
        }
      });
      const completedPatients = patientItems.filter((p: any) => completedPatientIds.has(p.id));

      let femaleAdult = 0;
      let maleAdult = 0;
      let childrenTotal = 0;
      completedPatients.forEach((p: any) => {
        const age = ageFromDob(p.dateOfBirth);
        const g = (p.gender || '').toLowerCase();
        if (age !== null && age < 18) {
          childrenTotal++;
        } else {
          if (g === 'female') femaleAdult++;
          else if (g === 'male') maleAdult++;
        }
      });

      // --- Créances ---
      const negativeBalancePatients = patientItems.filter((p: any) => Number(p.balance || 0) < 0);
      const outstandingCount = negativeBalancePatients.length;
      const outstandingTotal = negativeBalancePatients.reduce(
        (sum: number, p: any) => sum + Math.abs(Number(p.balance || 0)), 0
      );

      // --- Détails pour tooltips ---
      const fmt = (n: number) => n.toLocaleString('fr-FR') + ' DZD';

      // CA du mois — détail par patient
      const revMonthMap: Record<string, number> = {};
      paymentItems.filter((p: any) => p.status === 'completed' && Number(p.amount || 0) > 0 && isInCurrentMonth(p.processedDate || p.createdAt))
        .forEach((p: any) => {
          const name = p.patientFirstName ? `${p.patientFirstName} ${p.patientLastName}` : (p.patientName || 'Inconnu');
          revMonthMap[name] = (revMonthMap[name] || 0) + Number(p.amount || 0);
        });
      const revenueMonthDetail = Object.entries(revMonthMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, amount]) => `${name}: ${fmt(amount)}`)
        .join('\n') || 'Aucune recette';

      // CA du jour — détail par patient
      const revDayMap: Record<string, number> = {};
      paymentItems.filter((p: any) => p.status === 'completed' && Number(p.amount || 0) > 0 && isToday(p.processedDate || p.createdAt))
        .forEach((p: any) => {
          const name = p.patientFirstName ? `${p.patientFirstName} ${p.patientLastName}` : (p.patientName || 'Inconnu');
          revDayMap[name] = (revDayMap[name] || 0) + Number(p.amount || 0);
        });
      const revenueDayDetail = Object.entries(revDayMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, amount]) => `${name}: ${fmt(amount)}`)
        .join('\n') || 'Aucune recette';

      // Packs vendus — détail par service
      const packsMonthMap: Record<string, number> = {};
      packItems.filter((p: any) => isInCurrentMonth(p.createdAt)).forEach((p: any) => {
        const name = p.serviceName || p.name || 'Pack inconnu';
        packsMonthMap[name] = (packsMonthMap[name] || 0) + 1;
      });
      const packsMonthDetail = Object.entries(packsMonthMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `${name}: ${count}`)
        .join('\n') || 'Aucun pack';

      const packsDayMap: Record<string, number> = {};
      packItems.filter((p: any) => isToday(p.createdAt)).forEach((p: any) => {
        const name = p.serviceName || p.name || 'Pack inconnu';
        packsDayMap[name] = (packsDayMap[name] || 0) + 1;
      });
      const packsDayDetail = Object.entries(packsDayMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `${name}: ${count}`)
        .join('\n') || 'Aucun pack';

      // Séances — détail par service
      const sessMonthMap: Record<string, number> = {};
      appointmentItems.filter((apt: any) => apt.status === 'completed' && isInCurrentMonth(apt.startTime)).forEach((apt: any) => {
        const name = apt.serviceName || 'Sans service';
        sessMonthMap[name] = (sessMonthMap[name] || 0) + 1;
      });
      const sessionsMonthDetail = Object.entries(sessMonthMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `${name}: ${count}`)
        .join('\n') || 'Aucune séance';

      const sessDayMap: Record<string, number> = {};
      appointmentItems.filter((apt: any) => apt.status === 'completed' && isToday(apt.startTime)).forEach((apt: any) => {
        const name = apt.serviceName || 'Sans service';
        sessDayMap[name] = (sessDayMap[name] || 0) + 1;
      });
      const sessionsDayDetail = Object.entries(sessDayMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `${name}: ${count}`)
        .join('\n') || 'Aucune séance';

      // Annulations — détail par patient
      const cancMonthMap: Record<string, number> = {};
      appointmentItems.filter((apt: any) => apt.status === 'cancelled' && isInCurrentMonth(apt.startTime)).forEach((apt: any) => {
        const name = apt.patientFirstName ? `${apt.patientFirstName} ${apt.patientLastName}` : (apt.patientName || 'Patient inconnu');
        cancMonthMap[name] = (cancMonthMap[name] || 0) + 1;
      });
      const cancellationsMonthDetail = Object.entries(cancMonthMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `${name}: ${count}`)
        .join('\n') || 'Aucune annulation';

      const cancDayMap: Record<string, number> = {};
      appointmentItems.filter((apt: any) => apt.status === 'cancelled' && isToday(apt.startTime)).forEach((apt: any) => {
        const name = apt.patientFirstName ? `${apt.patientFirstName} ${apt.patientLastName}` : (apt.patientName || 'Patient inconnu');
        cancDayMap[name] = (cancDayMap[name] || 0) + 1;
      });
      const cancellationsDayDetail = Object.entries(cancDayMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `${name}: ${count}`)
        .join('\n') || 'Aucune annulation';

      // Consultations Psy — détail par patient
      const psyMap: Record<string, number> = {};
      appointmentItems.filter((apt: any) => apt.status === 'completed' && isInCurrentMonth(apt.startTime) && apt.practitionerRole === 'psy').forEach((apt: any) => {
        const name = apt.patientFirstName ? `${apt.patientFirstName} ${apt.patientLastName}` : (apt.patientName || 'Patient inconnu');
        psyMap[name] = (psyMap[name] || 0) + 1;
      });
      const psyConsultDetail = Object.entries(psyMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `${name}: ${count}`)
        .join('\n') || 'Aucune consultation';

      // Liste d'attente Psy — détail par patient
      const psyWaitList = waitingItems
        .filter((w: any) => w.practitionerRole === 'psy')
        .map((w: any) => {
          const name = w.patientFirstName ? `${w.patientFirstName} ${w.patientLastName}` : 'Patient inconnu';
          const prac = w.practitionerName || 'Non assigné';
          return `${name} (${prac}) — position ${w.position}`;
        });
      const psyWaitingDetail = psyWaitList.length > 0 ? psyWaitList.join('\n') : 'Aucun patient en attente';

      // Nouveaux clients — détail
      const newMonthMap: Record<string, string> = {};
      patientItems.filter((p: any) => isInCurrentMonth(p.createdAt)).forEach((p: any) => {
        const name = `${p.firstName} ${p.lastName}`;
        const date = new Date(p.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        newMonthMap[name] = date;
      });
      const newClientsMonthDetail = Object.entries(newMonthMap)
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([name, date]) => `${name} (${date})`)
        .join('\n') || 'Aucun nouveau client';

      const newDayMap: Record<string, string> = {};
      patientItems.filter((p: any) => isToday(p.createdAt)).forEach((p: any) => {
        const name = `${p.firstName} ${p.lastName}`;
        const time = new Date(p.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        newDayMap[name] = time;
      });
      const newClientsDayDetail = Object.entries(newDayMap)
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([name, time]) => `${name} (${time})`)
        .join('\n') || 'Aucun nouveau client';

      // Créances — détail par patient
      const outstandingDetail = negativeBalancePatients
        .map((p: any) => `${p.firstName} ${p.lastName}: ${fmt(Math.abs(Number(p.balance || 0)))}`)
        .join('\n') || 'Aucune créance';

      setData({
        monthlyRevenue, dailyRevenue,
        packsMonth, packsDay,
        sessionsMonth, sessionsDay,
        cancellationsMonth, cancellationsDay,
        psyConsultMonth, psyWaiting,
        newClientsMonth, newClientsDay,
        maleCount: maleAdult, femaleCount: femaleAdult, childrenCount: childrenTotal,
        outstandingCount, outstandingTotal,
        expensesMonth,
        revenueMonthDetail, revenueDayDetail,
        packsMonthDetail, packsDayDetail,
        sessionsMonthDetail, sessionsDayDetail,
        cancellationsMonthDetail, cancellationsDayDetail,
        psyConsultDetail, psyWaitingDetail,
        newClientsMonthDetail, newClientsDayDetail,
        outstandingDetail,
        prospectsCount: Number(prospectsCount) || 0,
        prospectsConvertedMonth: Number(prospectsConvertedMonth) || 0,
        prospectsDetail,
        prospectsConvertedDetail,
      });

      setRawAppointments(appointmentItems);

      // --- Charts ---
      const sourceMap: Record<string, number> = {};
      patientItems.forEach((p: any) => {
        const source = p.sourceOfAcquisition || 'Non renseigne';
        sourceMap[source] = (sourceMap[source] || 0) + 1;
      });
      setReferralSources(Object.entries(sourceMap).map(([name, value]) => ({ name, value })));

      const months12 = Array.from({ length: 12 }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
        const monthLabel = date.toLocaleDateString('fr-FR', { month: 'short' });
        return {
          month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          m: date.getMonth(),
          y: date.getFullYear(),
        };
      });

      setMonthlyPatientsTrend(months12.map((m) => ({
        month: m.month,
        patients: patientItems.filter((p: any) => {
          const created = new Date(p.createdAt || '');
          return created.getFullYear() === m.y && created.getMonth() === m.m;
        }).length,
      })));

      setMonthlyAppointmentsTrend(months12.map((m) => ({
        month: m.month,
        scheduled: appointmentItems.filter((apt: any) => {
          const start = new Date(apt.startTime || '');
          return start.getFullYear() === m.y && start.getMonth() === m.m && apt.status === 'scheduled';
        }).length,
        completed: appointmentItems.filter((apt: any) => {
          const start = new Date(apt.startTime || '');
          return start.getFullYear() === m.y && start.getMonth() === m.m && apt.status === 'completed';
        }).length,
      })));

      setMonthlyActivePatients(months12.map((m) => {
        const completedApts = appointmentItems.filter((apt: any) => {
          const start = new Date(apt.startTime || '');
          return start.getFullYear() === m.y && start.getMonth() === m.m && apt.status === 'completed';
        });
        const uniquePatientIds = new Set(completedApts.map((apt: any) => apt.patientIds?.[0] || apt.patientId));
        return { month: m.month, patients: uniquePatientIds.size };
      }));

      // --- Histogramme mensuel par praticien (comptes rendus) ---
      setRawNotes(noteItems);

      // --- Charts ---
      const sourceMap2: Record<string, number> = {};
      patientItems.forEach((p: any) => {
        const source = p.sourceOfAcquisition || 'Non renseigne';
        sourceMap2[source] = (sourceMap2[source] || 0) + 1;
      });
      setReferralSources(Object.entries(sourceMap2).map(([name, value]) => ({ name, value })));
    } catch {
      setData(emptyData);
      setReferralSources([]);
      setMonthlyPatientsTrend([]);
      setMonthlyAppointmentsTrend([]);
      setMonthlyActivePatients([]);
    }
  }

  const kpiTiles = useMemo<KpiTile[]>(() => [
    {
      id: 'revenue',
      label: "Recette du mois",
      value: data.monthlyRevenue,
      icon: <DollarSign className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />,
      secondary: 'DZD',
      tooltip: data.revenueMonthDetail,
    },
    {
      id: 'dailyRevenue',
      label: 'Recettes du jour',
      value: data.dailyRevenue,
      icon: <Wallet className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />,
      secondary: 'DZD',
      tooltip: data.revenueDayDetail,
    },
    {
      id: 'expensesMonth',
      label: 'Dépenses du mois',
      value: data.expensesMonth,
      icon: <TrendingUp className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />,
      secondary: 'DZD',
    },
    {
      id: 'packs',
      label: 'Packs vendus',
      value: tileToggles['packs'] ? data.packsDay : data.packsMonth,
      icon: <TrendingUp className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />,
      selectValue: tileToggles['packs'] ? 'day' : 'month',
      onSelectChange: () => toggleTile('packs'),
      tooltip: tileToggles['packs'] ? data.packsDayDetail : data.packsMonthDetail,
    },
    {
      id: 'sessions',
      label: 'Séances effectuées',
      value: tileToggles['sessions'] ? data.sessionsDay : data.sessionsMonth,
      icon: <CalendarIcon className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />,
      selectValue: tileToggles['sessions'] ? 'day' : 'month',
      onSelectChange: () => toggleTile('sessions'),
      tooltip: tileToggles['sessions'] ? data.sessionsDayDetail : data.sessionsMonthDetail,
    },
    {
      id: 'cancellations',
      label: 'Annulations',
      value: tileToggles['cancellations'] ? data.cancellationsDay : data.cancellationsMonth,
      icon: <AlertCircle className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />,
      selectValue: tileToggles['cancellations'] ? 'day' : 'month',
      onSelectChange: () => toggleTile('cancellations'),
      tooltip: tileToggles['cancellations'] ? data.cancellationsDayDetail : data.cancellationsMonthDetail,
    },
    {
      id: 'psyConsult',
      label: 'Consultations Psy',
      value: data.psyConsultMonth,
      icon: <Brain className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />,
      secondary: 'ce mois',
      tooltip: data.psyConsultDetail,
    },
    {
      id: 'neuroDay',
      label: 'Séances restantes aujourd\'hui (Neuro)',
      value: neuroDayCount,
      icon: <Brain className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />,
      dateValue: neuroDate,
      onDateChange: setNeuroDate,
      tooltip: neuroDayDetail,
    },
    {
      id: 'psyDay',
      label: 'Séances restantes aujourd\'hui (Psy)',
      value: psyDayCount,
      icon: <CalendarIcon className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />,
      dateValue: psyDate,
      onDateChange: setPsyDate,
      tooltip: psyDayDetail,
    },
    {
      id: 'psyWaiting',
      label: "Liste d'attente Psy",
      value: data.psyWaiting,
      icon: <Clock className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />,
      secondary: 'à venir',
      tooltip: data.psyWaitingDetail,
    },
    {
      id: 'newClients',
      label: 'Nouveaux clients',
      value: tileToggles['newClients'] ? data.newClientsDay : data.newClientsMonth,
      icon: <UserPlus className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />,
      selectValue: tileToggles['newClients'] ? 'day' : 'month',
      onSelectChange: () => toggleTile('newClients'),
      tooltip: tileToggles['newClients'] ? data.newClientsDayDetail : data.newClientsMonthDetail,
    },
    {
      id: 'femaleAdult',
      label: 'Femmes majeures',
      value: data.femaleCount,
      icon: <Users className="h-4 w-4 text-pink-500 mt-0.5 shrink-0" />,
      secondary: 'ayant complété ≥1 RDV',
    },
    {
      id: 'maleAdult',
      label: 'Hommes majeurs',
      value: data.maleCount,
      icon: <Users className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />,
      secondary: 'ayant complété ≥1 RDV',
    },
    {
      id: 'children',
      label: 'Enfants / Adolescents',
      value: data.childrenCount,
      icon: <Baby className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />,
      secondary: 'ayant complété ≥1 RDV',
    },
    {
      id: 'outstanding',
      label: 'Créances extérieures',
      value: data.outstandingTotal,
      icon: <Wallet className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />,
      suffix: ' DZD',
      secondary: data.outstandingCount + ' patient' + (data.outstandingCount > 1 ? 's' : ''),
      tooltip: data.outstandingDetail,
    },
    {
      id: 'prospects',
      label: 'Prospects',
      value: data.prospectsCount,
      icon: <UserPlus className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />,
      secondary: 'patients sans RDV terminé',
      tooltip: data.prospectsDetail,
    },
    {
      id: 'prospectsConverted',
      label: 'Prospects convertis',
      value: data.prospectsConvertedMonth,
      icon: <TrendingUp className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />,
      secondary: 'premier RDV terminé ce mois',
      tooltip: data.prospectsConvertedDetail,
    },
  ], [data, tileToggles, neuroDate, psyDate, neuroDayCount, psyDayCount, neuroDayDetail, psyDayDetail]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const totalPages = Math.ceil(kpiTiles.length / 4);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Tableau de bord</h1>
      </div>

      {/* KPI Carousel */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {totalPages > 1 && (
            <button
              onClick={() => setCarouselPage((p) => Math.max(0, p - 1))}
              disabled={carouselPage === 0}
              className="hidden sm:flex shrink-0 h-8 w-8 rounded-full bg-white border shadow-md items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <div className="overflow-hidden flex-1 min-w-0">
            <div
              className="flex transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${carouselPage * 100}%)` }}
            >
              {Array.from({ length: totalPages }).map((_, pageIndex) => (
                <div key={pageIndex} className="w-full flex-shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {kpiTiles.slice(pageIndex * 4, pageIndex * 4 + 4).map((tile) => (
                    <KpiCard key={tile.id} tile={tile} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          {totalPages > 1 && (
            <button
              onClick={() => setCarouselPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={carouselPage >= totalPages - 1}
              className="hidden sm:flex shrink-0 h-8 w-8 rounded-full bg-white border shadow-md items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex justify-center gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCarouselPage(i)}
                className={`h-2 rounded-full transition-all ${i === carouselPage ? 'bg-brand-600 w-6' : 'bg-gray-300 w-2 hover:bg-gray-400'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Canal d'acquisition</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280} className="min-h-[200px]">
              <PieChart>
                <defs>
                  <radialGradient id="pieGrad0" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#0E4D4B" stopOpacity={1} /><stop offset="100%" stopColor="#0A3634" stopOpacity={0.8} /></radialGradient>
                  <radialGradient id="pieGrad1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#126562" stopOpacity={1} /><stop offset="100%" stopColor="#0E4D4B" stopOpacity={0.8} /></radialGradient>
                  <radialGradient id="pieGrad2" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#167D79" stopOpacity={1} /><stop offset="100%" stopColor="#126562" stopOpacity={0.8} /></radialGradient>
                  <radialGradient id="pieGrad3" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#40A09C" stopOpacity={1} /><stop offset="100%" stopColor="#167D79" stopOpacity={0.8} /></radialGradient>
                  <radialGradient id="pieGrad4" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#6BBBB8" stopOpacity={1} /><stop offset="100%" stopColor="#40A09C" stopOpacity={0.8} /></radialGradient>
                  <radialGradient id="pieGrad5" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#95D5D2" stopOpacity={1} /><stop offset="100%" stopColor="#6BBBB8" stopOpacity={0.8} /></radialGradient>
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
                    <Cell key={index} fill={'url(#pieGrad' + (index % 6) + ')'} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="inside"
                    className="hidden sm:block"
                    formatter={(value: number) => {
                      const total = referralSources.reduce((s, v) => s + v.value, 0);
                      return total > 0 ? ((value / total) * 100).toFixed(0) + '%' : '0%';
                    }}
                    fill="#fff"
                    fontSize={12}
                    fontWeight={500}
                  />
                </Pie>
                <RechartsTooltip
                  formatter={(value: number, name: string) => [value + ' patient' + (value > 1 ? 's' : ''), name]}
                  contentStyle={{ backgroundColor: '#0A3634', border: '1px solid #0E4D4B', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.875rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  labelStyle={{ color: '#fff', fontWeight: 500 }}
                  itemStyle={{ color: '#fff' }}
                />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" dy="-0.1em" fontSize={28} fontWeight="bold" fill="#0E4D4B">
                  {referralSources.reduce((sum, s) => sum + s.value, 0)}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setChartBarPage((p) => Math.max(0, p - 1))}
                disabled={chartBarPage === 0}
                className="h-7 w-7 rounded-full bg-white border shadow-sm flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <CardTitle>{chartBarPage === 0 ? 'Nouveaux clients par mois' : chartBarPage === 1 ? 'RDV fixes vs complété' : chartBarPage === 2 ? 'Séances effectuées par mois' : 'Patients actifs par mois'}</CardTitle>
              <button
                onClick={() => setChartBarPage((p) => Math.min(3, p + 1))}
                disabled={chartBarPage === 3}
                className="h-7 w-7 rounded-full bg-white border shadow-sm flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {chartBarPage === 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyPatientsTrend}>
                  <defs>
                    <linearGradient id="patientCurveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#126562" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#126562" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} minTickGap={16} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <RechartsTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Area
                    type="monotone"
                    dataKey="patients"
                    name="Nouveaux patients"
                    stroke="#126562"
                    strokeWidth={2}
                    fill="url(#patientCurveGrad)"
                    animationDuration={800}
                    dot={{ r: 4, fill: '#126562' }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : chartBarPage === 1 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyAppointmentsTrend} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} minTickGap={16} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]?.payload;
                      return (
                        <div className="rounded-lg border bg-white p-3 shadow-md text-sm">
                          <p className="font-semibold mb-1">{label}</p>
                          <p>RDV fixés : {row?.scheduled ?? 0}</p>
                          <p>RDV complétés : {row?.completed ?? 0}</p>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    content={() => (
                      <div className="flex justify-center gap-4 mt-2 text-sm">
                        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: '#95D5D2' }} /> RDV fixés</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: '#0E4D4B' }} /> RDV complétés</span>
                      </div>
                    )}
                  />
                  <Bar dataKey="scheduled" name="scheduled" animationDuration={800}
                    shape={(props: any) => (
                      <OverlayBar {...props} fixedKey="scheduled" completedKey="completed" />
                    )}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : chartBarPage === 2 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyAppointmentsTrend}>
                  <defs>
                    <linearGradient id="sessionsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0E4D4B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0E4D4B" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} minTickGap={16} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <RechartsTooltip
                    formatter={(value: number) => [value + ' séance' + (value > 1 ? 's' : ''), 'Séances effectuées']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    name="Séances effectuées"
                    stroke="#0E4D4B"
                    strokeWidth={2}
                    fill="url(#sessionsGrad)"
                    dot={{ r: 4, fill: '#0E4D4B' }}
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyActivePatients}>
                  <defs>
                    <linearGradient id="activePatientsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#126562" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#126562" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} minTickGap={16} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <RechartsTooltip
                    formatter={(value: number) => [value + ' patient' + (value > 1 ? 's' : ''), 'Patients actifs']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="patients"
                    name="Patients actifs"
                    stroke="#126562"
                    strokeWidth={2}
                    fill="url(#activePatientsGrad)"
                    dot={{ r: 4, fill: '#126562' }}
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Histogramme RDV par praticien */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base md:text-lg">Comptes rendus par praticien (par mois)</CardTitle>
            <div className="flex items-center gap-1 flex-wrap">
              {([
                { value: 'all' as const, label: 'Tous' },
                { value: 'psy' as const, label: 'Psy' },
                { value: 'neurofeedback' as const, label: 'Neuro' },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setServiceTypeFilter(opt.value)}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                    serviceTypeFilter === opt.value
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={monthlyPractitionerData}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <RechartsTooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                formatter={(value: number, name: string) => {
                  const hasOC = Object.values(overcrowdingRef.current).some((m) => m[name]);
                  return [value, `${name}${hasOC ? ' *' : ''}`];
                }}
              />
              <Legend />
              {practitionerNames.map((name, i) => (
                <Bar
                  key={name}
                  dataKey={name}
                  name={name}
                  fill={['#126562', '#40A09C', '#6BBBB8', '#0E4D4B', '#167D79', '#95D5D2'][i % 6]}
                  radius={[4, 4, 0, 0]}
                  animationDuration={800}
                  cursor="pointer"
                  onClick={(barData: any) => {
                    const monthKey = barData?.payload?.month as string;
                    if (!monthKey) return;
                    const patients = practitionerPatients[monthKey]?.[name] || [];
                    const overflowStarts = overflowSlotsRef.current[monthKey]?.[name];
                    const hasOC = !!(overflowStarts && overflowStarts.size > 0);
                    setPracPatientsTitle(`${name}${hasOC ? ' *' : ''} — ${monthKey}`);
                    setPracPatientsList(patients);
                    setPracPatientsOC(overflowStarts ? Array.from(overflowStarts) : []);
                    setPracPatientsPage(0);
                    setPracPatientsOpen(true);
                  }}
                  shape={(props: any) => {
                    const { x, y, width, height, fill, payload } = props;
                    const monthKey = payload?.month as string;
                    const count = overcrowdingRef.current[monthKey]?.[name] || 0;
                    const rx = 4;
                    const cx = x + width / 2;
                    const badgeY = y - 10;
                    const badgeR = 7;
                    return (
                      <g>
                        <rect x={x} y={y} width={width} height={height} fill={fill} rx={rx} ry={rx} />
                        {count > 0 && (
                          <g>
                            <circle cx={cx} cy={badgeY} r={badgeR} fill="#F59E0B" stroke="#D97706" strokeWidth={1} />
                            <text
                              x={cx}
                              y={badgeY}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#78350F"
                              fontSize={9}
                              fontWeight="bold"
                            >
                              {count}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  }}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Dialog open={pracPatientsOpen} onOpenChange={setPracPatientsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{pracPatientsTitle}</DialogTitle>
            <DialogDescription>
              {pracPatientsList.length} patient{pracPatientsList.length > 1 ? 's' : ''} pris en charge 
            </DialogDescription>
          </DialogHeader>
          {pracPatientsList.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">Aucun patient pour cette période.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead className="hidden sm:table-cell">Date et heure du RDV</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pracPatientsList
                      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                      .slice(pracPatientsPage * 10, (pracPatientsPage + 1) * 10)
                      .map((p, i) => {
                        const isOvercrowded = pracPatientsOC.includes(p.startTime);
                        return (
                        <TableRow key={i}>
                          <TableCell className={`font-medium ${isOvercrowded ? 'text-amber-600' : ''}`}>
                            {p.lastName} {p.firstName}
                            <span className="block sm:hidden text-xs font-normal text-gray-500">
                              {new Date(p.startTime).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              {' '}
                              {new Date(p.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell whitespace-nowrap">
                            {new Date(p.startTime).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            {' '}
                            {new Date(p.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-brand-600"
                              onClick={() => router.push(`/appointments/${p.appointmentId}/report`)}
                            >
                              Voir le compte rendu
                            </Button>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
              {pracPatientsList.length > 10 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-gray-500">
                    {pracPatientsPage * 10 + 1}–{Math.min((pracPatientsPage + 1) * 10, pracPatientsList.length)} sur {pracPatientsList.length}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pracPatientsPage === 0}
                      onClick={() => setPracPatientsPage((p) => p - 1)}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={(pracPatientsPage + 1) * 10 >= pracPatientsList.length}
                      onClick={() => setPracPatientsPage((p) => p + 1)}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}