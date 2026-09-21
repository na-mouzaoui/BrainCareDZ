'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Edit2, Plus, Trash2 } from 'lucide-react';
import { ListPageSkeleton } from '@/components/page-skeletons';
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
import { useMemo } from 'react';
import FilterDialog, {
  type FilterField,
  type FilterValues,
  resetFilters,
} from '@/components/filter-dialog';
import { useSort, SortableHeader } from '@/components/sortable-header';

interface CompanyOption {
  id: string;
  name: string;
}

interface CompanyRecord extends CompanyOption {
  address?: string;
  owner?: string;
  rc?: string;
  nif?: string;
  art?: string;
}

interface CompanyInvoiceListItem {
  id: string;
  companyId: string;
  companyName: string;
  reference: string;
  invoiceDate: string;
  grandTotal: number;
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
  const [invoiceFilters, setInvoiceFilters] = useState<FilterValues>({});
  const [companyFilters, setCompanyFilters] = useState<FilterValues>({});

  const invoiceFilterFields: FilterField[] = [
    { key: 'reference', label: 'Référence', type: 'text', placeholder: 'Référence de la facture' },
    { key: 'companyName', label: 'Entreprise', type: 'text', placeholder: 'Nom de l\'entreprise' },
    { key: 'dateRange', label: 'Date de facture', type: 'date-range' },
    { key: 'grandTotal', label: 'Total TTC (DZD)', type: 'number-range' },
  ];

  const companyFilterFields: FilterField[] = [
    { key: 'name', label: 'Nom', type: 'text', placeholder: 'Nom de l\'entreprise' },
    { key: 'owner', label: 'Propriétaire', type: 'text', placeholder: 'Nom du propriétaire' },
    { key: 'address', label: 'Adresse', type: 'text', placeholder: 'Adresse' },
    { key: 'rc', label: 'RC', type: 'text', placeholder: 'Registre de commerce' },
    { key: 'nif', label: 'NIF', type: 'text', placeholder: 'NIF' },
    { key: 'art', label: 'Art', type: 'text', placeholder: 'Art' },
  ];

  const filteredInvoiceList = useMemo(() => {
    return invoiceList.filter((invoice) => {
      for (const [key, rawValue] of Object.entries(invoiceFilters)) {
        if (rawValue === undefined || rawValue === null || rawValue === '') continue;

        if (typeof rawValue === 'object') {
          const range = rawValue as { from?: string; to?: string; min?: number; max?: number };

          if (key === 'grandTotal') {
            const total = Number(invoice.grandTotal) || 0;
            if (range.min !== undefined && !Number.isNaN(range.min) && total < range.min) return false;
            if (range.max !== undefined && !Number.isNaN(range.max) && total > range.max) return false;
          }

          if (key === 'dateRange') {
            const time = new Date(invoice.invoiceDate).getTime();
            const from = range.from ? new Date(`${range.from}T00:00:00`).getTime() : null;
            const to = range.to ? new Date(`${range.to}T23:59:59`).getTime() : null;
            if (from !== null && time < from) return false;
            if (to !== null && time > to) return false;
          }

          continue;
        }

        const value = String(rawValue).toLowerCase();
        if (key === 'reference' && !(invoice.reference || '').toLowerCase().includes(value)) return false;
        if (key === 'companyName' && !(invoice.companyName || '').toLowerCase().includes(value)) return false;
      }

      return true;
    });
  }, [invoiceList, invoiceFilters]);

  const filteredCompanyList = useMemo(() => {
    return companyList.filter((company) => {
      for (const [key, rawValue] of Object.entries(companyFilters)) {
        if (rawValue === undefined || rawValue === null || rawValue === '') continue;
        const value = String(rawValue).toLowerCase();
        const fieldValue = (company as unknown as Record<string, string | undefined>)[key];
        if (!(fieldValue || '').toLowerCase().includes(value)) return false;
      }
      return true;
    });
  }, [companyList, companyFilters]);

  const invoiceSort = useSort(
    filteredInvoiceList,
    {
      reference: (i) => i.reference,
      companyName: (i) => i.companyName || '',
      date: (i) => i.invoiceDate || '',
      grandTotal: (i) => Number(i.grandTotal) || 0,
    },
    'date'
  );

  const companySort = useSort(
    filteredCompanyList,
    {
      name: (c) => c.name,
      address: (c) => c.address || '',
      owner: (c) => c.owner || '',
      rc: (c) => c.rc || '',
      nif: (c) => c.nif || '',
      art: (c) => c.art || '',
    },
    'name'
  );

