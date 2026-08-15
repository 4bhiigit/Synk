import React, { useState, useRef, useEffect } from 'react';
import {
  Smile,
  Reply,
  Copy,
  Edit2,
  Trash2,
  Pin,
} from 'lucide-react';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'];

export const MessageActionMenu = ({
  message,
  isSelf,
  onReact,
  onReply,
  onCopy,
  onEdit,
  onPin,
  onOpenDelete,
  onClose,
  position = 'top', // 'top' | 'bottom'
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleMouseDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        if (onClose) onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  const isDeleted = message.deleted_for_everyone;

  return (
    <div
      ref={menuRef}
      className={`absolute z-30 flex items-center gap-1 p-1 rounded-2xl bg-[#141419]/95 backdrop-blur-md border border-white/15 shadow-2xl animate-fade-in ${
        isSelf ? 'right-0' : 'left-0'
      } ${position === 'top' ? '-top-10' : '-bottom-10'}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Quick Emoji Reaction Bar */}
      {!isDeleted && (
        <div className="flex items-center gap-0.5 px-1">
          {QUICK_EMOJIS.map((emoji) => {
            const hasReacted = message.reactions?.some(
              (r) => r.emoji === emoji && r.reacted_by_me
            );
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onReact(message.id, emoji);
                  if (onClose) onClose();
                }}
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm hover:scale-125 transition-all ${
                  hasReacted ? 'bg-violet-500/30 ring-1 ring-violet-400' : 'hover:bg-white/10'
                }`}
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}

      {/* Divider */}
      {!isDeleted && <div className="w-px h-4 bg-white/10 mx-0.5" />}

      {/* Action Buttons */}
      <div className="flex items-center gap-0.5">
        {/* Reply */}
        {!isDeleted && (
          <button
            type="button"
            onClick={() => {
              onReply(message);
              if (onClose) onClose();
            }}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Reply"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Copy */}
        {message.content && !isDeleted && (
          <button
            type="button"
            onClick={() => {
              onCopy(message.content);
              if (onClose) onClose();
            }}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Copy Text"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Pin / Unpin */}
        {!isDeleted && onPin && (
          <button
            type="button"
            onClick={() => {
              onPin(message.id);
              if (onClose) onClose();
            }}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
            title="Pin / Unpin Message"
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Edit (Author Only) */}
        {isSelf && !isDeleted && message.message_type === 'text' && (
          <button
            type="button"
            onClick={() => {
              onEdit(message);
              if (onClose) onClose();
            }}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Edit Message"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Delete */}
        <button
          type="button"
          onClick={() => {
            onOpenDelete(message);
            if (onClose) onClose();
          }}
          className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          title="Delete Message"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default MessageActionMenu;
