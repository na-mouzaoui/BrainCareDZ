'use client';

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export interface CompanyFormData {
  name: string;
  address?: string;
  owner?: string;
  rc?: string;
  nif?: string;
  art?: string;
}

interface CompanyFormProps {
  initialData?: CompanyFormData;
  isLoading?: boolean;
  onSubmit: (data: CompanyFormData) => Promise<void>;
  submitButtonText?: string;
}

export default function CompanyForm({
  initialData,
  isLoading = false,
  onSubmit,
  submitButtonText = 'Enregistrer',
}: CompanyFormProps) {
  const [formData, setFormData] = useState<CompanyFormData>(
    initialData || {
      name: '',
      address: '',
      owner: '',
      rc: '',
      nif: '',
      art: '',
    }
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleInputChange = (field: keyof CompanyFormData, value: string) => {
    setError('');
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Veuillez saisir le nom de l\'entreprise.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        name: formData.name.trim(),
        address: formData.address?.trim() || undefined,
        owner: formData.owner?.trim() || undefined,
        rc: formData.rc?.trim() || undefined,
        nif: formData.nif?.trim() || undefined,
        art: formData.art?.trim() || undefined,
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
          <CardTitle>Entreprise</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Nom *</FieldLabel>
            <Input
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              disabled={isFormLoading}
            />
          </Field>

          <Field>
            <FieldLabel>Adresse</FieldLabel>
            <Input
              value={formData.address || ''}
              onChange={(e) => handleInputChange('address', e.target.value)}
              disabled={isFormLoading}
            />
          </Field>

          <Field>
            <FieldLabel>Proprietaire</FieldLabel>
            <Input
              value={formData.owner || ''}
              onChange={(e) => handleInputChange('owner', e.target.value)}
              disabled={isFormLoading}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field>
              <FieldLabel>RC</FieldLabel>
              <Input
                value={formData.rc || ''}
                onChange={(e) => handleInputChange('rc', e.target.value)}
                disabled={isFormLoading}
              />
            </Field>
            <Field>
              <FieldLabel>NIF</FieldLabel>
              <Input
                value={formData.nif || ''}
                onChange={(e) => handleInputChange('nif', e.target.value)}
                disabled={isFormLoading}
              />
            </Field>
            <Field>
              <FieldLabel>Art (Num d'article)</FieldLabel>
              <Input
                value={formData.art || ''}
                onChange={(e) => handleInputChange('art', e.target.value)}
                disabled={isFormLoading}
              />
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
          submitButtonText
        )}
      </Button>
    </form>
  );
}
