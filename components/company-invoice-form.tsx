'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface CompanyInvoiceItemForm {
  description: string;
  sessionCount: number;
  learnerCount: number;
  unitPrice: number;
  subtotal: number;
}

export interface CompanyInvoiceFormData {
  companyId: string;
  reference: string;
  invoiceDate: string;
  items: CompanyInvoiceItemForm[];
  discount: number;
  vatAmount: number;
  subtotal: number;
  discountedTotal: number;
  grandTotal: number;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface CompanyInvoiceFormProps {
  companies: CompanyOption[];
  initialData?: CompanyInvoiceFormData;
  isLoading?: boolean;
  onSubmit: (data: CompanyInvoiceFormData) => Promise<void>;
}

const EMPTY_ITEM: CompanyInvoiceItemForm = {
  description: '',
  sessionCount: 0,
  learnerCount: 0,
  unitPrice: 0,
  subtotal: 0,
};

export default function CompanyInvoiceForm({
  companies,
  initialData,
  isLoading = false,
  onSubmit,
}: CompanyInvoiceFormProps) {
  const [formData, setFormData] = useState<CompanyInvoiceFormData>(
    initialData || {
      companyId: '',
      reference: '',
      invoiceDate: '',
      items: [{ ...EMPTY_ITEM }],
      discount: 0,
      vatAmount: 0,
      subtotal: 0,
      discountedTotal: 0,
      grandTotal: 0,
    }
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const totals = useMemo(() => {
    const subtotal = formData.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const discount = Number(formData.discount || 0);
    const discountedTotal = Math.max(subtotal - discount, 0);
    const vatAmount = Number(formData.vatAmount || 0);
    const grandTotal = discountedTotal + vatAmount;
    return { subtotal, discountedTotal, grandTotal };
  }, [formData.items, formData.discount, formData.vatAmount]);

  const handleItemChange = (index: number, field: keyof CompanyInvoiceItemForm, value: string) => {
    setError('');
    setFormData((prev) => {
      const items = prev.items.map((item, idx) => {
        if (idx !== index) return item;
        const next = { ...item } as CompanyInvoiceItemForm;
        if (field === 'description') {
          next.description = value;
        } else {
          const numberValue = Number(value || 0);
          next[field] = numberValue as never;
        }

        next.subtotal = Number(next.sessionCount || 0) * Number(next.learnerCount || 0) * Number(next.unitPrice || 0);
        return next;
      });

      return { ...prev, items };
    });
  };

  const handleMetaChange = (field: keyof CompanyInvoiceFormData, value: string) => {
    setError('');
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNumberChange = (field: keyof CompanyInvoiceFormData, value: string) => {
    setError('');
    setFormData((prev) => ({
      ...prev,
      [field]: Number(value || 0),
    }));
  };

  const addItemRow = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { ...EMPTY_ITEM }],
    }));
  };

  const removeItemRow = (index: number) => {
    setFormData((prev) => {
      const items = prev.items.filter((_, idx) => idx !== index);
      return { ...prev, items: items.length > 0 ? items : [{ ...EMPTY_ITEM }] };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.companyId) {
      setError('Veuillez selectionner une entreprise.');
      return;
    }
    if (!formData.reference.trim()) {
      setError('Veuillez saisir la reference.');
      return;
    }
    if (!formData.invoiceDate) {
      setError('Veuillez saisir la date.');
      return;
    }

    const hasValidItem = formData.items.some((item) => item.description.trim());
    if (!hasValidItem) {
      setError('Veuillez renseigner au moins une ligne.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        items: formData.items.map((item) => ({
          ...item,
          description: item.description.trim(),
          sessionCount: Number(item.sessionCount || 0),
          learnerCount: Number(item.learnerCount || 0),
          unitPrice: Number(item.unitPrice || 0),
          subtotal: Number(item.subtotal || 0),
        })),
        subtotal: totals.subtotal,
        discountedTotal: totals.discountedTotal,
        grandTotal: totals.grandTotal,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  const isFormLoading = isLoading || submitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Informations facture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Entreprise *</FieldLabel>
              <Select
                value={formData.companyId}
                onValueChange={(value) => handleMetaChange('companyId', value)}
                disabled={isFormLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner une entreprise" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Reference *</FieldLabel>
              <Input
                value={formData.reference}
                onChange={(e) => handleMetaChange('reference', e.target.value)}
                disabled={isFormLoading}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Date *</FieldLabel>
              <Input
                type="date"
                value={formData.invoiceDate}
                onChange={(e) => handleMetaChange('invoiceDate', e.target.value)}
                disabled={isFormLoading}
              />
            </Field>
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items factures</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Nombre de seances</TableHead>
                <TableHead>Nb apprenants</TableHead>
                <TableHead>P.U./heure (HT)</TableHead>
                <TableHead>Total HT</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formData.items.map((item, index) => (
                <TableRow key={`item-${index}`}>
                  <TableCell>
                    <Input
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      disabled={isFormLoading}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={item.sessionCount}
                      onChange={(e) => handleItemChange(index, 'sessionCount', e.target.value)}
                      disabled={isFormLoading}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={item.learnerCount}
                      onChange={(e) => handleItemChange(index, 'learnerCount', e.target.value)}
                      disabled={isFormLoading}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                      disabled={isFormLoading}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.subtotal.toFixed(2)}
                      disabled
                      readOnly
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeItemRow(index)}
                      disabled={isFormLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end pt-4">
            <Button type="button" variant="outline" onClick={addItemRow} disabled={isFormLoading} className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter une ligne
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Totaux</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Total HT</FieldLabel>
              <Input value={totals.subtotal.toFixed(2)} readOnly disabled />
            </Field>
            <Field>
              <FieldLabel>Remise</FieldLabel>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.discount}
                onChange={(e) => handleNumberChange('discount', e.target.value)}
                disabled={isFormLoading}
              />
            </Field>
            <Field>
              <FieldLabel>Total remise (HT)</FieldLabel>
              <Input value={totals.discountedTotal.toFixed(2)} readOnly disabled />
            </Field>
            <Field>
              <FieldLabel>TVA</FieldLabel>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.vatAmount}
                onChange={(e) => handleNumberChange('vatAmount', e.target.value)}
                disabled={isFormLoading}
              />
            </Field>
            <Field>
              <FieldLabel>Total (TTC)</FieldLabel>
              <Input value={totals.grandTotal.toFixed(2)} readOnly disabled />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" disabled={isFormLoading}>
        {isFormLoading ? (
          <>
            <Spinner size="sm" />
          </>
        ) : (
          'Enregistrer la facture'
        )}
      </Button>
    </form>
  );
}
