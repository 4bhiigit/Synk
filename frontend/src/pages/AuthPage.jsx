import React, { useState } from 'react';
import Login from '../components/Auth/Login';
import Register from '../components/Auth/Register';

export const AuthPage = () => {
  const [isLoginView, setIsLoginView] = useState(true);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-black">
      {/* Background Animated Subtle Monochrome Blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-zinc-700/15 rounded-full blur-3xl pointer-events-none animate-pulse-subtle" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-zinc-600/10 rounded-full blur-3xl pointer-events-none animate-pulse-subtle" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Auth Card Container */}
      <div className="relative z-10 w-full flex justify-center">
        {isLoginView ? (
          <Login onSwitchToRegister={() => setIsLoginView(false)} />
        ) : (
          <Register onSwitchToLogin={() => setIsLoginView(true)} />
        )}
      </div>
    </div>
  );
};

export default AuthPage;
