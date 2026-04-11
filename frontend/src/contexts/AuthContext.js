import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const AuthContext = createContext(null);

// Store token in localStorage as Safari fallback
function saveToken(token) {
  if (token) localStorage.setItem('wc_token', token);
}
function getToken() {
  return localStorage.getItem('wc_token');
}
function clearToken() {
  localStorage.removeItem('wc_token');
}

// Create axios instance with auth header fallback
function getAuthHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = not auth'd
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/auth/me`, {
        withCredentials: true,
        headers: getAuthHeaders()
      });
      setUser(data);
    } catch {
      clearToken();
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Add a timeout so if auth check hangs, we fall back to login
    const timeout = setTimeout(() => {
      if (loading) {
        setUser(false);
        setLoading(false);
      }
    }, 5000);
    checkAuth();
    return () => clearTimeout(timeout);
  }, [checkAuth, loading]);

  const login = async (email, password) => {
    const { data } = await axios.post(`${API}/api/auth/login`, { email, password }, { withCredentials: true });
    // Save token from response for Safari fallback
    if (data.token) {
      saveToken(data.token);
    }
    setUser(data);
    return data;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/api/auth/logout`, {}, { withCredentials: true, headers: getAuthHeaders() });
    } catch { /* ignore */ }
    clearToken();
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export { saveToken, getToken, clearToken, getAuthHeaders };
