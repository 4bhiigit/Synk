import React from 'react';
import { Trash2, AlertCircle, X } from 'lucide-react';

export const DeleteMessageModal = ({
  isOpen,
  message,
  isSelf,
  onDeleteForMe,
  onDeleteForEveryone,
  onClose,
}) => {
  if (!isOpen || !message) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-sm rounded-3xl bg-[#121216] border border-white/15 p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Delete Message?</h3>
              <p className="text-xs text-zinc-400">Choose how to delete this message</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Preview Snippet */}
        {message.content && (
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs text-zinc-300 italic truncate">
            "{message.content}"
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-1">
          {isSelf && (
            <button
              type="button"
              onClick={() => {
                onDeleteForEveryone(message.id);
                onClose();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-md flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete for Everyone</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onDeleteForMe(message.id);
              onClose();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Delete for Me</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 px-4 rounded-xl text-zinc-400 hover:text-white text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteMessageModal;
