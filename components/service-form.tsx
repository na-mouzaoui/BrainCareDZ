'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface Formula {
  id?: string;
  numberOfSessions: number;
  price: number;
}

export interface ServiceFormData {
  name: string;
  formulas: Formula[];
  isActive?: boolean;
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
      formulas: [{ numberOfSessions: 1, price: 0 }],
      isActive: true,
    }
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleNameChange = (value: string) => {
    setError('');
    setFormData((prev) => ({
      ...prev,
      name: value,
    }));
  };

  const handleFormulaChange = (index: number, field: 'numberOfSessions' | 'price', value: any) => {
    setError('');
    setFormData((prev) => ({
      ...prev,
      formulas: prev.formulas.map((formula, i) =>
        i === index ? { ...formula, [field]: value } : formula
      ),
    }));
  };

  const addFormula = () => {
    setFormData((prev) => ({
      ...prev,
      formulas: [...prev.formulas, { numberOfSessions: 1, price: 0 }],
    }));
  };

  const removeFormula = (index: number) => {
    if (formData.formulas.length === 1) {
      setError('Vous devez avoir au moins une formule');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      formulas: prev.formulas.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError('Le nom du service est requis');
      return;
    }
    if (formData.formulas.length === 0) {
      setError('Vous devez avoir au moins une formule');
      return;
    }

    const invalidFormula = formData.formulas.some(
      (f) => f.numberOfSessions < 1 || f.price < 0
    );
    if (invalidFormula) {
      setError('Chaque formule doit avoir au moins 1 séance et un prix valide');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Informations sur le service */}
      <Card>
        <CardHeader>
          <CardTitle>Nom du service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Nom du service *</FieldLabel>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={isFormLoading}
              required
              placeholder="p.ex., Séance individuelle de neurofeedback, Consultation psy, etc."
            />
          </Field>
        </CardContent>
      </Card>

      {/* Formules de tarification */}
      <Card>
        <CardHeader>
          <CardTitle>Formules de tarification</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Définissez les différentes formules disponibles pour ce service. Chaque formule est identifiée par le nombre de séances et le prix.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.formulas.map((formula, index) => (
            <div key={index} className="flex gap-4 items-end p-4 bg-gray-50 rounded-lg border border-gray-200">
              <Field className="flex-1">
                <FieldLabel>Nombre de séances *</FieldLabel>
                <Input
                  type="number"
                  min="1"
                  value={formula.numberOfSessions}
                  onChange={(e) =>
                    handleFormulaChange(index, 'numberOfSessions', parseInt(e.target.value) || 1)
                  }
                  disabled={isFormLoading}
                  required
                />
              </Field>

              <Field className="flex-1">
                <FieldLabel>Prix total (DZD) *</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formula.price}
                  onChange={(e) => handleFormulaChange(index, 'price', parseFloat(e.target.value) || 0)}
                  disabled={isFormLoading}
                  required
                />
              </Field>

              <div className="flex-1">
                <div className="text-sm font-medium text-gray-700 mb-2">Prix par séance</div>
                <div className="text-sm text-gray-500">
                  {formula.numberOfSessions > 0 ? formatPrice(formula.price / formula.numberOfSessions) : '0'} DZD
                </div>
              </div>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => removeFormula(index)}
                disabled={isFormLoading || formData.formulas.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addFormula}
            disabled={isFormLoading}
            className="w-full gap-2"
          >
            <Plus className="h-4 w-4" />
            Ajouter une formule
          </Button>
        </CardContent>
      </Card>

      {/* Résumé des formules */}
      <Card>
        <CardHeader>
          <CardTitle>Résumé des formules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {formData.formulas.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune formule définie</p>
            ) : (
              formData.formulas.map((formula, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="text-gray-600">
                    {formula.numberOfSessions} séance{formula.numberOfSessions > 1 ? 's' : ''} :
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">{formatPrice(formula.price)} DZD</span>
                    <span className="text-sm text-gray-500">
                      ({formula.numberOfSessions > 0 ? formatPrice(formula.price / formula.numberOfSessions) : '0'} DZD/séance)
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex gap-2 justify-end">
        <Button type="submit" disabled={isFormLoading} className="gap-2">
          {isFormLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enregistrement en cours...
            </>
          ) : (
            submitButtonText
          )}
        </Button>
      </div>
    </form>
  );
}
