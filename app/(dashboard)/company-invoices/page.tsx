'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Edit2, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { companies, companyInvoices } from '@/lib/api';
import CompanyForm, { type CompanyFormData } from '@/components/company-form';
import { generateCompanyInvoicePdf, type CompanyInvoicePdfData } from '@/lib/company-invoice-pdf';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePagination, PaginationControls } from '@/components/pagination-controls';

interface CompanyOption {
  id: string;
  name: string;
}

interface CompanyRecord extends CompanyOption {
  address?: string;
  owner?: string;
  rc?: string;
  nif?: string;
  nis?: string;
}

interface CompanyInvoiceListItem {
  id: string;
  companyId: string;
  companyName: string;
  reference: string;
  invoiceDate: string;
  totalTTC: number;
}

export default function CompanyInvoicesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [companyList, setCompanyList] = useState<CompanyRecord[]>([]);
  const [invoiceList, setInvoiceList] = useState<CompanyInvoiceListItem[]>([]);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'invoices' | 'companies'>('invoices');
  const { page, setPage, totalPages, totalItems, paginatedItems } = usePagination(invoiceList);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading && isAuthenticated) {
      loadData();
    }
  }, [authLoading, isAuthenticated, router]);

  async function loadData() {
    try {
      setIsLoading(true);
      setError('');
      const [companiesRes, invoicesRes] = await Promise.all([
        companies.getAll(),
        companyInvoices.getAll(),
      ]);

      if (companiesRes.success && companiesRes.data) {
        setCompanyList(companiesRes.data.companies || []);
      } else {
        setError(companiesRes.message || 'Impossible de charger les entreprises.');
      }

      if (invoicesRes.success && invoicesRes.data) {
        setInvoiceList(invoicesRes.data.invoices || []);
      } else {
        setError(invoicesRes.message || 'Impossible de charger les factures.');
      }
    } catch (err) {
      setError('Une erreur est survenue lors du chargement.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateCompany(data: CompanyFormData) {
    const response = await companies.create(data);
    if (!response.success) {
      throw new Error(response.message || 'Echec de la creation de l\'entreprise.');
    }

    setCompanyDialogOpen(false);
    await loadData();
  }

  async function handleDeleteInvoice(id: string) {
    if (!confirm('Voulez-vous vraiment supprimer cette facture ?')) {
      return;
    }

    const response = await companyInvoices.delete(id);
    if (!response.success) {
      setError(response.message || 'Echec de la suppression de la facture.');
      return;
    }

    await loadData();
  }

  async function handleDeleteCompany(id: string) {
    if (!confirm('Voulez-vous vraiment supprimer cette entreprise ?')) {
      return;
    }

    const response = await companies.delete(id);
    if (!response.success) {
      setError(response.message || 'Echec de la suppression de l\'entreprise.');
      return;
    }

    await loadData();
  }

  async function handlePrintInvoice(id: string) {
    if (printingId) return;

    setPrintingId(id);
    setError('');
    try {
      const response = await companyInvoices.getById(id);
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Impossible de charger la facture.');
      }

      const invoice = response.data.invoice as CompanyInvoicePdfData;
      generateCompanyInvoicePdf(invoice);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue.';
      setError(message);
    } finally {
      setPrintingId(null);
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Factures entreprises</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          {activeTab === 'companies' ? (
            <Button variant="outline" onClick={() => setCompanyDialogOpen(true)}>
              Nouvelle entreprise
            </Button>
          ) : (
            <Button onClick={() => router.push('/company-invoices/new')} className="gap-2 bg-brand-700 hover:bg-brand-800">
              <Plus className="h-4 w-4" />
              Nouvelle facture
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'invoices' | 'companies')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="invoices">Factures</TabsTrigger>
          <TabsTrigger value="companies">Entreprises</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Factures ({totalItems})</CardTitle>
            </CardHeader>
            <CardContent>
              {invoiceList.length === 0 ? (
                <p className="text-gray-500">Aucune facture entreprise disponible.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Entreprise</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Total TTC</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.reference}</TableCell>
                          <TableCell>{invoice.companyName}</TableCell>
                          <TableCell>{new Date(invoice.invoiceDate).toLocaleDateString('fr-FR')}</TableCell>
                          <TableCell className="font-semibold">{Number(invoice.totalTTC).toFixed(2)} DZD</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePrintInvoice(invoice.id)}
                              disabled={printingId === invoice.id}
                              className="px-3"
                            >
                              {printingId === invoice.id ? 'Gen...' : 'Imprimer'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteInvoice(invoice.id)}
                              className="text-red-600 hover:text-red-700"
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
              {invoiceList.length > 0 && (
                <PaginationControls page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="companies">
          <Card>
            <CardHeader>
              <CardTitle>Entreprises ({companyList.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {companyList.length === 0 ? (
                <p className="text-gray-500">Aucune entreprise disponible.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Adresse</TableHead>
                        <TableHead>Proprietaire</TableHead>
                        <TableHead>RC</TableHead>
                        <TableHead>NIF</TableHead>
                        <TableHead>NIS</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyList.map((company) => (
                        <TableRow key={company.id}>
                          <TableCell className="font-medium">{company.name}</TableCell>
                          <TableCell>{company.address || '—'}</TableCell>
                          <TableCell>{company.owner || '—'}</TableCell>
                          <TableCell>{company.rc || '—'}</TableCell>
                          <TableCell>{company.nif || '—'}</TableCell>
                          <TableCell>{company.nis || '—'}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/company-invoices/companies/${company.id}/edit`)}
                              className="mr-2"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteCompany(company.id)}
                              className="text-red-600 hover:text-red-700"
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
        </TabsContent>
      </Tabs>

      <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
        <DialogContent className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle entreprise</DialogTitle>
          </DialogHeader>
          <CompanyForm onSubmit={handleCreateCompany} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
