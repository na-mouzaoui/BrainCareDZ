'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import { appointments } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AppointmentDetail {
  id: string;
  clientId: string;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  clientPhone: string;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  serviceDuration: number;
  practitionerId: string;
  practitionerName: string;
  practitionerEmail: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string;
  reminderSent?: boolean;
  sessionNoteId?: string;
}

export default function AppointmentDetailPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const appointmentId = params?.id;
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading && isAuthenticated && appointmentId) {
      loadAppointment();
    }
  }, [isAuthenticated, authLoading, appointmentId, router]);

  async function loadAppointment() {
    try {
      setIsLoading(true);
      const response = await appointments.getById(appointmentId as string);
      if (response.success && response.data) {
        setAppointment(response.data.appointment);
      } else {
        setError(response.message || 'Échec du chargement du rendez-vous');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement du rendez-vous');
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

  if (error || !appointment) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Détails du rendez-vous</h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Rendez-vous non trouvé'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {appointment.clientFirstName} {appointment.clientLastName}
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Détails du rendez-vous</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Service</p>
              <p className="text-lg">{appointment.serviceName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Statut</p>
              <p className="text-lg capitalize">{appointment.status}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Date</p>
              <p className="text-lg">{new Date(appointment.startTime).toLocaleDateString('fr-FR')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Prix</p>
              <p className="text-lg font-semibold">{Number(appointment.servicePrice).toFixed(2)} DZD</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
