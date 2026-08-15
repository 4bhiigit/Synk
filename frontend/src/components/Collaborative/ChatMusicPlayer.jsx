import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  ListMusic,
  X,
  Music,
  Trash2,
  Loader2,
  AlertCircle,
  RotateCcw,
  Plus,
} from 'lucide-react';

export const ChatMusicPlayer = ({
  currentTrack,
  onTrackChange,
  queue = [],
  onQueueUpdate,
  onSyncAction,
  subscribe,
  currentUserId,
  onOpenSearch,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [streamError, setStreamError] = useState(null);

  const audioRef = useRef(null);
  const fallbackIndexRef = useRef(0);
  const isRemoteUpdateRef = useRef(false);

  // Helper to get all available stream URLs for the current track
  const getStreamUrls = useCallback((track) => {
    if (!track) return [];
    if (Array.isArray(track.streamUrls) && track.streamUrls.length > 0) {
      return track.streamUrls.filter(Boolean);
    }
    return track.streamUrl ? [track.streamUrl] : [];
  }, []);

  // 1. When currentTrack changes, load and play the new track smoothly
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack) {
      audio.pause();
      audio.src = '';
      setIsPlaying(false);
      setIsBuffering(false);
      setCurrentTime(0);
      setDuration(0);
      setStreamError(null);
      return;
    }

    const streams = getStreamUrls(currentTrack);
    if (streams.length === 0) {
      setStreamError('No audio stream URL available for this track.');
      setIsPlaying(false);
      setIsBuffering(false);
      return;
    }

    // Pick highest quality stream (last in array)
    fallbackIndexRef.current = streams.length - 1;
    const initialStreamUrl = streams[fallbackIndexRef.current];

    setStreamError(null);
    setIsBuffering(true);
    setCurrentTime(0);
    setDuration(currentTrack.duration || 0);

    audio.pause();
    audio.src = initialStreamUrl;
    audio.currentTime = 0;
    audio.volume = isMuted ? 0 : volume;
    audio.load();

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
          setStreamError(null);
        })
        .catch((err) => {
          // Ignore AbortError if interrupted by another track selection
          if (err.name === 'AbortError') return;
          console.warn('Autoplay prevented or pending user click:', err);
          setIsPlaying(false);
          setIsBuffering(false);
        });
    }
  }, [currentTrack?.id, currentTrack?.streamUrl, getStreamUrls]);

  // 2. Synchronize Remote WebSocket Events
  useEffect(() => {
    if (!subscribe) return;

    // Remote Track Change
    const unsubTrack = subscribe('music_change_track', (payload) => {
      if (payload?.track && onTrackChange) {
        onTrackChange(payload.track);
      }
    });

    // Remote Play/Pause/Seek Sync
    const unsubSync = subscribe('music_sync_action', (payload) => {
      const audio = audioRef.current;
      if (!audio || !payload) return;

      isRemoteUpdateRef.current = true;

      if (payload.action === 'play') {
        if (typeof payload.current_time === 'number' && Math.abs(audio.currentTime - payload.current_time) > 2) {
          audio.currentTime = payload.current_time;
        }
        audio
          .play()
          .then(() => {
            setIsPlaying(true);
            setIsBuffering(false);
          })
          .catch(() => {});
      } else if (payload.action === 'pause') {
        audio.pause();
        setIsPlaying(false);
      } else if (payload.action === 'seek') {
        if (typeof payload.current_time === 'number') {
          audio.currentTime = payload.current_time;
          setCurrentTime(payload.current_time);
        }
      }

      setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 400);
    });

    // Remote Queue Update
    const unsubQueue = subscribe('music_queue_update', (payload) => {
      if (Array.isArray(payload?.queue) && onQueueUpdate) {
        onQueueUpdate(payload.queue);
      }
    });

    return () => {
      unsubTrack();
      unsubSync();
      unsubQueue();
    };
  }, [subscribe, onTrackChange, onQueueUpdate]);

  // 3. MediaSession API integration (Lock screen / Background controls)
  useEffect(() => {
    if (!currentTrack || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'Nexus Live Audio',
        artist: currentTrack.artist || 'Nexus Chat',
        album: currentTrack.album || 'Nexus Live Room',
        artwork: [
          {
            src: currentTrack.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150',
            sizes: '300x300',
            type: 'image/jpeg',
          },
        ],
      });

      navigator.mediaSession.setActionHandler('play', () => handlePlay());
      navigator.mediaSession.setActionHandler('pause', () => handlePause());
      navigator.mediaSession.setActionHandler('nexttrack', () => handleNextTrack());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (audioRef.current && details.seekTime !== undefined) {
          audioRef.current.currentTime = details.seekTime;
          setCurrentTime(details.seekTime);
        }
      });
    } catch (e) {
      console.warn('MediaSession error:', e);
    }
  }, [currentTrack, queue]);

  // Audio Element Event Handlers
  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio && audio.duration && !isNaN(audio.duration)) {
      setDuration(audio.duration);
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    }
  };

  const handleCanPlay = () => {
    setIsBuffering(false);
    setStreamError(null);
  };

  const handleWaiting = () => {
    setIsBuffering(true);
  };

  const handlePlaying = () => {
    setIsBuffering(false);
    setIsPlaying(true);
    setStreamError(null);
  };

  const handlePauseEvent = () => {
    setIsPlaying(false);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);

    // Auto-advance to next song in queue
    if (queue && queue.length > 0) {
      const nextSong = queue[0];
      const remaining = queue.slice(1);
      if (onTrackChange) onTrackChange(nextSong);
      if (onQueueUpdate) onQueueUpdate(remaining);
    }
  };

  const handleAudioError = (e) => {
    console.warn('Audio playback error on stream:', audioRef.current?.src, e);
    setIsBuffering(false);

    const streams = getStreamUrls(currentTrack);
    // Try lower bitrate stream fallback
    if (fallbackIndexRef.current > 0) {
      fallbackIndexRef.current -= 1;
      const nextStream = streams[fallbackIndexRef.current];
      console.info(`Switching stream quality fallback to: ${nextStream}`);
      if (audioRef.current && nextStream) {
        audioRef.current.src = nextStream;
        audioRef.current.load();
        audioRef.current.play().catch(() => {});
        return;
      }
    }

    setStreamError('Playback failed. Tap Retry or pick another song.');
    setIsPlaying(false);
  };

  // Play / Pause Logic
  const handlePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsBuffering(true);
    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        setIsBuffering(false);
        setStreamError(null);
        if (onSyncAction && !isRemoteUpdateRef.current) {
          onSyncAction('play', audio.currentTime);
        }
      })
      .catch((err) => {
        console.error('Manual play failed:', err);
        setIsPlaying(false);
        setIsBuffering(false);
      });
  };

  const handlePause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    setIsPlaying(false);
    setIsBuffering(false);
    if (onSyncAction && !isRemoteUpdateRef.current) {
      onSyncAction('pause', audio.currentTime);
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = Number(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);

    if (onSyncAction && !isRemoteUpdateRef.current) {
      onSyncAction('seek', newTime);
    }
  };

  const handleNextTrack = () => {
    if (queue && queue.length > 0) {
      const nextSong = queue[0];
      const remaining = queue.slice(1);
      if (onTrackChange) onTrackChange(nextSong);
      if (onQueueUpdate) onQueueUpdate(remaining);
    }
  };

  const handlePlayQueuedTrack = (qTrack, qIdx) => {
    const remaining = queue.filter((_, idx) => idx !== qIdx);
    if (onTrackChange) onTrackChange(qTrack);
    if (onQueueUpdate) onQueueUpdate(remaining);
  };

  const handleRemoveFromQueue = (index) => {
    if (!queue || !onQueueUpdate) return;
    const updated = queue.filter((_, idx) => idx !== index);
    onQueueUpdate(updated);
  };

  const handleVolumeChange = (e) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.85;
      audioRef.current.muted = false;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      audioRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const handleRetry = () => {
    setStreamError(null);
    setIsBuffering(true);
    const audio = audioRef.current;
    if (audio && currentTrack) {
      const streams = getStreamUrls(currentTrack);
      fallbackIndexRef.current = Math.max(0, streams.length - 1);
      audio.src = streams[fallbackIndexRef.current] || currentTrack.streamUrl;
      audio.load();
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        })
        .catch(() => {
          setIsPlaying(false);
          setIsBuffering(false);
        });
    }
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!currentTrack) return null;

  return (
    <div className="bg-[#0f0f13] border-b border-white/10 px-3 py-2 flex flex-col relative z-20 select-none animate-slide-up shadow-lg">
      {/* HTML5 Audio Element */}
      <audio
        ref={audioRef}
        preload="auto"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onCanPlay={handleCanPlay}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onPause={handlePauseEvent}
        onEnded={handleEnded}
        onError={handleAudioError}
      />

      <div className="flex items-center justify-between gap-3">
        {/* Track Thumbnail & Titles */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:max-w-xs">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-black flex-shrink-0 border border-white/10 relative shadow-inner">
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150';
              }}
            />
            {isPlaying && !isBuffering && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center gap-0.5">
                <span className="w-0.5 h-3 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-0.5 h-4.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-0.5 h-2.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            {isBuffering && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h5 className="text-xs font-bold text-white truncate leading-tight flex items-center gap-1.5">
              <span className="truncate">{currentTrack.title}</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-violet-500/25 text-violet-300 font-semibold uppercase tracking-wider flex-shrink-0">
                LIVE
              </span>
            </h5>
            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
              {currentTrack.artist}
            </p>
          </div>
        </div>

        {/* Center Controls & Progress Slider */}
        <div className="flex-1 max-w-md hidden md:flex flex-col items-center gap-1">
          <div className="flex items-center gap-3">
            {streamError ? (
              <button
                type="button"
                onClick={handleRetry}
                className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-semibold flex items-center gap-1 transition-colors shadow"
                title="Retry Playback"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTogglePlay}
                className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isBuffering ? (
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                ) : isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-black" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleNextTrack}
              disabled={!queue || queue.length === 0}
              className="btn-icon p-1.5 disabled:opacity-30 hover:text-white transition-colors"
              title="Next in Queue"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Time Scrubber */}
          <div className="w-full flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-400 w-8 text-right">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.5"
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-400"
            />
            <span className="text-[10px] font-mono text-zinc-400 w-8">
              {formatTime(duration || currentTrack.duration)}
            </span>
          </div>
        </div>

        {/* Right Tools (Volume, Queue, Search, Close) */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Mobile Play/Pause button */}
          <button
            type="button"
            onClick={handleTogglePlay}
            className="md:hidden w-7 h-7 rounded-full bg-white text-black flex items-center justify-center cursor-pointer shadow"
          >
            {isBuffering ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
            ) : isPlaying ? (
              <Pause className="w-3 h-3 fill-black" />
            ) : (
              <Play className="w-3 h-3 fill-black ml-0.5" />
            )}
          </button>

          {/* Volume Slider */}
          <div className="hidden lg:flex items-center gap-1.5 mr-1">
            <button
              type="button"
              onClick={toggleMute}
              className="text-zinc-400 hover:text-white transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-14 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-400"
            />
          </div>

          {/* Queue Button */}
          <button
            type="button"
            onClick={() => setIsQueueOpen((prev) => !prev)}
            className={`btn-icon p-1.5 relative transition-colors ${isQueueOpen ? 'bg-white text-black font-bold' : ''}`}
            title="Shared Room Queue"
          >
            <ListMusic className="w-3.5 h-3.5" />
            {queue && queue.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-violet-500 text-[9px] font-bold text-white flex items-center justify-center shadow">
                {queue.length}
              </span>
            )}
          </button>

          {/* Search Button */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="btn-icon p-1.5 hover:text-violet-300 transition-colors"
            title="Search More Songs"
          >
            <Music className="w-3.5 h-3.5" />
          </button>

          {/* Close Player */}
          <button
            type="button"
            onClick={() => onTrackChange(null)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close Music Player"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stream Error Alert */}
      {streamError && (
        <div className="mt-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
            <span className="truncate">{streamError}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <button
              type="button"
              onClick={handleRetry}
              className="text-[10px] font-bold underline hover:text-white"
            >
              Retry
            </button>
            {queue && queue.length > 0 && (
              <button
                type="button"
                onClick={handleNextTrack}
                className="text-[10px] font-bold text-violet-400 underline hover:text-violet-300"
              >
                Skip Next
              </button>
            )}
          </div>
        </div>
      )}

      {/* Expandable Queue Drawer */}
      {isQueueOpen && (
        <div className="mt-2 pt-2 border-t border-white/10 animate-slide-up">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
              Shared Queue ({queue?.length || 0} tracks)
            </span>
            <button
              type="button"
              onClick={onOpenSearch}
              className="text-[11px] text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Add Song</span>
            </button>
          </div>

          {!queue || queue.length === 0 ? (
            <div className="py-3 px-2 rounded-xl bg-black/20 border border-white/5 text-center">
              <p className="text-xs text-zinc-400 italic">
                Queue is empty. Click{' '}
                <button
                  type="button"
                  onClick={onOpenSearch}
                  className="text-violet-400 underline font-semibold mx-1"
                >
                  + Add Song
                </button>{' '}
                or type <code className="text-zinc-300 bg-white/10 px-1 py-0.5 rounded text-[11px]">/play &lt;song&gt;</code> in chat!
              </p>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {queue.map((qTrack, qIdx) => (
                <div
                  key={`${qTrack.id}-${qIdx}`}
                  className="p-1.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-2 hover:bg-zinc-800/60 transition-colors group"
                >
                  <div
                    onClick={() => handlePlayQueuedTrack(qTrack, qIdx)}
                    className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                    title="Click to play now"
                  >
                    <span className="text-[10px] font-mono text-zinc-500 w-3.5 text-center flex-shrink-0">{qIdx + 1}</span>
                    <img
                      src={qTrack.thumbnail}
                      alt={qTrack.title}
                      className="w-7 h-7 rounded-lg object-cover flex-shrink-0 border border-white/5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-zinc-200 group-hover:text-violet-300 truncate transition-colors">
                        {qTrack.title}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">{qTrack.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePlayQueuedTrack(qTrack, qIdx)}
                      className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
                      title="Play Now"
                    >
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromQueue(qIdx)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatMusicPlayer;
