'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { patients, patientOutcomes, patientPacks, appointments, sessionNotes, services } from '@/lib/api';
import PatientForm, { PatientFormData } from '@/components/patient-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Trash2, Users, Share2, Search, FileText, Plus, Calendar, ArrowLeft, RefreshCw } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { DetailPageSkeleton } from '@/components/page-skeletons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PatientSearchSelect } from '@/components/patient-search-select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface PatientDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  age?: number;
  gender?: string;
  commune?: string;
  maritalStatus?: string;
  hasChildren?: boolean;
  childrenCount?: number;
  profession?: string;
  patientType?: string;
  consultationReasons?: string[];
  difficultyDuration?: string;
  previousConsultation?: boolean;
  previousType?: string;
  previousNeurofeedback?: boolean;
  currentFollowUp?: boolean;
  sourceOfAcquisition?: string;
  sourceDetails?: string;
  sourceSub?: string;
  sourceAccount?: string;
  firstContactDate?: string;
  firstAppointmentDate?: string;
  abandonReason?: string;
  sessionCount: number;
  balance: number;
  practitionerName?: string;
  practitioners?: Array<{
    practitionerId: string;
    practitionerName: string;
    firstSeen: string;
    lastSeen: string;
  }>;
  packServiceName?: string;
  packTotal?: number;
  packRemaining?: number;
  packList?: Array<{ serviceName: string; remaining: number; total: number }>;
}

interface AppointmentItem {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string;
  serviceName?: string;
  practitionerName?: string;
  practitionerRole?: string;
  packDeferred?: boolean;
  patients: Array<{
    patientId: string;
    firstName?: string;
    lastName?: string;
    packSelected?: boolean;
  }>;
}

interface NoteItem {
  id: string;
  appointmentId: string;
  appointmentStartTime?: string;
  serviceName?: string;
  practitionerName?: string;
  progressNotes?: string;
  createdAt: string;
}

interface PackItem {
  id: string;
  patientId: string;
  serviceId: string;
  totalSessions: number;
  remainingSessions: number;
  price: number;
  serviceName: string;
  createdAt: string;
}

