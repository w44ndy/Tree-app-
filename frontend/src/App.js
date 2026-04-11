import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PalletsPage from './pages/PalletsPage';
import YardPage from './pages/YardPage';
import OrdersPage from './pages/OrdersPage';
import LoadsPage from './pages/LoadsPage';
import LorriesPage from './pages/LorriesPage';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F1ED]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#1A4331] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#4A5D53]">Loading...</p>
        </div>
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F1ED]">
        <div className="w-8 h-8 border-2 border-[#1A4331] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/pallets" element={<ProtectedRoute><PalletsPage /></ProtectedRoute>} />
      <Route path="/yard" element={<ProtectedRoute><YardPage /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
      <Route path="/loads" element={<ProtectedRoute><LoadsPage /></ProtectedRoute>} />
      <Route path="/lorries" element={<ProtectedRoute><LorriesPage /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
