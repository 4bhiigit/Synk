import React from 'react';
import { Tv, Play } from 'lucide-react';

const extractYouTubeId = (url) => {
  if (!url) return null;
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = String(url).match(regExp);
  return match && match[1].length === 11 ? match[1] : null;
};

export const WatchPartyCard = ({
  message,
  currentUserId,
  onJoinWatchParty,
}) => {
  const videoUrl = message?.media_url || message?.content || '';
  const videoId = extractYouTubeId(videoUrl);
  const hostName = message?.sender?.username || 'Host';
  const isHost = message?.sender?.id === currentUserId || message?.is_self;
  const rawContent = message?.content || '';
  const title = rawContent && !rawContent.startsWith('http')
    ? rawContent.replace(/^📺\s*Watch Party Active:\s*/i, '').replace(/^📺\s*/, '')
    : 'YouTube Video';

  const thumbnailUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : null;

  const handleJoin = (e) => {
    e.stopPropagation();
    if (onJoinWatchParty) {
      onJoinWatchParty(videoId, videoUrl, title);
    }
  };

  return (
    <div
      onClick={handleJoin}
      className="w-full max-w-xs p-4 rounded-3xl glass-card border border-rose-500/20 bg-gradient-to-b from-rose-950/30 to-black/80 shadow-2xl my-2 animate-slide-up select-none cursor-pointer hover:border-rose-500/40 transition-all group"
    >
      {/* Header with Live Badge */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 text-white font-bold shadow-lg shadow-red-500/20 group-hover:scale-105 transition-transform">
            <Tv className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Watch Party Active</span>
            </h4>
            <p className="text-[10px] text-zinc-400">
              Hosted by <span className="text-white font-semibold">{isHost ? 'You' : hostName}</span>
            </p>
          </div>
        </div>

        {/* Pulsing Live Badge */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-[9px] font-extrabold text-red-400 uppercase tracking-wider animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          <span>LIVE</span>
        </div>
      </div>

      {/* Video Thumbnail Preview */}
      <div className="relative my-3 rounded-2xl overflow-hidden aspect-video bg-black/60 border border-white/10 group-hover:border-white/20 transition-all">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt="Watch Party Preview"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500">
            <Tv className="w-8 h-8 opacity-40 mb-1" />
            <span className="text-xs font-medium">YouTube Video Stream</span>
          </div>
        )}

        {/* Center Glowing Play Button */}
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center backdrop-blur-[1px] group-hover:backdrop-blur-none transition-all">
          <div className="w-11 h-11 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-xl shadow-red-600/50 group-hover:scale-110 group-hover:bg-red-500 transition-all">
            <Play className="w-5 h-5 fill-white ml-0.5" />
          </div>
        </div>

        {/* Bottom Title Bar Overlay */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2.5 pt-6">
          <p className="text-[11px] font-bold text-white truncate drop-shadow">
            {title}
          </p>
        </div>
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={handleJoin}
        className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 hover:shadow-red-600/50 hover:brightness-110 active:scale-[0.98] transition-all"
      >
        <Play className="w-3.5 h-3.5 fill-white" />
        <span>Join Watch Party</span>
      </button>
    </div>
  );
};

export default WatchPartyCard;
