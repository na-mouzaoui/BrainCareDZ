'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { patients as patientsApi, services as servicesApi, appointments as appointmentsApi } from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';

export interface AppointmentFormData {
  patientId: string;
  serviceId: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  balance?: number;
}

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
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
      patientId: '',
      serviceId: '',
      startTime: '',
      endTime: '',
      notes: '',
    }
  );
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const validPatients = useMemo(() => uniqueById(patientsList), [patientsList]);
  const validServices = useMemo(() => uniqueById(servicesList), [servicesList]);

  useEffect(() => {
    loadPatientsAndServices();
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  // Auto-calculate end time when start time and service change
  useEffect(() => {
    if (formData.startTime && formData.serviceId) {
      const selectedService = validServices.find((s) => s.id === formData.serviceId);
      if (selectedService && selectedService.duration) {
        const startDate = new Date(formData.startTime);
        if (isNaN(startDate.getTime())) return;
        const endDate = new Date(startDate.getTime() + selectedService.duration * 60000);
        if (isNaN(endDate.getTime())) return;
        setFormData((prev) => ({
          ...prev,
          endTime: endDate.toISOString().slice(0, 16),
        }));
      }
    }
  }, [formData.startTime, formData.serviceId, validServices]);

  async function loadPatientsAndServices() {
    try {
      const [patientsRes, servicesRes] = await Promise.all([
        patientsApi.getAll(),
        servicesApi.getAll(),
      ]);

      if (patientsRes.success && patientsRes.data) {
        setPatientsList(Array.isArray(patientsRes.data) ? patientsRes.data : patientsRes.data.patients || []);
      }
      if (servicesRes.success && servicesRes.data) {
        setServicesList(Array.isArray(servicesRes.data) ? servicesRes.data : servicesRes.data.services || []);
      }
    } catch (err) {
      setError('Failed to load patients and services');
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
    if (!formData.patientId) {
      setError('Veuillez sélectionner un patient');
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

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      setError('Dates invalides');
      return;
    }

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
  const selectedService = validServices.find((s) => s.id === formData.serviceId);
  const selectedPatient = validPatients.find((p) => p.id === formData.patientId);
  const patientBalance = Number(selectedPatient?.balance ?? 0);
  const servicePrice = Number(selectedService?.price ?? 0);
  const hasInsufficientBalance = !!selectedPatient && !!selectedService && patientBalance < servicePrice;

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
            <FieldLabel>Patient *</FieldLabel>
            <Select
              value={formData.patientId}
              onValueChange={(value) => handleInputChange('patientId', value)}
              disabled={isFormLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={validPatients.length === 0 ? "Aucun patient créé" : "Sélectionner un patient"} />
              </SelectTrigger>
              <SelectContent>
                {validPatients.length === 0 ? (
                  <div className="p-2 text-sm text-gray-500">
                    Aucun patient disponible. Créez d'abord un patient.
                  </div>
                ) : (
                  validPatients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.firstName} {patient.lastName}
                    </SelectItem>
                  ))
                )}
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
                {validServices.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} ({service.duration} min) - {Number(service.price).toFixed(2)} DZD
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {hasInsufficientBalance && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Solde insuffisant pour ce patient. Solde actuel: {patientBalance.toFixed(2)} DZD, coût de la séance: {servicePrice.toFixed(2)} DZD.
              </AlertDescription>
            </Alert>
          )}

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
                {Number(selectedService.price).toFixed(2)} DZD
              </span>
            </div>
            {selectedPatient && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Solde patient :</span>
                <span className={`font-semibold ${hasInsufficientBalance ? 'text-red-600' : 'text-emerald-700'}`}>
                  {patientBalance.toFixed(2)} DZD
                </span>
              </div>
            )}
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
