import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  PhoneOff,
  Music,
  Play,
  Pause,
  Monitor,
  Mic,
  MicOff,
  Wifi,
  Sparkles,
  Maximize2,
  ChevronDown,
} from 'lucide-react';
import Avatar from '../Common/Avatar';
import { playClickSound } from '../../utils/appleSounds';
import { triggerHaptic } from '../../utils/appleHaptics';

export const DynamicIsland = ({
  // Call state
  callState = 'idle', // 'idle' | 'connected' | 'minimized' | 'ringing_incoming'
  callType = 'voice',
  peerInfo = null,
  callDuration = 0,
  isMuted = false,
  onToggleMute,
  onEndCall,
  onRestoreCall,

  // Music state
  currentTrack = null,
  isPlayingMusic = false,
  onToggleMusic,
  onOpenMusicModal,

  // Screen share state
  isSharingScreen = false,
  onStopScreenShare,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Clock in idle state
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const hasActiveCall = callState === 'connected' || callState === 'minimized';
  const hasIncomingCall = callState === 'ringing_incoming';
  const hasActiveMusic = Boolean(currentTrack);

  const handleIslandClick = () => {
    playClickSound();
    triggerHaptic('light');
    if (hasActiveCall) {
      if (onRestoreCall) onRestoreCall();
    } else if (hasActiveMusic) {
      setIsExpanded(!isExpanded);
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="fixed top-2.5 inset-x-0 z-50 flex justify-center pointer-events-none select-none">
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
        onClick={handleIslandClick}
        className={`pointer-events-auto bg-black border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] cursor-pointer text-white flex items-center justify-between overflow-hidden transition-colors ${
          isExpanded
            ? 'w-[320px] rounded-[32px] p-4 flex-col gap-3'
            : hasActiveCall || hasIncomingCall
            ? 'h-10 px-3 rounded-full gap-3 min-w-[210px]'
            : hasActiveMusic
            ? 'h-10 px-3 rounded-full gap-3 min-w-[230px]'
            : isSharingScreen
            ? 'h-9 px-3 rounded-full gap-2 min-w-[150px]'
            : 'h-8 px-3 rounded-full gap-2 min-w-[125px]'
        }`}
      >
        {isExpanded ? (
          /* ================= Expanded Rich Control Card ================= */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full flex flex-col gap-3"
          >
            {hasActiveMusic ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden bg-zinc-800 flex-shrink-0 border border-white/10">
                    <img
                      src={currentTrack.image || currentTrack.album_art}
                      alt="album"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">
                      {currentTrack.name || currentTrack.title}
                    </h4>
                    <p className="text-[10px] text-zinc-400 truncate">
                      {currentTrack.artist || 'Synced Room Audio'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onToggleMusic) onToggleMusic();
                    }}
                    className="p-2 rounded-full bg-white text-black hover:bg-zinc-200"
                  >
                    {isPlayingMusic ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsExpanded(false);
                      if (onOpenMusicModal) onOpenMusicModal();
                    }}
                    className="px-3 py-1 rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-300 hover:text-white"
                  >
                    Open Queue
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-2">
                <span className="text-xs font-bold text-zinc-300">Nexus Live Activity</span>
                <p className="text-[10px] text-zinc-500 mt-1">Zero active background tasks</p>
              </div>
            )}
          </motion.div>
        ) : hasActiveCall ? (
          /* ================= Active Call Activity ================= */
          <>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center animate-pulse">
                <Phone className="w-3 h-3" />
              </div>
              <span className="text-xs font-bold font-mono text-emerald-400">
                {formatDuration(callDuration)}
              </span>
            </div>

            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={onToggleMute}
                className={`p-1 rounded-full ${isMuted ? 'bg-rose-500/30 text-rose-400' : 'bg-white/15 text-white'}`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
              </button>

              <button
                type="button"
                onClick={onEndCall}
                className="p-1 rounded-full bg-rose-600 text-white hover:bg-rose-700"
                title="Hang Up"
              >
                <PhoneOff className="w-3 h-3" />
              </button>
            </div>
          </>
        ) : hasActiveMusic ? (
          /* ================= Live Music Equalizer Activity ================= */
          <>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-md overflow-hidden flex-shrink-0">
                <img
                  src={currentTrack.image || currentTrack.album_art}
                  alt="track"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xs font-bold text-white truncate max-w-[100px]">
                {currentTrack.name || currentTrack.title}
              </span>
            </div>

            {/* Live Dancing Audio Waveform Equalizer */}
            <div className="flex items-center gap-0.5 h-3.5">
              <div className="w-0.5 h-3 bg-violet-400 rounded-full animate-bounce" style={{ animationDuration: '400ms' }} />
              <div className="w-0.5 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDuration: '600ms' }} />
              <div className="w-0.5 h-3.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDuration: '500ms' }} />
              <div className="w-0.5 h-1.5 bg-violet-300 rounded-full animate-bounce" style={{ animationDuration: '300ms' }} />
            </div>
          </>
        ) : isSharingScreen ? (
          /* ================= Live Screen Share Activity ================= */
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                Screen
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onStopScreenShare) onStopScreenShare();
              }}
              className="p-1 rounded-full bg-white/15 text-white hover:bg-white/25 text-[10px]"
            >
              Stop
            </button>
          </>
        ) : (
          /* ================= Compact Idle Pill ================= */
          <div className="w-full flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] font-mono font-bold text-zinc-300">
              {currentTime || 'SYNK'}
            </span>
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default DynamicIsland;
