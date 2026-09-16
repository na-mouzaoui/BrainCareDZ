'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { patients } from '@/lib/api';
import { PatientForm, type PatientFormData } from '@/components/patient-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Plus, Edit2, Trash2, History } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePagination, PaginationControls } from '@/components/pagination-controls';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import FilterDialog, {
  type FilterField,
  type FilterValues,
  resetFilters,
} from '@/components/filter-dialog';
import { useSort, SortableHeader } from '@/components/sortable-header';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  sessionCount: number;
  balance: number;
  practitionerName?: string;
  packServiceName?: string;
  packRemaining?: number;
  packTotal?: number;
  packPricePerSession?: number;
  packList?: Array<{
    serviceName: string;
    packTotal: number;
    packRemaining: number;
    nextAppointment?: string | null;
  }>;
  lastSessionDate?: string;
  consecutiveNoShows?: number;
  isProspect?: boolean;
  createdAt?: string;
}

export default function PatientsPage() {
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [filters, setFilters] = useState<FilterValues>({});
  const filterFields: FilterField[] = [
    { key: 'name', label: 'Nom / Email / Téléphone', type: 'text', placeholder: 'Rechercher un patient' },
    { key: 'practitionerName', label: 'Praticien en charge', type: 'text', placeholder: 'Nom du praticien' },
    { key: 'packServiceName', label: 'Pack', type: 'text', placeholder: 'Nom du pack' },
    { key: 'sessionCount', label: 'Nombre de séances', type: 'number-range' },
    { key: 'balance', label: 'Solde (DZD)', type: 'number-range' },
    { key: 'isProspect', label: 'Prospects uniquement', type: 'checkbox' },
  ];
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { sortKey, direction, toggleSort, sortedItems } = useSort(
    filteredPatients,
    {
      name: (p) => `${p.firstName} ${p.lastName}`,
      email: (p) => p.email || '',
      phone: (p) => p.phone,
      practitionerName: (p) => p.practitionerName || '',
      packServiceName: (p) => p.packServiceName || '',
      balance: (p) => Number(p.balance) || 0,
      isProspect: (p) => (p.isProspect ? 1 : 0),
      createdAt: (p) => p.createdAt || '',
    },
    'name'
  );
  const { page, setPage, totalPages, totalItems, paginatedItems } = usePagination(sortedItems);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  function handleOpenView(patient: Patient) {
    router.push(`/patients/${patient.id}`);
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
    const filtered = patientsList.filter((patient) => {
      for (const [key, rawValue] of Object.entries(filters)) {
        if (rawValue === undefined || rawValue === null || rawValue === '') continue;

        if (typeof rawValue === 'object') {
          const range = rawValue as { from?: string; to?: string; min?: number; max?: number };

          if (key === 'sessionCount') {
            const sessionValue = patient.sessionCount || 0;
            if (range.min !== undefined && !Number.isNaN(range.min) && sessionValue < range.min) return false;
            if (range.max !== undefined && !Number.isNaN(range.max) && sessionValue > range.max) return false;
          }

          if (key === 'balance') {
            const balanceValue = Number(patient.balance) || 0;
            if (range.min !== undefined && !Number.isNaN(range.min) && balanceValue < range.min) return false;
            if (range.max !== undefined && !Number.isNaN(range.max) && balanceValue > range.max) return false;
          }

          continue;
        }

        const value = String(rawValue).toLowerCase();
        switch (key) {
          case 'practitionerName':
            if (!(patient.practitionerName || '').toLowerCase().includes(value)) return false;
            break;
          case 'packServiceName':
            if (!(patient.packServiceName || '').toLowerCase().includes(value)) return false;
            break;
          case 'name':
            {
              const haystack = `${patient.firstName} ${patient.lastName}`.toLowerCase() +
                (patient.email || '').toLowerCase() +
                patient.phone.toLowerCase();
              if (!haystack.includes(value)) return false;
            }
            break;
          case 'isProspect':
            {
              if (value === 'true' && !patient.isProspect) return false;
            }
            break;
        }
      }

      return true;
    });
    setFilteredPatients(filtered);
  }, [patientsList, filters]);

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

  async function handleEditPatient(data: PatientFormData) {
    if (!editingPatient) return;
    const response = await patients.update(editingPatient.id, data);
    if (!response.success) {
      throw new Error(response.message || response.error || 'Échec de la modification du patient');
    }
    setEditOpen(false);
    setEditingPatient(null);
    await loadPatients();
  }

  if (authLoading || isLoading) {
    return <Spinner fullPage />;
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Patients</h1>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setCreateOpen(true)}
              className="gap-2 bg-brand-700 hover:bg-brand-800"
            >
              <Plus className="h-4 w-4" />
              Nouveau patient
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-8 w-full">
        <FilterDialog
          fields={filterFields}
          values={filters}
          onChange={setFilters}
          onReset={() => setFilters(resetFilters(filterFields))}
        />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
                    <SortableHeader label="Nom" sortKey="name" currentSortKey={sortKey} direction={direction} onSort={toggleSort} />
                    <SortableHeader label="Téléphone" sortKey="phone" currentSortKey={sortKey} direction={direction} onSort={toggleSort} />
                    <SortableHeader label="Praticien" sortKey="practitionerName" currentSortKey={sortKey} direction={direction} onSort={toggleSort} />
                    <SortableHeader label="Pack" sortKey="packServiceName" currentSortKey={sortKey} direction={direction} onSort={toggleSort} />
                    <SortableHeader label="Solde" sortKey="balance" currentSortKey={sortKey} direction={direction} onSort={toggleSort} />
                    <SortableHeader label="Créé le" sortKey="createdAt" currentSortKey={sortKey} direction={direction} onSort={toggleSort} />
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
                          <span className={
                            (patient.consecutiveNoShows ?? 0) >= 3 ? 'text-red-600 font-bold' :
                            (patient.consecutiveNoShows ?? 0) >= 2 ? 'text-orange-500 font-bold' : ''
                          }>
                            {patient.firstName} {patient.lastName}
                          </span>
                        </TableCell>
                        <TableCell>{patient.phone}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {patient.practitionerName || '—'}
                        </TableCell>
                        <TableCell>
                          {patient.packServiceName && (patient.packRemaining ?? 0) > 0 ? (
                            <span className="text-sm font-medium text-brand-700">
                              {patient.packServiceName} ({patient.packRemaining || 0} / {patient.packTotal || 0})
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className={patient.balance > 0 ? 'text-green-600 font-semibold' : patient.balance < 0 ? 'text-red-600 font-semibold' : ''}>
                          {patient.packServiceName && patient.balance < (patient.packPricePerSession ?? 0) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertCircle className="inline-block h-4 w-4 mr-1 text-red-500 cursor-help" aria-label="Solde insuffisant" />
                              </TooltipTrigger>
                              <TooltipContent>Solde insuffisant pour une séance</TooltipContent>
                            </Tooltip>
                          )}
                          {patient.balance > 0 ? '+' : ''}{Number(patient.balance).toLocaleString('fr-FR')} DZD
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {patient.createdAt ? new Date(patient.createdAt).toLocaleDateString('fr-FR') : '—'}
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
                              setEditingPatient(patient);
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
            <PaginationControls page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-12">
            <div className="text-center">
              <p className="text-gray-500 mb-4">
                Aucun patient pour le moment
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

      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditingPatient(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>Modifier le patient</DialogTitle>
            <DialogDescription>
              Modifiez les informations du patient.
            </DialogDescription>
          </DialogHeader>
          {editingPatient && (
            <PatientForm
              initialData={editingPatient as unknown as PatientFormData}
              onSubmit={handleEditPatient}
            />
          )}
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
            <Spinner />
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