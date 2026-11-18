'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../lib/api-client';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((state) => state.setUser);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const response = await apiClient.get('/auth/me');
        if (response.data?.success && response.data?.user) {
          setUser(response.data.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [setUser, setLoading]);

  return <>{children}</>;
}
