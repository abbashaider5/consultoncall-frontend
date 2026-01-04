import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import ringtoneAudio from '../assets/soft_ringtone.mp3';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from './AuthContext';

// PRODUCTION Socket URL - MUST be set in Vercel env vars
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || (
  process.env.NODE_ENV === 'production' 
    ? 'https://consultoncall-socket-server.onrender.com' 
    : 'http://localhost:10000'
);

const SocketContext = createContext();

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [onlineExperts, setOnlineExperts] = useState(new Set());
  const [busyExperts, setBusyExperts] = useState(new Set());
  const [expertStatuses, setExpertStatuses] = useState(new Map());
  
  // Initialize expert statuses from API data (for initial display)
  const initializeExpertStatus = useCallback((experts) => {
    if (!Array.isArray(experts)) return;
    
    const statusMap = new Map();
    const onlineSet = new Set();
    const busySet = new Set();
    
    experts.forEach(expert => {
      const expertId = expert._id || expert.id;
      if (!expertId) return;
      
      // Initialize from API data
      const isOnline = !!expert.isOnline;
      const isBusy = !!expert.isBusy;
      
      statusMap.set(expertId, {
        isOnline,
        isBusy,
        lastUpdated: Date.now(),
        currentCallId: expert.currentCallId
      });
      
      if (isOnline) {
        onlineSet.add(expertId);
      }
      
      if (isBusy) {
        busySet.add(expertId);
      }
    });
    
    setExpertStatuses(statusMap);
    setOnlineExperts(onlineSet);
    setBusyExperts(busySet);
  }, []);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [newMessage, setNewMessage] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const { user, expert, isAuthenticated, isExpert } = useAuth();

  const socketRef = useRef(null);
  const incomingCallAudioRef = useRef(null);
  const reconnectAttempts = useRef(0);

  // Initialize socket connection
  useEffect(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        console.log('🔌 Disconnecting socket (user not authenticated)');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
      return;
    }

    // For experts, wait until expert profile is loaded so we have a stable expertId
    if (isExpert && !expert?._id && !expert?.id) {
      return;
    }

    if (socketRef.current?.connected) {
      console.log('✅ Socket already connected:', socketRef.current.id);
      return;
    }

    console.log('🔌 Initializing socket connection...');
    console.log('📍 Socket URL:', SOCKET_URL);
    console.log('👤 User authenticated:', isAuthenticated);
    console.log('🎭 User type:', isExpert ? 'expert' : 'user');

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'], // Force WebSocket only - NO polling for better stability
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 45000,
      autoConnect: true,
      forceNew: true,
      withCredentials: false, // Important for CORS with * or specific origins without cookies
      path: '/socket.io/' // Ensure path is correct
    });

    socketRef.current = newSocket;
    // Expose socket to window for debugging
    window.socket = newSocket;

    newSocket.on('connect', () => {
      console.log('✅ Socket connected successfully!');
      console.log('🆔 Socket ID:', newSocket.id);
      reconnectAttempts.current = 0;
      setSocket(newSocket);
      setIsConnected(true);
      setConnectionError(null);

      // Register user or expert
      const userId = isExpert ? (expert?._id || expert?.id) : (user?._id || user?.id);
      const userType = isExpert ? 'expert' : 'user';

      if (userId) {
        console.log(`📝 Registering as ${userType}:`, userId);
        newSocket.emit('register', { userId, userType });
      } else {
        console.warn('⚠️ No user ID available for registration');
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('❌ Socket connection error:', err.message);
      setConnectionError(err.message);
      setIsConnected(false);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      console.log('🔍 Active call exists:', !!activeCall);
      console.log('🔍 Call status:', activeCall?.status);

      // CRITICAL: Do NOT automatically clear activeCall on socket disconnect
      // WebRTC peer connection is independent of socket transport
      // Socket will auto-reconnect and WebRTC will continue
      // Only clear activeCall if:
      // 1. Explicit call_ended event received from server
      // 2. User explicitly ends call
      // 3. WebRTC explicitly fails
      setIsConnected(false);

      if (reason === 'io server disconnect') {
        console.log('🔄 Server disconnected socket - will auto-reconnect');
        console.log('🎯 IMPORTANT: activeCall state preserved - WebRTC continues independently');
        // Do NOT reset activeCall - let WebRTC continue
      } else {
        console.log('🔄 Client-side disconnect - will auto-reconnect');
        console.log('🎯 IMPORTANT: activeCall state preserved - WebRTC continues independently');
      }
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      reconnectAttempts.current = attemptNumber;
      console.log(`🔄 Reconnection attempt ${attemptNumber}/10`);
    });

    newSocket.on('reconnect', async (attemptNumber) => {
      console.log(`✅ Socket reconnected after ${attemptNumber} attempts`);
      setConnectionError(null);

      // After reconnect, restore state
      const userId = isExpert ? (expert?._id || expert?.id) : (user?._id || user?.id);
      const userType = isExpert ? 'expert' : 'user';

      if (userId) {
        console.log(`📝 Re-registering as ${userType}:`, userId);
        newSocket.emit('register', { userId, userType });
      }

      // If there's an active call, restore the call state
      if (activeCall) {
        console.log('🔄 Active call exists after reconnect:', activeCall.callId);
        console.log('🔄 WebRTC peer connection should still be active');
        // Socket server will handle re-joining call room via registration
        // WebRTC peer connection is independent and continues working
      }
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Failed to reconnect after 10 attempts');
      setConnectionError('Failed to connect to server. Please refresh page.');
    });

    newSocket.on('connect_error', (err) => {
      console.error('❌ Socket connection error:', err.message);
      setConnectionError(`Connection error: ${err.message}`);
    });

    newSocket.on('registered', async (data) => {
      console.log('✅ Registration confirmed:', data);

      // Check for active calls and restore them
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await axios.get('/api/calls/active', {
            headers: { 'x-auth-token': token }
          });

          if (response.data.success && response.data.call) {
            const activeCallData = response.data.call;
            console.log('🔄 Restoring active call:', activeCallData);

            setActiveCall({
              callId: activeCallData.id,
              userId: activeCallData.callerId,
              expertId: activeCallData.expertId,
              status: activeCallData.status,
              startTime: activeCallData.startTime ? new Date(activeCallData.startTime) : null
            });
          }
        }
      } catch (error) {
        console.error('Failed to restore active call:', error);
      }
    });

    // Expert status changes
    newSocket.on('expert_status_changed', ({ expertId, isOnline }) => {
      setOnlineExperts(prev => {
        const newSet = new Set(prev);
        if (isOnline) {
          newSet.add(expertId);
        } else {
          newSet.delete(expertId);
        }
        return newSet;
      });

      // Update expert statuses map
      setExpertStatuses(prev => {
        const newMap = new Map(prev);
        const currentStatus = newMap.get(expertId) || { isOnline: false, isBusy: false, lastUpdated: Date.now() };
        newMap.set(expertId, { ...currentStatus, isOnline, lastUpdated: Date.now() });
        return newMap;
      });
    });

    // Expert busy status changes
    newSocket.on('expert_busy_changed', ({ expertId, isBusy, callId }) => {
      setBusyExperts(prev => {
        const newSet = new Set(prev);
        if (isBusy) {
          newSet.add(expertId);
        } else {
          newSet.delete(expertId);
        }
        return newSet;
      });

      // Update expert statuses map
      setExpertStatuses(prev => {
        const newMap = new Map(prev);
        const currentStatus = newMap.get(expertId) || { isOnline: false, isBusy: false, lastUpdated: Date.now() };
        newMap.set(expertId, { ...currentStatus, isBusy, currentCallId: callId, lastUpdated: Date.now() });
        return newMap;
      });
    });

    // Incoming call (for experts)
    newSocket.on('incoming_call', (data) => {
      console.log('📞📞📞 INCOMING CALL RECEIVED:', JSON.stringify(data, null, 2));
      console.log('📞 Setting incoming call state...');
      
      // Store caller info for immediate display
      const incomingCallData = {
        callId: data.callId,
        userId: data.userId,
        expertId: data.expertId,
        callerInfo: data.caller
      };
      
      console.log('📞 Incoming call data prepared:', incomingCallData);
      setIncomingCall(incomingCallData);
      playIncomingCallSound();
      
      console.log('✅ Incoming call state set and ringtone started');
    });

    // Call accepted (for users) - transition from ringing to accepted
    newSocket.on('call_accepted', (data) => {
      console.log('✅ Call accepted:', data);
      // Create activeCall if it doesn't exist (user's ringing is in CallModal local state)
      setActiveCall(prev => prev ? { ...prev, status: 'accepted' } : {
        callId: data.callId,
        userId: data.userId,
        expertId: data.expertId,
        status: 'accepted',
        startTime: null,
        callerInfo: data.callerInfo
      });
      stopIncomingCallSound();
    });

    // Call rejected (for users)
    newSocket.on('call_rejected', (data) => {
      console.log('❌ Call rejected:', data);
      setActiveCall(null);
      setIncomingCall(null);
      stopIncomingCallSound();
    });

    // Call timeout
    newSocket.on('call_timeout', (data) => {
      console.log('⏱️ Call timeout:', data);
      setActiveCall(null);
      setIncomingCall(null);
      stopIncomingCallSound();
    });

    // Call connected
    newSocket.on('call_connected', (data) => {
      console.log('📞 Call connected event received:', data);
      console.log('🔍 Updating activeCall state to connected');
      setActiveCall(prev => {
        if (!prev) {
          console.warn('⚠️ No active call found to update');
          return null;
        }
        const updated = { ...prev, status: 'connected', startTime: Date.now() };
        console.log('✅ Active call updated:', { callId: updated.callId, status: updated.status });
        return updated;
      });
      stopIncomingCallSound();
    });

    // Call ended
    newSocket.on('call_ended', (data) => {
      console.log('📞 Call ended:', data);
      setActiveCall(null);
      setIncomingCall(null);
      stopIncomingCallSound();
    });

    // WebRTC Signaling Events
    newSocket.on('webrtc_offer', (data) => {
      console.log('📡 Received WebRTC offer from server:', { 
        callId: data.callId, 
        offerType: data.offer?.type,
        offerLength: data.offer?.sdp?.length 
      });
      if (window.webrtcOfferHandler) {
        window.webrtcOfferHandler(data);
      } else {
        console.error('❌ No webrtcOfferHandler registered!');
      }
    });

    newSocket.on('webrtc_answer', (data) => {
      console.log('📡 Received WebRTC answer from server:', { 
        callId: data.callId, 
        answerType: data.answer?.type,
        answerLength: data.answer?.sdp?.length 
      });
      if (window.webrtcAnswerHandler) {
        window.webrtcAnswerHandler(data);
      } else {
        console.error('❌ No webrtcAnswerHandler registered!');
      }
    });

    newSocket.on('webrtc_ice', (data) => {
      console.log('🧊 Received ICE candidate from server:', { 
        callId: data.callId, 
        candidateType: data.candidate?.type 
      });
      if (window.webrtcIceHandler) {
        window.webrtcIceHandler(data);
      } else {
        console.error('❌ No webrtcIceHandler registered!');
      }
    });

    // Chat events
    newSocket.on('receive_message', (data) => {
      console.log('💬 New message received:', data);

      // Normalize to the shape Chat.js expects
      const normalized = {
        chatId: data.chatId,
        message: {
          _id: data.tempId || `${Date.now()}`,
          sender: data.senderId,
          content: data.content,
          createdAt: data.timestamp,
          read: false
        },
        raw: data
      };

      setNewMessage(normalized);

      if (data.chatId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [data.chatId]: (prev[data.chatId] || 0) + 1
        }));
      }
    });

    newSocket.on('typing_status', (data) => {
      // Broadcast this via a custom event specific to the sender
      // Or update a simplified state if only 1-on-1 chat is focused
      const event = new CustomEvent('chat_typing', { detail: data });
      window.dispatchEvent(event);
    });

    newSocket.on('messages_read', (data) => {
      console.log('✅ Messages read:', data);
      const event = new CustomEvent('chat_read', { detail: data });
      window.dispatchEvent(event);
    });

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
      stopIncomingCallSound();
    };
  }, [isAuthenticated, isExpert, user, expert]);

  const playIncomingCallSound = useCallback(() => {
    if (!incomingCallAudioRef.current) {
      incomingCallAudioRef.current = new Audio(ringtoneAudio);
      incomingCallAudioRef.current.loop = true;
    }
    incomingCallAudioRef.current.play().catch(error => {
      console.error('Error playing ringtone:', error);
    });
  }, []);

  const stopIncomingCallSound = useCallback(() => {
    if (incomingCallAudioRef.current) {
      incomingCallAudioRef.current.pause();
      incomingCallAudioRef.current.currentTime = 0;
    }
  }, []);

  // Initiate call (caller side)
  const initiateCall = useCallback((data) => {
    if (!socket || !isConnected) {
      return Promise.resolve({ success: false, error: 'Socket not connected' });
    }

    const callerId = isExpert ? (expert?._id || expert?.id) : (user?._id || user?.id);
    const payload = {
      ...data,
      // Ensure userId always exists for socket-server
      ...(callerId ? { userId: data.userId || callerId } : {})
    };

    console.log('socket emit call:initiate', payload);

    // Set activeCall immediately to show the modal in "Ringing" state
    setActiveCall({
      callId: data.callId,
      userId: data.userId,
      expertId: data.expertId,
      status: 'ringing',
      startTime: null,
      callerInfo: data.callerInfo || { name: 'Calling...', avatar: null }
    });

    return new Promise((resolve) => {
      socket.emit('call:initiate', payload, (response) => {
        resolve(response || { success: true });
      });
    });
  }, [socket, isConnected, isExpert, user, expert]);

  // Expert accepts call (expert side)
  const acceptCall = useCallback(async (data) => {
    if (!socket || !isConnected) return;

    const { callId, userId, expertId, callerInfo } = data || {};
    if (!callId) return;

    // Update backend first (source of truth)
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await axios.put(`/api/calls/accept/${callId}`, {}, { headers: { 'x-auth-token': token } });
      }
    } catch (e) {
      console.error('Failed to accept call in backend:', e);
    }

    // Emit accept to socket server (will notify user)
    socket.emit('accept_call', { callId });

    // Clear incoming, set active as accepted (not connected yet - wait for WebRTC)
    setIncomingCall(null);
    setActiveCall({
      callId,
      userId,
      expertId,
      status: 'accepted',
      startTime: null,
      callerInfo
    });

    stopIncomingCallSound();
  }, [socket, isConnected, stopIncomingCallSound]);

  const rejectCall = useCallback(async (data) => {
    if (!socket || !isConnected) return;

    const { callId, reason } = data || {};
    if (!callId) return;

    try {
      const token = localStorage.getItem('token');
      if (token) {
        await axios.put(`/api/calls/reject/${callId}`, { reason }, { headers: { 'x-auth-token': token } });
      }
    } catch (e) {
      console.error('Failed to reject call in backend:', e);
    }

    socket.emit('reject_call', { callId, reason });
    setIncomingCall(null);
    setActiveCall(null);
    stopIncomingCallSound();
  }, [socket, isConnected, stopIncomingCallSound]);

  const markCallConnected = useCallback((data) => {
    if (!socket) return;
    const payload = typeof data === 'string' ? { callId: data } : data;
    if (!payload?.callId) return;
    socket.emit('call_connected', payload);
  }, [socket]);

  const endCall = useCallback(async (data) => {
    const payload = typeof data === 'string' ? { callId: data } : data;
    if (!payload?.callId) {
      console.warn('⚠️ endCall called without callId');
      return;
    }

    console.log('🔚 Ending call:', payload.callId);

    // CRITICAL: Emit end_call via socket to broadcast to BOTH sides
    if (socket && socket.connected) {
      console.log('📡 Broadcasting call_ended to server');
      socket.emit('end_call', payload);
    } else {
      console.warn('⚠️ Socket not connected - clearing local state only');
    }

    // Also update backend to finalize call
    try {
      const token = localStorage.getItem('token');
      if (token && payload.callId) {
        await axios.put(
          `/api/calls/end/${payload.callId}`,
          { initiatedBy: payload.initiatedBy || 'unknown' },
          { headers: { 'x-auth-token': token } }
        );
        console.log('✅ Backend call end confirmed');
      }
    } catch (error) {
      console.error('❌ Backend end call error:', error);
    }

    // Always clear local state immediately
    console.log('🧹 Clearing activeCall and incomingCall state');
    setActiveCall(null);
    setIncomingCall(null);
    stopIncomingCallSound();
  }, [socket, stopIncomingCallSound]);

  const sendOffer = useCallback((data) => {
    if (socket && socket.connected) {
      console.log('📤 Emitting webrtc_offer to server:', { callId: data.callId, offerLength: data.offer.sdp.length });
      socket.emit('webrtc_offer', data);
      console.log('✅ webrtc_offer emitted successfully');
    } else {
      console.error('❌ Cannot send offer - socket not connected:', { 
        socketExists: !!socket, 
        isConnected: socket?.connected 
      });
    }
  }, [socket]);

  const sendAnswer = useCallback((data) => {
    if (socket && socket.connected) {
      console.log('📤 Emitting webrtc_answer to server:', { callId: data.callId, answerLength: data.answer.sdp.length });
      socket.emit('webrtc_answer', data);
      console.log('✅ webrtc_answer emitted successfully');
    } else {
      console.error('❌ Cannot send answer - socket not connected:', { 
        socketExists: !!socket, 
        isConnected: socket?.connected 
      });
    }
  }, [socket]);

  const sendIceCandidate = useCallback((data) => {
    if (socket && socket.connected) {
      console.log('🧊 Emitting webrtc_ice to server:', { 
        callId: data.callId, 
        candidateType: data.candidate.type 
      });
      socket.emit('webrtc_ice', data);
      // Don't log success for every ICE candidate - too noisy
    } else {
      console.error('❌ Cannot send ICE candidate - socket not connected:', { 
        socketExists: !!socket, 
        isConnected: socket?.connected 
      });
    }
  }, [socket]);

  // Chat functions
  const sendMessage = useCallback((receiverId, content, type = 'text', meta = {}) => {
    if (!socket || !isConnected) {
      return Promise.reject(new Error('Socket not connected'));
    }

    // Generate temp ID for optimistic UI
    const tempId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    return new Promise((resolve, reject) => {
      socket.emit('send_message', {
        receiverId,
        content,
        type,
        tempId,
        ...(meta?.chatId ? { chatId: meta.chatId } : {})
      }, (response) => {
        if (response.success) {
          resolve({ ...response, tempId });
        } else {
          reject(new Error(response.error || 'Failed to send message'));
        }
      });
    });
  }, [socket, isConnected]);

  // Compatibility helpers for Chat.js (conversation-based UI)
  const joinChatRoom = useCallback(() => {
    // No room concept on server for chats right now
  }, []);

  const leaveChatRoom = useCallback(() => {
    // No room concept on server for chats right now
  }, []);

  const sendChatMessage = useCallback((chatId, receiverId, message) => {
    if (!receiverId || !message?.content) return;
    return sendMessage(receiverId, message.content, 'text', { chatId });
  }, [sendMessage]);

  const clearUnreadCount = useCallback((chatId) => {
    if (!chatId) return;
    setUnreadCounts((prev) => ({ ...prev, [chatId]: 0 }));
  }, []);

  const sendTyping = useCallback((receiverId, isTyping) => {
    if (socket && isConnected) {
      socket.emit('typing', { receiverId, isTyping });
    }
  }, [socket, isConnected]);

  const markMessagesRead = useCallback((senderId, messageIds) => {
    if (socket && isConnected) {
      socket.emit('message_read', { senderId, messageIds });
    }
  }, [socket, isConnected]);

  const isExpertBusy = useCallback((expertId) => {
    return busyExperts.has(expertId);
  }, [busyExperts]);

  const isExpertOnline = useCallback((expertId) => {
    return onlineExperts.has(expertId);
  }, [onlineExperts]);

  const getExpertStatusDetail = useCallback((expertId) => {
    return expertStatuses.get(expertId) || { isOnline: false, isBusy: false, lastUpdated: 0 };
  }, [expertStatuses]);

  // Get expert status (Online/Offline/Busy) with color
  const getExpertStatus = useCallback((expertId) => {
    const statusDetail = expertStatuses.get(expertId);
    
    // Priority: Busy > Online > Offline
    if (statusDetail?.isBusy) {
      return { 
        text: 'Busy', 
        color: '#fd7e14', // Orange
        status: 'busy',
        canCall: false,
        canChat: true
      };
    }
    
    if (statusDetail?.isOnline) {
      return { 
        text: 'Online', 
        color: '#28a745', // Green
        status: 'online',
        canCall: true,
        canChat: true
      };
    }
    
    return { 
      text: 'Offline', 
      color: '#6c757d', // Gray
      status: 'offline',
      canCall: false,
      canChat: false
    };
  }, [expertStatuses, onlineExperts, busyExperts]);

  // Check if expert can receive calls (online and not busy)
  const canExpertReceiveCall = useCallback((expertId) => {
    const statusDetail = expertStatuses.get(expertId);
    return statusDetail?.isOnline && !statusDetail?.isBusy;
  }, [expertStatuses]);

  const refreshBusyExperts = useCallback(() => {
    // This could optionally emit a request to server to get latest busy list
    // or rely on auto-sync events
  }, []);

  const value = {
    socket,
    isConnected,
    connectionError,
    onlineExperts,
    busyExperts,
    expertStatuses,
    incomingCall,
    activeCall,
    newMessage,
    unreadCounts,
    isExpertOnline,
    isExpertBusy,
    getExpertStatus,
    getExpertStatusDetail,
    canExpertReceiveCall,
    refreshBusyExperts,
    initializeExpertStatus,
    initiateCall,
    acceptCall,
    rejectCall,
    markCallConnected,
    endCall,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    sendMessage,
    sendChatMessage,
    joinChatRoom,
    leaveChatRoom,
    sendTyping,
    markMessagesRead,
    clearUnreadCount
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
