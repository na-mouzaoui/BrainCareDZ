'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePagination, PaginationControls } from '@/components/pagination-controls';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { sessionNotes } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, FileText, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';

interface Note {
  id: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  appointmentId: string;
  serviceName?: string;
  practitionerName?: string;
  presentingConcerns?: string;
  progressNotes?: string;
  observations?: string;
  createdAt: string;
  appointmentStartTime?: string;
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

export default function ReportsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    if (!authLoading && isAuthenticated) {
      loadNotes();
    }
  }, [authLoading, isAuthenticated, router]);

  async function loadNotes() {
    try {
      setIsLoading(true);
      const response = await sessionNotes.getAll();
      if (response.success && response.data) {
        const items = response.data.notes || [];
        setNotes(items);
      } else {
        setError(response.message || 'Échec du chargement');
      }
    } catch {
      setError('Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  }

  const filteredNotes = useMemo(() => {
    if (!searchTerm) return notes;
    const q = searchTerm.toLowerCase();
    return notes.filter(
      (n) =>
        `${n.patientFirstName} ${n.patientLastName}`.toLowerCase().includes(q) ||
        n.serviceName?.toLowerCase().includes(q) ||
        n.practitionerName?.toLowerCase().includes(q)
    );
  }, [notes, searchTerm]);

  const { page, setPage, totalPages, totalItems, paginatedItems } = usePagination(filteredNotes);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Comptes rendus</h1>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-2 relative">
            <Search className="h-5 w-5 text-gray-400 absolute ml-3 mt-2.5" />
            <Input
              placeholder="Rechercher par patient, service ou praticien..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {filteredNotes.length > 0 ? (
        <div className="space-y-4">
          {paginatedItems.map((note) => (
            <Card
              key={note.id}
              className="border-brand-100 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/patients/${note.patientId}/notes`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base text-brand-700">
                    {note.patientFirstName} {note.patientLastName}
                  </CardTitle>
                  <span className="text-xs text-gray-500">{note.serviceName || 'Compte rendu'}</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-800 whitespace-pre-wrap line-clamp-3 mb-3">
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
          <PaginationControls page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-lg font-medium">Aucun compte rendu</p>
            <p className="text-sm mt-1">{searchTerm ? 'Aucun résultat pour votre recherche' : 'Aucun compte rendu pour le moment.'}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
