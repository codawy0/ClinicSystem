import { useState, useEffect, useCallback } from 'react';
import { authStorage } from '../lib/api';
export function useAuth() {
    const [user, setUser] = useState(() => authStorage.getUser());
    const [token, setToken] = useState(() => authStorage.getToken());
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
    const login = useCallback((authData) => {
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
    const updateUser = useCallback((updated) => {
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
