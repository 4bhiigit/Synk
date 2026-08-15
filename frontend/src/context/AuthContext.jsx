import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axiosInstance';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('refresh_token'));
  const [loading, setLoading] = useState(true);

  // Sync state with storage and fetch latest profile
  const fetchUserProfile = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const response = await api.get('/api/auth/me/');
      setUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
    } catch (err) {
      console.error('Failed to restore user profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserProfile();

    const handleAuthLogout = () => {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    };

    window.addEventListener('auth:logout', handleAuthLogout);
    return () => window.removeEventListener('auth:logout', handleAuthLogout);
  }, [fetchUserProfile]);

  const login = async (usernameOrEmail, password) => {
    const response = await api.post('/api/auth/login/', {
      username_or_email: usernameOrEmail,
      password: password,
    });

    const { user: userData, tokens } = response.data;
    localStorage.setItem('access_token', tokens.access);
    localStorage.setItem('refresh_token', tokens.refresh);
    localStorage.setItem('user', JSON.stringify(userData));

    setAccessToken(tokens.access);
    setRefreshToken(tokens.refresh);
    setUser(userData);

    return userData;
  };

  const register = async (formData) => {
    const response = await api.post('/api/auth/register/', formData);
    const { user: userData, tokens } = response.data;

    localStorage.setItem('access_token', tokens.access);
    localStorage.setItem('refresh_token', tokens.refresh);
    localStorage.setItem('user', JSON.stringify(userData));

    setAccessToken(tokens.access);
    setRefreshToken(tokens.refresh);
    setUser(userData);

    return userData;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  const updateProfile = async (updatedData) => {
    const response = await api.patch('/api/auth/me/', updatedData);
    setUser(response.data);
    localStorage.setItem('user', JSON.stringify(response.data));
    return response.data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        isAuthenticated: !!user && !!accessToken,
        loading,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
