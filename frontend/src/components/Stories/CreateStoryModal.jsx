import React, { useState, useRef } from 'react';
import api from '../../api/axiosInstance';
import { compressImage } from '../../utils/imageCompressor';
import {
  X,
  Type,
  Image as ImageIcon,
  Sparkles,
  Palette,
  Eye,
  Lock,
  Send,
  Loader2,
  Check,
  Users,
} from 'lucide-react';

const GRADIENTS = [
  { name: 'Purple Dusk', value: 'from-purple-600 to-indigo-800' },
  { name: 'Sunset Blaze', value: 'from-amber-500 to-rose-600' },
  { name: 'Neon Cyber', value: 'from-cyan-500 to-blue-600' },
  { name: 'Emerald Aurora', value: 'from-emerald-500 to-teal-800' },
  { name: 'Velvet Rose', value: 'from-pink-600 to-purple-900' },
  { name: 'Midnight', value: 'from-zinc-900 to-black' },
];

export const CreateStoryModal = ({ isOpen, onClose, onStoryCreated }) => {
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'media'
  const [textContent, setTextContent] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0].value);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [privacyType, setPrivacyType] = useState('everyone'); // 'everyone' | 'exclude' | 'only_share_with'
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file, { maxWidth: 1920, maxHeight: 1080, quality: 0.8 });
      setSelectedFile(compressed);
      setFilePreview(URL.createObjectURL(compressed));
    }
  };

  const handleShareStory = async () => {
    if (activeTab === 'text' && !textContent.trim()) {
      alert('Please enter text for your story.');
      return;
    }
    if (activeTab === 'media' && !selectedFile) {
      alert('Please select a photo or video for your story.');
      return;
    }

    try {
      setIsSubmitting(true);
      let uploadedMediaUrl = null;

      if (activeTab === 'media' && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploadRes = await api.post('/api/chat/upload/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploadedMediaUrl = uploadRes.data.url;
      }

      const payload = {
        story_type: activeTab,
        content: activeTab === 'text' ? textContent.trim() : caption.trim(),
        media_url: uploadedMediaUrl,
        background_gradient: selectedGradient,
        privacy_type: privacyType,
      };

      const res = await api.post('/api/chat/stories/', payload);
      if (onStoryCreated) onStoryCreated(res.data);
      onClose();
    } catch (err) {
      console.error('Failed to create story:', err);
      alert('Failed to post story. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-in select-none">
      <div className="w-full max-w-md rounded-3xl bg-[#121216] border border-white/15 shadow-2xl flex flex-col overflow-hidden">
        {/* Header Tabs */}
        <div className="p-3 bg-black/40 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-2xl border border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'text'
                  ? 'bg-white text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Text Story</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('media')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'media'
                  ? 'bg-white text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Media Story</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Story Canvas / Preview */}
        <div className="p-4 flex flex-col items-center justify-center">
          {activeTab === 'text' ? (
            /* Text Story Canvas */
            <div
              className={`w-full aspect-[9/14] max-h-[380px] rounded-2xl bg-gradient-to-br ${selectedGradient} p-6 flex flex-col items-center justify-center text-center relative shadow-2xl transition-all duration-300`}
            >
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Type your story status..."
                maxLength={300}
                className="w-full bg-transparent text-white text-lg md:text-xl font-bold placeholder-white/50 text-center resize-none focus:outline-none drop-shadow-md leading-relaxed"
                rows={5}
                autoFocus
              />
              <span className="absolute bottom-3 right-4 text-[10px] text-white/60 font-mono">
                {textContent.length}/300
              </span>
            </div>
          ) : (
            /* Media Story Canvas */
            <div className="w-full aspect-[9/14] max-h-[380px] rounded-2xl bg-zinc-900 border border-white/10 relative overflow-hidden flex flex-col items-center justify-center">
              {filePreview ? (
                <>
                  <img
                    src={filePreview}
                    alt="Story media"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <input
                      type="text"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Add a caption..."
                      maxLength={150}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-xs text-white placeholder-zinc-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFilePreview(null);
                      setSelectedFile(null);
                    }}
                    className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 mb-3 shadow-inner">
                    <ImageIcon className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-bold text-white mb-1">Upload Photo or Video</p>
                  <p className="text-xs text-zinc-500">Auto-compressed for instant streaming</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Text Story Gradient Presets */}
        {activeTab === 'text' && (
          <div className="px-4 pb-2 flex items-center gap-2 justify-center">
            {GRADIENTS.map((g) => (
              <button
                key={g.name}
                type="button"
                onClick={() => setSelectedGradient(g.value)}
                className={`w-7 h-7 rounded-full bg-gradient-to-br ${g.value} transition-transform ${
                  selectedGradient === g.value ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                }`}
                title={g.name}
              />
            ))}
          </div>
        )}

        {/* Privacy Selector & Share Action */}
        <div className="p-4 bg-black/40 border-t border-white/10 flex items-center justify-between gap-3">
          {/* Privacy Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-300">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={privacyType}
              onChange={(e) => setPrivacyType(e.target.value)}
              className="bg-transparent text-xs text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="everyone" className="bg-zinc-900 text-white">Everyone</option>
              <option value="exclude" className="bg-zinc-900 text-white">My Contacts Except...</option>
              <option value="only_share_with" className="bg-zinc-900 text-white">Only Share With...</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleShareStory}
            disabled={isSubmitting}
            className="btn-primary px-5 py-2 text-xs font-bold flex items-center gap-2 shadow-lg disabled:opacity-40"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5 fill-black" />
                <span>Share Story</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateStoryModal;
