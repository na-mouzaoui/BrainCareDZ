'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from './api';

export interface User {
  id: string;
  name: string;
  pseudo: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'psy' | 'coach';
  mustChangePassword?: boolean;
}

interface AuthResult {
  success: boolean;
  error?: string;
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionExpired: boolean;
  login: (pseudo: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    // 401 renvoyé par une requête quelconque (cookie expiré, session révoquée par
    // un logout sur un autre appareil, compte supprimé) : on vide la session, ce
    // qui fait rediriger les pages vers /login par leur garde existante.
    const handleExpired = () => {
      setUser(null);
      setToken(null);
      setSessionExpired(true);
    };
    // Mot de passe provisoire : le serveur refuse les routes métier (403).
    const handlePasswordChangeRequired = () => {
      setUser((prev) => (prev ? { ...prev, mustChangePassword: true } : prev));
    };
    window.addEventListener('auth:expired', handleExpired);
    window.addEventListener('auth:password-change-required', handlePasswordChangeRequired);
    return () => {
      window.removeEventListener('auth:expired', handleExpired);
      window.removeEventListener('auth:password-change-required', handlePasswordChangeRequired);
    };
  }, []);

  useEffect(() => {
    const hydrateUser = async () => {
      // Le token est stocké dans un cookie httpOnly : on ne peut que le valider côté serveur.
      const response = await auth.getMe();
      if (response.success && response.data) {
        setUser(response.data as User);
        setToken('cookie');
      } else {
        setUser(null);
        setToken(null);
      }

      setIsLoading(false);
    };

    void hydrateUser();
  }, []);

  const login = async (pseudo: string, password: string): Promise<AuthResult> => {
    try {
      const response = await auth.login(pseudo, password);
      if (response.success && response.data) {
        const loggedUser = response.data as User;
        setToken('cookie');
        setUser(loggedUser);
        setSessionExpired(false);
        return { success: true, mustChangePassword: loggedUser.mustChangePassword === true };
      }
      const errorMessage = response.error || response.message || 'Pseudo ou mot de passe invalide';
      return { success: false, error: errorMessage };
    } catch (error) {
      return {
        success: false,
        error: 'Impossible de contacter le serveur API. Vérifiez que le backend tourne sur le port 5001.',
      };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
    try {
      const response = await auth.changePassword(currentPassword, newPassword);
      if (response.success) {
        setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
        return { success: true };
      }
      return { success: false, error: response.error || response.message || 'Échec du changement de mot de passe.' };
    } catch {
      return { success: false, error: 'Impossible de contacter le serveur API.' };
    }
  };

  const logout = async () => {
    try {
      await auth.logout();
    } catch {
      // On nettoie l'état local même si l'appel réseau échoue.
    }
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
        sessionExpired,
        login,
        logout,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
