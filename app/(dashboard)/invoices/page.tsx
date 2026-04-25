'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { invoices } from '@/lib/api';
import InvoiceForm, { type InvoiceFormData } from '@/components/invoice-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Plus, Eye, Trash2, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  patientEmail: string;
  practitionerId: string;
  total: number;
  status: string;
  dueDate: string;
  createdAt: string;
}

export default function InvoicesPage() {
  const [invoicesList, setInvoicesList] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading && isAuthenticated) {
      loadInvoices();
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    let filtered = invoicesList;

    if (filterStatus !== 'all') {
      filtered = filtered.filter((inv) => inv.status === filterStatus);
    }

    setFilteredInvoices(filtered);
  }, [filterStatus, invoicesList]);

  async function loadInvoices() {
    try {
      setIsLoading(true);
      const response = await invoices.getAll();
      if (response.success && response.data) {
        setInvoicesList(response.data.invoices || []);
      } else {
        setError(response.message || 'Échec du chargement des factures');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement des factures');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(invoiceId: string) {
    if (!confirm('Voulez-vous vraiment supprimer cette facture ?')) {
      return;
    }

    try {
      const response = await invoices.delete(invoiceId);
      if (response.success) {
        await loadInvoices();
      } else {
        setError(response.message || 'Échec de la suppression de la facture');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors de la suppression de la facture');
    }
  }

  async function handleCreateInvoice(data: InvoiceFormData) {
    const response = await invoices.create(data);
    if (!response.success) {
      throw new Error(response.message || 'Échec de la création de la facture');
    }
    setCreateOpen(false);
    await loadInvoices();
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Factures</h1>
            <p className="text-gray-600 mt-1">Gérez vos factures et paiements</p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="gap-2 bg-emerald-700 hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            Créer une facture
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Status Filter */}
      <div className="mb-6 flex gap-2">
        <Button
          variant={filterStatus === 'all' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('all')}
        >
          Toutes
        </Button>
        <Button
          variant={filterStatus === 'draft' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('draft')}
        >
          Brouillon
        </Button>
        <Button
          variant={filterStatus === 'paid' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('paid')}
        >
          Payées
        </Button>
      </div>

      {/* Invoices Table */}
      {filteredInvoices.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Factures ({filteredInvoices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Date créée</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">{invoice.invoiceNumber}</TableCell>
                      <TableCell>
                        {invoice.patientFirstName} {invoice.patientLastName}
                      </TableCell>
                      <TableCell className="font-semibold">{Number(invoice.total).toFixed(2)} DZD</TableCell>
                      <TableCell>{new Date(invoice.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(invoice.status)}>
                          {invoice.status === 'paid' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/invoices/${invoice.id}`)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(invoice.id)}
                          className="gap-2 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-12">
            <div className="text-center">
              <p className="text-gray-500 mb-4">Aucune facture trouvée</p>
              <Button
                onClick={() => setCreateOpen(true)}
                className="gap-2 bg-emerald-700 hover:bg-emerald-800"
              >
                <Plus className="h-4 w-4" />
                Créer une facture
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer une facture</DialogTitle>
            <DialogDescription>
              Sélectionnez le patient et les rendez-vous à facturer.
            </DialogDescription>
          </DialogHeader>
          <InvoiceForm onSubmit={handleCreateInvoice} submitButtonText="Créer la facture" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
