import React, { useEffect, useState } from 'react';
import { X, Eye, ShieldAlert, Sparkles, Volume2 } from 'lucide-react';
import VoiceMessagePlayer from '../Common/VoiceMessagePlayer';

export const ViewOnceModal = ({ isOpen, mediaUrl, mediaType = 'image', senderName = 'User', onClose, onOpened }) => {
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  useEffect(() => {
    if (!isOpen) return;

    if (onOpened) onOpened();

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen || !mediaUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-fade-in select-none"
      onClick={onClose}
    >
      {/* Top Banner */}
      <div
        className="absolute top-4 left-4 right-4 flex items-center justify-between z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-white/15 text-xs text-white shadow-xl">
          <Eye className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold">View Once Media</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-400">Auto-disappearing in {secondsRemaining}s</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/10 transition-colors"
          title="Close and delete"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content Container */}
      <div
        className="max-w-2xl max-h-[80vh] flex flex-col items-center justify-center relative p-2"
        onClick={(e) => e.stopPropagation()}
      >
        {mediaType === 'audio' ? (
          <div className="p-6 rounded-3xl bg-zinc-900 border border-white/15 shadow-2xl flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Volume2 className="w-8 h-8 animate-pulse" />
            </div>
            <div className="text-center">
              <h4 className="text-sm font-bold text-white">View Once Audio Note</h4>
              <p className="text-xs text-zinc-400 mt-0.5">From {senderName}</p>
            </div>
            <VoiceMessagePlayer audioUrl={mediaUrl} isSelf={false} />
          </div>
        ) : (
          <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/10 max-h-[75vh]">
            <img
              src={mediaUrl}
              alt="View Once Attachment"
              className="max-w-full max-h-[75vh] object-contain rounded-2xl"
            />
          </div>
        )}

        <div className="mt-4 px-4 py-1.5 rounded-full bg-zinc-900/60 border border-white/5 text-[11px] text-zinc-400 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>This media will permanently disappear after closing.</span>
        </div>
      </div>
    </div>
  );
};

export default ViewOnceModal;
