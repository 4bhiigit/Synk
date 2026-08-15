import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playPopSound, playClickSound } from '../../utils/appleSounds';
import { triggerHaptic } from '../../utils/appleHaptics';
import {
  Reply,
  Copy,
  Pin,
  Edit2,
  Trash2,
  Share2,
} from 'lucide-react';

const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '🎉'];

export const PeekAndPopMenu = ({
  isOpen,
  message,
  isSelf,
  position = { x: 0, y: 0 },
  onReact,
  onReply,
  onCopy,
  onPin,
  onEdit,
  onDelete,
  onClose,
}) => {
  useEffect(() => {
    if (isOpen) {
      playPopSound();
      triggerHaptic('medium');
    }
  }, [isOpen]);

  if (!isOpen || !message) return null;

  const isDeleted = message.deleted_for_everyone;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none"
        onClick={onClose}
      >
        {/* iOS Frosted Glass Dim Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Content Wrapper */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 10 }}
          transition={{ type: 'spring', stiffness: 450, damping: 30 }}
          className="relative z-10 flex flex-col items-center gap-3 max-w-sm w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Bouncing Quick Emoji Reaction Pill Bar */}
          {!isDeleted && (
            <motion.div
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05, type: 'spring', stiffness: 500, damping: 25 }}
              className="flex items-center gap-1.5 p-1.5 rounded-full bg-zinc-900/90 backdrop-blur-2xl border border-white/20 shadow-2xl"
            >
              {QUICK_EMOJIS.map((emoji, idx) => (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.35, y: -4 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                  type="button"
                  onClick={() => {
                    playClickSound();
                    triggerHaptic('light');
                    if (onReact) onReact(message.id, emoji);
                    onClose();
                  }}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xl hover:bg-white/10 transition-colors"
                >
                  {emoji}
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* 2. Scaled Preview Card of Message */}
          <div
            className={`w-full p-4 rounded-3xl shadow-2xl border ${
              isSelf
                ? 'bg-gradient-to-br from-indigo-600 to-violet-700 border-indigo-400/40 text-white'
                : 'bg-zinc-900/95 border-white/15 text-zinc-100 backdrop-blur-2xl'
            }`}
          >
            <span className="text-[10px] font-bold opacity-75 uppercase tracking-wider block mb-1">
              {message.sender?.username || 'User'}
            </span>
            {message.media_url && (
              <div className="mb-2 rounded-2xl overflow-hidden max-h-48 border border-white/10">
                <img src={message.media_url} alt="media" className="w-full h-full object-cover" />
              </div>
            )}
            <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
              {message.content || (message.media_url ? '📷 Media' : 'Message')}
            </p>
          </div>

          {/* 3. iOS Style Action Menu */}
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 450, damping: 30 }}
            className="w-full rounded-2xl bg-[#1c1c22]/90 backdrop-blur-2xl border border-white/15 shadow-2xl overflow-hidden divide-y divide-white/5"
          >
            {/* Reply */}
            {!isDeleted && onReply && (
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  triggerHaptic('light');
                  onReply(message);
                  onClose();
                }}
                className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              >
                <span>Reply</span>
                <Reply className="w-4 h-4 text-zinc-400" />
              </button>
            )}

            {/* Copy */}
            {message.content && !isDeleted && onCopy && (
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  triggerHaptic('light');
                  onCopy(message.content);
                  onClose();
                }}
                className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              >
                <span>Copy Text</span>
                <Copy className="w-4 h-4 text-zinc-400" />
              </button>
            )}

            {/* Pin */}
            {!isDeleted && onPin && (
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  triggerHaptic('medium');
                  onPin(message.id);
                  onClose();
                }}
                className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              >
                <span>Pin Message</span>
                <Pin className="w-4 h-4 text-zinc-400" />
              </button>
            )}

            {/* Edit (if author) */}
            {isSelf && !isDeleted && message.message_type === 'text' && onEdit && (
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  triggerHaptic('light');
                  onEdit(message);
                  onClose();
                }}
                className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              >
                <span>Edit Message</span>
                <Edit2 className="w-4 h-4 text-zinc-400" />
              </button>
            )}

            {/* Delete (Destructive) */}
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  triggerHaptic('heavy');
                  onDelete(message);
                  onClose();
                }}
                className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <span>Delete</span>
                <Trash2 className="w-4 h-4 text-rose-400" />
              </button>
            )}
          </motion.div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PeekAndPopMenu;
