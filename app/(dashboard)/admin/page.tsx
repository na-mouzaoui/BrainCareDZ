'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { users as usersApi, activityLogs } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertCircle, Plus, Trash2, Edit2, ChevronDown, ChevronUp, Loader2, Shield, Save, Users, Clock, History } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'practitioner' | 'receptionist';
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

interface NewUserForm {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'practitioner' | 'receptionist';
  phone: string;
}

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

interface ActivityLogEntry {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceName?: string;
  createdAt: string;
  status: string;
}

interface HolidayOption {
  date: string;
  label: string;
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
  { md: '05-26', label: 'Fête des mères' },
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

function getActionLabel(action: string): string {
  const labels: { [key: string]: string } = {
    'CREATE': 'Créé',
    'READ': 'Consulté',
    'UPDATE': 'Modifié',
    'DELETE': 'Supprimé',
    'LOGIN': 'Connexion',
    'LOGOUT': 'Déconnexion',
    'SETTINGS_CHANGED': 'Paramètres modifiés',
  };
  return labels[action] || action;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<NewUserForm>({
    name: '',
    email: '',
    password: '',
    role: 'practitioner',
    phone: '',
  });

  // Settings state
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Holiday state
  const [customHolidayDate, setCustomHolidayDate] = useState('');
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const [loadingHolidays, setLoadingHolidays] = useState(false);

  const [nationalHolidays, setNationalHolidays] = useState<HolidayOption[]>([]);
  const [internationalHolidays, setInternationalHolidays] = useState<HolidayOption[]>([]);
  const [islamicHolidays, setIslamicHolidays] = useState<HolidayOption[]>([]);
  
  // Track selected Islamic holiday names (independent of year)
  const [selectedIslamicHolidayNames, setSelectedIslamicHolidayNames] = useState<Set<string>>(new Set());

  const selectedHolidaySet = useMemo(() => new Set(settings.holidays), [settings.holidays]);

  // Activity logs state
  const [activityLogsList, setActivityLogsList] = useState<ActivityLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Navigation state
  const [activeTab, setActiveTab] = useState('users');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/dashboard');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadUsers();
      loadSettings();
      loadActivityLogs();
    }
  }, [user]);

  useEffect(() => {
    loadHolidaySources(holidayYear);
  }, [holidayYear]);

  async function loadUsers() {
    setLoading(true);
    try {
      const response = await usersApi.getAll();
      if (response.success && response.data) {
        setUsers(response.data.users || []);
      }
    } catch (err) {
      setError('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    try {
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

      // Load selected Islamic holiday names
      const savedIslamicNames = localStorage.getItem('selected-islamic-holidays');
      if (savedIslamicNames) {
        try {
          const names = JSON.parse(savedIslamicNames) as string[];
          setSelectedIslamicHolidayNames(new Set(names));
        } catch {
          // Silent fail if JSON parse fails
        }
      }
    } catch {
      setError('Erreur lors du chargement des paramètres');
    }
  }

  async function loadHolidaySources(year: number) {
    setLoadingHolidays(true);
    try {
      const [national, islamic] = await Promise.all([
        loadNationalHolidays(year),
        loadIslamicHolidays(year),
      ]);

      const dedupedNational = dedupeHolidayOptions(national);
      const dedupedIslamic = dedupeHolidayOptions(islamic);
      const internationalList = buildFixedHolidayList(year, INTERNATIONAL_FIXED_MMDD);

      setNationalHolidays(dedupedNational);
      setIslamicHolidays(dedupedIslamic);
      setInternationalHolidays(internationalList);

      // Resynchronize selected Islamic holidays with new year dates
      resynchronizeIslamicHolidays(dedupedIslamic, selectedIslamicHolidayNames, dedupedNational, internationalList);
    } catch {
      setNationalHolidays(buildFixedHolidayList(year, NATIONAL_FIXED_MMDD));
      setIslamicHolidays([]);
      setInternationalHolidays(buildFixedHolidayList(year, INTERNATIONAL_FIXED_MMDD));
    } finally {
      setLoadingHolidays(false);
    }
  }

  function resynchronizeIslamicHolidays(
    islamicList: HolidayOption[],
    selectedNames: Set<string>,
    nationalList: HolidayOption[],
    internationalList: HolidayOption[]
  ) {
    if (selectedNames.size === 0 || islamicList.length === 0) return;

    setSettings((prev) => {
      // Get all national and international holiday dates
      const nationalDates = new Set(nationalList.map((h) => h.date));
      const internationalDates = new Set(internationalList.map((h) => h.date));

      // Keep dates that are national or international holidays
      let newHolidays = prev.holidays.filter((date) =>
        nationalDates.has(date) || internationalDates.has(date)
      );

      // Add selected Islamic holidays (with extra days for Eid)
      for (const name of selectedNames) {
        const holiday = islamicList.find((h) => h.label === name);
        if (holiday) {
          const extraDays = getEidExtraDays(holiday.date, name);
          newHolidays = dedupeDateList([...newHolidays, holiday.date, ...extraDays]);
        }
      }

      return {
        ...prev,
        holidays: newHolidays,
      };
    });
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

    // Filter for specific Islamic holidays - more flexible matching
    const allowedPatterns = [
      /fitr/i,
      /adha/i,
      /muharram/i,
      /arafah/i,
      /mawlid|mouloud|maouloud/i,
      /ashura|achoura|ashura|muharram/i,
    ];

    const options: HolidayOption[] = [];
    const seenDates = new Set<string>();

    for (const payload of payloads) {
      const days = payload.data || [];
      for (const day of days) {
        const names = day.hijri?.holidays || [];
        const gregorian = day.gregorian?.date;
        const isoDate = gregorian ? parseDdMmYyyyToIso(gregorian) : null;
        if (!isoDate || names.length === 0) continue;

        for (const name of names) {
          // Keep only allowed Islamic holidays using pattern matching
          if (allowedPatterns.some((pattern) => pattern.test(name))) {
            // Avoid duplicates for same date with different names
            if (!seenDates.has(isoDate)) {
              options.push({
                date: isoDate,
                label: `${name}`,
              });
              seenDates.add(isoDate);
            }
          }
        }
      }
    }

    return options;
  }

  async function loadActivityLogs() {
    setLoadingLogs(true);
    try {
      const response = await activityLogs.getAll(100);
      if (response.success && response.data) {
        setActivityLogsList(response.data.logs || []);
      }
    } catch (err) {
      // Activity logs are optional - don't error on failure
    } finally {
      setLoadingLogs(false);
    }
  }

  async function saveSettings() {
    try {
      setSettingsSaving(true);
      setError('');
      localStorage.setItem('practice-settings', JSON.stringify(settings));
      // Save selected Islamic holiday names
      localStorage.setItem('selected-islamic-holidays', JSON.stringify(Array.from(selectedIslamicHolidayNames)));
      setSuccess('Paramètres sauvegardés avec succès!');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Erreur lors de la sauvegarde');
    } finally {
      setSettingsSaving(false);
    }
  }

  const handleInputChange = (field: keyof NewUserForm, value: string) => {
    setError('');
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

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
    // Reset the manual date input
    setCustomHolidayDate('');
  }

  function toggleHolidayDate(date: string) {
    if (selectedHolidaySet.has(date)) {
      removeHoliday(date);
    } else {
      addHolidayDate(date);
    }
  }

  function getEidExtraDays(baseDate: string, label: string): string[] {
    // Eid holidays extend for 3 days (base day + 2 extra days)
    const isEid = /fitr|adha/i.test(label);
    if (!isEid) return [];

    const date = new Date(baseDate);
    const extraDays: string[] = [];
    for (let i = 1; i <= 2; i++) {
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + i);
      extraDays.push(nextDate.toISOString().split('T')[0]);
    }
    return extraDays;
  }

  function toggleIslamicHoliday(label: string) {
    if (selectedIslamicHolidayNames.has(label)) {
      // Remove from selected Islamic holidays and from settings
      const newIslamicSet = new Set(selectedIslamicHolidayNames);
      newIslamicSet.delete(label);
      setSelectedIslamicHolidayNames(newIslamicSet);

      // Also remove from settings.holidays (all dates matching this label + extra days)
      const islamicDay = islamicHolidays.find((day) => day.label === label);
      if (islamicDay) {
        const extraDays = getEidExtraDays(islamicDay.date, label);
        const datesToRemove = new Set([islamicDay.date, ...extraDays]);
        setSettings((prev) => ({
          ...prev,
          holidays: prev.holidays.filter((h) => !datesToRemove.has(h)),
        }));
      }
    } else {
      // Add to selected Islamic holidays
      const newIslamicSet = new Set(selectedIslamicHolidayNames);
      newIslamicSet.add(label);
      setSelectedIslamicHolidayNames(newIslamicSet);

      // Find the date for this year and add it (with extra days for Eid)
      const islamicDay = islamicHolidays.find((day) => day.label === label);
      if (islamicDay) {
        const extraDays = getEidExtraDays(islamicDay.date, label);
        setSettings((prev) => ({
          ...prev,
          holidays: dedupeDateList([...prev.holidays, islamicDay.date, ...extraDays]),
        }));
      }
    }
  }

  function removeHoliday(date: string) {
    setSettings((prev) => ({
      ...prev,
      holidays: prev.holidays.filter((h) => h !== date),
    }));
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Le nom est requis');
      return;
    }
    if (!formData.email.trim()) {
      setError('L\'email est requis');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (!formData.role) {
      setError('Le rôle est requis');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await usersApi.create(formData);
      if (response.success) {
        await loadUsers();
        setFormData({
          name: '',
          email: '',
          password: '',
          role: 'practitioner',
          phone: '',
        });
      } else {
        setError(response.error || 'Erreur lors de la création de l\'utilisateur');
      }
    } catch (err) {
      setError('Erreur lors de la création de l\'utilisateur');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      return;
    }

    try {
      const response = await usersApi.delete(id);
      if (response.success) {
        await loadUsers();
      } else {
        setError('Erreur lors de la suppression');
      }
    } catch (err) {
      setError('Erreur lors de la suppression');
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: { [key: string]: string } = {
      admin: 'Administrateur',
      practitioner: 'Praticien',
      receptionist: 'Réceptionniste',
    };
    return labels[role] || role;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (authLoading || (user?.role === 'admin' && loading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Accès refusé. Seuls les administrateurs peuvent accéder à cette page.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Administration</h1>
        <p className="text-gray-600 mt-1">Gérez les utilisateurs, les paramètres et les journaux d'activité</p>
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

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 bg-emerald-100">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Utilisateurs</span>
          </TabsTrigger>
          <TabsTrigger value="workHours" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Horaires de travail</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span>Journaux des logs</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Content - Users */}
        <TabsContent value="users" className="space-y-6">
          <div className="border border-emerald-200 rounded-lg overflow-hidden">
            <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-200">
              <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Gestion des utilisateurs
                <span className="text-sm font-normal text-emerald-700">({users.length})</span>
              </h2>
            </div>
            <div className="p-6 space-y-6">
            {/* Add User Form */}
            <Card className="bg-emerald-50 border-emerald-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Ajouter un nouvel utilisateur
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel>Nom complet *</FieldLabel>
                      <Input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        disabled={isSubmitting}
                        required
                        placeholder="Jean Dupont"
                      />
                    </Field>

                    <Field>
                      <FieldLabel>Email *</FieldLabel>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        disabled={isSubmitting}
                        required
                        placeholder="jean@exemple.com"
                      />
                    </Field>

                    <Field>
                      <FieldLabel>Mot de passe *</FieldLabel>
                      <Input
                        type="password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        disabled={isSubmitting}
                        required
                        minLength={6}
                        placeholder="Minimum 6 caractères"
                      />
                    </Field>

                    <Field>
                      <FieldLabel>Rôle *</FieldLabel>
                      <Select
                        value={formData.role}
                        onValueChange={(value) => handleInputChange('role', value as any)}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrateur</SelectItem>
                          <SelectItem value="practitioner">Praticien</SelectItem>
                          <SelectItem value="receptionist">Réceptionniste</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel>Téléphone</FieldLabel>
                      <Input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        disabled={isSubmitting}
                        placeholder="+213 XX XX XX XX"
                      />
                    </Field>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full gap-2 bg-emerald-700 hover:bg-emerald-800"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Création en cours...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Créer l'utilisateur
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Users Table */}
            {users.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-emerald-300 rounded-lg">
                <p className="text-gray-500">Aucun utilisateur trouvé</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-emerald-200 rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-emerald-50">
                      <TableHead>Nom</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date d'ajout</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-sm">{u.email}</TableCell>
                        <TableCell>
                          <span className="inline-block px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">
                            {getRoleLabel(u.role)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${
                              u.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {u.isActive ? 'Actif' : 'Inactif'}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{formatDate(u.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            </div>
          </div>
        </TabsContent>

        {/* Tab Content - Work Hours and Settings */}
        <TabsContent value="workHours" className="space-y-6">
          <div className="border border-emerald-200 rounded-lg overflow-hidden">
            <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-200">
              <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Jours et horaires de travail
              </h2>
            </div>
            <div className="p-6">
              {/* Grid layout for main settings */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Consultation Duration */}
                  <div>
                    <h3 className="font-medium mb-4 text-emerald-900">Durée de consultation</h3>
                    <div>
                      <Label htmlFor="duration">Durée par défaut (minutes)</Label>
                      <Input
                        id="duration"
                        type="number"
                        min="15"
                        step="15"
                        value={settings.consultationDuration}
                        onChange={(e) =>
                          setSettings({ ...settings, consultationDuration: parseInt(e.target.value || '60', 10) })
                        }
                        className="mt-2 max-w-xs"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="font-medium mb-4 text-emerald-900">Horaires de travail</h4>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="work-start">Début de journée (24h)</Label>
                        <Input
                          id="work-start"
                          type="time"
                          value={settings.workStartTime}
                          onChange={(e) => setSettings({ ...settings, workStartTime: e.target.value })}
                          className="mt-2 max-w-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor="work-end">Fin de journée (24h)</Label>
                        <Input
                          id="work-end"
                          type="time"
                          value={settings.workEndTime}
                          onChange={(e) => setSettings({ ...settings, workEndTime: e.target.value })}
                          className="mt-2 max-w-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-4 text-emerald-900">Pause déjeuner</h4>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="has-break"
                          checked={settings.hasBreakfastBreak}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, hasBreakfastBreak: checked as boolean })
                          }
                        />
                        <Label htmlFor="has-break" className="cursor-pointer font-medium text-sm">
                          Ajouter une pause déjeuner
                        </Label>
                      </div>

                      {settings.hasBreakfastBreak && (
                        <div className="space-y-3 pl-6 border-l-2 border-emerald-600">
                          <div>
                            <Label htmlFor="break-start">Début (24h)</Label>
                            <Input
                              id="break-start"
                              type="time"
                              value={settings.breakfastBreakStart || '12:00'}
                              onChange={(e) =>
                                setSettings({ ...settings, breakfastBreakStart: e.target.value })
                              }
                              className="mt-2 max-w-xs"
                            />
                          </div>
                          <div>
                            <Label htmlFor="break-end">Fin (24h)</Label>
                            <Input
                              id="break-end"
                              type="time"
                              value={settings.breakfastBreakEnd || '13:00'}
                              onChange={(e) =>
                                setSettings({ ...settings, breakfastBreakEnd: e.target.value })
                              }
                              className="mt-2 max-w-xs"
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
                            Supprimer
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="font-medium mb-4 text-emerald-900">Jours de week-end</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {DAYS.map((day, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <Checkbox
                            id={`day-${index}`}
                            checked={settings.weekendDays.includes(index)}
                            onCheckedChange={() => toggleWeekendDay(index)}
                          />
                          <Label htmlFor={`day-${index}`} className="cursor-pointer text-sm">
                            {day}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Holidays section - full width */}
              <div className="border-t pt-8">
                <h4 className="font-medium mb-4 text-emerald-900">Jours fériés (Algérie)</h4>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Label htmlFor="holiday-year">Année</Label>
                    <Input
                      id="holiday-year"
                      type="number"
                      min="2020"
                      max="2100"
                      value={holidayYear}
                      onChange={(e) => setHolidayYear(parseInt(e.target.value || `${new Date().getFullYear()}`, 10))}
                      className="w-28 h-9"
                    />
                    {loadingHolidays && <p className="text-sm text-gray-500">Chargement...</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h5 className="font-medium mb-3 text-sm">Jours nationaux</h5>
                      <div className="space-y-2">
                        {nationalHolidays.map((holiday) => (
                          <div key={`${holiday.date}-${holiday.label}`} className="flex items-center space-x-2">
                            <Checkbox
                              id={`national-${holiday.date}`}
                              checked={selectedHolidaySet.has(holiday.date)}
                              onCheckedChange={() => toggleHolidayDate(holiday.date)}
                            />
                            <label
                              htmlFor={`national-${holiday.date}`}
                              className="text-sm cursor-pointer"
                            >
                              {holiday.label} ({holiday.date})
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium mb-3 text-sm">Journées internationales</h5>
                      <div className="space-y-2">
                        {internationalHolidays.map((holiday) => (
                          <div key={`${holiday.date}-${holiday.label}`} className="flex items-center space-x-2">
                            <Checkbox
                              id={`international-${holiday.date}`}
                              checked={selectedHolidaySet.has(holiday.date)}
                              onCheckedChange={() => toggleHolidayDate(holiday.date)}
                            />
                            <label
                              htmlFor={`international-${holiday.date}`}
                              className="text-sm cursor-pointer"
                            >
                              {holiday.label} ({holiday.date})
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium mb-3 text-sm">Jours religieux (Islam)</h5>
                      {islamicHolidays.length === 0 ? (
                        <p className="text-sm text-gray-500">Aucun jour religieux</p>
                      ) : (
                        <div className="space-y-2">
                          {islamicHolidays.map((holiday) => (
                            <div key={`${holiday.date}-${holiday.label}`} className="flex items-center space-x-2">
                              <Checkbox
                                id={`islamic-${holiday.label}`}
                                checked={selectedIslamicHolidayNames.has(holiday.label)}
                                onCheckedChange={() => toggleIslamicHoliday(holiday.label)}
                              />
                              <label
                                htmlFor={`islamic-${holiday.label}`}
                                className="text-sm cursor-pointer"
                              >
                                {holiday.label} ({holiday.date})
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h5 className="font-medium mb-3 text-sm">Ajouter une date manuellement</h5>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={customHolidayDate}
                        onChange={(e) => setCustomHolidayDate(e.target.value)}
                        className="max-w-xs"
                      />
                      <Button onClick={() => addHolidayDate(customHolidayDate)} className="bg-emerald-700 hover:bg-emerald-800">
                        Ajouter
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab Content - Activity Logs */}
        <TabsContent value="logs" className="space-y-6">
          <div className="border border-emerald-200 rounded-lg overflow-hidden">
            <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-200">
              <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
                <History className="h-5 w-5" />
                Journaux d'activité
              </h2>
            </div>
            <div className="p-6">
            {loadingLogs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
              </div>
            ) : activityLogsList.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-emerald-300 rounded-lg">
                <p className="text-gray-500">Aucun log d'activité trouvé</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-emerald-200 rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-emerald-50">
                      <TableHead>Date & Heure</TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityLogsList.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">{formatDate(log.createdAt)}</TableCell>
                        <TableCell className="font-medium">{log.userName || 'Unknown'}</TableCell>
                        <TableCell className="text-sm">{log.userEmail || 'N/A'}</TableCell>
                        <TableCell className="text-sm">
                          <span className="inline-block px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                            {getActionLabel(log.action)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{log.resource}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                              log.status === 'success'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {log.status === 'success' ? 'Réussi' : 'Erreur'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Save All Settings Button */}
      <div className="flex gap-3 mt-6">
        <Button
          onClick={saveSettings}
          disabled={settingsSaving}
          className="gap-2 bg-emerald-700 hover:bg-emerald-800"
        >
          <Save className="h-4 w-4" />
          {settingsSaving ? 'Sauvegarde...' : 'Sauvegarder tous les paramètres'}
        </Button>
      </div>
    </div>
  );
}
