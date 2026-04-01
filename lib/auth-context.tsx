'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from './api';

const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const DEMO_USERS = [
  { id: 'demo-admin', name: 'Demo Admin', email: 'admin@demo.local', role: 'admin' as const },
  { id: 'demo-prac', name: 'Demo Practitioner', email: 'test@demo.local', role: 'practitioner' as const },
  { id: 'demo-rec', name: 'Demo Reception', email: 'reception@demo.local', role: 'receptionist' as const },
];
const DEMO_PASSWORD = 'demo123';

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
    const savedDemoUser = localStorage.getItem('demo_user');

    if (savedToken) {
      setToken(savedToken);
      if (savedDemoUser) {
        try {
          setUser(JSON.parse(savedDemoUser));
        } catch {
          setUser(null);
        }
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      if (IS_DEMO_MODE) {
        const foundUser = DEMO_USERS.find((u) => u.email === email.toLowerCase());
        if (!foundUser || password !== DEMO_PASSWORD) {
          return false;
        }

        localStorage.setItem('token', 'demo-token');
        localStorage.setItem('demo_user', JSON.stringify(foundUser));
        setToken('demo-token');
        setUser(foundUser);
        return true;
      }

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
      if (IS_DEMO_MODE) {
        const demoUser: User = {
          id: `demo-${Date.now()}`,
          name,
          email: email.toLowerCase(),
          role: (role as User['role']) || 'practitioner',
        };

        localStorage.setItem('token', 'demo-token');
        localStorage.setItem('demo_user', JSON.stringify(demoUser));
        setToken('demo-token');
        setUser(demoUser);
        return true;
      }

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
    localStorage.removeItem('demo_user');
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
