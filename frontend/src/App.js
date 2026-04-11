import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PalletsPage from './pages/PalletsPage';
import YardPage from './pages/YardPage';
import LoadsPage from './pages/LoadsPage';
import FieldPage from './pages/FieldPage';
import ManifestPage from './pages/ManifestPage';
import TVDashboard from './pages/TVDashboard';
import './App.css';

const WC_LOGO = "https://customer-assets.emergentagent.com/job_tree-logistics/artifacts/7lohxwsd_2025Logo.png";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F1ED]" data-testid="loading-screen">
      <img src={WC_LOGO} alt="Wilson Contractors" className="h-16 object-contain mb-6" />
      <div className="w-10 h-10 border-3 border-[#1A4331] border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm text-[#4A5D53] font-['Work_Sans']">Loading Tree Management System...</p>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user === false) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
}

function ProtectedFullscreen({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user === false) return <Navigate to="/login" />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/manifest/:loadId" element={<ManifestPage />} />
      <Route path="/tv-dashboard" element={<ProtectedFullscreen><TVDashboard /></ProtectedFullscreen>} />
      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/field" element={<ProtectedRoute><FieldPage /></ProtectedRoute>} />
      <Route path="/pallets" element={<ProtectedRoute><PalletsPage /></ProtectedRoute>} />
      <Route path="/loads" element={<ProtectedRoute><LoadsPage /></ProtectedRoute>} />
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
