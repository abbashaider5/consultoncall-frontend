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
      return;
    }

    console.log('🔧 Setting up WebRTC connection for active call...');

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(config);
    peerConnectionRef.current = pc;

    // Add local stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        }
      });
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => {
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
        sendIceCandidate({ callId: activeCall.callId, candidate: event.candidate });
      }
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log('✅ ICE connection established');
      } else if (pc.iceConnectionState === 'failed') {
        console.error('❌ ICE connection failed');
        toast.error('Connection failed. Please try again.');
        handleEndCall();
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      console.log('🔗 WebRTC connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        console.log('✅ WebRTC connection established - updating call status');
        setCallStatus('connected');
        // Mark as connected in backend (starts billing)
        if (!billingStartedRef.current) {
          markCallConnected(activeCall.callId).catch(err => {
            console.error('Mark connected error:', err);
            toast.error('Failed to establish connection');
          });
          billingStartedRef.current = true;
        }
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.error('❌ WebRTC connection failed/disconnected');
        if (pc.connectionState === 'failed') {
          toast.error('Connection failed. Please try again.');
          handleEndCall();
        }
      }
    };

    // Create and send offer (caller initiates)
    if (user?.role === 'user') {
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        });
        await pc.setLocalDescription(offer);
        sendOffer({ callId: activeCall.callId, offer });
        console.log('📤 Sent WebRTC offer');
      } catch (error) {
        console.error('❌ Create offer error:', error);
        toast.error('Failed to setup call');
        setCallStatus('failed');
      }
    }
  }, [activeCall, user?.role, sendOffer, sendIceCandidate, markCallConnected, handleEndCall]);

  const handleWebRTCOffer = useCallback(async (data) => {
    if (!activeCall || data.callId !== activeCall.callId) return;

    console.log('📥 Received WebRTC offer');
    try {
      if (!peerConnectionRef.current) {
        console.error('❌ Peer connection not established');
        return;
      }
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnectionRef.current.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      await peerConnectionRef.current.setLocalDescription(answer);
      sendAnswer({ callId: activeCall.callId, answer });
      console.log('📤 Sent WebRTC answer');
    } catch (error) {
      console.error('❌ Handle offer error:', error);
      toast.error('Failed to accept call');
    }
  }, [activeCall, sendAnswer]);

  const handleWebRTCAnswer = useCallback(async (data) => {
    if (!activeCall || data.callId !== activeCall.callId) return;

    console.log('📥 Received WebRTC answer');
    try {
      if (!peerConnectionRef.current) {
        console.error('❌ Peer connection not established');
        return;
      }
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      console.log('✅ WebRTC handshake complete');
    } catch (error) {
      console.error('❌ Handle answer error:', error);
      toast.error('Connection setup failed');
    }
  }, [activeCall]);

  const handleWebRTCIce = useCallback(async (data) => {
    if (!activeCall || data.callId !== activeCall.callId) return;

    try {
      if (peerConnectionRef.current && data.candidate) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log('🧊 ICE candidate added');
      }
    } catch (error) {
      console.error('❌ Handle ICE candidate error:', error);
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
      setCallStatus('connecting');
      setupPeerConnection();
    }
  }, [activeCall, setupPeerConnection]);

  // Update status when call connects
  useEffect(() => {
    // Sync local status with activeCall status
    if (activeCall?.status === 'ringing') {
      setCallStatus('ringing');
    } else if (activeCall?.status === 'accepted') {
      setCallStatus('connecting');
    }

    // Start timer when call status changes to connected (from WebRTC or socket event)
    if (callStatus === 'connected' && !timerRef.current) {
      console.log('⏱️ Starting call timer - call is connected');
      startTimer();
    }
    
    // Also handle socket-based connection event
    if (activeCall && activeCall.status === 'connected' && callStatus !== 'connected') {
      setCallStatus('connected');
    }
  }, [activeCall, callStatus, startTimer]);

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

  // Call Safety: Auto-end call on socket disconnect
  useEffect(() => {
    if (!activeCall) return;

    const handleSocketDisconnect = () => {
      console.log('Socket disconnected - ending call for safety');
      if (activeCall && callStatus === 'connected') {
        handleEndCall();
      }
    };

    socket?.on('disconnect', handleSocketDisconnect);

    return () => {
      socket?.off('disconnect', handleSocketDisconnect);
    };
  }, [activeCall, callStatus, socket, handleEndCall]);

  // Only render once the call has been accepted (WebRTC/setup phase) or connected
  if (!activeCall || !['ringing', 'accepted', 'connected'].includes(activeCall.status) || !isVisible || forceClose) {
    return null;
  }

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
