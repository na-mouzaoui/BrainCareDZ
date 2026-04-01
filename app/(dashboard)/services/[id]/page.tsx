'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import { services } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ServiceDetail {
  _id: string;
  name: string;
  category: string;
  duration: number;
  price: number;
  description?: string;
}

export default function ServiceDetailPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const serviceId = params?.id;
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading && isAuthenticated && serviceId) {
      loadService();
    }
  }, [isAuthenticated, authLoading, serviceId, router]);

  async function loadService() {
    try {
      setIsLoading(true);
      const response = await services.getById(serviceId as string);
      if (response.success && response.data) {
        setService(response.data.service);
      } else {
        setError(response.message || 'Échec du chargement du service');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement du service');
    } finally {
      setIsLoading(false);
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Détails du service</h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Service non trouvé'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{service.name}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Détails du service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Catégorie</p>
              <p className="text-lg">{service.category}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Prix</p>
              <p className="text-lg font-semibold">${service.price.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Durée</p>
              <p className="text-lg">{service.duration} minutes</p>
            </div>
          </div>
          {service.description && (
            <div>
              <p className="text-sm font-medium text-gray-600">Description</p>
              <p className="text-lg">{service.description}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
