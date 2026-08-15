import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import api from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { useChatSocket } from '../../hooks/useChatSocket';
import { useP2PTransfer } from '../../hooks/useP2PTransfer';
import { useBiometricVault } from '../../hooks/useBiometricVault';
import { useScreenShare } from '../../hooks/useScreenShare';
import { useWebRTCCall } from '../../hooks/useWebRTCCall';
import { detectSmartActions, detectSentimentTone, downloadIcsFile, getGoogleCalendarUrl } from '../../utils/smartActions';
import { playSentSound } from '../../utils/appleSounds';
import Avatar from '../Common/Avatar';
import MessageInput from './MessageInput';
import MessageActionMenu from './MessageActionMenu';
import DeleteMessageModal from './DeleteMessageModal';
import ViewOnceModal from './ViewOnceModal';
import PollCard from './PollCard';
import CreatePollModal from './CreatePollModal';
import PinnedMessageBar from './PinnedMessageBar';
import WebRTCCallModal from '../Calling/WebRTCCallModal';
import DynamicIsland from '../Apple/DynamicIsland';
import PeekAndPopMenu from '../Apple/PeekAndPopMenu';
import Loader from '../Common/Loader';
import WatchTogetherModal from '../Collaborative/WatchTogetherModal';
import SharedWhiteboard from '../Collaborative/SharedWhiteboard';
import GroupBalanceSheetModal from '../Collaborative/GroupBalanceSheetModal';
import ExpenseCard from '../Collaborative/ExpenseCard';
import P2PFileTransferCard from '../Collaborative/P2PFileTransferCard';
import CodeSandboxCard from '../Collaborative/CodeSandboxCard';
import TicTacToeCard from '../Collaborative/TicTacToeCard';
import TimeCapsuleCard from '../Collaborative/TimeCapsuleCard';
import TimeCapsuleModal from '../Collaborative/TimeCapsuleModal';
import MusicSearchModal from '../Collaborative/MusicSearchModal';
import ChatMusicPlayer from '../Collaborative/ChatMusicPlayer';
import ScreenShareViewer from '../Collaborative/ScreenShareViewer';
import ImageLightboxModal from '../Common/ImageLightboxModal';
import VoiceMessagePlayer from '../Common/VoiceMessagePlayer';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  WifiOff,
  RefreshCw,
  Tv,
  Pen,
  Receipt,
  MessageSquare,
  Reply,
  Edit2,
  Trash2,
  Copy,
  CheckSquare,
  Square,
  Lock,
  Unlock,
  Shield,
  Fingerprint,
  Calendar,
  CreditCard,
  ExternalLink,
  MapPin,
  X,
  FileUp,
  Hourglass,
  Sparkles,
  Music,
  Monitor,
  Eye,
  Timer,
  Clock,
  BarChart3,
  Megaphone,
  Pin,
  Phone,
  Video,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

const DISAPPEARING_OPTIONS = [
  { label: 'Off', seconds: 0 },
  { label: '1 Hour', seconds: 3600 },
  { label: '24 Hours', seconds: 86400 },
  { label: '7 Days', seconds: 604800 },
];

