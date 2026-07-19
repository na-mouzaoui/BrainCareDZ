'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import { sessionNotes } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SessionNoteDetail {
  id: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  appointmentId?: string;
  appointmentStartTime?: string;
  presentingConcerns?: string;
  progressNotes?: string;
  createdAt: string;
}

export default function SessionNoteDetailPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const noteId = params?.id;
  const [note, setNote] = useState<SessionNoteDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading && isAuthenticated && noteId) {
      loadNote();
    }
  }, [isAuthenticated, authLoading, noteId, router]);

  async function loadNote() {
    try {
      setIsLoading(true);
      const response = await sessionNotes.getById(noteId as string);
      if (response.success && response.data) {
        setNote(response.data.note);
      } else {
        setError(response.message || 'Échec du chargement de la note de session');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement de la note de session');
    } finally {
      setIsLoading(false);
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Détails de la note de session</h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Note de session non trouvée'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {note.patient.firstName} {note.patient.lastName}
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Détails de la note de session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-600">Date</p>
            <p className="text-lg">{new Date(note.appointment.startTime).toLocaleDateString('fr-FR')}</p>
          </div>
          {note.presentingConcerns && (
            <div>
              <p className="text-sm font-medium text-gray-600">Préoccupations présentées</p>
              <p className="text-lg">{note.presentingConcerns}</p>
            </div>
          )}
          {note.progressNotes && (
            <div>
              <p className="text-sm font-medium text-gray-600">Notes de progression</p>
              <p className="text-lg">{note.progressNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
