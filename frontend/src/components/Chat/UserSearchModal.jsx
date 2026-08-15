import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import { Search, X, MessageSquarePlus, Users, Loader2 } from 'lucide-react';
import Avatar from '../Common/Avatar';

export const UserSearchModal = ({ isOpen, onClose, onSelectUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setResults([]);
      return;
    }

    const fetchUsers = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/chat/users/?search=${encodeURIComponent(searchTerm)}`);
        setResults(res.data.results || res.data || []);
      } catch (err) {
        console.error('Error fetching users:', err);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchUsers();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md rounded-3xl glass-panel shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 bg-zinc-950 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white text-black font-bold shadow-md">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-white">Start New Conversation</h3>
          </div>
          <button
            onClick={onClose}
            className="btn-icon"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-white/5 bg-zinc-900/40">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by username, name, or email..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs focus:outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* User Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="p-8 flex flex-col items-center justify-center gap-2 text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin text-white" />
              <span className="text-xs">Searching users...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              <p className="text-xs font-semibold text-zinc-400">No users found</p>
              <p className="text-[11px] text-zinc-600 mt-1">Try another username or email</p>
            </div>
          ) : (
            results.map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  onSelectUser(user);
                  onClose();
                }}
                className="w-full p-3 rounded-2xl hover:bg-zinc-800/80 transition-all flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    src={user.avatar_url}
                    name={user.first_name ? `${user.first_name} ${user.last_name}` : user.username}
                    size="md"
                    isOnline={user.is_online}
                    showStatus={true}
                  />
                  <div>
                    <h4 className="text-xs md:text-sm font-bold text-zinc-200 group-hover:text-white transition-colors">
                      {user.first_name ? `${user.first_name} ${user.last_name}` : user.username}
                    </h4>
                    <p className="text-[11px] text-zinc-500">@{user.username}</p>
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-white text-black opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 shadow-md">
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UserSearchModal;
