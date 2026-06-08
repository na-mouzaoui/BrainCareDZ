'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { payments } from '@/lib/api';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface PaymentRecord {
  id: string;
  patientFirstName: string;
  patientLastName: string;
  amount: number;
  paymentMethod: string;
  status: string;
  notes?: string;
}

export default function PaymentEditPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const paymentId = params?.id as string | undefined;

  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [status, setStatus] = useState('completed');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && paymentId) {
      loadPayment(paymentId);
    }
  }, [authLoading, isAuthenticated, paymentId]);

  async function loadPayment(id: string) {
    try {
      setIsLoading(true);
      setError('');
      const response = await payments.getById(id);
      if (response.success && response.data) {
        const data = response.data as PaymentRecord;
        setPayment(data);
        setAmount(String(data.amount ?? ''));
        setPaymentMethod(data.paymentMethod || 'cash');
        setStatus(data.status || 'completed');
        setNotes(data.notes || '');
      } else {
        setError(response.message || 'Impossible de charger le paiement');
      }
    } catch (err) {
      setError('Une erreur est survenue lors du chargement du paiement');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentId) return;

    setError('');
    const safeAmount = Number(amount);
    if (Number.isNaN(safeAmount) || safeAmount <= 0) {
      setError('Veuillez entrer un montant valide');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await payments.update(paymentId, {
        amount: safeAmount,
        paymentMethod,
        status,
        notes: notes || null,
      });
      if (!response.success) {
        throw new Error(response.message || response.error || 'Echec de la mise a jour du paiement');
      }
      router.push('/payments');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Modifier le paiement</h1>
        <p className="text-gray-600 mt-1">Mettez a jour les informations du paiement</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Informations du paiement</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field>
              <FieldLabel>Patient</FieldLabel>
              <Input
                value={payment ? `${payment.patientFirstName} ${payment.patientLastName}` : ''}
                disabled
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Montant (DZD) *</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </Field>

              <Field>
                <FieldLabel>Mode de paiement</FieldLabel>
                <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={isSubmitting}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Especes</SelectItem>
                    <SelectItem value="check">Cheque</SelectItem>
                    <SelectItem value="bank-transfer">Virement</SelectItem>
                    <SelectItem value="mobile-money">Mobile Money</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel>Statut</FieldLabel>
              <Select value={status} onValueChange={setStatus} disabled={isSubmitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Complete</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="failed">Echoue</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Notes</FieldLabel>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={isSubmitting}
              />
            </Field>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
