import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axiosInstance';
import Avatar from '../Common/Avatar';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Send,
  Pause,
  Play,
  Heart,
  Sparkles,
  Users,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const StoryViewerModal = ({
  isOpen,
  storyGroups = [],
  initialGroupIndex = 0,
  currentUserId,
  onClose,
  onReplyToStory,
  onDeleteStory,
}) => {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showViewersDrawer, setShowViewersDrawer] = useState(false);
  const [replyText, setReplyText] = useState('');

  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const pausedTimeRef = useRef(0);

  const SLIDE_DURATION_MS = 5000; // 5 seconds per slide

  const currentGroup = storyGroups[groupIndex] || null;
  const currentStories = currentGroup?.stories || [];
  const activeStory = currentStories[storyIndex] || null;
  const isAuthor = currentGroup?.user?.id === currentUserId || activeStory?.is_self;

  useEffect(() => {
    setGroupIndex(initialGroupIndex);
    setStoryIndex(0);
    setProgress(0);
  }, [initialGroupIndex, isOpen]);

  // Record view on story open
  useEffect(() => {
    if (!isOpen || !activeStory) return;

    if (!isAuthor && !activeStory.is_viewed) {
      api.post(`/api/chat/stories/${activeStory.id}/view/`).catch(() => {});
      activeStory.is_viewed = true;
    }
  }, [isOpen, activeStory?.id, isAuthor]);

  // Segment Progress Timer Loop
  useEffect(() => {
    if (!isOpen || !activeStory || isPaused || showViewersDrawer) return;

    setProgress(0);
    startTimeRef.current = Date.now();

    const interval = 50; // 50ms tick
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, (elapsed / SLIDE_DURATION_MS) * 100);
      setProgress(pct);

      if (elapsed >= SLIDE_DURATION_MS) {
        clearInterval(timerRef.current);
        handleNextStory();
      }
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, groupIndex, storyIndex, isPaused, showViewersDrawer]);

  const handleNextStory = () => {
    if (storyIndex < currentStories.length - 1) {
      setStoryIndex((prev) => prev + 1);
      setProgress(0);
    } else if (groupIndex < storyGroups.length - 1) {
      setGroupIndex((prev) => prev + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrevStory = () => {
    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      setGroupIndex((prev) => prev - 1);
      setStoryIndex(0);
      setProgress(0);
    }
  };

  const handleSendReply = (e) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || !activeStory) return;

    if (onReplyToStory) {
      onReplyToStory(currentGroup.user, activeStory, replyText.trim());
    }
    setReplyText('');
    onClose();
  };

  const handleDelete = () => {
    if (!activeStory) return;
    if (confirm('Delete this story?')) {
      if (onDeleteStory) onDeleteStory(activeStory.id);
      api.delete(`/api/chat/stories/${activeStory.id}/`).catch(() => {});
      if (currentStories.length <= 1) {
        onClose();
      } else {
        handleNextStory();
      }
    }
  };

  if (!isOpen || !activeStory) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/95 backdrop-blur-2xl animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="w-full h-full md:max-w-sm md:h-[88vh] rounded-none md:rounded-3xl bg-zinc-950 border-0 md:border md:border-white/15 shadow-2xl flex flex-col relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Top Segmented Progress Bar */}
        <div className="absolute top-3 inset-x-3 z-30 flex items-center gap-1.5 pointer-events-none">
          {currentStories.map((s, idx) => {
            const isCurrent = idx === storyIndex;
            const isCompleted = idx < storyIndex;

            return (
              <div key={s.id || idx} className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
                <div
                  style={{
                    width: isCompleted ? '100%' : isCurrent ? `${progress}%` : '0%',
                  }}
                  className="h-full bg-white transition-all duration-75"
                />
              </div>
            );
          })}
        </div>

        {/* Story Author Header */}
        <div className="absolute top-6 inset-x-3 z-30 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2.5">
            <Avatar
              src={currentGroup?.user?.avatar_url}
              name={currentGroup?.user?.username}
              size="sm"
              className="ring-2 ring-white/50"
            />
            <div>
              <span className="text-xs font-bold text-white block drop-shadow-md">
                {currentGroup?.user?.username}
              </span>
              <span className="text-[10px] text-white/70 block drop-shadow-sm font-mono">
                {activeStory.created_at ? formatDistanceToNow(new Date(activeStory.created_at), { addSuffix: true }) : 'Recently'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isAuthor && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-2 rounded-full bg-black/40 text-white/80 hover:text-rose-400 hover:bg-black/60 transition-colors"
                title="Delete Story"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-black/40 text-white/80 hover:text-white hover:bg-black/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Story Display Area */}
        <div className="flex-1 w-full h-full relative flex items-center justify-center">
          {activeStory.story_type === 'text' ? (
            /* Text Story Fullscreen Canvas */
            <div
              className={`w-full h-full bg-gradient-to-br ${
                activeStory.background_gradient || 'from-purple-600 to-indigo-800'
              } p-8 flex items-center justify-center text-center`}
            >
              <p className="text-white text-xl md:text-2xl font-bold leading-relaxed drop-shadow-lg whitespace-pre-wrap max-w-xs">
                {activeStory.content}
              </p>
            </div>
          ) : (
            /* Media Story Image / Video */
            <div className="w-full h-full bg-black relative flex items-center justify-center">
              <img
                src={activeStory.media_url}
                alt="Story content"
                className="w-full h-full object-cover"
              />
              {activeStory.content && (
                <div className="absolute inset-x-0 bottom-16 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-center">
                  <p className="text-white text-sm font-semibold drop-shadow-md">
                    {activeStory.content}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Left / Right Invisible Touch Navigation Hotspots */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              handlePrevStory();
            }}
            className="absolute left-0 inset-y-0 w-1/3 z-20 cursor-pointer"
            title="Previous Story"
          />
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleNextStory();
            }}
            className="absolute right-0 inset-y-0 w-2/3 z-20 cursor-pointer"
            title="Next Story"
          />
        </div>

        {/* Footer Actions (Reply DM for contacts / Viewers drawer for Author) */}
        <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 to-transparent z-30 pointer-events-auto">
          {isAuthor ? (
            /* Author Viewers Tray */
            <div className="flex items-center justify-between px-2 py-1">
              <button
                type="button"
                onClick={() => setShowViewersDrawer(!showViewersDrawer)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold text-white hover:bg-white/25 transition-all shadow-md"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{activeStory.views_count || 0} Views</span>
              </button>

              <span className="text-[10px] text-white/60 font-mono">
                Expires in 24 hours
              </span>
            </div>
          ) : (
            /* Contact Reply to Story Input */
            <form onSubmit={handleSendReply} className="flex items-center gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply to ${currentGroup?.user?.username}...`}
                className="flex-1 px-4 py-2.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs text-white placeholder-white/60 focus:outline-none focus:bg-white/25 transition-all"
              />
              <button
                type="submit"
                disabled={!replyText.trim()}
                className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-40 transition-transform active:scale-95 shadow-md flex-shrink-0"
              >
                <Send className="w-4 h-4 fill-black" />
              </button>
            </form>
          )}
        </div>

        {/* Author Viewers List Bottom Sheet Drawer */}
        {isAuthor && showViewersDrawer && (
          <div
            className="absolute inset-x-0 bottom-0 max-h-72 bg-[#121216]/95 backdrop-blur-xl border-t border-white/15 rounded-t-3xl p-4 z-40 flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold text-white">Story Viewers ({activeStory.views?.length || 0})</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowViewersDrawer(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {!activeStory.views || activeStory.views.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-500">
                  No views yet. Share with more friends!
                </div>
              ) : (
                activeStory.views.map((v, i) => (
                  <div key={v.id || i} className="flex items-center justify-between p-1.5 rounded-xl hover:bg-white/5">
                    <div className="flex items-center gap-2.5">
                      <Avatar src={v.viewer?.avatar_url} name={v.viewer?.username} size="xs" />
                      <span className="text-xs font-semibold text-white">{v.viewer?.username}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {v.viewed_at ? formatDistanceToNow(new Date(v.viewed_at), { addSuffix: true }) : 'Recently'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryViewerModal;