interface PackShare {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface PatientBasic {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Outcome {
  id: string;
  evaluatedAt: string;
  perceivedImprovement?: number;
  observedChanges?: string;
  globalSatisfaction?: number;
  wouldRecommend?: boolean;
  createdByName?: string;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Planifie',
  completed: 'Termine',
  cancelled: 'Annule',
  'no-show': 'Absent',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  scheduled: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
  'no-show': 'outline',
};

export default function PatientDetailPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const patientId = params?.id as string;

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [packs, setPacks] = useState<PackItem[]>([]);
  const [sharedPacks, setSharedPacks] = useState<PackItem[]>([]);
  const [appointmentsList, setAppointmentsList] = useState<AppointmentItem[]>([]);
  const [notesList, setNotesList] = useState<NoteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharePack, setSharePack] = useState<PackItem | null>(null);
  const [shares, setShares] = useState<PackShare[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [addShareLoading, setAddShareLoading] = useState(false);
  const [shareError, setShareError] = useState('');
  const [allPatientsList, setAllPatientsList] = useState<PatientBasic[]>([]);
  const [shareFormResetKey, setShareFormResetKey] = useState(0);

  const [addPackOpen, setAddPackOpen] = useState(false);
  const [servicesList, setServicesList] = useState<Array<{ id: string; name: string; sessions: number; price: number }>>([]);
  const [newPackServiceId, setNewPackServiceId] = useState('');
  const [addPackLoading, setAddPackLoading] = useState(false);
  const [addPackError, setAddPackError] = useState('');

  const [switchPackOpen, setSwitchPackOpen] = useState(false);
  const [switchPack, setSwitchPack] = useState<PackItem | null>(null);
  const [switchServiceId, setSwitchServiceId] = useState('');
  const [switchLoading, setSwitchLoading] = useState(false);
  const [switchError, setSwitchError] = useState('');

  const loadData = useCallback(async () => {
    if (!patientId) return;
    try {
      setIsLoading(true);
      setError('');
      const [patientRes, outcomesRes, packsRes, apptsRes, notesRes, servicesRes] = await Promise.all([
        patients.getById(patientId),
        patientOutcomes.getByPatient(patientId),
        patientPacks.getByPatient(patientId),
        appointments.getAll(),
        sessionNotes.getByPatient(patientId),
        services.getAll(),
      ]);
      if (patientRes.success && patientRes.data) {
        setPatient(patientRes.data);
      } else {
        setError(patientRes.message || 'Echec du chargement du patient');
        return;
      }
      if (outcomesRes.success && outcomesRes.data) {
        setOutcomes(outcomesRes.data.outcomes || []);
      }
      if (packsRes.success && packsRes.data) {
        setPacks(packsRes.data.packs || []);
        setSharedPacks(packsRes.data.sharedPacks || []);
      }
      if (apptsRes.success && apptsRes.data) {
        const allAppts: AppointmentItem[] = apptsRes.data.appointments || [];
        const filtered = allAppts.filter((a) =>
          a.patients?.some((p) => p.patientId === patientId)
        );
        setAppointmentsList(filtered.sort((a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        ));
      }
      if (notesRes.success && notesRes.data) {
        setNotesList(notesRes.data.notes || []);
      }
      if (servicesRes.success && servicesRes.data) {
        const list = Array.isArray(servicesRes.data) ? servicesRes.data : servicesRes.data.services || [];
        setServicesList(list.map((s: any) => ({ id: s.id, name: s.name, sessions: s.sessions, price: s.price })));
      }
    } catch {
      setError('Une erreur est survenue lors du chargement');
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!authLoading && isAuthenticated && patientId) {
      loadData();
    }
  }, [isAuthenticated, authLoading, patientId, router, loadData]);

  const handleSavePatient = async (data: PatientFormData) => {
    setIsSaving(true);
    try {
      const res = await patients.update(patientId, data);
      if (res.success) {
        await loadData();
      } else {
        throw new Error(res.message || 'Echec de la mise a jour');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const patientFormData = useMemo((): PatientFormData | undefined => {
    if (!patient) return undefined;
    return {
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.email,
      phone: patient.phone,
      dateOfBirth: patient.dateOfBirth,
      age: patient.age,
      gender: patient.gender,
      commune: patient.commune,
      maritalStatus: patient.maritalStatus,
      hasChildren: patient.hasChildren,
      childrenCount: patient.childrenCount,
      profession: patient.profession,
      patientType: patient.patientType,
      consultationReasons: patient.consultationReasons,
      difficultyDuration: patient.difficultyDuration,
      previousConsultation: patient.previousConsultation,
      previousType: patient.previousType,
      previousNeurofeedback: patient.previousNeurofeedback,
      currentFollowUp: patient.currentFollowUp,
      sourceOfAcquisition: patient.sourceOfAcquisition,
      sourceDetails: patient.sourceDetails,
      sourceSub: patient.sourceSub,
      sourceAccount: patient.sourceAccount,
      firstContactDate: patient.firstContactDate,
      firstAppointmentDate: patient.firstAppointmentDate,
      abandonReason: patient.abandonReason,
    };
  }, [patient]);

  const selectedService = servicesList.find((s) => s.id === newPackServiceId);
  const selectedSwitchService = servicesList.find((s) => s.id === switchServiceId);

  const openSwitchDialog = (pack: PackItem) => {
    setSwitchPack(pack);
    setSwitchServiceId('');
    setSwitchError('');
    setSwitchPackOpen(true);
  };

  const handleCreatePack = async () => {
    if (!selectedService) {
      setAddPackError('Veuillez sélectionner un service');
      return;
    }
    try {
      setAddPackLoading(true);
      setAddPackError('');
      const res = await patientPacks.create({
        patientId,
        serviceId: selectedService.id,
        totalSessions: selectedService.sessions,
        price: selectedService.price,
      });
      if (res.success) {
        setAddPackOpen(false);
        setNewPackServiceId('');
        await loadData();
      } else {
        setAddPackError(res.message || 'Échec de la création du pack');
      }
    } catch {
      setAddPackError('Une erreur est survenue');
    } finally {
      setAddPackLoading(false);
    }
  };

  const handleSwitchPack = async () => {
    if (!switchPack || !selectedSwitchService) {
      setSwitchError('Veuillez sélectionner un service');
      return;
    }
    try {
      setSwitchLoading(true);
      setSwitchError('');
      const res = await patientPacks.switchPack(switchPack.id, selectedSwitchService.id);
      if (res.success) {
        setSwitchPackOpen(false);
        setSwitchPack(null);
        setSwitchServiceId('');
        await loadData();
      } else {
        setSwitchError(res.message || 'Échec du changement de pack');
      }
    } catch {
      setSwitchError('Une erreur est survenue');
    } finally {
      setSwitchLoading(false);
    }
  };

  const openShareDialog = async (pack: PackItem) => {
    setSharePack(pack);
    setShareDialogOpen(true);
    setShares([]);
    setShareError('');
    try {
      setSharesLoading(true);
      const [sharesRes, patientsRes] = await Promise.all([
        patientPacks.getShares(pack.id),
        allPatientsList.length === 0 ? patients.getAll() : Promise.resolve(null),
      ]);
      if (sharesRes.success && sharesRes.data) {
        setShares(sharesRes.data.shares || []);
      }
      if (patientsRes && patientsRes.success && patientsRes.data) {
        const list = Array.isArray(patientsRes.data) ? patientsRes.data : patientsRes.data.patients || [];
        setAllPatientsList(list.map((p: any) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
        })));
      }
    } catch {
      setShareError('Erreur lors du chargement des partages');
    } finally {
      setSharesLoading(false);
    }
  };

  const handleAddShare = async (targetPatientId: string) => {
    if (!sharePack) return;
    try {
      setAddShareLoading(true);
      setShareError('');
      const res = await patientPacks.addShare(sharePack.id, targetPatientId);
      if (res.success) {
        setShareFormResetKey((k) => k + 1);
        const sharesRes = await patientPacks.getShares(sharePack.id);
        if (sharesRes.success && sharesRes.data) {
          setShares(sharesRes.data.shares || []);
        }
      } else {
        setShareError(res.message || 'Erreur lors de l\'ajout');
      }
    } catch {
      setShareError('Erreur lors de l\'ajout');
    } finally {
      setAddShareLoading(false);
    }
  };

  const handleRemoveShare = async (targetPatientId: string) => {
    if (!sharePack) return;
    try {
      const res = await patientPacks.removeShare(sharePack.id, targetPatientId);
      if (res.success) {
        setShares((prev) => prev.filter((s) => s.patientId !== targetPatientId));
      }
    } catch {
      setShareError('Erreur lors de la suppression');
    }
  };

  if (authLoading || isLoading) {
    return <DetailPageSkeleton />;
  }

  if (error && !patient) {
    return (
      <div>
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Détails du patient</h1>
          <Button variant="outline" onClick={() => router.push('/patients')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Patient non trouvé'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {patient?.firstName} {patient?.lastName}
          </h1>
          {patient && (
            <p className="text-sm text-gray-500 mt-1">
              {patient.email} {patient.phone ? `\u2022 ${patient.phone}` : ''}
            </p>
          )}
        </div>
        <Button variant="outline" onClick={() => router.push('/patients')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="informations" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto">
          <TabsTrigger value="informations">Informations</TabsTrigger>
          <TabsTrigger value="rendez-vous">Rendez-vous ({appointmentsList.length})</TabsTrigger>
          <TabsTrigger value="packs">Packs ({packs.length})</TabsTrigger>
          <TabsTrigger value="seances">
            <span className="sm:hidden">Séances ({appointmentsList.filter((a) => a.status === 'completed').length})</span>
            <span className="hidden sm:inline">Historique des séances ({appointmentsList.filter((a) => a.status === 'completed').length})</span>
          </TabsTrigger>
          <TabsTrigger value="comptes-rendus">Comptes rendus ({notesList.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="informations" className="mt-4">
          <Tabs defaultValue="identite" className="w-full">
            <TabsList className="w-full justify-start flex-wrap h-auto">
              <TabsTrigger value="identite">Identite</TabsTrigger>
              <TabsTrigger value="situation">Situation</TabsTrigger>
              <TabsTrigger value="motif">Motif</TabsTrigger>
              <TabsTrigger value="historique">Historique</TabsTrigger>
              <TabsTrigger value="source">Source</TabsTrigger>
            </TabsList>

            <TabsContent value="identite" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  {patientFormData && (
                    <PatientForm
                      key={`id-${patient?.id}`}
                      initialData={patientFormData}
                      onSubmit={handleSavePatient}
                      submitButtonText={isSaving ? 'Enregistrement...' : 'Enregistrer'}
                      isLoading={isSaving}
                      hideSteps
                      defaultStep={1}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="situation" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  {patientFormData && (
                    <PatientForm
                      key={`sit-${patient?.id}`}
                      initialData={patientFormData}
                      onSubmit={handleSavePatient}
                      submitButtonText={isSaving ? 'Enregistrement...' : 'Enregistrer'}
                      isLoading={isSaving}
                      hideSteps
                      defaultStep={2}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="motif" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  {patientFormData && (
                    <PatientForm
                      key={`mot-${patient?.id}`}
                      initialData={patientFormData}
                      onSubmit={handleSavePatient}
                      submitButtonText={isSaving ? 'Enregistrement...' : 'Enregistrer'}
                      isLoading={isSaving}
                      hideSteps
                      defaultStep={3}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="historique" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  {patientFormData && (
                    <PatientForm
                      key={`his-${patient?.id}`}
                      initialData={patientFormData}
                      onSubmit={handleSavePatient}
                      submitButtonText={isSaving ? 'Enregistrement...' : 'Enregistrer'}
                      isLoading={isSaving}
                      hideSteps
                      defaultStep={4}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="source" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  {patientFormData && (
                    <PatientForm
                      key={`src-${patient?.id}`}
                      initialData={patientFormData}
                      onSubmit={handleSavePatient}
                      submitButtonText={isSaving ? 'Enregistrement...' : 'Enregistrer'}
                      isLoading={isSaving}
                      hideSteps
                      defaultStep={5}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="rendez-vous" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Rendez-vous</CardTitle>
            </CardHeader>
            <CardContent>
              {appointmentsList.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun rendez-vous pour ce patient.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Praticien</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Pack</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appointmentsList.map((appt) => (
                        <TableRow key={appt.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDateTime(appt.startTime)}
                          </TableCell>
                          <TableCell>{appt.serviceName || '\u2014'}</TableCell>
                          <TableCell>
                            {appt.practitionerName || '\u2014'}
                            {appt.practitionerRole && (
                              <span className="text-xs text-gray-400 ml-1">
                                ({appt.practitionerRole === 'psy' ? 'Psy' : appt.practitionerRole === 'coach' ? 'Coach' : 'Admin'})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANTS[appt.status] || 'outline'}>
                              {STATUS_LABELS[appt.status] || appt.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const p = appt.patients.find((x) => x.patientId === patientId);
                              return p?.packSelected ? (
                                <Badge variant="secondary">Oui</Badge>
                              ) : (
                                <span className="text-gray-400">Non</span>
                              );
                            })()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packs" className="mt-4">
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Historique des packs
                </CardTitle>
                <Button
                  size="sm"
                  className="gap-1 w-full sm:w-auto bg-brand-700 hover:bg-brand-800"
                  onClick={() => setAddPackOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Nouveau pack
                </Button>
              </CardHeader>
              <CardContent>
                {packs.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucun pack pour ce patient.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead className="hidden md:table-cell">Séances</TableHead>
                          <TableHead className="hidden md:table-cell">Statut</TableHead>
                          <TableHead className="hidden md:table-cell">Prix</TableHead>
                          <TableHead className="hidden lg:table-cell">Créé le</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {packs.map((pack) => (
                          <TableRow key={pack.id}>
                            <TableCell className="font-medium">
                              {pack.serviceName}
                              <span className="md:hidden mt-1 block text-xs font-normal text-gray-500">
                                <span className="block">{pack.remainingSessions}/{pack.totalSessions} séances · {pack.remainingSessions === 0 ? 'Consommé' : pack.remainingSessions === pack.totalSessions ? 'Nouveau' : 'En cours'}</span>
                                <span className="block">{pack.price ? `${Number(pack.price).toLocaleString('fr-FR')} DZD` : '\u2014'}</span>
                              </span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className={pack.remainingSessions === 0 ? 'text-gray-400' : ''}>
                                {pack.remainingSessions}/{pack.totalSessions}
                              </span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Badge className={
                                pack.remainingSessions === 0
                                  ? 'bg-red-100 text-red-700'
                                  : pack.remainingSessions === pack.totalSessions
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-orange-100 text-orange-700'
                              }>
                                {pack.remainingSessions === 0 ? 'Consommé' : pack.remainingSessions === pack.totalSessions ? 'Nouveau' : 'En cours'}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{pack.price ? `${Number(pack.price).toLocaleString('fr-FR')} DZD` : '\u2014'}</TableCell>
                            <TableCell className="hidden lg:table-cell">{formatDate(pack.createdAt)}</TableCell>
                            <TableCell className="text-right">
                              {pack.remainingSessions > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openSwitchDialog(pack)}
                                  className="gap-1 mr-1"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                  Changer
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openShareDialog(pack)}
                                className="gap-1"
                              >
                                <Share2 className="h-3.5 w-3.5" />
                                Partager
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Packs partagés
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sharedPacks.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucun pack partagé avec ce patient.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead>Séances restantes</TableHead>
                          <TableHead>Prix</TableHead>
                          <TableHead>Propriétaire</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sharedPacks.map((pack) => (
                          <TableRow key={pack.id}>
                            <TableCell className="font-medium">{pack.serviceName}</TableCell>
                            <TableCell>{pack.remainingSessions}/{pack.totalSessions}</TableCell>
                            <TableCell>{pack.price ? `${Number(pack.price).toLocaleString('fr-FR')} DZD` : '\u2014'}</TableCell>
                            <TableCell>{(pack as any).patientFirstName} {(pack as any).patientLastName}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="seances" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Historique des séances
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appointmentsList.filter((a) => a.status === 'completed').length === 0 ? (
                <p className="text-sm text-gray-500">Aucune séance terminée pour ce patient.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Praticien</TableHead>
                        <TableHead>Réf. RDV</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appointmentsList
                        .filter((a) => a.status === 'completed')
                        .map((appt) => (
                          <TableRow key={appt.id}>
                            <TableCell className="whitespace-nowrap">
                              {formatDateTime(appt.startTime)}
                            </TableCell>
                            <TableCell>{appt.serviceName || '\u2014'}</TableCell>
                            <TableCell>{appt.practitionerName || '\u2014'}</TableCell>
                            <TableCell>
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-brand-600"
                                onClick={() => router.push(`/appointments/${appt.id}/report`)}
                              >
                                Voir le compte rendu
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comptes-rendus" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Comptes rendus
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notesList.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun compte rendu pour ce patient.</p>
              ) : (
                <div className="space-y-3">
                  {notesList.map((note) => (
                    <div key={note.id} className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => router.push(`/appointments/${note.appointmentId}/report`)}>
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <Badge variant="outline">{note.serviceName || '\u2014'}</Badge>
                          <span className="text-sm text-gray-500 truncate">
                            {note.practitionerName || '\u2014'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">
                          {note.appointmentStartTime ? formatDateTime(note.appointmentStartTime) : formatDate(note.createdAt)}
                        </span>
                      </div>
                      {note.progressNotes && (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.progressNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Partager le pack {sharePack?.serviceName}
            </DialogTitle>
            <DialogDescription>
              Gérer les bénéficiaires de ce pack ({sharePack?.remainingSessions}/{sharePack?.totalSessions} séances restantes)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {shareError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{shareError}</AlertDescription>
              </Alert>
            )}

            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">Ajouter un bénéficiaire</label>
              <PatientSearchSelect
                patients={allPatientsList}
                resetKey={shareFormResetKey}
                onSelect={(patientId) => {
                  handleAddShare(patientId);
                }}
                placeholder="Rechercher un patient..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                Bénéficiaires actuels ({shares.length})
              </label>
              {sharesLoading ? (
                <Spinner size="sm" text="Chargement..." />
              ) : shares.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun bénéficiaire pour le moment.</p>
              ) : (
                <ul className="space-y-2">
                  {shares.map((s) => (
                    <li key={s.id} className="flex items-center justify-between px-3 py-2 border rounded-lg">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.firstName} {s.lastName}</p>
                        <p className="text-xs text-gray-500 truncate">{s.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveShare(s.patientId)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addPackOpen} onOpenChange={(open) => { setAddPackOpen(open); setAddPackError(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Attribuer un pack</DialogTitle>
            <DialogDescription>
              Sélectionnez un service et le nombre de séances.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Service *</label>
              <Select value={newPackServiceId} onValueChange={setNewPackServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un service" />
                </SelectTrigger>
                <SelectContent>
                  {packs.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50">
                        Packs en cours
                      </div>
                      {packs.map((pack) => (
                        <SelectItem key={`active-${pack.serviceId}`} value={pack.serviceId}>
                          {pack.serviceName} — {pack.remainingSessions}/{pack.totalSessions} séances restantes
                        </SelectItem>
                      ))}
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 mt-1">
                        Autres services
                      </div>
                    </>
                  )}
                  {servicesList
                    .filter((s) => !packs.some((p) => p.serviceId === s.id))
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {selectedService && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Séances</label>
                  <p className="text-lg font-semibold">{selectedService.sessions}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Prix total</label>
                  <p className="text-lg font-semibold">{Number(selectedService.price).toLocaleString('fr-FR')} DZD</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Prix / séance</label>
                  <p className="text-lg font-semibold">{selectedService.sessions > 0 ? (Number(selectedService.price) / selectedService.sessions).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : 0} DZD</p>
                </div>
              </div>
            )}
            {addPackError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{addPackError}</AlertDescription>
              </Alert>
            )}
            <Button
              onClick={handleCreatePack}
              disabled={addPackLoading}
              className="w-full bg-brand-700 hover:bg-brand-800"
            >
              {addPackLoading && <Spinner size="sm" />}
              Créer le pack
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={switchPackOpen} onOpenChange={(open) => { setSwitchPackOpen(open); setSwitchError(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Changer de pack</DialogTitle>
            <DialogDescription>
              Sélectionnez le nouveau service. Le nombre de séances consommées sera conservé.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {switchPack && (
              <div className="rounded-lg border bg-gray-50 p-3 text-sm space-y-1">
                <p className="font-semibold text-gray-700">Pack actuel</p>
                <p>{switchPack.serviceName} — {switchPack.remainingSessions}/{switchPack.totalSessions} séances — {Number(switchPack.price).toLocaleString('fr-FR')} DZD</p>
                <p className="text-gray-500">Séances consommées : {switchPack.totalSessions - switchPack.remainingSessions}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Nouveau service *</label>
              <Select value={switchServiceId} onValueChange={setSwitchServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un service" />
                </SelectTrigger>
                <SelectContent>
                  {servicesList
                    .filter((s) => s.id !== switchPack?.serviceId && s.sessions > (switchPack?.totalSessions || 0))
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.sessions} séances)</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {selectedSwitchService && switchPack && (
              <div className="rounded-lg border bg-brand-50 p-3 text-sm space-y-1">
                <p className="font-semibold text-brand-700">Nouveau pack</p>
                <p>{selectedSwitchService.name} — {selectedSwitchService.sessions} séances — {Number(selectedSwitchService.price).toLocaleString('fr-FR')} DZD</p>
                <p>Séances restantes : {selectedSwitchService.sessions - (switchPack.totalSessions - switchPack.remainingSessions)}</p>
                <p>Prix / séance : {(selectedSwitchService.sessions > 0 ? Number(selectedSwitchService.price) / selectedSwitchService.sessions : 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} DZD</p>
                {(() => {
                  const consumed = switchPack.totalSessions - switchPack.remainingSessions;
                  const oldPPS = switchPack.totalSessions > 0 ? Number(switchPack.price) / switchPack.totalSessions : 0;
                  const newPPS = selectedSwitchService.sessions > 0 ? Number(selectedSwitchService.price) / selectedSwitchService.sessions : 0;
                  const delta = consumed * (oldPPS - newPPS);
                  return (
                    <p className={delta >= 0 ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                      Impact solde : {delta >= 0 ? '+' : ''}{delta.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} DZD
                    </p>
                  );
                })()}
              </div>
            )}
            {switchError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{switchError}</AlertDescription>
              </Alert>
            )}
            <Button
              onClick={handleSwitchPack}
              disabled={switchLoading || !switchServiceId}
              className="w-full bg-brand-700 hover:bg-brand-800"
            >
              {switchLoading && <Spinner size="sm" />}
              Changer de pack
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
