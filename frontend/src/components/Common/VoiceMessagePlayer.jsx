import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Volume2, Sparkles } from 'lucide-react';

export const VoiceMessagePlayer = ({ audioUrl, isSelf = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const audioRef = useRef(null);

  // Generate a realistic, unique waveform pattern from URL hash
  const waveformHeights = useMemo(() => {
    const defaultPattern = [
      30, 50, 80, 45, 95, 70, 40, 85, 60, 100, 75, 45, 90, 65, 35, 80,
      55, 95, 70, 40, 85, 60, 100, 75, 50, 90, 65, 40, 80, 55, 70, 45,
      60, 85, 40, 65
    ];
    if (!audioUrl) return defaultPattern;

    let hash = 0;
    for (let i = 0; i < audioUrl.length; i++) {
      hash = (hash << 5) - hash + audioUrl.charCodeAt(i);
      hash |= 0;
    }

    return Array.from({ length: 36 }, (_, i) => {
      const pseudoVal = Math.abs(Math.sin(hash + i * 1.7)) * 75 + 25;
      return Math.round(pseudoVal);
    });
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const togglePlay = (e) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn('Audio playback error:', err);
      });
    }
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const newTime = Number(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleSpeed = (e) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    const speeds = [1, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    audio.playbackRate = nextSpeed;
    setPlaybackRate(nextSpeed);
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-2xl select-none min-w-[240px] sm:min-w-[280px] transition-all shadow-sm ${
        isSelf
          ? 'bg-zinc-200 text-black font-medium'
          : 'bg-[#18181b] text-white border border-white/10'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Play / Pause Circular Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 shadow-md ${
          isSelf
            ? 'bg-black text-white hover:bg-zinc-800'
            : 'bg-white text-black hover:bg-zinc-200'
        }`}
        title={isPlaying ? 'Pause' : 'Play Voice Note'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Interactive Waveform Visualizer Scrubber & Time */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="relative flex items-center h-5 group">
          {/* Dynamic Amplitude Waveform Bars */}
          <div className="absolute inset-0 flex items-center gap-0.5 pointer-events-none">
            {waveformHeights.map((h, i) => {
              const barProgress = (i / waveformHeights.length) * 100;
              const isPassed = barProgress <= progressPercent;

              return (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className={`flex-1 rounded-full transition-all duration-100 ${
                    isPassed
                      ? isSelf
                        ? 'bg-black'
                        : 'bg-gradient-to-t from-violet-400 to-indigo-300'
                      : isSelf
                      ? 'bg-black/20'
                      : 'bg-white/20'
                  }`}
                />
              );
            })}
          </div>

          {/* Invisible interactive range input for precise scrubbing */}
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.05"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-full opacity-0 cursor-pointer z-10"
          />
        </div>

        {/* Timestamps */}
        <div
          className={`flex items-center justify-between text-[10px] font-mono ${
            isSelf ? 'text-zinc-600 font-semibold' : 'text-zinc-400'
          }`}
        >
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration || 0)}</span>
        </div>
      </div>

      {/* Playback Speed Multiplier (1x, 1.5x, 2x) */}
      <button
        type="button"
        onClick={toggleSpeed}
        className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition-colors ${
          isSelf
            ? 'bg-black/10 hover:bg-black/20 text-black'
            : 'bg-white/10 hover:bg-white/20 text-white'
        }`}
        title="Change Speed (1x, 1.5x, 2x)"
      >
        {playbackRate}x
      </button>
    </div>
  );
};

export default VoiceMessagePlayer;
