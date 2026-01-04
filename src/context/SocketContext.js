import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
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
  const { user, expert, isAuthenticated, isExpert } = useAuth();

  const socketRef = useRef(null);
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
      transports: ['websocket'], // Force WebSocket only
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 45000,
      autoConnect: true,
      forceNew: true,
      withCredentials: false,
      path: '/socket.io/'
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
      setIsConnected(false);

      if (reason === 'io server disconnect') {
        console.log('🔄 Server disconnected socket - will auto-reconnect');
      } else {
        console.log('🔄 Client-side disconnect - will auto-reconnect');
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
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Failed to reconnect after 10 attempts');
      setConnectionError('Failed to connect to server. Please refresh page.');
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

    // Incoming call (for experts) - Only for notification, actual call handled by Agora
    newSocket.on('incoming_call', (data) => {
      console.log('📞 INCOMING CALL NOTIFICATION:', JSON.stringify(data, null, 2));
      
      const incomingCallData = {
        callId: data.callId,
        userId: data.userId,
        expertId: data.expertId,
        callerInfo: data.caller
      };
      
      setIncomingCall(incomingCallData);
    });

    // Call accepted (for users)
    newSocket.on('call_accepted', (data) => {
      console.log('✅ Call accepted:', data);
      setActiveCall(prev => prev ? { ...prev, status: 'accepted' } : {
        callId: data.callId,
        userId: data.userId,
        expertId: data.expertId,
        status: 'accepted',
        startTime: null,
        callerInfo: data.callerInfo
      });
    });

    // Call rejected (for users)
    newSocket.on('call_rejected', (data) => {
      console.log('❌ Call rejected:', data);
      setActiveCall(null);
      setIncomingCall(null);
    });

    // Call timeout
    newSocket.on('call_timeout', (data) => {
      console.log('⏱️ Call timeout:', data);
      setActiveCall(null);
      setIncomingCall(null);
    });

    // Call connected
    newSocket.on('call_connected', (data) => {
      console.log('📞 Call connected event received:', data);
      setActiveCall(prev => {
        if (!prev) {
          console.warn('⚠️ No active call found to update');
          return null;
        }
        const updated = { ...prev, status: 'connected', startTime: Date.now() };
        console.log('✅ Active call updated:', { callId: updated.callId, status: updated.status });
        return updated;
      });
    });

    // Call ended
    newSocket.on('call_ended', (data) => {
      console.log('📞 Call ended:', data);
      setActiveCall(null);
      setIncomingCall(null);
    });

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [isAuthenticated, isExpert, user, expert]);

  // Initiate call (caller side) - Just notification, actual call via Agora
  const initiateCall = useCallback((data) => {
    if (!socket || !isConnected) {
      return Promise.resolve({ success: false, error: 'Socket not connected' });
    }

    const callerId = isExpert ? (expert?._id || expert?.id) : (user?._id || user?.id);
    const payload = {
      ...data,
      ...(callerId ? { userId: data.userId || callerId } : {})
    };

    console.log('📞 Emitting call:initiate for notification');

    // Set activeCall immediately to show modal in "Ringing" state
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

    // Clear incoming, set active as accepted (not connected yet - wait for Agora)
    setIncomingCall(null);
    setActiveCall({
      callId,
      userId,
      expertId,
      status: 'accepted',
      startTime: null,
      callerInfo
    });
  }, [socket, isConnected]);

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
  }, [socket, isConnected]);

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

    // Emit end_call via socket to broadcast to BOTH sides
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
  }, [socket]);

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
    endCall
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
