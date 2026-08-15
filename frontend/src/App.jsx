import React from 'react';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import Loader from './components/Common/Loader';

export function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#070b14]">
        <Loader text="Loading Nexus Chat..." size="lg" />
      </div>
    );
  }

  return isAuthenticated ? <DashboardPage /> : <AuthPage />;
}

export default App;
