import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosInstance';
import Sidebar from '../components/Chat/Sidebar';
import ChatArea from '../components/Chat/ChatArea';
import UserSearchModal from '../components/Chat/UserSearchModal';

export const DashboardPage = () => {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // Fetch rooms list
  const fetchRooms = useCallback(async () => {
    try {
      setLoadingRooms(true);
      const res = await api.get('/api/chat/rooms/');
      const roomList = res.data.results || res.data || [];
      setRooms(roomList);

      // If activeRoom is set, refresh its data
      if (activeRoom) {
        const updated = roomList.find((r) => r.id === activeRoom.id);
        if (updated) {
          setActiveRoom(updated);
        }
      }
    } catch (err) {
      console.error('Failed to load chat rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  }, [activeRoom]);

  useEffect(() => {
    fetchRooms();
  }, []);

  // Handle selecting a room from sidebar
  const handleSelectRoom = (room) => {
    setActiveRoom(room);
    // Reset unread count locally for instant UI feedback
    setRooms((prev) =>
      prev.map((r) => (r.id === room.id ? { ...r, unread_count: 0 } : r))
    );
  };

  // Handle starting a chat from the User Search modal
  const handleSelectUser = async (targetUser) => {
    try {
      const res = await api.post('/api/chat/rooms/get-or-create/', {
        target_user_id: targetUser.id,
      });
      const room = res.data;

      setRooms((prev) => {
        const exists = prev.some((r) => r.id === room.id);
        return exists ? prev : [room, ...prev];
      });

      setActiveRoom(room);
    } catch (err) {
      console.error('Failed to create or open room:', err);
    }
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-screen flex bg-[#0b0f19] overflow-hidden fixed inset-0 overscroll-none">
      {/* 2-Column Responsive Layout */}
      {/* Left Column (Sidebar) */}
      <div
        className={`${
          activeRoom ? 'hidden md:flex' : 'flex'
        } w-full md:w-80 lg:w-96 h-full max-h-full flex-shrink-0 flex-col overflow-hidden`}
      >
        <Sidebar
          rooms={rooms}
          activeRoomId={activeRoom?.id}
          onSelectRoom={handleSelectRoom}
          onOpenSearchModal={() => setIsSearchModalOpen(true)}
          loading={loadingRooms}
        />
      </div>

      {/* Right Column (Chat Area) */}
      <div
        className={`${
          !activeRoom ? 'hidden md:flex' : 'flex'
        } flex-1 h-full max-h-full min-h-0 flex-col min-w-0 overflow-hidden`}
      >
        <ChatArea
          activeRoom={activeRoom}
          onBack={() => setActiveRoom(null)}
          onMessageSent={fetchRooms}
        />
      </div>

      {/* Search & Start Chat Modal */}
      <UserSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectUser={handleSelectUser}
      />
    </div>
  );
};

export default DashboardPage;
