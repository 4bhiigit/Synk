import React, { useEffect, useRef, useState } from 'react';
import {
  Monitor,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Radio,
  X,
  Layers,
  Sparkles,
  Sliders,
  Tv,
} from 'lucide-react';

export const ScreenShareViewer = ({
  isOpen,
  onClose,
  stream,
  isSharing,
  sharerName,
  latencyMs = 24,
  qualityMode = '1080p',
  onToggleQuality,
  isAudioMuted,
  onToggleAudio,
  onStopSharing,
}) => {
  const [viewMode, setViewMode] = useState('docked'); // 'docked' | 'cinema' | 'pip'
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef(null);
  const containerRef = useRef(null);

  // Bind video stream to element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((e) => console.log('Autoplay handled:', e));
    }
  }, [stream]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setViewMode('docked');
      } else if (videoRef.current) {
        await videoRef.current.requestPictureInPicture();
        setViewMode('pip');
      }
    } catch (err) {
      console.error('Picture-in-Picture error:', err);
    }
  };

  if (!isOpen || !stream) return null;

  return (
    <div
      ref={containerRef}
      className={`transition-all duration-300 select-none overflow-hidden ${
        viewMode === 'cinema'
          ? 'fixed inset-0 z-50 bg-black/95 flex flex-col p-4'
          : viewMode === 'pip'
          ? 'fixed bottom-20 right-6 w-80 z-40 rounded-2xl glass-panel shadow-2xl border border-white/20'
          : 'relative w-full bg-[#0a0a0d] border-b border-white/10 flex flex-col'
      }`}
    >
      {/* Top HUD Overlay Bar */}
      <div className="p-2.5 bg-[#09090b]/90 border-b border-white/10 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold tracking-wider uppercase">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>LIVE SCREEN</span>
          </div>

          <span className="text-xs font-bold text-white truncate max-w-[150px] sm:max-w-xs">
            {isSharing ? 'Your Screen' : `${sharerName || 'User'}'s Screen`}
          </span>

          <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-lg bg-black/50 border border-white/5 text-emerald-400">
            <Radio className="w-3 h-3 text-emerald-400" />
            <span>{latencyMs}ms ping (P2P Direct)</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Quality Mode Switcher */}
          {onToggleQuality && (
            <div className="hidden sm:flex items-center rounded-lg bg-zinc-900 border border-white/10 p-0.5 text-[10px] font-mono font-bold mr-1">
              <button
                type="button"
                onClick={() => onToggleQuality('720p')}
                className={`px-1.5 py-0.5 rounded ${
                  qualityMode === '720p' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                720p
              </button>
              <button
                type="button"
                onClick={() => onToggleQuality('1080p')}
                className={`px-1.5 py-0.5 rounded ${
                  qualityMode === '1080p' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                1080p 60fps
              </button>
            </div>
          )}

          {/* Audio Toggle */}
          {onToggleAudio && (
            <button
              type="button"
              onClick={onToggleAudio}
              className="btn-icon p-1.5"
              title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isAudioMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Picture-in-Picture Toggle */}
          <button
            type="button"
            onClick={togglePiP}
            className="btn-icon p-1.5 hidden sm:inline-flex"
            title="Picture-in-Picture"
          >
            <Tv className="w-3.5 h-3.5" />
          </button>

          {/* Cinema / Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => {
              if (viewMode === 'docked') setViewMode('cinema');
              else setViewMode('docked');
            }}
            className="btn-icon p-1.5"
            title={viewMode === 'cinema' ? 'Exit Cinema Mode' : 'Cinema Mode'}
          >
            {viewMode === 'cinema' ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Fullscreen API */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="btn-icon p-1.5 hidden sm:inline-flex"
            title="Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Stop / Close Button */}
          {isSharing ? (
            <button
              type="button"
              onClick={onStopSharing}
              className="px-2.5 py-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors ml-1 shadow-md"
              title="Stop Screen Sharing"
            >
              Stop Sharing
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-white"
              title="Hide Viewer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Video Viewport */}
      <div
        className={`relative w-full bg-black flex items-center justify-center ${
          viewMode === 'cinema' ? 'flex-1 min-h-0' : viewMode === 'pip' ? 'h-48' : 'h-64 md:h-96'
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSharing || isAudioMuted}
          className="w-full h-full object-contain bg-black"
        />

        {/* Live Watermark Overlay */}
        <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-[10px] font-mono text-zinc-400 pointer-events-none flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>WebRTC P2P Direct</span>
        </div>
      </div>
    </div>
  );
};

export default ScreenShareViewer;
