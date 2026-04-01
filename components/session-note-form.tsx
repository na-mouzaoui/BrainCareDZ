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
  clientResponse?: string;
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
  submitButtonText = 'Save Session Note',
}: SessionNoteFormProps) {
  const [formData, setFormData] = useState<SessionNoteFormData>(
    initialData || {
      presentingConcerns: '',
      sessionGoals: '',
      observations: '',
      interventions: '',
      clientResponse: '',
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

      {/* Session Content */}
      <Card>
        <CardHeader>
          <CardTitle>Session Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Presenting Concerns</FieldLabel>
            <Textarea
              value={formData.presentingConcerns || ''}
              onChange={(e) => handleInputChange('presentingConcerns', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="What concerns did the client present with during this session?"
            />
          </Field>

          <Field>
            <FieldLabel>Session Goals</FieldLabel>
            <Textarea
              value={formData.sessionGoals || ''}
              onChange={(e) => handleInputChange('sessionGoals', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="What were the goals for this session?"
            />
          </Field>

          <Field>
            <FieldLabel>Observations</FieldLabel>
            <Textarea
              value={formData.observations || ''}
              onChange={(e) => handleInputChange('observations', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="Document your observations during the session..."
            />
          </Field>

          <Field>
            <FieldLabel>Interventions Used</FieldLabel>
            <Textarea
              value={formData.interventions || ''}
              onChange={(e) => handleInputChange('interventions', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="What interventions or techniques were used?"
            />
          </Field>

          <Field>
            <FieldLabel>Client Response</FieldLabel>
            <Textarea
              value={formData.clientResponse || ''}
              onChange={(e) => handleInputChange('clientResponse', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="How did the client respond to the interventions?"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Neurofeedback Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Neurofeedback Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Baseline</FieldLabel>
            <Textarea
              value={formData.neuroFeedbackMetrics?.baseline || ''}
              onChange={(e) => handleInputChange('baseline', e.target.value, 'neuroFeedbackMetrics')}
              disabled={isFormLoading}
              rows={2}
              placeholder="Initial metrics or measurements..."
            />
          </Field>

          <Field>
            <FieldLabel>Results</FieldLabel>
            <Textarea
              value={formData.neuroFeedbackMetrics?.results || ''}
              onChange={(e) => handleInputChange('results', e.target.value, 'neuroFeedbackMetrics')}
              disabled={isFormLoading}
              rows={2}
              placeholder="Session results or measurements..."
            />
          </Field>

          <Field>
            <FieldLabel>Improvements</FieldLabel>
            <Textarea
              value={formData.neuroFeedbackMetrics?.improvements || ''}
              onChange={(e) => handleInputChange('improvements', e.target.value, 'neuroFeedbackMetrics')}
              disabled={isFormLoading}
              rows={2}
              placeholder="Notable improvements or changes..."
            />
          </Field>
        </CardContent>
      </Card>

      {/* Treatment & Follow-up */}
      <Card>
        <CardHeader>
          <CardTitle>Treatment Plan & Follow-up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Treatment Plan</FieldLabel>
            <Textarea
              value={formData.treatmentPlan || ''}
              onChange={(e) => handleInputChange('treatmentPlan', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="Current treatment plan or recommendations..."
            />
          </Field>

          <Field>
            <FieldLabel>Homework / Assignments</FieldLabel>
            <Textarea
              value={formData.homework || ''}
              onChange={(e) => handleInputChange('homework', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="Any homework or assignments for the client..."
            />
          </Field>

          <Field>
            <FieldLabel>Progress Notes</FieldLabel>
            <Textarea
              value={formData.progressNotes || ''}
              onChange={(e) => handleInputChange('progressNotes', e.target.value)}
              disabled={isFormLoading}
              rows={3}
              placeholder="Overall progress and updates..."
            />
          </Field>

          <Field>
            <FieldLabel>Follow-up Notes</FieldLabel>
            <Textarea
              value={formData.followUpNotes || ''}
              onChange={(e) => handleInputChange('followUpNotes', e.target.value)}
              disabled={isFormLoading}
              rows={2}
              placeholder="Any follow-up needed..."
            />
          </Field>

          <Field>
            <FieldLabel>Next Session Date</FieldLabel>
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

      {/* Billing */}
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
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
              Mark this session as billable
            </label>
          </div>
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
