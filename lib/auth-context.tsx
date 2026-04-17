'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from './api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'practitioner' | 'receptionist';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string, role?: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token and user from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token');

    const hydrateUser = async () => {
      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      setToken(savedToken);
      const response = await auth.getMe();
      if (response.success && response.data) {
        setUser(response.data as User);
      } else {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      }

      setIsLoading(false);
    };

    void hydrateUser();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await auth.login(email, password);
      if (response.success && response.token && response.data) {
        localStorage.setItem('token', response.token);
        setToken(response.token);
        setUser(response.data as User);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const register = async (name: string, email: string, password: string, role?: string): Promise<boolean> => {
    try {
      const response = await auth.register(name, email, password, role);
      if (response.success && response.token && response.data) {
        localStorage.setItem('token', response.token);
        setToken(response.token);
        setUser(response.data as User);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Registration failed:', error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
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
        register,
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
