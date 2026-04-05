'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { CheckedState } from '@radix-ui/react-checkbox';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Save, Trash2 } from 'lucide-react';

interface Settings {
  weekendDays: number[];
  consultationDuration: number;
  workStartTime: string;
  workEndTime: string;
  breakfastBreakStart?: string;
  breakfastBreakEnd?: string;
  hasBreakfastBreak: boolean;
  holidays: string[];
}

interface PublicHolidayApiItem {
  date: string;
  localName?: string;
  name?: string;
}

interface HijriDayApiItem {
  hijri?: {
    holidays?: string[];
  };
  gregorian?: {
    date?: string;
  };
}

interface HolidayOption {
  date: string;
  label: string;
}

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const DEFAULT_SETTINGS: Settings = {
  weekendDays: [5, 6],
  consultationDuration: 60,
  workStartTime: '08:00',
  workEndTime: '18:00',
  hasBreakfastBreak: false,
  holidays: [],
};

const NATIONAL_FIXED_MMDD = [
  { md: '01-01', label: 'Jour de l\'An' },
  { md: '01-12', label: 'Yennayer (Nouvel an amazigh)' },
  { md: '05-01', label: 'Fête du Travail' },
  { md: '07-05', label: 'Fête de l\'Indépendance' },
  { md: '11-01', label: 'Fête de la Révolution' },
];

const INTERNATIONAL_FIXED_MMDD = [
  { md: '03-08', label: 'Journée internationale des femmes' },
  { md: '04-07', label: 'Journée mondiale de la santé' },
  { md: '05-15', label: 'Journée internationale des familles' },
  { md: '06-01', label: 'Journée internationale de l\'enfance' },
  { md: '10-01', label: 'Journée internationale des personnes âgées' },
  { md: '10-05', label: 'Journée mondiale des enseignants' },
  { md: '12-03', label: 'Journée internationale des personnes handicapées' },
  { md: '12-10', label: 'Journée des droits de l\'homme' },
];

