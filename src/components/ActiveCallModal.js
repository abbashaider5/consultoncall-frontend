import { faMicrophone, faMicrophoneSlash, faPhoneSlash, faVolumeUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './ActiveCallModal.css';

const ActiveCallModal = () => {
  const { user, expert, updateTokens } = useAuth();
  const {
    activeCall,
    endCall,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    markCallConnected,
    socket
  } = useSocket();

  const [callStatus, setCallStatus] = useState('connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [remoteUser, setRemoteUser] = useState(null);
  const [isVisible, setIsVisible] = useState(true);
  const [forceClose, setForceClose] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const connectionTimeoutRef = useRef(null);

  // Theme color constant
  const THEME_COLOR = '#936AAC';

  // Reset all state and refs
  const resetAll = useCallback(() => {
    setCallStatus('connecting');
    setDuration(0);
    setIsMuted(false);
    setIsSpeakerOn(false);
    setRemoteUser(null);
    setIsVisible(false);
    setForceClose(false);
    setIsAudioPlaying(false);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localStreamRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clean up audio elements
    const localAudio = document.getElementById('localAudio');
    const remoteAudio = document.getElementById('remoteAudio');
    if (localAudio) {
      localAudio.remove();
    }
    if (remoteAudio) {
      remoteAudio.remove();
    }
  }, []);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const timerRef = useRef(null);
  const hasStartedCallRef = useRef(false);
  const billingStartedRef = useRef(false);

  // Listen for call ended event directly
  useEffect(() => {
    if (!activeCall) {
      resetAll();
      return;
    }

    setIsVisible(true);
    setForceClose(false);
    
    const handleCallEnded = (data) => {
      console.log('🔚 Call ended event received in ActiveCallModal:', data);
      resetAll();
      
      // Show appropriate message based on reason
      if (data.reason) {
        if (data.reason === 'socket_disconnect') {
          toast.info('Connection lost. Call ended safely.');
        } else if (data.reason === 'balance_exhausted') {
          toast.info('Balance exhausted. Call ended.');
        } else {
          toast.info(data.reason);
        }
      }
    };

    // Listen for call_ended event
    socket?.on('call_ended', handleCallEnded);

    return () => {
      socket?.off('call_ended', handleCallEnded);
    };
  }, [activeCall, socket, resetAll]);

  // Fetch remote user info
  useEffect(() => {
    const fetchRemoteUser = async () => {
      if (!activeCall || !user?.role) return;

      console.log('🔍 Fetching remote user info:', {
        userRole: user?.role,
        activeCall,
        hasCallerInfo: !!activeCall.callerInfo
      });

      // Use caller info from activeCall if available (from socket payload)
      if (activeCall.callerInfo && activeCall.callerInfo.name) {
        console.log('✅ Using caller info from activeCall:', activeCall.callerInfo);
        setRemoteUser({
          name: activeCall.callerInfo.name,
          avatar: activeCall.callerInfo.avatar
        });
        return;
      }

      // Fallback to API call
      try {
        const remoteUserId = user?.role === 'expert' ? activeCall.userId : activeCall.expertId;
        
        console.log('🔍 Remote user ID:', remoteUserId);
        
        if (!remoteUserId) {
          console.error('❌ No remote user ID available');
          setRemoteUser({
            name: user?.role === 'expert' ? 'Caller' : 'Expert',
            avatar: null
          });
          return;
        }
        
        const endpoint = user?.role === 'expert' ? `/api/users/${remoteUserId}` : `/api/experts/${remoteUserId}`;
        console.log('📡 Fetching from endpoint:', endpoint);
        
        const res = await axios.get(endpoint);
        console.log('✅ API response:', res.data);
        
        // Handle different response formats
        let userData;
        if (user?.role === 'expert') {
          // For experts fetching user info, response is direct user object
          userData = res.data;
        } else {
          // For users fetching expert info, response has expert.user nested
          userData = res.data.user || res.data;
        }
        
        console.log('✅ Setting remote user:', userData);
        setRemoteUser({
          name: userData.name,
          avatar: userData.avatar
        });
      } catch (error) {
        console.error('❌ Fetch remote user error:', error.response || error);
        // Set fallback data
        setRemoteUser({
          name: user?.role === 'expert' ? (activeCall.callerName || 'Caller') : (activeCall.expertName || 'Expert'),
          avatar: null
        });
      }
    };

    fetchRemoteUser();
  }, [activeCall, user?.role]);

  const handleEndCall = useCallback(async () => {
    console.log('📞 Ending call...');
    setIsVisible(false);
    setForceClose(true);
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      if (activeCall) {
        // End call via socket
        try {
          await endCall(activeCall.callId);
        } catch (socketError) {
          console.error('Socket end call error:', socketError);
        }

        // End call via backend to finalize billing
        if (callStatus === 'connected') {
          const token = localStorage.getItem('token');
          try {
            const res = await axios.put(
              `/api/calls/end/${activeCall.callId}`,
              { initiatedBy: user?.role },
              { headers: { 'x-auth-token': token } }
            );
            
            if (res.data.success) {
              console.log('✅ Call ended successfully:', res.data);
              
              // Update user tokens
              if (user?.role === 'user') {
                updateTokens(res.data.newBalance);
                toast.success(
                  `Call ended. Duration: ${res.data.call.minutes} min, Cost: ₹${res.data.call.tokensSpent}`,
                  { position: 'top-center', autoClose: 5000 }
                );
              } else {
                toast.success(`Call ended. Duration: ${res.data.call.minutes} min`, {
                  position: 'top-center',
                  autoClose: 5000
                });
              }
            } else {
              toast.error('Failed to end call properly');
            }
          } catch (apiError) {
            console.error('❌ API end call error:', apiError);
            toast.error('Failed to finalize call. Please check your balance.');
          }
        } else {
          // Call never connected, no charge
          toast.info('Call ended. No charge as call did not connect.');
        }
      }
    } catch (error) {
      console.error('❌ End call error:', error);
      toast.error('Error ending call. Please refresh if issues persist.');
    } finally {
      resetAll();
    }
  }, [user, activeCall, duration, callStatus, endCall, updateTokens, resetAll]);

  const setupPeerConnection = useCallback(async () => {
    if (!activeCall || peerConnectionRef.current) {
      console.warn('⚠️ Skipping WebRTC setup - activeCall:', !!activeCall, 'pc exists:', !!peerConnectionRef.current);
      return;
    }

    console.log('🔧 Setting up WebRTC connection for active call...');
    console.log('🔍 Active call:', JSON.stringify(activeCall, null, 2));
    console.log('🔍 User role:', user?.role);

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(config);
    peerConnectionRef.current = pc;
    
    console.log('✅ RTCPeerConnection created with config:', JSON.stringify(config, null, 2));

    // Add local stream
    try {
      console.log('🎤 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        }
      });
      console.log('✅ Microphone access granted. Stream:', stream.id);
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => {
        console.log('📤 Adding track to peer connection:', track.kind, track.id);
        pc.addTrack(track, stream);
      });
      
      // Attach local stream to a hidden audio element for local test
      let localAudio = document.getElementById('localAudio');
      if (!localAudio) {
        localAudio = document.createElement('audio');
        localAudio.id = 'localAudio';
        localAudio.style.display = 'none';
        localAudio.muted = true;
        document.body.appendChild(localAudio);
      }
      localAudio.srcObject = stream;
      try {
        await localAudio.play();
        console.log('✅ Local audio initialized');
      } catch (err) {
        console.warn('Local audio play failed:', err);
      }
    } catch (mediaError) {
      toast.error('Microphone access denied. Please allow microphone permissions.');
      console.error('❌ Microphone access error:', mediaError);
      setCallStatus('failed');
      return;
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('📡 Received remote track', event.streams[0]);
      remoteStreamRef.current = event.streams[0];
      
      // Create or get remote audio element
      let audio = document.getElementById('remoteAudio');
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = 'remoteAudio';
        audio.autoPlay = true;
        audio.playsInline = true;
        audio.style.display = 'none';
        document.body.appendChild(audio);
      }
      
      audio.srcObject = event.streams[0];
      setIsAudioPlaying(true);
      
      // Explicitly play with better error handling
      const playAudio = async () => {
        try {
          await audio.play();
          console.log('✅ Remote audio playing successfully');
          setIsAudioPlaying(true);
        } catch (err) {
          console.warn('Remote audio play failed, retrying...', err);
          // Try again after a short delay
          setTimeout(() => {
            audio.play().catch(e => console.warn('Still failed to play audio:', e));
          }, 100);
        }
      };
      playAudio();
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate generated:', {
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
          port: event.candidate.port
        });
        sendIceCandidate({ callId: activeCall.callId, candidate: event.candidate });
      } else {
        console.log('🧊 ICE gathering complete');
      }
    };
    
    // Log ICE gathering state changes
    pc.onicegatheringstatechange = () => {
      console.log('🧊 ICE gathering state changed:', pc.iceGatheringState);
    };

    // Handle ICE connection state - PRIMARY AUTHORITY for call state
    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log('✅ ICE connection established - WebRTC peer connection successful');
        console.log('🎯 CRITICAL: Setting call status to CONNECTED based on ICE state');
        
        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        
        setCallStatus('connected');
        
        // Mark as connected in backend (starts billing) - only once
        if (!billingStartedRef.current) {
          markCallConnected(activeCall.callId).catch(err => {
            console.error('Mark connected error:', err);
            toast.error('Failed to establish connection');
          });
          billingStartedRef.current = true;
        }
      } else if (pc.iceConnectionState === 'failed') {
        console.error('❌ ICE connection failed - ending call');
        toast.error('Connection failed. Please try again.');
        handleEndCall();
      } else if (pc.iceConnectionState === 'disconnected') {
        console.warn('⚠️ ICE disconnected - waiting for recovery...');
        // Wait 3 seconds for recovery
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            console.error('❌ ICE did not recover - ending call');
            toast.error('Connection lost');
            handleEndCall();
          }
        }, 3000);
      } else if (pc.iceConnectionState === 'closed') {
        console.warn('⚠️ ICE connection closed - ending call');
        handleEndCall();
      }
    };

    // Handle connection state - SECONDARY AUTHORITY with fallback
    pc.onconnectionstatechange = () => {
      console.log('🔗 WebRTC connection state:', pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        console.log('✅ WebRTC connection established');
        // ICE state already handles status change, this is for logging
      } else if (pc.connectionState === 'failed') {
        console.error('❌ WebRTC connection failed - ending call');
        toast.error('Connection failed. Please try again.');
        handleEndCall();
      } else if (pc.connectionState === 'disconnected') {
        console.warn('⚠️ WebRTC disconnected - waiting for recovery...');
        // Wait 5 seconds for recovery, then end if still disconnected
        setTimeout(() => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
            console.warn('⚠️ WebRTC did not recover - ending call');
            handleEndCall();
          }
        }, 5000);
      } else if (pc.connectionState === 'closed') {
        console.warn('⚠️ WebRTC connection closed - ending call');
        handleEndCall();
      }
    };

    // Create and send offer (caller initiates)
    if (user?.role === 'user') {
      console.log('👤 User is caller - creating WebRTC offer...');
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        });
        console.log('📝 Offer created:', {
          type: offer.type,
          sdpLength: offer.sdp.length
        });
        await pc.setLocalDescription(offer);
        console.log('✅ Local description set (offer)');
        sendOffer({ callId: activeCall.callId, offer });
        console.log('📤 Sent WebRTC offer to server');
      } catch (error) {
        console.error('❌ Create offer error:', error);
        toast.error('Failed to setup call');
        setCallStatus('failed');
      }
    } else {
      console.log('👨‍⚕️ Expert is callee - waiting for WebRTC offer...');
    }
  }, [activeCall, user?.role, sendOffer, sendIceCandidate, markCallConnected, handleEndCall]);

  const handleWebRTCOffer = useCallback(async (data) => {
    if (!activeCall || data.callId !== activeCall.callId) {
      console.warn('⚠️ Ignoring WebRTC offer - call mismatch or no active call');
      return;
    }

    console.log('📥 Received WebRTC offer for call:', data.callId);
    console.log('📝 Offer details:', {
      type: data.offer.type,
      sdpLength: data.offer.sdp.length
    });
    
    try {
      if (!peerConnectionRef.current) {
        console.error('❌ Peer connection not established - cannot handle offer');
        return;
      }
      
      console.log('🔧 Setting remote description (offer)...');
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
      console.log('✅ Remote description set (offer)');
      
      console.log('📝 Creating answer...');
      const answer = await peerConnectionRef.current.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      console.log('📝 Answer created:', {
        type: answer.type,
        sdpLength: answer.sdp.length
      });
      
      console.log('🔧 Setting local description (answer)...');
      await peerConnectionRef.current.setLocalDescription(answer);
      console.log('✅ Local description set (answer)');
      
      sendAnswer({ callId: activeCall.callId, answer });
      console.log('📤 Sent WebRTC answer to server');
    } catch (error) {
      console.error('❌ Handle offer error:', error);
      toast.error('Failed to accept call');
    }
  }, [activeCall, sendAnswer]);

  const handleWebRTCAnswer = useCallback(async (data) => {
    if (!activeCall || data.callId !== activeCall.callId) {
      console.warn('⚠️ Ignoring WebRTC answer - call mismatch or no active call');
      return;
    }

    console.log('📥 Received WebRTC answer for call:', data.callId);
    console.log('📝 Answer details:', {
      type: data.answer.type,
      sdpLength: data.answer.sdp.length
    });
    
    try {
      if (!peerConnectionRef.current) {
        console.error('❌ Peer connection not established - cannot handle answer');
        return;
      }
      
      console.log('🔧 Setting remote description (answer)...');
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      console.log('✅ Remote description set (answer)');
      console.log('✅ WebRTC handshake complete - waiting for ICE connection...');
    } catch (error) {
      console.error('❌ Handle answer error:', error);
      toast.error('Connection setup failed');
    }
  }, [activeCall]);

  const handleWebRTCIce = useCallback(async (data) => {
    if (!activeCall || data.callId !== activeCall.callId) {
      console.warn('⚠️ Ignoring ICE candidate - call mismatch or no active call');
      return;
    }

    console.log('🧊 Received ICE candidate for call:', data.callId);
    if (data.candidate) {
      console.log('🧊 Candidate details:', {
        type: data.candidate.type,
        protocol: data.candidate.protocol,
        address: data.candidate.address
      });
    }
    
    try {
      if (peerConnectionRef.current && data.candidate) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log('✅ ICE candidate added successfully');
      }
    } catch (error) {
      console.error('❌ Handle ICE candidate error:', error);
      // Don't show toast for ICE errors - they're common and not critical
    }
  }, [activeCall]);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    
    const startTime = activeCall.startTime || Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setDuration(elapsed);
      
      // Check balance every second (for users only)
      if (user?.role === 'user' && activeCall?.tokensPerMinute) {
        const elapsedMinutes = elapsed / 60;
        const estimatedCost = Math.ceil(elapsedMinutes) * activeCall.tokensPerMinute;
        const remainingBalance = (user?.tokens || 0) - estimatedCost;
        
        // Warn at 1 minute remaining
        if (remainingBalance > 0 && remainingBalance <= activeCall.tokensPerMinute) {
          toast.warning(`Low balance! ~1 minute remaining`, {
            position: 'top-center',
            autoClose: 3000,
            toastId: 'low-balance-warning'
          });
        }
        
        // Auto-disconnect if balance exhausted
        if (remainingBalance <= 0) {
          console.warn('⚠️ Balance exhausted - ending call');
          toast.error('Balance exhausted. Call ending...', {
            position: 'top-center',
            autoClose: 2000
          });
          handleEndCall();
        }
      }
    }, 1000);
  }, [activeCall, user, handleEndCall]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
      toast.info(isMuted ? 'Microphone unmuted' : 'Microphone muted');
    }
  };

  const toggleSpeaker = async () => {
    try {
      // Try to enumerate audio output devices
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
        
        if (audioOutputs.length > 1) {
          // If multiple outputs available, try to switch
          const audio = document.getElementById('remoteAudio');
          if (audio && typeof audio.setSinkId === 'function') {
            // Toggle between first two outputs
            const currentSinkId = audio.sinkId || 'default';
            const nextOutput = audioOutputs.find(d => d.deviceId !== currentSinkId) || audioOutputs[0];
            await audio.setSinkId(nextOutput.deviceId);
            setIsSpeakerOn(!isSpeakerOn);
            toast.success(`Switched to ${nextOutput.label || 'audio output'}`);
            return;
          }
        }
      }
      
      // Fallback: just visual toggle with toast
      setIsSpeakerOn(!isSpeakerOn);
      toast.info(isSpeakerOn ? 'Switched to earpiece' : 'Switched to speaker');
    } catch (error) {
      console.warn('Speaker toggle failed:', error);
      setIsSpeakerOn(!isSpeakerOn);
      toast.info(isSpeakerOn ? 'Switched to earpiece' : 'Switched to speaker');
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusMessage = () => {
    switch (callStatus) {
      case 'ringing':
        return 'Ringing...';
      case 'connecting':
        return 'Setting up call...';
      case 'connected':
        return 'Connected';
      case 'failed':
        return 'Call Failed';
      default:
        return 'Connecting...';
    }
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case 'ringing':
        return '#fd7e14';
      case 'connecting':
        return '#ffc107';
      case 'connected':
        return '#28a745';
      case 'failed':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  // Setup WebRTC when call is accepted
  useEffect(() => {
    // Only setup WebRTC when call is accepted
    if (activeCall && activeCall.status === 'accepted' && !peerConnectionRef.current) {
      console.log('🚀 Initiating WebRTC setup for call:', activeCall.callId);
      console.log('🔍 Current user role:', user?.role);
      console.log('🔍 Active call details:', JSON.stringify(activeCall, null, 2));
      setCallStatus('connecting');
      
      // Add small delay to ensure socket signaling is ready
      setTimeout(() => {
        console.log('🚀 Starting WebRTC setup after delay...');
        setupPeerConnection();
      }, 100);
      
      // SAFETY: Set 30-second timeout for connection
      connectionTimeoutRef.current = setTimeout(() => {
        if (callStatus !== 'connected' && peerConnectionRef.current) {
          console.error('❌ Connection timeout - call did not connect in 30 seconds');
          console.error('📊 Final ICE state:', peerConnectionRef.current?.iceConnectionState);
          console.error('📊 Final connection state:', peerConnectionRef.current?.connectionState);
          console.error('📊 Final gathering state:', peerConnectionRef.current?.iceGatheringState);
          toast.error('Connection timeout. Please try again.');
          handleEndCall();
        }
      }, 30000);
    }
    
    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    };
  }, [activeCall, setupPeerConnection, callStatus, handleEndCall, user?.role]);

  // Handle WebRTC signaling events
  useEffect(() => {
    window.webrtcOfferHandler = handleWebRTCOffer;
    window.webrtcAnswerHandler = handleWebRTCAnswer;
    window.webrtcIceHandler = handleWebRTCIce;

    return () => {
      window.webrtcOfferHandler = null;
      window.webrtcAnswerHandler = null;
      window.webrtcIceHandler = null;
    };
  }, [activeCall, handleWebRTCOffer, handleWebRTCAnswer, handleWebRTCIce]);

  // Socket disconnect handler - DO NOT END CALL
  // Socket is only for signaling - WebRTC is independent
  useEffect(() => {
    if (!activeCall) return;

    const handleSocketDisconnect = (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      console.log('🔍 Call status:', callStatus);
      console.log('🔍 WebRTC ICE state:', peerConnectionRef.current?.iceConnectionState);
      console.log('🔍 WebRTC connection state:', peerConnectionRef.current?.connectionState);
      
      // CRITICAL: Do NOT automatically end call on socket disconnect
      // WebRTC peer connection is independent of socket transport
      // Socket will auto-reconnect and WebRTC will continue working
      // Only end call if WebRTC explicitly fails or user initiates end
      
      const webrtcState = peerConnectionRef.current?.iceConnectionState;
      const isWebRTCActive = webrtcState === 'connected' || webrtcState === 'completed';
      
      if (isWebRTCActive) {
        console.log('✅ WebRTC is active - call continues despite socket disconnect');
        toast.info('Reconnecting to server... Call will continue', {
          autoClose: 3000,
          toastId: 'socket-reconnect-info'
        });
      } else if (callStatus === 'connecting') {
        console.log('⚠️ Call still connecting - waiting for socket to reconnect');
        toast.warning('Connection unstable. Please wait...', {
          autoClose: 3000,
          toastId: 'socket-reconnect-warning'
        });
      }
    };

    socket?.on('disconnect', handleSocketDisconnect);

    return () => {
      socket?.off('disconnect', handleSocketDisconnect);
    };
  }, [activeCall, callStatus, socket]);

  // Only set initial status from socket - WebRTC will override
  useEffect(() => {
    if (!activeCall) return;

    // Only set initial status from socket - WebRTC will override
    if (activeCall.status === 'ringing' && callStatus !== 'ringing') {
      setCallStatus('ringing');
    } else if (activeCall.status === 'accepted' && callStatus !== 'connected') {
      // WebRTC will set to 'connected' - keep as 'connecting' until ICE connects
      setCallStatus('connecting');
    }

    // Start timer when call status changes to connected (from WebRTC)
    if (callStatus === 'connected' && !timerRef.current) {
      console.log('⏱️ Starting call timer - call is connected');
      startTimer();
    }
  }, [activeCall, callStatus, startTimer]);

  // Show loading state while fetching remote user
  if (!remoteUser) {
    return (
      <div className="active-call-overlay">
        <div className="active-call-modal">
          <div className="call-status-badge">
            <div className="status-dot" style={{ backgroundColor: getStatusColor() }}></div>
            <span className="status-text">Connecting...</span>
          </div>
          
          <div className="call-user-section">
            <div className="user-avatar-wrapper">
              <div className="user-avatar">?</div>
            </div>
            <h2 className="user-name">Loading...</h2>
          </div>

          <div className="call-connecting">
            <div className="connecting-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="active-call-overlay">
      <div className="active-call-modal" style={{ '--theme-color': THEME_COLOR }}>
        {/* Status Badge */}
        <div className="call-status-badge">
          <div className="status-dot" style={{ backgroundColor: getStatusColor() }}></div>
          <span className="status-text">{getStatusMessage()}</span>
        </div>

        {/* User Section */}
        <div className="call-user-section">
          <div className="user-avatar-wrapper">
            {remoteUser?.avatar ? (
              <img src={remoteUser.avatar} alt={remoteUser.name} className="user-avatar" />
            ) : (
              <div className="user-avatar initials">
                {remoteUser?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
              </div>
            )}
            {callStatus === 'connecting' && <div className="avatar-pulse"></div>}
            {isAudioPlaying && callStatus === 'connected' && (
              <div className="audio-indicator">
                <div className="audio-wave"></div>
                <div className="audio-wave"></div>
                <div className="audio-wave"></div>
              </div>
            )}
          </div>
          
          <h2 className="user-name">{remoteUser.name}</h2>
          <p className="user-title">
            {user?.role === 'expert' ? 'Customer Call' : 'Expert Consultation'}
          </p>
        </div>

        {/* Call Info - Rate and Duration */}
        <div className="call-info-section">
          {user?.role === 'user' && activeCall?.tokensPerMinute && (
            <div className="call-rate-badge">
              <span className="rate-label">Rate:</span>
              <span className="rate-value">₹{activeCall.tokensPerMinute}/min</span>
            </div>
          )}

          {callStatus === 'connected' && (
            <div className="call-duration">{formatDuration(duration)}</div>
          )}
        </div>

        {/* Connecting Animation */}
        {callStatus === 'connecting' && (
          <div className="call-connecting">
            <div className="connecting-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="call-controls-footer">
          <button
            className={`control-btn ${isMuted ? 'active-state' : ''}`}
            onClick={toggleMute}
            disabled={callStatus !== 'connected'}
            title={isMuted ? 'Unmute' : 'Mute'}
            style={{ opacity: callStatus === 'connected' ? 1 : 0.5 }}
          >
            <div className="icon-circle">
              <FontAwesomeIcon icon={isMuted ? faMicrophoneSlash : faMicrophone} />
            </div>
            <span className="btn-label">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            className="control-btn end-call-btn"
            onClick={handleEndCall}
            title="End Call"
          >
            <div className="icon-circle">
              <FontAwesomeIcon icon={faPhoneSlash} />
            </div>
            <span className="btn-label">End</span>
          </button>

          <button
            className={`control-btn ${isSpeakerOn ? 'active-state' : ''}`}
            onClick={toggleSpeaker}
            disabled={callStatus !== 'connected'}
            title="Toggle Speaker"
            style={{ opacity: callStatus === 'connected' ? 1 : 0.5 }}
          >
            <div className="icon-circle">
              <FontAwesomeIcon icon={faVolumeUp} />
            </div>
            <span className="btn-label">Speaker</span>
          </button>
        </div>

        {/* Hidden audio elements */}
        <audio id="remoteAudio" autoPlay playsInline style={{ display: 'none' }} />
        <audio id="localAudio" autoPlay muted playsInline style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default ActiveCallModal;
