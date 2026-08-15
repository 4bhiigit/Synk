import { useState, useRef, useEffect, useCallback } from 'react';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const useScreenShare = (sendSignaling, subscribe, currentUserId, currentUsername) => {
  const [isSharing, setIsSharing] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [sharerInfo, setSharerInfo] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [latencyMs, setLatencyMs] = useState(24);
  const [qualityMode, setQualityMode] = useState('1080p'); // '720p' | '1080p'
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [shareError, setShareError] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pingIntervalRef = useRef(null);

  // Initialize or get RTCPeerConnection
  const getOrCreatePeerConnection = useCallback(() => {
    if (pcRef.current && pcRef.current.signalingState !== 'closed') {
      return pcRef.current;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    // Exchange ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && sendSignaling) {
        sendSignaling({
          type: 'screenshare_ice_candidate',
          candidate: event.candidate,
        });
      }
    };

    // Receive Remote Stream Tracks
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        setIsViewing(true);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        cleanupPeerConnection();
      }
    };

    return pc;
  }, [sendSignaling]);

  // Clean up RTCPeerConnection and local streams
  const cleanupPeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsSharing(false);
    setIsViewing(false);
    setSharerInfo(null);
  }, []);

  // Handle incoming WebRTC signaling messages
  useEffect(() => {
    if (!subscribe) return;

    // Status broadcast (started / stopped)
    const unsubStatus = subscribe('screenshare_status', async (payload) => {
      if (payload.is_sharing) {
        if (payload.sharer_id !== String(currentUserId)) {
          setSharerInfo({ id: payload.sharer_id, name: payload.sharer_name });
          setIsViewing(true);
        }
      } else {
        cleanupPeerConnection();
      }
    });

    // Remote SDP Offer (Viewer receives offer from Sharer)
    const unsubOffer = subscribe('screenshare_offer', async (payload) => {
      if (payload.sender_id === String(currentUserId)) return;

      try {
        const pc = getOrCreatePeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        setSharerInfo({ id: payload.sender_id, name: payload.sender_name });
        setIsViewing(true);

        if (sendSignaling) {
          sendSignaling({
            type: 'screenshare_answer',
            answer: answer,
          });
        }
      } catch (err) {
        console.error('Failed to handle screen share offer:', err);
      }
    });

    // Remote SDP Answer (Sharer receives answer from Viewer)
    const unsubAnswer = subscribe('screenshare_answer', async (payload) => {
      if (payload.sender_id === String(currentUserId)) return;

      try {
        if (pcRef.current && pcRef.current.signalingState === 'have-local-offer') {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
        }
      } catch (err) {
        console.error('Failed to set remote description answer:', err);
      }
    });

    // Remote ICE Candidate
    const unsubIce = subscribe('screenshare_ice_candidate', async (payload) => {
      if (payload.sender_id === String(currentUserId)) return;

      try {
        if (pcRef.current && payload.candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      } catch (err) {
        console.error('Failed to add screen share ICE candidate:', err);
      }
    });

    // Ping / Latency monitor
    const unsubPing = subscribe('screenshare_ping', (payload) => {
      if (payload.timestamp && payload.sender_id !== String(currentUserId)) {
        const rtt = Date.now() - payload.timestamp;
        setLatencyMs(Math.max(12, Math.min(rtt, 120)));
      }
    });

    return () => {
      unsubStatus();
      unsubOffer();
      unsubAnswer();
      unsubIce();
      unsubPing();
    };
  }, [subscribe, sendSignaling, currentUserId, getOrCreatePeerConnection, cleanupPeerConnection]);

  // Start Screen Sharing
  const startScreenShare = async () => {
    setShareError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setShareError('Screen sharing is not supported on this device/browser.');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          frameRate: { ideal: qualityMode === '1080p' ? 60 : 30, max: 60 },
          width: { ideal: qualityMode === '1080p' ? 1920 : 1280 },
          height: { ideal: qualityMode === '1080p' ? 1080 : 720 },
        },
        audio: true, // Capture system audio if supported
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsSharing(true);
      setSharerInfo({ id: String(currentUserId), name: currentUsername || 'You' });

      // Handle browser's native "Stop sharing" bar button
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }

      const pc = getOrCreatePeerConnection();

      // Add tracks to PeerConnection with low-latency framerate preservation
      stream.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, stream);
        if (sender && sender.setParameters) {
          const params = sender.getParameters() || {};
          params.degradationPreference = 'maintain-framerate';
          sender.setParameters(params).catch(() => {});
        }
      });

      // Create and send SDP Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (sendSignaling) {
        sendSignaling({
          type: 'screenshare_status',
          is_sharing: true,
          sharer_id: String(currentUserId),
          sharer_name: currentUsername,
        });

        sendSignaling({
          type: 'screenshare_offer',
          offer: offer,
        });
      }

      // Start periodic ping measurement
      pingIntervalRef.current = setInterval(() => {
        if (sendSignaling) {
          sendSignaling({
            type: 'screenshare_ping',
            timestamp: Date.now(),
          });
        }
      }, 3000);

      return true;
    } catch (err) {
      console.error('Error starting screen share:', err);
      if (err.name !== 'NotAllowedError') {
        setShareError('Failed to capture screen stream.');
      }
      cleanupPeerConnection();
      return false;
    }
  };

  // Stop Screen Sharing
  const stopScreenShare = () => {
    if (sendSignaling && isSharing) {
      sendSignaling({
        type: 'screenshare_status',
        is_sharing: false,
        sharer_id: String(currentUserId),
        sharer_name: currentUsername,
      });
    }
    cleanupPeerConnection();
  };

  // Toggle Audio Mute
  const toggleAudio = () => {
    const stream = localStreamRef.current || remoteStream;
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted((prev) => !prev);
    }
  };

  // Switch between 720p 30fps and 1080p 60fps
  const toggleQuality = (mode) => {
    setQualityMode(mode);
    if (isSharing) {
      // Re-capture or adjust constraints
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack && videoTrack.applyConstraints) {
        videoTrack.applyConstraints({
          frameRate: { ideal: mode === '1080p' ? 60 : 30 },
          width: { ideal: mode === '1080p' ? 1920 : 1280 },
          height: { ideal: mode === '1080p' ? 1080 : 720 },
        }).catch(() => {});
      }
    }
  };

  return {
    isSharing,
    isViewing,
    sharerInfo,
    localStream,
    remoteStream,
    latencyMs,
    qualityMode,
    isAudioMuted,
    shareError,
    startScreenShare,
    stopScreenShare,
    toggleAudio,
    toggleQuality,
  };
};
