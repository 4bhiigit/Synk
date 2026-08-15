import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../Common/Avatar';
import StoryTray from '../Stories/StoryTray';
import ChannelDiscoveryModal from './ChannelDiscoveryModal';
import {
  Search,
  Plus,
  LogOut,
  MessageSquare,
  Sparkles,
  Globe,
  Megaphone,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

export const Sidebar = ({
  rooms = [],
  activeRoomId,
  onSelectRoom,
  onOpenSearchModal,
  loading = false,
}) => {
  const { user, logout } = useAuth();
  const [filterQuery, setFilterQuery] = useState('');
  const [isChannelHubOpen, setIsChannelHubOpen] = useState(false);

  const filteredRooms = rooms.filter((room) => {
    const name = room.display_name || room.other_member?.username || room.channel_handle || '';
    return name.toLowerCase().includes(filterQuery.toLowerCase());
  });

  const formatLastMessageTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isToday(date)) return format(date, 'HH:mm');
      if (isYesterday(date)) return 'Yesterday';
      return format(date, 'MMM d');
    } catch {
      return '';
    }
  };

  return (
    <div className="w-full md:w-80 lg:w-96 h-full flex flex-col bg-zinc-950 border-r border-white/10 select-none">
      {/* Current User Header */}
      <div className="p-4 bg-zinc-950/90 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar
            src={user?.avatar_url}
            name={user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
            size="md"
            isOnline={true}
            showStatus={true}
          />
          <div>
            <h2 className="font-bold text-white text-sm leading-tight flex items-center gap-1.5">
              {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
            </h2>
            <p className="text-xs text-zinc-400 font-medium">@{user?.username}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Public Channels Discovery */}
          <button
            onClick={() => setIsChannelHubOpen(true)}
            className="btn-icon hover:text-indigo-400 hover:border-indigo-500/30"
            title="Explore Broadcast Channels"
          >
            <Globe className="w-4 h-4" />
          </button>

          {/* New Chat */}
          <button
            onClick={onOpenSearchModal}
            className="btn-icon"
            title="Start New Chat"
          >
            <Plus className="w-4 h-4 text-white" />
          </button>

          {/* Sign Out */}
          <button
            onClick={logout}
            className="btn-icon hover:text-rose-400 hover:border-rose-500/30"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 24-Hour Stories & Status Tray */}
      <StoryTray
        currentUserId={user?.id}
        onOpenRoomWithUser={(room) => onSelectRoom(room)}
      />

      {/* Filter / Quick Search */}
      <div className="p-3 border-b border-white/5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search chats & channels..."
            className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="p-8 text-center text-xs text-zinc-500">Loading chats...</div>
        ) : filteredRooms.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <MessageSquare className="w-8 h-8 text-zinc-700 mb-2" />
            <p className="text-sm font-semibold text-zinc-300">No conversations</p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={onOpenSearchModal}
                className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 fill-black" /> Direct Chat
              </button>
              <button
                onClick={() => setIsChannelHubOpen(true)}
                className="btn-dark px-3 py-1.5 text-xs flex items-center gap-1"
              >
                <Globe className="w-3.5 h-3.5" /> Channels
              </button>
            </div>
          </div>
        ) : (
          filteredRooms.map((room) => {
            const isActive = room.id === activeRoomId;
            const isChannel = room.room_type === 'channel';
            const otherUser = room.other_member;
            const displayName = room.display_name || otherUser?.username || (isChannel ? `@${room.channel_handle || 'channel'}` : 'Chat');
            const displayAvatar = room.display_avatar || otherUser?.avatar_url;
            const isOnline = otherUser?.is_online;
            const lastMsg = room.last_message;
            const unreadCount = room.unread_count || 0;

            return (
              <button
                key={room.id}
                onClick={() => onSelectRoom(room)}
                className={`w-full p-3 rounded-2xl transition-all flex items-center gap-3 text-left relative ${
                  isActive
                    ? 'bg-zinc-800/90 border border-white/20 shadow-lg'
                    : 'hover:bg-zinc-900 border border-transparent'
                }`}
              >
                {isChannel ? (
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold flex-shrink-0">
                    <Megaphone className="w-5 h-5" />
                  </div>
                ) : (
                  <Avatar
                    src={displayAvatar}
                    name={displayName}
                    size="md"
                    isOnline={isOnline}
                    showStatus={!room.is_group}
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h3
                      className={`text-xs md:text-sm font-bold truncate flex items-center gap-1.5 ${
                        isActive ? 'text-white' : 'text-zinc-200'
                      }`}
                    >
                      <span className="truncate">{displayName}</span>
                      {isChannel && (
                        <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-mono">
                          Channel
                        </span>
                      )}
                    </h3>
                    {lastMsg && (
                      <span className="text-[10px] text-zinc-500 flex-shrink-0 font-medium">
                        {formatLastMessageTime(lastMsg.timestamp)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs text-zinc-400 truncate">
                      {lastMsg ? (
                        <>
                          {lastMsg.sender_id === user?.id && !isChannel && (
                            <span className="text-zinc-500 font-medium">You: </span>
                          )}
                          {lastMsg.content || (lastMsg.media_url ? '📷 Attachment' : '')}
                        </>
                      ) : (
                        <span className="italic text-zinc-600">
                          {isChannel ? 'Broadcast channel' : 'No messages yet'}
                        </span>
                      )}
                    </p>

                    {/* Unread Badge */}
                    {unreadCount > 0 && (
                      <span className="ml-2 flex-shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-white text-black text-[10px] font-extrabold flex items-center justify-center shadow-md">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Channel Discovery & Creation Hub */}
      <ChannelDiscoveryModal
        isOpen={isChannelHubOpen}
        onClose={() => setIsChannelHubOpen(false)}
        onSelectRoom={onSelectRoom}
      />
    </div>
  );
};

export default Sidebar;
