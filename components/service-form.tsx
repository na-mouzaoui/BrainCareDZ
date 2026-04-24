'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface ServiceFormData {
  name: string;
  price: number;
  sessions: number;
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
    }
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleInputChange = (field: string, value: any) => {
    setError('');
    setFormData((prev) => ({
      ...prev,
      [field]: field === 'name' ? value : parseInt(value) || 0,
    }));
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const pricePerSession = formData.sessions > 0 && formData.price > 0 
    ? formData.price / formData.sessions 
    : 0;

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

          <div className="grid grid-cols-2 gap-4">
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
                type="number"
                min="0"
                step="100"
                value={formData.price}
                onChange={(e) => handleInputChange('price', e.target.value)}
                disabled={isFormLoading}
                required
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {formData.name && formData.price > 0 && formData.sessions > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Résumé</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Service</span>
                <span className="font-medium">{formData.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Séances</span>
                <span>{formData.sessions} séance{formData.sessions > 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Prix total</span>
                <span className="font-semibold text-lg">{formatPrice(formData.price)} DZD</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-600">Prix par séance</span>
                <span className="font-semibold">{formatPrice(pricePerSession)} DZD</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="submit" disabled={isFormLoading} className="gap-2">
          {isFormLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            submitButtonText
          )}
        </Button>
      </div>
    </form>
  );
}