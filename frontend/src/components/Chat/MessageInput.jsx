import React, { useState, useRef, useEffect } from 'react';
import api from '../../api/axiosInstance';
import { searchMusic } from '../../utils/musicApi';
import { compressImage } from '../../utils/imageCompressor';
import GifStickerPicker from './GifStickerPicker';
import {
  Send,
  Image as ImageIcon,
  Smile,
  Paperclip,
  X,
  Plus,
  Terminal,
  Receipt,
  Tv,
  Pen,
  Loader2,
  Reply,
  Edit2,
  Gamepad2,
  FileUp,
  Mic,
  Hourglass,
  Music,
  Monitor,
  Square,
  Trash2,
  Eye,
  Sparkles,
  BarChart3,
  Lock,
  Timer,
  CheckSquare,
  Shield,
  Unlock,
} from 'lucide-react';

const SLASH_COMMANDS = [
  {
    command: '/poll',
    syntax: '/poll',
    description: 'Create interactive real-time Live Poll with instant voting',
    icon: BarChart3,
  },
  {
    command: '/screenshare',
    syntax: '/screenshare',
    description: 'Start live zero-lag P2P Screen Sharing',
    icon: Monitor,
  },
  {
    command: '/play',
    syntax: '/play <song or artist keywords>',
    description: 'Instant ad-free music playback synced for everyone',
    icon: Music,
  },
  {
    command: '/music',
    syntax: '/music',
    description: 'Open Music Search & Room Playlist queue',
    icon: Music,
  },
  {
    command: '/capsule',
    syntax: '/capsule',
    description: 'Time Capsule: Lock a message until a future date/time',
    icon: Hourglass,
  },
  {
    command: '/split',
    syntax: '/split 500 Dinner',
    description: 'Split a bill equally with room members',
    icon: Receipt,
  },
  {
    command: '/game',
    syntax: '/game tictactoe',
    description: 'Launch in-chat multiplayer Tic-Tac-Toe mini game',
    icon: Gamepad2,
  },
  {
    command: '/p2p',
    syntax: '/p2p',
    description: 'Direct P2P large file transfer (0% server storage)',
    icon: FileUp,
  },
  {
    command: '/watch',
    syntax: '/watch https://youtube.com/...',
    description: 'Synchronized YouTube Watch Together session',
    icon: Tv,
  },
  {
    command: '/draw',
    syntax: '/draw',
    description: 'Open real-time shared collaborative whiteboard',
    icon: Pen,
  },
];

