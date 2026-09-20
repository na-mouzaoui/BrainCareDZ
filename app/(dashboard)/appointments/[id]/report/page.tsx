'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { appointments, sessionNotes, patients as patientsApi, patientPacks, services as servicesApi } from '@/lib/api';
import { PatientForm, type PatientFormData } from '@/components/patient-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Edit2, FileText, Eye, Save } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { DetailPageSkeleton } from '@/components/page-skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FieldLabel } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

interface AppointmentPatient {
  appointmentPatientId: string;
  patientId: string;
  firstName: string;
  lastName: string;
  packSelected?: boolean;
}

interface AppointmentDetail {
  id: string;
  serviceName: string | null;
  serviceType?: string;
  serviceId?: string;
  servicePrice?: number;
  startTime: string;
  status: string;
  packDeferred?: boolean;
  patients: AppointmentPatient[];
}

interface ViewPatient {
  id?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

interface SessionNoteItem {
  id: string;
  patientId?: string;
  appointmentId: string;
  appointmentStartTime?: string;
  serviceName?: string;
  practitionerName?: string;
  progressNotes?: string;
  createdAt: string;
}

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  sessions?: number;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  const date = dt.toLocaleDateString('fr-FR');
  const time = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function getNoteBody(note: SessionNoteItem) {
  return note.progressNotes || '';
}

export default function AppointmentReportPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const appointmentId = params?.id as string | undefined;
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [notes, setNotes] = useState<SessionNoteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [noteText, setNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [currentPatientIndex, setCurrentPatientIndex] = useState(0);
  const [viewPatient, setViewPatient] = useState<ViewPatient | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [evoStatus, setEvoStatus] = useState('');
  const [evoAbandonReason, setEvoAbandonReason] = useState('');
  const [evoPerceivedImprovement, setEvoPerceivedImprovement] = useState<number | undefined>(undefined);
  const [evoObservedChanges, setEvoObservedChanges] = useState('');
  const [evoGlobalSatisfaction, setEvoGlobalSatisfaction] = useState<number | undefined>(undefined);
  const [evoWouldRecommend, setEvoWouldRecommend] = useState(false);
  const [isViewing, setIsViewing] = useState(true);
  const [packDialogOpen, setPackDialogOpen] = useState(false);
  const [packSubmitting, setPackSubmitting] = useState(false);
  const [packError, setPackError] = useState('');
  const [servicesList, setServicesList] = useState<ServiceItem[]>([]);
  const [packServiceId, setPackServiceId] = useState('');
  const [patientPacksList, setPatientPacksList] = useState<{ id: string; serviceName: string; serviceId: string; remainingSessions: number; totalSessions: number; price: number }[]>([]);

  const allPatients = useMemo(() => {
    if (!appointment) return [];
    const seen = new Set<string>();
    return (appointment.patients || []).filter(p => {
      if (seen.has(p.patientId)) return false;
      seen.add(p.patientId);
      return true;
    });
  }, [appointment]);

  const isMultiPatient = allPatients.length > 1;
  const currentPatient = allPatients[currentPatientIndex] || allPatients[0];

  const selectedPackService = useMemo(() => {
    const id = appointment?.serviceId || packServiceId;
    if (!id) return undefined;
    return servicesList.find((s) => s.id === id);
  }, [appointment?.serviceId, packServiceId, servicesList]);

  const completedPatientIds = useMemo(() => {
    const completed = new Set<string>();
    notes.forEach(n => {
      if (n.appointmentId === appointment?.id && n.patientId) {
        completed.add(n.patientId);
      }
    });
    return completed;
  }, [notes, appointment?.id]);

  const missingPatients = useMemo(() => {
    return allPatients.filter(p => !completedPatientIds.has(p.patientId));
  }, [allPatients, completedPatientIds]);

  const allCompleted = !isMultiPatient || missingPatients.length === 0;

  const currentPatientNotes = useMemo(() => {
    if (!currentPatient) return [];
    return notes.filter(n => n.patientId === currentPatient.patientId && n.appointmentId === appointment?.id);
  }, [notes, currentPatient, appointment?.id]);

  const sortedCurrentNotes = useMemo(() => {
    return [...currentPatientNotes].sort((a, b) => {
      const aTime = new Date(a.appointmentStartTime || a.createdAt).getTime();
      const bTime = new Date(b.appointmentStartTime || b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [currentPatientNotes]);

  useEffect(() => {
    if (sortedCurrentNotes.length === 0) {
      setIsViewing(false);
    } else {
      setIsViewing(true);
      setEditingNoteId(null);
      setNoteText('');
    }
  }, [sortedCurrentNotes.length, currentPatient?.patientId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading && isAuthenticated && appointmentId) {
      loadAppointment();
    }
  }, [authLoading, isAuthenticated, appointmentId, router]);

  async function loadAppointment() {
    try {
      setIsLoading(true);
      setError('');
      const response = await appointments.getById(appointmentId as string);
      if (response.success && response.data?.appointment) {
        setAppointment(response.data.appointment as AppointmentDetail);
      } else {
        setError(response.message || 'Échec du chargement du rendez-vous');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement du rendez-vous');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadNotesForPatient(patientId: string) {
    try {
      const response = await sessionNotes.getByPatient(patientId, appointmentId);
      if (response.success && response.data) {
        const items = response.data.notes || [];
        setNotes(prev => {
          const other = prev.filter(n => n.patientId !== patientId);
          return [...other, ...items];
        });
      }
    } catch {
      // keep existing notes
    }
  }

  useEffect(() => {
    if (currentPatient) {
      loadNotesForPatient(currentPatient.patientId);
    }
  }, [currentPatient?.patientId, appointmentId]);

  const currentPatientPackPending = useMemo(() => {
    if (!appointment?.packDeferred) return false;
    if (!currentPatient) return false;
    return currentPatient.packSelected !== true;
  }, [appointment?.packDeferred, currentPatient]);

  useEffect(() => {
    servicesApi
      .getAll()
      .then((res) => {
        if (res.success && res.data) {
          setServicesList(Array.isArray(res.data) ? res.data : res.data.services || []);
        }
      })
      .catch(() => {
        // keep services empty
      });
  }, []);

  useEffect(() => {
    if (packDialogOpen && currentPatient) {
      patientPacks.getByPatient(currentPatient.patientId).then((res) => {
        if (res.success && res.data) {
          setPatientPacksList(res.data.packs || []);
        }
      }).catch(() => setPatientPacksList([]));
    }
  }, [packDialogOpen, currentPatient?.patientId]);

  useEffect(() => {
    if (packDialogOpen && appointment?.serviceId) {
      setPackServiceId(appointment.serviceId);
    }
  }, [packDialogOpen, appointment?.serviceId]);

  function handleEditNote(note: SessionNoteItem) {
    const body = getNoteBody(note);
    setEditingNoteId(note.id);
    setNoteText(body || '');
    setIsViewing(false);
  }

  function handleCancelEdit() {
    setEditingNoteId(null);
    setNoteText('');
    setIsViewing(true);
  }

  function goToPatient(index: number) {
    if (index < 0 || index >= allPatients.length) return;
    handleCancelEdit();
    setIsViewing(true);
    setCurrentPatientIndex(index);
  }

  function handleGoBack() {
    if (currentPatientPackPending) {
      setPackDialogOpen(true);
      toast({
        title: 'Pack à sélectionner',
        description: `Un pack doit être sélectionné pour ${currentPatient.firstName} ${currentPatient.lastName} avant de quitter.`,
        variant: 'destructive',
      });
      return;
    }
    if (!allCompleted) {
      const names = missingPatients.map(p => `${p.firstName} ${p.lastName}`).join(', ');
      toast({
        title: 'Comptes rendus obligatoires',
        description: `Vous devez rédiger un compte rendu pour : ${names}`,
        variant: 'destructive',
      });
      return;
    }
    router.back();
  }

  async function loadPatientEvolution(patientId: string) {
    try {
      const response = await patientsApi.getById(patientId);
      if (response.success && response.data) {
        const p = response.data.patient || response.data;
        setEvoStatus(p.status || '');
        setEvoAbandonReason(p.abandonReason || '');
        setEvoPerceivedImprovement(p.perceivedImprovement ?? undefined);
        setEvoObservedChanges(p.observedChanges || '');
        setEvoGlobalSatisfaction(p.globalSatisfaction ?? undefined);
        setEvoWouldRecommend(p.wouldRecommend ?? false);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (currentPatient) {
      loadPatientEvolution(currentPatient.patientId);
    }
  }, [currentPatient?.patientId]);

  async function handleSaveAll() {
    if (!appointment || !currentPatient) return;
    setIsSubmitting(true);
    try {
      const evoResponse = await patientsApi.update(currentPatient.patientId, {
        status: evoStatus,
        abandonReason: evoAbandonReason || undefined,
        perceivedImprovement: evoPerceivedImprovement,
        observedChanges: evoObservedChanges || undefined,
        globalSatisfaction: evoGlobalSatisfaction,
        wouldRecommend: evoWouldRecommend,
      });
      if (!evoResponse.success) {
        throw new Error(evoResponse.message || 'Échec de la sauvegarde de l\'évolution');
      }
      if (noteText.trim()) {
        const noteResponse = editingNoteId
          ? await sessionNotes.update(editingNoteId, { progressNotes: noteText.trim() })
          : await sessionNotes.create({
              progressNotes: noteText.trim(),
              appointmentPatientId: currentPatient.appointmentPatientId,
            });
        if (!noteResponse.success) {
          throw new Error(noteResponse.message || 'Échec de la création du compte rendu');
        }
      }
      if (appointment.status !== 'completed') {
        await appointments.complete(appointment.id);
      }
      setNoteText('');
      setEditingNoteId(null);
      setIsViewing(true);
      toast({ title: 'Compte rendu sauvegardé', variant: 'default' });
      if (currentPatientPackPending) {
        setPackDialogOpen(true);
      } else {
        router.push(`/payments?patientId=${currentPatient.patientId}`);
      }
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Une erreur est survenue',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSelectPack() {
    if (!currentPatient) return;
    const selectedServiceId = appointment?.serviceId || packServiceId;
    if (!selectedServiceId) {
      setPackError('Veuillez sélectionner un pack');
      return;
    }
    const pack = servicesList.find((s) => s.id === selectedServiceId);
    if (!pack) {
      setPackError('Pack introuvable');
      return;
    }
    setPackError('');
    const totalSessions = Number(pack.sessions) > 0 ? Number(pack.sessions) : 1;
    setPackSubmitting(true);
    try {
      const price = Number(pack.price);
      const response = await patientPacks.selectForSession({
        patientId: currentPatient.patientId,
        serviceId: selectedServiceId,
        totalSessions,
        price,
        appointmentPatientId: currentPatient.appointmentPatientId,
      });
      if (!response.success) {
        setPackError(response.message || 'Échec de la sélection du pack');
        return;
      }
      setPackDialogOpen(false);
      setPackServiceId('');
      toast({ title: 'Pack sélectionné', description: 'La première séance a été débitée du pack.', variant: 'default' });
      router.push(`/payments?patientId=${currentPatient.patientId}`);
    } catch (err) {
      setPackError('Une erreur s\'est produite lors de la sélection du pack');
    } finally {
      setPackSubmitting(false);
    }
  }

  async function handleViewPatient(patientId: string) {
    setViewLoading(true);
    try {
      const response = await patientsApi.getById(patientId);
      if (response.success && response.data) {
        setViewPatient(response.data.patient || response.data as ViewPatient);
        setViewOpen(true);
      } else {
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les informations du patient',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Erreur',
        description: 'Une erreur est survenue',
        variant: 'destructive',
      });
    } finally {
      setViewLoading(false);
    }
  }

  if (authLoading || isLoading) {
    return <DetailPageSkeleton />;
  }

  if (error || !appointment) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => router.back()} className="gap-2 w-fit">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Rendez-vous introuvable'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Compte rendu</h1>
        </div>
        <Button variant="outline" onClick={handleGoBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
      </div>

      {!allCompleted && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Vous devez rédiger un compte rendu pour chaque patient avant de quitter.
          </AlertDescription>
        </Alert>
      )}

      {isMultiPatient && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-gray-50 rounded-lg p-3 border">
          <div className="flex flex-wrap items-center gap-2">
            {allPatients.map((p, idx) => {
              const done = completedPatientIds.has(p.patientId);
              return (
                <button
                  key={p.patientId}
                  type="button"
                  onClick={() => goToPatient(idx)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    idx === currentPatientIndex
                      ? 'bg-brand-600 text-white'
                      : 'bg-white text-gray-700 border hover:bg-gray-100'
                  }`}
                >
                  {p.firstName} {p.lastName}
                  {done ? ' ✓' : idx === currentPatientIndex ? '' : ' ○'}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => goToPatient(currentPatientIndex - 1)}
              disabled={currentPatientIndex === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Précédent
            </Button>
            <span className="text-sm text-gray-500">
              {currentPatientIndex + 1}/{allPatients.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => goToPatient(currentPatientIndex + 1)}
              disabled={currentPatientIndex >= allPatients.length - 1}
              className="gap-1"
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {currentPatient && (
        <button
          type="button"
          onClick={() => handleViewPatient(currentPatient.patientId)}
          className="flex items-center gap-2 text-lg font-semibold text-gray-800 hover:text-brand-700 transition-colors"
        >
          <FileText className="h-5 w-5 text-brand-600" />
          {currentPatient.firstName} {currentPatient.lastName}
          <Eye className="h-4 w-4 text-gray-400" />
        </button>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-brand-100">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-brand-700 text-base">Compte rendu et évolution</CardTitle>
            {isViewing && sortedCurrentNotes.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => handleEditNote(sortedCurrentNotes[0])} className="gap-1">
                <Edit2 className="h-3 w-3" />
                Modifier
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {isViewing ? (
            <>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                <span><span className="font-medium">Statut :</span> {evoStatus || '—'}</span>
                <span><span className="font-medium">Amélioration perçue :</span> {evoPerceivedImprovement ?? '—'}/10</span>
                <span><span className="font-medium">Satisfaction globale :</span> {evoGlobalSatisfaction ?? '—'}/10</span>
                <span><span className="font-medium">Recommanderait-il :</span> {evoWouldRecommend ? 'Oui' : 'Non'}</span>
                <span><span className="font-medium">Changements observés :</span> {evoObservedChanges || '—'}</span>
                {evoStatus === 'Abandon' && <span><span className="font-medium">Raison de l'abandon :</span> {evoAbandonReason || '—'}</span>}
              </div>
              {sortedCurrentNotes.length > 0 && (
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words border-t pt-2">{getNoteBody(sortedCurrentNotes[0]) || 'Aucun contenu.'}</p>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <FieldLabel className="shrink-0 text-xs">Statut</FieldLabel>
                  <Select value={evoStatus} onValueChange={setEvoStatus} disabled={isSubmitting}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Statut" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="En cours">En cours</SelectItem>
                      <SelectItem value="Terminé">Terminé</SelectItem>
                      <SelectItem value="Abandon">Abandon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {evoStatus === 'Abandon' && (
                  <div className="flex items-center gap-2">
                    <FieldLabel className="shrink-0 text-xs">Raison</FieldLabel>
                    <Input className="h-8 text-xs" type="text" value={evoAbandonReason} onChange={(e) => setEvoAbandonReason(e.target.value)} disabled={isSubmitting} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <FieldLabel className="shrink-0 text-xs">Amélioration</FieldLabel>
                  <Input className="h-8 text-xs" type="number" min={0} max={10} value={evoPerceivedImprovement ?? ''} onChange={(e) => setEvoPerceivedImprovement(e.target.value ? parseInt(e.target.value) : undefined)} disabled={isSubmitting} />
                </div>
                <div className="flex items-center gap-2">
                  <FieldLabel className="shrink-0 text-xs">Satisfaction</FieldLabel>
                  <Input className="h-8 text-xs" type="number" min={0} max={10} value={evoGlobalSatisfaction ?? ''} onChange={(e) => setEvoGlobalSatisfaction(e.target.value ? parseInt(e.target.value) : undefined)} disabled={isSubmitting} />
                </div>
                <div className="flex items-center gap-2">
                  <FieldLabel className="shrink-0 text-xs">Changements</FieldLabel>
                  <Input className="h-8 text-xs" type="text" value={evoObservedChanges} onChange={(e) => setEvoObservedChanges(e.target.value)} disabled={isSubmitting} />
                </div>
                <div className="flex items-center gap-2">
                  <FieldLabel className="shrink-0 text-xs">Recommande</FieldLabel>
                  <div className="flex items-center gap-2">
                    {['Non', 'Oui'].map((option) => (
                      <label key={option} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="radio" name="evoWouldRecommend" checked={evoWouldRecommend === (option === 'Oui')} onChange={() => setEvoWouldRecommend(option === 'Oui')} disabled={isSubmitting} />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t pt-2">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={2}
                  placeholder={`Compte rendu pour ${currentPatient?.firstName || 'le patient'}...`}
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSubmitting}>
                  Annuler
                </Button>
                <Button type="button" size="sm" onClick={handleSaveAll} disabled={isSubmitting} className="gap-1">
                  <Save className="h-3 w-3" />
                  {isSubmitting ? 'Sauvegarde...' : 'Enregistrer'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Patient detail dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>
              {viewPatient ? `${viewPatient.firstName} ${viewPatient.lastName}` : 'Détails du patient'}
            </DialogTitle>
            <DialogDescription>
              Informations sur le patient (lecture seule)
            </DialogDescription>
          </DialogHeader>
          {viewLoading ? (
            <Spinner />
          ) : viewPatient ? (
            <PatientForm
              initialData={viewPatient as unknown as PatientFormData}
              onSubmit={async () => {}}
              readOnly
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Obligatory pack selection dialog (deferred pack) */}
      <Dialog open={packDialogOpen} onOpenChange={(open) => { if (open) setPackDialogOpen(true); }}>
        <DialogContent
          showCloseButton={false}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Sélectionner le pack</DialogTitle>
            <DialogDescription>
              Ce rendez-vous a été marqué « pack après la séance ». Vous devez sélectionner un pack pour{' '}
              <span className="font-semibold text-gray-800">{currentPatient?.firstName} {currentPatient?.lastName}</span>{' '}
              avant de continuer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {packError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{packError}</AlertDescription>
              </Alert>
            )}
            <Field>
              <FieldLabel>Pack (service) {!appointment?.serviceId ? '*' : ''}</FieldLabel>
              {appointment?.serviceId ? (
                <Input type="text" value={appointment?.serviceName || ''} readOnly disabled />
              ) : (
                <Select value={packServiceId} onValueChange={setPackServiceId} disabled={packSubmitting}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un pack" />
                  </SelectTrigger>
                  <SelectContent>
                    {patientPacksList.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50">
                          Packs en cours du patient
                        </div>
                        {patientPacksList.map((pack) => (
                          <SelectItem key={`active-${pack.serviceId}`} value={pack.serviceId}>
                            {pack.serviceName} — {pack.remainingSessions}/{pack.totalSessions} séances restantes
                            {Number(pack.price) > 0 ? ` — ${Number(pack.price).toLocaleString('fr-FR')} DZD` : ''}
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 mt-1">
                          Autres packs
                        </div>
                      </>
                    )}
                    {servicesList
                      .filter((s) => !patientPacksList.some((p) => p.serviceId === s.id))
                      .map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} — {Number(service.price).toLocaleString('fr-FR')} DZD
                          {Number(service.sessions) > 1 ? ` (${service.sessions} séances)` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            {selectedPackService && (
              <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Nombre de séances :</span>
                  <span className="font-semibold">
                    {Number(selectedPackService.sessions) > 0 ? selectedPackService.sessions : 1}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Séances restantes :</span>
                  <span className="font-semibold">
                    {(Number(selectedPackService.sessions) > 0 ? Number(selectedPackService.sessions) : 1) - 1}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Prix du pack :</span>
                  <span className="font-semibold">{Number(selectedPackService.price).toFixed(2)} DZD</span>
                </div>
              </div>
            )}
            <Button
              type="button"
              onClick={handleSelectPack}
              disabled={packSubmitting}
              className="w-full gap-2"
            >
              <Save className="h-4 w-4" />
              {packSubmitting ? 'Sélection...' : 'Sélectionner le pack et débiter la séance'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
