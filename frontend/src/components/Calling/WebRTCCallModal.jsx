import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '../Common/Avatar';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  SwitchCamera,
  Minimize2,
  Volume2,
} from 'lucide-react';

export const WebRTCCallModal = ({
  callState,
  callType,
  peerInfo,
  localStream,
  remoteStream,
  isMuted,
  isVideoEnabled,
  callDuration,
  onAccept,
  onReject,
  onEndCall,
  onToggleMute,
  onToggleVideo,
  onFlipCamera,
  onMinimize,
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (callState === 'idle' || callState === 'minimized') return null;

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isConnected = callState === 'connected';
  const isIncoming = callState === 'ringing_incoming';
  const isOutgoing = callState === 'ringing_outgoing';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-black/95 backdrop-blur-2xl select-none animate-fade-in">
        <div className="w-full h-full md:max-w-4xl md:h-[90vh] rounded-none md:rounded-[36px] bg-zinc-950 border-0 md:border md:border-white/15 shadow-2xl relative overflow-hidden flex flex-col items-center justify-between p-6">
          {/* Top Bar (Call Info & Minimize) */}
          <div className="w-full flex items-center justify-between z-20">
            <div className="flex items-center gap-3">
              <Avatar src={peerInfo?.avatar} name={peerInfo?.name} size="sm" />
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">
                  {peerInfo?.name || 'Caller'}
                </h3>
                <span className="text-xs text-zinc-400 font-mono">
                  {isConnected
                    ? formatDuration(callDuration)
                    : isIncoming
                    ? `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call...`
                    : 'Calling...'}
                </span>
              </div>
            </div>

            {isConnected && (
              <button
                type="button"
                onClick={onMinimize}
                className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                title="Minimize to Dynamic Island"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Main Visual Display (Video Stream or Voice Aura) */}
          <div className="flex-1 w-full h-full flex items-center justify-center relative my-4">
            {callType === 'video' && isConnected ? (
              /* Remote Fullscreen Video */
              <div className="w-full h-full rounded-2xl overflow-hidden bg-black relative flex items-center justify-center">
                {remoteStream ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-zinc-500">
                    <Avatar src={peerInfo?.avatar} name={peerInfo?.name} size="lg" />
                    <span className="text-xs font-semibold">Connecting video feed...</span>
                  </div>
                )}

                {/* Floating Self Video Picture-in-Picture (PiP) */}
                <motion.div
                  drag
                  dragConstraints={{ left: 0, right: 300, top: 0, bottom: 400 }}
                  className="absolute bottom-4 right-4 w-28 h-40 md:w-36 md:h-52 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-zinc-900 z-30 cursor-grab active:cursor-grabbing"
                >
                  {isVideoEnabled ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover mirror"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-400">
                      <VideoOff className="w-6 h-6" />
                    </div>
                  )}
                </motion.div>
              </div>
            ) : (
              /* Voice Call Aura & Animated Ripples */
              <div className="flex flex-col items-center justify-center gap-6">
                <div className="relative">
                  {/* Glowing Animated Ripple Rings */}
                  <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 animate-pulse opacity-40 absolute inset-0 blur-2xl" />
                  <div className="w-28 h-28 rounded-full border-4 border-indigo-500/40 p-1 flex items-center justify-center relative z-10 shadow-2xl">
                    <Avatar
                      src={peerInfo?.avatar}
                      name={peerInfo?.name}
                      size="xl"
                      className="w-full h-full rounded-full"
                    />
                  </div>
                </div>

                <div className="text-center">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-1">
                    {peerInfo?.name || 'Nexus User'}
                  </h2>
                  <p className="text-xs text-indigo-400 font-mono">
                    {isConnected ? `0% Lag WebRTC P2P • ${formatDuration(callDuration)}` : 'Ringing...'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Call Controls */}
          <div className="w-full flex items-center justify-center gap-4 z-20">
            {isIncoming ? (
              /* Incoming Call Accept / Decline Buttons */
              <div className="flex items-center gap-8 animate-slide-up">
                <button
                  type="button"
                  onClick={onReject}
                  className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-2xl transition-transform active:scale-95"
                  title="Decline Call"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>

                <button
                  type="button"
                  onClick={onAccept}
                  className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-2xl transition-transform active:scale-95 animate-bounce"
                  title="Accept Call"
                >
                  <Phone className="w-7 h-7" />
                </button>
              </div>
            ) : (
              /* Connected / Outgoing Call Action Bar */
              <div className="flex items-center gap-3 md:gap-4 p-2 rounded-full bg-[#18181f]/90 backdrop-blur-2xl border border-white/15 shadow-2xl">
                {/* Mute Mic */}
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    isMuted
                      ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-400'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* Video Toggle */}
                {callType === 'video' && (
                  <>
                    <button
                      type="button"
                      onClick={onToggleVideo}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        !isVideoEnabled
                          ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-400'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                      title={isVideoEnabled ? 'Turn Off Video' : 'Turn On Video'}
                    >
                      {isVideoEnabled ? (
                        <Video className="w-5 h-5" />
                      ) : (
                        <VideoOff className="w-5 h-5" />
                      )}
                    </button>

                    {/* Flip Camera */}
                    <button
                      type="button"
                      onClick={onFlipCamera}
                      className="w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all"
                      title="Flip Camera (Front / Back)"
                    >
                      <SwitchCamera className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* Hang Up Button */}
                <button
                  type="button"
                  onClick={onEndCall}
                  className="w-12 h-12 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-xl transition-transform active:scale-95"
                  title="End Call"
                >
                  <PhoneOff className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
};

export default WebRTCCallModal;
