'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth-context';
import { companies, companyInvoices } from '@/lib/api';
import CompanyInvoiceForm, { type CompanyInvoiceFormData } from '@/components/company-invoice-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CompanyOption {
  id: string;
  name: string;
}

const SUPPLIER_INFO = {
  name: 'Brain Care',
  owner: 'Sabrina MOKRANE',
  address: 'BT 38 URBA 2000 El Achour Alger Algerie',
  rc: 'R.C. N° : 16/00-4958914A19',
  nif: 'NIF : 279421201996194',
  art: 'Art : 16510 78 0966',
  email: 'Sabrina@braincaredz.com',
  tel: '+213 550 93 29 86',
};

export default function NewCompanyInvoicePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [companyList, setCompanyList] = useState<CompanyOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [nextRef, setNextRef] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading && isAuthenticated) {
      loadCompanies();
    }
  }, [authLoading, isAuthenticated, router]);

  async function loadCompanies() {
    try {
      setIsLoading(true);
      const [companiesRes, refRes] = await Promise.all([
        companies.getAll(),
        companyInvoices.getNextReference(),
      ]);
      if (companiesRes.success && companiesRes.data) {
        setCompanyList(companiesRes.data.companies || []);
      } else {
        setError(companiesRes.message || 'Impossible de charger les entreprises.');
      }
      if (refRes.success && refRes.data) {
        setNextRef(refRes.data);
      }
    } catch (err) {
      setError('Une erreur est survenue lors du chargement.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateInvoice(data: CompanyInvoiceFormData) {
    const response = await companyInvoices.create(data);
    if (!response.success) {
      throw new Error(response.message || 'Echec de la creation de la facture.');
    }

    router.push('/company-invoices');
  }

  const companiesForForm = useMemo(
    () => companyList.map((company) => ({ id: company.id, name: company.name })),
    [companyList]
  );

  if (authLoading || isLoading) {
    return <Spinner fullPage />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Nouvelle facture entreprise</h1>
        </div>
        <Button variant="outline" onClick={() => router.push('/company-invoices')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Template facture</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 text-sm">
            <div className="space-y-2">
              <p className="font-semibold text-gray-900">{SUPPLIER_INFO.name}</p>
              <p className="font-medium text-gray-700">{SUPPLIER_INFO.owner}</p>
              <p className="text-gray-600">{SUPPLIER_INFO.address}</p>
              <p className="text-gray-600">{SUPPLIER_INFO.rc}</p>
              <p className="text-gray-600">{SUPPLIER_INFO.nif}</p>
              <p className="text-gray-600">{SUPPLIER_INFO.art}</p>
              <p className="text-gray-600">Email: {SUPPLIER_INFO.email}</p>
              <p className="text-gray-600">Tel : {SUPPLIER_INFO.tel}</p>
            </div>
            <div className="space-y-2 rounded-lg border border-dashed border-brand-300 p-4">
              <p className="font-semibold text-brand-700">Zone client</p>
              <p className="text-gray-600">Selectionnez l'entreprise et renseignez les informations facture ci-dessous.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <CompanyInvoiceForm
        companies={companiesForForm}
        initialData={nextRef ? { companyId: '', reference: nextRef, invoiceDate: '', items: [{ description: '', sessionCount: 0, learnerCount: 0, unitPrice: 0, subtotal: 0 }], discount: 0, vatAmount: 0, subtotal: 0, discountedTotal: 0, grandTotal: 0 } : undefined}
        onSubmit={handleCreateInvoice}
      />
    </div>
  );
}
