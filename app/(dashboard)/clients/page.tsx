'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { clients } from '@/lib/api';
import ClientForm, { type ClientFormData } from '@/components/client-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Plus, Search, Edit2, Trash2, Eye } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Client {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  sessionCount: number;
  lastSessionDate?: string;
}

export default function ClientsPage() {
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Load clients on mount
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading && isAuthenticated) {
      loadClients();
    }
  }, [isAuthenticated, authLoading, router]);

  // Filter clients based on search
  useEffect(() => {
    if (!searchTerm) {
      setFilteredClients(clientsList);
    } else {
      const filtered = clientsList.filter(
        (client) =>
          `${client.firstName} ${client.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.phone.includes(searchTerm)
      );
      setFilteredClients(filtered);
    }
  }, [searchTerm, clientsList]);

  async function loadClients() {
    try {
      setIsLoading(true);
      const response = await clients.getAll();
      if (response.success && response.data) {
        setClientsList(response.data.clients || []);
      } else {
        setError(response.message || 'Échec du chargement des clients');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement des clients');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(clientId: string, clientName: string) {
    if (!confirm(`Veuillez confirmer l'archivage de ${clientName}`)) {
      return;
    }

    try {
      const response = await clients.delete(clientId);
      if (response.success) {
        setClientsList(clientsList.filter((c) => c._id !== clientId));
      } else {
        setError(response.message || 'Échec de la suppression du client');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors de la suppression du client');
    }
  }

  async function handleCreateClient(data: ClientFormData) {
    const response = await clients.create(data);
    if (!response.success) {
      throw new Error(response.message || 'Échec de la création du client');
    }
    setCreateOpen(false);
    await loadClients();
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
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
            <p className="text-gray-600 mt-1">Gérez votre base de données de clients</p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="gap-2 bg-emerald-700 hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            Nouveau client
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Search Bar */}
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

      {/* Clients Table */}
      {filteredClients.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Clients ({filteredClients.length})
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
                  {filteredClients.map((client) => (
                    <TableRow key={client._id}>
                      <TableCell className="font-medium">
                        {client.firstName} {client.lastName}
                      </TableCell>
                      <TableCell>{client.email || '—'}</TableCell>
                      <TableCell>{client.phone}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(client.status)}>
                          {client.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{client.sessionCount}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/clients/${client._id}`)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Afficher
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/clients/${client._id}/edit`)}
                          className="gap-2"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(client._id, `${client.firstName} ${client.lastName}`)}
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
                {searchTerm ? 'Aucun client ne correspond à votre recherche' : 'Aucun client pour le moment'}
              </p>
              <Button
                onClick={() => setCreateOpen(true)}
                className="gap-2 bg-emerald-700 hover:bg-emerald-800"
              >
                <Plus className="h-4 w-4" />
                Ajouter votre premier client
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau client</DialogTitle>
            <DialogDescription>
              Remplissez le formulaire pour créer un nouveau client.
            </DialogDescription>
          </DialogHeader>
          <ClientForm onSubmit={handleCreateClient} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
