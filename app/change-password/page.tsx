'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PasswordInput } from '@/components/ui/password-input';
import { AlertCircle, ShieldCheck } from 'lucide-react';

/**
 * Écran bloquant affiché à la première connexion : le mot de passe provisoire
 * (`123456789`) doit être remplacé avant tout accès aux données.
 */
export default function ChangePasswordPage() {
  const { changePassword, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les deux saisies du nouveau mot de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.success) {
        router.replace('/');
      } else {
        setError(result.error || 'Échec du changement de mot de passe.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-brand-50 to-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-700" />
            Changement de mot de passe requis
          </CardTitle>
          <CardDescription>
            Votre compte utilise encore le mot de passe provisoire. Choisissez un mot de passe
            personnel pour accéder à l&apos;application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Field>
              <FieldLabel>Mot de passe provisoire</FieldLabel>
              <PasswordInput
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isSubmitting || authLoading}
              />
            </Field>

            <Field>
              <FieldLabel>Nouveau mot de passe</FieldLabel>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                disabled={isSubmitting || authLoading}
              />
              <p className="text-xs text-gray-500 mt-1">8 caractères minimum, différent du mot de passe provisoire.</p>
            </Field>

            <Field>
              <FieldLabel>Confirmer le nouveau mot de passe</FieldLabel>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={isSubmitting || authLoading}
              />
            </Field>

            <Button type="submit" className="w-full bg-brand-700 hover:bg-brand-800" disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement…' : 'Changer mon mot de passe'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={async () => {
                await logout();
                router.replace('/login');
              }}
              disabled={isSubmitting}
            >
              Se déconnecter
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
