'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface ServiceFormData {
  name: string;
  price: number;
  sessions: number;
  type?: string;
}

interface ServiceFormProps {
  initialData?: ServiceFormData;
  isLoading?: boolean;
  onSubmit: (data: ServiceFormData) => Promise<void>;
  submitButtonText?: string;
}

export default function ServiceForm({
  initialData,
  isLoading = false,
  onSubmit,
  submitButtonText = 'Enregistrer le service',
}: ServiceFormProps) {
  const [formData, setFormData] = useState<ServiceFormData>(
    initialData || {
      name: '',
      price: 0,
      sessions: 1,
      type: 'consultation',
    }
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [priceDisplay, setPriceDisplay] = useState(
    formData.price > 0 ? formData.price.toLocaleString('fr-FR') : ''
  );

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setPriceDisplay(initialData.price > 0 ? initialData.price.toLocaleString('fr-FR') : '');
    }
  }, [initialData]);

  const handleInputChange = (field: string, value: any) => {
    setError('');
    setFormData((prev) => ({
      ...prev,
      [field]: field === 'name' || field === 'type' ? value : parseInt(value) || 0,
    }));
  };

  const handlePriceChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    const num = parseInt(digits) || 0;
    setPriceDisplay(digits ? num.toLocaleString('fr-FR') : '');
    setFormData((prev) => ({ ...prev, price: num }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Le nom du service est requis');
      return;
    }

    if (formData.price < 0) {
      setError('Le prix doit être positif');
      return;
    }

    if (formData.sessions < 1) {
      setError('Le nombre de séances doit être au moins 1');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setSubmitting(false);
    }
  };

  const isFormLoading = isLoading || submitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Informations du service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Nom du service *</FieldLabel>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              disabled={isFormLoading}
              required
              placeholder="p.ex., Séance de neurofeedback, Consultation psy, etc."
            />
          </Field>

          <Field>
            <FieldLabel>Type *</FieldLabel>
            <Select
              value={formData.type || 'consultation'}
              onValueChange={(value) => handleInputChange('type', value)}
              disabled={isFormLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consultation">Consultation</SelectItem>
                <SelectItem value="neurofeedback">Neurofeedback</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Nombre de séances *</FieldLabel>
              <Input
                type="number"
                min="1"
                value={formData.sessions}
                onChange={(e) => handleInputChange('sessions', e.target.value)}
                disabled={isFormLoading}
                required
              />
            </Field>

            <Field>
              <FieldLabel>Prix total (DZD) *</FieldLabel>
              <Input
                type="text"
                inputMode="numeric"
                value={priceDisplay}
                onChange={(e) => handlePriceChange(e.target.value)}
                disabled={isFormLoading}
                required
                placeholder="0"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end">
        <Button type="submit" disabled={isFormLoading} className="gap-2">
          {isFormLoading ? (
            <>
              <Spinner size="sm" />
            </>
          ) : (
            submitButtonText
          )}
        </Button>
      </div>
    </form>
  );
}