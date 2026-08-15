import React, { useState, useRef } from 'react';
import api from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import {
  User,
  Mail,
  Lock,
  UserPlus,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Sparkles,
  Upload,
} from 'lucide-react';
import Avatar from '../Common/Avatar';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
];

export const Register = ({ onSwitchToLogin }) => {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    password_confirm: '',
    avatar_url: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose a valid image file');
      return;
    }

    try {
      setUploadingAvatar(true);
      // Upload using temporary formData or preview
      const localPreview = URL.createObjectURL(file);
      setFormData((prev) => ({ ...prev, avatar_url: localPreview }));

      const data = new FormData();
      data.append('file', file);
      const res = await api.post('/api/chat/upload/', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFormData((prev) => ({ ...prev, avatar_url: res.data.url }));
    } catch (err) {
      console.error('Failed to upload avatar:', err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (formData.password !== formData.password_confirm) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      await register({
        username: formData.username.trim().toLowerCase(),
        email: formData.email.trim().toLowerCase(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        password: formData.password,
        password_confirm: formData.password_confirm,
        avatar_url: formData.avatar_url.trim() || null,
      });
    } catch (err) {
      const data = err.response?.data;
      let msg = 'Registration failed. Please check the form.';
      if (typeof data === 'object') {
        const firstKey = Object.keys(data)[0];
        const val = data[firstKey];
        msg = Array.isArray(val) ? `${firstKey}: ${val[0]}` : typeof val === 'string' ? val : msg;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto p-6 md:p-8 rounded-3xl glass-panel shadow-2xl border border-white/10 my-4 max-h-[92vh] overflow-y-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white text-black font-extrabold shadow-2xl mb-3">
          <Sparkles className="w-7 h-7" />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">Create Account</h2>
        <p className="text-xs text-zinc-400 mt-1 font-medium">Join Nexus Chat and start chatting instantly</p>
      </div>

      {error && (
        <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs animate-fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Avatar Selection & Device File Picker */}
        <div className="flex flex-col items-center gap-3 py-3 bg-[#141417] rounded-2xl border border-white/5 p-3">
          <input
            type="file"
            ref={avatarInputRef}
            onChange={handleAvatarFileChange}
            accept="image/*"
            className="hidden"
          />

          <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
            <Avatar
              src={formData.avatar_url}
              name={formData.first_name || formData.username || 'U'}
              size="lg"
            />
            <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingAvatar ? (
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              ) : (
                <Upload className="w-4 h-4 text-white" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="btn-dark px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1"
            >
              <Upload className="w-3 h-3" /> Upload Photo
            </button>
            <span className="text-[11px] text-zinc-500">or presets:</span>
            <div className="flex gap-1.5">
              {AVATAR_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setFormData({ ...formData, avatar_url: preset })}
                  className={`w-6 h-6 rounded-full overflow-hidden border transition-all ${
                    formData.avatar_url === preset ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-50 hover:opacity-100'
                  }`}
                >
                  <img src={preset} alt="preset" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
              First Name
            </label>
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              placeholder="Alex"
              className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs md:text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              placeholder="Morgan"
              className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs md:text-sm focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Username *
          </label>
          <div className="relative">
            <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="alex_chat"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl glass-input text-xs md:text-sm focus:outline-none"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Email Address *
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="alex@example.com"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl glass-input text-xs md:text-sm focus:outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Min 6 chars"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl glass-input text-xs md:text-sm focus:outline-none"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Confirm Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="password"
                value={formData.password_confirm}
                onChange={(e) => setFormData({ ...formData, password_confirm: e.target.value })}
                placeholder="Repeat password"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl glass-input text-xs md:text-sm focus:outline-none"
                required
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full mt-4 py-3 px-4 text-xs md:text-sm flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-black" />
              <span>Creating Account...</span>
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              <span>Register Now</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center border-t border-white/5 pt-4">
        <p className="text-xs text-zinc-400">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-white hover:underline font-bold transition-colors"
          >
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
};

export default Register;
