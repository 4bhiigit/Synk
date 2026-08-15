import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, Smile, Image as ImageIcon, Flame, X, Loader2 } from 'lucide-react';

const EMOJI_CATEGORIES = {
  'Popular': ['👍', '❤️', '🔥', '😂', '🎉', '🚀', '👋', '🙏', '✨', '💯', '😍', '🤩', '😎', '🥳', '🙌', '👏'],
  'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷'],
  'Gestures': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🧠', '🫀', '👀', '👁️'],
  'Love & Vibes': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐'],
  'Animals': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞'],
  'Food': ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🥗', '🍿', '🍣', '🍦', '🍩', '🍪', '🎂', '☕'],
};

// Curated High-Definition Animated Reaction Stickers (Web-ready transparent PNG/GIFs)
const CURATED_STICKERS = [
  { id: 's1', name: 'Cat Vibe', url: 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif' },
  { id: 's2', name: 'Thumbs Up Doge', url: 'https://media.giphy.com/media/9C1nyePmmMLwnmPyat/giphy.gif' },
  { id: 's3', name: 'Mind Blown', url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif' },
  { id: 's4', name: 'Popcorn Chill', url: 'https://media.giphy.com/media/t3sZxY5zS5B0z5zMIz/giphy.gif' },
  { id: 's5', name: 'Dancing Duck', url: 'https://media.giphy.com/media/WrydLSnn58bda1T58U/giphy.gif' },
  { id: 's6', name: 'Fire Heart', url: 'https://media.giphy.com/media/3o7TKoWXm3okO1kgHC/giphy.gif' },
  { id: 's7', name: 'Hype Dance', url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif' },
  { id: 's8', name: 'Cheers Toast', url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif' },
  { id: 's9', name: 'Cute Bubu', url: 'https://media.giphy.com/media/VbAmVUetR0caEGQ03K/giphy.gif' },
  { id: 's10', name: 'Shocked Cat', url: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif' },
  { id: 's11', name: 'Party Parrot', url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif' },
  { id: 's12', name: 'Cool Shades', url: 'https://media.giphy.com/media/dSetRSJcR352E/giphy.gif' },
];

export const GifStickerPicker = ({ isOpen, onClose, onSelectEmoji, onSelectGif, onSelectSticker }) => {
  const [activeTab, setActiveTab] = useState('emoji'); // 'emoji' | 'gif' | 'sticker'
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Fetch Trending / Searched GIFs from free public Giphy/Tenor endpoint
  useEffect(() => {
    if (activeTab !== 'gif') return;

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoadingGifs(true);
      try {
        const query = searchQuery.trim() || 'trending reactions';
        const url = `https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(
          query
        )}&limit=24&rating=g`;

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const list = (data.data || []).map((g) => ({
            id: g.id,
            title: g.title,
            previewUrl: g.images?.fixed_height_small?.url || g.images?.downsized?.url,
            url: g.images?.downsized_medium?.url || g.images?.original?.url,
          }));
          setGifs(list);
        }
      } catch (err) {
        console.warn('GIF search fallback:', err);
        // Fallback curated GIFs
        setGifs(
          CURATED_STICKERS.map((s) => ({
            id: s.id,
            title: s.name,
            previewUrl: s.url,
            url: s.url,
          }))
        );
      } finally {
        setIsLoadingGifs(false);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [activeTab, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute bottom-full mb-2 left-2 right-2 sm:left-4 sm:right-auto sm:w-96 h-96 rounded-3xl bg-[#121216]/95 backdrop-blur-xl border border-white/15 shadow-2xl z-40 flex flex-col overflow-hidden animate-slide-up select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Tabs */}
      <div className="p-2.5 bg-black/40 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-2xl border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('emoji')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'emoji'
                ? 'bg-white text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>Emoji</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gif')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'gif'
                ? 'bg-white text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>GIFs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sticker')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'sticker'
                ? 'bg-white text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Stickers</span>
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

      {/* Search Input Bar for GIFs / Stickers */}
      {activeTab !== 'emoji' && (
        <div className="p-2.5 bg-black/20 border-b border-white/5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'gif' ? 'Search GIFs on Giphy...' : 'Search Stickers...'}
              className="w-full pl-8 pr-4 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* 1. Emoji Drawer */}
        {activeTab === 'emoji' && (
          <div className="space-y-4">
            {Object.entries(EMOJI_CATEGORIES).map(([catName, emojiList]) => (
              <div key={catName}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">
                  {catName}
                </span>
                <div className="grid grid-cols-8 gap-1">
                  {emojiList.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        onSelectEmoji(emoji);
                      }}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg hover:bg-white/10 hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. GIFs Grid */}
        {activeTab === 'gif' && (
          <div>
            {isLoadingGifs ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
                <span className="text-xs">Searching GIFs...</span>
              </div>
            ) : gifs.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 text-xs">
                No GIFs found for "{searchQuery}"
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {gifs.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => {
                      onSelectGif(g.url);
                      onClose();
                    }}
                    className="relative rounded-xl overflow-hidden aspect-video bg-zinc-900 border border-white/10 hover:border-white/40 cursor-pointer group transition-all"
                  >
                    <img
                      src={g.previewUrl || g.url}
                      alt={g.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. Stickers Grid */}
        {activeTab === 'sticker' && (
          <div className="grid grid-cols-3 gap-2">
            {CURATED_STICKERS.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  onSelectSticker(s.url);
                  onClose();
                }}
                className="flex flex-col items-center justify-center p-2 rounded-2xl bg-zinc-900/60 border border-white/10 hover:bg-white/10 hover:scale-105 cursor-pointer transition-all group"
              >
                <div className="w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center">
                  <img
                    src={s.url}
                    alt={s.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
                <span className="text-[10px] text-zinc-400 mt-1 truncate max-w-full group-hover:text-white font-medium">
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GifStickerPicker;
