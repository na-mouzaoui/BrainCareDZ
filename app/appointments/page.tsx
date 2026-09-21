'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePagination, PaginationControls } from '@/components/pagination-controls';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { appointments, patients as patientsApi, users as usersApi, waitingList, calendarSettings as calendarSettingsApi } from '@/lib/api';
import AppointmentForm, { type AppointmentFormData } from '@/components/appointment-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, List, Clock, Plus, Trash2 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { ListPageSkeleton } from '@/components/page-skeletons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FieldLabel } from '@/components/ui/field';
import FilterDialog, {
  type FilterField,
  type FilterValues,
  resetFilters,
} from '@/components/filter-dialog';

interface AppointmentPatient {
  patientId: string;
  firstName: string;
  lastName: string;
}

interface Appointment {
  id: string;
  serviceId: string | null;
  serviceName: string | null;
  servicePrice: number;
  serviceDuration: number;
  serviceType?: string;
  practitionerId: string;
  practitionerName: string;
  practitionerEmail: string;
  practitionerRole?: string;
  calendarRole?: string;
  noteAuthorName?: string;
  startTime: string;
  endTime: string;
  status: string;
  packDeferred?: boolean;
  title?: string;
  patients: AppointmentPatient[];
}

interface PracticeSettings {
  weekendDays: number[];
  consultationDuration: number;
  workStartTime: string;
  workEndTime: string;
  breakfastBreakStart?: string;
  breakfastBreakEnd?: string;
  hasBreakfastBreak: boolean;
}

