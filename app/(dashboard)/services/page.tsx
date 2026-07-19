'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { services } from '@/lib/api';
import ServiceForm, { type ServiceFormData } from '@/components/service-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { usePagination, PaginationControls } from '@/components/pagination-controls';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Service {
  id: string;
  name: string;
  price: number;
  sessions: number;
  type?: string;
}

export default function ServicesPage() {
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceFormData | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
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
      loadServices();
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredServices(servicesList);
    } else {
      setFilteredServices(
        servicesList.filter(
          (service) =>
            service.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
  }, [searchTerm, servicesList]);

  async function loadServices() {
    try {
      setIsLoading(true);
      const response = await services.getAll();
      if (response.success && response.data) {
        const servicesData = response.data;
        setServicesList(Array.isArray(servicesData) ? servicesData : servicesData.services || []);
      } else {
        setError(response.message || 'Échec du chargement des services');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement des services');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateService(data: ServiceFormData) {
    const response = await services.create(data);
    if (!response.success) {
      throw new Error(response.message || 'Échec de la création du service');
    }
    setCreateOpen(false);
    await loadServices();
  }

  async function handleEditClick(service: Service) {
    setEditingServiceId(service.id);
    setEditingService({
      name: service.name,
      price: service.price,
      sessions: service.sessions || 1,
      type: service.type || 'consultation',
    });
    setEditOpen(true);
  }

  async function handleUpdateService(data: ServiceFormData) {
    if (!editingServiceId) return;
    
    const response = await services.update(editingServiceId, data);
    if (!response.success) {
      throw new Error(response.message || 'Échec de la modification du service');
    }
    setEditOpen(false);
    setEditingService(null);
    setEditingServiceId(null);
    await loadServices();
  }

  async function handleDelete(serviceId: string, serviceName: string) {
    if (!confirm(`Voulez-vous vraiment supprimer le service "${serviceName}" ?`)) {
      return;
    }

    try {
      const response = await services.delete(serviceId);
      if (response.success) {
        await loadServices();
      } else {
        setError(response.message || 'Échec de la suppression du service');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors de la suppression');
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const { page, setPage, totalPages, totalItems, paginatedItems } = usePagination(filteredServices);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Services</h1>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 bg-brand-700 hover:bg-brand-800">
          <Plus className="h-4 w-4" />
          Nouveau service
        </Button>
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
              placeholder="Rechercher les services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {filteredServices.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Services ({totalItems})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Séances</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">{service.name}</TableCell>
                      <TableCell>
                        <Badge className={service.type === 'neurofeedback' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                          {service.type === 'neurofeedback' ? 'Neurofeedback' : 'Consultation'}
                        </Badge>
                      </TableCell>
                      <TableCell>{service.sessions || 1} séance{(service.sessions || 1) > 1 ? 's' : ''}</TableCell>
                      <TableCell className="font-semibold">{formatPrice(service.price)} DZD</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditClick(service)}
                          className="gap-2"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(service.id, service.name)}
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
            <PaginationControls page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-12">
            <div className="text-center">
              <p className="text-gray-500 mb-4">
                {searchTerm ? 'Aucun service ne correspond à votre recherche' : 'Aucun service pour le moment'}
              </p>
              <Button
                onClick={() => setCreateOpen(true)}
                className="gap-2 bg-brand-700 hover:bg-brand-800"
              >
                <Plus className="h-4 w-4" />
                Ajouter votre premier service
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau service</DialogTitle>
            <DialogDescription>
              Créez un nouveau service avec son tarif.
            </DialogDescription>
          </DialogHeader>
          <ServiceForm onSubmit={handleCreateService} submitButtonText="Créer le service" />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le service</DialogTitle>
            <DialogDescription>
              Modifiez les informations du service.
            </DialogDescription>
          </DialogHeader>
          {editingService && (
            <ServiceForm
              initialData={editingService}
              onSubmit={handleUpdateService}
              submitButtonText="Enregistrer les modifications"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}