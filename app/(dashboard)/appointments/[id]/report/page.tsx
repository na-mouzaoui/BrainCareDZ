'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { appointments, sessionNotes } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, Edit2, FileText, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

interface AppointmentDetail {
  id: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  serviceName: string;
  startTime: string;
  status: string;
}

interface SessionNoteItem {
  id: string;
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
        await loadNotes(response.data.appointment.patientId);
      } else {
        setError(response.message || 'Échec du chargement du rendez-vous');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement du rendez-vous');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadNotes(patientId: string) {
    try {
      const response = await sessionNotes.getByPatient(patientId);
      if (response.success && response.data) {
        const items = response.data.notes || [];
        setNotes(items);
      }
    } catch {
      setNotes([]);
    }
  }

  async function handleCreateNote() {
    if (!appointment) return;
    if (!noteText.trim()) return;

    setIsSubmitting(true);
    try {
      const response = editingNoteId
        ? await sessionNotes.update(editingNoteId, {
            progressNotes: noteText.trim(),
          })
        : await sessionNotes.create({
            progressNotes: noteText.trim(),
            appointmentId: appointment.id,
            patientId: appointment.patientId,
          });

      if (!response.success) {
        throw new Error(response.message || 'Échec de la création du compte rendu');
      }

      setNoteText('');
      setEditingNoteId(null);
      await loadNotes(appointment.patientId);
    } catch (err) {
      toast({
        title: 'Impossible de creer le compte rendu',
        description: err instanceof Error ? err.message : 'Veuillez reessayer.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEditNote(note: SessionNoteItem) {
    const body = getNoteBody(note);
    setEditingNoteId(note.id);
    setNoteText(body || '');
  }

  function handleCancelEdit() {
    setEditingNoteId(null);
    setNoteText('');
  }

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      const aTime = new Date(a.appointmentStartTime || a.createdAt).getTime();
      const bTime = new Date(b.appointmentStartTime || b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [notes]);

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
            {appointment.patientFirstName} {appointment.patientLastName} · {appointment.serviceName}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()} className="gap-2">
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

      <div className="space-y-4">
        {sortedNotes.length > 0 ? (
          sortedNotes.map((note) => (
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

      <div className="border-t pt-4">
        <div className="flex flex-col gap-3">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            placeholder="Écrire un compte rendu..."
            disabled={isSubmitting}
          />
          <div className="flex justify-end">
            <div className="flex items-center gap-2">
              {editingNoteId && (
                <Button type="button" variant="ghost" onClick={handleCancelEdit}>
                  Annuler
                </Button>
              )}
              <Button
                type="button"
                onClick={handleCreateNote}
                disabled={isSubmitting || !noteText.trim()}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {editingNoteId ? 'Mettre a jour' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
