'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearTokens, storeTokens } from './api';

export interface CurrentUser {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  roles: string[];
  kycTier: number;
  twoFactorEnabled: boolean;
}

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  setSession: (accessToken: string, refreshToken: string, user: CurrentUser) => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await api.get<{
        id: string;
        email: string | null;
        phone: string | null;
        firstName: string;
        lastName: string;
        roles: string[];
        kycTier: number;
        twoFactorEnabled: boolean;
      }>('/users/me');
      setUser(profile);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const hasToken = typeof window !== 'undefined' && window.localStorage.getItem('globapay_access_token');
    if (hasToken) {
      refreshProfile().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [refreshProfile]);

  const setSession = useCallback((accessToken: string, refreshToken: string, nextUser: CurrentUser) => {
    storeTokens(accessToken, refreshToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Best-effort — clear local session regardless of API result.
    }
    clearTokens();
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, setSession, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
