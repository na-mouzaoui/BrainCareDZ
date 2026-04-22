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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Service {
  id: string;
  name: string;
  category: string;
  duration: number;
  price: number;
  description?: string;
  isActive: boolean;
}

export default function ServicesPage() {
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const categories = [
    { value: 'all', label: 'Toutes les catégories' },
    { value: 'neurofeedback', label: 'Neurofeedback' },
    { value: 'therapy', label: 'Thérapie' },
    { value: 'assessment', label: 'Évaluation' },
    { value: 'consultation', label: 'Consultation' },
    { value: 'other', label: 'Autre' },
  ];

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
    let filtered = servicesList;

    if (searchTerm) {
      filtered = filtered.filter(
        (service) =>
          service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter((service) => service.category === selectedCategory);
    }

    setFilteredServices(filtered);
  }, [searchTerm, selectedCategory, servicesList]);

  async function loadServices() {
    try {
      setIsLoading(true);
      const response = await services.getAll();
      if (response.success && response.data) {
        setServicesList(response.data.services || []);
      } else {
        setError(response.message || 'Échec du chargement des services');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement des services');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(serviceId: string, serviceName: string) {
    if (!confirm(`Voulez-vous vraiment supprimer ${serviceName} ?`)) {
      return;
    }

    try {
      const response = await services.delete(serviceId);
      if (response.success) {
        setServicesList(servicesList.filter((s) => s.id !== serviceId));
      } else {
        setError(response.message || 'Échec de la suppression du service');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors de la suppression du service');
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
            <h1 className="text-3xl font-bold text-gray-900">Services</h1>
            <p className="text-gray-600 mt-1">Gérez vos services et forfaits</p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="gap-2 bg-emerald-700 hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            Ajouter un service
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-2">
            <Search className="h-5 w-5 text-gray-400 absolute ml-3 mt-2.5" />
            <Input
              placeholder="Rechercher les services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrer par catégorie" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Services Table */}
      {filteredServices.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Services ({filteredServices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">{service.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{service.category}</Badge>
                      </TableCell>
                      <TableCell>{service.duration} min</TableCell>
                      <TableCell className="font-semibold">{Number(service.price).toFixed(2)} DZD</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/services/${service.id}/edit`)}
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
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-12">
            <div className="text-center">
              <p className="text-gray-500 mb-4">Aucun service trouvé</p>
              <Button
                onClick={() => setCreateOpen(true)}
                className="gap-2 bg-emerald-700 hover:bg-emerald-800"
              >
                <Plus className="h-4 w-4" />
                Ajouter un service
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter un service</DialogTitle>
            <DialogDescription>
              Remplissez le formulaire pour ajouter un nouveau service.
            </DialogDescription>
          </DialogHeader>
          <ServiceForm onSubmit={handleCreateService} submitButtonText="Enregistrer le service" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
