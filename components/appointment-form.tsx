'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { patients as patientsApi, services as servicesApi, appointments as appointmentsApi, users as usersApi, patientPacks } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PatientSearchSelect } from '@/components/patient-search-select';

export interface AppointmentFormData {
  serviceId: string;
  startTime: string;
  endTime: string;
  patientIds: string[];
  practitionerId?: string;
  preferredRole?: 'admin' | 'psy' | 'coach';
  packDeferred?: boolean;
  title?: string;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  balance?: number;
  sessionCount?: number;
  consecutiveNoShows?: number;
}

interface Practitioner {
  id: string;
  name: string;
  role?: string;
}

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
  sessions?: number;
  type?: string;
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
  showSubmitButton?: boolean;
}

export default function AppointmentForm({
  initialData,
  isLoading = false,
  onSubmit,
  submitButtonText = 'Planifier le rendez-vous',
  showSubmitButton = true,
}: AppointmentFormProps) {
  const [formData, setFormData] = useState<AppointmentFormData>(
    initialData || {
      serviceId: '',
      startTime: '',
      endTime: '',
      patientIds: [],
    }
  );
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [practitionersList, setPractitionersList] = useState<Practitioner[]>([]);
  const [patientPacksList, setPatientPacksList] = useState<{ serviceId: string; serviceName: string; remainingSessions: number; totalSessions: number }[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [isPersonal, setIsPersonal] = useState(false);
  const { user } = useAuth();

  const validPatients = useMemo(() => uniqueById(patientsList), [patientsList]);
  const validServices = useMemo(() => uniqueById(servicesList), [servicesList]);
  const filteredServices = useMemo(() => {
    if (formData.preferredRole === 'admin' || formData.preferredRole === 'psy') {
      return validServices.filter((s) => s.type === 'psy');
    }
    return validServices;
  }, [validServices, formData.preferredRole]);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadPatientsAndServices();
  }, []);

  // Fetch patient packs when a patient is selected
  useEffect(() => {
    const selectedId = formData.patientIds?.[0];
    if (!selectedId) {
      setPatientPacksList([]);
      return;
    }
    patientPacks.getByPatient(selectedId).then((res) => {
      if (res.success && res.data) {
        setPatientPacksList(res.data.packs || []);
      } else {
        setPatientPacksList([]);
      }
    }).catch(() => setPatientPacksList([]));
  }, [formData.patientIds?.[0]]);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  // Default practitioner = current user (non-modifiable for psy/admin calendars)
  useEffect(() => {
    if (formData.preferredRole === 'coach') return;
    if (!user) return;
    setFormData((prev) => ({
      ...prev,
      practitionerId: user.id,
    }));
  }, [user, formData.preferredRole]);

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
      const [patientsRes, servicesRes, practitionersRes] = await Promise.all([
        patientsApi.getAll(),
        servicesApi.getAll(),
        usersApi.getPractitioners(),
      ]);

      if (patientsRes.success && patientsRes.data) {
        setPatientsList(Array.isArray(patientsRes.data) ? patientsRes.data : patientsRes.data.patients || []);
      }
      if (servicesRes.success && servicesRes.data) {
        setServicesList(Array.isArray(servicesRes.data) ? servicesRes.data : servicesRes.data.services || []);
      }
      if (practitionersRes.success && practitionersRes.data) {
        setPractitionersList(
          Array.isArray(practitionersRes.data)
            ? practitionersRes.data
            : practitionersRes.data.practitioners || []
        );
      }
    } catch (err) {
      console.error('Failed to load form data:', err);
      setError('Erreur lors du chargement des données. Vérifiez votre connexion.');
    } finally {
      setLoadingData(false);
    }
  }

  const selectSinglePatient = (value: string) => {
    setError('');
    setFormData((prev) => ({
      ...prev,
      patientIds: [value],
    }));
  };

  const handleInputChange = (field: keyof AppointmentFormData, value: string) => {
    setError('');
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const effectiveIds = formData.patientIds || [];
    if (!isPersonal && effectiveIds.length === 0) {
      setError('Veuillez sélectionner au moins un patient');
      return;
    }
    if (!isPersonal && !formData.packDeferred && !formData.serviceId) {
      setError('Veuillez sélectionner un service');
      return;
    }
    if (isPersonal && !formData.title?.trim()) {
      setError('Veuillez saisir un titre pour le RDV personnel');
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
      const submitData: AppointmentFormData = {
        ...formData,
        patientIds: effectiveIds,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        title: isPersonal ? formData.title?.trim() : undefined,
      };
      if (formData.preferredRole) {
        (submitData as any).role = formData.preferredRole;
      }
      await onSubmit(submitData);
    } catch (err) {
      console.error('Appointment submit error:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue lors de la sauvegarde');
    } finally {
      setSubmitting(false);
    }
  };

  const isFormLoading = isLoading || submitting || loadingData;
  const selectedService = validServices.find((s) => s.id === formData.serviceId);
  const selectedPatient = validPatients.find((p) => p.id === formData.patientIds?.[0]);
  const patientBalance = Number(selectedPatient?.balance ?? 0);
  const servicePricePerSession = selectedService
    ? (Number(selectedService.price ?? 0) / (Number(selectedService.sessions ?? 1) || 1))
    : 0;
  const hasInsufficientBalance = !!selectedPatient && !!selectedService && patientBalance < servicePricePerSession;

  return (
    <form id="appointment-form" onSubmit={handleSubmit} className="space-y-6">
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
          {isAdmin && formData.preferredRole === 'admin' && (
            <div className="flex items-start gap-2 rounded-lg border border-dashed border-brand-200 bg-brand-50/50 p-3">
              <Checkbox
                id="personal-appointment"
                checked={isPersonal}
                onCheckedChange={(checked) => {
                  const val = checked === true;
                  setIsPersonal(val);
                  if (val) {
                    setFormData((prev) => ({
                      ...prev,
                      patientIds: [],
                      serviceId: '',
                    }));
                  }
                }}
                disabled={isFormLoading}
              />
              <label htmlFor="personal-appointment" className="text-sm text-gray-700 cursor-pointer leading-snug">
                RDV personnel (sans patient)
              </label>
            </div>
          )}

          {isPersonal ? (
            <Field>
              <FieldLabel>Titre du RDV *</FieldLabel>
              <Input
                value={formData.title || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Réunion, Pause, RDV perso..."
                disabled={isFormLoading}
                required
              />
            </Field>
          ) : (
            <>
            <Field>
              <FieldLabel>Patient *</FieldLabel>
              <PatientSearchSelect
                patients={validPatients}
                value={formData.patientIds[0]}
                onSelect={(id) => {
                  setFormData((prev) => ({
                    ...prev,
                    patientIds: [id],
                  }));
                }}
                placeholder={validPatients.length === 0 ? 'Aucun patient créé' : 'Sélectionner un patient'}
                disabled={isFormLoading}
              />
            </Field>

          <Field>
            <FieldLabel>Service {formData.packDeferred ? '(optionnel — choisi après la séance)' : '*'}</FieldLabel>
            <Select
              value={formData.serviceId}
              onValueChange={(value) => handleInputChange('serviceId', value)}
              disabled={isFormLoading || !!formData.packDeferred}
            >
              <SelectTrigger>
                <SelectValue placeholder={formData.packDeferred ? 'Service sélectionné après la séance' : 'Sélectionner un service'} />
              </SelectTrigger>
              <SelectContent>
                {patientPacksList.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50">
                      Packs en cours
                    </div>
                    {patientPacksList.map((pack) => (
                      <SelectItem key={`active-${pack.serviceId}`} value={pack.serviceId}>
                        {pack.serviceName} — {pack.remainingSessions}/{pack.totalSessions} séances restantes
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 mt-1">
                      Autres services
                    </div>
                  </>
                )}
                {filteredServices
                  .filter((service) => !patientPacksList.some((p) => p.serviceId === service.id))
                  .map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} — {Number(service.price).toLocaleString('fr-FR')} DZD
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="flex items-start gap-2 rounded-lg border border-dashed border-brand-200 bg-brand-50/50 p-3">
            <Checkbox
              id="pack-deferred"
              checked={!!formData.packDeferred}
              onCheckedChange={(checked) => {
                const deferred = checked === true;
                setFormData((prev) => ({
                  ...prev,
                  packDeferred: deferred,
                  serviceId: deferred ? '' : prev.serviceId,
                }));
              }}
              disabled={isFormLoading}
            />
            <label htmlFor="pack-deferred" className="text-sm text-gray-700 cursor-pointer leading-snug">
              Sélectionner le pack après la séance (premier rendez-vous d'un nouveau patient)
            </label>
          </div>

          {isAdmin && formData.preferredRole !== 'coach' && (
            <Field>
              <FieldLabel>Praticien</FieldLabel>
              <Input
                value={practitionersList.find((p) => p.id === formData.practitionerId)?.name || user?.name || ''}
                disabled
                className="bg-gray-50"
              />
            </Field>
          )}

          {formData.preferredRole === 'coach' && (
            <p className="text-sm text-gray-500">
              Aucun praticien n'est assigné : il sera défini à la rédaction du compte rendu.
            </p>
          )}

          {hasInsufficientBalance && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Solde insuffisant pour ce patient. Solde actuel: {patientBalance.toLocaleString('fr-FR')} DZD, coût de la séance: {servicePricePerSession.toLocaleString('fr-FR')} DZD.
              </AlertDescription>
            </Alert>
          )}
          </>
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
        </CardContent>
      </Card>

      {/* Submit Button */}
      {showSubmitButton && (
        <div className="flex gap-2 justify-end">
          <Button
            type="submit"
            disabled={isFormLoading}
            className="gap-2"
          >
            {isFormLoading ? (
              <>
                <Spinner size="sm" />
              </>
            ) : (
              submitButtonText
            )}
          </Button>
        </div>
      )}
    </form>
  );
}
