import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import ringtoneAudio from '../assets/soft_ringtone.mp3';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from './AuthContext';

// PRODUCTION Socket URL - MUST be set in Vercel env vars
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'https://consultoncall-socket-server.onrender.com';

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
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      autoConnect: true,
      forceNew: true,
      // Do not force credentials for Socket.IO (breaks on strict CORS setups on some mobile browsers)
      withCredentials: false
    });

    socketRef.current = newSocket;

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

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setIsConnected(false);

      if (reason === 'io server disconnect') {
        console.log('🔄 Server disconnected socket, reconnecting...');
        newSocket.connect();
      }
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      reconnectAttempts.current = attemptNumber;
      console.log(`🔄 Reconnection attempt ${attemptNumber}/10`);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      setConnectionError(null);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Failed to reconnect after 10 attempts');
      setConnectionError('Failed to connect to server. Please refresh the page.');
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
    });

    // Expert busy status changes
    newSocket.on('expert_busy_changed', ({ expertId, isBusy }) => {
      setBusyExperts(prev => {
        const newSet = new Set(prev);
        if (isBusy) {
          newSet.add(expertId);
        } else {
          newSet.delete(expertId);
        }
        return newSet;
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
        callerInfo: data.caller // Include caller info from socket payload
      };
      
      console.log('📞 Incoming call data prepared:', incomingCallData);
      setIncomingCall(incomingCallData);
      playIncomingCallSound();
      
      console.log('✅ Incoming call state set and ringtone started');
    });

    // Call accepted (for users)
    newSocket.on('call_accepted', (data) => {
      console.log('✅ Call accepted:', data);
      setActiveCall(prev => prev ? { ...prev, status: 'accepted' } : null);
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
      console.log('📞 Call connected:', data);
      setActiveCall(prev => prev ? { ...prev, status: 'connected', startTime: Date.now() } : null);
      stopIncomingCallSound();
    });

    // Call ended
    newSocket.on('call_ended', (data) => {
      console.log('📞 Call ended:', data);
      setActiveCall(null);
      setIncomingCall(null);
      stopIncomingCallSound();
    });

    // Chat events
    newSocket.on('receive_message', (data) => {
      console.log('💬 New message received:', data);
      setNewMessage(data); // Triggers UI update
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

  // Initiate call
  const initiateCall = useCallback((data) => {
    if (socket && isConnected) {
      console.log('socket emit call:initiate', data);
      socket.emit('call:initiate', data);
    }
  }, [socket, isConnected]);

  const acceptCall = useCallback((data) => {
    if (socket && isConnected) {
      console.log('socket emit accept_call', data);
      socket.emit('accept_call', data);
    }
  }, [socket, isConnected]);

  const rejectCall = useCallback((data) => {
    if (socket && isConnected) {
      console.log('socket emit reject_call', data);
      socket.emit('reject_call', data);
    }
  }, [socket, isConnected]);

  const markCallConnected = useCallback((data) => {
    if (socket && isConnected) {
      console.log('socket emit call_connected', data);
      socket.emit('call_connected', data);
    }
  }, [socket, isConnected]);

  const endCall = useCallback((data) => {
    if (socket && isConnected) {
      console.log('socket emit end_call', data);
      socket.emit('end_call', data);
      setActiveCall(null);
      setIncomingCall(null);
      stopIncomingCallSound();
    }
  }, [socket, isConnected]);

  const sendOffer = useCallback((data) => {
    if (socket && isConnected) {
      socket.emit('offer', data);
    }
  }, [socket, isConnected]);

  const sendAnswer = useCallback((data) => {
    if (socket && isConnected) {
      socket.emit('answer', data);
    }
  }, [socket, isConnected]);

  const sendIceCandidate = useCallback((data) => {
    if (socket && isConnected) {
      socket.emit('ice_candidate', data);
    }
  }, [socket, isConnected]);


  // Chat functions
  const sendMessage = useCallback((receiverId, content, type = 'text') => {
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
        tempId
      }, (response) => {
        if (response.success) {
          resolve({ ...response, tempId });
        } else {
          reject(new Error(response.error || 'Failed to send message'));
        }
      });
    });
  }, [socket, isConnected]);

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
    incomingCall,
    activeCall,
    newMessage,
    unreadCounts,
    isExpertOnline,
    isExpertBusy,
    refreshBusyExperts,
    initiateCall,
    acceptCall,
    rejectCall,
    markCallConnected,
    endCall,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    sendMessage,
    sendTyping,
    markMessagesRead
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
