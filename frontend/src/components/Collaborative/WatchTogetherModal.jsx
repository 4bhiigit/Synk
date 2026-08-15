import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Tv,
  Play,
  X,
  Link as LinkIcon,
  Maximize2,
  Minimize2,
} from 'lucide-react';

const extractYouTubeId = (url) => {
  if (!url || typeof url !== 'string') return null;
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.trim().match(regExp);
  return match && match[1].length === 11 ? match[1] : null;
};

export const WatchTogetherModal = ({
  isOpen,
  onClose,
  currentUsername,
  activeVideoId = null,
  activeVideoUrl = '',
  onSendVideoLoad,
  onSendVideoSync,
  subscribe,
}) => {
  const [videoUrlInput, setVideoUrlInput] = useState(activeVideoUrl || '');
  const [currentVideoId, setCurrentVideoId] = useState(activeVideoId);
  const [isPlaying, setIsPlaying] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const isInternalChangeRef = useRef(false);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  const initPlayer = useCallback((videoId, startSeconds = 0) => {
    if (!videoId) return;

    const onPlayerReady = (event) => {
      setStatusMessage('In Sync');
      if (startSeconds > 0) {
        event.target.seekTo(startSeconds, true);
      }
    };

    const onPlayerStateChange = (event) => {
      if (isInternalChangeRef.current) return;

      if (event.data === window.YT.PlayerState.PLAYING) {
        setIsPlaying(true);
        const currentTime = playerRef.current ? playerRef.current.getCurrentTime() : 0;
        onSendVideoSync('play', currentTime);
      } else if (event.data === window.YT.PlayerState.PAUSED) {
        setIsPlaying(false);
        const currentTime = playerRef.current ? playerRef.current.getCurrentTime() : 0;
        onSendVideoSync('pause', currentTime);
      }
    };

    const mountYT = () => {
      if (window.YT && window.YT.Player && document.getElementById('yt-player-container')) {
        if (playerRef.current && playerRef.current.destroy) {
          try {
            playerRef.current.destroy();
          } catch (e) {}
        }

        playerRef.current = new window.YT.Player('yt-player-container', {
          height: '100%',
          width: '100%',
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            fs: 1,
          },
          events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
          },
        });
      } else {
        window.onYouTubeIframeAPIReady = () => mountYT();
      }
    };

    mountYT();
  }, [onSendVideoSync]);

  useEffect(() => {
    if (activeVideoId && activeVideoId !== currentVideoId) {
      setCurrentVideoId(activeVideoId);
    }
    if (activeVideoUrl && !videoUrlInput) {
      setVideoUrlInput(activeVideoUrl);
    }
  }, [activeVideoId, activeVideoUrl]);

  useEffect(() => {
    if (isOpen && (currentVideoId || activeVideoId)) {
      const vid = currentVideoId || activeVideoId;
      const timer = setTimeout(() => {
        initPlayer(vid, 0);
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen, currentVideoId, activeVideoId, initPlayer]);

  const handleStartSession = (e) => {
    e.preventDefault();
    const videoId = extractYouTubeId(videoUrlInput.trim());
    if (!videoId) {
      alert('Please enter a valid YouTube Video link');
      return;
    }

    setCurrentVideoId(videoId);
    initPlayer(videoId, 0);
    onSendVideoLoad(videoUrlInput.trim(), videoId, 'YouTube Video');
    setStatusMessage(`Host: ${currentUsername}`);
  };

  // Direct socket event listeners (zero parent re-renders)
  useEffect(() => {
    if (!subscribe) return;

    const unsubLoad = subscribe('video_load', (payload) => {
      if (payload.video_id) {
        setCurrentVideoId(payload.video_id);
        initPlayer(payload.video_id, 0);
        setStatusMessage(`Synced (${payload.sender_name || 'Host'})`);
      }
    });

    const unsubSync = subscribe('video_sync', (payload) => {
      if (!playerRef.current) return;
      isInternalChangeRef.current = true;
      setIsSyncing(true);

      const localTime = playerRef.current.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
      const targetTime = payload.current_time || 0;

      if (Math.abs(localTime - targetTime) > 1.5) {
        playerRef.current.seekTo(targetTime, true);
      }

      if (payload.action === 'play') {
        playerRef.current.playVideo();
        setIsPlaying(true);
        setStatusMessage(`Playing (${payload.sender_name})`);
      } else if (payload.action === 'pause') {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
        setStatusMessage(`Paused (${payload.sender_name})`);
      }

      setTimeout(() => {
        isInternalChangeRef.current = false;
        setIsSyncing(false);
      }, 500);
    });

    return () => {
      unsubLoad();
      unsubSync();
    };
  }, [subscribe, initPlayer]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 animate-fade-in">
      <div
        className={`w-full transition-all duration-200 rounded-2xl md:rounded-3xl glass-panel shadow-2xl border border-white/10 overflow-hidden flex flex-col ${
          isExpanded ? 'max-w-[96vw] h-[94vh]' : 'max-w-5xl max-h-[90vh]'
        }`}
      >
        {/* Compact Clean Header */}
        <div className="px-4 py-2.5 bg-[#09090b] border-b border-white/10 flex items-center justify-between select-none flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-white text-black font-bold shadow-md">
              <Tv className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs md:text-sm text-white">Watch Together</h3>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-medium">YouTube Sync</span>
              </div>
              <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{statusMessage}</span>
                {isSyncing && <span className="text-zinc-500 italic">(Syncing)</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="btn-icon p-1.5"
              title={isExpanded ? 'Exit Theater Mode' : 'Theater / Full Width'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="btn-icon p-1.5" title="Close Player">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Load URL Form */}
        <div className="px-4 py-2 bg-[#121215] border-b border-white/5 flex-shrink-0">
          <form onSubmit={handleStartSession} className="flex items-center gap-2">
            <div className="flex-1 relative">
              <LinkIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="url"
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                placeholder="Paste YouTube Link (e.g. https://www.youtube.com/watch?v=...)"
                className="w-full pl-9 pr-3 py-1.5 rounded-xl glass-input text-xs focus:outline-none placeholder-zinc-500"
              />
            </div>
            <button
              type="submit"
              className="btn-primary px-3.5 py-1.5 text-xs flex items-center gap-1.5 flex-shrink-0"
            >
              <Play className="w-3 h-3 fill-black" />
              <span>Load</span>
            </button>
          </form>
        </div>

        {/* 16:9 Ratio Responsive Screen */}
        <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden min-h-[300px]">
          <div
            className={`w-full h-full ${
              isExpanded ? 'h-full' : 'aspect-video max-h-[72vh]'
            } flex items-center justify-center`}
          >
            <div id="yt-player-container" ref={containerRef} className="w-full h-full" />
          </div>

          {!currentVideoId && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-zinc-500 select-none">
              <Tv className="w-10 h-10 mb-2 opacity-30 text-white" />
              <p className="text-xs md:text-sm font-bold text-zinc-200">No active video stream</p>
              <p className="text-[11px] text-zinc-500 mt-0.5 max-w-sm">
                Paste any YouTube video link above to watch in sync with everyone in this room!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WatchTogetherModal;
