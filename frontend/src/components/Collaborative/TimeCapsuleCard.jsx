import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Clock,
  Sparkles,
  PartyPopper,
  Calendar,
  Eye,
  EyeOff,
} from 'lucide-react';
import { format } from 'date-fns';

export const TimeCapsuleCard = ({
  message,
  currentUserId,
  onUnlockRequest,
  onImageClick,
  subscribe,
}) => {
  const [unlockedState, setUnlockedState] = useState({
    isUnlocked: message.is_unlocked || false,
    content: message.content,
    mediaUrl: message.media_url,
  });

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalSecondsRemaining: 0,
  });

  const [celebrate, setCelebrate] = useState(false);

  const isSender = message.sender?.id === currentUserId || message.sender_id === currentUserId;
  const unlockDate = message.unlock_at ? new Date(message.unlock_at) : null;

  // Calculate live high-precision countdown
  useEffect(() => {
    if (unlockedState.isUnlocked || !unlockDate) return;

    const calculateTime = () => {
      const now = new Date();
      const diff = unlockDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, totalSecondsRemaining: 0 });
        if (!unlockedState.isUnlocked && onUnlockRequest) {
          onUnlockRequest(message.id);
        }
        return;
      }

      const totalSecs = Math.floor(diff / 1000);
      const days = Math.floor(totalSecs / 86400);
      const hours = Math.floor((totalSecs % 86400) / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;

      setTimeLeft({
        days,
        hours,
        minutes,
        seconds,
        totalSecondsRemaining: totalSecs,
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [unlockDate, unlockedState.isUnlocked, message.id, onUnlockRequest]);

  // Direct socket listener for capsule unlock broadcast
  useEffect(() => {
    if (!subscribe) return;

    const unsubUnlock = subscribe('capsule_unlocked', (payload) => {
      if (payload.message_id === message.id) {
        setUnlockedState({
          isUnlocked: true,
          content: payload.content,
          mediaUrl: payload.media_url,
        });
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 5000);
      }
    });

    return () => unsubUnlock();
  }, [subscribe, message.id]);

  const formatTargetDate = (date) => {
    if (!date) return '';
    try {
      return format(date, 'MMM d, yyyy @ h:mm a');
    } catch {
      return '';
    }
  };

  const isActuallyLocked = !unlockedState.isUnlocked && timeLeft.totalSecondsRemaining > 0;

  return (
    <div
      className={`w-full max-w-sm rounded-3xl p-4 transition-all duration-500 shadow-2xl border ${
        isActuallyLocked
          ? 'bg-gradient-to-b from-[#18181b] to-[#09090b] border-amber-500/30 ring-1 ring-amber-500/20'
          : 'bg-[#141417] border-white/15'
      } my-2 animate-slide-up select-none`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-2xl font-bold shadow-md transition-colors ${
              isActuallyLocked ? 'bg-amber-400 text-black animate-pulse' : 'bg-white text-black'
            }`}
          >
            {isActuallyLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4 text-black" />}
          </div>
          <div>
            <h4 className="text-xs md:text-sm font-bold text-white flex items-center gap-1.5">
              {message.capsule_title || 'Time Capsule'}
            </h4>
            <p className="text-[10px] text-zinc-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Unlocks: {formatTargetDate(unlockDate)}
            </p>
          </div>
        </div>

        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
            isActuallyLocked
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
          }`}
        >
          {isActuallyLocked ? 'Locked' : 'Revealed'}
        </span>
      </div>

      {/* Body: Locked Countdown or Revealed Message */}
      {isActuallyLocked ? (
        <div className="py-4 flex flex-col items-center justify-center text-center">
          {/* Live Countdown Grid */}
          <div className="grid grid-cols-4 gap-2 w-full my-2">
            <div className="p-2 rounded-2xl bg-black/60 border border-white/5 flex flex-col items-center">
              <span className="font-mono text-base font-extrabold text-white">{timeLeft.days}</span>
              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Days</span>
            </div>
            <div className="p-2 rounded-2xl bg-black/60 border border-white/5 flex flex-col items-center">
              <span className="font-mono text-base font-extrabold text-white">{timeLeft.hours}</span>
              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Hours</span>
            </div>
            <div className="p-2 rounded-2xl bg-black/60 border border-white/5 flex flex-col items-center">
              <span className="font-mono text-base font-extrabold text-white">{timeLeft.minutes}</span>
              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Mins</span>
            </div>
            <div className="p-2 rounded-2xl bg-black/60 border border-white/5 flex flex-col items-center">
              <span className="font-mono text-base font-extrabold text-amber-400 animate-pulse">
                {timeLeft.seconds}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Secs</span>
            </div>
          </div>

          {isSender ? (
            <div className="mt-3 p-2.5 rounded-xl bg-white/5 border border-white/5 w-full text-left">
              <span className="text-[10px] text-zinc-400 font-semibold block mb-1 flex items-center gap-1">
                <Eye className="w-3 h-3 text-zinc-400" /> Sender Preview (Hidden from recipients):
              </span>
              <p className="text-xs text-zinc-300 italic">"{message.content}"</p>
            </div>
          ) : (
            <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1.5 font-medium">
              <Lock className="w-3.5 h-3.5 text-amber-400" /> Content will be revealed automatically on unlock.
            </p>
          )}
        </div>
      ) : (
        /* Revealed Content */
        <div className="py-3 animate-fade-in relative">
          {celebrate && (
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white text-black px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-2xl animate-bounce">
              <PartyPopper className="w-3.5 h-3.5 text-amber-500" />
              <span>Time Capsule Opened!</span>
            </div>
          )}

          {unlockedState.mediaUrl && (
            <div
              onClick={() => onImageClick && onImageClick(unlockedState.mediaUrl)}
              className="mb-2.5 rounded-2xl overflow-hidden max-h-56 border border-white/10 cursor-pointer hover:opacity-90 transition-opacity"
            >
              <img
                src={unlockedState.mediaUrl}
                alt="capsule media"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <p className="text-xs md:text-sm text-zinc-100 font-medium whitespace-pre-wrap leading-relaxed">
            {unlockedState.content || message.content}
          </p>
        </div>
      )}
    </div>
  );
};

export default TimeCapsuleCard;
