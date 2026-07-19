'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import { services } from '@/lib/api';
import ServiceForm, { type ServiceFormData } from '@/components/service-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ServiceEditPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const serviceId = params?.id as string;
  const [service, setService] = useState<ServiceFormData | null>(null);
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
      const response = await services.getById(serviceId);
      if (response.success && response.data) {
        const serviceData = response.data.service || response.data;
        setService({
          name: serviceData.name || '',
          price: serviceData.price || 0,
          sessions: serviceData.sessions || 1,
        });
      } else {
        setError(response.message || 'Échec du chargement du service');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement du service');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdate(data: ServiceFormData) {
    const response = await services.update(serviceId, data);
    if (!response.success) {
      throw new Error(response.message || 'Échec de la modification du service');
    }
    router.push('/services');
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Modifier le service</h1>
      </div>

      {service && (
        <ServiceForm
          initialData={service}
          onSubmit={handleUpdate}
          submitButtonText="Enregistrer les modifications"
        />
      )}
    </div>
  );
}