'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

export interface SessionNoteFormData {
  presentingConcerns?: string;
  sessionGoals?: string;
  observations?: string;
  interventions?: string;
  patientResponse?: string;
  homework?: string;
  treatmentPlan?: string;
  progressNotes?: string;
  neuroFeedbackMetrics?: {
    baseline?: any;
    results?: any;
    improvements?: string;
  };
  followUpNotes?: string;
  nextSessionDate?: string;
  billable?: boolean;
}

interface SessionNoteFormProps {
  initialData?: SessionNoteFormData;
  isLoading?: boolean;
  onSubmit: (data: SessionNoteFormData) => Promise<void>;
  submitButtonText?: string;
}

export default function SessionNoteForm({
  initialData,
  isLoading = false,
  onSubmit,
  submitButtonText = 'Enregistrer la note de séance',
}: SessionNoteFormProps) {
  const [formData, setFormData] = useState<SessionNoteFormData>(
    initialData || {
      presentingConcerns: '',
      sessionGoals: '',
      observations: '',
      interventions: '',
      patientResponse: '',
      homework: '',
      treatmentPlan: '',
      progressNotes: '',
      neuroFeedbackMetrics: {
        baseline: '',
        results: '',
        improvements: '',
      },
      followUpNotes: '',
      nextSessionDate: '',
      billable: true,
    }
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleInputChange = (field: string, value: any, parent?: string) => {
    setError('');
    if (parent) {
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof SessionNoteFormData] as any),
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

      {/* Contenu de la séance */}
      <Card>
        <CardHeader>
          <CardTitle>Contenu de la séance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Préoccupations présentées</FieldLabel>
            <Textarea
              value={formData.presentingConcerns || ''}
              onChange={(e) => handleInputChange('presentingConcerns', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="Quelles préoccupations le patient a-t-il présentées au cours de cette séance ?"
            />
          </Field>

          <Field>
            <FieldLabel>Objectifs de la séance</FieldLabel>
            <Textarea
              value={formData.sessionGoals || ''}
              onChange={(e) => handleInputChange('sessionGoals', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="Quels étaient les objectifs de cette séance ?"
            />
          </Field>

          <Field>
            <FieldLabel>Observations</FieldLabel>
            <Textarea
              value={formData.observations || ''}
              onChange={(e) => handleInputChange('observations', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="Documentez vos observations au cours de la séance..."
            />
          </Field>

          <Field>
            <FieldLabel>Interventions utilisées</FieldLabel>
            <Textarea
              value={formData.interventions || ''}
              onChange={(e) => handleInputChange('interventions', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="Quelles interventions ou techniques ont été utilisées ?"
            />
          </Field>

          <Field>
            <FieldLabel>Réponse du patient</FieldLabel>
            <Textarea
              value={formData.patientResponse || ''}
              onChange={(e) => handleInputChange('patientResponse', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="Comment le client a-t-il réagi aux interventions ?"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Métriques de neurofeedback */}
      <Card>
        <CardHeader>
          <CardTitle>Métriques de neurofeedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Ligne de base</FieldLabel>
            <Textarea
              value={formData.neuroFeedbackMetrics?.baseline || ''}
              onChange={(e) => handleInputChange('baseline', e.target.value, 'neuroFeedbackMetrics')}
              disabled={isFormLoading}
              rows={2}
              placeholder="Mesures ou métriques initiales..."
            />
          </Field>

          <Field>
            <FieldLabel>Résultats</FieldLabel>
            <Textarea
              value={formData.neuroFeedbackMetrics?.results || ''}
              onChange={(e) => handleInputChange('results', e.target.value, 'neuroFeedbackMetrics')}
              disabled={isFormLoading}
              rows={2}
              placeholder="Résultats de séance ou mesures..."
            />
          </Field>

          <Field>
            <FieldLabel>Améliorations</FieldLabel>
            <Textarea
              value={formData.neuroFeedbackMetrics?.improvements || ''}
              onChange={(e) => handleInputChange('improvements', e.target.value, 'neuroFeedbackMetrics')}
              disabled={isFormLoading}
              rows={2}
              placeholder="Améliorations ou changements notables..."
            />
          </Field>
        </CardContent>
      </Card>

      {/* Plan de traitement et suivi */}
      <Card>
        <CardHeader>
          <CardTitle>Plan de traitement et suivi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Plan de traitement</FieldLabel>
            <Textarea
              value={formData.treatmentPlan || ''}
              onChange={(e) => handleInputChange('treatmentPlan', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="Plan de traitement actuel ou recommandations..."
            />
          </Field>

          <Field>
            <FieldLabel>Devoirs / Assignments</FieldLabel>
            <Textarea
              value={formData.homework || ''}
              onChange={(e) => handleInputChange('homework', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="Tout devoir ou assignment pour le patient..."
            />
          </Field>

          <Field>
            <FieldLabel>Notes de progrès</FieldLabel>
            <Textarea
              value={formData.progressNotes || ''}
              onChange={(e) => handleInputChange('progressNotes', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="Progrès général et mises à jour..."
            />
          </Field>

          <Field>
            <FieldLabel>Notes de suivi</FieldLabel>
            <Textarea
              value={formData.followUpNotes || ''}
              onChange={(e) => handleInputChange('followUpNotes', e.target.value)}
              disabled={isFormLoading}
              rows={2}
              placeholder="Tout suivi nécessaire..."
            />
          </Field>

          <Field>
            <FieldLabel>Date de la prochaine séance</FieldLabel>
            <input
              type="date"
              value={formData.nextSessionDate || ''}
              onChange={(e) => handleInputChange('nextSessionDate', e.target.value)}
              disabled={isFormLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Facturation */}
      <Card>
        <CardHeader>
          <CardTitle>Facturation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Checkbox
              id="billable"
              checked={formData.billable !== false}
              onCheckedChange={(checked) => handleInputChange('billable', checked)}
              disabled={isFormLoading}
            />
            <label htmlFor="billable" className="text-sm font-medium cursor-pointer">
              Marquer cette séance comme facturable
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
