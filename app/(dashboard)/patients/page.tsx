'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { patients } from '@/lib/api';
import { PatientForm, type PatientFormData } from '@/components/patient-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Plus, Search, Edit2, Trash2, FileText, History } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePagination, PaginationControls } from '@/components/pagination-controls';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  sessionCount: number;
  balance: number;
  packServiceName?: string;
  packRemaining?: number;
  packTotal?: number;
  packList?: Array<{
    serviceName: string;
    packTotal: number;
    packRemaining: number;
    nextAppointment?: string | null;
  }>;
  lastSessionDate?: string;
}

export default function PatientsPage() {
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [editPatientData, setEditPatientData] = useState<PatientFormData | undefined>(undefined);
  const [editLoading, setEditLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [viewPatientData, setViewPatientData] = useState<PatientFormData | undefined>(undefined);
  const [viewLoading, setViewLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { page, setPage, totalPages, totalItems, paginatedItems } = usePagination(filteredPatients);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  async function loadViewPatient(id: string) {
    try {
      setViewLoading(true);
      const response = await patients.getById(id);
      if (response.success && response.data) {
        setViewPatientData(response.data as PatientFormData);
      } else {
        setError(response.message || 'Impossible de charger le patient');
      }
    } catch {
      setError('Une erreur est survenue lors du chargement du patient');
    } finally {
      setViewLoading(false);
    }
  }

  function handleOpenView(patient: Patient) {
    setSelectedPatient(patient);
    setViewOpen(true);
    loadViewPatient(patient.id);
  }

  function handleCloseView() {
    setViewOpen(false);
    setSelectedPatient(null);
    setViewPatientData(undefined);
  }

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading && isAuthenticated) {
      loadPatients();
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredPatients(patientsList);
    } else {
      const filtered = patientsList.filter(
        (patient) =>
          `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          patient.phone.includes(searchTerm)
      );
      setFilteredPatients(filtered);
    }
  }, [searchTerm, patientsList]);

  async function loadPatients(): Promise<Patient[]> {
    try {
      setIsLoading(true);
      const response = await patients.getAll();
      
      if (response.success && response.data) {
        const rows = Array.isArray(response.data) ? response.data : response.data.patients || [];
        setPatientsList(rows);
        return rows;
      } else {
        setError(response.message || 'Échec du chargement des patients');
        return [];
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement des patients');
      return [];
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(patientId: string, patientName: string) {
    if (!confirm(`Voulez-vous vraiment supprimer définitivement ${patientName} ? Cette action est irréversible.`)) {
      return;
    }

    try {
      setError('');
      const response = await patients.delete(patientId);
      if (response.success) {
        await loadPatients();
      } else {
        setError(response.message || 'Échec de la suppression du patient');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors de la suppression du patient');
    }
  }

  useEffect(() => {
    if (!authLoading && isAuthenticated && editingPatientId) {
      loadEditPatient(editingPatientId);
    }
  }, [authLoading, isAuthenticated, editingPatientId]);

  async function loadEditPatient(id: string) {
    try {
      setEditLoading(true);
      const response = await patients.getById(id);
      if (response.success && response.data) {
        setEditPatientData(response.data as PatientFormData);
      } else {
        setError(response.message || 'Impossible de charger le patient');
      }
    } catch {
      setError('Une erreur est survenue lors du chargement du patient');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleCreatePatient(data: PatientFormData) {
    const response = await patients.create(data);
    if (!response.success) {
      throw new Error(response.message || response.error || 'Échec de la création du patient');
    }

    const createdPatient = response.data as Patient | undefined;
    setCreateOpen(false);
    const latestPatients = await loadPatients();

    if (createdPatient?.id && !latestPatients.some((patient) => patient.id === createdPatient.id)) {
      throw new Error('Patient non persisté en base de données. Vérifiez la connexion backend PostgreSQL.');
    }
  }

  async function handleUpdatePatient(data: PatientFormData) {
    if (!editingPatientId) return;
    const response = await patients.update(editingPatientId, data);
    if (!response.success) {
      throw new Error(response.message || response.error || 'Échec de la mise à jour du patient');
    }
    setEditOpen(false);
    setEditingPatientId(null);
    setEditPatientData(undefined);
    await loadPatients();
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
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Patients</h1>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="gap-2 bg-brand-700 hover:bg-brand-800"
          >
            <Plus className="h-4 w-4" />
            Nouveau patient
          </Button>
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
          <div className="flex gap-2">
            <Search className="h-5 w-5 text-gray-400 absolute ml-3 mt-2.5" />
            <Input
              placeholder="Rechercher par nom, e-mail ou téléphone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            </div>
            <PaginationControls page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
          </CardContent>
        </Card>

      {filteredPatients.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Patients ({totalItems})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Pack</TableHead>
                    <TableHead>Solde</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
<TableBody>
                  {paginatedItems.map((patient) => {
                    return (
                      <TableRow
                        key={patient.id}
                        className="cursor-pointer"
                        onClick={() => handleOpenView(patient)}
                      >
                        <TableCell className="font-medium">
                          {patient.firstName} {patient.lastName}
                        </TableCell>
                        <TableCell>{patient.email || '—'}</TableCell>
                        <TableCell>{patient.phone}</TableCell>
                        <TableCell>
                          {patient.packServiceName && (patient.packRemaining ?? 0) > 0 ? (
                            <span className="text-sm font-medium text-brand-700">
                              {patient.packServiceName} ({patient.packRemaining || 0})
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className={patient.balance > 0 ? 'text-green-600 font-semibold' : patient.balance < 0 ? 'text-red-600 font-semibold' : ''}>
                          {patient.balance > 0 ? '+' : ''}{patient.balance} DZD
                        </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistoryPatient(patient);
                            setHistoryOpen(true);
                            setHistoryLoading(true);
                            patients.getHistory(patient.id).then((res: any) => {
                              setHistoryData(res.data || []);
                              setHistoryLoading(false);
                            }).catch(() => setHistoryLoading(false));
                          }}
                          className="gap-2"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPatientId(patient.id);
                            setEditOpen(true);
                          }}
                          className="gap-2"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(patient.id, `${patient.firstName} ${patient.lastName}`);
                          }}
                          className="gap-2 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-12">
            <div className="text-center">
              <p className="text-gray-500 mb-4">
                {searchTerm ? 'Aucun patient ne correspond à votre recherche' : 'Aucun patient pour le moment'}
              </p>
              <Button
                onClick={() => setCreateOpen(true)}
                className="gap-2 bg-brand-700 hover:bg-brand-800"
              >
                <Plus className="h-4 w-4" />
                Ajouter votre premier patient
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>Nouveau patient</DialogTitle>
            <DialogDescription>
              Remplissez le formulaire pour créer un nouveau patient.
            </DialogDescription>
          </DialogHeader>
          <PatientForm onSubmit={handleCreatePatient} />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) { setEditOpen(false); setEditingPatientId(null); setEditPatientData(undefined); } }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>Modifier le patient</DialogTitle>
            <DialogDescription>
              Mettez à jour les informations du patient.
            </DialogDescription>
          </DialogHeader>
          <PatientForm
            initialData={editPatientData}
            isLoading={editLoading}
            onSubmit={handleUpdatePatient}
            submitButtonText="Enregistrer les modifications"
            key={editingPatientId}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={(open) => { if (!open) handleCloseView(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>
              {selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : 'Détails du patient'}
            </DialogTitle>
            <DialogDescription>
              Informations sur le patient (lecture seule)
            </DialogDescription>
          </DialogHeader>
          {viewLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            </div>
          ) : selectedPatient ? (
            <div className="px-6 pb-6">
              <PatientForm
                initialData={viewPatientData}
                onSubmit={async () => {}}
                readOnly
                key={selectedPatient.id}
              />
              <div className="mt-4 flex justify-end border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    handleCloseView();
                    router.push(`/patients/${selectedPatient.id}/notes`);
                  }}
                >
                  <FileText className="h-4 w-4" />
                  Voir l'historique des comptes rendus
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {historyPatient ? `${historyPatient.firstName} ${historyPatient.lastName}` : 'Patient'} — Historique des séances
            </DialogTitle>
            <DialogDescription>
              Packs, services et séances consommés par le patient
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            </div>
          ) : historyData.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucune séance trouvée</p>
          ) : (
            <div className="space-y-3">
              {historyData.map((item: any) => {
                const startTime = new Date(item.startTime);
                const now = new Date();
                const isPlanned = startTime > now && item.status === 'scheduled';
                return (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.serviceName}</p>
                      <p className="text-sm text-gray-500">
                        {startTime.toLocaleDateString('fr-FR')} à {startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {item.packTotal && (
                        <p className="text-xs text-gray-400">
                          Pack : {item.packRemaining}/{item.packTotal} séances restantes
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isPlanned ? (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                          Planifiée
                        </span>
                      ) : item.status === 'completed' ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                          Effectuée
                        </span>
                      ) : item.status === 'cancelled' ? (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                          Annulée
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full font-medium">
                          {item.status}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}