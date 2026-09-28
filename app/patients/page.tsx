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
import { ListPageSkeleton } from '@/components/page-skeletons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PaginationControls } from '@/components/pagination-controls';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import FilterDialog, {
  type FilterField,
  type FilterValues,
  resetFilters,
} from '@/components/filter-dialog';
import { SortableHeader, type SortDirection } from '@/components/sortable-header';

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

const PAGE_SIZE = 25;

function buildPatientQuery(
  filters: FilterValues,
  page: number,
  pageSize: number,
  sortKey: string | null,
  direction: SortDirection
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = { page, pageSize };
  if (sortKey) {
    params.sort = sortKey;
    params.order = direction;
  }

  const name = filters.name;
  if (typeof name === 'string' && name.trim()) params.search = name.trim();

  const practitioner = filters.practitionerName;
  if (typeof practitioner === 'string' && practitioner.trim()) params.practitionerName = practitioner.trim();

  const pack = filters.packServiceName;
  if (typeof pack === 'string' && pack.trim()) params.packServiceName = pack.trim();

  const sessionRange = filters.sessionCount as { min?: number; max?: number } | undefined;
  if (sessionRange?.min !== undefined && sessionRange.min !== null && !Number.isNaN(Number(sessionRange.min))) params.minSessions = Number(sessionRange.min);
  if (sessionRange?.max !== undefined && sessionRange.max !== null && !Number.isNaN(Number(sessionRange.max))) params.maxSessions = Number(sessionRange.max);

  const balanceRange = filters.balance as { min?: number; max?: number } | undefined;
  if (balanceRange?.min !== undefined && balanceRange.min !== null && !Number.isNaN(Number(balanceRange.min))) params.minBalance = Number(balanceRange.min);
  if (balanceRange?.max !== undefined && balanceRange.max !== null && !Number.isNaN(Number(balanceRange.max))) params.maxBalance = Number(balanceRange.max);

  if (filters.isProspect === 'true') params.isProspect = true;

  return params;
}

export default function PatientsPage() {
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [filters, setFilters] = useState<FilterValues>({});
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>('name');
  const [direction, setDirection] = useState<SortDirection>('asc');
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
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  function toggleSort(key: string) {
    if (sortKey === key) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setDirection('asc');
    }
    setPage(1);
  }
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  function handleOpenView(patient: Patient) {
    router.push(`/patients/${patient.id}`);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    void loadPatients();
  }, [isAuthenticated, authLoading, page, filters, sortKey, direction, router]);

  async function loadPatients(): Promise<Patient[]> {
    try {
      setIsLoading(true);
      const response = await patients.getPaged(
        buildPatientQuery(filters, page, PAGE_SIZE, sortKey, direction)
      );

      if (response.success && response.data) {
        const payload = response.data as { patients?: Patient[]; total?: number };
        const rows = payload.patients || [];
        setPatientsList(rows);
        setTotalItems(payload.total ?? rows.length);
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
    if (createdPatient?.id) {
      setPage(1);
      await loadPatients();
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
    return <ListPageSkeleton />;
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
          onChange={(values) => { setFilters(values); setPage(1); }}
          onReset={() => { setFilters(resetFilters(filterFields)); setPage(1); }}
        />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {patientsList.length > 0 ? (
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
                    <SortableHeader label="Téléphone" sortKey="phone" currentSortKey={sortKey} direction={direction} onSort={toggleSort} className="hidden md:table-cell" />
                    <SortableHeader label="Praticien" sortKey="practitionerName" currentSortKey={sortKey} direction={direction} onSort={toggleSort} className="hidden md:table-cell" />
                    <SortableHeader label="Pack" sortKey="packServiceName" currentSortKey={sortKey} direction={direction} onSort={toggleSort} className="hidden lg:table-cell" />
                    <SortableHeader label="Solde" sortKey="balance" currentSortKey={sortKey} direction={direction} onSort={toggleSort} />
                    <SortableHeader label="Créé le" sortKey="createdAt" currentSortKey={sortKey} direction={direction} onSort={toggleSort} className="hidden lg:table-cell" />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
<TableBody>
                  {patientsList.map((patient) => {
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
                          <span className="md:hidden mt-1 block text-xs font-normal text-gray-500">
                            {patient.phone && <span className="block">{patient.phone}</span>}
                            {patient.practitionerName && <span className="block">{patient.practitionerName}</span>}
                            {patient.packServiceName && (patient.packRemaining ?? 0) > 0 && (
                              <span className="block text-brand-700">
                                {patient.packServiceName} ({patient.packRemaining || 0} / {patient.packTotal || 0})
                              </span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{patient.phone}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-gray-600">
                          {patient.practitionerName || '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
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
                        <TableCell className="hidden lg:table-cell text-sm text-gray-500">
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
        <DialogContent className="sm:max-w-3xl max-h-[85dvh] overflow-y-auto p-0 gap-0" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-0">
            <DialogTitle>Nouveau patient</DialogTitle>
            <DialogDescription>
              Remplissez le formulaire pour créer un nouveau patient.
            </DialogDescription>
          </DialogHeader>
          <PatientForm onSubmit={handleCreatePatient} />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditingPatient(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85dvh] overflow-y-auto p-0 gap-0" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-0">
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
        <DialogContent className="sm:max-w-2xl max-h-[85dvh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
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