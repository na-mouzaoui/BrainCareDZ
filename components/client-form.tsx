'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface ClientFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  gender?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  medicalHistory?: string;
  allergies?: string;
  currentMedications?: string;
  referralSource?: string;
  status?: string;
  notes?: string;
}

interface ClientFormProps {
  initialData?: ClientFormData;
  isLoading?: boolean;
  onSubmit: (data: ClientFormData) => Promise<void>;
  submitButtonText?: string;
}

export default function ClientForm({
  initialData,
  isLoading = false,
  onSubmit,
  submitButtonText = 'Enregistrer le client',
}: ClientFormProps) {
  const [formData, setFormData] = useState<ClientFormData>(
    initialData || {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      gender: '',
      status: 'active',
      address: {},
      emergencyContact: {},
    }
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleInputChange = (
    field: string,
    value: any,
    parent?: string
  ) => {
    setError('');
    if (parent) {
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof ClientFormData] as any),
          [field]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (!formData.lastName.trim()) {
      setError('Last name is required');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Phone number is required');
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
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>First Name *</FieldLabel>
              <Input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                disabled={isFormLoading}
                required
              />
            </Field>

            <Field>
              <FieldLabel>Last Name *</FieldLabel>
              <Input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                disabled={isFormLoading}
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={isFormLoading}
              />
            </Field>

            <Field>
              <FieldLabel>Phone *</FieldLabel>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                disabled={isFormLoading}
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Date of Birth</FieldLabel>
              <Input
                type="date"
                value={formData.dateOfBirth || ''}
                onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                disabled={isFormLoading}
              />
            </Field>

            <Field>
              <FieldLabel>Sexe</FieldLabel>
              <RadioGroup
                value={formData.gender || ''}
                onValueChange={(value) => handleInputChange('gender', value)}
                className="flex items-center gap-6"
                disabled={isFormLoading}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="male" id="gender-male" />
                  <label htmlFor="gender-male" className="text-sm font-medium">Homme</label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="female" id="gender-female" />
                  <label htmlFor="gender-female" className="text-sm font-medium">Femme</label>
                </div>
              </RadioGroup>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Address Information */}
      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Street</FieldLabel>
            <Input
              type="text"
              value={formData.address?.street || ''}
              onChange={(e) => handleInputChange('street', e.target.value, 'address')}
              disabled={isFormLoading}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field>
              <FieldLabel>City</FieldLabel>
              <Input
                type="text"
                value={formData.address?.city || ''}
                onChange={(e) => handleInputChange('city', e.target.value, 'address')}
                disabled={isFormLoading}
              />
            </Field>

            <Field>
              <FieldLabel>State</FieldLabel>
              <Input
                type="text"
                value={formData.address?.state || ''}
                onChange={(e) => handleInputChange('state', e.target.value, 'address')}
                disabled={isFormLoading}
              />
            </Field>

            <Field>
              <FieldLabel>ZIP Code</FieldLabel>
              <Input
                type="text"
                value={formData.address?.zipCode || ''}
                onChange={(e) => handleInputChange('zipCode', e.target.value, 'address')}
                disabled={isFormLoading}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Country</FieldLabel>
            <Input
              type="text"
              value={formData.address?.country || ''}
              onChange={(e) => handleInputChange('country', e.target.value, 'address')}
              disabled={isFormLoading}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Emergency Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input
                type="text"
                value={formData.emergencyContact?.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value, 'emergencyContact')}
                disabled={isFormLoading}
              />
            </Field>

            <Field>
              <FieldLabel>Relationship</FieldLabel>
              <Input
                type="text"
                value={formData.emergencyContact?.relationship || ''}
                onChange={(e) => handleInputChange('relationship', e.target.value, 'emergencyContact')}
                disabled={isFormLoading}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Phone</FieldLabel>
            <Input
              type="tel"
              value={formData.emergencyContact?.phone || ''}
              onChange={(e) => handleInputChange('phone', e.target.value, 'emergencyContact')}
              disabled={isFormLoading}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Insurance & Medical Information */}
      <Card>
        <CardHeader>
          <CardTitle>Insurance & Medical Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Insurance Provider</FieldLabel>
              <Input
                type="text"
                value={formData.insuranceProvider || ''}
                onChange={(e) => handleInputChange('insuranceProvider', e.target.value)}
                disabled={isFormLoading}
              />
            </Field>

            <Field>
              <FieldLabel>Policy Number</FieldLabel>
              <Input
                type="text"
                value={formData.insurancePolicyNumber || ''}
                onChange={(e) => handleInputChange('insurancePolicyNumber', e.target.value)}
                disabled={isFormLoading}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Allergies</FieldLabel>
            <Textarea
              value={formData.allergies || ''}
              onChange={(e) => handleInputChange('allergies', e.target.value)}
              disabled={isFormLoading}
              rows={3}
            />
          </Field>

          <Field>
            <FieldLabel>Current Medications</FieldLabel>
            <Textarea
              value={formData.currentMedications || ''}
              onChange={(e) => handleInputChange('currentMedications', e.target.value)}
              disabled={isFormLoading}
              rows={3}
            />
          </Field>

          <Field>
            <FieldLabel>Medical History</FieldLabel>
            <Textarea
              value={formData.medicalHistory || ''}
              onChange={(e) => handleInputChange('medicalHistory', e.target.value)}
              disabled={isFormLoading}
              rows={3}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Referral Source</FieldLabel>
            <Input
              type="text"
              value={formData.referralSource || ''}
              onChange={(e) => handleInputChange('referralSource', e.target.value)}
              disabled={isFormLoading}
              placeholder="How did the client hear about us?"
            />
          </Field>

          <Field>
            <FieldLabel>Status</FieldLabel>
            <Select
              value={formData.status || 'active'}
              onValueChange={(value) => handleInputChange('status', value)}
              disabled={isFormLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Notes</FieldLabel>
            <Textarea
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              disabled={isFormLoading}
              rows={4}
              placeholder="Any additional notes about the client..."
            />
          </Field>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={isFormLoading}
          className="gap-2"
        >
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
