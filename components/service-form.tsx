'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface ServiceFormData {
  name: string;
  description?: string;
  category: string;
  duration: number;
  price: number;
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
  submitButtonText = 'Save Service',
}: ServiceFormProps) {
  const [formData, setFormData] = useState<ServiceFormData>(
    initialData || {
      name: '',
      description: '',
      category: 'consultation',
      duration: 60,
      price: 0,
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

  const handleInputChange = (field: keyof ServiceFormData, value: any) => {
    setError('');
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError('Service name is required');
      return;
    }
    if (!formData.category) {
      setError('Category is required');
      return;
    }
    if (formData.duration < 1) {
      setError('Duration must be at least 1 minute');
      return;
    }
    if (formData.price < 0) {
      setError('Price cannot be negative');
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Service Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Service Name *</FieldLabel>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              disabled={isFormLoading}
              required
              placeholder="e.g., Individual Neurofeedback Session"
            />
          </Field>

          <Field>
            <FieldLabel>Description</FieldLabel>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              disabled={isFormLoading}
              rows={4}
              placeholder="Describe what this service includes..."
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field>
              <FieldLabel>Category *</FieldLabel>
              <Select
                value={formData.category}
                onValueChange={(value) => handleInputChange('category', value)}
                disabled={isFormLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="neurofeedback">Neurofeedback</SelectItem>
                  <SelectItem value="therapy">Therapy</SelectItem>
                  <SelectItem value="assessment">Assessment</SelectItem>
                  <SelectItem value="consultation">Consultation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Duration (minutes) *</FieldLabel>
              <Input
                type="number"
                min="1"
                step="5"
                value={formData.duration}
                onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
                disabled={isFormLoading}
                required
              />
            </Field>

            <Field>
              <FieldLabel>Price ($) *</FieldLabel>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => handleInputChange('price', parseFloat(e.target.value))}
                disabled={isFormLoading}
                required
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Details */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">Service Name:</span>
            <span className="font-semibold">{formData.name || '(Not set)'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">Duration:</span>
            <span className="font-semibold">{formData.duration} minutes</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">Price per Session:</span>
            <span className="font-bold text-lg text-blue-600">${formData.price.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600">Hourly Rate (approx):</span>
            <span className="font-semibold">
              ${formData.duration > 0 ? ((formData.price * 60) / formData.duration).toFixed(2) : '0.00'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex gap-2">
        <Button type="submit" disabled={isFormLoading} className="gap-2">
          {isFormLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            submitButtonText
          )}
        </Button>
      </div>
    </form>
  );
}
