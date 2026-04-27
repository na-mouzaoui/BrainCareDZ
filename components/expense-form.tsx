'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export interface ExpenseFormData {
  title: string;
  category?: string;
  amount: number;
  expenseDate: string;
  notes?: string;
}

interface ExpenseFormProps {
  initialData?: ExpenseFormData;
  isLoading?: boolean;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  submitButtonText?: string;
}

export default function ExpenseForm({
  initialData,
  isLoading = false,
  onSubmit,
  submitButtonText = 'Enregistrer',
}: ExpenseFormProps) {
  const [formData, setFormData] = useState<ExpenseFormData>(
    initialData || {
      title: '',
      category: '',
      amount: 0,
      expenseDate: '',
      notes: '',
    }
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleInputChange = (field: keyof ExpenseFormData, value: string | number) => {
    setError('');
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError('Veuillez saisir un libelle.');
      return;
    }
    if (!formData.expenseDate) {
      setError('Veuillez choisir une date.');
      return;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      setError('Veuillez saisir un montant valide.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        title: formData.title.trim(),
        category: formData.category?.trim() || undefined,
        notes: formData.notes?.trim() || undefined,
        amount: Number(formData.amount),
        expenseDate: new Date(formData.expenseDate).toISOString(),
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
          <CardTitle>Details de la depense</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Libelle *</FieldLabel>
            <Input
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              disabled={isFormLoading}
              placeholder="Ex: Loyer du cabinet"
            />
          </Field>

          <Field>
            <FieldLabel>Categorie</FieldLabel>
            <Input
              value={formData.category || ''}
              onChange={(e) => handleInputChange('category', e.target.value)}
              disabled={isFormLoading}
              placeholder="Ex: Loyer, materiel, salaires"
            />
          </Field>

          <Field>
            <FieldLabel>Montant (DZD) *</FieldLabel>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', e.target.value)}
              disabled={isFormLoading}
            />
          </Field>

          <Field>
            <FieldLabel>Date de depense *</FieldLabel>
            <Input
              type="date"
              value={formData.expenseDate}
              onChange={(e) => handleInputChange('expenseDate', e.target.value)}
              disabled={isFormLoading}
            />
          </Field>

          <Field>
            <FieldLabel>Notes</FieldLabel>
            <Textarea
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="Informations supplementaires..."
            />
          </Field>
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" disabled={isFormLoading}>
        {isFormLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Enregistrement...
          </>
        ) : (
          submitButtonText
        )}
      </Button>
    </form>
  );
}
