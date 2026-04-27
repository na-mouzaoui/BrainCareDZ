'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import { expenses } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ExpenseDetail {
  id: string;
  title: string;
  category?: string;
  amount: number;
  expenseDate: string;
  notes?: string;
  createdAt: string;
  createdByName?: string;
}

export default function InvoiceDetailPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const invoiceId = params?.id;
  const [expense, setExpense] = useState<ExpenseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading && isAuthenticated && user?.role !== 'admin') {
      router.push('/dashboard');
      return;
    }

    if (!authLoading && isAuthenticated && invoiceId && user?.role === 'admin') {
      loadExpense();
    }
  }, [isAuthenticated, authLoading, invoiceId, router, user]);

  async function loadExpense() {
    try {
      setIsLoading(true);
      const response = await expenses.getById(invoiceId as string);
      if (response.success && response.data) {
        setExpense(response.data.expense);
      } else {
        setError(response.message || 'Échec du chargement de la dépense');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement de la dépense');
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

  if (error || !expense) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Détails de la dépense</h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Charge/dépense non trouvée'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{expense.title}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Détails de la dépense</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Catégorie</p>
              <p className="text-lg">{expense.category || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Montant</p>
              <p className="text-lg font-semibold">{Number(expense.amount).toFixed(2)} DZD</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Date de dépense</p>
              <p className="text-lg">{new Date(expense.expenseDate).toLocaleDateString('fr-FR')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Créé par</p>
              <p className="text-lg">{expense.createdByName || '-'}</p>
            </div>
            {expense.notes && (
              <div className="col-span-2">
                <p className="text-sm font-medium text-gray-600">Notes</p>
                <p className="text-lg whitespace-pre-wrap">{expense.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