function parseDdMmYyyyToIso(ddMmYyyy: string) {
  const [dd, mm, yyyy] = ddMmYyyy.split('-');
  if (!dd || !mm || !yyyy) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function dedupeHolidayOptions(options: HolidayOption[]) {
  const seen = new Set<string>();
  return options.filter((item) => {
    const key = `${item.date}|${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeDateList(dates: string[]) {
  return Array.from(new Set(dates)).sort();
}

function buildFixedHolidayList(year: number, items: Array<{ md: string; label: string }>) {
  return items.map((item) => ({
    date: `${year}-${item.md}`,
    label: item.label,
  }));
}

export default function SettingsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [customHolidayDate, setCustomHolidayDate] = useState('');
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const [loadingHolidays, setLoadingHolidays] = useState(false);

  const [nationalHolidays, setNationalHolidays] = useState<HolidayOption[]>([]);
  const [internationalHolidays, setInternationalHolidays] = useState<HolidayOption[]>([]);
  const [islamicHolidays, setIslamicHolidays] = useState<HolidayOption[]>([]);

  const selectedHolidaySet = useMemo(() => new Set(settings.holidays), [settings.holidays]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading) {
      loadSettings();
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    loadHolidaySources(holidayYear);
  }, [holidayYear]);

  async function loadSettings() {
    try {
      setLoading(true);
      const saved = localStorage.getItem('practice-settings');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Settings>;
        setSettings({
          weekendDays: parsed.weekendDays || DEFAULT_SETTINGS.weekendDays,
          consultationDuration: parsed.consultationDuration || DEFAULT_SETTINGS.consultationDuration,
          workStartTime: parsed.workStartTime || DEFAULT_SETTINGS.workStartTime,
          workEndTime: parsed.workEndTime || DEFAULT_SETTINGS.workEndTime,
          hasBreakfastBreak: !!parsed.hasBreakfastBreak,
          breakfastBreakStart: parsed.breakfastBreakStart,
          breakfastBreakEnd: parsed.breakfastBreakEnd,
          holidays: parsed.holidays || DEFAULT_SETTINGS.holidays,
        });
      }
    } catch {
      setError('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  }

  async function loadHolidaySources(year: number) {
    setLoadingHolidays(true);
    try {
      const [national, islamic] = await Promise.all([
        loadNationalHolidays(year),
        loadIslamicHolidays(year),
      ]);

      setNationalHolidays(dedupeHolidayOptions(national));
      setIslamicHolidays(dedupeHolidayOptions(islamic));
      setInternationalHolidays(buildFixedHolidayList(year, INTERNATIONAL_FIXED_MMDD));
    } catch {
      setNationalHolidays(buildFixedHolidayList(year, NATIONAL_FIXED_MMDD));
      setIslamicHolidays([]);
      setInternationalHolidays(buildFixedHolidayList(year, INTERNATIONAL_FIXED_MMDD));
    } finally {
      setLoadingHolidays(false);
    }
  }

  async function loadNationalHolidays(year: number) {
    const fallback = buildFixedHolidayList(year, NATIONAL_FIXED_MMDD);

    try {
      const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/DZ`);
      if (!response.ok) {
        return fallback;
      }

      const data = (await response.json()) as PublicHolidayApiItem[];
      const apiList: HolidayOption[] = data.map((item) => ({
        date: item.date,
        label: item.localName || item.name || 'Jour férié national',
      }));

      return [...fallback, ...apiList];
    } catch {
      return fallback;
    }
  }

  async function loadIslamicHolidays(year: number) {
    const requests = Array.from({ length: 12 }, (_, i) => i + 1).map((month) =>
      fetch(`https://api.aladhan.com/v1/gToHCalendar/${month}/${year}`)
    );

    const responses = await Promise.all(requests);
    const validResponses = responses.filter((res) => res.ok);
    if (validResponses.length === 0) {
      return [];
    }

    const payloads = (await Promise.all(validResponses.map((res) => res.json()))) as Array<{
      data?: HijriDayApiItem[];
    }>;

    const options: HolidayOption[] = [];

    for (const payload of payloads) {
      const days = payload.data || [];
      for (const day of days) {
        const names = day.hijri?.holidays || [];
        const gregorian = day.gregorian?.date;
        const isoDate = gregorian ? parseDdMmYyyyToIso(gregorian) : null;
        if (!isoDate || names.length === 0) continue;

        for (const name of names) {
          options.push({
            date: isoDate,
            label: `Religieux (Islam): ${name}`,
          });
        }
      }
    }

    return options;
  }

  async function saveSettings() {
    try {
      setSaving(true);
      setError('');
      localStorage.setItem('practice-settings', JSON.stringify(settings));
      setSuccess('Paramètres sauvegardés avec succès!');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  function toggleWeekendDay(day: number) {
    setSettings((prev) => ({
      ...prev,
      weekendDays: prev.weekendDays.includes(day)
        ? prev.weekendDays.filter((d) => d !== day)
        : [...prev.weekendDays, day],
    }));
  }

  function addHolidayDate(date: string) {
    if (!date) return;
    setSettings((prev) => ({
      ...prev,
      holidays: dedupeDateList([...prev.holidays, date]),
    }));
  }

  function removeHoliday(date: string) {
    setSettings((prev) => ({
      ...prev,
      holidays: prev.holidays.filter((h) => h !== date),
    }));
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Paramètres de la pratique</h1>
        <p className="text-gray-600 mt-1">Configurez les horaires et les préférences de votre cabinet</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Durée de consultation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="duration">Durée par défaut (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="15"
                step="15"
                value={settings.consultationDuration}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setSettings({ ...settings, consultationDuration: parseInt(e.target.value || '60', 10) })
                }
                className="mt-1 max-w-xs"
              />
            </div>
            <p className="text-sm text-gray-600">
              Cette durée est utilisée pour les créneaux de l'agenda.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horaires de travail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="work-start">Début de journée (24h)</Label>
              <Input
                id="work-start"
                type="time"
                value={settings.workStartTime}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, workStartTime: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="work-end">Fin de journée (24h)</Label>
              <Input
                id="work-end"
                type="time"
                value={settings.workEndTime}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, workEndTime: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-3">
            Le premier jour de la semaine est Dimanche.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jours de week-end</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {DAYS.map((day, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Checkbox
                    id={`day-${index}`}
                    checked={settings.weekendDays.includes(index)}
                    onCheckedChange={() => toggleWeekendDay(index)}
                  />
                  <Label htmlFor={`day-${index}`} className="cursor-pointer font-medium">
                    {day}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pause déjeuner</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="has-break"
                checked={settings.hasBreakfastBreak}
                onCheckedChange={(checked: CheckedState) =>
                  setSettings({ ...settings, hasBreakfastBreak: checked === true })
                }
              />
              <Label htmlFor="has-break" className="cursor-pointer font-medium">
                Ajouter une pause déjeuner
              </Label>
            </div>

            {settings.hasBreakfastBreak && (
              <div className="space-y-3 pl-8 border-l-2 border-emerald-600">
                <div>
                  <Label htmlFor="break-start">Début de la pause (24h)</Label>
                  <Input
                    id="break-start"
                    type="time"
                    value={settings.breakfastBreakStart || '12:00'}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setSettings({ ...settings, breakfastBreakStart: e.target.value })
                    }
                    className="mt-1 max-w-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="break-end">Fin de la pause (24h)</Label>
                  <Input
                    id="break-end"
                    type="time"
                    value={settings.breakfastBreakEnd || '13:00'}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setSettings({ ...settings, breakfastBreakEnd: e.target.value })
                    }
                    className="mt-1 max-w-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      hasBreakfastBreak: false,
                      breakfastBreakStart: undefined,
                      breakfastBreakEnd: undefined,
                    })
                  }
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer la pause
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jours fériés (Algérie)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Label htmlFor="holiday-year">Année</Label>
              <Input
                id="holiday-year"
                type="number"
                min="2020"
                max="2100"
                value={holidayYear}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setHolidayYear(parseInt(e.target.value || `${new Date().getFullYear()}`, 10))}
                className="w-28 h-9"
              />
              {loadingHolidays && <p className="text-sm text-gray-500">Chargement des listes...</p>}
            </div>

            <div>
              <h3 className="font-medium mb-3">Jours nationaux</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {nationalHolidays.map((holiday) => (
                  <Button
                    key={`${holiday.date}-${holiday.label}`}
                    variant={selectedHolidaySet.has(holiday.date) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => addHolidayDate(holiday.date)}
                    className={selectedHolidaySet.has(holiday.date) ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  >
                    {holiday.label} ({holiday.date})
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-3">Journées internationales</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {internationalHolidays.map((holiday) => (
                  <Button
                    key={`${holiday.date}-${holiday.label}`}
                    variant={selectedHolidaySet.has(holiday.date) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => addHolidayDate(holiday.date)}
                    className={selectedHolidaySet.has(holiday.date) ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  >
                    {holiday.label} ({holiday.date})
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-3">Jours religieux (Islam)</h3>
              {islamicHolidays.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun jour religieux chargé depuis l'API pour cette année.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {islamicHolidays.map((holiday) => (
                    <Button
                      key={`${holiday.date}-${holiday.label}`}
                      variant={selectedHolidaySet.has(holiday.date) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => addHolidayDate(holiday.date)}
                      className={selectedHolidaySet.has(holiday.date) ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                    >
                      {holiday.label} ({holiday.date})
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="font-medium mb-3">Ajouter une autre date manuellement</h3>
              <div className="flex gap-2 mb-3">
                <Input
                  type="date"
                  value={customHolidayDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomHolidayDate(e.target.value)}
                  className="max-w-xs"
                />
                <Button onClick={() => addHolidayDate(customHolidayDate)} className="bg-emerald-700 hover:bg-emerald-800">
                  Ajouter
                </Button>
              </div>

              {settings.holidays.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Dates sélectionnées:</p>
                  <div className="space-y-1">
                    {settings.holidays.map((holiday) => (
                      <div key={holiday} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm">{holiday}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeHoliday(holiday)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          onClick={saveSettings}
          disabled={saving}
          className="gap-2 bg-emerald-700 hover:bg-emerald-800"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
        </Button>
      </div>
    </div>
  );
}
