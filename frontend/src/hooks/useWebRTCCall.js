import { useState, useEffect, useRef, useCallback } from 'react';
import {
  startIncomingCallRingtone,
  stopIncomingCallRingtone,
  playClickSound,
} from '../utils/appleSounds';
import { triggerHaptic } from '../utils/appleHaptics';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const useWebRTCCall = (sendSignaling, subscribe, currentUserId, currentUsername) => {
  const [callState, setCallState] = useState('idle'); // 'idle' | 'ringing_outgoing' | 'ringing_incoming' | 'connected' | 'minimized'
  const [callType, setCallType] = useState('voice'); // 'voice' | 'video'
  const [peerInfo, setPeerInfo] = useState(null); // { id, name, avatar }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'

  const peerConnectionRef = useRef(null);
  const callTimerRef = useRef(null);
  const localStreamRef = useRef(null);

  const cleanupCall = useCallback(() => {
    stopIncomingCallRingtone();

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setPeerInfo(null);
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoEnabled(true);
  }, []);

  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && sendSignaling) {
        sendSignaling({
          type: 'call_ice_candidate',
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        stopIncomingCallRingtone();
        setCallState('connected');
        triggerHaptic('success');

        if (!callTimerRef.current) {
          callTimerRef.current = setInterval(() => {
            setCallDuration((prev) => prev + 1);
          }, 1000);
        }
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        cleanupCall();
      }
    };

    return pc;
  }, [sendSignaling, cleanupCall]);

  // Start Call (Outgoing)
  const startCall = async (targetUser, type = 'voice') => {
    try {
      cleanupCall();
      setCallType(type);
      setPeerInfo({
        id: targetUser.id,
        name: targetUser.username || targetUser.name,
        avatar: targetUser.avatar_url || targetUser.avatar,
      });
      setCallState('ringing_outgoing');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video' ? { facingMode: 'user' } : false,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (sendSignaling) {
        sendSignaling({
          type: 'call_offer',
          call_type: type,
          offer: offer,
          caller_id: currentUserId,
          caller_name: currentUsername,
        });
      }
    } catch (err) {
      console.error('Failed to start call:', err);
      alert('Camera / microphone access error.');
      cleanupCall();
    }
  };

  // Accept Call (Incoming)
  const acceptCall = async () => {
    try {
      stopIncomingCallRingtone();
      triggerHaptic('medium');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video' ? { facingMode: 'user' } : false,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = peerConnectionRef.current || createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (sendSignaling) {
        sendSignaling({
          type: 'call_answer',
          answer: answer,
        });
      }

      setCallState('connected');
      if (!callTimerRef.current) {
        callTimerRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
    } catch (err) {
      console.error('Failed to accept call:', err);
      cleanupCall();
    }
  };

  // Reject / Decline Call
  const rejectCall = () => {
    if (sendSignaling) {
      sendSignaling({ type: 'call_reject' });
    }
    cleanupCall();
  };

  // End / Hangup Active Call
  const endCall = () => {
    if (sendSignaling) {
      sendSignaling({ type: 'call_end' });
    }
    cleanupCall();
  };

  // Mute / Unmute Audio
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        triggerHaptic('light');
      }
    }
  };

  // Enable / Disable Video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        triggerHaptic('light');
      }
    }
  };

  // Flip Camera (Front / Back)
  const flipCamera = async () => {
    if (callType !== 'video' || !localStreamRef.current) return;

    try {
      const nextMode = facingMode === 'user' ? 'environment' : 'user';
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextMode },
        audio: true,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (peerConnectionRef.current) {
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(newVideoTrack);
        }
      }

      // Stop old video track
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
      if (oldVideoTrack) oldVideoTrack.stop();

      localStreamRef.current = newStream;
      setLocalStream(newStream);
      setFacingMode(nextMode);
      triggerHaptic('light');
    } catch (err) {
      console.warn('Camera flip not supported on this device:', err);
    }
  };

  // Minimize to Dynamic Island
  const minimizeCall = () => {
    setCallState('minimized');
    triggerHaptic('light');
  };

  // Restore from Dynamic Island
  const restoreCall = () => {
    setCallState('connected');
    triggerHaptic('light');
  };

  // WebSockets Signaling Event Listeners
  useEffect(() => {
    if (!subscribe) return;

    // Incoming Call Offer
    const unsubOffer = subscribe('call_offer', async (payload) => {
      if (payload.sender_id === currentUserId) return;

      setCallType(payload.call_type || 'voice');
      setPeerInfo({
        id: payload.sender_id,
        name: payload.sender_username || payload.caller_name || 'Caller',
        avatar: payload.sender_avatar,
      });
      setCallState('ringing_incoming');
      startIncomingCallRingtone();
      triggerHaptic('heavy');

      const pc = createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
    });

    // Remote Answer
    const unsubAnswer = subscribe('call_answer', async (payload) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(payload.answer)
        );
        stopIncomingCallRingtone();
        setCallState('connected');
      }
    });

    // ICE Candidate
    const unsubCandidate = subscribe('call_ice_candidate', async (payload) => {
      if (peerConnectionRef.current && payload.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(payload.candidate)
          );
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      }
    });

    // Call Reject / End
    const unsubReject = subscribe('call_reject', () => cleanupCall());
    const unsubEnd = subscribe('call_end', () => cleanupCall());

    return () => {
      unsubOffer();
      unsubAnswer();
      unsubCandidate();
      unsubReject();
      unsubEnd();
    };
  }, [subscribe, currentUserId, createPeerConnection, cleanupCall]);

  return {
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
  };
};

export default useWebRTCCall;
