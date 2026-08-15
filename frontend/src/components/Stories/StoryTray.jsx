import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/axiosInstance';
import Avatar from '../Common/Avatar';
import CreateStoryModal from './CreateStoryModal';
import StoryViewerModal from './StoryViewerModal';
import { Plus, Sparkles } from 'lucide-react';

export const StoryTray = ({ currentUserId, onOpenRoomWithUser, onMessageSent }) => {
  const [storyGroups, setStoryGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewerState, setViewerState] = useState({ isOpen: false, initialGroupIndex: 0 });

  const fetchStories = useCallback(async () => {
    try {
      const res = await api.get('/api/chat/stories/');
      setStoryGroups(res.data || []);
    } catch (err) {
      console.warn('Failed to load stories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const myGroup = storyGroups.find((g) => g.is_self);
  const contactGroups = storyGroups.filter((g) => !g.is_self);

  const handleOpenViewer = (groupIndex) => {
    setViewerState({
      isOpen: true,
      initialGroupIndex: groupIndex,
    });
  };

  const handleStoryCreated = () => {
    fetchStories();
  };

  const handleDeleteStory = (storyId) => {
    setStoryGroups((prev) =>
      prev
        .map((g) => ({
          ...g,
          stories: g.stories.filter((s) => s.id !== storyId),
        }))
        .filter((g) => g.stories.length > 0)
    );
  };

  const handleReplyToStory = async (authorUser, story, replyText) => {
    try {
      // 1. Create or get direct room with story author
      const roomRes = await api.post('/api/chat/rooms/get-or-create/', {
        target_user_id: authorUser.id,
        is_group: false,
      });
      const room = roomRes.data;

      // 2. Format quoted reply context
      const storyContext = `[Story: ${story.content || (story.story_type === 'image' ? '📷 Photo' : 'Story')}] ${replyText}`;

      if (onOpenRoomWithUser) {
        onOpenRoomWithUser(room, storyContext);
      }
    } catch (err) {
      console.error('Failed to reply to story:', err);
    }
  };

  return (
    <div className="px-3 py-2.5 bg-[#0d0d10] border-b border-white/10 select-none">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
        {/* 1. My Status Bubble */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer group">
          <div className="relative">
            <div
              onClick={() => {
                if (myGroup && myGroup.stories.length > 0) {
                  handleOpenViewer(0);
                } else {
                  setIsCreateModalOpen(true);
                }
              }}
              className={`w-12 h-12 rounded-full p-0.5 transition-transform group-hover:scale-105 ${
                myGroup && myGroup.stories.length > 0
                  ? 'bg-gradient-to-tr from-purple-500 via-pink-500 to-amber-400'
                  : 'bg-zinc-800'
              }`}
            >
              <Avatar
                src={myGroup?.user?.avatar_url}
                name={myGroup?.user?.username || 'You'}
                size="md"
                className="w-full h-full rounded-full border-2 border-black"
              />
            </div>

            {/* Plus Icon Badge */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCreateModalOpen(true);
              }}
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white flex items-center justify-center ring-2 ring-black shadow-md transition-colors"
              title="Add Story"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
            </button>
          </div>

          <span className="text-[10px] font-semibold text-zinc-300 truncate max-w-[58px]">
            {myGroup && myGroup.stories.length > 0 ? 'Your Story' : 'Add Status'}
          </span>
        </div>

        {/* 2. Divider */}
        {contactGroups.length > 0 && (
          <div className="w-px h-8 bg-white/10 flex-shrink-0 my-auto" />
        )}

        {/* 3. Contact Status Bubbles */}
        {contactGroups.map((group, cIdx) => {
          // Adjust group index accounting for whether myGroup is at index 0
          const actualGroupIndex = myGroup ? cIdx + 1 : cIdx;
          const hasUnseen = group.has_unseen;

          return (
            <div
              key={group.user?.id || cIdx}
              onClick={() => handleOpenViewer(actualGroupIndex)}
              className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer group"
            >
              <div
                className={`w-12 h-12 rounded-full p-0.5 transition-transform group-hover:scale-105 ${
                  hasUnseen
                    ? 'bg-gradient-to-tr from-purple-500 via-pink-500 to-indigo-400 animate-pulse'
                    : 'bg-zinc-700/60'
                }`}
              >
                <Avatar
                  src={group.user?.avatar_url}
                  name={group.user?.username}
                  size="md"
                  className="w-full h-full rounded-full border-2 border-black"
                />
              </div>

              <span className="text-[10px] font-medium text-zinc-400 truncate max-w-[58px] group-hover:text-white transition-colors">
                {group.user?.username}
              </span>
            </div>
          );
        })}
      </div>

      {/* Create Story Modal */}
      <CreateStoryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onStoryCreated={handleStoryCreated}
      />

      {/* Fullscreen Story Viewer Modal */}
      {viewerState.isOpen && (
        <StoryViewerModal
          isOpen={viewerState.isOpen}
          storyGroups={storyGroups}
          initialGroupIndex={viewerState.initialGroupIndex}
          currentUserId={currentUserId}
          onClose={() => setViewerState({ isOpen: false, initialGroupIndex: 0 })}
          onReplyToStory={handleReplyToStory}
          onDeleteStory={handleDeleteStory}
        />
      )}
    </div>
  );
};

export default StoryTray;
