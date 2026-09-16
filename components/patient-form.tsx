'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ALGERIAN_WILAYAS } from '@/lib/communes';
import { getPatientLists, DEFAULT_LISTS, type PatientLists } from '@/lib/patient-lists';
import { AlertCircle, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface PatientFormData {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  age?: number;
  gender?: string;
  phone: string;
  email: string;
  commune?: string;
  maritalStatus?: string;
  hasChildren?: boolean;
  childrenCount?: number;
  profession?: string;
  patientType?: string;
  consultationReasons?: string[];
  difficultyDuration?: string;
  previousConsultation?: boolean;
  previousType?: string;
  previousNeurofeedback?: boolean;
  currentFollowUp?: boolean;
  sourceOfAcquisition?: string;
  sourceDetails?: string;
  sourceSub?: string;
  sourceAccount?: string;
  firstContactDate?: string;
  firstAppointmentDate?: string;
  abandonReason?: string;
  perceivedImprovement?: number;
  observedChanges?: string;
  globalSatisfaction?: number;
  wouldRecommend?: boolean;
}

interface PatientFormProps {
  initialData?: PatientFormData;
  isLoading?: boolean;
  onSubmit?: (data: PatientFormData) => Promise<void>;
  submitButtonText?: string;
  readOnly?: boolean;
  hideSteps?: boolean;
  defaultStep?: number;
}

const STEPS = [
  { id: 1, title: 'Identité', requiredFields: ['firstName', 'lastName', 'phone'] },
  { id: 2, title: 'Situation', requiredFields: [] },
  { id: 3, title: 'Motif', requiredFields: [] },
  { id: 4, title: 'Historique', requiredFields: [] },
  { id: 5, title: 'Source', requiredFields: [] },
];

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeInitialData(data: PatientFormData): PatientFormData {
  return {
    ...data,
    dateOfBirth: toDateInputValue(data.dateOfBirth),
    firstContactDate: toDateInputValue(data.firstContactDate),
    firstAppointmentDate: toDateInputValue(data.firstAppointmentDate),
  };
}

function validateStep(stepId: number, formData: PatientFormData): ValidationResult {
  const errors: string[] = [];
  
  switch (stepId) {
    case 1:
      if (!formData.firstName?.trim()) errors.push('Le prénom est obligatoire');
      if (!formData.lastName?.trim()) errors.push('Le nom est obligatoire');
      if (!formData.phone?.trim()) errors.push('Le téléphone est obligatoire');
      else if (!/^[\d\s\-\+\(\)]{8,}$/.test(formData.phone)) errors.push('Le numéro de téléphone n\'est pas valide');
      break;
  }
  
  return { isValid: errors.length === 0, errors };
}

export function PatientForm({
  initialData,
  isLoading = false,
  onSubmit,
  submitButtonText = 'Enregistrer le patient',
  readOnly = false,
  hideSteps = false,
  defaultStep,
}: PatientFormProps) {
  const [currentStep, setCurrentStep] = useState(defaultStep || 1);
  const [completedUpToStep, setCompletedUpToStep] = useState(initialData ? STEPS.length : 0);
  const [formData, setFormData] = useState<PatientFormData>(
    initialData || {
      firstName: '', lastName: '', dateOfBirth: '', age: undefined, gender: '',
      phone: '', email: '', commune: '',
      maritalStatus: '', hasChildren: false, childrenCount: undefined,
      profession: '', patientType: '',
      consultationReasons: [], difficultyDuration: '',
      previousConsultation: false, previousType: '', previousNeurofeedback: false, currentFollowUp: false,
      sourceOfAcquisition: '', sourceDetails: '', sourceSub: '', sourceAccount: '', firstContactDate: '', firstAppointmentDate: '',
      abandonReason: '',
      perceivedImprovement: undefined, observedChanges: '',
      globalSatisfaction: undefined, wouldRecommend: false,
    }
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lists, setLists] = useState<PatientLists>(DEFAULT_LISTS);

  useEffect(() => {
    let active = true;
    getPatientLists().then((loaded) => {
      if (active) setLists(loaded);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData(normalizeInitialData(initialData));
    }
  }, [initialData]);

  const handleInputChange = (field: string, value: any) => {
    setError('');
    const newData: any = { ...formData, [field]: value };
    
    if (field === 'dateOfBirth' && value) {
      const birthDate = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      newData.age = age;
      
      if (age < 12) {
        newData.patientType = 'Enfant';
        newData.hasChildren = false;
        newData.childrenCount = 0;
        newData.maritalStatus = 'Célibataire';
      } else if (age >= 12 && age < 18) {
        newData.patientType = 'Adolescent';
        newData.hasChildren = false;
        newData.childrenCount = 0;
        newData.maritalStatus = 'Célibataire';
      } else {
        newData.patientType = 'Adulte';
      }
    }
    
    setFormData(newData);
  };

  const handleCheckboxChange = (field: string, value: string) => {
    const arr = (formData[field as keyof PatientFormData] as string[]) || [];
    const newArr = arr.includes(value)
      ? arr.filter((item) => item !== value)
      : [...arr, value];
    handleInputChange(field, newArr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const allErrors: string[] = [];
    for (let i = 1; i <= STEPS.length; i++) {
      const validation = validateStep(i, formData);
      if (!validation.isValid) {
        allErrors.push(...validation.errors);
      }
    }
    if (allErrors.length > 0) {
      setError(allErrors.join('. '));
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

  const isFormLoading = isLoading || submitting || readOnly;

  const validation = useMemo(() => validateStep(currentStep, formData), [currentStep, formData]);

  const isMinor =
    formData.patientType === 'Enfant' ||
    formData.patientType === 'Adolescent' ||
    (formData.age !== undefined && formData.age < 18);

  const visibleSteps = isMinor ? STEPS.filter((s) => s.id !== 2) : STEPS;
  const currentStepIndex = visibleSteps.findIndex((s) => s.id === currentStep);

  const goToNextStep = () => {
    const currentValidation = validateStep(currentStep, formData);
    
    if (!currentValidation.isValid) {
      setError(currentValidation.errors.join('. '));
      return;
    }
    
    setError('');
    setCompletedUpToStep(Math.max(completedUpToStep, currentStep));
    const next = visibleSteps[currentStepIndex + 1];
    if (next) {
      setCurrentStep(next.id);
    }
  };

  const goToPrevStep = () => {
    setError('');
    if (currentStepIndex > 0) {
      setCurrentStep(visibleSteps[currentStepIndex - 1].id);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Identité</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Prénom *</FieldLabel>
                <Input
                  type="text"
                  value={formData.firstName || ''}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  disabled={isFormLoading}
                  required
                />
              </Field>
              <Field>
                <FieldLabel>Nom *</FieldLabel>
                <Input
                  type="text"
                  value={formData.lastName || ''}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  disabled={isFormLoading}
                  required
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field>
                <FieldLabel>Date de naissance</FieldLabel>
                <Input
                  type="date"
                  value={formData.dateOfBirth || ''}
                  onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  disabled={isFormLoading}
                />
              </Field>
              <Field>
                <FieldLabel>Âge</FieldLabel>
                <p className="text-lg font-medium py-2">
                  {formData.age ? `${formData.age} ans (${formData.patientType || '-'})` : '-'}
                </p>
              </Field>
              <Field>
                <FieldLabel>Sexe</FieldLabel>
                <div className="flex gap-4 py-2">
                  {[
                    { value: 'male', label: 'Homme' },
                    { value: 'female', label: 'Femme' },
                  ].map((gender) => (
                    <div key={gender.value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        id={`gender-${gender.value}`}
                        name="gender"
                        value={gender.value}
                        checked={formData.gender === gender.value}
                        onChange={(e) => handleInputChange('gender', e.target.value)}
                      disabled={isFormLoading}
                      />
                      <label htmlFor={`gender-${gender.value}`} className="text-sm cursor-pointer">{gender.label}</label>
                    </div>
                  ))}
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Téléphone *</FieldLabel>
                <Input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  disabled={isFormLoading}
                  required
                />
              </Field>
              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={isFormLoading}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Commune</FieldLabel>
              <Select
                value={formData.commune || ''}
                onValueChange={(value) => handleInputChange('commune', value)}
                disabled={isFormLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez une wilaya" />
                </SelectTrigger>
                <SelectContent>
                  {ALGERIAN_WILAYAS.map((wilaya) => (
                    <SelectItem key={wilaya} value={wilaya}>{wilaya}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Situation personnelle</h3>
            <Field>
              <FieldLabel>Situation familiale</FieldLabel>
              <div className="flex flex-wrap gap-4">
                {['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf(ve)'].map((status) => (
                  <div key={status} className="flex items-center gap-2">
                    <input
                      type="radio"
                      id={`marital-${status}`}
                      name="maritalStatus"
                      value={status}
                      checked={formData.maritalStatus === status}
                      onChange={(e) => handleInputChange('maritalStatus', e.target.value)}
                      disabled={isFormLoading || (formData.age !== undefined && formData.age < 18)}
                    />
                    <label htmlFor={`marital-${status}`} className="text-sm cursor-pointer">{status}</label>
                  </div>
                ))}
              </div>
            </Field>
            <Field>
              <FieldLabel>Enfants</FieldLabel>
              <div className="flex items-center gap-4">
                {['Non', 'Oui'].map((option) => (
                  <div key={option} className="flex items-center gap-2">
                    <input
                      type="radio"
                      id={`children-${option}`}
                      name="hasChildren"
                      value={option === 'Oui'}
                      checked={formData.hasChildren === (option === 'Oui')}
                      onChange={(e) => handleInputChange('hasChildren', e.target.value === 'true')}
                      disabled={isFormLoading || (formData.age !== undefined && formData.age < 18)}
                    />
                    <label htmlFor={`children-${option}`} className="text-sm cursor-pointer">{option}</label>
                  </div>
                ))}
                {formData.hasChildren && (
                  <Field>
                    <Input
                      type="number"
                      placeholder="Nombre"
                      value={formData.childrenCount || ''}
                      onChange={(e) => handleInputChange('childrenCount', e.target.value ? parseInt(e.target.value) : undefined)}
                      disabled={isFormLoading || (formData.age !== undefined && formData.age < 18)}
                      className="w-24"
                    />
                  </Field>
                )}
                {formData.age !== undefined && formData.age < 18 && (
                  <span className="text-xs text-gray-400">Non applicable (mineur)</span>
                )}
              </div>
            </Field>
            <Field>
              <FieldLabel>Profession</FieldLabel>
              <Select
                value={
                  lists.professions.includes(formData.profession || '')
                    ? formData.profession
                    : formData.profession
                      ? 'autre'
                      : ''
                }
                onValueChange={(value) => {
                  if (value === 'autre') {
                    handleInputChange('profession', '');
                  } else {
                    handleInputChange('profession', value);
                  }
                }}
                disabled={isFormLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez une profession" />
                </SelectTrigger>
                <SelectContent>
                  {lists.professions.map((profession) => (
                    <SelectItem key={profession} value={profession}>{profession}</SelectItem>
                  ))}
                  <SelectItem value="autre">Autre...</SelectItem>
                </SelectContent>
              </Select>
              {formData.profession && !lists.professions.includes(formData.profession) && (
                <Input
                  type="text"
                  className="mt-2"
                  value={formData.profession}
                  onChange={(e) => handleInputChange('profession', e.target.value)}
                  disabled={isFormLoading}
                />
              )}
            </Field>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Motif de consultation</h3>
            <Field>
              <FieldLabel>Motif principal (choix multiple possible) *</FieldLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {lists.motifs.map((reason) => (
                  <div key={reason} className="flex items-center gap-2">
                    <Checkbox
                      id={`reason-${reason}`}
                      checked={(formData.consultationReasons || []).includes(reason)}
                      onCheckedChange={() => handleCheckboxChange('consultationReasons', reason)}
                      disabled={isFormLoading}
                    />
                    <label htmlFor={`reason-${reason}`} className="text-sm cursor-pointer">{reason}</label>
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <Input
                  type="text"
                  placeholder="Autre motif..."
                  value={formData.sourceDetails || ''}
                  onChange={(e) => handleInputChange('sourceDetails', e.target.value)}
                  disabled={isFormLoading}
                />
              </div>
            </Field>
          </div>
        );

      case 4:
        return (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Historique</h3>
            <Field>
              <FieldLabel>Depuis combien de temps dure la difficulté ?</FieldLabel>
              <Select
                value={formData.difficultyDuration || ''}
                onValueChange={(value) => handleInputChange('difficultyDuration', value)}
                disabled={isFormLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="less-6m">&lt; 6 mois</SelectItem>
                  <SelectItem value="6-12m">6-12 mois</SelectItem>
                  <SelectItem value="1-3y">1-3 ans</SelectItem>
                  <SelectItem value="more-3y">&gt; 3 ans</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Avez-vous déjà testé le NeuroFeedback ?</FieldLabel>
              <div className="flex items-center gap-4">
                {['Non', 'Oui'].map((option) => (
                  <div key={option} className="flex items-center gap-2">
                    <input
                      type="radio"
                      id={`neurofeedback-${option}`}
                      name="previousNeurofeedback"
                      checked={formData.previousNeurofeedback === (option === 'Oui')}
                      onChange={() => handleInputChange('previousNeurofeedback', option === 'Oui')}
                      disabled={isFormLoading}
                    />
                    <label htmlFor={`neurofeedback-${option}`} className="text-sm cursor-pointer">{option}</label>
                  </div>
                ))}
              </div>
            </Field>
            <Field>
              <FieldLabel>Avez-vous déjà consulté ?</FieldLabel>
              <div className="flex items-center gap-4">
                {['Non', 'Oui'].map((option) => (
                  <div key={option} className="flex items-center gap-2">
                    <input
                      type="radio"
                      id={`consultation-${option}`}
                      name="previousConsultation"
                      checked={formData.previousConsultation === (option === 'Oui')}
                      onChange={() => handleInputChange('previousConsultation', option === 'Oui')}
                      disabled={isFormLoading}
                    />
                    <label htmlFor={`consultation-${option}`} className="text-sm cursor-pointer">{option}</label>
                  </div>
                ))}
              </div>
            </Field>
            {formData.previousConsultation && (
              <>
                <Field>
                  <FieldLabel>Suit-il toujours un professionnel ?</FieldLabel>
                  <div className="flex items-center gap-4">
                    {['Non', 'Oui'].map((option) => (
                      <div key={option} className="flex items-center gap-2">
                        <input
                          type="radio"
                          id={`followup-${option}`}
                          name="currentFollowUp"
                          checked={formData.currentFollowUp === (option === 'Oui')}
                          onChange={() => handleInputChange('currentFollowUp', option === 'Oui')}
                          disabled={isFormLoading}
                        />
                        <label htmlFor={`followup-${option}`} className="text-sm cursor-pointer">{option}</label>
                      </div>
                    ))}
                  </div>
                </Field>
                {formData.currentFollowUp && (
                  <Field>
                    <FieldLabel>Chez qui ?</FieldLabel>
                    <Select
                      value={formData.previousType || ''}
                      onValueChange={(value) => handleInputChange('previousType', value)}
                      disabled={isFormLoading}
                    >
                      <SelectTrigger className="w-full sm:w-64">
                        <SelectValue placeholder="Type de professionnel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="psy">Psy</SelectItem>
                        <SelectItem value="psychiatre">Psychiatre</SelectItem>
                        <SelectItem value="coach">Coach</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Source d'acquisition</h3>
            <Field>
              <FieldLabel>Comment avez-vous connu le cabinet ?</FieldLabel>
              <Select
                value={formData.sourceOfAcquisition || ''}
                onValueChange={(value) => handleInputChange('sourceOfAcquisition', value)}
                disabled={isFormLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="social">Réseaux sociaux</SelectItem>
                  <SelectItem value="recommendation">Recommandation</SelectItem>
                  <SelectItem value="doctor">Médecin</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="school">École / professionnel</SelectItem>
                  <SelectItem value="conference">Conférence / atelier</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {formData.sourceOfAcquisition === 'social' && (
              <>
                <Field>
                  <FieldLabel>Quel réseau social ?</FieldLabel>
                  <Select
                    value={formData.sourceSub || ''}
                    onValueChange={(value) => handleInputChange('sourceSub', value)}
                    disabled={isFormLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="x">X</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {formData.sourceSub === 'instagram' && (
                  <Field>
                    <FieldLabel>Sur quel compte ?</FieldLabel>
                    <Select
                      value={formData.sourceAccount || ''}
                      onValueChange={(value) => handleInputChange('sourceAccount', value)}
                      disabled={isFormLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sabrina">Sabrina</SelectItem>
                        <SelectItem value="braincare">BrainCare</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </>
            )}
            {formData.sourceOfAcquisition === 'doctor' && (
              <Field>
                <FieldLabel>Spécialité du médecin</FieldLabel>
                <Select
                  value={formData.sourceDetails || ''}
                  onValueChange={(value) => handleInputChange('sourceDetails', value)}
                  disabled={isFormLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medecin">Médecin</SelectItem>
                    <SelectItem value="psychologue">Psychologue</SelectItem>
                    <SelectItem value="psychiatre">Psychiatre</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            {(formData.sourceOfAcquisition === 'recommendation' ||
              formData.sourceOfAcquisition === 'other') && (
              <Field>
                <FieldLabel>Préciser</FieldLabel>
                <Input
                  type="text"
                  value={formData.sourceDetails || ''}
                  onChange={(e) => handleInputChange('sourceDetails', e.target.value)}
                  disabled={isFormLoading}
                  placeholder={formData.sourceOfAcquisition === 'recommendation' ? 'Par qui ?' : 'Veuillez préciser'}
                />
              </Field>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const showNavigation = !readOnly;
  const Container = readOnly ? 'div' : 'form';

  return (
    <Container onSubmit={readOnly ? undefined : handleSubmit}>
      {error && (
        <Alert variant="destructive" className="m-6 mb-0">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Progress steps */}
      {!hideSteps && (
      <div className="px-6 pt-4 pb-2 border-b">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          {visibleSteps.map((step, idx) => (
            <div key={step.id} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => {
                  if (step.id !== currentStep) {
                    setError('');
                    if (!readOnly) {
                      const currentValidation = validateStep(currentStep, formData);
                      if (!currentValidation.isValid) {
                        setError(currentValidation.errors.join('. '));
                        return;
                      }
                    }
                  }
                  setCurrentStep(step.id);
                }}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  currentStep === step.id ? 'text-brand-700' :
                  currentStepIndex > idx ? 'text-brand-600' : 'text-gray-400'
                }`}
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  currentStep === step.id ? 'border-brand-700 bg-brand-50 text-brand-700' :
                  currentStepIndex > idx ? 'border-brand-600 bg-brand-600 text-white' :
                  'border-gray-300 text-gray-400'
                }`}>
                  {currentStepIndex > idx ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </span>
                <span className="hidden sm:inline">{step.title}</span>
              </button>
              {idx < visibleSteps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 transition-colors ${
                  currentStepIndex > idx ? 'bg-brand-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>
      )}

      <div className="px-6 py-4 min-h-[280px]">
        {renderStepContent()}
      </div>

      {showNavigation && (
        <div className="px-6 pb-6 flex gap-2 justify-between border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={goToPrevStep}
            disabled={currentStep === 1 || isFormLoading}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Précédent
          </Button>

          {currentStepIndex === visibleSteps.length - 1 ? (
            <Button
              type="submit"
              disabled={isFormLoading}
              className="gap-2 bg-brand-700 hover:bg-brand-800"
            >
              {isFormLoading ? (
                <Spinner size="sm" />
              ) : (
                submitButtonText
              )}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isFormLoading}
                className="gap-2 bg-brand-700 hover:bg-brand-800"
              >
                {isFormLoading ? (
                  <Spinner size="sm" />
                ) : (
                  submitButtonText
                )}
              </Button>
              <Button
                type="button"
                onClick={goToNextStep}
                disabled={isFormLoading}
                className="bg-brand-700 hover:bg-brand-800"
              >
                Suivant
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      )}
    </Container>
  );
}

function ReadOnlyForm({ initialData }: { initialData?: PatientFormData }) {
  return <PatientForm initialData={initialData} onSubmit={async () => {}} readOnly />;
}

export { ReadOnlyForm };
export default PatientForm;