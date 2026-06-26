'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { sessionNotes, patients } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Note {
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

interface PatientInfo {
  id: string;
  firstName: string;
  lastName: string;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  const date = dt.toLocaleDateString('fr-FR');
  const time = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function getNoteBody(note: Note) {
  return note.progressNotes || note.presentingConcerns || note.observations || '';
}

export default function PatientNotesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const patientId = params?.id as string | undefined;
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    if (!authLoading && isAuthenticated && patientId) {
      loadData();
    }
  }, [authLoading, isAuthenticated, patientId, router]);

  async function loadData() {
    if (!patientId) return;
    try {
      setIsLoading(true);
      const [patientRes, notesRes] = await Promise.all([
        patients.getById(patientId),
        sessionNotes.getByPatient(patientId),
      ]);
      if (patientRes.success && patientRes.data) {
        const p = patientRes.data.patient || patientRes.data;
        setPatient({ id: p.id, firstName: p.firstName || '', lastName: p.lastName || '' });
      } else {
        setError(patientRes.message || 'Patient introuvable');
      }
      if (notesRes.success && notesRes.data) {
        const items = Array.isArray(notesRes.data) ? notesRes.data : notesRes.data.notes || [];
        setNotes(items);
      }
    } catch {
      setError('Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const sortedNotes = [...notes].sort((a, b) => {
    const aTime = new Date(a.appointmentStartTime || a.createdAt).getTime();
    const bTime = new Date(b.appointmentStartTime || b.createdAt).getTime();
    return bTime - aTime;
  });

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {patient ? `${patient.firstName} ${patient.lastName}` : 'Patient'}
            </h1>
            <p className="text-gray-600 mt-1">Historique des comptes rendus</p>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {sortedNotes.length > 0 ? (
        <div className="space-y-4">
          {sortedNotes.map((note) => (
            <Card key={note.id} className="border-emerald-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-emerald-700">
                  {note.serviceName || 'Compte rendu'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-800 whitespace-pre-wrap mb-3">
                  {getNoteBody(note) || 'Aucun contenu disponible.'}
                </p>
                <div className="text-xs text-gray-500 flex flex-wrap gap-2">
                  <span>{formatDateTime(note.appointmentStartTime || note.createdAt)}</span>
                  <span>·</span>
                  <span>{note.practitionerName || '—'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-lg font-medium">Aucun compte rendu</p>
            <p className="text-sm mt-1">Ce patient n'a pas encore de comptes rendus.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
