'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface PatientFormData {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  age?: number;
  gender?: string;
  phone: string;
  email: string;
  maritalStatus?: string;
  hasChildren?: boolean;
  childrenCount?: number;
  profession?: string;
  educationLevel?: string;
  socioCategory?: string;
  patientType?: string;
  showParentInfo?: boolean;
  parentName?: string;
  parentRelationship?: string;
  consultationReasons?: string[];
  difficultyDuration?: string;
  previousConsultation?: boolean;
  previousType?: string;
  currentFollowUp?: boolean;
  followUpDetails?: string;
  sourceOfAcquisition?: string;
  sourceDetails?: string;
  firstContactDate?: string;
  firstAppointmentDate?: string;
  appointmentFrequency?: string;
  plannedSessions?: number;
  completedSessions?: number;
  status?: string;
  abandonReason?: string;
  perceivedImprovement?: number;
  observedChanges?: string;
  improvementStartMonth?: number;
  globalSatisfaction?: number;
  wouldRecommend?: boolean;
}

interface PatientFormProps {
  initialData?: PatientFormData;
  isLoading?: boolean;
  onSubmit: (data: PatientFormData) => Promise<void>;
  submitButtonText?: string;
}

const STEPS = [
  { id: 1, title: 'Identité', requiredFields: ['firstName', 'lastName', 'phone'] },
  { id: 2, title: 'Situation', requiredFields: [] },
  { id: 3, title: 'Motif', requiredFields: [] },
  { id: 4, title: 'Historique', requiredFields: [] },
  { id: 5, title: 'Source', requiredFields: [] },
  { id: 6, title: 'Évolution', requiredFields: [] },
];

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

function validateStep(stepId: number, formData: PatientFormData): ValidationResult {
  const errors: string[] = [];
  
  switch (stepId) {
    case 1:
      if (!formData.firstName?.trim()) {
        errors.push('Le prénom est obligatoire');
      }
      if (!formData.lastName?.trim()) {
        errors.push('Le nom est obligatoire');
      }
      if (!formData.phone?.trim()) {
        errors.push('Le téléphone est obligatoire');
      } else if (!/^[\d\s\-\+\(\)]{8,}$/.test(formData.phone)) {
        errors.push('Le numéro de téléphone n\'est pas valide');
      }
      break;
      
    case 3:
      if (!formData.consultationReasons || formData.consultationReasons.length === 0) {
        errors.push('Veuillez sélectionner au moins un motif de consultation');
      }
      break;
  }
  
  return { isValid: errors.length === 0, errors };
}