  const { page, setPage, totalPages, totalItems, paginatedItems } = usePagination(invoiceSort.sortedItems);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
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
    return <ListPageSkeleton />;
  }

  return (
    <div>
      <div className="mb-4 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Factures entreprises</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          {activeTab === 'companies' ? (
            <Button variant="outline" onClick={() => setCompanyDialogOpen(true)} className="w-full sm:w-auto">
              Nouvelle entreprise
            </Button>
          ) : (
            <Button onClick={() => router.push('/company-invoices/new')} className="gap-2 w-full sm:w-auto bg-brand-700 hover:bg-brand-800">
              <Plus className="h-4 w-4" />
              Nouvelle facture
            </Button>
          )}
        </div>
      </div>

      <div className="mb-8 w-full">
        <FilterDialog
          fields={activeTab === 'invoices' ? invoiceFilterFields : companyFilterFields}
          values={activeTab === 'invoices' ? invoiceFilters : companyFilters}
          onChange={activeTab === 'invoices' ? setInvoiceFilters : setCompanyFilters}
          onReset={() =>
            activeTab === 'invoices'
              ? setInvoiceFilters(resetFilters(invoiceFilterFields))
              : setCompanyFilters(resetFilters(companyFilterFields))
          }
        />
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
              <CardTitle>Factures ({filteredInvoiceList.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredInvoiceList.length === 0 ? (
                <p className="text-gray-500">Aucune facture entreprise disponible.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader label="Reference" sortKey="reference" currentSortKey={invoiceSort.sortKey} direction={invoiceSort.direction} onSort={invoiceSort.toggleSort} />
                        <SortableHeader label="Entreprise" sortKey="companyName" currentSortKey={invoiceSort.sortKey} direction={invoiceSort.direction} onSort={invoiceSort.toggleSort} className="hidden sm:table-cell" />
                        <SortableHeader label="Date" sortKey="date" currentSortKey={invoiceSort.sortKey} direction={invoiceSort.direction} onSort={invoiceSort.toggleSort} className="hidden md:table-cell" />
                        <SortableHeader label="Total TTC" sortKey="grandTotal" currentSortKey={invoiceSort.sortKey} direction={invoiceSort.direction} onSort={invoiceSort.toggleSort} />
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">
                            {invoice.reference}
                            <span className="sm:hidden mt-1 block text-xs font-normal text-gray-500">
                              {invoice.companyName && <span className="block">{invoice.companyName}</span>}
                              <span className="block">{new Date(invoice.invoiceDate).toLocaleDateString('fr-FR')}</span>
                            </span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{invoice.companyName}</TableCell>
                          <TableCell className="hidden md:table-cell">{new Date(invoice.invoiceDate).toLocaleDateString('fr-FR')}</TableCell>
                          <TableCell className="font-semibold">{Number(invoice.grandTotal).toFixed(2)} DZD</TableCell>
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
              {filteredInvoiceList.length > 0 && (
                <PaginationControls page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="companies">
          <Card>
            <CardHeader>
              <CardTitle>Entreprises ({filteredCompanyList.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredCompanyList.length === 0 ? (
                <p className="text-gray-500">Aucune entreprise disponible.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader label="Nom" sortKey="name" currentSortKey={companySort.sortKey} direction={companySort.direction} onSort={companySort.toggleSort} />
                        <SortableHeader label="Adresse" sortKey="address" currentSortKey={companySort.sortKey} direction={companySort.direction} onSort={companySort.toggleSort} className="hidden lg:table-cell" />
                        <SortableHeader label="Proprietaire" sortKey="owner" currentSortKey={companySort.sortKey} direction={companySort.direction} onSort={companySort.toggleSort} className="hidden md:table-cell" />
                        <SortableHeader label="RC" sortKey="rc" currentSortKey={companySort.sortKey} direction={companySort.direction} onSort={companySort.toggleSort} className="hidden lg:table-cell" />
                        <SortableHeader label="NIF" sortKey="nif" currentSortKey={companySort.sortKey} direction={companySort.direction} onSort={companySort.toggleSort} className="hidden lg:table-cell" />
                        <SortableHeader label="Art" sortKey="art" currentSortKey={companySort.sortKey} direction={companySort.direction} onSort={companySort.toggleSort} className="hidden lg:table-cell" />
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companySort.sortedItems.map((company) => (
                        <TableRow key={company.id}>
                          <TableCell className="font-medium">
                            {company.name}
                            <span className="lg:hidden mt-1 block text-xs font-normal text-gray-500">
                              {company.owner && <span className="block">{company.owner}</span>}
                              {company.address && <span className="block">{company.address}</span>}
                              {(company.rc || company.nif || company.art) && (
                                <span className="block">
                                  {company.rc && `RC ${company.rc}`}
                                  {company.nif && ` · NIF ${company.nif}`}
                                  {company.art && ` · Art ${company.art}`}
                                </span>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">{company.address || '—'}</TableCell>
                          <TableCell className="hidden md:table-cell">{company.owner || '—'}</TableCell>
                          <TableCell className="hidden lg:table-cell">{company.rc || '—'}</TableCell>
                          <TableCell className="hidden lg:table-cell">{company.nif || '—'}</TableCell>
                          <TableCell className="hidden lg:table-cell">{company.art || '—'}</TableCell>
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
        <DialogContent className="w-full sm:max-w-3xl max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle entreprise</DialogTitle>
          </DialogHeader>
          <CompanyForm onSubmit={handleCreateCompany} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
