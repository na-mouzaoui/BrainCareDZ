'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { users as usersApi, activityLogs, services as servicesApi } from '@/lib/api';
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
import { AlertCircle, Plus, Trash2, Edit2, ChevronDown, ChevronUp, Loader2, Shield, Save, Users, Clock, History, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'practitioner' | 'receptionist';
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

interface Service {
  id: string;
  name: string;
}

interface NewUserForm {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'practitioner' | 'receptionist';
  phone: string;
  serviceIds: string[];
}

interface Settings {
  weekendDays: number[];
  consultationDuration: number;
  workStartTime: string;
  workEndTime: string;
  breakfastBreakStart?: string;
  breakfastBreakEnd?: string;
  hasBreakfastBreak: boolean;
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

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const DEFAULT_SETTINGS: Settings = {
  weekendDays: [5, 6],
  consultationDuration: 60,
  workStartTime: '08:00',
  workEndTime: '18:00',
  hasBreakfastBreak: false,
};

function getActionLabel(action: string): string {
  const labels: { [key: string]: string } = {
    'CREATE': 'Création',
    'READ': 'Consultation',
    'UPDATE': 'Modification',
    'DELETE': 'Suppression',
    'REGISTER': 'Inscription',
    'LOGIN': 'Connexion',
    'LOGOUT': 'Déconnexion',
    'CANCEL': 'Annulation',
    'COMPLETE': 'Terminé',
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
    'auth': 'Authentification',
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    email: string;
    role: 'admin' | 'practitioner' | 'receptionist';
    phone: string;
    isActive: boolean;
    serviceIds: string[];
  }>({ name: '', email: '', role: 'practitioner', phone: '', isActive: true, serviceIds: [] });

  const [formData, setFormData] = useState<NewUserForm>({
    name: '',
    email: '',
    password: '',
    role: 'practitioner',
    phone: '',
    serviceIds: [],
  });

  // Settings state
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Activity logs state
  const [activityLogsList, setActivityLogsList] = useState<ActivityLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsOffset, setLogsOffset] = useState(0);
  const [logsLimit] = useState(50);
  const [logFilterAction, setLogFilterAction] = useState('all');
  const [logFilterResource, setLogFilterResource] = useState('all');

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
        });
      }
    } catch {
      setError('Erreur lors du chargement des paramètres');
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
      setError('');
      localStorage.setItem('practice-settings', JSON.stringify(settings));
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
      ...(field === 'role' && value !== 'practitioner' ? { serviceIds: [] } : {}),
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
        activityLogs.create({ action: 'CREATE', resource: 'user', resourceName: formData.name, status: 'success' }).catch(() => {});
        setIsCreateOpen(false);
        setFormData({
          name: '',
          email: '',
          password: '',
          role: 'practitioner',
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

  function handleEditUser(user: User) {
    setEditingUser(user);
    setEditFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || '',
      isActive: user.isActive,
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
        activityLogs.create({ action: 'UPDATE', resource: 'user', resourceName: editFormData.name, status: 'success' }).catch(() => {});
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
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setFormData({ name: '', email: '', password: '', role: 'practitioner', phone: '', serviceIds: [] });
                  setError('');
                  setIsCreateOpen(true);
                }}
                className="gap-2 bg-emerald-700 hover:bg-emerald-800"
              >
                <Plus className="h-4 w-4" />
                Ajouter un utilisateur
              </Button>
            </div>

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
                      <TableRow key={u.id} className="cursor-pointer" onClick={() => handleEditUser(u)}>
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
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditUser(u)}
                              className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                            >
                              <Edit2 className="h-4 w-4" />
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

            </div>
          </div>
          <div className="flex justify-end mt-6">
            <Button
              onClick={saveSettings}
              disabled={settingsSaving}
              className="gap-2 bg-emerald-700 hover:bg-emerald-800"
            >
              <Save className="h-4 w-4" />
              {settingsSaving ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
            </Button>
          </div>
        </TabsContent>

        {/* Tab Content - Activity Logs */}
        <TabsContent value="logs" className="space-y-6">
          <div className="border border-emerald-200 rounded-lg overflow-hidden">
            <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-200">
              <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
                <History className="h-5 w-5" />
                Journaux d'activité
                <span className="text-sm font-normal text-emerald-700">({logsTotal})</span>
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">Action:</Label>
                  <Select value={logFilterAction} onValueChange={(v) => { setLogFilterAction(v); setLogsOffset(0); }}>
                    <SelectTrigger className="w-40">
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
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">Resource:</Label>
                  <Select value={logFilterResource} onValueChange={(v) => { setLogFilterResource(v); setLogsOffset(0); }}>
                    <SelectTrigger className="w-44">
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
                      <SelectItem value="auth">Authentification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={() => loadActivityLogs()} className="gap-1 ml-auto">
                  <RefreshCw className="h-3 w-3" />
                  Actualiser
                </Button>
              </div>

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
                      <TableHead>Élément</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityLogsList.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm whitespace-nowrap">{formatDate(log.createdAt)}</TableCell>
                        <TableCell className="font-medium">{log.userName || 'Unknown'}</TableCell>
                        <TableCell className="text-sm">{log.userEmail || 'N/A'}</TableCell>
                        <TableCell className="text-sm">
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                            log.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                            log.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                            log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                            log.action === 'LOGIN' || log.action === 'REGISTER' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {getActionLabel(log.action)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{getResourceLabel(log.resource)}</TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">{log.resourceName || '-'}</TableCell>
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

            {formData.role === 'practitioner' && allServices.length > 0 && (
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
              <Button type="submit" disabled={isSubmitting} className="bg-emerald-700 hover:bg-emerald-800">
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Création...</>
                ) : (
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
                  <FieldLabel>Nom complet *</FieldLabel>
                  <Input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>Email *</FieldLabel>
                  <Input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>Rôle *</FieldLabel>
                  <Select
                    value={editFormData.role}
                    onValueChange={(value) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        role: value as any,
                        serviceIds: value !== 'practitioner' ? [] : prev.serviceIds,
                      }))
                    }
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
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+213 XX XX XX XX"
                  />
                </Field>

                <Field>
                  <FieldLabel>Statut</FieldLabel>
                  <Select
                    value={editFormData.isActive ? 'active' : 'inactive'}
                    onValueChange={(value) =>
                      setEditFormData((prev) => ({ ...prev, isActive: value === 'active' }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="inactive">Inactif</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {editFormData.role === 'practitioner' && allServices.length > 0 && (
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
                <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800">
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