interface PractitionerOption {
  id: string;
  name: string;
  role?: string;
}

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface WaitingListEntry {
  id: string;
  practitionerId: string;
  practitionerName: string;
  practitionerRole?: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  position: number;
  createdAt: string;
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_START_MINUTES = 8 * 60;
const DAY_END_MINUTES = 18 * 60;

const DEFAULT_SETTINGS: PracticeSettings = {
  weekendDays: [5, 6],
  consultationDuration: 60,
  workStartTime: '08:00',
  workEndTime: '18:00',
  hasBreakfastBreak: false,
};

function startOfWeekSunday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseTimeToMinutes(value?: string) {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function formatHour(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDateTimeLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function AppointmentsPage() {
  const [appointmentsList, setAppointmentsList] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [formInitialData, setFormInitialData] = useState<AppointmentFormData | undefined>(undefined);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [isDeletingAppointment, setIsDeletingAppointment] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [settings, setSettings] = useState<PracticeSettings>(DEFAULT_SETTINGS);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeekSunday(new Date()));
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'waitlist'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'list';
    return 'calendar';
  });
  const [calendarRole, setCalendarRole] = useState<'admin' | 'psy' | 'coach'>('admin');
  const [carouselIndex, setCarouselIndex] = useState<Record<string, number>>({});
  const [carouselDir, setCarouselDir] = useState<Record<string, 'left' | 'right'>>({});
  const [filters, setFilters] = useState<FilterValues>({});
  const [waitingEntries, setWaitingEntries] = useState<WaitingListEntry[]>([]);
  const [practitioners, setPractitioners] = useState<PractitionerOption[]>([]);
  const [waitingPatients, setWaitingPatients] = useState<PatientOption[]>([]);
  const [selectedWaitPsy, setSelectedWaitPsy] = useState('');
  const [isWaitingLoading, setIsWaitingLoading] = useState(true);
  const [waitDialogOpen, setWaitDialogOpen] = useState(false);
  const [waitPatientId, setWaitPatientId] = useState('');
  const [waitPsyId, setWaitPsyId] = useState('');
  const [waitError, setWaitError] = useState('');
  const [waitingBookEntryId, setWaitingBookEntryId] = useState<string | null>(null);
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'admin';

  const filterFields: FilterField[] = [
    { key: 'status', label: 'Statut', type: 'select', options: [
      { value: 'scheduled', label: 'Fixé' },
      { value: 'completed', label: 'Complété' },
      { value: 'cancelled', label: 'Annulé' },
    ] },
    { key: 'practitionerName', label: 'Praticien', type: 'text', placeholder: 'Nom du praticien' },
    { key: 'serviceName', label: 'Service', type: 'text', placeholder: 'Nom du service' },
    { key: 'dateRange', label: 'Période', type: 'date-range' },
  ];

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    if (!authLoading && isAuthenticated) {
      loadAppointments();
      loadWaitingData();
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    const onFocus = () => loadSettings();
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [calendarRole]);

  useEffect(() => {
    if (!user) return;
    const role = user.role as 'admin' | 'psy' | 'coach';
    if (role === 'admin') {
      setCalendarRole((prev) => (prev === 'admin' || prev === 'psy' || prev === 'coach' ? prev : 'admin'));
    } else {
      setCalendarRole(role);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) loadSettings();
  }, [calendarRole, isAuthenticated]);

  async function loadAppointments() {
    try {
      setIsLoading(true);
      const response = await appointments.getAll();
      if (response.success && response.data) {
        setAppointmentsList(response.data.appointments || []);
      } else {
        setError(response.message || 'Echec du chargement des rendez-vous');
      }
    } catch (err) {
      console.error('Failed to load appointments:', err);
      setError('Une erreur s\'est produite lors du chargement des rendez-vous');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSettings() {
    try {
      const response = await calendarSettingsApi.getByRole(calendarRole);
      if (response.success && response.data) {
        const s = response.data;
        setSettings({
          weekendDays: s.weekend_days || DEFAULT_SETTINGS.weekendDays,
          consultationDuration: s.consultation_duration || DEFAULT_SETTINGS.consultationDuration,
          workStartTime: s.work_start_time || DEFAULT_SETTINGS.workStartTime,
          workEndTime: s.work_end_time || DEFAULT_SETTINGS.workEndTime,
          hasBreakfastBreak: !!s.has_breakfast_break,
          breakfastBreakStart: s.breakfast_break_start,
          breakfastBreakEnd: s.breakfast_break_end,
        });
      }
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
  }

  async function loadWaitingData() {
    try {
      setIsWaitingLoading(true);
      const [practRes, patRes, waitRes] = await Promise.all([
        usersApi.getPractitioners(),
        patientsApi.getAll(),
        waitingList.getAll(),
      ]);

      const practitionerList: PractitionerOption[] =
        (practRes?.success && practRes.data?.practitioners) || [];
      setPractitioners(practitionerList);

      const patientList: PatientOption[] = patRes?.data?.patients || [];
      setWaitingPatients(patientList);

      const entries: WaitingListEntry[] = waitRes?.data?.entries || [];
      setWaitingEntries(entries);

      // Default selected psy: current user if a practitioner/psy, otherwise first practitioner
      const currentPsy = practitionerList.find((p) => p.id === user?.id && (p.role === 'psy' || p.role === 'admin'));
      setSelectedWaitPsy((prev) => {
        if (prev && practitionerList.some((p) => p.id === prev)) return prev;
        return currentPsy?.id || practitionerList[0]?.id || '';
      });
    } catch (err) {
      setWaitError('Erreur lors du chargement de la liste d\'attente');
    } finally {
      setIsWaitingLoading(false);
    }
  }

  async function reloadWaitingList() {
    try {
      const waitRes = await waitingList.getAll();
      if (waitRes?.success) {
        setWaitingEntries(waitRes.data?.entries || []);
      }
    } catch (err) {
      setWaitError('Erreur lors du rechargement de la liste d\'attente');
    }
  }

  async function handleAddToWaitingList() {
    if (!waitPsyId || !waitPatientId) {
      setWaitError('Sélectionnez un praticien et un patient');
      return;
    }
    try {
      const response = await waitingList.add({ practitionerId: waitPsyId, patientId: waitPatientId });
      if (!response?.success) {
        setWaitError(response?.message || 'Échec de l\'ajout à la liste d\'attente');
        return;
      }
      setWaitDialogOpen(false);
      setWaitPatientId('');
      setWaitPsyId('');
      setWaitError('');
      await reloadWaitingList();
    } catch (err) {
      setWaitError('Erreur lors de l\'ajout à la liste d\'attente');
    }
  }

  async function handleMoveWaitingEntry(id: string, direction: 'up' | 'down') {
    try {
      const response = await waitingList.move(id, direction);
      if (response?.success && Array.isArray(response.data?.entries)) {
        setWaitingEntries(response.data.entries);
      } else {
        setWaitError(response?.message || 'Échec du déplacement');
      }
    } catch (err) {
      setWaitError('Erreur lors du déplacement');
    }
  }

  async function handleRemoveWaitingEntry(id: string) {
    try {
      const response = await waitingList.remove(id);
      if (!response?.success) {
        setWaitError(response?.message || 'Échec de la suppression');
        return;
      }
      await reloadWaitingList();
    } catch (err) {
      setWaitError('Erreur lors de la suppression');
    }
  }

  function bookFromWaitingEntry(entry: WaitingListEntry) {
    setEditingAppointment(null);
    setWaitingBookEntryId(entry.id);
    setFormInitialData({
      serviceId: '',
      startTime: '',
      endTime: '',
      patientIds: [entry.patientId],
      practitionerId: entry.practitionerId,
      preferredRole: entry.practitionerRole === 'coach' ? 'coach' : undefined,
    });
    setDialogOpen(true);
  }

  const slotDuration = Math.max(15, settings.consultationDuration || 60);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(currentWeekStart, index)),
    [currentWeekStart]
  );

  const workStartMinutes = parseTimeToMinutes(settings.workStartTime) ?? DAY_START_MINUTES;
  const workEndMinutes = parseTimeToMinutes(settings.workEndTime) ?? DAY_END_MINUTES;

  const slots = useMemo(() => {
    const list: number[] = [];
    const safeStart = Math.max(0, workStartMinutes);
    const safeEnd = Math.min(24 * 60, Math.max(workEndMinutes, safeStart + slotDuration));
    for (let minutes = safeStart; minutes < safeEnd; minutes += slotDuration) {
      list.push(minutes);
    }
    return list;
  }, [slotDuration, workStartMinutes, workEndMinutes]);

  function isWeekend(day: Date) {
    return settings.weekendDays.includes(day.getDay());
  }

  function isBreakSlot(slotStartMinutes: number, slotEndMinutes: number) {
    if (!settings.hasBreakfastBreak) return false;
    const breakStart = parseTimeToMinutes(settings.breakfastBreakStart);
    const breakEnd = parseTimeToMinutes(settings.breakfastBreakEnd);
    if (breakStart === null || breakEnd === null) return false;
    return slotStartMinutes < breakEnd && slotEndMinutes > breakStart;
  }

  function findAppointmentsForSlot(day: Date, slotStartMinutes: number, slotEndMinutes: number) {
    const slotStart = new Date(day);
    slotStart.setHours(Math.floor(slotStartMinutes / 60), slotStartMinutes % 60, 0, 0);
    const slotEnd = new Date(day);
    slotEnd.setHours(Math.floor(slotEndMinutes / 60), slotEndMinutes % 60, 0, 0);

    return appointmentsList.filter((apt: Appointment) => {
      const aptStart = new Date(apt.startTime);
      const aptEnd = new Date(apt.endTime);
      if (!sameLocalDay(aptStart, day)) return false;

      for (const [key, rawValue] of Object.entries(filters)) {
        if (rawValue === undefined || rawValue === null || rawValue === '') continue;
        if (typeof rawValue === 'object') continue;
        const value = String(rawValue).toLowerCase();
        if (key === 'status' && apt.status.toLowerCase() !== value) return false;
        if (key === 'practitionerName' && !(apt.practitionerName || '').toLowerCase().includes(value)) return false;
        if (key === 'serviceName' && !(apt.serviceName || '').toLowerCase().includes(value)) return false;
      }

      return aptStart < slotEnd && aptEnd > slotStart;
    });
  }

  function goToPreviousWeek() {
    setCurrentWeekStart((prev) => addDays(prev, -7));
  }

  function goToNextWeek() {
    setCurrentWeekStart((prev) => addDays(prev, 7));
  }

  function goToPreviousMonth() {
    setCurrentWeekStart((prev) => {
      const monthDate = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      return startOfWeekSunday(monthDate);
    });
  }

  function goToNextMonth() {
    setCurrentWeekStart((prev) => {
      const monthDate = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      return startOfWeekSunday(monthDate);
    });
  }

  function goToDate(date?: Date) {
    if (!date) return;
    setCurrentWeekStart(startOfWeekSunday(date));
  }

  function carouselKey(day: Date, slotStartMinutes: number) {
    return `${dateKey(day)}-${slotStartMinutes}`;
  }

  function carouselPrev(day: Date, slotStartMinutes: number, count: number) {
    const key = carouselKey(day, slotStartMinutes);
    setCarouselDir((prev) => ({ ...prev, [key]: 'right' }));
    setCarouselIndex((prev) => ({
      ...prev,
      [key]: ((prev[key] || 0) - 1 + count) % count,
    }));
  }

  function carouselNext(day: Date, slotStartMinutes: number, count: number) {
    const key = carouselKey(day, slotStartMinutes);
    setCarouselDir((prev) => ({ ...prev, [key]: 'left' }));
    setCarouselIndex((prev) => ({
      ...prev,
      [key]: ((prev[key] || 0) + 1) % count,
    }));
  }

  function createFromSlot(day: Date, slotStartMinutes: number) {
    const start = new Date(day);
    start.setHours(Math.floor(slotStartMinutes / 60), slotStartMinutes % 60, 0, 0);
    const end = new Date(start.getTime() + slotDuration * 60000);

    setEditingAppointment(null);
    setFormInitialData({
      serviceId: '',
      startTime: formatDateTimeLocal(start),
      endTime: formatDateTimeLocal(end),
      patientIds: [],
      practitionerId: user?.role === 'admin' ? undefined : user?.id,
      preferredRole: user?.role === 'admin' ? calendarRole : undefined,
    });
    setDialogOpen(true);
  }

  function editFromAppointment(appointment: Appointment) {
    if (appointment.status === 'completed') {
      setEditingAppointment(appointment);
      setFormInitialData(undefined);
      setDialogOpen(true);
      return;
    }
    setEditingAppointment(appointment);
    const patientIds = appointment.patients?.map(p => p.patientId) || [];
    setFormInitialData({
      serviceId: appointment.serviceId || '',
      startTime: formatDateTimeLocal(new Date(appointment.startTime)),
      endTime: formatDateTimeLocal(new Date(appointment.endTime)),
      patientIds,
      practitionerId: appointment.practitionerId,
      preferredRole: appointment.practitionerId ? undefined : 'coach',
      packDeferred: appointment.packDeferred,
    });
    setDialogOpen(true);
  }

  async function handleSubmitAppointment(data: AppointmentFormData) {
    setIsSubmittingForm(true);
    try {
      const response = editingAppointment
        ? await appointments.update(editingAppointment.id, data)
        : await appointments.create(data);

      if (!response.success) {
        throw new Error(
          response.message || (editingAppointment ? 'Échec de la modification du rendez-vous' : 'Échec de la création du rendez-vous')
        );
      }

      setDialogOpen(false);
      setEditingAppointment(null);
      setFormInitialData(undefined);
      if (waitingBookEntryId) {
        const bookingId = waitingBookEntryId;
        setWaitingBookEntryId(null);
        try {
          await waitingList.remove(bookingId);
        } catch {
          // ignore — entry removal is best-effort after a successful booking
        }
        await reloadWaitingList();
      }
      await loadAppointments();
    } finally {
      setIsSubmittingForm(false);
    }
  }

  async function handleOpenReport() {
    if (!editingAppointment) return;
    setDialogOpen(false);
    router.push(`/appointments/${editingAppointment.id}/report`);
  }

  async function handleDeleteAppointment() {
    if (!editingAppointment) return;

    const reason = window.prompt('Motif de l\'annulation du rendez-vous:');
    if (!reason || reason.trim() === '') {
      setError('Veuillez préciser le motif de l\'annulation');
      return;
    }

    setIsDeletingAppointment(true);
    setDeleteReason(reason.trim());
    try {
      const response = await appointments.delete(editingAppointment.id, reason.trim());
      if (!response.success) {
        throw new Error(response.message || 'Échec de l\'annulation du rendez-vous');
      }

      setDialogOpen(false);
      setEditingAppointment(null);
      setFormInitialData(undefined);
      setDeleteReason('');
      await loadAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur s\'est produite');
    } finally {
      setIsDeletingAppointment(false);
      setDeleteReason('');
    }
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    setDialogOpen(nextOpen);
    if (!nextOpen) {
      setEditingAppointment(null);
      setFormInitialData(undefined);
      setWaitingBookEntryId(null);
    }
  }

  const weekRangeLabel = `${weekDays[0].toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  })} - ${weekDays[6].toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}`;

  const filteredAppointments = useMemo(() => {
    return appointmentsList
      .filter((apt) => {
        if (viewMode === 'calendar' && apt.status === 'cancelled') return false;
      if (apt.calendarRole && apt.calendarRole !== calendarRole) return false;

        const aptDate = new Date(apt.startTime);

        for (const [key, rawValue] of Object.entries(filters)) {
          if (rawValue === undefined || rawValue === null || rawValue === '') continue;

          if (typeof rawValue === 'object') {
            const range = rawValue as { from?: string; to?: string };
            if (key === 'dateRange') {
              const from = range.from ? new Date(`${range.from}T00:00:00`).getTime() : null;
              const to = range.to ? new Date(`${range.to}T23:59:59`).getTime() : null;
              const time = aptDate.getTime();
              if (from !== null && time < from) return false;
              if (to !== null && time > to) return false;
            }
            continue;
          }

          const value = String(rawValue).toLowerCase();
          if (key === 'status' && apt.status.toLowerCase() !== value) return false;
          if (key === 'practitionerName' && !(apt.practitionerName || '').toLowerCase().includes(value)) return false;
          if (key === 'serviceName' && !(apt.serviceName || '').toLowerCase().includes(value)) return false;
        }

        return aptDate >= weekDays[0] && aptDate <= weekDays[6];
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [appointmentsList, weekDays, filters, calendarRole]);

  const { page, setPage, totalPages, totalItems, paginatedItems } = usePagination(filteredAppointments);

  if (authLoading || isLoading) {
    return <ListPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Agenda des rendez-vous ({totalItems})</h1>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="w-full">
        <FilterDialog
          fields={filterFields}
          values={filters}
          onChange={setFilters}
          onReset={() => setFilters(resetFilters(filterFields))}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base md:text-lg">
              Vue semaine (duree de creneau: {slotDuration} min) —{' '}
              {calendarRole === 'admin' ? 'Admin' : calendarRole === 'psy' ? 'Psy' : 'Coach'}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && (
                <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1">
                  {(['admin', 'psy', 'coach'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        setCalendarRole(role);
                        if (role !== 'psy' && viewMode === 'waitlist') {
                          setViewMode('calendar');
                        }
                      }}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        calendarRole === role
                          ? 'bg-brand-700 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {role === 'admin' ? 'Admin' : role === 'psy' ? 'Psy' : 'Coach'}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1">
                {([
                  { value: 'calendar' as const, icon: CalendarDays, label: 'Calendrier' },
                  { value: 'list' as const, icon: List, label: 'Liste' },
                  ...(calendarRole === 'psy'
                    ? [{ value: 'waitlist' as const, icon: Clock, label: 'Attente' }]
                    : []),
                ]).map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setViewMode(mode.value)}
                    title={mode.label}
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === mode.value
                        ? 'bg-brand-700 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <mode.icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'waitlist' ? (
            <WaitingListView
              entries={waitingEntries}
              practitioners={practitioners}
              patients={waitingPatients}
              selectedPsy={selectedWaitPsy}
              onSelectPsy={setSelectedWaitPsy}
              isLoading={isWaitingLoading}
              error={waitError}
              onAdd={bookFromWaitingEntry}
              onMove={handleMoveWaitingEntry}
              onRemove={handleRemoveWaitingEntry}
              onOpenAddDialog={() => setWaitDialogOpen(true)}
              onAddError={setWaitError}
            />
          ) : viewMode === 'list' ? (
            <div className="space-y-4">
              <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" onClick={goToPreviousWeek} size="icon">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Badge variant="outline" className="px-3 py-1 text-sm">
                  {weekRangeLabel}
                </Badge>
                <Button variant="outline" onClick={goToNextWeek} size="icon">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {totalItems === 0 ? (
                <p className="text-center text-gray-500 py-8">
                 Aucun rendez-vous cette semaine
                </p>
              ) : (
                <div className="space-y-2">
                  {paginatedItems.map((apt) => (
                      <div
                        key={apt.id}
                        className={`flex items-center justify-between gap-3 p-3 border rounded-lg cursor-pointer ${
                          apt.status === 'cancelled' ? 'bg-red-50 opacity-60' : 'bg-white hover:bg-brand-50'
                        }`}
                        onClick={() => editFromAppointment(apt)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">
                            {apt.title || (apt.patients?.length
                              ? apt.patients.map(p => `${p.firstName} ${p.lastName}`).join(', ')
                              : 'Patient')}
                          </p>
                          <p className="text-sm text-gray-600">{apt.title ? 'RDV personnel' : (apt.serviceName || (apt.packDeferred ? 'Pack à définir' : 'Service'))}</p>
                          <p className="text-xs text-gray-400">{apt.noteAuthorName || apt.practitionerName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {new Date(apt.startTime).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date(apt.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {new Date(apt.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <Badge className={`mt-1 ${apt.status === 'cancelled' ? 'bg-red-100 text-red-800' : apt.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                            {apt.status === 'cancelled' ? 'Annulé' : apt.status === 'completed' ? 'Complété' : 'Fixé'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  <PaginationControls page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
                  </div>
                )}
              </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" onClick={goToPreviousWeek} size="icon">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Badge variant="outline" className="px-3 py-1 text-sm">
                  {weekRangeLabel}
                </Badge>
                <Button variant="outline" onClick={goToNextWeek} size="icon">
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Choisir une date">
                      <CalendarDays className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={currentWeekStart}
                      onSelect={goToDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[980px] border border-gray-300 rounded-md overflow-hidden">
                  <div className="grid grid-cols-8 border-b">
                    <div className="text-sm font-semibold text-gray-600 px-2 py-3 flex items-center justify-center">Heure</div>
                    {weekDays.map((day, index) => {
                      return (
                        <div key={dateKey(day)} className="px-2 py-3 flex flex-col items-center justify-center text-center">
                          <p className="text-sm font-semibold text-gray-800">
                            {DAY_LABELS[index]} {day.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {slots.map((slotStartMinutes) => {
                    const slotEndMinutes = slotStartMinutes + slotDuration;

                    return (
                      <div key={slotStartMinutes} className="grid grid-cols-8 border-b">
                        <div className="px-2 py-2 text-xs font-medium text-gray-600 border-r flex items-center justify-center">
                          {formatHour(slotStartMinutes)}
                        </div>

                        {weekDays.map((day) => {
                          const dayIsWeekend = isWeekend(day);
                          const unavailableDay = dayIsWeekend;
                          const breakCell = !unavailableDay && isBreakSlot(slotStartMinutes, slotEndMinutes);
                          const cellAppointments =
                            unavailableDay || breakCell
                              ? []
                              : findAppointmentsForSlot(day, slotStartMinutes, slotEndMinutes);

                          if (unavailableDay) {
                            return (
                              <div
                                key={`${dateKey(day)}-${slotStartMinutes}`}
                                className="h-20 border border-white bg-gray-200"
                              />
                            );
                          }

                          if (breakCell) {
                            return (
                              <div
                                key={`${dateKey(day)}-${slotStartMinutes}`}
                                className="h-20 border border-white bg-amber-100"
                              />
                            );
                          }

                          if (cellAppointments.length > 0) {
                            const visibleAppointments = cellAppointments.filter(apt => apt.status !== 'cancelled');
                            if (visibleAppointments.length === 0) {
                              return (
                                <button
                                  key={`${dateKey(day)}-${slotStartMinutes}`}
                                  type="button"
                                  onClick={() => createFromSlot(day, slotStartMinutes)}
                                  className="h-20 border-r px-2 py-2 text-left text-xs text-gray-400 hover:bg-brand-50 transition-colors"
                                  aria-label="Créer un rendez-vous"
                                />
                              );
                            }

                            const cellKey = carouselKey(day, slotStartMinutes);
                            const idx = carouselIndex[cellKey] ?? 0;
                            const safeIdx = idx < visibleAppointments.length ? idx : 0;
                            const apt = visibleAppointments[safeIdx];
                            const multiple = visibleAppointments.length > 1;

                            return (
                              <div
                                key={cellKey}
                                className="group relative h-20 border-r overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() => editFromAppointment(apt)}
                                  className={`flex h-full w-full items-center gap-1.5 px-1.5 text-left transition-colors ${
                                    apt.status === 'cancelled'
                                      ? 'bg-gray-100 text-gray-400 line-through'
                                      : apt.status === 'completed'
                                        ? 'bg-gray-50 text-gray-500 border-l-4 border-l-gray-300'
                                        : 'bg-brand-100 hover:bg-brand-200 border-l-4 border-l-brand-600'
                                  }`}
                                >
                                  <span
                                    key={`${cellKey}-${safeIdx}`}
                                    className={`flex min-w-0 flex-1 items-center gap-1.5 ${
                                      carouselDir[cellKey] === 'right'
                                        ? 'animate-in slide-in-from-right-3 fade-in duration-150'
                                        : 'animate-in slide-in-from-left-3 fade-in duration-150'
                                    }`}
                                  >
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-semibold leading-tight">
                                        {apt.title || (apt.patients?.length
                                          ? apt.patients.map(p => `${p.firstName} ${p.lastName}`).join(', ')
                                          : 'Patient')}
                                      </span>
                                      <span className="block truncate text-[11px] leading-tight text-gray-600">
                                        {apt.title ? 'RDV personnel' : (apt.serviceName || (apt.packDeferred ? 'Pack à définir' : 'Service'))}
                                      </span>
                                      {apt.status === 'completed' && apt.practitionerName && (
                                        <span className="block truncate text-[10px] leading-tight text-gray-400">
                                          {apt.practitionerName}
                                        </span>
                                      )}
                                    </span>
                                    {multiple && (
                                      <span className="shrink-0 text-[10px] font-semibold text-brand-700">
                                        {safeIdx + 1}/{visibleAppointments.length}
                                      </span>
                                    )}
                                  </span>
                                </button>

                                {multiple && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => carouselPrev(day, slotStartMinutes, visibleAppointments.length)}
                                      className="absolute left-0 top-0 flex h-full w-6 items-center justify-center text-white opacity-100 sm:opacity-0 transition-opacity sm:group-hover:opacity-100"
                                      aria-label="RDV précédent"
                                    >
                                      <ChevronLeft className="h-5 w-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => carouselNext(day, slotStartMinutes, visibleAppointments.length)}
                                      className="absolute right-0 top-0 flex h-full w-6 items-center justify-center text-white opacity-100 sm:opacity-0 transition-opacity sm:group-hover:opacity-100"
                                      aria-label="RDV suivant"
                                    >
                                      <ChevronRight className="h-5 w-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
                                    </button>
                                  </>
                                )}

                                {calendarRole === 'coach' && (
                                  <button
                                    type="button"
                                    onClick={() => createFromSlot(day, slotStartMinutes)}
                                    className="absolute right-0.5 bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-100 text-brand-600 opacity-100 sm:opacity-0 transition-opacity hover:bg-brand-200 hover:text-brand-800 sm:group-hover:opacity-100"
                                    aria-label="Ajouter un rendez-vous"
                                  >
                                    <Plus className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </div>
                            );
                          }

                          return (
                            <button
                              key={`${dateKey(day)}-${slotStartMinutes}`}
                              type="button"
                              onClick={() => createFromSlot(day, slotStartMinutes)}
                              className="h-20 border-r px-2 py-2 text-left text-xs text-gray-400 hover:bg-brand-50 transition-colors"
                              aria-label="Créer un rendez-vous"
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAppointment
                ? editingAppointment.status === 'completed' ? 'Rendez-vous complété' : 'Modifier le rendez-vous'
                : 'Nouveau rendez-vous'}
            </DialogTitle>
            <DialogDescription>
              {editingAppointment
                ? editingAppointment.status === 'completed'
                  ? 'Ce rendez-vous est terminé et ne peut plus être modifié.'
                  : 'Mettez à jour les informations du rendez-vous ou supprimez-le.'
                : 'Complétez les informations pour planifier un rendez-vous.'}
            </DialogDescription>
          </DialogHeader>
          {editingAppointment?.status === 'completed' ? (
            <div className="space-y-3 text-sm text-gray-600">
              <p><span className="font-medium">Service :</span> {editingAppointment.serviceName || '-'}</p>
              <p><span className="font-medium">Date :</span> {new Date(editingAppointment.startTime).toLocaleDateString('fr-FR')} à {new Date(editingAppointment.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
              <p><span className="font-medium">Patients :</span> {editingAppointment.patients.map(p => `${p.firstName} ${p.lastName}`).join(', ')}</p>
              {editingAppointment.noteAuthorName && (
                <p><span className="font-medium">Pris en charge par :</span> {editingAppointment.noteAuthorName}</p>
              )}
              <Button
                type="button"
                variant="outline"
                className="mt-2"
                onClick={() => { setDialogOpen(false); router.push(`/appointments/${editingAppointment.id}/report`); }}
              >
                Voir le compte rendu
              </Button>
            </div>
          ) : (
            <>
              <AppointmentForm
                onSubmit={handleSubmitAppointment}
                initialData={formInitialData}
                isLoading={isSubmittingForm || isDeletingAppointment}
                submitButtonText={editingAppointment ? 'Enregistrer les modifications' : 'Créer le rendez-vous'}
                showSubmitButton={!editingAppointment}
              />
          {editingAppointment && editingAppointment.status !== 'completed' && (
            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteAppointment}
                disabled={isSubmittingForm || isDeletingAppointment}
              >
                {isDeletingAppointment ? 'Annulation...' : 'Annuler le rendez-vous'}
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenReport}
                  disabled={isSubmittingForm || isDeletingAppointment}
                >
                  Prendre en charge le RDV
                </Button>
                <Button
                  type="submit"
                  form="appointment-form"
                  disabled={isSubmittingForm || isDeletingAppointment}
                >
                  Enregistrer les modifications
                </Button>
              </div>
            </div>
          )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={waitDialogOpen} onOpenChange={setWaitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter à la liste d'attente</DialogTitle>
            <DialogDescription>
              Sélectionnez le praticien et le patient à mettre en attente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field>
              <FieldLabel>Praticien *</FieldLabel>
              <Select value={waitPsyId} onValueChange={setWaitPsyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un praticien" />
                </SelectTrigger>
                <SelectContent>
                  {practitioners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.role === 'psy' ? 'Psy' : p.role === 'coach' ? 'Coach' : 'Admin'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Patient *</FieldLabel>
              <Select value={waitPatientId} onValueChange={setWaitPatientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un patient" />
                </SelectTrigger>
                <SelectContent>
                  {waitingPatients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button
              type="button"
              onClick={handleAddToWaitingList}
              disabled={!waitPsyId || !waitPatientId}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter à la liste d'attente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WaitingListView({
  entries,
  practitioners,
  patients,
  selectedPsy,
  onSelectPsy,
  isLoading,
  error,
  onAdd,
  onMove,
  onRemove,
  onOpenAddDialog,
  onAddError,
}: {
  entries: WaitingListEntry[];
  practitioners: PractitionerOption[];
  patients: PatientOption[];
  selectedPsy: string;
  onSelectPsy: (id: string) => void;
  isLoading: boolean;
  error: string;
  onAdd: (entry: WaitingListEntry) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onRemove: (id: string) => void;
  onOpenAddDialog: () => void;
  onAddError: (msg: string) => void;
}) {
  const selectedPsyName = practitioners.find((p) => p.id === selectedPsy)?.name || '';

  const psyEntries = useMemo(
    () =>
      entries
        .filter((e) => e.practitionerId === selectedPsy)
        .sort((a, b) => a.position - b.position),
    [entries, selectedPsy]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Field>
            <FieldLabel>Praticien</FieldLabel>
            <Select value={selectedPsy} onValueChange={onSelectPsy}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Sélectionner un praticien" />
              </SelectTrigger>
              <SelectContent>
                {practitioners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.role === 'psy' ? 'Psy' : p.role === 'coach' ? 'Coach' : 'Admin'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Button type="button" onClick={onOpenAddDialog} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter à la liste d'attente
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Spinner text="Chargement de la liste d'attente..." />
      ) : psyEntries.length === 0 ? (
        <p className="text-center text-gray-500 py-8">
          {selectedPsyName
            ? `Aucun patient en attente pour ${selectedPsyName}.`
            : 'Aucun praticien sélectionné.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Patient</th>
                <th className="px-3 py-2">Ajouté le</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {psyEntries.map((entry, index) => (
                <tr key={entry.id} className="border-b last:border-0 hover:bg-brand-50">
                  <td className="px-3 py-2 font-medium text-gray-700">{index + 1}</td>
                  <td className="px-3 py-2 font-semibold">
                    {entry.patientFirstName} {entry.patientLastName}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {new Date(entry.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={index === 0}
                        onClick={() => onMove(entry.id, 'up')}
                        aria-label="Monter"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={index === psyEntries.length - 1}
                        onClick={() => onMove(entry.id, 'down')}
                        aria-label="Descendre"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => onAdd(entry)}
                      >
                        Réserver
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => onRemove(entry.id)}
                        aria-label="Retirer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}