'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { clients as clientsApi, services as servicesApi, appointments as appointmentsApi } from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';

export interface AppointmentFormData {
  clientId: string;
  serviceId: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

interface Client {
  _id: string;
  firstName: string;
  lastName: string;
}

interface Service {
  _id: string;
  name: string;
  duration: number;
  price: number;
}

interface AppointmentFormProps {
  initialData?: AppointmentFormData;
  isLoading?: boolean;
  onSubmit: (data: AppointmentFormData) => Promise<void>;
  submitButtonText?: string;
}

export default function AppointmentForm({
  initialData,
  isLoading = false,
  onSubmit,
  submitButtonText = 'Planifier le rendez-vous',
}: AppointmentFormProps) {
  const [formData, setFormData] = useState<AppointmentFormData>(
    initialData || {
      clientId: '',
      serviceId: '',
      startTime: '',
      endTime: '',
      notes: '',
    }
  );
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    loadClientsAndServices();
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  // Auto-calculate end time when start time and service change
  useEffect(() => {
    if (formData.startTime && formData.serviceId) {
      const selectedService = servicesList.find((s) => s._id === formData.serviceId);
      if (selectedService) {
        const startDate = new Date(formData.startTime);
        const endDate = new Date(startDate.getTime() + selectedService.duration * 60000);
        setFormData((prev) => ({
          ...prev,
          endTime: endDate.toISOString().slice(0, 16),
        }));
      }
    }
  }, [formData.startTime, formData.serviceId, servicesList]);

  async function loadClientsAndServices() {
    try {
      const [clientsRes, servicesRes] = await Promise.all([
        clientsApi.getAll(),
        servicesApi.getAll(),
      ]);

      if (clientsRes.success && clientsRes.data) {
        setClientsList(clientsRes.data.clients || []);
      }
      if (servicesRes.success && servicesRes.data) {
        setServicesList(servicesRes.data.services || []);
      }
    } catch (err) {
      setError('Failed to load clients and services');
    } finally {
      setLoadingData(false);
    }
  }

  const handleInputChange = (field: keyof AppointmentFormData, value: string) => {
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
    if (!formData.clientId) {
      setError('Veuillez sélectionner un client');
      return;
    }
    if (!formData.serviceId) {
      setError('Veuillez sélectionner un service');
      return;
    }
    if (!formData.startTime) {
      setError('Veuillez sélectionner une heure de début');
      return;
    }
    if (!formData.endTime) {
      setError('Veuillez sélectionner une heure de fin');
      return;
    }

    const startTime = new Date(formData.startTime);
    const endTime = new Date(formData.endTime);

    if (endTime <= startTime) {
      setError('L\'heure de fin doit être après l\'heure de début');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const isFormLoading = isLoading || submitting || loadingData;
  const selectedService = servicesList.find((s) => s._id === formData.serviceId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Appointment Details */}
      <Card>
        <CardHeader>
          <CardTitle>Détails du rendez-vous</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Client *</FieldLabel>
            <Select
              value={formData.clientId}
              onValueChange={(value) => handleInputChange('clientId', value)}
              disabled={isFormLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un client" />
              </SelectTrigger>
              <SelectContent>
                {clientsList.map((client) => (
                  <SelectItem key={client._id} value={client._id}>
                    {client.firstName} {client.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Service *</FieldLabel>
            <Select
              value={formData.serviceId}
              onValueChange={(value) => handleInputChange('serviceId', value)}
              disabled={isFormLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un service" />
              </SelectTrigger>
              <SelectContent>
                {servicesList.map((service) => (
                  <SelectItem key={service._id} value={service._id}>
                    {service.name} ({service.duration} min) - ${service.price.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Date et heure de début *</FieldLabel>
              <Input
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) => handleInputChange('startTime', e.target.value)}
                disabled={isFormLoading}
                required
              />
            </Field>

            <Field>
              <FieldLabel>Date et heure de fin *</FieldLabel>
              <Input
                type="datetime-local"
                value={formData.endTime}
                onChange={(e) => handleInputChange('endTime', e.target.value)}
                disabled={isFormLoading}
                required
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Notes</FieldLabel>
            <Textarea
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="Toute instruction spéciale ou note pour ce rendez-vous..."
            />
          </Field>
        </CardContent>
      </Card>

      {/* Résumé du rendez-vous */}
      {selectedService && formData.startTime && (
        <Card>
          <CardHeader>
            <CardTitle>Résumé du rendez-vous</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Service :</span>
              <span className="font-semibold">{selectedService.name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Durée :</span>
              <span className="font-semibold">{selectedService.duration} minutes</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Tarif :</span>
              <span className="font-bold text-lg text-blue-600">
                ${selectedService.price.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Date et heure :</span>
              <span className="font-semibold">
                {new Date(formData.startTime).toLocaleString('fr-FR', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Button */}
      <div className="flex gap-2 justify-end">
        <Button
          type="submit"
          disabled={isFormLoading}
          className="gap-2"
        >
          {isFormLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Scheduling...
            </>
          ) : (
            submitButtonText
          )}
        </Button>
      </div>
    </form>
  );
}
