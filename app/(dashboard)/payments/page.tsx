'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { payments as paymentsApi, clients as clientsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertCircle, Plus, Trash2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Payment {
  _id: string;
  client: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  amount: number;
  paymentMethod: string;
  status: string;
  notes?: string;
  createdAt: string;
}

interface Client {
  _id: string;
  firstName: string;
  lastName: string;
}

export default function PaymentsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    clientId: '',
    amount: '',
    paymentMethod: 'cash',
    notes: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [paymentsRes, clientsRes] = await Promise.all([
        paymentsApi.getAll(),
        clientsApi.getAll(),
      ]);

      if (paymentsRes.success && paymentsRes.data) {
        setPayments(paymentsRes.data.payments || []);
      }
      if (clientsRes.success && clientsRes.data) {
        setClients(clientsRes.data.clients || []);
      }
    } catch (err) {
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.clientId) {
      setError('Veuillez sélectionner un client');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Veuillez entrer un montant valide');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await paymentsApi.create({
        clientId: formData.clientId,
        amount: parseFloat(formData.amount),
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
      });

      if (response.success) {
        setPayments([response.data as Payment, ...payments]);
        setFormData({
          clientId: '',
          amount: '',
          paymentMethod: 'cash',
          notes: '',
        });
        setIsDialogOpen(false);
      } else {
        setError(response.error || 'Erreur lors de la création du paiement');
      }
    } catch (err) {
      setError('Erreur lors de la création du paiement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) {
      return;
    }

    try {
      const response = await paymentsApi.delete(id);
      if (response.success) {
        setPayments(payments.filter((p) => p._id !== id));
      } else {
        setError('Erreur lors de la suppression du paiement');
      }
    } catch (err) {
      setError('Erreur lors de la suppression du paiement');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Paiements</h1>
          <p className="text-gray-600 mt-1">Gérez les paiements de vos clients</p>
        </div>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="gap-2 bg-emerald-700 hover:bg-emerald-800"
        >
          <Plus className="h-4 w-4" />
          Ajouter un paiement
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Add Payment Dialog */}
      {isDialogOpen && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader>
            <CardTitle>Nouveau paiement</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Client *</FieldLabel>
                  <Select
                    value={formData.clientId}
                    onValueChange={(value) => handleInputChange('clientId', value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client._id} value={client._id}>
                          {client.firstName} {client.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>Montant encaissé (DZD) *</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    disabled={isSubmitting}
                    required
                    placeholder="0"
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel>Mode de paiement</FieldLabel>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(value) => handleInputChange('paymentMethod', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Espèces</SelectItem>
                    <SelectItem value="check">Chèque</SelectItem>
                    <SelectItem value="bank-transfer">Virement bancaire</SelectItem>
                    <SelectItem value="mobile-money">Mobile Money</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Notes (optionnel)</FieldLabel>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  disabled={isSubmitting}
                  rows={2}
                  placeholder="Ajoutez des notes supplémentaires..."
                />
              </Field>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="gap-2 bg-emerald-700 hover:bg-emerald-800"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    'Enregistrer'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Paiements récents</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Aucun paiement trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Mode de paiement</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment._id}>
                      <TableCell className="font-medium">
                        {payment.client.firstName} {payment.client.lastName}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatPrice(payment.amount)} DZD
                      </TableCell>
                      <TableCell className="capitalize">
                        {payment.paymentMethod === 'cash'
                          ? 'Espèces'
                          : payment.paymentMethod === 'check'
                          ? 'Chèque'
                          : payment.paymentMethod === 'bank-transfer'
                          ? 'Virement'
                          : 'Mobile Money'}
                      </TableCell>
                      <TableCell>
                        <span className="inline-block px-2 py-1 text-sm font-medium text-green-700 bg-green-100 rounded">
                          {payment.status === 'completed'
                            ? 'Complété'
                            : payment.status === 'pending'
                            ? 'En attente'
                            : 'Échoué'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDate(payment.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePayment(payment._id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