export default function PatientForm({
  initialData,
  isLoading = false,
  onSubmit,
  submitButtonText = 'Enregistrer le patient',
}: PatientFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<PatientFormData>(
    initialData || {
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      consultationReasons: [],
      impactedDomains: [],
      initialBarriers: [],
      wouldRecommend: false,
      followsInstagram: false,
      consultedContentBefore: false,
      showParentInfo: false,
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
      } else if (age >= 12 && age < 18) {
        newData.patientType = 'Adolescent';
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

    const validation = validateStep(currentStep, formData);
    if (!validation.isValid) {
      setError(validation.errors.join('. '));
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

  const validation = useMemo(() => validateStep(currentStep, formData), [currentStep, formData]);

  const goToNextStep = () => {
    const currentValidation = validateStep(currentStep, formData);
    
    if (!currentValidation.isValid) {
      setError(currentValidation.errors.join('. '));
      return;
    }
    
    setError('');
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPrevStep = () => {
    setError('');
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>1. IDENTITÉ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Prénom *</FieldLabel>
                  <Input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    disabled={isFormLoading}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>Nom *</FieldLabel>
                  <Input
                    type="text"
                    value={formData.lastName}
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
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={isFormLoading}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={isFormLoading}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card>
            <CardHeader>
              <CardTitle>2. SITUATION PERSONNELLE</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                        disabled={isFormLoading}
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
                        disabled={isFormLoading}
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
                        disabled={isFormLoading}
                        className="w-24"
                      />
                    </Field>
                  )}
                </div>
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Profession</FieldLabel>
                  <Input
                    type="text"
                    value={formData.profession || ''}
                    onChange={(e) => handleInputChange('profession', e.target.value)}
                    disabled={isFormLoading}
                  />
                </Field>
                <Field>
                  <FieldLabel>Niveau d'étude</FieldLabel>
                  <Input
                    type="text"
                    value={formData.educationLevel || ''}
                    onChange={(e) => handleInputChange('educationLevel', e.target.value)}
                    disabled={isFormLoading}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel>Catégorie socio-professionnelle (optionnel)</FieldLabel>
                <Input
                  type="text"
                  value={formData.socioCategory || ''}
                  onChange={(e) => handleInputChange('socioCategory', e.target.value)}
                  disabled={isFormLoading}
                />
              </Field>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card>
            <CardHeader>
              <CardTitle>3. MOTIF DE CONSULTATION</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field>
                <FieldLabel>Motif principal (choix multiple possible) *</FieldLabel>
                <div className="space-y-3">
                  {[
                    'Anxiété',
                    'Stress / burn-out',
                    'Troubles du sommeil',
                    'Troubles de l\'attention (TDAH)',
                    'Difficultés émotionnelles',
                    'Problèmes scolaires',
                    'Troubles du comportement',
                    'TSA / Autisme',
                    'Troubles psychosomatiques',
                  ].map((reason) => (
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
                  <Field>
                    <Input
                      type="text"
                      placeholder="Autre : ..."
                      value={formData.sourceDetails || ''}
                      onChange={(e) => handleInputChange('sourceDetails', e.target.value)}
                      disabled={isFormLoading}
                    />
                  </Field>
                </div>
              </Field>
            </CardContent>
          </Card>
        );

      case 4:
        return (
          <Card>
            <CardHeader>
              <CardTitle>4. HISTORIQUE</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  {formData.previousConsultation && (
                    <Input
                      type="text"
                      placeholder="Type : ..."
                      value={formData.previousType || ''}
                      onChange={(e) => handleInputChange('previousType', e.target.value)}
                      disabled={isFormLoading}
                      className="flex-1"
                    />
                  )}
                </div>
              </Field>
              <Field>
                <FieldLabel>Suivi en cours (psy, médecin…) ?</FieldLabel>
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
                  {formData.currentFollowUp && (
                    <Input
                      type="text"
                      placeholder="Préciser : ..."
                      value={formData.followUpDetails || ''}
                      onChange={(e) => handleInputChange('followUpDetails', e.target.value)}
                      disabled={isFormLoading}
                      className="flex-1"
                    />
                  )}
                </div>
              </Field>
            </CardContent>
          </Card>
        );

      case 5:
        return (
          <Card>
            <CardHeader>
              <CardTitle>5. SOURCE D'ACQUISITION</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="recommendation">Recommandation</SelectItem>
                    <SelectItem value="doctor">Médecin</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="school">École / professionnel</SelectItem>
                    <SelectItem value="conference">Conférence / atelier</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {(formData.sourceOfAcquisition === 'recommendation' ||
                formData.sourceOfAcquisition === 'doctor' ||
                formData.sourceOfAcquisition === 'other') && (
                <Field>
                  <FieldLabel>Préciser</FieldLabel>
                  <Input
                    type="text"
                    value={formData.sourceDetails || ''}
                    onChange={(e) => handleInputChange('sourceDetails', e.target.value)}
                    disabled={isFormLoading}
                    placeholder={formData.sourceOfAcquisition === 'recommendation' ? 'Par qui ?' : formData.sourceOfAcquisition === 'doctor' ? 'Nom du médecin' : 'Veuillez préciser'}
                  />
                </Field>
              )}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {STEPS.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => setCurrentStep(step.id)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              currentStep === step.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {step.id}. {step.title}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {renderStepContent()}
      </div>

      <div className="flex gap-2 justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={goToPrevStep}
          disabled={currentStep === 1 || isFormLoading}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Précédent
        </Button>

        {currentStep === STEPS.length ? (
          <Button
            type="submit"
            disabled={isFormLoading}
            className="gap-2"
          >
            {isFormLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              submitButtonText
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={goToNextStep}
            disabled={isFormLoading}
          >
            Suivant
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </form>
  );
}