export const MessageInput = ({
  onSendMessage,
  onEditMessage,
  onTyping,
  onOpenWatchTogether,
  onOpenWhiteboard,
  onOpenP2P,
  onOpenCapsule,
  onOpenMusicSearch,
  onOpenCreatePoll,
  onPlayTrack,
  onToggleScreenShare,
  onOpenDisappearingMenu,
  onToggleLockChat,
  isLocked = false,
  isBiometricSupported = false,
  onToggleSelectMode,
  isSelectMode = false,
  onOpenBalanceSheet,
  replyingTo = null,
  onCancelReply,
  editingMessage = null,
  onCancelEdit,
  isBroadcastReadOnly = false,
  disabled = false,
}) => {
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [isViewOnce, setIsViewOnce] = useState(false);

  // Audio Recording & Web Audio Live Waveform State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [liveAmplitudes, setLiveAmplitudes] = useState([20, 30, 20, 40, 30, 25, 35, 45, 30, 25, 20, 30]);

  const fileInputRef = useRef(null);
  const p2pFileInputRef = useRef(null);
  const actionsMenuRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const inputRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (editingMessage) {
      setContent(editingMessage.content || '');
      if (inputRef.current) inputRef.current.focus();
    }
  }, [editingMessage]);

  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingTo]);

  // Click outside to close actions dropdown popover
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target)) {
        setShowActionsMenu(false);
      }
    };
    if (showActionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActionsMenu]);

  // Start Voice Recording with Web Audio API Live Analyser
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        const audioCtx = new AudioCtxClass();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        audioCtxRef.current = audioCtx;
        analyserRef.current = analyser;

        const updateWaveform = () => {
          if (!analyserRef.current) return;
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          const bins = [];
          const step = Math.floor(dataArray.length / 12) || 1;
          for (let i = 0; i < 12; i++) {
            const val = dataArray[i * step] || 0;
            bins.push(Math.max(15, Math.round((val / 255) * 100)));
          }
          setLiveAmplitudes(bins);
          animFrameRef.current = requestAnimationFrame(updateWaveform);
        };
        updateWaveform();
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      alert('Microphone access is required to record voice messages.');
    }
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, {
        type: 'audio/webm',
      });

      const currentViewOnce = isViewOnce;
      cleanupRecording();
      setIsViewOnce(false);

      try {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', audioFile);
        const res = await api.post('/api/chat/upload/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const audioUrl = res.data.url;
        onSendMessage('', audioUrl, replyingTo?.id || null, 'audio', currentViewOnce);
        if (onCancelReply) onCancelReply();
      } catch (err) {
        console.error('Failed to upload voice note:', err);
        alert('Failed to send voice note.');
      } finally {
        setIsUploading(false);
      }
    };

    mediaRecorderRef.current.stop();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanupRecording();
  };

  const cleanupRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  };

  const formatRecordingTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Image Selection with Canvas Compression
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (PNG, JPG, GIF, WebP)');
        return;
      }

      const compressed = await compressImage(file, { maxWidth: 1920, maxHeight: 1080, quality: 0.75 });
      setSelectedFile(compressed);
      setFilePreviewUrl(URL.createObjectURL(compressed));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleP2PFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onOpenP2P) {
      onOpenP2P(file);
    }
    if (p2pFileInputRef.current) p2pFileInputRef.current.value = '';
  };

  const handleRemoveFile = () => {
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setIsViewOnce(false);
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            const compressed = await compressImage(file, { maxWidth: 1920, maxHeight: 1080, quality: 0.75 });
            setSelectedFile(compressed);
            setFilePreviewUrl(URL.createObjectURL(compressed));
            break;
          }
        }
      }
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setContent(val);

    if (val.startsWith('/') && !val.includes(' ')) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }

    if (onTyping) {
      if (!isTypingRef.current && val.trim().length > 0) {
        isTypingRef.current = true;
        onTyping(true);
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        onTyping(false);
      }, 1500);
    }
  };

  const handleSelectCommand = (cmd) => {
    if (cmd.command === '/poll') {
      if (onOpenCreatePoll) onOpenCreatePoll();
      setContent('');
      setShowSlashMenu(false);
      return;
    }
    if (cmd.command === '/screenshare') {
      if (onToggleScreenShare) onToggleScreenShare();
      setContent('');
      setShowSlashMenu(false);
      return;
    }
    if (cmd.command === '/music') {
      if (onOpenMusicSearch) onOpenMusicSearch();
      setContent('');
      setShowSlashMenu(false);
      return;
    }
    if (cmd.command === '/play') {
      setContent('/play ');
      setShowSlashMenu(false);
      if (inputRef.current) inputRef.current.focus();
      return;
    }
    if (cmd.command === '/capsule') {
      if (onOpenCapsule) onOpenCapsule();
      setContent('');
      setShowSlashMenu(false);
      return;
    }
    if (cmd.command === '/draw') {
      if (onOpenWhiteboard) onOpenWhiteboard();
      setContent('');
      setShowSlashMenu(false);
      return;
    }
    if (cmd.command === '/watch') {
      if (onOpenWatchTogether) onOpenWatchTogether();
      setContent('');
      setShowSlashMenu(false);
      return;
    }
    if (cmd.command === '/p2p') {
      if (p2pFileInputRef.current) p2pFileInputRef.current.click();
      setContent('');
      setShowSlashMenu(false);
      return;
    }
    if (cmd.command === '/game') {
      setContent('/game tictactoe');
      setShowSlashMenu(false);
      if (inputRef.current) inputRef.current.focus();
      return;
    }
    setContent(`${cmd.command} `);
    setShowSlashMenu(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed && !selectedFile) return;

    if (editingMessage && onEditMessage) {
      onEditMessage(editingMessage.id, trimmed);
      setContent('');
      if (onCancelEdit) onCancelEdit();
      return;
    }

    if (trimmed === '/poll' && onOpenCreatePoll) {
      onOpenCreatePoll();
      setContent('');
      setShowSlashMenu(false);
      return;
    }

    if ((trimmed === '/screenshare' || trimmed === '/screen') && onToggleScreenShare) {
      onToggleScreenShare();
      setContent('');
      setShowSlashMenu(false);
      return;
    }

    if (trimmed.startsWith('/play') && onPlayTrack) {
      const match = trimmed.match(/\/play\s+(.*)/i);
      const songQuery = match ? match[1].trim() : '';
      if (songQuery) {
        setContent('');
        setShowSlashMenu(false);
        try {
          const tracks = await searchMusic(songQuery, 5);
          if (tracks && tracks.length > 0) {
            onPlayTrack(tracks[0]);
          } else {
            alert(`No songs found for: "${songQuery}"`);
          }
        } catch (err) {
          console.error('Play command search error:', err);
        }
        return;
      } else if (onOpenMusicSearch) {
        onOpenMusicSearch();
        setContent('');
        setShowSlashMenu(false);
        return;
      }
    }

    if (trimmed === '/music' && onOpenMusicSearch) {
      onOpenMusicSearch();
      setContent('');
      setShowSlashMenu(false);
      return;
    }

    if (trimmed === '/capsule' && onOpenCapsule) {
      onOpenCapsule();
      setContent('');
      setShowSlashMenu(false);
      return;
    }
    if (trimmed === '/draw' && onOpenWhiteboard) {
      onOpenWhiteboard();
      setContent('');
      setShowSlashMenu(false);
      return;
    }
    if (trimmed.startsWith('/watch') && onOpenWatchTogether) {
      const match = trimmed.match(/\/watch\s*(.*)/);
      const url = match ? match[1].trim() : '';
      onOpenWatchTogether(url);
      setContent('');
      setShowSlashMenu(false);
      return;
    }
    if (trimmed === '/p2p') {
      if (p2pFileInputRef.current) p2pFileInputRef.current.click();
      setContent('');
      setShowSlashMenu(false);
      return;
    }

    let uploadedMediaUrl = null;

    if (selectedFile) {
      try {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', selectedFile);
        const res = await api.post('/api/chat/upload/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploadedMediaUrl = res.data.url;
      } catch (err) {
        console.error('Failed to upload image:', err);
        alert('Failed to upload image. Please try again.');
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    onSendMessage(trimmed, uploadedMediaUrl, replyingTo?.id || null, 'text', isViewOnce);
    setContent('');
    handleRemoveFile();
    setIsViewOnce(false);
    if (onCancelReply) onCancelReply();
    setShowPicker(false);
    setShowSlashMenu(false);
    setShowActionsMenu(false);

    if (isTypingRef.current && onTyping) {
      isTypingRef.current = false;
      onTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }

    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      if (editingMessage && onCancelEdit) onCancelEdit();
      if (replyingTo && onCancelReply) onCancelReply();
      setShowSlashMenu(false);
      setShowPicker(false);
      setShowActionsMenu(false);
    }
  };

  const handleAddEmoji = (emoji) => {
    setContent((prev) => prev + emoji);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleSendGif = (gifUrl) => {
    onSendMessage('', gifUrl, replyingTo?.id || null, 'gif', false);
    if (onCancelReply) onCancelReply();
  };

  const handleSendSticker = (stickerUrl) => {
    onSendMessage('', stickerUrl, replyingTo?.id || null, 'sticker', false);
    if (onCancelReply) onCancelReply();
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
      cleanupRecording();
    };
  }, []);

  // Broadcast Only Read-Only Banner for Subscribers
  if (isBroadcastReadOnly) {
    return (
      <div className="p-3.5 bg-[#0d0d10] border-t border-white/10 flex items-center justify-center gap-2 text-zinc-400 text-xs font-semibold select-none">
        <Lock className="w-3.5 h-3.5 text-zinc-500" />
        <span>Only channel administrators can post in this broadcast channel.</span>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 bg-[#0d0d10] border-t border-white/10 relative select-none">
      {/* Hidden Native File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={p2pFileInputRef}
        onChange={handleP2PFileChange}
        className="hidden"
      />

      {/* Quoted Reply Banner */}
      {replyingTo && (
        <div className="mb-2 p-2.5 rounded-2xl bg-[#141417] border border-white/10 flex items-center justify-between animate-slide-up border-l-4 border-l-white">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <Reply className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-white block">
                Replying to {replyingTo.sender?.username || replyingTo.sender_username || 'User'}
              </span>
              <p className="text-xs text-zinc-400 truncate max-w-sm">
                {replyingTo.content || (replyingTo.media_url ? '📷 Photo' : 'Message')}
              </p>
            </div>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 rounded-lg text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Edit Message Banner */}
      {editingMessage && (
        <div className="mb-2 p-2.5 rounded-2xl bg-[#141417] border border-white/10 flex items-center justify-between animate-slide-up border-l-4 border-l-emerald-400">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <Edit2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-emerald-400 block">
                Editing Message
              </span>
              <p className="text-xs text-zinc-400 truncate max-w-sm">
                {editingMessage.content}
              </p>
            </div>
          </div>
          <button
            onClick={onCancelEdit}
            className="p-1 rounded-lg text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Slash Command Auto-Complete Popover */}
      {showSlashMenu && (
        <div className="absolute bottom-full mb-2 left-4 w-80 rounded-2xl glass-panel shadow-2xl border border-white/15 overflow-hidden animate-slide-up z-30">
          <div className="p-2.5 bg-zinc-900 border-b border-white/10 flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
              Slash Commands
            </span>
          </div>
          <div className="p-1 space-y-0.5 max-h-56 overflow-y-auto">
            {SLASH_COMMANDS.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.command}
                  type="button"
                  onClick={() => handleSelectCommand(cmd)}
                  className="w-full p-2.5 rounded-xl hover:bg-zinc-800 transition-colors flex items-center gap-3 text-left group"
                >
                  <div className="p-2 rounded-lg bg-zinc-800 text-white group-hover:bg-white group-hover:text-black transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-mono text-xs font-bold text-white block">
                      {cmd.syntax}
                    </span>
                    <span className="text-[11px] text-zinc-400 leading-tight block">
                      {cmd.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Multi-Action Dropdown Popover Menu */}
      {showActionsMenu && (
        <div
          ref={actionsMenuRef}
          className="absolute bottom-full mb-3 left-3 sm:left-4 w-72 sm:w-80 rounded-2xl glass-panel shadow-2xl border border-white/15 overflow-hidden animate-slide-up z-40 p-2 backdrop-blur-2xl bg-[#141418]/95"
        >
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Attachments & Tools
            </span>
            <button
              type="button"
              onClick={() => setShowActionsMenu(false)}
              className="p-1 rounded-lg text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 max-h-80 overflow-y-auto custom-scrollbar">
            {/* 1. Photo / Image */}
            <button
              type="button"
              onClick={() => {
                setShowActionsMenu(false);
                fileInputRef.current?.click();
              }}
              className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2.5 text-left group"
            >
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 group-hover:scale-105 transition-transform">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block">Photo</span>
                <span className="text-[10px] text-zinc-400 block truncate">Gallery & Image</span>
              </div>
            </button>

            {/* 2. Live Poll */}
            <button
              type="button"
              onClick={() => {
                setShowActionsMenu(false);
                if (onOpenCreatePoll) onOpenCreatePoll();
              }}
              className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2.5 text-left group"
            >
              <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 group-hover:scale-105 transition-transform">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block">Live Poll</span>
                <span className="text-[10px] text-zinc-400 block truncate">Instant Voting</span>
              </div>
            </button>

            {/* 3. Music */}
            <button
              type="button"
              onClick={() => {
                setShowActionsMenu(false);
                if (onOpenMusicSearch) onOpenMusicSearch();
              }}
              className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2.5 text-left group"
            >
              <div className="p-2 rounded-xl bg-violet-500/15 text-violet-400 group-hover:scale-105 transition-transform">
                <Music className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block">Music</span>
                <span className="text-[10px] text-zinc-400 block truncate">Stream Synced</span>
              </div>
            </button>

            {/* 4. Screen Share */}
            <button
              type="button"
              onClick={() => {
                setShowActionsMenu(false);
                if (onToggleScreenShare) onToggleScreenShare();
              }}
              className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2.5 text-left group"
            >
              <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 group-hover:scale-105 transition-transform">
                <Monitor className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block">Screen Share</span>
                <span className="text-[10px] text-zinc-400 block truncate">WebRTC Zero-Lag</span>
              </div>
            </button>

            {/* 5. Time Capsule */}
            <button
              type="button"
              onClick={() => {
                setShowActionsMenu(false);
                if (onOpenCapsule) onOpenCapsule();
              }}
              className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2.5 text-left group"
            >
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 group-hover:scale-105 transition-transform">
                <Hourglass className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block">Time Capsule</span>
                <span className="text-[10px] text-zinc-400 block truncate">Future Reveal</span>
              </div>
            </button>

            {/* 6. P2P File Transfer */}
            <button
              type="button"
              onClick={() => {
                setShowActionsMenu(false);
                p2pFileInputRef.current?.click();
              }}
              className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2.5 text-left group"
            >
              <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 group-hover:scale-105 transition-transform">
                <FileUp className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block">P2P File</span>
                <span className="text-[10px] text-zinc-400 block truncate">Direct Fast Share</span>
              </div>
            </button>

            {/* 7. Watch Together */}
            <button
              type="button"
              onClick={() => {
                setShowActionsMenu(false);
                if (onOpenWatchTogether) onOpenWatchTogether();
              }}
              className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2.5 text-left group"
            >
              <div className="p-2 rounded-xl bg-red-500/15 text-red-400 group-hover:scale-105 transition-transform">
                <Tv className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block">Watch Party</span>
                <span className="text-[10px] text-zinc-400 block truncate">Sync YouTube</span>
              </div>
            </button>

            {/* 8. Whiteboard */}
            <button
              type="button"
              onClick={() => {
                setShowActionsMenu(false);
                if (onOpenWhiteboard) onOpenWhiteboard();
              }}
              className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2.5 text-left group"
            >
              <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 group-hover:scale-105 transition-transform">
                <Pen className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block">Whiteboard</span>
                <span className="text-[10px] text-zinc-400 block truncate">Live Drawing</span>
              </div>
            </button>

            {/* 9. Expense Split */}
            <button
              type="button"
              onClick={() => {
                setShowActionsMenu(false);
                if (onOpenBalanceSheet) onOpenBalanceSheet();
              }}
              className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2.5 text-left group"
            >
              <div className="p-2 rounded-xl bg-teal-500/15 text-teal-400 group-hover:scale-105 transition-transform">
                <Receipt className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block">Split Bill</span>
                <span className="text-[10px] text-zinc-400 block truncate">Group Expenses</span>
              </div>
            </button>

            {/* 10. Disappearing Messages */}
            <button
              type="button"
              onClick={() => {
                setShowActionsMenu(false);
                if (onOpenDisappearingMenu) onOpenDisappearingMenu();
              }}
              className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2.5 text-left group"
            >
              <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 group-hover:scale-105 transition-transform">
                <Timer className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block">Auto Delete</span>
                <span className="text-[10px] text-zinc-400 block truncate">Disappearing Timer</span>
              </div>
            </button>

            {/* 11. Biometric Vault / Lock Chat */}
            {isBiometricSupported && (
              <button
                type="button"
                onClick={() => {
                  setShowActionsMenu(false);
                  if (onToggleLockChat) onToggleLockChat();
                }}
                className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2.5 text-left group"
              >
                <div className={`p-2 rounded-xl transition-transform group-hover:scale-105 ${
                  isLocked ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-500/15 text-zinc-400'
                }`}>
                  {isLocked ? <Shield className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-white block">
                    {isLocked ? 'Vault Protected' : 'Lock Chat'}
                  </span>
                  <span className="text-[10px] text-zinc-400 block truncate">Biometric Security</span>
                </div>
              </button>
            )}

            {/* 12. Select Messages Mode */}
            <button
              type="button"
              onClick={() => {
                setShowActionsMenu(false);
                if (onToggleSelectMode) onToggleSelectMode();
              }}
              className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2.5 text-left group"
            >
              <div className={`p-2 rounded-xl transition-transform group-hover:scale-105 ${
                isSelectMode ? 'bg-white text-black' : 'bg-zinc-500/15 text-zinc-300'
              }`}>
                <CheckSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block">Select</span>
                <span className="text-[10px] text-zinc-400 block truncate">Multi-select Messages</span>
              </div>
            </button>

            {/* 13. Tic Tac Toe */}
            <button
              type="button"
              onClick={() => {
                setShowActionsMenu(false);
                onSendMessage('/game tictactoe');
              }}
              className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2.5 text-left group"
            >
              <div className="p-2 rounded-xl bg-fuchsia-500/15 text-fuchsia-400 group-hover:scale-105 transition-transform">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block">Mini Game</span>
                <span className="text-[10px] text-zinc-400 block truncate">Tic-Tac-Toe</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Multi-Tab GIF, Sticker & Emoji Drawer Popover */}
      <GifStickerPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSelectEmoji={handleAddEmoji}
        onSelectGif={handleSendGif}
        onSelectSticker={handleSendSticker}
      />

      {/* Staged Image Thumbnail Preview Chip with View Once Toggle */}
      {selectedFile && filePreviewUrl && (
        <div className="mb-3 p-2.5 rounded-2xl bg-[#18181b] border border-white/15 inline-flex items-center gap-3 animate-slide-up relative pr-10 shadow-xl">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-black flex-shrink-0 border border-white/10">
            <img src={filePreviewUrl} alt="selected" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 pr-2">
            <p className="text-xs font-bold text-white truncate max-w-[180px]">
              {selectedFile.name}
            </p>
            <p className="text-[10px] text-zinc-400">
              {(selectedFile.size / 1024).toFixed(1)} KB (Compressed & Optimized)
            </p>
          </div>

          {/* View Once Toggle Button */}
          <button
            type="button"
            onClick={() => setIsViewOnce(!isViewOnce)}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              isViewOnce
                ? 'bg-amber-400 text-black shadow-md ring-2 ring-amber-400/50'
                : 'bg-zinc-800 text-zinc-300 hover:text-white'
            }`}
            title="Toggle View Once (Disappears after opening)"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>① View Once</span>
          </button>

          <button
            type="button"
            onClick={handleRemoveFile}
            className="absolute top-2 right-2 p-1 rounded-full bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            title="Remove image"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Live Voice Recording Bar */}
      {isRecording ? (
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-[#18181b] border border-rose-500/30 animate-slide-up shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            <span className="text-xs font-mono font-bold text-rose-400">
              {formatRecordingTime(recordingDuration)}
            </span>

            {/* Live Web Audio Amplitude Bars */}
            <div className="flex items-center gap-1 h-6">
              {liveAmplitudes.map((heightPercent, idx) => (
                <div
                  key={idx}
                  style={{ height: `${heightPercent}%` }}
                  className="w-1 bg-gradient-to-t from-rose-500 to-rose-300 rounded-full transition-all duration-75"
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsViewOnce(!isViewOnce)}
              className={`p-1.5 rounded-xl text-xs font-bold transition-all ${
                isViewOnce
                  ? 'bg-amber-400 text-black shadow-md'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
              title="Send as View Once audio note"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={cancelRecording}
              className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Cancel Recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={stopAndSendRecording}
              className="btn-primary px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-md"
              title="Send Voice Note"
            >
              <Send className="w-3.5 h-3.5 fill-black" />
              <span>Send</span>
            </button>
          </div>
        </div>
      ) : (
        /* Regular Message Input Form */
        <form onSubmit={handleSend} className="flex items-center gap-2">
          {/* Action Menu / Dropdown Trigger (+) */}
          <button
            type="button"
            onClick={() => {
              setShowActionsMenu((prev) => !prev);
              setShowPicker(false);
              setShowSlashMenu(false);
            }}
            className={`btn-icon p-2.5 transition-all ${
              showActionsMenu ? 'bg-white text-black rotate-45' : 'hover:text-white'
            }`}
            title="Attachments & Actions Menu"
          >
            <Plus className="w-4 h-4 transition-transform duration-200" />
          </button>

          {/* Emoji, GIFs & Stickers Button */}
          <button
            type="button"
            onClick={() => {
              setShowPicker((prev) => !prev);
              setShowActionsMenu(false);
              setShowSlashMenu(false);
            }}
            className={`btn-icon p-2.5 ${showPicker ? 'bg-white text-black' : ''}`}
            title="Emojis, GIFs & Stickers"
          >
            <Smile className="w-4 h-4" />
          </button>

          {/* Message Input */}
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={content}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              disabled={disabled || isUploading}
              placeholder={
                isUploading
                  ? 'Optimizing & uploading media...'
                  : editingMessage
                  ? 'Edit message content...'
                  : replyingTo
                  ? `Reply to ${replyingTo.sender?.username || replyingTo.sender_username || 'message'}...`
                  : "Type message, /poll, /play song, or '/' for commands..."
              }
              className="w-full py-2.5 px-4 rounded-xl glass-input text-xs md:text-sm focus:outline-none placeholder-zinc-500"
            />
          </div>

          {/* Send or Voice Record Button */}
          {content.trim() || selectedFile || editingMessage ? (
            <button
              type="submit"
              disabled={disabled || isUploading}
              className="btn-primary p-2.5 flex items-center justify-center flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
              title={editingMessage ? 'Save Changes' : 'Send message'}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : editingMessage ? (
                <Edit2 className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4 fill-black" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={disabled || isUploading}
              className="btn-icon p-2.5 hover:text-white hover:bg-rose-500/20 hover:border-rose-500/30 transition-colors"
              title="Record Voice Note"
            >
              <Mic className="w-4 h-4 text-zinc-300" />
            </button>
          )}
        </form>
      )}
    </div>
  );
};

export default MessageInput;
