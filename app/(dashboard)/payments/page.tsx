'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { payments as paymentsApi, patients as patientsApi } from '@/lib/api';
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
import { AlertCircle, Edit2, Plus, Trash2 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePagination, PaginationControls } from '@/components/pagination-controls';
import { Alert, AlertDescription } from '@/components/ui/alert';
import FilterDialog, {
  type FilterField,
  type FilterValues,
  resetFilters,
} from '@/components/filter-dialog';
import { useSort, SortableHeader } from '@/components/sortable-header';

interface Payment {
  id: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  amount: number;
  paymentMethod: string;
  status: string;
  notes?: string;
  processedDate?: string;
  createdAt: string;
  createdByName?: string;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  balance?: number;
  packServiceName?: string;
  packTotal?: number;
  packRemaining?: number;
}

export default function PaymentsPage() {
  return (
    <Suspense>
      <PaymentsContent />
    </Suspense>
  );
}

function PaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const defaultDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    return {
      patientId: '',
      amount: '',
      paymentMethod: 'cash',
      notes: '',
      paymentDate: defaultDate,
    };
  });
  const [amountDisplay, setAmountDisplay] = useState('');
  const mustPayRef = useRef(searchParams.get('patientId') !== null);
  const mustPay = mustPayRef.current;

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === formData.patientId),
    [patients, formData.patientId]
  );

  const isFirstSessionOfPack = useMemo(() => {
    if (!selectedPatient || !selectedPatient.packTotal || !selectedPatient.packRemaining) return false;
    return selectedPatient.packRemaining === selectedPatient.packTotal - 1;
  }, [selectedPatient]);

  const [filters, setFilters] = useState<FilterValues>({});
  const filterFields: FilterField[] = [
    { key: 'patientName', label: 'Patient', type: 'text', placeholder: 'Nom du patient' },
    { key: 'paymentMethod', label: 'Mode de paiement', type: 'select', options: [
      { value: 'cash', label: 'Espèces' },
      { value: 'check', label: 'Chèque' },
      { value: 'bank-transfer', label: 'Virement bancaire' },
      { value: 'mobile-money', label: 'Mobile Money' },
      { value: 'other', label: 'Autre' },
    ] },
    { key: 'status', label: 'Statut', type: 'select', options: [
      { value: 'completed', label: 'Complété' },
      { value: 'pending', label: 'En attente' },
      { value: 'failed', label: 'Échoué' },
    ] },
    { key: 'amount', label: 'Montant (DZD)', type: 'number-range' },
    { key: 'dateRange', label: 'Date de paiement', type: 'date-range' },
    { key: 'period', label: 'Période', type: 'select', options: [
      { value: 'today', label: "Aujourd'hui" },
      { value: 'this-week', label: 'Cette semaine' },
      { value: 'this-month', label: 'Ce mois' },
      { value: 'this-quarter', label: 'Ce trimestre' },
      { value: 'this-year', label: 'Cette année' },
    ] },
  ];

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const pid = searchParams.get('patientId');
    if (pid && patients.length > 0) {
      setFormData((prev) => ({ ...prev, patientId: pid }));
      setIsDialogOpen(true);
    }
  }, [searchParams, patients]);

  useEffect(() => {
    if (!mustPay) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [mustPay]);

  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  useEffect(() => {
    if (!mustPay) return;
    const originalPush = router.push;
    let blocked = true;
    (router as any).push = (url: string, ...args: any[]) => {
      if (blocked) {
        setPendingNavigation(url);
        setShowLeaveWarning(true);
        return;
      }
      originalPush(url, ...args);
    };
    return () => {
      blocked = false;
      (router as any).push = originalPush;
    };
  }, [mustPay, router]);

  async function loadData() {
    setLoading(true);
    try {
      const [paymentsRes, patientsRes] = await Promise.all([
        paymentsApi.getAll(),
        patientsApi.getAll(),
      ]);

      if (patientsRes.success && patientsRes.data) {
        const patientsData = patientsRes.data;
        setPatients(Array.isArray(patientsData) ? patientsData : patientsData.patients || []);
      }

      if (paymentsRes.success && paymentsRes.data) {
        const paymentsData = paymentsRes.data;
        const paymentsList = Array.isArray(paymentsData) ? paymentsData : paymentsData.payments || [];
        setPayments(paymentsList);
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

  const handleAmountChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    const num = parseInt(digits) || 0;
    setAmountDisplay(digits ? num.toLocaleString('fr-FR') : '');
    setFormData((prev) => ({ ...prev, amount: digits ? String(num) : '' }));
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.patientId) {
      setError('Veuillez sélectionner un patient');
      return;
    }
    const amount = parseFloat(formData.amount) || 0;
    if (amount <= 0 && !formData.notes.trim()) {
      setError('Un montant de 0 est autorisé uniquement si des notes sont renseignées');
      return;
    }
    if (amount === 0 && isFirstSessionOfPack) {
      setError('Un montant de 0 est interdit pour la première séance d\'un pack. Veuillez saisir un montant supérieur à 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await paymentsApi.create({
        patientId: formData.patientId,
        amount: parseFloat(formData.amount),
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
        paymentDate: formData.paymentDate ? new Date(formData.paymentDate).toISOString() : undefined,
      });

      if (response.success) {
        mustPayRef.current = false;
        await loadData();
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const defaultDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
        setFormData({
          patientId: '',
          amount: '',
          paymentMethod: 'cash',
          notes: '',
          paymentDate: defaultDate,
        });
        setAmountDisplay('');
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
        await loadData();
      } else {
        setError('Erreur lors de la suppression du paiement');
      }
    } catch (err) {
      setError('Erreur lors de la suppression du paiement');
    }
  };

  const formatPrice = (price: number) => {
    const numPrice = Number(price) || 0;
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  function periodToRange(period: string): { from: string; to: string } {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const fmt = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    const quarterStart = new Date(y, Math.floor(m / 3) * 3, 1);
    const quarterEnd = new Date(y, Math.floor(m / 3) * 3 + 3, 0);

    switch (period) {
      case 'today':
        return { from: fmt(now), to: fmt(now) };
      case 'this-week':
        {
          const monday = new Date(now);
          const day = monday.getDay() === 0 ? 7 : monday.getDay();
          monday.setDate(monday.getDate() - day + 1);
          const sunday = new Date(monday);
          sunday.setDate(sunday.getDate() + 6);
          return { from: fmt(monday), to: fmt(sunday) };
        }
      case 'this-month':
        return { from: fmt(firstDay), to: fmt(lastDay) };
      case 'this-quarter':
        return { from: fmt(quarterStart), to: fmt(quarterEnd) };
      case 'this-year':
        return { from: `${y}-01-01`, to: `${y}-12-31` };
      default:
        return { from: '', to: '' };
    }
  }

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      for (const [key, rawValue] of Object.entries(filters)) {
        if (rawValue === undefined || rawValue === null || rawValue === '') continue;

        if (typeof rawValue === 'object') {
          const range = rawValue as { from?: string; to?: string; min?: number; max?: number };

          if (key === 'amount') {
            const amount = Number(payment.amount) || 0;
            if (range.min !== undefined && !Number.isNaN(range.min) && amount < range.min) return false;
            if (range.max !== undefined && !Number.isNaN(range.max) && amount > range.max) return false;
          }

          if (key === 'dateRange') {
            const time = new Date(payment.processedDate || payment.createdAt).getTime();
            const from = range.from ? new Date(`${range.from}T00:00:00`).getTime() : null;
            const to = range.to ? new Date(`${range.to}T23:59:59`).getTime() : null;
            if (from !== null && time < from) return false;
            if (to !== null && time > to) return false;
          }

          continue;
        }

        const value = String(rawValue).toLowerCase();
        if (key === 'patientName') {
          const name = `${payment.patientFirstName || ''} ${payment.patientLastName || ''}`.toLowerCase();
          if (!name.includes(value)) return false;
        }
        if (key === 'paymentMethod' && (payment.paymentMethod || '').toLowerCase() !== value) return false;
        if (key === 'status' && (payment.status || '').toLowerCase() !== value) return false;
        if (key === 'period') {
          const range = periodToRange(value);
          if (range.from || range.to) {
            const time = new Date(payment.processedDate || payment.createdAt).getTime();
            const from = range.from ? new Date(`${range.from}T00:00:00`).getTime() : null;
            const to = range.to ? new Date(`${range.to}T23:59:59`).getTime() : null;
            if (from !== null && time < from) return false;
            if (to !== null && time > to) return false;
          }
        }
      }

      return true;
    });
  }, [payments, filters]);

  const { sortKey, direction, toggleSort, sortedItems } = useSort(
    filteredPayments,
    {
      patientName: (p) => `${p.patientFirstName || ''} ${p.patientLastName || ''}`,
      amount: (p) => Number(p.amount) || 0,
      paymentMethod: (p) => p.paymentMethod || '',
      status: (p) => p.status || '',
      date: (p) => p.processedDate || p.createdAt || '',
    },
    'date',
    'desc'
  );

  const totalFiltered = useMemo(
    () => filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [filteredPayments]
  );

  const { page, setPage, totalPages, totalItems, paginatedItems } = usePagination(sortedItems);

  if (authLoading || loading) {
    return <Spinner fullPage />;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Paiements</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="gap-2 bg-brand-700 hover:bg-brand-800"
          >
            <Plus className="h-4 w-4" />
            Ajouter un paiement
          </Button>
        </div>
      </div>

      <div className="w-full">
        <FilterDialog
          fields={filterFields}
          values={filters}
          onChange={setFilters}
          onReset={() => setFilters(resetFilters(filterFields))}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Add Payment Dialog */}
      {isDialogOpen && (
        <Card className="border-brand-200 bg-brand-50">
          <CardHeader>
            <CardTitle>Nouveau paiement</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Patient *</FieldLabel>
                  <Select
                    value={formData.patientId}
                    onValueChange={(value) => handleInputChange('patientId', value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.firstName} {patient.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPatient && (
                    <div className="text-sm text-gray-500 mt-1 space-y-1">
                      <p>Solde : {Number(selectedPatient.balance || 0).toLocaleString('fr-FR')} DZD</p>
                      {selectedPatient.packServiceName && (
                        <p>Pack {selectedPatient.packServiceName} ({selectedPatient.packRemaining}/{selectedPatient.packTotal})</p>
                      )}
                    </div>
                  )}
                </Field>

                <Field>
                  <FieldLabel>Montant encaissé (DZD) *</FieldLabel>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={amountDisplay}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    disabled={isSubmitting}
                    required
                    placeholder="0"
                  />
                  {isFirstSessionOfPack && (
                    <p className="text-sm text-amber-600 mt-1">
                      Première séance du pack — montant minimum requis.
                    </p>
                  )}
                </Field>

                <Field>
                  <FieldLabel>Date et heure du paiement *</FieldLabel>
                  <Input
                    type="datetime-local"
                    value={formData.paymentDate}
                    onChange={(e) => handleInputChange('paymentDate', e.target.value)}
                    disabled={isSubmitting}
                    required
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
                  className="gap-2 bg-brand-700 hover:bg-brand-800"
                >
                  {isSubmitting ? <Spinner size="sm" /> : 'Enregistrer'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Paiements ({totalItems})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Aucun paiement trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader label="Patient" sortKey="patientName" currentSortKey={sortKey} direction={direction} onSort={toggleSort} />
                    <SortableHeader label="Montant" sortKey="amount" currentSortKey={sortKey} direction={direction} onSort={toggleSort} />
                    <SortableHeader label="Mode de paiement" sortKey="paymentMethod" currentSortKey={sortKey} direction={direction} onSort={toggleSort} className="hidden md:table-cell" />
                    <SortableHeader label="Statut" sortKey="status" currentSortKey={sortKey} direction={direction} onSort={toggleSort} className="hidden md:table-cell" />
                    <SortableHeader label="Date" sortKey="date" currentSortKey={sortKey} direction={direction} onSort={toggleSort} />
                    <SortableHeader label="Enregistré par" sortKey="createdByName" currentSortKey={sortKey} direction={direction} onSort={toggleSort} />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((payment, index) => (
                    <TableRow key={payment.id || `payment-${index}`}>
                      <TableCell className="font-medium">
                        {payment.patientFirstName} {payment.patientLastName}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatPrice(payment.amount)} DZD
                      </TableCell>
                      <TableCell className="capitalize hidden md:table-cell">
                        {payment.paymentMethod === 'cash'
                          ? 'Espèces'
                          : payment.paymentMethod === 'check'
                          ? 'Chèque'
                          : payment.paymentMethod === 'bank-transfer'
                          ? 'Virement'
                          : 'Mobile Money'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="inline-block px-2 py-1 text-sm font-medium text-green-700 bg-green-100 rounded">
                          {payment.status === 'completed'
                            ? 'Complété'
                            : payment.status === 'pending'
                            ? 'En attente'
                            : 'Échoué'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDate(payment.processedDate || payment.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {payment.createdByName || '—'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/payments/${payment.id}/edit`)}
                          className="text-brand-700 hover:text-brand-900 hover:bg-brand-50"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePayment(payment.id)}
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
          <PaginationControls page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">Total ({filteredPayments.length === payments.length ? 'tous' : 'filtré'})</p>
            <p className="text-xl font-bold text-brand-700">{formatPrice(totalFiltered)} DZD</p>
          </div>
        </CardContent>
      </Card>

      {mustPay && (
        <Dialog open={showLeaveWarning} onOpenChange={(open) => {
          if (!open) {
            setShowLeaveWarning(false);
            setPendingNavigation(null);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Paiement requis</DialogTitle>
              <DialogDescription>
                Vous devez enregistrer un paiement avant de quitter cette page.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowLeaveWarning(false);
                  setPendingNavigation(null);
                }}
              >
                Rester ici
              </Button>
              <Button
                className="bg-brand-700 hover:bg-brand-800"
                onClick={() => {
                  setShowLeaveWarning(false);
                  mustPayRef.current = false;
                  if (pendingNavigation) router.push(pendingNavigation);
                }}
              >
                Quitter sans payer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
