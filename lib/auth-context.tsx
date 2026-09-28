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
}

interface AuthResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (pseudo: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        setToken('cookie');
        setUser(response.data as User);
        return { success: true };
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
        login,
        logout,
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
