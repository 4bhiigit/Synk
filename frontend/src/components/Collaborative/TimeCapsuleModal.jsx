import React, { useState, useRef } from 'react';
import api from '../../api/axiosInstance';
import {
  Hourglass,
  Clock,
  Calendar,
  X,
  Lock,
  Sparkles,
  Paperclip,
  Loader2,
  Send,
} from 'lucide-react';

export const TimeCapsuleModal = ({ isOpen, onClose, onSendCapsule }) => {
  const [capsuleTitle, setCapsuleTitle] = useState('Secret Time Capsule ⏳');
  const [content, setContent] = useState('');
  const [unlockAt, setUnlockAt] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // Preset offsets
  const applyPreset = (minutes) => {
    const target = new Date(Date.now() + minutes * 60000);
    // Format to YYYY-MM-DDTHH:mm for datetime-local input
    const localIso = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setUnlockAt(localIso);
    setError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFilePreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!content.trim() && !selectedFile) {
      setError('Please provide a message or attach a photo for the capsule.');
      return;
    }

    if (!unlockAt) {
      setError('Please choose an unlock date and time.');
      return;
    }

    const unlockDate = new Date(unlockAt);
    if (unlockDate.getTime() <= Date.now() + 10000) {
      setError('Unlock time must be at least 1 minute in the future.');
      return;
    }

    try {
      setIsSubmitting(true);
      let mediaUrl = null;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const res = await api.post('/api/chat/upload/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        mediaUrl = res.data.url;
      }

      onSendCapsule({
        title: capsuleTitle.trim() || 'Time Capsule',
        content: content.trim(),
        mediaUrl: mediaUrl,
        unlockAt: unlockDate.toISOString(),
      });

      onClose();
    } catch (err) {
      console.error('Time capsule creation error:', err);
      setError('Failed to create time capsule. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-lg rounded-3xl glass-panel shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-[#09090b] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-400 text-black font-bold shadow-md">
              <Hourglass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Create Time Capsule</h3>
              <p className="text-[11px] text-zinc-400">Lock a message until a future date & time</p>
            </div>
          </div>

          <button onClick={onClose} className="btn-icon p-1.5" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs animate-fade-in">
              {error}
            </div>
          )}

          {/* Capsule Title */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Capsule Title / Occasion
            </label>
            <input
              type="text"
              value={capsuleTitle}
              onChange={(e) => setCapsuleTitle(e.target.value)}
              placeholder="e.g. Open on my Birthday! 🎂"
              className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs md:text-sm focus:outline-none"
            />
          </div>

          {/* Unlock Timestamp Picker & Presets */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Unlock Date & Time (UTC/Local) *
            </label>
            <input
              type="datetime-local"
              value={unlockAt}
              onChange={(e) => setUnlockAt(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs md:text-sm focus:outline-none text-white appearance-none"
              required
            />

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[11px] text-zinc-500 self-center mr-1">Quick:</span>
              <button
                type="button"
                onClick={() => applyPreset(1)}
                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              >
                +1 Minute (Test)
              </button>
              <button
                type="button"
                onClick={() => applyPreset(60)}
                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              >
                +1 Hour
              </button>
              <button
                type="button"
                onClick={() => applyPreset(1440)}
                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              >
                +1 Day
              </button>
              <button
                type="button"
                onClick={() => applyPreset(10080)}
                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              >
                +1 Week
              </button>
            </div>
          </div>

          {/* Secret Message Content */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Secret Message *
            </label>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the message that will be revealed in the future..."
              className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs md:text-sm focus:outline-none resize-none"
            />
          </div>

          {/* Optional Photo Attachment */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            {selectedFile && filePreviewUrl ? (
              <div className="p-2 rounded-2xl bg-[#18181b] border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-black border border-white/10">
                    <img src={filePreviewUrl} alt="preview" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-xs font-bold text-white truncate max-w-[180px]">
                    {selectedFile.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setFilePreviewUrl(null);
                  }}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-dark w-full py-2 px-3 text-xs flex items-center justify-center gap-2"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Attach Photo (Optional)</span>
              </button>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-3 px-4 text-xs md:text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 shadow-xl"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>Locking Time Capsule...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Lock & Send Capsule</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TimeCapsuleModal;
