import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ClassifiedLogin } from './components/ClassifiedLogin';
import { CommandCenter } from './components/CommandCenter';

function MainApp() {
  const [currentView, setCurrentView] = useState<'login' | 'dashboard'>('login');

  useEffect(() => {
    // Check if user already passed MFA/Token
    const token = localStorage.getItem('lvo_token');
    const expiry = parseInt(localStorage.getItem('lvo_expiry') || '0', 10);
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');

    if (viewParam === 'dash' || viewParam === 'dashboard') {
      setCurrentView('dashboard');
    } else if (token && expiry && Date.now() < expiry) {
      setCurrentView('dashboard');
    }
  }, []);

  const handleLoginSuccess = (token: string) => {
    setCurrentView('dashboard');
  };

  const handleBackToMenu = () => {
    setCurrentView('login');
  };

  return (
    <div className="w-full min-h-screen bg-black">
      {currentView === 'login' ? (
        <ClassifiedLogin onSuccess={handleLoginSuccess} />
      ) : (
        <CommandCenter onBackToMenu={handleBackToMenu} />
      )}
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
