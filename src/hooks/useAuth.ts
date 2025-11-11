'use client'

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@api';

interface User {
  id: number;
  fio_name: string;
  role_id: number;
  group_id?: number;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const data = await apiGet<{ success: boolean; user?: User }>('/api/auth/me');

      if (data.success) {
        setAuthState({
          user: data.user ?? null,
          loading: false,
          isAuthenticated: true,
        });
      } else {
        setAuthState({
          user: null,
          loading: false,
          isAuthenticated: false,
        });
      }
    } catch (error) {
      setAuthState({
        user: null,
        loading: false,
        isAuthenticated: false,
      });
    }
  };

  const login = async (fio_name: string, password: string) => {
    try {
      const data = await apiPost<{ success: boolean; error?: string }>('/api/auth/login', { fio_name, password });

      if (data.success) {
        setTimeout(() => {
          window.location.reload();
        }, 100);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Ошибка сети' };
    }
  };

  const logout = async () => {
    try {
      await apiPost<{ success: boolean }>('/api/auth/logout', {});
      window.location.reload();
    } catch (error) {
      window.location.reload();
    }
  };

  return {
    ...authState,
    login,
    logout,
  };
};
