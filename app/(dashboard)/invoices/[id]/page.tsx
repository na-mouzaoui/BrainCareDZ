'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import { invoices } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface InvoiceDetail {
  _id: string;
  invoiceNumber: string;
  client: {
    firstName: string;
    lastName: string;
    email: string;
  };
  total: number;
  status: string;
  createdAt: string;
}

export default function InvoiceDetailPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const invoiceId = params?.id;
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading && isAuthenticated && invoiceId) {
      loadInvoice();
    }
  }, [isAuthenticated, authLoading, invoiceId, router]);

  async function loadInvoice() {
    try {
      setIsLoading(true);
      const response = await invoices.getById(invoiceId as string);
      if (response.success && response.data) {
        setInvoice(response.data.invoice);
      } else {
        setError(response.message || 'Échec du chargement de la facture');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement de la facture');
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

  if (error || !invoice) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Détails de la facture</h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Facture non trouvée'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Détails de la facture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Client</p>
              <p className="text-lg">
                {invoice.client.firstName} {invoice.client.lastName}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Montant</p>
              <p className="text-lg font-semibold">${invoice.total.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Statut</p>
              <p className="text-lg capitalize">{invoice.status}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Date créée</p>
              <p className="text-lg">{new Date(invoice.createdAt).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
