'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { appointments } from '@/lib/api';
import AppointmentForm, { type AppointmentFormData } from '@/components/appointment-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Appointment {
  id: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  patientEmail: string;
  patientPhone: string;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  serviceDuration: number;
  practitionerId: string;
  practitionerName: string;
  practitionerEmail: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string;
  reminderSent?: boolean;
  sessionNoteId?: string;
}

interface PracticeSettings {
  weekendDays: number[];
  consultationDuration: number;
  workStartTime: string;
  workEndTime: string;
  breakfastBreakStart?: string;
  breakfastBreakEnd?: string;
  hasBreakfastBreak: boolean;
  holidays: string[];
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_START_MINUTES = 8 * 60;
const DAY_END_MINUTES = 18 * 60;

const HOLIDAY_NAMES_BY_MMDD: Record<string, string> = {
  '01-01': 'Jour de l\'An',
  '01-12': 'Yennayer (Nouvel an amazigh)',
  '03-08': 'Journee internationale des femmes',
  '04-07': 'Journee mondiale de la sante',
  '05-01': 'Fete du Travail',
  '05-15': 'Journee internationale des familles',
  '06-01': 'Journee internationale de l\'enfance',
  '07-05': 'Fete de l\'Independance',
  '10-01': 'Journee internationale des personnes agees',
  '10-05': 'Journee mondiale des enseignants',
  '11-01': 'Fete de la Revolution',
  '12-03': 'Journee internationale des personnes handicapees',
  '12-10': 'Journee des droits de l\'homme',
};

const DEFAULT_SETTINGS: PracticeSettings = {
  weekendDays: [5, 6],
  consultationDuration: 60,
  workStartTime: '08:00',
  workEndTime: '18:00',
  hasBreakfastBreak: false,
  holidays: [],
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

function dateMonthDay(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}-${d}`;
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
  const [createOpen, setCreateOpen] = useState(false);
  const [initialCreateData, setInitialCreateData] = useState<AppointmentFormData | undefined>(undefined);
  const [settings, setSettings] = useState<PracticeSettings>(DEFAULT_SETTINGS);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeekSunday(new Date()));
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading && isAuthenticated) {
      loadAppointments();
      loadSettings();
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    const onFocus = () => loadSettings();
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === 'practice-settings') {
        loadSettings();
      }
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorageChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorageChange);
    };
  }, []);

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
      setError('Une erreur s\'est produite lors du chargement des rendez-vous');
    } finally {
      setIsLoading(false);
    }
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem('practice-settings');
      if (!raw) {
        setSettings(DEFAULT_SETTINGS);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<PracticeSettings>;
      setSettings({
        weekendDays: parsed.weekendDays || DEFAULT_SETTINGS.weekendDays,
        consultationDuration: parsed.consultationDuration || DEFAULT_SETTINGS.consultationDuration,
        workStartTime: parsed.workStartTime || DEFAULT_SETTINGS.workStartTime,
        workEndTime: parsed.workEndTime || DEFAULT_SETTINGS.workEndTime,
        hasBreakfastBreak: !!parsed.hasBreakfastBreak,
        breakfastBreakStart: parsed.breakfastBreakStart,
        breakfastBreakEnd: parsed.breakfastBreakEnd,
        holidays: parsed.holidays || [],
      });
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
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

  function isHoliday(day: Date) {
    return settings.holidays.includes(dateKey(day));
  }

  function getHolidayLabel(day: Date) {
    return HOLIDAY_NAMES_BY_MMDD[dateMonthDay(day)] || 'Jour ferie';
  }

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

function createFromSlot(day: Date, slotStartMinutes: number) {
    const start = new Date(day);
    start.setHours(Math.floor(slotStartMinutes / 60), slotStartMinutes % 60, 0, 0);
    const end = new Date(start.getTime() + slotDuration * 60000);

    setInitialCreateData({
      patientId: '',
      serviceId: '',
      startTime: formatDateTimeLocal(start),
      endTime: formatDateTimeLocal(end),
      notes: '',
    });
    setCreateOpen(true);
  }

  async function handleCreateAppointment(data: AppointmentFormData) {
    const response = await appointments.create(data);
    if (!response.success) {
      throw new Error(response.message || 'Échec de la création du rendez-vous');
    }
    setCreateOpen(false);
    setInitialCreateData(undefined);
    await loadAppointments();
  }

  const weekRangeLabel = `${weekDays[0].toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  })} - ${weekDays[6].toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}`;

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agenda des rendez-vous</h1>
          <p className="text-gray-600 mt-1">Cliquez sur une cellule pour créer un rendez-vous</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Vue semaine (duree de creneau: {slotDuration} min)</CardTitle>
        </CardHeader>
        <CardContent>
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
                  const weekendDay = isWeekend(day);
                  const holidayDay = isHoliday(day);
                  const showHolidayTooltip = holidayDay && !weekendDay;
                  const holidayLabel = getHolidayLabel(day);

                  return (
                    <div key={dateKey(day)} className="px-2 py-3 flex flex-col items-center justify-center text-center">
                      <p className="text-sm font-semibold text-gray-800">
                        {DAY_LABELS[index]} {day.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      </p>
                      {holidayDay && (
                        showHolidayTooltip ? (
                          <p className="text-xs text-red-600 cursor-help" title={holidayLabel}>Ferie</p>
                        ) : (
                          <p className="text-xs text-red-600">Ferie</p>
                        )
                      )}
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
                      const dayIsHoliday = isHoliday(day);
                      const unavailableDay = dayIsWeekend || dayIsHoliday;
                      const showHolidayTooltip = dayIsHoliday && !dayIsWeekend;
                      const breakCell = !unavailableDay && isBreakSlot(slotStartMinutes, slotEndMinutes);
                      const cellAppointments =
                        unavailableDay || breakCell
                          ? []
                          : findAppointmentsForSlot(day, slotStartMinutes, slotEndMinutes);

                      if (unavailableDay) {
                        if (showHolidayTooltip) {
                          return (
                            <div
                              key={`${dateKey(day)}-${slotStartMinutes}`}
                              className="h-10 border border-white bg-gray-200 cursor-help"
                              title={getHolidayLabel(day)}
                            />
                          );
                        }

                        return (
                          <div
                            key={`${dateKey(day)}-${slotStartMinutes}`}
                            className="h-10 border border-white bg-gray-200"
                          />
                        );
                      }

                      if (breakCell) {
                        return (
                          <div
                            key={`${dateKey(day)}-${slotStartMinutes}`}
                            className="h-10 border border-white bg-amber-100"
                          />
                        );
                      }

                      if (cellAppointments.length > 0) {
                        return (
                          <div
                            key={`${dateKey(day)}-${slotStartMinutes}`}
                            className="h-10 border-r bg-emerald-50 px-1 py-1 space-y-1 overflow-hidden"
                          >
                            {cellAppointments.slice(0, 2).map((apt) => (
                              <button
                                key={apt.id}
                                type="button"
                                onClick={() => router.push(`/appointments/${apt.id}`)}
                                className="w-full rounded bg-white px-2 py-1 text-left text-xs shadow-sm hover:bg-emerald-100 transition-colors"
                              >
                                <p className="font-semibold truncate">
                                  {apt.patientFirstName} {apt.patientLastName}
                                </p>
                                <p className="truncate text-gray-600">{apt.serviceName}</p>
                              </button>
                            ))}
                            {cellAppointments.length > 2 && (
                              <p className="text-[10px] text-emerald-700 px-1">+{cellAppointments.length - 2} autres</p>
                            )}
                          </div>
                        );
                      }

                      return (
                        <button
                          key={`${dateKey(day)}-${slotStartMinutes}`}
                          type="button"
                          onClick={() => createFromSlot(day, slotStartMinutes)}
                          className="h-10 border-r px-2 py-2 text-left text-xs text-gray-400 hover:bg-emerald-50 transition-colors"
                          aria-label="Créer un rendez-vous"
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau rendez-vous</DialogTitle>
            <DialogDescription>
              Complétez les informations pour planifier un rendez-vous.
            </DialogDescription>
          </DialogHeader>
          <AppointmentForm
            onSubmit={handleCreateAppointment}
            initialData={initialCreateData}
            submitButtonText="Créer le rendez-vous"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}