export const ChatArea = ({ activeRoom, onBack, onMessageSent }) => {
  const { user, accessToken } = useAuth();
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Modals & Viewers
  const [isWatchModalOpen, setIsWatchModalOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isBalanceSheetOpen, setIsBalanceSheetOpen] = useState(false);
  const [isCapsuleModalOpen, setIsCapsuleModalOpen] = useState(false);
  const [isMusicSearchOpen, setIsMusicSearchOpen] = useState(false);
  const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  // Delete, Reaction & View Once States
  const [deleteModalMessage, setDeleteModalMessage] = useState(null);
  const [activeViewOnce, setActiveViewOnce] = useState(null);
  const [showDisappearingMenu, setShowDisappearingMenu] = useState(false);
  const [peekAndPopMessage, setPeekAndPopMessage] = useState(null);

  // Synced In-Chat Music Player State
  const [currentTrack, setCurrentTrack] = useState(null);
  const [musicQueue, setMusicQueue] = useState([]);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);

  // Messaging Interactions
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);

  // Multi-Select Mode
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState(new Set());

  // High-performance WebSocket hook
  const {
    messages,
    setMessages,
    typingUsers,
    connectionStatus,
    disappearingTimer,
    setDisappearingTimer,
    pinnedMessages,
    setPinnedMessages,
    subscribe,
    sendMessage,
    sendPollVote,
    sendPinMessage,
    sendCallSignaling,
    sendReaction,
    sendViewOnceOpened,
    sendDisappearingTimer,
    sendScreenShareSignaling,
    sendMusicChangeTrack,
    sendMusicSyncAction,
    sendMusicQueueUpdate,
    sendCreateCapsule,
    sendUnlockCapsuleRequest,
    sendEditMessage,
    sendDeleteMessages,
    sendP2PSignaling,
    sendGameMove,
    sendTypingStatus,
    sendReadReceipt,
    sendVideoLoad,
    sendVideoSync,
    sendCanvasDraw,
    sendCanvasClear,
    reconnect,
  } = useChatSocket(activeRoom?.id, accessToken);

  // WebRTC Calling Engine (Zero Paid APIs - Pure Browser P2P)
  const {
    callState,
    callType,
    peerInfo,
    localStream,
    remoteStream,
    isMuted,
    isVideoEnabled,
    callDuration,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    flipCamera,
    minimizeCall,
    restoreCall,
  } = useWebRTCCall(sendCallSignaling, subscribe, user?.id, user?.username);

  // Sync initial room timer & pinned messages
  useEffect(() => {
    if (activeRoom?.disappearing_timer !== undefined) {
      setDisappearingTimer(activeRoom.disappearing_timer);
    }
    if (activeRoom?.pinned_messages) {
      setPinnedMessages(activeRoom.pinned_messages);
    }
  }, [activeRoom, setDisappearingTimer, setPinnedMessages]);

  // WebRTC Screen Share Engine
  const {
    isSharing,
    isViewing,
    sharerInfo,
    localStream: screenLocalStream,
    remoteStream: screenRemoteStream,
    latencyMs,
    qualityMode,
    isAudioMuted,
    startScreenShare,
    stopScreenShare,
    toggleAudio: toggleScreenShareAudio,
    toggleQuality: toggleScreenShareQuality,
  } = useScreenShare(sendScreenShareSignaling, subscribe, user?.id, user?.username);

  // WebRTC P2P Transfer Engine
  const { transferState, sendFile: sendP2PFile, resetTransfer } = useP2PTransfer(
    sendP2PSignaling,
    subscribe
  );

  // WebAuthn Biometric Chat Vault
  const {
    isLocked,
    isUnlocked,
    isBiometricSupported,
    authError,
    toggleLockChat,
    authenticateBiometric,
  } = useBiometricVault(activeRoom?.id, user?.id);

  // Ambient Sentiment Aura Tone
  const sentimentTone = useMemo(() => detectSentimentTone(messages), [messages]);

  // Listen to video_load / canvas_draw to automatically open modal if needed
  useEffect(() => {
    if (!subscribe) return;

    const unsubVideo = subscribe('video_load', () => setIsWatchModalOpen(true));
    const unsubDraw = subscribe('canvas_draw', () => setIsWhiteboardOpen(true));

    return () => {
      unsubVideo();
      unsubDraw();
    };
  }, [subscribe]);

  // Fetch paginated historical messages via REST API on room change
  const fetchMessageHistory = useCallback(async () => {
    if (!activeRoom?.id) return;
    try {
      setLoadingHistory(true);
      const res = await api.get(`/api/chat/rooms/${activeRoom.id}/messages/?page=1`);
      const historicalList = res.data.results || res.data || [];
      setMessages(historicalList);
      api.post(`/api/chat/rooms/${activeRoom.id}/mark-read/`).catch(() => {});
      sendReadReceipt();
    } catch (err) {
      console.error('Failed to load message history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [activeRoom?.id, setMessages, sendReadReceipt]);

  useEffect(() => {
    fetchMessageHistory();
    setReplyingTo(null);
    setEditingMessage(null);
    setIsSelectMode(false);
    setSelectedMessageIds(new Set());
  }, [fetchMessageHistory]);

  // Auto-scroll on message additions
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleSendMessage = (content, mediaUrl, replyToId, messageType = 'text', isViewOnce = false) => {
    playSentSound();

    // ⚡ Optimistic UI Update: Render message instantly on screen (0ms latency!)
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const optimisticMsg = {
      id: tempId,
      temp_id: tempId,
      content: content,
      media_url: mediaUrl,
      message_type: messageType,
      is_view_once: isViewOnce,
      created_at: new Date().toISOString(),
      sender: {
        id: user?.id,
        username: user?.username,
        display_name: user?.display_name || user?.username,
        avatar_url: user?.avatar_url,
      },
      is_sender: true,
      delivery_status: 'sending',
      reactions: [],
      reply_to: replyingTo
        ? {
            id: replyingTo.id,
            content: replyingTo.content,
            sender_name: replyingTo.sender?.username || 'User',
          }
        : null,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    sendMessage(content, mediaUrl, replyToId, messageType, isViewOnce);
    if (onMessageSent) onMessageSent();
  };

  const handleSendCapsule = (capsuleData) => {
    playSentSound();
    sendCreateCapsule(capsuleData);
    if (onMessageSent) onMessageSent();
  };

  const handleToggleScreenShare = () => {
    if (isSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  // Start Voice or Video Call
  const handleStartVoiceCall = () => {
    const target = activeRoom.other_member || {
      id: activeRoom.id,
      username: activeRoom.name || 'Group Call',
      avatar_url: activeRoom.display_avatar,
    };
    startCall(target, 'voice');
  };

  const handleStartVideoCall = () => {
    const target = activeRoom.other_member || {
      id: activeRoom.id,
      username: activeRoom.name || 'Group Video',
      avatar_url: activeRoom.display_avatar,
    };
    startCall(target, 'video');
  };

  // Reaction Handler
  const handleReactToMessage = (messageId, emoji) => {
    sendReaction(messageId, emoji);
    api.post(`/api/chat/messages/${messageId}/react/`, { emoji }).catch(() => {});
  };

  // Delete Handlers
  const handleDeleteForEveryone = (messageId) => {
    sendDeleteMessages([messageId], 'for_everyone');
    api.delete(`/api/chat/messages/${messageId}/?mode=for_everyone`).catch(() => {});
  };

  const handleDeleteForMe = (messageId) => {
    sendDeleteMessages([messageId], 'for_me');
    api.delete(`/api/chat/messages/${messageId}/?mode=for_me`).catch(() => {});
  };

  // Poll Vote Handler
  const handlePollVote = (pollId, optionId) => {
    sendPollVote(pollId, optionId);
    api.post(`/api/chat/polls/${pollId}/vote/`, { option_id: optionId }).catch(() => {});
  };

  const handleClosePoll = (pollId) => {
    api.patch(`/api/chat/polls/${pollId}/close/`).then((res) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.message_type === 'poll_card' && m.poll_data?.id === pollId
            ? { ...m, poll_data: res.data }
            : m
        )
      );
    }).catch((err) => alert(err.response?.data?.error || 'Failed to close poll.'));
  };

  // Pin / Unpin Message Handler
  const handlePinMessage = (messageId) => {
    sendPinMessage(messageId);
    api.post(`/api/chat/rooms/${activeRoom.id}/pin/`, { message_id: messageId }).catch(() => {});
  };

  // Open View Once Media
  const handleOpenViewOnce = async (msg) => {
    try {
      const res = await api.post(`/api/chat/messages/${msg.id}/open-view-once/`);
      const { media_url, media_type } = res.data;

      setActiveViewOnce({
        messageId: msg.id,
        mediaUrl: media_url,
        mediaType: media_type || (msg.message_type === 'audio' ? 'audio' : 'image'),
        senderName: msg.sender?.username || 'User',
      });

      sendViewOnceOpened(msg.id);

      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, is_view_once_opened: true, media_url: null } : m))
      );
    } catch (err) {
      alert(err.response?.data?.error || 'This View Once media has already expired or been opened.');
    }
  };

  // Change Disappearing Timer
  const handleChangeDisappearingTimer = (seconds) => {
    setDisappearingTimer(seconds);
    sendDisappearingTimer(seconds);
    api.post(`/api/chat/rooms/${activeRoom.id}/disappearing-timer/`, { disappearing_timer: seconds }).catch(() => {});
    setShowDisappearingMenu(false);
  };

  // Scroll to original quoted message
  const scrollToMessage = (messageId) => {
    if (!messageId) return;
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-violet-400', 'bg-violet-500/20');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-violet-400', 'bg-violet-500/20');
      }, 2000);
    }
  };

  // Music Player Action Handlers
  const handlePlayMusicTrack = (track) => {
    setCurrentTrack(track);
    setIsPlayingMusic(true);
    sendMusicChangeTrack(track);
  };

  const handleAddToMusicQueue = (track) => {
    if (!currentTrack) {
      setCurrentTrack(track);
      setIsPlayingMusic(true);
      sendMusicChangeTrack(track);
    } else {
      const nextQueue = [...musicQueue, track];
      setMusicQueue(nextQueue);
      sendMusicQueueUpdate(nextQueue);
    }
  };

  const handleMusicQueueUpdate = (newQueue) => {
    setMusicQueue(newQueue);
    sendMusicQueueUpdate(newQueue);
  };

  const handleEditMessage = (messageId, newContent) => {
    sendEditMessage(messageId, newContent);
    api.patch(`/api/chat/messages/${messageId}/edit/`, { content: newContent }).catch(() => {});
  };

  const handleDeleteSelected = () => {
    const ids = Array.from(selectedMessageIds);
    if (ids.length === 0) return;
    if (confirm(`Delete ${ids.length} selected message(s)?`)) {
      sendDeleteMessages(ids, 'for_me');
      api.post('/api/chat/messages/bulk-delete/', { message_ids: ids, mode: 'for_me' }).catch(() => {});
      setIsSelectMode(false);
      setSelectedMessageIds(new Set());
    }
  };

  const handleCopySelected = () => {
    const selectedMsgs = messages.filter((m) => selectedMessageIds.has(m.id));
    const text = selectedMsgs
      .map((m) => `[${m.sender?.username || 'User'}]: ${m.content || (m.media_url ? '[Media]' : '')}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    alert(`Copied ${selectedMsgs.length} message(s) to clipboard!`);
    setIsSelectMode(false);
    setSelectedMessageIds(new Set());
  };

  const toggleSelectMessage = (msgId) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const handleExpenseUpdated = (updatedExpense) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.message_type === 'expense_card' && msg.expense_data?.id === updatedExpense.id) {
          return { ...msg, expense_data: updatedExpense };
        }
        return msg;
      })
    );
    if (onMessageSent) onMessageSent();
  };

  const parseCodeBlocks = (content) => {
    if (!content) return null;
    const match = content.match(/```(\w+)?\n([\s\S]*?)```/);
    if (match) {
      return {
        language: match[1] || 'python',
        code: match[2].trim(),
      };
    }
    return null;
  };

  if (!activeRoom) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-black text-center select-none">
        <div className="w-16 h-16 rounded-3xl bg-[#141417] border border-white/10 flex items-center justify-center text-white mb-4 shadow-2xl">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">Welcome to SYNK</h3>
        <p className="text-xs text-zinc-400 max-w-sm">
          Select an active conversation or browse broadcast channels.
        </p>
      </div>
    );
  }

  // Biometric Locked Shield Screen
  if (isLocked && !isUnlocked) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-black text-center select-none animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-[#141417] border border-white/15 flex items-center justify-center text-white mb-6 shadow-2xl">
          <Lock className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Secret Biometric Chat Vault</h3>
        <p className="text-xs text-zinc-400 max-w-sm mb-6">
          This conversation is protected with hardware biometrics and client-side zero-knowledge E2EE encryption.
        </p>
        <button
          onClick={authenticateBiometric}
          className="btn-primary px-6 py-3 text-xs md:text-sm font-bold flex items-center gap-2 shadow-2xl"
        >
          <Fingerprint className="w-5 h-5" />
          <span>Unlock with Biometrics</span>
        </button>
        {authError && (
          <p className="text-xs text-rose-400 mt-4">{authError}</p>
        )}
      </div>
    );
  }

  const otherUser = activeRoom.other_member;
  const isChannel = activeRoom.room_type === 'channel';
  const displayName = activeRoom.display_name || otherUser?.username || (isChannel ? `@${activeRoom.channel_handle || 'channel'}` : 'Chat Room');
  const displayAvatar = activeRoom.display_avatar || otherUser?.avatar_url;
  const isOnline = otherUser?.is_online;
  const isBroadcastReadOnly = Boolean(activeRoom.is_broadcast_only && !activeRoom.is_admin);

  const typingList = Object.entries(typingUsers).filter(([userId]) => userId !== user?.id);
  const isSomeoneTyping = typingList.length > 0;
  const typingText = isSomeoneTyping
    ? typingList.length === 1
      ? `${typingList[0][1]} is typing...`
      : 'Multiple people are typing...'
    : null;

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      return format(new Date(timestamp), 'HH:mm');
    } catch {
      return '';
    }
  };

  const formatMessageDate = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      if (isToday(date)) return 'Today';
      if (isYesterday(date)) return 'Yesterday';
      return format(date, 'MMMM d, yyyy');
    } catch {
      return '';
    }
  };

  const formatTimerLabel = (secs) => {
    if (!secs) return 'Off';
    if (secs >= 604800) return '7d';
    if (secs >= 86400) return '24h';
    if (secs >= 3600) return '1h';
    return `${secs}s`;
  };

  const activeScreenStream = isSharing ? screenLocalStream : isViewing ? screenRemoteStream : null;

  return (
    <div
      className={`flex-1 flex flex-col h-full bg-black relative overflow-hidden transition-colors duration-500 ${
        sentimentTone === 'joy'
          ? 'border-t-2 border-t-amber-400/30'
          : sentimentTone === 'urgent'
          ? 'border-t-2 border-t-rose-500/40'
          : 'border-t-2 border-t-transparent'
      }`}
    >
      {/* iOS 18 Dynamic Island */}
      <DynamicIsland
        callState={callState}
        callType={callType}
        peerInfo={peerInfo}
        callDuration={callDuration}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onEndCall={endCall}
        onRestoreCall={restoreCall}
        currentTrack={currentTrack}
        isPlayingMusic={isPlayingMusic}
        onToggleMusic={() => setIsPlayingMusic(!isPlayingMusic)}
        onOpenMusicModal={() => setIsMusicSearchOpen(true)}
        isSharingScreen={isSharing}
        onStopScreenShare={stopScreenShare}
      />

      {/* Multi-Select Action Bar */}
      {isSelectMode ? (
        <div className="px-4 py-3 bg-[#18181b] border-b border-white/15 flex items-center justify-between z-20 select-none animate-slide-up">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsSelectMode(false);
                setSelectedMessageIds(new Set());
              }}
              className="btn-icon p-2"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-xs md:text-sm font-bold text-white">
              {selectedMessageIds.size} Selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySelected}
              disabled={selectedMessageIds.size === 0}
              className="btn-dark px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
              title="Copy Selected Messages"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </button>

            <button
              onClick={handleDeleteSelected}
              disabled={selectedMessageIds.size === 0}
              className="btn-dark px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 text-rose-400 hover:bg-rose-500/10 disabled:opacity-40"
              title="Delete Selected"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      ) : (
        /* Regular iOS Header */
        <div className="px-4 py-3 bg-[#0d0d10] border-b border-white/10 flex items-center justify-between z-10 select-none flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="md:hidden btn-icon p-2">
              <ArrowLeft className="w-4 h-4" />
            </button>

            {isChannel ? (
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
                <Megaphone className="w-5 h-5" />
              </div>
            ) : (
              <Avatar
                src={displayAvatar}
                name={displayName}
                size="md"
                isOnline={isOnline}
                showStatus={!activeRoom.is_group}
              />
            )}

            <div>
              <h3 className="font-bold text-white text-sm leading-tight flex items-center gap-2">
                {displayName}
                {isLocked && <Lock className="w-3 h-3 text-amber-400" title="Vault Protected" />}
                {disappearingTimer > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-semibold flex items-center gap-0.5">
                    <Timer className="w-2.5 h-2.5" />
                    <span>{formatTimerLabel(disappearingTimer)}</span>
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                {isSomeoneTyping ? (
                  <span className="text-white font-medium animate-pulse">{typingText}</span>
                ) : isChannel ? (
                  <span>{activeRoom.subscribers_count || activeRoom.members?.length || 0} subscribers</span>
                ) : activeRoom.is_group ? (
                  <span>{activeRoom.members?.length || 0} members</span>
                ) : isOnline ? (
                  <span className="text-emerald-400 font-medium">Online</span>
                ) : (
                  <span>Offline</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 relative">
            {/* 1. Voice Call Button */}
            {!isChannel && (
              <button
                onClick={handleStartVoiceCall}
                className="btn-icon p-2.5 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                title="Start WebRTC Voice Call"
              >
                <Phone className="w-4 h-4" />
              </button>
            )}

            {/* 2. Video Call Button */}
            {!isChannel && (
              <button
                onClick={handleStartVideoCall}
                className="btn-icon p-2.5 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                title="Start WebRTC HD Video Call"
              >
                <Video className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Disappearing Messages Modal */}
      {showDisappearingMenu && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowDisappearingMenu(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-[#141418] border border-white/15 shadow-2xl p-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Disappearing Messages</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDisappearingMenu(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400 mb-3">
              New messages in this room will automatically disappear after the selected duration.
            </p>
            <div className="space-y-1.5">
              {DISAPPEARING_OPTIONS.map((opt) => (
                <button
                  key={opt.seconds}
                  type="button"
                  onClick={() => handleChangeDisappearingTimer(opt.seconds)}
                  className={`w-full px-3.5 py-2.5 rounded-2xl text-xs flex items-center justify-between font-semibold transition-all ${
                    disappearingTimer === opt.seconds
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  <span>{opt.label}</span>
                  {disappearingTimer === opt.seconds && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Pinned Message Banner */}
      <PinnedMessageBar
        pinnedMessages={pinnedMessages}
        onScrollToMessage={scrollToMessage}
        onUnpinMessage={handlePinMessage}
        isAdmin={activeRoom.is_admin}
      />

      {/* Screen Share Live Viewer */}
      {activeScreenStream && (
        <div className="px-4 pt-3 flex-shrink-0">
          <ScreenShareViewer
            stream={activeScreenStream}
            isSharing={isSharing}
            sharerName={sharerInfo?.name || 'Peer'}
            latencyMs={latencyMs}
            qualityMode={qualityMode}
            onToggleQuality={toggleScreenShareQuality}
            onStopShare={stopScreenShare}
            isAudioMuted={isAudioMuted}
            onToggleAudio={toggleScreenShareAudio}
          />
        </div>
      )}

      {/* Synchronized Collaborative Music Bar */}
      {currentTrack && (
        <div className="px-4 pt-2 flex-shrink-0">
          <ChatMusicPlayer
            currentTrack={currentTrack}
            queue={musicQueue}
            onSyncAction={sendMusicSyncAction}
            onQueueUpdate={handleMusicQueueUpdate}
            onOpenSearch={() => setIsMusicSearchOpen(true)}
            subscribe={subscribe}
          />
        </div>
      )}

      {/* P2P File Transfer Progress Card */}
      {transferState.status !== 'idle' && (
        <div className="px-4 py-2 flex-shrink-0">
          <P2PFileTransferCard
            transferState={transferState}
            onReset={resetTransfer}
          />
        </div>
      )}

      {/* Connection Warning Banner */}
      {connectionStatus === 'disconnected' && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 flex items-center justify-between text-rose-400 text-xs select-none">
          <div className="flex items-center gap-2">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Disconnected from live server. Attempting reconnect...</span>
          </div>
          <button
            onClick={reconnect}
            className="flex items-center gap-1 font-semibold hover:underline"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 relative select-text"
      >
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <Loader />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 select-none">
            <Sparkles className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm font-semibold text-zinc-400">No messages yet</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Say hello or try typing <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">/poll</code> or <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">/split 500 Dinner</code>
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSelf = msg.sender?.id === user?.id || msg.is_self;
            const smartActions = detectSmartActions(msg.content);
            const codeBlock = parseCodeBlocks(msg.content);
            const isSelected = selectedMessageIds.has(msg.id);
            const isDeletedForEveryone = msg.deleted_for_everyone;
            const isViewOnce = msg.is_view_once;
            const isViewOnceOpened = msg.is_view_once_opened;

            // Date separator check
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const showDate =
              !prevMsg ||
              formatMessageDate(prevMsg.timestamp) !== formatMessageDate(msg.timestamp);

            return (
              <React.Fragment key={msg.id || index}>
                {showDate && (
                  <div className="flex items-center justify-center my-3 select-none">
                    <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase bg-[#141417] border border-white/10 px-3 py-1 rounded-full shadow-sm">
                      {formatMessageDate(msg.timestamp)}
                    </span>
                  </div>
                )}

                {/* 1. Live Interactive Poll Card */}
                {msg.message_type === 'poll_card' ? (
                  <div id={`msg-${msg.id}`} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} my-2 transition-all`}>
                    <PollCard
                      message={msg}
                      currentUserId={user?.id}
                      onVote={handlePollVote}
                      onClosePoll={handleClosePoll}
                      isAdmin={activeRoom.is_admin}
                    />
                    <span className="text-[10px] text-zinc-500 mt-1 px-1">{formatMessageTime(msg.timestamp)}</span>
                  </div>
                ) : msg.message_type === 'capsule_card' || msg.is_capsule ? (
                  <div id={`msg-${msg.id}`} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} my-2 transition-all`}>
                    <TimeCapsuleCard
                      message={msg}
                      currentUserId={user?.id}
                      onUnlockRequest={sendUnlockCapsuleRequest}
                      onImageClick={(url) => setLightboxImage(url)}
                      subscribe={subscribe}
                    />
                    <span className="text-[10px] text-zinc-500 mt-1 px-1">{formatMessageTime(msg.timestamp)}</span>
                  </div>
                ) : msg.message_type === 'expense_card' ? (
                  <div id={`msg-${msg.id}`} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} my-2 transition-all`}>
                    <ExpenseCard message={msg} onExpenseUpdated={handleExpenseUpdated} />
                    <span className="text-[10px] text-zinc-500 mt-1 px-1">{formatMessageTime(msg.timestamp)}</span>
                  </div>
                ) : msg.message_type === 'game_card' ? (
                  <div id={`msg-${msg.id}`} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} my-2 transition-all`}>
                    <TicTacToeCard
                      messageId={msg.id}
                      currentUserId={user?.id}
                      currentUsername={user?.username}
                      onSendGameMove={sendGameMove}
                      subscribe={subscribe}
                    />
                    <span className="text-[10px] text-zinc-500 mt-1 px-1">{formatMessageTime(msg.timestamp)}</span>
                  </div>
                ) : (
                  /* Standard Message Bubble with iOS styling and 3D Touch Peek & Pop */
                  <div
                    id={`msg-${msg.id}`}
                    className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} group animate-fade-in relative transition-all ${
                      isSelected ? 'bg-white/5 p-1 rounded-2xl' : ''
                    }`}
                    onClick={() => {
                      if (isSelectMode) toggleSelectMessage(msg.id);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setPeekAndPopMessage(msg);
                    }}
                  >
                    <div className="flex items-end gap-2 max-w-[85%] md:max-w-[70%]">
                      {isSelectMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectMessage(msg.id);
                          }}
                          className="p-1 text-white"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-white" />
                          ) : (
                            <Square className="w-4 h-4 text-zinc-500" />
                          )}
                        </button>
                      )}

                      {!isSelf && (activeRoom.is_group || isChannel) && (
                        <Avatar
                          src={msg.sender?.avatar_url}
                          name={msg.sender?.username}
                          size="xs"
                          className="mb-1"
                        />
                      )}

                      <div className="relative">
                        {/* Hover Action Menu */}
                        {!isSelectMode && !isDeletedForEveryone && !isViewOnce && (
                          <div
                            className={`absolute -top-8 ${
                              isSelf ? 'right-0' : 'left-0'
                            } hidden group-hover:flex items-center z-20`}
                          >
                            <MessageActionMenu
                              message={msg}
                              isSelf={isSelf}
                              onReact={handleReactToMessage}
                              onReply={(m) => setReplyingTo(m)}
                              onCopy={(text) => {
                                navigator.clipboard.writeText(text);
                              }}
                              onPin={handlePinMessage}
                              onEdit={(m) => setEditingMessage(m)}
                              onOpenDelete={(m) => setDeleteModalMessage(m)}
                            />
                          </div>
                        )}

                        <div
                          className={`relative px-4 py-2.5 rounded-2xl text-xs md:text-sm shadow-md transition-all ${
                            isDeletedForEveryone
                              ? 'bg-zinc-900/60 border border-white/5 text-zinc-500 italic'
                              : isSelf
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-br-none shadow-indigo-500/20'
                              : 'bg-[#18181e] text-zinc-100 border border-white/10 rounded-bl-none'
                          } ${isSelected ? 'ring-2 ring-white' : ''}`}
                        >
                          {!isSelf && (activeRoom.is_group || isChannel) && !isDeletedForEveryone && (
                            <p className="text-[10px] font-bold text-zinc-400 mb-1">
                              {msg.sender?.username}
                            </p>
                          )}

                          {/* Quoted Reply Card */}
                          {msg.reply_to && !isDeletedForEveryone && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                scrollToMessage(msg.reply_to.id);
                              }}
                              className={`mb-2 p-2 rounded-xl text-xs border-l-2 cursor-pointer transition-opacity hover:opacity-80 ${
                                isSelf
                                  ? 'bg-black/20 border-l-white text-zinc-100'
                                  : 'bg-zinc-800/80 border-l-indigo-400 text-zinc-300'
                              }`}
                              title="Click to view original message"
                            >
                              <span className="font-bold text-[10px] block opacity-80">
                                {msg.reply_to.sender_username || 'User'}
                              </span>
                              <p className="truncate text-[11px] opacity-90">
                                {msg.reply_to.content || (msg.reply_to.media_url ? '📷 Media' : 'Message')}
                              </p>
                            </div>
                          )}

                          {/* View Once Media Bubble Card */}
                          {isViewOnce && !isDeletedForEveryone ? (
                            <div className="py-1">
                              {isViewOnceOpened ? (
                                <div className="flex items-center gap-2 text-zinc-400 italic text-xs py-1">
                                  <div className="w-6 h-6 rounded-full border border-zinc-600 flex items-center justify-center text-[10px]">
                                    ✓
                                  </div>
                                  <span>Opened · View Once Media</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenViewOnce(msg);
                                  }}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                                    isSelf
                                      ? 'bg-amber-400/20 border-amber-500/40 text-black font-bold'
                                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                                  }`}
                                  title="Tap to open view once media"
                                >
                                  <div className="w-6 h-6 rounded-full bg-amber-400 text-black font-bold flex items-center justify-center text-xs shadow-md">
                                    ①
                                  </div>
                                  <div className="text-left">
                                    <span className="block text-xs font-bold leading-tight">
                                      {msg.message_type === 'audio' ? 'Voice Note' : 'Photo'}
                                    </span>
                                    <span className="block text-[10px] opacity-75 font-normal">
                                      View Once (Tap to open)
                                    </span>
                                  </div>
                                </button>
                              )}
                            </div>
                          ) : isDeletedForEveryone ? (
                            <p className="flex items-center gap-1.5 text-zinc-500 italic text-xs">
                              <span>🚫 This message was deleted</span>
                            </p>
                          ) : msg.message_type === 'sticker' || msg.message_type === 'gif' ? (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                if (msg.media_url) setLightboxImage(msg.media_url);
                              }}
                              className="rounded-xl overflow-hidden max-h-60 max-w-xs cursor-pointer hover:opacity-90 transition-opacity"
                            >
                              <img
                                src={msg.media_url}
                                alt="sticker"
                                className="w-full h-full object-contain rounded-xl"
                                loading="lazy"
                              />
                            </div>
                          ) : msg.message_type === 'audio' || (msg.media_url && (msg.media_url.endsWith('.webm') || msg.media_url.endsWith('.ogg') || msg.media_url.endsWith('.mp3') || msg.media_url.endsWith('.wav'))) ? (
                            <div className="mb-1">
                              <VoiceMessagePlayer audioUrl={msg.media_url} isSelf={isSelf} />
                            </div>
                          ) : msg.media_url ? (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxImage(msg.media_url);
                              }}
                              className="mb-2 rounded-xl overflow-hidden max-h-64 border border-white/10 cursor-pointer hover:opacity-90 transition-opacity"
                              title="Click to view full photo"
                            >
                              <img
                                src={msg.media_url}
                                alt="attachment"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            </div>
                          ) : null}

                          {/* Pyodide Wasm Code Block Runner */}
                          {!isDeletedForEveryone && codeBlock ? (
                            <CodeSandboxCard
                              code={codeBlock.code}
                              language={codeBlock.language}
                            />
                          ) : !isDeletedForEveryone && !isViewOnce && msg.content ? (
                            <p className="whitespace-pre-wrap break-words leading-relaxed">
                              {msg.content}
                            </p>
                          ) : null}

                          {/* Smart Action Chips */}
                          {!isDeletedForEveryone && smartActions.length > 0 && !isViewOnce && (
                            <div className="flex flex-wrap gap-1.5 mt-2 pt-1 border-t border-white/10">
                              {smartActions.map((action, aIdx) => (
                                <button
                                  key={aIdx}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (action.type === 'calendar') {
                                      downloadIcsFile(action.title, action.date);
                                    } else if (action.type === 'payment' && action.upiId) {
                                      navigator.clipboard.writeText(action.upiId);
                                      alert(`Copied UPI ID: ${action.upiId}`);
                                    } else if (action.type === 'link') {
                                      window.open(action.url, '_blank');
                                    } else if (action.type === 'maps') {
                                      window.open(`https://maps.google.com/?q=${encodeURIComponent(action.location)}`, '_blank');
                                    }
                                  }}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm transition-all ${
                                    isSelf
                                      ? 'bg-black text-white hover:bg-zinc-800'
                                      : 'bg-zinc-800 text-white hover:bg-white hover:text-black'
                                  }`}
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Message Footer */}
                          <div
                            className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                              isSelf ? 'text-white/80 font-bold' : 'text-zinc-400'
                            }`}
                          >
                            {msg.is_edited && !isDeletedForEveryone && (
                              <span className="italic font-normal text-[9px] text-white/70">(edited)</span>
                            )}
                            <span>{formatMessageTime(msg.timestamp)}</span>
                            {isSelf && (
                              <span className="inline-flex items-center ml-0.5">
                                {msg.delivery_status === 'read' || (msg.read_by && msg.read_by.length > 1) ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-sky-300" title="Read" />
                                ) : msg.delivery_status === 'delivered' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-white/70" title="Delivered" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-white/70" title="Sent" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Emoji Reaction Pills */}
                        {msg.reactions && msg.reactions.length > 0 && !isDeletedForEveryone && !isViewOnce && (
                          <div
                            className={`flex flex-wrap gap-1 mt-1 ${
                              isSelf ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            {msg.reactions.map((r, rIdx) => (
                              <button
                                key={rIdx}
                                type="button"
                                onClick={() => handleReactToMessage(msg.id, r.emoji)}
                                className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition-all ${
                                  r.reacted_by_me
                                    ? 'bg-violet-500/25 border-violet-400/50 text-violet-200 shadow-sm'
                                    : 'bg-zinc-800/80 border-white/10 text-zinc-300 hover:bg-zinc-700'
                                }`}
                                title={`${r.users?.join(', ') || 'Users'} reacted ${r.emoji}`}
                              >
                                <span>{r.emoji}</span>
                                <span className="text-[10px] font-bold font-mono">{r.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}

        {isSomeoneTyping && (
          <div className="flex items-center gap-2 text-zinc-400 text-xs animate-fade-in pl-2">
            <div className="flex gap-1 items-center px-3 py-2 rounded-2xl bg-[#141417] border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-[11px] text-zinc-400">{typingText}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Bar */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onEditMessage={handleEditMessage}
        onTyping={sendTypingStatus}
        onOpenWatchTogether={() => setIsWatchModalOpen(true)}
        onOpenWhiteboard={() => setIsWhiteboardOpen(true)}
        onOpenP2P={(file) => sendP2PFile(file)}
        onOpenCapsule={() => setIsCapsuleModalOpen(true)}
        onOpenMusicSearch={() => setIsMusicSearchOpen(true)}
        onOpenCreatePoll={() => setIsCreatePollOpen(true)}
        onPlayTrack={handlePlayMusicTrack}
        onToggleScreenShare={handleToggleScreenShare}
        onOpenDisappearingMenu={() => setShowDisappearingMenu(true)}
        onToggleLockChat={toggleLockChat}
        isLocked={isLocked}
        isBiometricSupported={isBiometricSupported}
        onToggleSelectMode={() => setIsSelectMode(!isSelectMode)}
        isSelectMode={isSelectMode}
        onOpenBalanceSheet={() => setIsBalanceSheetOpen(true)}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        editingMessage={editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
        isBroadcastReadOnly={isBroadcastReadOnly}
        disabled={connectionStatus === 'connecting'}
      />

      {/* WebRTC Video & Voice Call Modal */}
      <WebRTCCallModal
        callState={callState}
        callType={callType}
        peerInfo={peerInfo}
        localStream={localStream}
        remoteStream={remoteStream}
        isMuted={isMuted}
        isVideoEnabled={isVideoEnabled}
        callDuration={callDuration}
        onAccept={acceptCall}
        onReject={rejectCall}
        onEndCall={endCall}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onFlipCamera={flipCamera}
        onMinimize={minimizeCall}
      />

      {/* iOS 3D Touch Peek & Pop Menu */}
      <PeekAndPopMenu
        isOpen={Boolean(peekAndPopMessage)}
        message={peekAndPopMessage}
        isSelf={peekAndPopMessage?.sender?.id === user?.id || peekAndPopMessage?.is_self}
        onReact={handleReactToMessage}
        onReply={(m) => setReplyingTo(m)}
        onCopy={(text) => navigator.clipboard.writeText(text)}
        onPin={handlePinMessage}
        onEdit={(m) => setEditingMessage(m)}
        onDelete={(m) => setDeleteModalMessage(m)}
        onClose={() => setPeekAndPopMessage(null)}
      />

      {/* Create Live Poll Modal */}
      <CreatePollModal
        isOpen={isCreatePollOpen}
        onClose={() => setIsCreatePollOpen(false)}
        roomId={activeRoom?.id}
        onPollCreated={() => {
          if (onMessageSent) onMessageSent();
        }}
      />

      {/* View Once Fullscreen Secure Modal */}
      {activeViewOnce && (
        <ViewOnceModal
          isOpen={Boolean(activeViewOnce)}
          mediaUrl={activeViewOnce.mediaUrl}
          mediaType={activeViewOnce.mediaType}
          senderName={activeViewOnce.senderName}
          onClose={() => setActiveViewOnce(null)}
        />
      )}

      {/* Delete Message Modal */}
      <DeleteMessageModal
        isOpen={Boolean(deleteModalMessage)}
        message={deleteModalMessage}
        isSelf={deleteModalMessage?.sender?.id === user?.id || deleteModalMessage?.is_self}
        onDeleteForMe={handleDeleteForMe}
        onDeleteForEveryone={handleDeleteForEveryone}
        onClose={() => setDeleteModalMessage(null)}
      />

      {/* Music Search & Queue Modal */}
      <MusicSearchModal
        isOpen={isMusicSearchOpen}
        onClose={() => setIsMusicSearchOpen(false)}
        onPlayTrack={handlePlayMusicTrack}
        onAddToQueue={handleAddToMusicQueue}
        currentTrack={currentTrack}
      />

      {/* Time Capsule Composer Modal */}
      <TimeCapsuleModal
        isOpen={isCapsuleModalOpen}
        onClose={() => setIsCapsuleModalOpen(false)}
        onSendCapsule={handleSendCapsule}
      />

      {/* Fullscreen Photo Lightbox Modal */}
      <ImageLightboxModal
        isOpen={Boolean(lightboxImage)}
        imageUrl={lightboxImage}
        onClose={() => setLightboxImage(null)}
        imageName="SYNK Photo"
      />

      {/* Watch Together YouTube Modal */}
      <WatchTogetherModal
        isOpen={isWatchModalOpen}
        onClose={() => setIsWatchModalOpen(false)}
        currentUsername={user?.username}
        onSendVideoLoad={sendVideoLoad}
        onSendVideoSync={sendVideoSync}
        subscribe={subscribe}
      />

      {/* Collaborative Whiteboard Canvas */}
      <SharedWhiteboard
        isOpen={isWhiteboardOpen}
        onClose={() => setIsWhiteboardOpen(false)}
        onSendCanvasDraw={sendCanvasDraw}
        onSendCanvasClear={sendCanvasClear}
        subscribe={subscribe}
      />

      {/* Group Balance Sheet Modal */}
      <GroupBalanceSheetModal
        isOpen={isBalanceSheetOpen}
        onClose={() => setIsBalanceSheetOpen(false)}
        roomId={activeRoom?.id}
      />
    </div>
  );
};

export default ChatArea;
