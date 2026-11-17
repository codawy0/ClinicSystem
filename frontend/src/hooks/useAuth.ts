import { useState, useEffect, useCallback } from 'react';
import { UserDto, AuthResponseDto } from '../types';
import { authStorage } from '../lib/api';

export function useAuth() {
  const [user, setUser] = useState<UserDto | null>(() => authStorage.getUser());
  const [token, setToken] = useState<string | null>(() => authStorage.getToken());

  useEffect(() => {
    const handleStorageChange = () => {
      setUser(authStorage.getUser());
      setToken(authStorage.getToken());
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const login = useCallback((authData: AuthResponseDto) => {
    authStorage.saveSession(authData);
    setUser(authData.user);
    setToken(authData.token);
  }, []);

  const logout = useCallback(() => {
    authStorage.clearSession();
    setUser(null);
    setToken(null);
    window.location.href = '/login';
  }, []);

  const updateUser = useCallback((updated: Partial<UserDto>) => {
    authStorage.updateUser(updated);
    setUser(authStorage.getUser());
  }, []);

  return {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    login,
    logout,
    updateUser,
  };
}
