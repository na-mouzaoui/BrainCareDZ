'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { patients } from '@/lib/api';
import { PatientForm, type PatientFormData } from '@/components/patient-form';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function PatientEditPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const patientId = params?.id as string | undefined;

  const [initialData, setInitialData] = useState<PatientFormData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && patientId) {
      loadPatient(patientId);
    }
  }, [authLoading, isAuthenticated, patientId]);

  async function loadPatient(id: string) {
    try {
      setIsLoading(true);
      setError('');
      const response = await patients.getById(id);
      if (response.success && response.data) {
        setInitialData(response.data as PatientFormData);
      } else {
        setError(response.message || 'Impossible de charger le patient');
      }
    } catch (err) {
      setError('Une erreur est survenue lors du chargement du patient');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdate(data: PatientFormData) {
    if (!patientId) return;
    const response = await patients.update(patientId, data);
    if (!response.success) {
      throw new Error(response.message || response.error || 'Echec de la mise a jour du patient');
    }
    router.push('/patients');
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Modifier le patient</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PatientForm
        initialData={initialData}
        isLoading={isLoading}
        onSubmit={handleUpdate}
        submitButtonText="Enregistrer les modifications"
      />
    </div>
  );
}
