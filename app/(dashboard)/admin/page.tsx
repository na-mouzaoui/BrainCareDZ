'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { users as usersApi, activityLogs, services as servicesApi, calendarSettings as calendarSettingsApi } from '@/lib/api';
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
import { AlertCircle, Plus, Trash2, Edit2, Shield, Save, Users, Clock, History, RefreshCw, Briefcase, Stethoscope, KeyRound, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { ListPageSkeleton } from '@/components/page-skeletons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getPatientLists, savePatientLists, DEFAULT_LISTS, type PatientLists } from '@/lib/patient-lists';
import { useSort, SortableHeader } from '@/components/sortable-header';
import ServiceForm, { type ServiceFormData } from '@/components/service-form';
import { Badge } from '@/components/ui/badge';

interface User {
  id: string;
  name: string;
  pseudo: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'psy' | 'coach';
  phone?: string;
  createdAt: string;
  patientCount?: number;
}

interface Service {
  id: string;
  name: string;
}

interface NewUserForm {
  firstName: string;
  lastName: string;
  role: 'admin' | 'psy' | 'coach';
  phone: string;
  serviceIds: string[];
}

interface CalendarSetting {
  calendar_role: string;
  work_start_time: string;
  work_end_time: string;
  consultation_duration: number;
  weekend_days: number[];
  has_breakfast_break: boolean;
  breakfast_break_start?: string;
  breakfast_break_end?: string;
}

interface ActivityLogEntry {
  id: string;
  userId: string;
  userName: string;
  userPseudo?: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceName?: string;
  createdAt: string;
  status: string;
}

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const DEFAULT_CALENDAR_SETTING: CalendarSetting = {
  calendar_role: '',
  work_start_time: '08:00',
  work_end_time: '18:00',
  consultation_duration: 60,
  weekend_days: [5, 6],
  has_breakfast_break: false,
};

const CALENDAR_ROLES = [
  { key: 'admin', label: 'Admin', color: 'brand' },
  { key: 'psy', label: 'Psy', color: 'brand' },
  { key: 'coach', label: 'Coach', color: 'brand' },
];

function getActionLabel(action: string): string {
  const labels: { [key: string]: string } = {
    'CREATE': 'Création',
    'READ': 'Consultation',
    'UPDATE': 'Modification',
    'DELETE': 'Suppression',
    'INSERT': 'Création',
    'REGISTER': 'Inscription',
    'LOGIN': 'Connexion',
    'LOGOUT': 'Déconnexion',
    'CANCEL': 'Annulation',
    'COMPLETE': 'Prise en charge',
    'USE_SESSION': 'Séance utilisée',
    'SETTINGS_CHANGED': 'Paramètres modifiés',
  };
  return labels[action] || action;
}

function getResourceLabel(resource: string): string {
  const labels: { [key: string]: string } = {
    'user': 'Utilisateur',
    'user-password': 'Mot de passe',
    'patient': 'Patient',
    'service': 'Service',
    'appointment': 'Rendez-vous',
    'session-note': 'Compte rendu',
    'invoice': 'Facture',
    'payment': 'Paiement',
    'expense': 'Dépense',
    'company': 'Société',
    'company-invoice': 'Facture société',
    'patient-pack': 'Pack',
    'patient-pack-usage': 'Utilisation pack',
    'patient-pack-share': 'Partage pack',
    'patient-outcome': 'Évaluation patient',
    'waiting-list': 'Liste d\'attente',
    'profession': 'Profession',
    'motif': 'Motif',
    'patient-motif': 'Motif patient',
    'practitioner-service': 'Service praticien',
    'auth': 'Authentification',
    'appointment-patient': 'Patient RDV',
    'activity-log': 'Journal d\'activité',
  };
  return labels[resource] || resource;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [allServices, setAllServices] = useState<Service[]>([]);
  const [serviceCreateOpen, setServiceCreateOpen] = useState(false);
  const [serviceEditOpen, setServiceEditOpen] = useState(false);
  const [serviceEditingId, setServiceEditingId] = useState<string | null>(null);
  const [serviceEditData, setServiceEditData] = useState<ServiceFormData | null>(null);
  const [serviceDeleteTarget, setServiceDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState<{
    firstName: string;
    lastName: string;
    role: 'admin' | 'psy' | 'coach';
    phone: string;
    serviceIds: string[];
  }>({ firstName: '', lastName: '', role: 'psy', phone: '', serviceIds: [] });

  const [formData, setFormData] = useState<NewUserForm>({
    firstName: '',
    lastName: '',
    role: 'psy',
    phone: '',
    serviceIds: [],
  });

  // Settings state
  const [calendarSettings, setCalendarSettings] = useState<CalendarSetting[]>([]);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [calendarIdx, setCalendarIdx] = useState(0);

  // Patient lists state
  const [patientLists, setPatientLists] = useState<PatientLists>(DEFAULT_LISTS);
  const [newProfession, setNewProfession] = useState('');
  const [newMotif, setNewMotif] = useState('');
  const [listsSaving, setListsSaving] = useState(false);

  // Activity logs state
  const [activityLogsList, setActivityLogsList] = useState<ActivityLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsOffset, setLogsOffset] = useState(0);
  const [logsLimit] = useState(50);
  const [logFilterAction, setLogFilterAction] = useState('all');
  const [logFilterResource, setLogFilterResource] = useState('all');
  const [logFilterSearch, setLogFilterSearch] = useState('');

  const usersSort = useSort(
    users,
    {
      name: (u) => u.name,
      pseudo: (u) => u.pseudo,
      role: (u) => u.role,
      patientCount: (u) => u.patientCount ?? 0,
      createdAt: (u) => u.createdAt || '',
    },
    'name'
  );

  const filteredLogs = useMemo(() => {
    if (!logFilterSearch.trim()) return activityLogsList;
    const q = logFilterSearch.toLowerCase();
    return activityLogsList.filter((l) =>
      (l.userName || '').toLowerCase().includes(q) ||
      (l.userPseudo || '').toLowerCase().includes(q) ||
      (l.resourceName || '').toLowerCase().includes(q) ||
      (l.resource || '').toLowerCase().includes(q) ||
      (l.action || '').toLowerCase().includes(q)
    );
  }, [activityLogsList, logFilterSearch]);

  const logsSort = useSort(
    filteredLogs,
    {
      userPseudo: (l) => l.userPseudo || l.userName || '',
      action: (l) => l.action || '',
      resource: (l) => l.resource || '',
      date: (l) => l.createdAt || '',
    },
    'date'
  );

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
      loadServices();
      loadPatientLists();
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadActivityLogs();
    }
  }, [user, logsOffset, logFilterAction, logFilterResource]);

  async function loadServices() {
    try {
      const response = await servicesApi.getAll();
      if (response.success && response.data) {
        setAllServices(Array.isArray(response.data) ? response.data : response.data.services || []);
      }
    } catch {
      // Services loading is optional
    }
  }

  async function handleServiceCreate(data: ServiceFormData) {
    const response = await servicesApi.create(data);
    if (!response.success) throw new Error(response.message || 'Échec de la création');
    setServiceCreateOpen(false);
    loadServices();
  }

  async function handleServiceUpdate(data: ServiceFormData) {
    if (!serviceEditingId) return;
    const response = await servicesApi.update(serviceEditingId, data);
    if (!response.success) throw new Error(response.message || 'Échec de la modification');
    setServiceEditOpen(false);
    setServiceEditingId(null);
    setServiceEditData(null);
    loadServices();
  }

  async function handleServiceDelete() {
    if (!serviceDeleteTarget) return;
    const response = await servicesApi.delete(serviceDeleteTarget.id);
    if (response.success) {
      setServiceDeleteTarget(null);
      loadServices();
    }
  }

  async function loadPatientLists() {
    try {
      const lists = await getPatientLists();
      setPatientLists(lists);
    } catch {
      // Keep current state (defaults)
    }
  }


  async function loadUsers() {
    setLoading(true);
    try {
      const response = await usersApi.getAll();
      if (response.success && response.data) {
        setUsers(response.data.users || []);
      } else {
        setError(response.error || 'Erreur lors du chargement des utilisateurs');
      }
    } catch (err) {
      setError('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    try {
      const response = await calendarSettingsApi.getAll();
      if (response.success && response.data) {
        setCalendarSettings(response.data);
      }
    } catch {
      // Use defaults
    }
  }

  async function loadActivityLogs() {
    setLoadingLogs(true);
    try {
      const filters: any = {};
      if (logFilterAction && logFilterAction !== 'all') filters.action = logFilterAction;
      if (logFilterResource && logFilterResource !== 'all') filters.resource = logFilterResource;
      const response = await activityLogs.getAll(logsLimit, logsOffset, filters);
      if (response.success && response.data) {
        setActivityLogsList(response.data.logs || []);
        setLogsTotal(response.data.total || 0);
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
      for (const s of calendarSettings) {
        await calendarSettingsApi.update(s.calendar_role, {
          workStartTime: s.work_start_time,
          workEndTime: s.work_end_time,
          consultationDuration: s.consultation_duration,
          weekendDays: s.weekend_days,
          hasBreakfastBreak: s.has_breakfast_break,
          breakfastBreakStart: s.breakfast_break_start || null,
          breakfastBreakEnd: s.breakfast_break_end || null,
        });
      }
      setSuccess('Paramètres sauvegardés avec succès!');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Erreur lors de la sauvegarde');
    } finally {
      setSettingsSaving(false);
    }
  }

  function addProfession() {
    const value = newProfession.trim();
    if (!value) return;
    setPatientLists((prev) => ({
      ...prev,
      professions: prev.professions.includes(value) ? prev.professions : [...prev.professions, value],
    }));
    setNewProfession('');
  }

  function removeProfession(value: string) {
    setPatientLists((prev) => ({
      ...prev,
      professions: prev.professions.filter((p) => p !== value),
    }));
  }

  function addMotif() {
    const value = newMotif.trim();
    if (!value) return;
    setPatientLists((prev) => ({
      ...prev,
      motifs: prev.motifs.includes(value) ? prev.motifs : [...prev.motifs, value],
    }));
    setNewMotif('');
  }

  function removeMotif(value: string) {
    setPatientLists((prev) => ({
      ...prev,
      motifs: prev.motifs.filter((m) => m !== value),
    }));
  }

  function saveLists() {
    setListsSaving(true);
    try {
      savePatientLists(patientLists).then((ok) => {
        if (ok) {
          setSuccess('Listes sauvegardées avec succès!');
          setTimeout(() => setSuccess(''), 3000);
        } else {
          setError('Erreur lors de la sauvegarde des listes');
        }
        setListsSaving(false);
      });
    } catch {
      setError('Erreur lors de la sauvegarde des listes');
      setListsSaving(false);
    }
  }

  const handleInputChange = (field: keyof NewUserForm, value: string) => {
    setError('');
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'role' && value === 'admin' ? { serviceIds: [] } : {}),
    }));
  };

  function toggleWeekendDay(role: string, day: number) {
    setCalendarSettings((prev) =>
      prev.map((s) =>
        s.calendar_role === role
          ? {
              ...s,
              weekend_days: s.weekend_days.includes(day)
                ? s.weekend_days.filter((d) => d !== day)
                : [...s.weekend_days, day],
            }
          : s
      )
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.firstName.trim()) {
      setError('Le prénom est requis');
      return;
    }
    if (!formData.lastName.trim()) {
      setError('Le nom est requis');
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
        const resourceName = `${formData.firstName} ${formData.lastName}`;
        activityLogs.create({ action: 'CREATE', resource: 'user', resourceName, status: 'success' }).catch(() => {});
        setIsCreateOpen(false);
        setFormData({
          firstName: '',
          lastName: '',
          role: 'psy',
          phone: '',
          serviceIds: [],
        });
        setSuccess('Utilisateur créé avec succès!');
        setTimeout(() => setSuccess(''), 3000);
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
        activityLogs.create({ action: 'DELETE', resource: 'user', resourceName: users.find(u => u.id === id)?.name || 'User', status: 'success' }).catch(() => {});
      } else {
        setError('Erreur lors de la suppression');
      }
    } catch (err) {
      setError('Erreur lors de la suppression');
    }
  };

  const handleResetPassword = async (id: string, name: string) => {
    if (!confirm(`Réinitialiser le mot de passe de ${name} à "123456789" ?`)) {
      return;
    }

    try {
      const response = await usersApi.updatePassword(id, '123456789');
      if (response.success) {
        setSuccess(`Mot de passe de ${name} réinitialisé à "123456789"`);
        setTimeout(() => setSuccess(''), 3000);
        activityLogs.create({ action: 'UPDATE', resource: 'user-password', resourceName: name, status: 'success' }).catch(() => {});
      } else {
        setError('Erreur lors de la réinitialisation du mot de passe');
      }
    } catch (err) {
      setError('Erreur lors de la réinitialisation du mot de passe');
    }
  };

  function handleEditUser(user: User) {
    setEditingUser(user);
    setEditFormData({
      firstName: user.firstName || user.name.split(' ')[0] || '',
      lastName: user.lastName || user.name.split(' ').slice(1).join(' ') || '',
      role: user.role,
      phone: user.phone || '',
      serviceIds: (user as any).services?.map((s: any) => s.id) || [],
    });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setError('');

    try {
      const response = await usersApi.update(editingUser.id, editFormData);
      if (response.success) {
        await loadUsers();
        const resourceName = `${editFormData.firstName} ${editFormData.lastName}`;
        activityLogs.create({ action: 'UPDATE', resource: 'user', resourceName, status: 'success' }).catch(() => {});
        setEditingUser(null);
        setSuccess('Utilisateur modifié avec succès!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Erreur lors de la modification');
      }
    } catch {
      setError('Erreur lors de la modification');
    }
  }

  function toggleEditService(serviceId: string) {
    setEditFormData((prev) => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter((id) => id !== serviceId)
        : [...prev.serviceIds, serviceId],
    }));
  }

  const getRoleLabel = (role: string) => {
    const labels: { [key: string]: string } = {
      admin: 'Admin',
      psy: 'Psy',
      coach: 'Coach',
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
    return <ListPageSkeleton />;
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Administration</h1>
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
        <TabsList className="grid w-full grid-cols-3 h-auto min-h-9 py-1 mb-4 sm:mb-6 bg-brand-100">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0" />
            <span className="truncate">Utilisateurs</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4 shrink-0" />
            <span className="truncate">Paramètres</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <History className="h-4 w-4 shrink-0" />
            <span className="truncate"><span className="sm:hidden">Journal</span><span className="hidden sm:inline">Journal d'activité</span></span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Content - Users */}
        <TabsContent value="users" className="space-y-6">
          <div className="border border-brand-200 rounded-lg overflow-hidden">
            <div className="bg-brand-50 px-4 py-3 sm:px-6 sm:py-4 border-b border-brand-200">
              <h2 className="text-lg font-semibold text-brand-900 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Gestion des utilisateurs
                <span className="text-sm font-normal text-brand-700">({users.length})</span>
              </h2>
            </div>
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setFormData({ firstName: '', lastName: '', role: 'psy', phone: '', serviceIds: [] });
                  setError('');
                  setIsCreateOpen(true);
                }}
                className="gap-2 bg-brand-700 hover:bg-brand-800"
              >
                <Plus className="h-4 w-4" />
                Ajouter un utilisateur
              </Button>
            </div>

            {/* Users Table */}
            {users.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-brand-300 rounded-lg">
                <p className="text-gray-500">Aucun utilisateur trouvé</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-brand-200 rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-brand-50">
                      <SortableHeader label="Prénom" sortKey="name" currentSortKey={usersSort.sortKey} direction={usersSort.direction} onSort={usersSort.toggleSort} />
                      <SortableHeader label="Nom" sortKey="pseudo" currentSortKey={usersSort.sortKey} direction={usersSort.direction} onSort={usersSort.toggleSort} className="hidden md:table-cell" />
                      <SortableHeader label="Pseudo" sortKey="pseudo" currentSortKey={usersSort.sortKey} direction={usersSort.direction} onSort={usersSort.toggleSort} className="hidden md:table-cell" />
                      <SortableHeader label="Rôle" sortKey="role" currentSortKey={usersSort.sortKey} direction={usersSort.direction} onSort={usersSort.toggleSort} />
                      <SortableHeader label="Date d'ajout" sortKey="createdAt" currentSortKey={usersSort.sortKey} direction={usersSort.direction} onSort={usersSort.toggleSort} className="hidden lg:table-cell" />
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersSort.sortedItems.map((u) => (
                      <TableRow key={u.id} className="cursor-pointer" onClick={() => handleEditUser(u)}>
                        <TableCell className="font-medium">{u.firstName || u.name.split(' ')[0]}</TableCell>
                        <TableCell className="hidden md:table-cell">{u.lastName || u.name.split(' ').slice(1).join(' ')}</TableCell>
                        <TableCell className="text-sm text-gray-600 hidden md:table-cell">{u.pseudo}</TableCell>
                        <TableCell>
                          <span className="inline-block px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">
                            {getRoleLabel(u.role)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 hidden lg:table-cell">{formatDate(u.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditUser(u)}
                              className="text-brand-600 hover:text-brand-800 hover:bg-brand-50"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetPassword(u.id, u.name)}
                              title="Réinitialiser le mot de passe à 123456789"
                              className="text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

        {/* Tab Content - Calendar Settings per Role */}
        <TabsContent value="settings" className="space-y-6">
          <div className="border border-brand-200 rounded-lg overflow-hidden">
            {/* Header with arrows */}
            <div className="bg-brand-50 px-4 py-3 sm:px-6 sm:py-4 border-b border-brand-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCalendarIdx((i) => Math.max(0, i - 1))}
                disabled={calendarIdx === 0}
                className="h-8 w-8 rounded-full bg-white border shadow-sm flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="text-lg font-semibold text-brand-900 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Calendrier {CALENDAR_ROLES[calendarIdx].label}
              </h2>
              <button
                type="button"
                onClick={() => setCalendarIdx((i) => Math.min(CALENDAR_ROLES.length - 1, i + 1))}
                disabled={calendarIdx === CALENDAR_ROLES.length - 1}
                className="h-8 w-8 rounded-full bg-white border shadow-sm flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {/* Dots */}
            <div className="flex justify-center gap-2 pt-3">
              {CALENDAR_ROLES.map((r, i) => (
                <button
                  key={r.key}
                  onClick={() => setCalendarIdx(i)}
                  className={`w-2.5 h-2.5 rounded-full transition ${i === calendarIdx ? 'bg-brand-700' : 'bg-brand-300'}`}
                />
              ))}
            </div>
            {/* Content for current role */}
            {(() => {
              const key = CALENDAR_ROLES[calendarIdx].key;
              const s = calendarSettings.find((c) => c.calendar_role === key) || { ...DEFAULT_CALENDAR_SETTING, calendar_role: key };
              const updateSetting = (field: string, value: any) => {
                setCalendarSettings((prev) => {
                  const exists = prev.find((c) => c.calendar_role === key);
                  if (exists) {
                    return prev.map((c) => (c.calendar_role === key ? { ...c, [field]: value } : c));
                  }
                  return [...prev, { ...DEFAULT_CALENDAR_SETTING, calendar_role: key, [field]: value }];
                });
              };
              return (
                <div className="p-4 sm:p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                    {/* Left Column */}
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-medium mb-3 text-brand-900">Durée de consultation</h3>
                        <Label>Durée (minutes)</Label>
                        <Input
                          type="number"
                          min="15"
                          step="15"
                          value={s.consultation_duration}
                          onChange={(e) => updateSetting('consultation_duration', parseInt(e.target.value || '60', 10))}
                          className="mt-2 max-w-xs"
                        />
                      </div>
                      <div className="border-t pt-6">
                        <h4 className="font-medium mb-3 text-brand-900">Horaires de travail</h4>
                        <div className="space-y-4">
                          <div>
                            <Label>Début de journée</Label>
                            <Input
                              type="time"
                              value={s.work_start_time}
                              onChange={(e) => updateSetting('work_start_time', e.target.value)}
                              className="mt-2 max-w-xs"
                            />
                          </div>
                          <div>
                            <Label>Fin de journée</Label>
                            <Input
                              type="time"
                              value={s.work_end_time}
                              onChange={(e) => updateSetting('work_end_time', e.target.value)}
                              className="mt-2 max-w-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Right Column */}
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-medium mb-3 text-brand-900">Pause déjeuner</h4>
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`has-break-${key}`}
                              checked={s.has_breakfast_break}
                              onCheckedChange={(checked) => updateSetting('has_breakfast_break', !!checked)}
                            />
                            <Label htmlFor={`has-break-${key}`} className="cursor-pointer font-medium text-sm">
                              Pause déjeuner
                            </Label>
                          </div>
                          {s.has_breakfast_break && (
                            <div className="space-y-3 pl-6 border-l-2 border-brand-600">
                              <div>
                                <Label>Début</Label>
                                <Input
                                  type="time"
                                  value={s.breakfast_break_start || '12:00'}
                                  onChange={(e) => updateSetting('breakfast_break_start', e.target.value)}
                                  className="mt-2 max-w-xs"
                                />
                              </div>
                              <div>
                                <Label>Fin</Label>
                                <Input
                                  type="time"
                                  value={s.breakfast_break_end || '13:00'}
                                  onChange={(e) => updateSetting('breakfast_break_end', e.target.value)}
                                  className="mt-2 max-w-xs"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="border-t pt-6">
                        <h4 className="font-medium mb-3 text-brand-900">Jours de repos</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                          {DAYS.map((day, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <Checkbox
                                id={`day-${key}-${index}`}
                                checked={s.weekend_days.includes(index)}
                                onCheckedChange={() => toggleWeekendDay(key, index)}
                              />
                              <Label htmlFor={`day-${key}-${index}`} className="cursor-pointer text-sm">
                                {day}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="flex justify-end mt-6">
            <Button
              onClick={saveSettings}
              disabled={settingsSaving}
              className="gap-2 bg-brand-700 hover:bg-brand-800"
            >
              <Save className="h-4 w-4" />
              {settingsSaving ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
            </Button>
          </div>

          {/* Listes du dossier patient */}
          <div className="border border-brand-200 rounded-lg overflow-hidden">
            <div className="bg-brand-50 px-4 py-3 sm:px-6 sm:py-4 border-b border-brand-200">
              <h2 className="text-lg font-semibold text-brand-900 flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                Listes du dossier patient
              </h2>
              <p className="text-sm text-brand-700 mt-1">
                Ces listes sont utilisées dans le formulaire patient (profession et motifs de consultation).
              </p>
            </div>
            <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              {/* Professions */}
              <div className="space-y-4">
                <h3 className="font-medium text-brand-900 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Professions
                </h3>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={newProfession}
                    onChange={(e) => setNewProfession(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addProfession(); } }}
                    placeholder="Ajouter une profession..."
                    className="w-full sm:max-w-xs"
                  />
                  <Button onClick={addProfession} className="gap-1 w-full sm:w-auto shrink-0 bg-brand-700 hover:bg-brand-800">
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {patientLists.professions.map((profession) => (
                    <div key={profession} className="flex items-center gap-2 bg-gray-50 border rounded-full px-3 py-1">
                      <span className="text-sm">{profession}</span>
                      <button
                        type="button"
                        onClick={() => removeProfession(profession)}
                        className="text-red-500 hover:text-red-700"
                        aria-label={`Supprimer ${profession}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Motifs */}
              <div className="space-y-4">
                <h3 className="font-medium text-brand-900 flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  Motifs de consultation
                </h3>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={newMotif}
                    onChange={(e) => setNewMotif(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMotif(); } }}
                    placeholder="Ajouter un motif..."
                    className="w-full sm:max-w-xs"
                  />
                  <Button onClick={addMotif} className="gap-1 w-full sm:w-auto shrink-0 bg-brand-700 hover:bg-brand-800">
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {patientLists.motifs.map((motif) => (
                    <div key={motif} className="flex items-center gap-2 bg-gray-50 border rounded-full px-3 py-1">
                      <span className="text-sm">{motif}</span>
                      <button
                        type="button"
                        onClick={() => removeMotif(motif)}
                        className="text-red-500 hover:text-red-700"
                        aria-label={`Supprimer ${motif}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <Button
              onClick={saveLists}
              disabled={listsSaving}
              className="gap-2 bg-brand-700 hover:bg-brand-800"
            >
              <Save className="h-4 w-4" />
              {listsSaving ? 'Sauvegarde...' : 'Sauvegarder les listes'}
            </Button>
          </div>

          {/* Services / Packs */}
          <div className="border border-brand-200 rounded-lg overflow-hidden">
            <div className="bg-brand-50 px-4 py-3 sm:px-6 sm:py-4 border-b border-brand-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-brand-900 flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  Services / Packs
                </h2>
                <p className="text-sm text-brand-700 mt-1">
                  Gestion des services et packs proposés aux patients.
                </p>
              </div>
              <Button onClick={() => setServiceCreateOpen(true)} className="gap-1 w-full sm:w-auto bg-brand-700 hover:bg-brand-800">
                <Plus className="h-4 w-4" />
                Nouveau
              </Button>
            </div>
            <div className="p-4 sm:p-6">
              {allServices.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Aucun service pour le moment.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead className="hidden sm:table-cell">Type</TableHead>
                        <TableHead className="hidden sm:table-cell">Séances</TableHead>
                        <TableHead className="text-right">Prix</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allServices.map((service) => (
                        <TableRow key={service.id}>
                          <TableCell className="font-medium">
                            {service.name}
                            <span className="block sm:hidden text-xs font-normal text-gray-500">
                              {service.type === 'neurofeedback' ? 'Neurofeedback' : 'Consultation'} · {service.sessions || 1} séance{(service.sessions || 1) > 1 ? 's' : ''}
                            </span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge className={service.type === 'neurofeedback' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                              {service.type === 'neurofeedback' ? 'Neurofeedback' : 'Consultation'}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{service.sessions || 1} séance{(service.sessions || 1) > 1 ? 's' : ''}</TableCell>
                          <TableCell className="text-right font-semibold">{Number(service.price).toLocaleString('fr-FR')} DZD</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setServiceEditingId(service.id);
                                setServiceEditData({ name: service.name, price: service.price, sessions: service.sessions || 1, type: service.type || 'consultation' });
                                setServiceEditOpen(true);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setServiceDeleteTarget({ id: service.id, name: service.name })}
                              className="text-red-600 hover:text-red-700"
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

        {/* Tab Content - Activity Logs */}
        <TabsContent value="logs" className="space-y-6">
          <div className="border border-brand-200 rounded-lg overflow-hidden">
            <div className="bg-brand-50 px-4 py-3 sm:px-6 sm:py-4 border-b border-brand-200">
              <h2 className="text-lg font-semibold text-brand-900 flex items-center gap-2">
                <History className="h-5 w-5" />
                Journal d'activité
                <span className="text-sm font-normal text-brand-700">({logsTotal})</span>
              </h2>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    placeholder="Rechercher..."
                    value={logFilterSearch}
                    onChange={(e) => { setLogFilterSearch(e.target.value); setLogsOffset(0); }}
                    className="w-full sm:w-48"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Label className="text-sm whitespace-nowrap">Action:</Label>
                  <Select value={logFilterAction} onValueChange={(v) => { setLogFilterAction(v); setLogsOffset(0); }}>
                    <SelectTrigger className="flex-1 sm:w-40">
                      <SelectValue placeholder="Toutes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      <SelectItem value="CREATE">Création</SelectItem>
                      <SelectItem value="UPDATE">Modification</SelectItem>
                      <SelectItem value="DELETE">Suppression</SelectItem>
                      <SelectItem value="REGISTER">Inscription</SelectItem>
                      <SelectItem value="LOGIN">Connexion</SelectItem>
                      <SelectItem value="CANCEL">Annulation</SelectItem>
                      <SelectItem value="COMPLETE">Terminé</SelectItem>
                      <SelectItem value="USE_SESSION">Séance utilisée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Label className="text-sm whitespace-nowrap">Resource:</Label>
                  <Select value={logFilterResource} onValueChange={(v) => { setLogFilterResource(v); setLogsOffset(0); }}>
                    <SelectTrigger className="flex-1 sm:w-44">
                      <SelectValue placeholder="Toutes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      <SelectItem value="user">Utilisateur</SelectItem>
                      <SelectItem value="patient">Patient</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                      <SelectItem value="appointment">Rendez-vous</SelectItem>
                      <SelectItem value="session-note">Compte rendu</SelectItem>
                      <SelectItem value="invoice">Facture</SelectItem>
                      <SelectItem value="payment">Paiement</SelectItem>
                      <SelectItem value="expense">Dépense</SelectItem>
                      <SelectItem value="company">Société</SelectItem>
                      <SelectItem value="company-invoice">Facture société</SelectItem>
                      <SelectItem value="patient-pack">Pack</SelectItem>
                      <SelectItem value="waiting-list">Liste d'attente</SelectItem>
                      <SelectItem value="auth">Authentification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={() => loadActivityLogs()} className="gap-1 w-full sm:w-auto sm:ml-auto">
                  <RefreshCw className="h-3 w-3" />
                  Actualiser
                </Button>
              </div>

            {loadingLogs ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : activityLogsList.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-brand-300 rounded-lg">
                <p className="text-gray-500">Aucun log d'activité trouvé</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-brand-200 rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-brand-50">
                      <SortableHeader label="Utilisateur" sortKey="userPseudo" currentSortKey={logsSort.sortKey} direction={logsSort.direction} onSort={logsSort.toggleSort} className="hidden sm:table-cell" />
                      <SortableHeader label="Action" sortKey="action" currentSortKey={logsSort.sortKey} direction={logsSort.direction} onSort={logsSort.toggleSort} />
                      <SortableHeader label="Entité" sortKey="resource" currentSortKey={logsSort.sortKey} direction={logsSort.direction} onSort={logsSort.toggleSort} />
                      <SortableHeader label="Date & Heure" sortKey="date" currentSortKey={logsSort.sortKey} direction={logsSort.direction} onSort={logsSort.toggleSort} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsSort.sortedItems.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="hidden sm:table-cell font-medium">{log.userPseudo || log.userName || 'Unknown'}</TableCell>
                        <TableCell className="text-sm">
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                            log.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                            log.action === 'DELETE' || log.action === 'CANCEL' ? 'bg-red-100 text-red-800' :
                            log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                            log.action === 'LOGIN' || log.action === 'REGISTER' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {getActionLabel(log.action)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {getResourceLabel(log.resource)}
                          {log.resourceName && (
                            <span className="text-gray-400 ml-1">— {log.resourceName}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{formatDate(log.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {logsTotal > logsLimit && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-gray-500">
                  {logsOffset + 1} - {Math.min(logsOffset + logsLimit, logsTotal)} sur {logsTotal}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={logsOffset === 0}
                    onClick={() => setLogsOffset(Math.max(0, logsOffset - logsLimit))}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={logsOffset + logsLimit >= logsTotal}
                    onClick={() => setLogsOffset(logsOffset + logsLimit)}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create User Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) { setIsCreateOpen(false); setError(''); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter un nouvel utilisateur</DialogTitle>
            <DialogDescription>
              Créer un nouvel utilisateur avec ses informations et services associés
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Prénom *</FieldLabel>
                <Input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  disabled={isSubmitting}
                  required
                  placeholder="Jean"
                />
              </Field>

              <Field>
                <FieldLabel>Nom *</FieldLabel>
                <Input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  disabled={isSubmitting}
                  required
                  placeholder="Dupont"
                />
              </Field>
            </div>

            {formData.firstName && formData.lastName && (
              <div className="text-sm text-gray-500 bg-gray-50 border rounded px-3 py-2">
                Pseudo généré : <span className="font-medium text-gray-700">{formData.firstName.toLowerCase()}_{formData.lastName.toLowerCase()}</span>
                <span className="ml-2 text-gray-400">| Mot de passe par défaut : 123456789</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="psy">Psy</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
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

            {formData.role !== 'admin' && allServices.length > 0 && (
              <div className="border-t pt-4">
                <FieldLabel>Services pris en charge</FieldLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                  {allServices.map((service) => (
                    <div key={service.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`create-service-${service.id}`}
                        checked={formData.serviceIds.includes(service.id)}
                        onCheckedChange={(checked) => {
                          setFormData((prev) => ({
                            ...prev,
                            serviceIds: checked
                              ? [...prev.serviceIds, service.id]
                              : prev.serviceIds.filter((id) => id !== service.id),
                          }));
                        }}
                      />
                      <Label htmlFor={`create-service-${service.id}`} className="cursor-pointer text-sm">
                        {service.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); setError(''); }}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-brand-700 hover:bg-brand-800">
                {isSubmitting ? <Spinner size="sm" /> : (
                  <><Plus className="h-4 w-4 mr-2" />Créer l'utilisateur</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>
              Modifier les informations de l'utilisateur
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Prénom *</FieldLabel>
                  <Input
                    type="text"
                    value={editFormData.firstName}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>Nom *</FieldLabel>
                  <Input
                    type="text"
                    value={editFormData.lastName}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                    required
                  />
                </Field>
              </div>

              <div className="text-sm text-gray-500 bg-gray-50 border rounded px-3 py-2">
                Pseudo : <span className="font-medium text-gray-700">{editingUser.pseudo}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Rôle *</FieldLabel>
                  <Select
                    value={editFormData.role}
                    onValueChange={(value) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        role: value as any,
                        serviceIds: value === 'admin' ? [] : prev.serviceIds,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="psy">Psy</SelectItem>
                      <SelectItem value="coach">Coach</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>Téléphone</FieldLabel>
                  <Input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+213 XX XX XX XX"
                  />
                </Field>
              </div>

              {editFormData.role !== 'admin' && allServices.length > 0 && (
                <div className="border-t pt-4">
                  <FieldLabel>Services pris en charge</FieldLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                    {allServices.map((service) => (
                      <div key={service.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-service-${service.id}`}
                          checked={editFormData.serviceIds.includes(service.id)}
                          onCheckedChange={() => toggleEditService(service.id)}
                        />
                        <Label htmlFor={`edit-service-${service.id}`} className="cursor-pointer text-sm">
                          {service.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-brand-700 hover:bg-brand-800">
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={serviceCreateOpen} onOpenChange={setServiceCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau service</DialogTitle>
            <DialogDescription>Créez un nouveau service avec son tarif.</DialogDescription>
          </DialogHeader>
          <ServiceForm onSubmit={handleServiceCreate} submitButtonText="Créer le service" />
        </DialogContent>
      </Dialog>

      <Dialog open={serviceEditOpen} onOpenChange={setServiceEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le service</DialogTitle>
            <DialogDescription>Modifiez les informations du service.</DialogDescription>
          </DialogHeader>
          {serviceEditData && (
            <ServiceForm initialData={serviceEditData} onSubmit={handleServiceUpdate} submitButtonText="Enregistrer" />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!serviceDeleteTarget} onOpenChange={(open) => !open && setServiceDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le service</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer le service "{serviceDeleteTarget?.name}" ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleServiceDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
