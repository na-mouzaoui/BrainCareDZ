'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import { patients } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PatientDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  sessionCount: number;
}

export default function PatientDetailPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const patientId = params?.id;
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading && isAuthenticated && patientId) {
      loadPatient();
    }
  }, [isAuthenticated, authLoading, patientId, router]);

  async function loadPatient() {
    try {
      setIsLoading(true);
      const response = await patients.getById(patientId as string);
      if (response.success && response.data) {
        setPatient(response.data.patient);
      } else {
        setError(response.message || 'Échec du chargement du patient');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement du patient');
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

  if (error || !patient) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Détails du patient</h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Patient non trouvé'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {patient.firstName} {patient.lastName}
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Informations du patient</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600">E-mail</p>
              <p className="text-lg">{patient.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Téléphone</p>
              <p className="text-lg">{patient.phone}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Statut</p>
              <p className="text-lg capitalize">{patient.status}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Sessions</p>
              <p className="text-lg">{patient.sessionCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}