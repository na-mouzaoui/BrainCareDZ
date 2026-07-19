'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { sessionNotes } from '@/lib/api';
import SessionNoteForm, { type SessionNoteFormData } from '@/components/session-note-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Plus, FileText, Eye, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SessionNote {
  _id: string;
  client: {
    firstName: string;
    lastName: string;
  };
  appointment: {
    _id: string;
    startTime: string;
  };
  presentingConcerns?: string;
  progressNotes?: string;
  createdAt: string;
  billable: boolean;
}

export default function SessionNotesPage() {
  const [notesList, setNotesList] = useState<SessionNote[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading && isAuthenticated) {
      loadNotes();
    }
  }, [isAuthenticated, authLoading, router]);

  async function loadNotes() {
    try {
      setIsLoading(true);
      const response = await sessionNotes.getAll();
      if (response.success && response.data) {
        setNotesList(response.data.notes || []);
      } else {
        setError(response.message || 'Échec du chargement des notes de session');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement des notes de session');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(noteId: string) {
    if (!confirm('Voulez-vous vraiment supprimer cette note de session ?')) {
      return;
    }

    try {
      const response = await sessionNotes.delete(noteId);
      if (response.success) {
        setNotesList(notesList.filter((n) => n.id !== noteId));
      } else {
        setError(response.message || 'Échec de la suppression de la note');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors de la suppression de la note');
    }
  }

  async function handleCreateNote(data: SessionNoteFormData) {
    const response = await sessionNotes.create(data);
    if (!response.success) {
      throw new Error(response.message || 'Échec de la création de la note');
    }
    setCreateOpen(false);
    await loadNotes();
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notes de session</h1>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="gap-2 bg-brand-700 hover:bg-brand-800"
          >
            <Plus className="h-4 w-4" />
            Ajouter une note
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Notes Table */}
      {notesList.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes de session ({notesList.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Préoccupations</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notesList.map((note) => (
                    <TableRow key={note._id}>
                      <TableCell className="font-medium">
                        {note.client.firstName} {note.client.lastName}
                      </TableCell>
                      <TableCell>{new Date(note.appointment.startTime).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell className="max-w-md truncate">{note.presentingConcerns || '-'}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/session-notes/${note._id}`)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(note.id)}
                          className="gap-2 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-12">
            <div className="text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Aucune note de session trouvée</p>
              <Button
                onClick={() => setCreateOpen(true)}
                className="gap-2 bg-brand-700 hover:bg-brand-800"
              >
                <Plus className="h-4 w-4" />
                Ajouter une note
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter une note de session</DialogTitle>
            <DialogDescription>
              Documentez les détails cliniques de la session.
            </DialogDescription>
          </DialogHeader>
          <SessionNoteForm onSubmit={handleCreateNote} submitButtonText="Enregistrer la note" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
