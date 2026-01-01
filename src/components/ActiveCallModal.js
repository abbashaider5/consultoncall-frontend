import { faDollarSign, faMicrophone, faMicrophoneSlash, faPhoneSlash, faVolumeUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './CallModal.css';

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

  // Reset all state and refs
  const resetAll = useCallback(() => {
    setCallStatus('connecting');
    setDuration(0);
    setIsMuted(false);
    setIsSpeakerOn(false);
    setRemoteUser(null);
    setIsVisible(false);
    setForceClose(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  }, []);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const timerRef = useRef(null);
  const hasStartedCallRef = useRef(false);

  // Listen for call ended event directly
  useEffect(() => {
    if (!activeCall) {
      resetAll();
      return;
    }

    setIsVisible(true);
    setForceClose(false); // Reset force close for new calls
    const handleCallEnded = (data) => {
      console.log('🔚 Call ended event received in ActiveCallModal:', data);
      resetAll();
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

      // Use caller info from activeCall if available (from socket payload)
      if (activeCall.callerInfo && activeCall.callerInfo.name) {
        setRemoteUser({
          name: activeCall.callerInfo.name,
          avatar: activeCall.callerInfo.avatar
        });
        return;
      }

      // Fallback to API call
      try {
        const remoteUserId = user?.role === 'expert' ? activeCall.userId : activeCall.expertId;
        const res = await axios.get(`/api/users/${remoteUserId}`);
        setRemoteUser(res.data);
      } catch (error) {
        console.error('Fetch remote user error:', error);
        // Set fallback data
        setRemoteUser({
          name: user?.role === 'expert' ? (activeCall.callerName || 'Caller') : (activeCall.expertName || 'Expert'),
          avatar: null
        });
      }
    };

    fetchRemoteUser();
  }, [activeCall, user?.role]);

  const setupPeerConnection = useCallback(async () => {
    if (!activeCall || peerConnectionRef.current) {
      return;
    }

    console.log('🔧 Setting up WebRTC connection for active call...');

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(config);
    peerConnectionRef.current = pc;

    // Add local stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
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
        document.body.appendChild(localAudio);
      }
      localAudio.srcObject = stream;
      localAudio.muted = true;
      localAudio.play().catch(err => console.warn('Local audio play failed:', err));
    } catch (mediaError) {
      toast.error('Microphone access denied. Please allow microphone permissions.');
      console.warn('Could not access microphone:', mediaError);
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
        document.body.appendChild(audio);
      }
      
      audio.srcObject = event.streams[0];
      // Explicitly play to bypass browser autoplay restrictions
      audio.play().catch(err => {
        console.warn('Remote audio play failed:', err);
        // Try again after user interaction
        const playAudio = () => {
          audio.play().catch(e => console.warn('Still failed to play audio:', e));
          document.removeEventListener('click', playAudio);
        };
        document.addEventListener('click', playAudio);
      });
      console.log('🎵 Assigned remote stream to audio element and started playback');
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendIceCandidate(activeCall.callId, event.candidate);
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      console.log('WebRTC connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        markCallConnected(activeCall.callId).catch(err => console.error('Mark connected error:', err));
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.error('WebRTC connection failed');
      }
    };

    // Create and send offer (caller initiates)
    if (user?.role === 'user') {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendOffer(activeCall.callId, offer);
        console.log('📤 Sent WebRTC offer');
      } catch (error) {
        console.error('Create offer error:', error);
      }
    }
  }, [activeCall, user?.role, sendOffer, sendIceCandidate, markCallConnected]);

  const handleWebRTCOffer = useCallback(async (data) => {
    if (!activeCall || data.callId !== activeCall.callId) return;

    console.log('📥 Received WebRTC offer');
    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      sendAnswer(activeCall.callId, answer);
      console.log('📤 Sent WebRTC answer');
    } catch (error) {
      console.error('Handle offer error:', error);
    }
  }, [activeCall, sendAnswer]);

  const handleWebRTCAnswer = useCallback(async (data) => {
    if (!activeCall || data.callId !== activeCall.callId) return;

    console.log('📥 Received WebRTC answer');
    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (error) {
      console.error('Handle answer error:', error);
    }
  }, [activeCall]);

  const handleWebRTCIce = useCallback(async (data) => {
    if (!activeCall || data.callId !== activeCall.callId) return;

    try {
      if (peerConnectionRef.current && data.candidate) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (error) {
      console.error('Handle ICE candidate error:', error);
    }
  }, [activeCall]);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    
    const startTime = activeCall.startTime || Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setDuration(elapsed);
    }, 1000);
  }, [activeCall]);

  const handleEndCall = async () => {
    setIsVisible(false);
    setForceClose(true);
    // Update balance immediately if we can estimate it
    if (user?.role === 'user' && activeCall) {
      const estimatedMinutes = Math.max(1, Math.ceil(duration / 60));
      const estimatedTokens = estimatedMinutes * activeCall.tokensPerMinute;
      const newBalance = Math.max(0, (user?.tokens || 0) - estimatedTokens);
      updateTokens(newBalance);
    }
    try {
      if (activeCall) {
        try {
          await endCall(activeCall.callId);
        } catch (socketError) {
          console.error('Socket end call error:', socketError);
        }
      }
      if (activeCall && callStatus === 'connected') {
        const token = localStorage.getItem('token');
        try {
          const res = await axios.put(`/api/calls/end/${activeCall.callId}`, {
            initiatedBy: user?.role
          }, {
            headers: { 'x-auth-token': token }
          });
          if (res.data.success && user?.role === 'user') {
            updateTokens(res.data.newBalance);
            toast.success(`Call ended. Duration: ${res.data.call.minutes} min, Cost: ₹${res.data.call.tokensSpent}`);
          } else if (!res.data.success) {
            toast.error('Failed to end call properly');
          }
        } catch (apiError) {
          console.error('API end call error:', apiError);
        }
      }
    } catch (error) {
      console.error('End call error:', error);
    } finally {
      resetAll();
    }
  };


  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
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
      case 'connecting':
        return 'Setting up call...';
      case 'connected':
        return 'Connected';
      default:
        return 'Connecting...';
    }
  };

  const handleCallStart = useCallback(async () => {
    try {
      // Mark call as connected in backend - THIS STARTS BILLING
      await axios.put(`/api/calls/connect/${activeCall.callId}`);
      console.log('✅ Call connected in backend - billing started');
    } catch (error) {
      console.error('Connect call API error:', error);
    }
  }, [activeCall?.callId]);

  // Setup WebRTC when call is accepted
  useEffect(() => {
    if (activeCall && activeCall.status === 'accepted' && callStatus === 'connecting') {
      setupPeerConnection();
    }
  }, [activeCall, callStatus, setupPeerConnection]);

  // Update status when call connects
  useEffect(() => {
    if (activeCall && activeCall.status === 'connected' && callStatus !== 'connected') {
      setCallStatus('connected');
      startTimer();
      if (!hasStartedCallRef.current) {
        hasStartedCallRef.current = true;
        handleCallStart();
      }
    }
  }, [activeCall, callStatus, handleCallStart, startTimer]);

  // Handle WebRTC offer (for receiver)
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

  // Call Safety: Auto-end call on tab close, visibility change, or socket disconnect
  useEffect(() => {
    if (!activeCall) return;

    const handleBeforeUnload = (e) => {
      // End call when tab is closed
      if (activeCall && callStatus === 'connected') {
        endCall(activeCall.callId);
      }
    };

    const handleVisibilityChange = () => {
      // Optional: Could pause/resume based on visibility, but for now just log
      if (document.hidden) {
        console.log('Tab hidden - call continues');
      } else {
        console.log('Tab visible - call active');
      }
    };

    const handleSocketDisconnect = () => {
      console.log('Socket disconnected - ending call for safety');
      if (activeCall && callStatus === 'connected') {
        handleEndCall();
      }
    };

    // Listen for socket disconnect
    socket?.on('disconnect', handleSocketDisconnect);

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      socket?.off('disconnect', handleSocketDisconnect);
    };
  }, [activeCall, callStatus, socket, endCall, handleEndCall]);


  // Only render once the call has been accepted (WebRTC/setup phase) or connected.
  if (!activeCall || !['accepted', 'connected'].includes(activeCall.status) || !isVisible || forceClose) {
    return null;
  }

  // Show loading state while fetching remote user
  if (!remoteUser) {
    return (
      <div className="call-modal-overlay">
        <div className="call-modal">
          <div className="call-info">
            <div className="call-avatar">
              <span>?</span>
            </div>
            <h2>Loading...</h2>
            <p className="call-title">Connecting call</p>
          </div>
          <div className="call-status">
            <p className={`status-text ${callStatus}`}>{getStatusMessage()}</p>
            <div className="ringing-animation">
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
    <div className="call-modal-overlay stage-c">
      <div className="call-modal-content">
        <div className="expert-display minimized">
          <div className="expert-avatar">
            {remoteUser?.avatar ? (
              <img src={remoteUser.avatar} alt={remoteUser.name} />
            ) : (
              <span className="initials">
                {remoteUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
              </span>
            )}
          </div>
          <div className="expert-details-text">
            <h2>{remoteUser.name}</h2>
            <p className="specialization">
              {user?.role === 'expert' ? 'Client Call' : 'Expert Consultation'}
            </p>
            {user?.role === 'user' && expert && (
              <p className="call-rate">
                <FontAwesomeIcon icon={faDollarSign} className="token-icon" /> ₹{expert.tokensPerMinute}/min
              </p>
            )}
          </div>
        </div>

        <div className="call-status">
          <p className={`status-text ${callStatus}`}>{getStatusMessage()}</p>
          {callStatus === 'connected' && (
            <p className="call-duration">{formatDuration(duration)}</p>
          )}
          {callStatus === 'connecting' && (
            <div className="ringing-animation">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
        </div>

        <div className="call-controls-footer">
          <button
            className={`control-btn ${isMuted ? 'active-state' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
            disabled={callStatus !== 'connected'}
          >
            <div className="icon-circle">
              {isMuted ? <FontAwesomeIcon icon={faMicrophoneSlash} /> : <FontAwesomeIcon icon={faMicrophone} />}
            </div>
            <span className="btn-label">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            className={`control-btn ${isSpeakerOn ? 'active-state' : ''}`}
            onClick={toggleSpeaker}
            title={isSpeakerOn ? 'Switch to earpiece' : 'Switch to speaker'}
            disabled={callStatus !== 'connected'}
          >
            <div className="icon-circle">
              <FontAwesomeIcon icon={faVolumeUp} />
            </div>
            <span className="btn-label">Speaker</span>
          </button>

          <button className="control-btn end-call-btn" onClick={handleEndCall} title="End Call">
            <div className="icon-circle">
              <FontAwesomeIcon icon={faPhoneSlash} />
            </div>
            <span className="btn-label">End</span>
          </button>
        </div>

        <audio id="remoteAudio" autoPlay playsInline style={{ display: 'none' }} />
        {/* Hidden local audio for debugging */}
        <audio id="localAudio" style={{ display: 'none' }} autoPlay muted playsInline />
      </div>
    </div>
  );
};

export default ActiveCallModal;