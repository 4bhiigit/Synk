import { useState, useRef, useCallback, useEffect } from 'react';

const CHUNK_SIZE = 64 * 1024; // 64KB chunks
const MAX_BUFFER_AMOUNT = 256 * 1024; // 256KB backpressure limit
const STUN_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export const useP2PTransfer = (sendP2PSignaling, subscribe) => {
  const [transferState, setTransferState] = useState({
    status: 'idle', // 'idle' | 'offering' | 'connecting' | 'transferring' | 'completed' | 'error'
    progress: 0,
    speedMBps: 0,
    etaSeconds: 0,
    fileName: '',
    fileSize: 0,
    isSender: false,
    fileBlobUrl: null,
  });

  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const fileReaderRef = useRef(null);
  const receivedChunksRef = useRef([]);
  const receivedBytesRef = useRef(0);
  const startTimeRef = useRef(null);
  const fileMetaRef = useRef(null);

  // Initialize Peer Connection
  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(STUN_SERVERS);
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendP2PSignaling({
          type: 'webrtc_ice_candidate',
          candidate: event.candidate,
        });
      }
    };

    return pc;
  }, [sendP2PSignaling]);

  // SENDER: Send large file via RTCDataChannel
  const sendFile = useCallback(async (file) => {
    if (!file) return;

    setTransferState({
      status: 'offering',
      progress: 0,
      speedMBps: 0,
      etaSeconds: 0,
      fileName: file.name,
      fileSize: file.size,
      isSender: true,
      fileBlobUrl: null,
    });

    const pc = createPeerConnection();
    const dataChannel = pc.createDataChannel('p2p_file_channel');
    dataChannel.binaryType = 'arraybuffer';
    dataChannelRef.current = dataChannel;

    dataChannel.onopen = async () => {
      setTransferState((prev) => ({ ...prev, status: 'transferring' }));
      startTimeRef.current = Date.now();

      // 1. Send file metadata header
      dataChannel.send(
        JSON.stringify({
          type: 'file_meta',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          totalChunks: Math.ceil(file.size / CHUNK_SIZE),
        })
      );

      // 2. Stream binary chunks with backpressure
      let offset = 0;
      let chunkIndex = 0;

      const sendNextChunk = () => {
        if (offset >= file.size) {
          dataChannel.send(JSON.stringify({ type: 'file_complete' }));
          setTransferState((prev) => ({
            ...prev,
            status: 'completed',
            progress: 100,
          }));
          return;
        }

        if (dataChannel.bufferedAmount > MAX_BUFFER_AMOUNT) {
          dataChannel.onbufferedamountlow = () => {
            dataChannel.onbufferedamountlow = null;
            sendNextChunk();
          };
          return;
        }

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const reader = new FileReader();
        reader.onload = (e) => {
          dataChannel.send(e.target.result);
          offset += CHUNK_SIZE;
          chunkIndex++;

          // Speed & ETA calculations
          const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
          const speed = elapsedSec > 0 ? (offset / (1024 * 1024)) / elapsedSec : 0;
          const remainingBytes = Math.max(0, file.size - offset);
          const eta = speed > 0 ? remainingBytes / (speed * 1024 * 1024) : 0;
          const progress = Math.min(100, Math.round((offset / file.size) * 100));

          setTransferState((prev) => ({
            ...prev,
            progress,
            speedMBps: Number(speed.toFixed(2)),
            etaSeconds: Math.round(eta),
          }));

          sendNextChunk();
        };
        reader.readAsArrayBuffer(slice);
      };

      sendNextChunk();
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    sendP2PSignaling({
      type: 'webrtc_offer',
      offer: offer,
      fileName: file.name,
      fileSize: file.size,
    });
  }, [createPeerConnection, sendP2PSignaling]);

  // RECEIVER & SIGNALING LISTENER
  useEffect(() => {
    if (!subscribe) return;

    const unsubSignal = subscribe('webrtc_offer', async (payload) => {
      const pc = createPeerConnection();

      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dc.binaryType = 'arraybuffer';
        dataChannelRef.current = dc;

        receivedChunksRef.current = [];
        receivedBytesRef.current = 0;
        startTimeRef.current = Date.now();

        dc.onmessage = (e) => {
          if (typeof e.data === 'string') {
            try {
              const msg = JSON.parse(e.data);
              if (msg.type === 'file_meta') {
                fileMetaRef.current = msg;
                setTransferState({
                  status: 'transferring',
                  progress: 0,
                  speedMBps: 0,
                  etaSeconds: 0,
                  fileName: msg.fileName,
                  fileSize: msg.fileSize,
                  isSender: false,
                  fileBlobUrl: null,
                });
              } else if (msg.type === 'file_complete') {
                const blob = new Blob(receivedChunksRef.current, {
                  type: fileMetaRef.current?.fileType || 'application/octet-stream',
                });
                const blobUrl = URL.createObjectURL(blob);

                setTransferState((prev) => ({
                  ...prev,
                  status: 'completed',
                  progress: 100,
                  fileBlobUrl: blobUrl,
                }));

                // Auto trigger download
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = fileMetaRef.current?.fileName || 'downloaded_file';
                a.click();
              }
            } catch (err) {
              console.error('P2P message parse error:', err);
            }
          } else {
            // Binary chunk received
            receivedChunksRef.current.push(e.data);
            receivedBytesRef.current += e.data.byteLength;

            const total = fileMetaRef.current?.fileSize || 1;
            const current = receivedBytesRef.current;
            const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
            const speed = elapsedSec > 0 ? (current / (1024 * 1024)) / elapsedSec : 0;
            const remainingBytes = Math.max(0, total - current);
            const eta = speed > 0 ? remainingBytes / (speed * 1024 * 1024) : 0;
            const progress = Math.min(100, Math.round((current / total) * 100));

            setTransferState((prev) => ({
              ...prev,
              progress,
              speedMBps: Number(speed.toFixed(2)),
              etaSeconds: Math.round(eta),
            }));
          }
        };
      };

      await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendP2PSignaling({
        type: 'webrtc_answer',
        answer: answer,
      });
    });

    const unsubAnswer = subscribe('webrtc_answer', async (payload) => {
      if (peerConnectionRef.current && payload.answer) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(payload.answer)
        );
      }
    });

    const unsubIce = subscribe('webrtc_ice_candidate', async (payload) => {
      if (peerConnectionRef.current && payload.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(payload.candidate)
          );
        } catch (e) {
          console.warn('ICE candidate add error:', e);
        }
      }
    });

    return () => {
      unsubSignal();
      unsubAnswer();
      unsubIce();
    };
  }, [subscribe, createPeerConnection, sendP2PSignaling]);

  return {
    transferState,
    sendFile,
    resetTransfer: () => setTransferState({ status: 'idle', progress: 0, speedMBps: 0, etaSeconds: 0, fileName: '', fileSize: 0, isSender: false, fileBlobUrl: null }),
  };
};
