'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { clients as clientsApi, appointments as appointmentsApi } from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

export interface InvoiceFormData {
  clientId: string;
  appointmentIds: string[];
  dueDate: string;
  notes?: string;
}

interface Client {
  _id: string;
  firstName: string;
  lastName: string;
}

interface Appointment {
  _id: string;
  startTime: string;
  client: {
    firstName: string;
    lastName: string;
  };
  service: {
    name: string;
    price: number;
  };
}

interface InvoiceFormProps {
  initialData?: InvoiceFormData;
  isLoading?: boolean;
  onSubmit: (data: InvoiceFormData) => Promise<void>;
  submitButtonText?: string;
}

export default function InvoiceForm({
  initialData,
  isLoading = false,
  onSubmit,
  submitButtonText = 'Créer une facture',
}: InvoiceFormProps) {
  const [formData, setFormData] = useState<InvoiceFormData>(
    initialData || {
      clientId: '',
      appointmentIds: [],
      dueDate: '',
      notes: '',
    }
  );
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [appointmentsList, setAppointmentsList] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (formData.clientId) {
      loadAppointments();
    }
  }, [formData.clientId]);

  useEffect(() => {
    if (formData.clientId) {
      const filtered = appointmentsList.filter(
        (apt) => apt.client._id === formData.clientId
      );
      setFilteredAppointments(filtered);
    } else {
      setFilteredAppointments([]);
    }
  }, [formData.clientId, appointmentsList]);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  async function loadClients() {
    try {
      const response = await clientsApi.getAll();
      if (response.success && response.data) {
        setClientsList(response.data.clients || []);
      }
    } catch (err) {
      setError('Échec du chargement des clients');
    } finally {
      setLoadingData(false);
    }
  }

  async function loadAppointments() {
    try {
      const response = await appointmentsApi.getAll();
      if (response.success && response.data) {
        setAppointmentsList(response.data.appointments || []);
      }
    } catch (err) {
      // Silently fail for appointments
    }
  }

  const handleInputChange = (field: keyof InvoiceFormData, value: any) => {
    setError('');
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const toggleAppointment = (appointmentId: string) => {
    const currentIds = formData.appointmentIds || [];
    const newIds = currentIds.includes(appointmentId)
      ? currentIds.filter((id) => id !== appointmentId)
      : [...currentIds, appointmentId];
    handleInputChange('appointmentIds', newIds);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.clientId) {
      setError('Veuillez sélectionner un client');
      return;
    }
    if (!formData.appointmentIds || formData.appointmentIds.length === 0) {
      setError('Veuillez sélectionner au moins un rendez-vous');
      return;
    }
    if (!formData.dueDate) {
      setError('Veuillez définir une date d\'\u00e9chéance');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        dueDate: new Date(formData.dueDate).toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const isFormLoading = isLoading || submitting || loadingData;
  const selectedAppointments = filteredAppointments.filter((apt) =>
    formData.appointmentIds?.includes(apt._id)
  );
  const total = selectedAppointments.reduce((sum, apt) => sum + apt.service.price, 0);
  const tax = Math.round(total * 0.1 * 100) / 100;
  const grandTotal = total + tax;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Détails de la facture */}
      <Card>
        <CardHeader>
          <CardTitle>Détails de la facture</CardTitle>
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
            <FieldLabel>Date d'échéance *</FieldLabel>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => handleInputChange('dueDate', e.target.value)}
              disabled={isFormLoading}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </Field>

          <Field>
            <FieldLabel>Notes</FieldLabel>
            <Textarea
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="Toute note supplémentaire pour la facture..."
            />
          </Field>
        </CardContent>
      </Card>

      {/* Appointments Selection */}
      {formData.clientId && filteredAppointments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sélectionner les rendez-vous à facturer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredAppointments.map((apt) => (
              <div
                key={apt._id}
                className="flex items-start gap-3 p-3 border rounded-md hover:bg-gray-50"
              >
                <Checkbox
                  id={apt._id}
                  checked={formData.appointmentIds?.includes(apt._id) || false}
                  onCheckedChange={() => toggleAppointment(apt._id)}
                  disabled={isFormLoading}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label htmlFor={apt._id} className="block text-sm font-medium cursor-pointer">
                    {apt.service.name}
                  </label>
                  <p className="text-xs text-gray-500">
                    {new Date(apt.startTime).toLocaleString('fr-FR', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${apt.service.price.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Invoice Summary */}
      {selectedAppointments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Résumé de la facture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              {selectedAppointments.map((apt) => (
                <div key={apt._id} className="flex justify-between">
                  <span>{apt.service.name}</span>
                  <span>${apt.service.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Sous-total</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxe (10%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-blue-600">${grandTotal.toFixed(2)}</span>
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
              Création en cours...
            </>
          ) : (
            submitButtonText
          )}
        </Button>
      </div>
    </form>
  );
}
