import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/axiosInstance';
import Avatar from '../Common/Avatar';
import {
  Globe,
  Search,
  Plus,
  Radio,
  Users,
  Check,
  X,
  Loader2,
  Lock,
  Megaphone,
} from 'lucide-react';

export const ChannelDiscoveryModal = ({ isOpen, onClose, onSelectRoom }) => {
  const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'create'
  const [channels, setChannels] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Create Channel Form State
  const [channelName, setChannelName] = useState('');
  const [channelHandle, setChannelHandle] = useState('');
  const [description, setDescription] = useState('');
  const [isBroadcastOnly, setIsBroadcastOnly] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const fetchPublicChannels = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/chat/channels/public/?search=${encodeURIComponent(searchQuery)}`);
      setChannels(res.data.results || res.data || []);
    } catch (err) {
      console.warn('Failed to load public channels:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (isOpen && activeTab === 'browse') {
      fetchPublicChannels();
    }
  }, [isOpen, activeTab, fetchPublicChannels]);

  if (!isOpen) return null;

  const handleJoinLeave = async (channel) => {
    try {
      const res = await api.post(`/api/chat/channels/${channel.id}/join-leave/`);
      const { status, room } = res.data;

      // Update in local state
      setChannels((prev) =>
        prev.map((c) => (c.id === channel.id ? { ...c, ...room } : c))
      );

      if (status === 'joined' && onSelectRoom) {
        onSelectRoom(room);
        onClose();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update channel membership.');
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!channelName.trim()) {
      alert('Please enter a channel name.');
      return;
    }

    try {
      setIsCreating(true);
      const res = await api.post('/api/chat/rooms/get-or-create/', {
        name: channelName.trim(),
        channel_handle: channelHandle.trim().replace(/^@/, ''),
        description: description.trim(),
        room_type: 'channel',
        is_broadcast_only: isBroadcastOnly,
        is_public: isPublic,
      });

      const newChannel = res.data;
      if (onSelectRoom) onSelectRoom(newChannel);
      onClose();
    } catch (err) {
      console.error('Failed to create channel:', err);
      alert(err.response?.data?.error || 'Failed to create channel.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in select-none">
      <div className="w-full max-w-lg rounded-3xl bg-[#121216] border border-white/15 shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        {/* Header Tabs */}
        <div className="p-4 bg-black/40 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-2xl border border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'browse'
                  ? 'bg-white text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Explore Channels</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'create'
                  ? 'bg-white text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Channel</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {activeTab === 'browse' ? (
          /* Browse Channels Directory */
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            {/* Search Bar */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search public channels by name or @handle..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Channels List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loading ? (
                <div className="p-8 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading channels...</span>
                </div>
              ) : channels.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-xs">
                  <Megaphone className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="font-semibold text-zinc-400">No public channels found</p>
                  <p className="mt-1">Be the first to create one!</p>
                </div>
              ) : (
                channels.map((channel) => (
                  <div
                    key={channel.id}
                    className="p-3 rounded-2xl bg-zinc-900/70 border border-white/10 hover:border-white/20 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                        <Megaphone className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white truncate">
                            {channel.name}
                          </h4>
                          {channel.channel_handle && (
                            <span className="text-[10px] text-indigo-400 font-mono">
                              @{channel.channel_handle}
                            </span>
                          )}
                        </div>
                        {channel.description && (
                          <p className="text-[11px] text-zinc-400 truncate max-w-xs mt-0.5">
                            {channel.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-1">
                          <Users className="w-3 h-3" />
                          <span>{channel.subscribers_count || 0} subscribers</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleJoinLeave(channel)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold btn-primary flex-shrink-0 shadow-md"
                    >
                      Join
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Create Channel Form */
          <form onSubmit={handleCreateChannel} className="p-4 space-y-3 overflow-y-auto">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                Channel Name
              </label>
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="e.g. Daily Tech Highlights"
                maxLength={60}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                Channel Handle (Optional)
              </label>
              <div className="flex items-center rounded-xl bg-zinc-900 border border-white/10 px-3 py-1.5 focus-within:border-indigo-500">
                <span className="text-xs text-zinc-500 font-mono">@</span>
                <input
                  type="text"
                  value={channelHandle}
                  onChange={(e) => setChannelHandle(e.target.value)}
                  placeholder="tech_highlights"
                  maxLength={30}
                  className="w-full px-2 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this channel about?"
                maxLength={200}
                rows={2}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="pt-2 border-t border-white/10 space-y-2">
              <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-white/5">
                <div>
                  <span className="text-xs font-bold text-white block">Broadcast Only</span>
                  <span className="text-[10px] text-zinc-400">Only admins can post messages</span>
                </div>
                <input
                  type="checkbox"
                  checked={isBroadcastOnly}
                  onChange={(e) => setIsBroadcastOnly(e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-white/5">
                <div>
                  <span className="text-xs font-bold text-white block">Public Discovery</span>
                  <span className="text-[10px] text-zinc-400">Listed in global search & explorer</span>
                </div>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                />
              </label>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('browse')}
                className="btn-dark px-4 py-2 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="btn-primary px-5 py-2 text-xs font-bold flex items-center gap-2 shadow-lg disabled:opacity-40"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                ) : (
                  <>
                    <Megaphone className="w-3.5 h-3.5" />
                    <span>Create Channel</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChannelDiscoveryModal;
