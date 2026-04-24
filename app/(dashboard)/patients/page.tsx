'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { patients } from '@/lib/api';
import PatientForm, { type PatientFormData } from '@/components/patient-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Plus, Search, Edit2, Trash2, Eye } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  sessionCount: number;
  lastSessionDate?: string;
}

export default function PatientsPage() {
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
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
    if (!confirm(`Veuillez confirmer l'archivage de ${patientName}`)) {
      return;
    }

    try {
      const response = await patients.delete(patientId);
      if (response.success) {
        setPatientsList(patientsList.filter((p) => p.id !== patientId));
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'archived':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Patients</h1>
            <p className="text-gray-600 mt-1">Gérez votre base de données de patients</p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="gap-2 bg-emerald-700 hover:bg-emerald-800"
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
        </CardContent>
      </Card>

      {filteredPatients.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Patients ({filteredPatients.length})
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
                    <TableHead>Statut</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium">
                        {patient.firstName} {patient.lastName}
                      </TableCell>
                      <TableCell>{patient.email || '—'}</TableCell>
                      <TableCell>{patient.phone}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(patient.status)}>
                          {patient.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{patient.sessionCount}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedPatient(patient);
                            setViewOpen(true);
                          }}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Afficher
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/patients/${patient.id}/edit`)}
                          className="gap-2"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(patient.id, `${patient.firstName} ${patient.lastName}`)}
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
              <p className="text-gray-500 mb-4">
                {searchTerm ? 'Aucun patient ne correspond à votre recherche' : 'Aucun patient pour le moment'}
              </p>
              <Button
                onClick={() => setCreateOpen(true)}
                className="gap-2 bg-emerald-700 hover:bg-emerald-800"
              >
                <Plus className="h-4 w-4" />
                Ajouter votre premier patient
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau patient</DialogTitle>
            <DialogDescription>
              Remplissez le formulaire pour créer un nouveau patient.
            </DialogDescription>
          </DialogHeader>
          <PatientForm onSubmit={handleCreatePatient} />
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : 'Détails du patient'}
            </DialogTitle>
            <DialogDescription>
              Informations sur le patient
            </DialogDescription>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Prénom</p>
                  <p className="text-lg">{selectedPatient.firstName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Nom</p>
                  <p className="text-lg">{selectedPatient.lastName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="text-lg">{selectedPatient.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Téléphone</p>
                  <p className="text-lg">{selectedPatient.phone}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Statut</p>
                  <Badge className={getStatusColor(selectedPatient.status)}>
                    {selectedPatient.status === 'active' ? 'Actif' : selectedPatient.status === 'inactive' ? 'Inactif' : 'Archivé'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Nombre de séances</p>
                  <p className="text-lg">{selectedPatient.sessionCount || 0}</p>
                </div>
                {selectedPatient.lastSessionDate && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Dernière séance</p>
                    <p className="text-lg">
                      {new Date(selectedPatient.lastSessionDate).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}