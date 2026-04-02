'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface ClientFormData {
  // 1. IDENTITÉ
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  age?: number;
  gender?: string;
  phone: string;
  email: string;
  city?: string;
  distance?: string;

  // 2. SITUATION PERSONNELLE
  maritalStatus?: string;
  hasChildren?: boolean;
  childrenCount?: number;
  profession?: string;
  educationLevel?: string;
  socioCategory?: string;

  // 3. TYPE DE PATIENT
  patientType?: string;
  parentName?: string;
  parentRelationship?: string;

  // 4. MOTIF DE CONSULTATION
  consultationReasons?: string[];

  // 5. HISTORIQUE
  difficultyDuration?: string;
  previousConsultation?: boolean;
  previousType?: string;
  currentFollowUp?: boolean;
  followUpDetails?: string;

  // 6. INTENSITÉ & IMPACT
  problemIntensity?: number;
  dailyLifeImpact?: number;
  impactedDomains?: string[];

  // 7. OBJECTIFS
  mainObjective?: string;
  secondaryObjectives?: string;
  neurofeedbackExpectations?: string;

  // 8. SOURCE D'ACQUISITION
  sourceOfAcquisition?: string;
  sourceDetails?: string;

  // 9. PARCOURS PATIENT
  firstContactDate?: string;
  firstAppointmentDate?: string;
  appointmentFrequency?: string;
  plannedSessions?: number;
  completedSessions?: number;
  status?: string;
  abandonReason?: string;

  // 10. ÉVOLUTION & RÉSULTATS
  perceivedImprovement?: number;
  observedChanges?: string;
  improvementStartMonth?: number;
  globalSatisfaction?: number;
  wouldRecommend?: boolean;

  // 11. FREINS & OBJECTIONS
  initialBarriers?: string[];
  barrierDetails?: string;

  // 12. ENGAGEMENT & ADHÉSION
  motivation?: number;
  assiduity?: string;
  processInvolvement?: string;

  // 13. DONNÉES NEUROFEEDBACK
  protocolType?: string;
  totalNFSessions?: number;
  protocolResponse?: string;

  // 14. MARKETING & COMMUNICATION
  followsInstagram?: boolean;
  consultedContentBefore?: boolean;

  // 15. CONSENTEMENT
  consentAnonData?: boolean;
  consentRecontact?: boolean;
  consentTestimony?: boolean;
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
  submitButtonText = 'Enregistrer le patient',
}: ClientFormProps) {
  const [formData, setFormData] = useState<ClientFormData>(
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
    
    // Auto-calculate age if dateOfBirth changes
    if (field === 'dateOfBirth' && value) {
      const birthDate = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      newData.age = age;
    }
    
    setFormData(newData);
  };

  const handleCheckboxChange = (field: string, value: string) => {
    const arr = (formData[field as keyof ClientFormData] as string[]) || [];
    const newArr = arr.includes(value)
      ? arr.filter((item) => item !== value)
      : [...arr, value];
    handleInputChange(field, newArr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.firstName.trim()) {
      setError('Le prénom est requis');
      return;
    }
    if (!formData.lastName.trim()) {
      setError('Le nom est requis');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Le téléphone est requis');
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 1. IDENTITÉ */}
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
              <Input
                type="number"
                value={formData.age || ''}
                disabled={true}
                className="bg-gray-100 cursor-not-allowed"
              />
            </Field>
            <Field>
              <FieldLabel>Sexe</FieldLabel>
              <Select
                value={formData.gender || ''}
                onValueChange={(value) => handleInputChange('gender', value)}
                disabled={isFormLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Homme</SelectItem>
                  <SelectItem value="female">Femme</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Ville / Commune</FieldLabel>
              <Input
                type="text"
                value={formData.city || ''}
                onChange={(e) => handleInputChange('city', e.target.value)}
                disabled={isFormLoading}
              />
            </Field>
            <Field>
              <FieldLabel>Distance approximative du cabinet</FieldLabel>
              <Input
                type="text"
                value={formData.distance || ''}
                onChange={(e) => handleInputChange('distance', e.target.value)}
                disabled={isFormLoading}
                placeholder="ex: 10 km"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* 2. SITUATION PERSONNELLE */}
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

      {/* 3. TYPE DE PATIENT */}
      <Card>
        <CardHeader>
          <CardTitle>3. TYPE DE PATIENT</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <div className="flex flex-wrap gap-4">
              {['Adulte', 'Enfant', 'Adolescent'].map((type) => (
                <div key={type} className="flex items-center gap-2">
                  <input
                    type="radio"
                    id={`patientType-${type}`}
                    name="patientType"
                    value={type}
                    checked={formData.patientType === type}
                    onChange={(e) => handleInputChange('patientType', e.target.value)}
                    disabled={isFormLoading}
                  />
                  <label htmlFor={`patientType-${type}`} className="text-sm cursor-pointer">{type}</label>
                </div>
              ))}
            </div>
          </Field>

          {(formData.patientType === 'Enfant' || formData.patientType === 'Adolescent') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <Field>
                <FieldLabel>Nom du parent accompagnant</FieldLabel>
                <Input
                  type="text"
                  value={formData.parentName || ''}
                  onChange={(e) => handleInputChange('parentName', e.target.value)}
                  disabled={isFormLoading}
                />
              </Field>
              <Field>
                <FieldLabel>Lien avec l'enfant</FieldLabel>
                <Input
                  type="text"
                  value={formData.parentRelationship || ''}
                  onChange={(e) => handleInputChange('parentRelationship', e.target.value)}
                  disabled={isFormLoading}
                />
              </Field>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. MOTIF DE CONSULTATION */}
      <Card>
        <CardHeader>
          <CardTitle>4. MOTIF DE CONSULTATION</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Motif principal (choix multiple possible)</FieldLabel>
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

      {/* 5. HISTORIQUE */}
      <Card>
        <CardHeader>
          <CardTitle>5. HISTORIQUE</CardTitle>
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

      {/* 6. INTENSITÉ & IMPACT */}
      <Card>
        <CardHeader>
          <CardTitle>6. INTENSITÉ & IMPACT</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Intensité du problème (0 à 10)</FieldLabel>
              <Input
                type="number"
                min="0"
                max="10"
                value={formData.problemIntensity || ''}
                onChange={(e) => handleInputChange('problemIntensity', e.target.value ? parseInt(e.target.value) : undefined)}
                disabled={isFormLoading}
              />
            </Field>
            <Field>
              <FieldLabel>Impact sur la vie quotidienne (0 à 10)</FieldLabel>
              <Input
                type="number"
                min="0"
                max="10"
                value={formData.dailyLifeImpact || ''}
                onChange={(e) => handleInputChange('dailyLifeImpact', e.target.value ? parseInt(e.target.value) : undefined)}
                disabled={isFormLoading}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Domaines impactés</FieldLabel>
            <div className="space-y-3">
              {[
                'Travail / école',
                'Sommeil',
                'Relations',
                'Estime de soi',
                'Émotions',
              ].map((domain) => (
                <div key={domain} className="flex items-center gap-2">
                  <Checkbox
                    id={`domain-${domain}`}
                    checked={(formData.impactedDomains || []).includes(domain)}
                    onCheckedChange={() => handleCheckboxChange('impactedDomains', domain)}
                    disabled={isFormLoading}
                  />
                  <label htmlFor={`domain-${domain}`} className="text-sm cursor-pointer">{domain}</label>
                </div>
              ))}
            </div>
          </Field>
        </CardContent>
      </Card>

      {/* 7. OBJECTIFS DU PATIENT */}
      <Card>
        <CardHeader>
          <CardTitle>7. OBJECTIFS DU PATIENT</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Objectif principal</FieldLabel>
            <Textarea
              value={formData.mainObjective || ''}
              onChange={(e) => handleInputChange('mainObjective', e.target.value)}
              disabled={isFormLoading}
              rows={2}
            />
          </Field>
          <Field>
            <FieldLabel>Objectifs secondaires</FieldLabel>
            <Textarea
              value={formData.secondaryObjectives || ''}
              onChange={(e) => handleInputChange('secondaryObjectives', e.target.value)}
              disabled={isFormLoading}
              rows={2}
            />
          </Field>
          <Field>
            <FieldLabel>Attentes vis-à-vis du neurofeedback</FieldLabel>
            <Textarea
              value={formData.neurofeedbackExpectations || ''}
              onChange={(e) => handleInputChange('neurofeedbackExpectations', e.target.value)}
              disabled={isFormLoading}
              rows={2}
            />
          </Field>
        </CardContent>
      </Card>

      {/* 8. SOURCE D'ACQUISITION */}
      <Card>
        <CardHeader>
          <CardTitle>8. SOURCE D'ACQUISITION</CardTitle>
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
                placeholder={
                  formData.sourceOfAcquisition === 'recommendation'
                    ? 'Par qui ?'
                    : formData.sourceOfAcquisition === 'doctor'
                    ? 'Nom du médecin'
                    : 'Veuillez préciser'
                }
              />
            </Field>
          )}
        </CardContent>
      </Card>

      {/* 9. PARCOURS PATIENT */}
      <Card>
        <CardHeader>
          <CardTitle>9. PARCOURS PATIENT</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Date du premier contact</FieldLabel>
              <Input
                type="date"
                value={formData.firstContactDate || ''}
                onChange={(e) => handleInputChange('firstContactDate', e.target.value)}
                disabled={isFormLoading}
              />
            </Field>
            <Field>
              <FieldLabel>Date du premier rendez-vous</FieldLabel>
              <Input
                type="date"
                value={formData.firstAppointmentDate || ''}
                onChange={(e) => handleInputChange('firstAppointmentDate', e.target.value)}
                disabled={isFormLoading}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Fréquence des séances</FieldLabel>
            <Select
              value={formData.appointmentFrequency || ''}
              onValueChange={(value) => handleInputChange('appointmentFrequency', value)}
              disabled={isFormLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-week">1x/semaine</SelectItem>
                <SelectItem value="2-week">2x/semaine</SelectItem>
                <SelectItem value="irregular">Irrégulier</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Nombre de séances prévues</FieldLabel>
              <Input
                type="number"
                value={formData.plannedSessions || ''}
                onChange={(e) => handleInputChange('plannedSessions', e.target.value ? parseInt(e.target.value) : undefined)}
                disabled={isFormLoading}
              />
            </Field>
            <Field>
              <FieldLabel>Nombre de séances réalisées</FieldLabel>
              <Input
                type="number"
                value={formData.completedSessions || ''}
                onChange={(e) => handleInputChange('completedSessions', e.target.value ? parseInt(e.target.value) : undefined)}
                disabled={isFormLoading}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Statut</FieldLabel>
            <Select
              value={formData.status || ''}
              onValueChange={(value) => handleInputChange('status', value)}
              disabled={isFormLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ongoing">En cours</SelectItem>
                <SelectItem value="completed">Terminé</SelectItem>
                <SelectItem value="abandoned">Abandon</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {formData.status === 'abandoned' && (
            <Field>
              <FieldLabel>Raison de l'abandon</FieldLabel>
              <Select
                value={formData.abandonReason || ''}
                onValueChange={(value) => handleInputChange('abandonReason', value)}
                disabled={isFormLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="financial">Financier</SelectItem>
                  <SelectItem value="time">Manque de temps</SelectItem>
                  <SelectItem value="results">Manque de résultats</SelectItem>
                  <SelectItem value="demotivation">Démotivation</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </CardContent>
      </Card>

      {/* 10. ÉVOLUTION & RÉSULTATS */}
      <Card>
        <CardHeader>
          <CardTitle>10. ÉVOLUTION & RÉSULTATS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Amélioration perçue (0 à 10)</FieldLabel>
              <Input
                type="number"
                min="0"
                max="10"
                value={formData.perceivedImprovement || ''}
                onChange={(e) => handleInputChange('perceivedImprovement', e.target.value ? parseInt(e.target.value) : undefined)}
                disabled={isFormLoading}
              />
            </Field>
            <Field>
              <FieldLabel>Satisfaction globale (0 à 10)</FieldLabel>
              <Input
                type="number"
                min="0"
                max="10"
                value={formData.globalSatisfaction || ''}
                onChange={(e) => handleInputChange('globalSatisfaction', e.target.value ? parseInt(e.target.value) : undefined)}
                disabled={isFormLoading}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Changements observés</FieldLabel>
            <Textarea
              value={formData.observedChanges || ''}
              onChange={(e) => handleInputChange('observedChanges', e.target.value)}
              disabled={isFormLoading}
              rows={2}
            />
          </Field>

          <Field>
            <FieldLabel>À partir de combien de séances ?</FieldLabel>
            <Input
              type="number"
              value={formData.improvementStartMonth || ''}
              onChange={(e) => handleInputChange('improvementStartMonth', e.target.value ? parseInt(e.target.value) : undefined)}
              disabled={isFormLoading}
            />
          </Field>

          <Field>
            <FieldLabel>Recommanderiez-vous le cabinet ?</FieldLabel>
            <div className="flex items-center gap-4">
              {['Oui', 'Non'].map((option) => (
                <div key={option} className="flex items-center gap-2">
                  <input
                    type="radio"
                    id={`recommend-${option}`}
                    name="wouldRecommend"
                    checked={formData.wouldRecommend === (option === 'Oui')}
                    onChange={() => handleInputChange('wouldRecommend', option === 'Oui')}
                    disabled={isFormLoading}
                  />
                  <label htmlFor={`recommend-${option}`} className="text-sm cursor-pointer">{option}</label>
                </div>
              ))}
            </div>
          </Field>
        </CardContent>
      </Card>

      {/* 11. FREINS & OBJECTIONS */}
      <Card>
        <CardHeader>
          <CardTitle>11. FREINS & OBJECTIONS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Avant de commencer, qu'est-ce qui vous a freiné ?</FieldLabel>
            <div className="space-y-3">
              {['Prix', 'Doute sur l\'efficacité', 'Peur / appréhension', 'Manque d\'information'].map((barrier) => (
                <div key={barrier} className="flex items-center gap-2">
                  <Checkbox
                    id={`barrier-${barrier}`}
                    checked={(formData.initialBarriers || []).includes(barrier)}
                    onCheckedChange={() => handleCheckboxChange('initialBarriers', barrier)}
                    disabled={isFormLoading}
                  />
                  <label htmlFor={`barrier-${barrier}`} className="text-sm cursor-pointer">{barrier}</label>
                </div>
              ))}
            </div>
          </Field>

          <Field>
            <FieldLabel>Préciser</FieldLabel>
            <Input
              type="text"
              value={formData.barrierDetails || ''}
              onChange={(e) => handleInputChange('barrierDetails', e.target.value)}
              disabled={isFormLoading}
              placeholder="Autre : ..."
            />
          </Field>
        </CardContent>
      </Card>

      {/* 12. ENGAGEMENT & ADHÉSION */}
      <Card>
        <CardHeader>
          <CardTitle>12. ENGAGEMENT & ADHÉSION</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Motivation (0 à 10)</FieldLabel>
            <Input
              type="number"
              min="0"
              max="10"
              value={formData.motivation || ''}
              onChange={(e) => handleInputChange('motivation', e.target.value ? parseInt(e.target.value) : undefined)}
              disabled={isFormLoading}
            />
          </Field>

          <Field>
            <FieldLabel>Assiduité</FieldLabel>
            <Select
              value={formData.assiduity || ''}
              onValueChange={(value) => handleInputChange('assiduity', value)}
              disabled={isFormLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strong">Forte</SelectItem>
                <SelectItem value="average">Moyenne</SelectItem>
                <SelectItem value="weak">Faible</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Implication dans le processus</FieldLabel>
            <Textarea
              value={formData.processInvolvement || ''}
              onChange={(e) => handleInputChange('processInvolvement', e.target.value)}
              disabled={isFormLoading}
              rows={2}
            />
          </Field>
        </CardContent>
      </Card>

      {/* 13. DONNÉES NEUROFEEDBACK */}
      <Card>
        <CardHeader>
          <CardTitle>13. DONNÉES NEUROFEEDBACK (OPTIONNEL)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Type de protocole utilisé</FieldLabel>
            <Input
              type="text"
              value={formData.protocolType || ''}
              onChange={(e) => handleInputChange('protocolType', e.target.value)}
              disabled={isFormLoading}
            />
          </Field>

          <Field>
            <FieldLabel>Nombre total de séances</FieldLabel>
            <Input
              type="number"
              value={formData.totalNFSessions || ''}
              onChange={(e) => handleInputChange('totalNFSessions', e.target.value ? parseInt(e.target.value) : undefined)}
              disabled={isFormLoading}
            />
          </Field>

          <Field>
            <FieldLabel>Réponse au protocole</FieldLabel>
            <Select
              value={formData.protocolResponse || ''}
              onValueChange={(value) => handleInputChange('protocolResponse', value)}
              disabled={isFormLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rapid">Rapide</SelectItem>
                <SelectItem value="progressive">Progressive</SelectItem>
                <SelectItem value="weak">Faible</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      {/* 14. MARKETING & COMMUNICATION */}
      <Card>
        <CardHeader>
          <CardTitle>14. MARKETING & COMMUNICATION</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="follows-instagram"
              checked={formData.followsInstagram || false}
              onCheckedChange={(checked) => handleInputChange('followsInstagram', checked)}
              disabled={isFormLoading}
            />
            <label htmlFor="follows-instagram" className="text-sm cursor-pointer">
              Suit le cabinet sur Instagram
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="consulted-content"
              checked={formData.consultedContentBefore || false}
              onCheckedChange={(checked) => handleInputChange('consultedContentBefore', checked)}
              disabled={isFormLoading}
            />
            <label htmlFor="consulted-content" className="text-sm cursor-pointer">
              A consulté du contenu avant de venir
            </label>
          </div>
        </CardContent>
      </Card>

      {/* 15. CONSENTEMENT */}
      <Card>
        <CardHeader>
          <CardTitle>15. CONSENTEMENT</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="consent-anon"
              checked={formData.consentAnonData || false}
              onCheckedChange={(checked) => handleInputChange('consentAnonData', checked)}
              disabled={isFormLoading}
            />
            <label htmlFor="consent-anon" className="text-sm cursor-pointer">
              J\'accepte que mes données soient utilisées de manière anonyme à des fins d\'analyse
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="consent-recontact"
              checked={formData.consentRecontact || false}
              onCheckedChange={(checked) => handleInputChange('consentRecontact', checked)}
              disabled={isFormLoading}
            />
            <label htmlFor="consent-recontact" className="text-sm cursor-pointer">
              J\'accepte d\'être recontacté(e)
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="consent-testimony"
              checked={formData.consentTestimony || false}
              onCheckedChange={(checked) => handleInputChange('consentTestimony', checked)}
              disabled={isFormLoading}
            />
            <label htmlFor="consent-testimony" className="text-sm cursor-pointer">
              J\'accepte de laisser un témoignage anonymisé
            </label>
          </div>
        </CardContent>
      </Card>

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
