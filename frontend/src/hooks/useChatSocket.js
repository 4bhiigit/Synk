import { useState, useEffect, useRef, useCallback } from 'react';

const getWsBaseUrl = () => {
  let url = import.meta.env.VITE_WS_URL;
  if (!url && import.meta.env.VITE_API_URL) {
    url = import.meta.env.VITE_API_URL.replace(/^http/i, 'ws');
  }
  if (url) {
    url = url.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
    return url.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `ws://${hostname}:8000`;
    }
    return 'wss://synk-chat-backend.onrender.com';
  }
  return 'ws://localhost:8000';
};

export const useChatSocket = (roomId, token) => {
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [disappearingTimer, setDisappearingTimer] = useState(0);
  const [pinnedMessages, setPinnedMessages] = useState([]);

  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef(null);
  const typingTimerRef = useRef({});
  const shouldReconnectRef = useRef(true);
  const eventListenersRef = useRef(new Map());

  // Subscribe to specific socket events
  const subscribe = useCallback((eventType, callback) => {
    if (!eventListenersRef.current.has(eventType)) {
      eventListenersRef.current.set(eventType, new Set());
    }
    eventListenersRef.current.get(eventType).add(callback);

    return () => {
      const set = eventListenersRef.current.get(eventType);
      if (set) {
        set.delete(callback);
      }
    };
  }, []);

  const emitLocal = (eventType, data) => {
    const listeners = eventListenersRef.current.get(eventType);
    if (listeners) {
      listeners.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in listener for ${eventType}:`, e);
        }
      });
    }
  };

  const connect = useCallback(() => {
    const effectiveToken = token || (typeof window !== 'undefined' ? localStorage.getItem('access_token') : null);
    if (!roomId || !effectiveToken) return;

    shouldReconnectRef.current = true;

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {}
    }

    setConnectionStatus('connecting');
    const wsBase = getWsBaseUrl();
    const wsUrl = `${wsBase}/ws/chat/${roomId}/?token=${encodeURIComponent(effectiveToken)}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'video_state_request' }));
        }

        // Heartbeat ping keepalive every 12 seconds for Cloudflare/Render proxies
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 12000);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const eventType = payload.type;

          // Notify direct event subscribers first
          emitLocal(eventType, payload);

          // 1. New Message / Structured Card
          if (eventType === 'message') {
            const newMsg = payload.message;
            setMessages((prev) => {
              // Direct ID match
              if (prev.some((m) => m.id === newMsg.id)) {
                return prev.map((m) => (m.id === newMsg.id ? newMsg : m));
              }

              // Optimistic message replacement for fast UI
              const optIndex = prev.findIndex(
                (m) =>
                  m.id?.toString().startsWith('temp_') &&
                  m.content === newMsg.content &&
                  (m.sender?.id === newMsg.sender?.id || m.sender?.username === newMsg.sender?.username)
              );

              if (optIndex !== -1) {
                const nextList = [...prev];
                nextList[optIndex] = newMsg;
                return nextList;
              }

              return [...prev, newMsg];
            });

            if (newMsg.sender?.id) {
              setTypingUsers((prev) => {
                if (!prev[newMsg.sender.id]) return prev;
                const next = { ...prev };
                delete next[newMsg.sender.id];
                return next;
              });
            }
          }

          // 2. Poll Vote Update
          else if (eventType === 'poll_vote_update') {
            const updatedPoll = payload.poll;
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.message_type === 'poll_card' && (msg.poll_data?.id === updatedPoll.id || msg.content === updatedPoll.question)) {
                  return {
                    ...msg,
                    poll_data: updatedPoll,
                  };
                }
                return msg;
              })
            );
          }

          // 3. Pinned Messages Update
          else if (eventType === 'pinned_message_update') {
            const updatedPinned = payload.pinned_messages || [];
            setPinnedMessages(updatedPinned);
          }

          // 4. View Once Opened Broadcast
          else if (eventType === 'view_once_opened') {
            const { message_id, user_id } = payload;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === message_id
                  ? {
                      ...msg,
                      is_view_once_opened: true,
                      media_url: null,
                    }
                  : msg
              )
            );
          }

          // 5. Disappearing Timer Update
          else if (eventType === 'disappearing_timer_update') {
            const { disappearing_timer } = payload;
            setDisappearingTimer(disappearing_timer);
          }

          // 6. Message Reaction Update
          else if (eventType === 'message_reaction_update') {
            const { message_id, reactions, user_id } = payload;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === message_id ? { ...msg, reactions } : msg
              )
            );
          }

          // 7. Time Capsule Unlocked Broadcast
          else if (eventType === 'capsule_unlocked') {
            const { message_id, content, media_url, is_unlocked } = payload;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === message_id
                  ? { ...msg, content, media_url, is_unlocked: true, is_locked_for_me: false }
                  : msg
              )
            );
          }

          // 8. Message Edit
          else if (eventType === 'message_edit') {
            const { message_id, content, is_edited, edited_at } = payload;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === message_id
                  ? { ...msg, content, is_edited: true, edited_at: edited_at || new Date().toISOString() }
                  : msg
              )
            );
          }

          // 9. Message Delete
          else if (eventType === 'message_delete') {
            const { message_ids, delete_mode } = payload;
            const idsToDelete = new Set(message_ids || []);

            if (delete_mode === 'for_everyone') {
              setMessages((prev) =>
                prev.map((msg) =>
                  idsToDelete.has(msg.id)
                    ? {
                        ...msg,
                        deleted_for_everyone: true,
                        content: '🚫 This message was deleted',
                        media_url: null,
                        reactions: [],
                      }
                    : msg
                )
              );
            } else {
              setMessages((prev) => prev.filter((msg) => !idsToDelete.has(msg.id)));
            }
          }

          // 10. Typing Indicator
          else if (eventType === 'typing') {
            const { user_id, username, is_typing } = payload;
            if (is_typing) {
              setTypingUsers((prev) => {
                if (prev[user_id] === username) return prev;
                return { ...prev, [user_id]: username };
              });

              if (typingTimerRef.current[user_id]) {
                clearTimeout(typingTimerRef.current[user_id]);
              }

              typingTimerRef.current[user_id] = setTimeout(() => {
                setTypingUsers((prev) => {
                  if (!prev[user_id]) return prev;
                  const updated = { ...prev };
                  delete updated[user_id];
                  return updated;
                });
              }, 3000);
            } else {
              setTypingUsers((prev) => {
                if (!prev[user_id]) return prev;
                const updated = { ...prev };
                delete updated[user_id];
                return updated;
              });
            }
          }

          // 11. Read Receipts
          else if (eventType === 'read_receipt') {
            const { user_id, message_id } = payload;
            setMessages((prev) =>
              prev.map((msg) => {
                if (!message_id || msg.id === message_id) {
                  const currentReadBy = new Set(msg.read_by || []);
                  if (user_id) currentReadBy.add(user_id);
                  return {
                    ...msg,
                    read_by: Array.from(currentReadBy),
                    read_by_count: currentReadBy.size,
                    delivery_status: 'read',
                  };
                }
                return msg;
              })
            );
          }

          // 12. Poll Vote Update
          else if (eventType === 'poll_vote_update') {
            const { poll_id, poll } = payload;
            if (poll) {
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.message_type === 'poll_card' && (msg.poll_data?.id === poll_id || msg.poll_data?.id === poll.id)) {
                    return { ...msg, poll_data: poll };
                  }
                  return msg;
                })
              );
            }
          }

          // 13. Pinned Messages Update
          else if (eventType === 'pinned_messages_update') {
            const { pinned_messages } = payload;
            if (pinned_messages) {
              setPinnedMessages(pinned_messages);
            }
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.warn('WebSocket error:', error);
        setConnectionStatus('disconnected');
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
      };

      ws.onclose = (event) => {
        setConnectionStatus('disconnected');
        socketRef.current = null;
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        if (event.code === 4001 || event.code === 4003) {
          shouldReconnectRef.current = false;
          return;
        }

        if (shouldReconnectRef.current) {
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 5000);
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (err) {
      console.error('WebSocket connection initialization error:', err);
      setConnectionStatus('disconnected');
    }
  }, [roomId, token]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

  // Senders
  const sendMessage = useCallback((content, mediaUrl = null, replyToId = null, messageType = 'text', isViewOnce = false) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'message',
          content: content,
          media_url: mediaUrl,
          reply_to_id: replyToId,
          message_type: messageType,
          is_view_once: isViewOnce,
        })
      );
      return true;
    }
    return false;
  }, []);

  const sendPollVote = useCallback((pollId, optionId) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'poll_vote',
          poll_id: pollId,
          option_id: optionId,
        })
      );
    }
  }, []);

  const sendPinMessage = useCallback((messageId) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'pin_message',
          message_id: messageId,
        })
      );
    }
  }, []);

  const sendReaction = useCallback((messageId, emoji) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'message_reaction',
          message_id: messageId,
          emoji: emoji,
        })
      );
      return true;
    }
    return false;
  }, []);

  const sendViewOnceOpened = useCallback((messageId) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'view_once_opened',
          message_id: messageId,
        })
      );
    }
  }, []);

  const sendDisappearingTimer = useCallback((timerSeconds) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'disappearing_timer_update',
          disappearing_timer: timerSeconds,
        })
      );
    }
  }, []);

  const sendCallSignaling = useCallback((payload) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const sendScreenShareSignaling = useCallback((payload) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const sendMusicChangeTrack = useCallback((track) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'music_change_track',
          track: track,
        })
      );
      return true;
    }
    return false;
  }, []);

  const sendMusicSyncAction = useCallback((action, currentTime) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'music_sync_action',
          action: action,
          current_time: currentTime,
        })
      );
    }
  }, []);

  const sendMusicQueueUpdate = useCallback((queue) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'music_queue_update',
          queue: queue,
        })
      );
    }
  }, []);

  const sendCreateCapsule = useCallback(({ title, content, mediaUrl, unlockAt }) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'create_capsule',
          capsule_title: title,
          content: content,
          media_url: mediaUrl,
          unlock_at: unlockAt,
        })
      );
      return true;
    }
    return false;
  }, []);

  const sendUnlockCapsuleRequest = useCallback((messageId) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'unlock_capsule_request',
          message_id: messageId,
        })
      );
    }
  }, []);

  const sendEditMessage = useCallback((messageId, content) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'message_edit',
          message_id: messageId,
          content: content,
        })
      );
    }
  }, []);

  const sendDeleteMessages = useCallback((messageIds, deleteMode = 'for_me') => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'message_delete',
          message_ids: messageIds,
          delete_mode: deleteMode,
        })
      );
    }
  }, []);

  const sendP2PSignaling = useCallback((payload) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const sendGameMove = useCallback((payload) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const sendTypingStatus = useCallback((isTyping) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'typing',
          is_typing: isTyping,
        })
      );
    }
  }, []);

  const sendReadReceipt = useCallback((messageId = null) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'read_receipt',
          message_id: messageId,
        })
      );
    }
  }, []);

  const sendVideoLoad = useCallback((videoUrl, videoId, title = '') => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'video_load',
          video_url: videoUrl,
          video_id: videoId,
          title: title,
        })
      );
    }
  }, []);

  const sendVideoSync = useCallback((action, currentTime) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'video_sync',
          action: action,
          current_time: currentTime,
        })
      );
    }
  }, []);

  const sendCanvasDraw = useCallback((strokes) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'canvas_draw',
          strokes: strokes,
        })
      );
    }
  }, []);

  const sendCanvasClear = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'canvas_clear',
        })
      );
    }
  }, []);

  return {
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
    reconnect: connect,
  };
};

export default useChatSocket;
