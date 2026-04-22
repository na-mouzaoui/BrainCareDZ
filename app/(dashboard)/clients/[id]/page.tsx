'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import { clients } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ClientDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  sessionCount: number;
}

export default function ClientDetailPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const clientId = params?.id;
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading && isAuthenticated && clientId) {
      loadClient();
    }
  }, [isAuthenticated, authLoading, clientId, router]);

  async function loadClient() {
    try {
      setIsLoading(true);
      const response = await clients.getById(clientId as string);
      if (response.success && response.data) {
        setClient(response.data.client);
      } else {
        setError(response.message || 'Échec du chargement du client');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement du client');
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

  if (error || !client) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Détails du client</h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Client non trouvé'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {client.firstName} {client.lastName}
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Informations du client</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600">E-mail</p>
              <p className="text-lg">{client.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Téléphone</p>
              <p className="text-lg">{client.phone}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Statut</p>
              <p className="text-lg capitalize">{client.status}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Sessions</p>
              <p className="text-lg">{client.sessionCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
