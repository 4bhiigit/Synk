import React, { useState } from 'react';
import { Pin, X, ChevronRight, PinOff } from 'lucide-react';

export const PinnedMessageBar = ({
  pinnedMessages = [],
  onScrollToMessage,
  onUnpinMessage,
  isAdmin = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!pinnedMessages || pinnedMessages.length === 0) return null;

  const currentPin = pinnedMessages[currentIndex] || pinnedMessages[0];

  const handleNextPin = (e) => {
    e.stopPropagation();
    if (pinnedMessages.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % pinnedMessages.length);
    }
  };

  return (
    <div
      onClick={() => onScrollToMessage && onScrollToMessage(currentPin.id)}
      className="px-4 py-2 bg-[#121216]/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#18181e] transition-colors select-none z-10 animate-slide-up"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400 flex-shrink-0">
          <Pin className="w-3.5 h-3.5 fill-current" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-white leading-none">
              Pinned Message {pinnedMessages.length > 1 && `(${currentIndex + 1}/${pinnedMessages.length})`}
            </span>
            <span className="text-[10px] text-zinc-400 font-medium">
              by {currentPin.sender_username || 'User'}
            </span>
          </div>
          <p className="text-xs text-zinc-300 truncate mt-0.5 max-w-lg">
            {currentPin.content || (currentPin.media_url ? '📷 Media Attachment' : 'Message')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {pinnedMessages.length > 1 && (
          <button
            type="button"
            onClick={handleNextPin}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors text-[10px] font-bold"
            title="Next Pinned Message"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        {isAdmin && onUnpinMessage && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUnpinMessage(currentPin.id);
            }}
            className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Unpin Message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default PinnedMessageBar;
