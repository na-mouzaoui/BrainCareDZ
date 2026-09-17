'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('psy');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password && password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password && password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setIsLoading(true);

    try {
      const success = await register(firstName, lastName, password || undefined, role);
      if (success) {
        router.push('/dashboard');
      } else {
        setError('L\'enregistrement a échoué. Ce pseudo est peut-être déjà utilisé.');
      }
    } catch (err) {
      setError('Une erreur s\'est produite. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  }

  const previewPseudo = (firstName && lastName)
    ? `${firstName.toLowerCase()}_${lastName.toLowerCase()}`
    : '';

  return (
    <div className="min-h-dvh flex items-start sm:items-center justify-center bg-gradient-to-br from-brand-50 to-white p-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl sm:text-2xl font-bold">Créer un compte</CardTitle>
          <CardDescription>
            Enregistrez votre compte de pratique psychologique
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
              <FieldLabel>Prénom</FieldLabel>
              <Input
                type="text"
                placeholder="Jean"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                disabled={isLoading}
              />
            </Field>

            <Field>
              <FieldLabel>Nom</FieldLabel>
              <Input
                type="text"
                placeholder="Dupont"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                disabled={isLoading}
              />
            </Field>

            {previewPseudo && (
              <div className="text-sm text-gray-500 bg-gray-50 border rounded px-3 py-2">
                Pseudo généré : <span className="font-medium text-gray-700">{previewPseudo}</span>
              </div>
            )}

            <Field>
              <FieldLabel>Rôle</FieldLabel>
              <Select value={role} onValueChange={setRole} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="psy">Psy</SelectItem>
                  <SelectItem value="coach">Coach</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Mot de passe (optionnel)</FieldLabel>
              <Input
                type="password"
                placeholder="Laisser vide pour 123456789"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </Field>

            <Field>
              <FieldLabel>Confirmer le mot de passe</FieldLabel>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
            </Field>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" />
                  Création du compte...
                </>
              ) : (
                'Créer un compte'
              )}
            </Button>

            <div className="text-center text-sm">
              <span className="text-gray-600">Déjà inscrit? </span>
              <Link
                href="/auth/login"
                className="text-blue-600 hover:underline font-medium"
              >
                Se connecter
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
