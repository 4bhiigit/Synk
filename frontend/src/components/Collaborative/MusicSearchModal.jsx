import React, { useState, useEffect, useRef } from 'react';
import {
  Music,
  Search,
  Play,
  Plus,
  X,
  Loader2,
  Disc,
  Clock,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { searchMusic } from '../../utils/musicApi';

const QUICK_SEARCH_CHIPS = [
  'Arijit Singh',
  'Lofi Chill Beats',
  'Coldplay',
  'Diljit Dosanjh',
  'Bollywood Hits',
  'Alan Walker',
  'Sidhu Moose Wala',
  'Taylor Swift',
];

export const MusicSearchModal = ({
  isOpen,
  onClose,
  onPlayTrack,
  onAddToQueue,
  currentTrack,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addedIds, setAddedIds] = useState(new Set());

  const searchTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      if (!query && results.length === 0) {
        performSearch('Trending');
      }
    }
  }, [isOpen]);

  const performSearch = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    try {
      setIsLoading(true);
      const tracks = await searchMusic(searchTerm);
      setResults(tracks);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(val);
    }, 350);
  };

  const handleChipClick = (chip) => {
    setQuery(chip);
    performSearch(chip);
  };

  const handlePlay = (track) => {
    onPlayTrack(track);
    onClose();
  };

  const handleQueue = (e, track) => {
    e.stopPropagation();
    onAddToQueue(track);
    setAddedIds((prev) => new Set(prev).add(track.id));
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }, 2000);
  };

  const formatDuration = (secs) => {
    if (!secs) return '3:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-2xl rounded-3xl glass-panel shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Modal Header */}
        <div className="p-4 bg-[#09090b] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white font-bold shadow-lg">
              <Music className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Live In-Chat Music</h3>
              <p className="text-[11px] text-zinc-400">Search songs & stream in real-time together</p>
            </div>
          </div>

          <button onClick={onClose} className="btn-icon p-1.5" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar & Quick Chips */}
        <div className="p-4 border-b border-white/10 bg-[#0d0d10] space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder="Search song, artist, movie or lyrics keywords..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl glass-input text-xs md:text-sm focus:outline-none"
            />
            {isLoading && (
              <Loader2 className="w-4 h-4 text-zinc-400 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
            )}
          </div>

          {/* Quick Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex-shrink-0">
              Popular:
            </span>
            {QUICK_SEARCH_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleChipClick(chip)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0 transition-colors ${
                  query === chip
                    ? 'bg-white text-black font-bold'
                    : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 bg-[#09090b]">
          {isLoading && results.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-zinc-500 text-xs">
              <Loader2 className="w-6 h-6 animate-spin mb-2 text-white" />
              <span>Searching song catalog...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
              <Disc className="w-8 h-8 text-zinc-600 mb-2" />
              <p className="text-xs font-semibold text-zinc-400">No matching tracks found</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Try searching with different song titles, artist names, or movies.
              </p>
            </div>
          ) : (
            results.map((track) => {
              const isPlayingCurrent = currentTrack?.id === track.id;
              const isAdded = addedIds.has(track.id);

              return (
                <div
                  key={track.id}
                  onClick={() => handlePlay(track)}
                  className={`p-2.5 rounded-2xl flex items-center justify-between gap-3 group transition-colors cursor-pointer ${
                    isPlayingCurrent
                      ? 'bg-white/10 border border-white/20'
                      : 'hover:bg-zinc-800/70 border border-transparent'
                  }`}
                >
                  {/* Track Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/10 relative group/art">
                      <img
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/art:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-5 h-5 fill-white text-white" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4
                        className={`text-xs md:text-sm font-bold truncate ${
                          isPlayingCurrent ? 'text-violet-400' : 'text-white group-hover:text-violet-300'
                        }`}
                      >
                        {track.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {track.artist} {track.album ? `• ${track.album}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Duration */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
                      {formatDuration(track.duration)}
                    </span>

                    {/* Add to Queue Button */}
                    <button
                      type="button"
                      onClick={(e) => handleQueue(e, track)}
                      className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                        isAdded
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                      }`}
                      title="Add to shared room queue"
                    >
                      {isAdded ? (
                        <span>Added!</span>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Queue</span>
                        </>
                      )}
                    </button>

                    {/* Play Now Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlay(track);
                      }}
                      className="btn-primary p-2 sm:px-3 sm:py-1.5 text-xs font-bold flex items-center gap-1 shadow-md"
                      title="Play live for everyone in chat"
                    >
                      <Play className="w-3.5 h-3.5 fill-black" />
                      <span className="hidden sm:inline">Play</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default MusicSearchModal;
