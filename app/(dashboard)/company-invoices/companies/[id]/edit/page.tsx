'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { companies } from '@/lib/api';
import CompanyForm, { type CompanyFormData } from '@/components/company-form';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function CompanyEditPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const companyId = params?.id as string | undefined;

  const [initialData, setInitialData] = useState<CompanyFormData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && companyId) {
      loadCompany(companyId);
    }
  }, [authLoading, isAuthenticated, companyId]);

  async function loadCompany(id: string) {
    try {
      setIsLoading(true);
      setError('');
      const response = await companies.getById(id);
      if (response.success && response.data) {
        setInitialData(response.data as CompanyFormData);
      } else {
        setError(response.message || 'Impossible de charger l\'entreprise');
      }
    } catch (err) {
      setError('Une erreur est survenue lors du chargement de l\'entreprise');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdate(data: CompanyFormData) {
    if (!companyId) return;
    const response = await companies.update(companyId, data);
    if (!response.success) {
      throw new Error(response.message || response.error || 'Echec de la mise a jour de l\'entreprise');
    }
    router.push('/company-invoices');
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Modifier l'entreprise</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <CompanyForm
        initialData={initialData}
        isLoading={isLoading}
        onSubmit={handleUpdate}
        submitButtonText="Enregistrer les modifications"
      />
    </div>
  );
}
