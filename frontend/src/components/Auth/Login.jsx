import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, LogIn, AlertCircle, Loader2, MessageSquare } from 'lucide-react';

export const Login = ({ onSwitchToRegister }) => {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    username_or_email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.username_or_email.trim()) {
      setError('Please enter your username or email address.');
      return;
    }
    if (!formData.password) {
      setError('Please enter your password.');
      return;
    }

    try {
      setLoading(true);
      await login(formData.username_or_email.trim(), formData.password);
    } catch (err) {
      const msg =
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.detail ||
        err.response?.data?.error ||
        'Login failed. Please check your credentials and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 md:p-8 rounded-3xl glass-panel shadow-2xl border border-white/10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white text-black font-extrabold shadow-2xl mb-4">
          <MessageSquare className="w-7 h-7 fill-black" />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">Welcome Back</h2>
        <p className="text-xs text-zinc-400 mt-1.5 font-medium">Sign in to continue to Nexus Chat</p>
      </div>

      {error && (
        <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs animate-fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
            Username or Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              name="username_or_email"
              value={formData.username_or_email}
              onChange={(e) => setFormData({ ...formData, username_or_email: e.target.value })}
              placeholder="e.g. abhishekdongre206@gmail.com"
              className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-xs md:text-sm focus:outline-none"
              autoComplete="username"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Enter your password"
              className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-xs md:text-sm focus:outline-none"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full mt-2 py-3 px-4 text-xs md:text-sm flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-black" />
              <span>Signing In...</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center border-t border-white/5 pt-6">
        <p className="text-xs text-zinc-400">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-white hover:underline font-bold transition-colors"
          >
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
