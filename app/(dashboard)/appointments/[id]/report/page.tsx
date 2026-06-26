'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { appointments, sessionNotes, patients as patientsApi } from '@/lib/api';
import { PatientForm, type PatientFormData } from '@/components/patient-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Edit2, FileText, Eye, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FieldLabel } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

interface AppointmentPatient {
  patientId: string;
  firstName: string;
  lastName: string;
}

interface AppointmentDetail {
  id: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  serviceName: string;
  serviceType?: string;
  startTime: string;
  status: string;
  patients?: AppointmentPatient[];
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
  presentingConcerns?: string;
  progressNotes?: string;
  observations?: string;
  createdAt: string;
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
  return note.progressNotes || note.presentingConcerns || note.observations || '';
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

  const allPatients = useMemo(() => {
    if (!appointment) return [];
    const extra = (appointment.patients || []).filter(p => p.patientId !== appointment.patientId);
    const main = { patientId: appointment.patientId, firstName: appointment.patientFirstName, lastName: appointment.patientLastName };
    const unique = [main, ...extra];
    const seen = new Set<string>();
    return unique.filter(p => {
      if (seen.has(p.patientId)) return false;
      seen.add(p.patientId);
      return true;
    });
  }, [appointment]);

  const isMultiPatient = allPatients.length > 1;
  const currentPatient = allPatients[currentPatientIndex] || allPatients[0];

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

  function handleEditNote(note: SessionNoteItem) {
    const body = getNoteBody(note);
    setEditingNoteId(note.id);
    setNoteText(body || '');
  }

  function handleCancelEdit() {
    setEditingNoteId(null);
    setNoteText('');
  }

  function goToPatient(index: number) {
    if (index < 0 || index >= allPatients.length) return;
    handleCancelEdit();
    setCurrentPatientIndex(index);
  }

  function handleGoBack() {
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
              appointmentId: appointment.id,
              patientId: currentPatient.patientId,
            });
        if (!noteResponse.success) {
          throw new Error(noteResponse.message || 'Échec de la création du compte rendu');
        }
      }
      setNoteText('');
      setEditingNoteId(null);
      await loadNotesForPatient(currentPatient.patientId);
      toast({ title: 'Compte rendu sauvegardé', variant: 'default' });
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
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
          <h1 className="text-3xl font-bold text-gray-900">Compte rendu</h1>
          <p className="text-gray-600 mt-1">
            {appointment.serviceName}
          </p>
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
        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border">
          <div className="flex items-center gap-2">
            {allPatients.map((p, idx) => {
              const done = completedPatientIds.has(p.patientId);
              return (
                <button
                  key={p.patientId}
                  type="button"
                  onClick={() => goToPatient(idx)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    idx === currentPatientIndex
                      ? 'bg-emerald-600 text-white'
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
          className="flex items-center gap-2 text-lg font-semibold text-gray-800 hover:text-emerald-700 transition-colors"
        >
          <FileText className="h-5 w-5 text-emerald-600" />
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

      <div className="space-y-4">
        {sortedCurrentNotes.length > 0 ? (
          sortedCurrentNotes.map((note) => (
            <Card key={note.id} className="border-emerald-100">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base text-emerald-700">
                    {note.serviceName || 'Pack'}
                  </CardTitle>
                  {note.appointmentId === appointment.id && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditNote(note)}
                      className="gap-2"
                    >
                      <Edit2 className="h-4 w-4" />
                      Modifier
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-gray-800 whitespace-pre-wrap">
                  {getNoteBody(note) || 'Aucun contenu disponible.'}
                </p>
                <div className="text-xs text-gray-500 flex flex-wrap gap-2">
                  <span>{formatDateTime(note.appointmentStartTime || note.createdAt)}</span>
                  <span>·</span>
                  <span>{note.practitionerName || '—'}</span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              <FileText className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              Aucun compte rendu pour ce patient.
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="border-emerald-100">
        <CardHeader>
          <CardTitle className="text-emerald-700">Compte rendu et évolution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Statut</FieldLabel>
            <Select value={evoStatus} onValueChange={setEvoStatus} disabled={isSubmitting}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="En cours">En cours</SelectItem>
                <SelectItem value="Terminé">Terminé</SelectItem>
                <SelectItem value="Abandon">Abandon</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {evoStatus === 'Abandon' && (
            <Field>
              <FieldLabel>Raison de l'abandon</FieldLabel>
              <Input type="text" value={evoAbandonReason} onChange={(e) => setEvoAbandonReason(e.target.value)} disabled={isSubmitting} />
            </Field>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Amélioration perçue (0-10)</FieldLabel>
              <Input type="number" min={0} max={10} value={evoPerceivedImprovement ?? ''} onChange={(e) => setEvoPerceivedImprovement(e.target.value ? parseInt(e.target.value) : undefined)} disabled={isSubmitting} />
            </Field>
            <Field>
              <FieldLabel>Satisfaction globale (0-10)</FieldLabel>
              <Input type="number" min={0} max={10} value={evoGlobalSatisfaction ?? ''} onChange={(e) => setEvoGlobalSatisfaction(e.target.value ? parseInt(e.target.value) : undefined)} disabled={isSubmitting} />
            </Field>
          </div>
          <Field>
            <FieldLabel>Changements observés</FieldLabel>
            <Input type="text" value={evoObservedChanges} onChange={(e) => setEvoObservedChanges(e.target.value)} disabled={isSubmitting} />
          </Field>
          <Field>
            <FieldLabel>Recommanderait-il ?</FieldLabel>
            <div className="flex items-center gap-4 py-2">
              {['Non', 'Oui'].map((option) => (
                <div key={option} className="flex items-center gap-2">
                  <input type="radio" id={`evoreco-${option}`} name="evoWouldRecommend" checked={evoWouldRecommend === (option === 'Oui')} onChange={() => setEvoWouldRecommend(option === 'Oui')} disabled={isSubmitting} />
                  <label htmlFor={`evoreco-${option}`} className="text-sm cursor-pointer">{option}</label>
                </div>
              ))}
            </div>
          </Field>
          <div className="border-t pt-4">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder={`Écrire un compte rendu pour ${currentPatient?.firstName || 'le patient'}...`}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex justify-end gap-2">
            {editingNoteId && (
              <Button type="button" variant="ghost" onClick={handleCancelEdit} disabled={isSubmitting}>
                Annuler
              </Button>
            )}
            <Button type="button" onClick={handleSaveAll} disabled={isSubmitting} className="gap-2">
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Sauvegarde...' : 'Enregistrer'}
            </Button>
          </div>
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
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : viewPatient ? (
            <PatientForm
              initialData={viewPatient as unknown as PatientFormData}
              onSubmit={async () => {}}
              readOnly
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
