import { faMicrophone, faMicrophoneSlash, faPhoneSlash, faVolumeUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './ActiveCallModal.css';

const ActiveCallModal = () => {
  const { user, updateTokens } = useAuth();
  const {
    activeCall,
    endCall,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    markCallConnected,
    socket
  } = useSocket();

  const [callStatus, setCallStatus] = useState('connecting'); // 'connecting' | 'connected'
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [remoteUser, setRemoteUser] = useState(null);
  const [isVisible, setIsVisible] = useState(true);
  const [forceClose, setForceClose] = useState(false);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const timerRef = useRef(null);
  const hasStartedCallRef = useRef(false);

  // Reset everything safely
  const resetAll = useCallback(() => {
    setCallStatus('connecting');
    setDuration(0);
    setIsMuted(false);
    setIsSpeakerOn(false);
    setRemoteUser(null);
    setIsVisible(false);
    setForceClose(false);
    hasStartedCallRef.current = false;

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

  // Auto cleanup if socket disconnects while call is active
  useEffect(() => {
    if (!socket?.connected && activeCall) {
      toast.error('Connection lost. Call ended.');
      resetAll();
      endCall(activeCall.callId).catch(() => {});
    }
  }, [socket?.connected, activeCall, endCall, resetAll]);

  // Listen for call ended event
  useEffect(() => {
    if (!activeCall) {
      resetAll();
      return;
    }

    setIsVisible(true);
    setForceClose(false);

    const handleCallEnded = () => {
      console.log('Call ended event received');
      resetAll();
    };

    socket?.on('call_ended', handleCallEnded);

    return () => {
      socket?.off('call_ended', handleCallEnded);
    };
  }, [activeCall, socket, resetAll]);

  // Fetch remote user info
  useEffect(() => {
    const fetchRemoteUser = async () => {
      if (!activeCall || !user?.role) return;

      // Use callerInfo from socket payload if available
      if (activeCall.callerInfo?.name) {
        setRemoteUser({
          name: activeCall.callerInfo.name,
          avatar: activeCall.callerInfo.avatar
        });
        return;
      }

      try {
        const remoteUserId = user.role === 'expert' ? activeCall.userId : activeCall.expertId;
        if (!remoteUserId) {
          setRemoteUser({ name: user.role === 'expert' ? 'Caller' : 'Expert', avatar: null });
          return;
        }

        const endpoint = user.role === 'expert' ? `/api/users/${remoteUserId}` : `/api/experts/${remoteUserId}`;
        const res = await axios.get(endpoint);

        const userData = user.role === 'expert' ? res.data : (res.data.user || res.data);

        setRemoteUser({
          name: userData.name,
          avatar: userData.avatar
        });
      } catch (error) {
        console.error('Fetch remote user error:', error);
        setRemoteUser({
          name: user.role === 'expert' ? (activeCall.callerName || 'Caller') : (activeCall.expertName || 'Expert'),
          avatar: null
        });
      }
    };

    fetchRemoteUser();
  }, [activeCall, user?.role]);

  // Setup WebRTC peer connection
  const setupPeerConnection = useCallback(async () => {
    if (!activeCall || peerConnectionRef.current || !socket?.connected) {
      return;
    }

    console.log('Setting up WebRTC connection...');

    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      peerConnectionRef.current = pc;

      // Get local stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Local audio (muted)
      let localAudio = document.getElementById('localAudio');
      if (!localAudio) {
        localAudio = document.createElement('audio');
        localAudio.id = 'localAudio';
        localAudio.muted = true;
        localAudio.style.display = 'none';
        document.body.appendChild(localAudio);
      }
      localAudio.srcObject = stream;
      localAudio.play().catch(() => {});

      // Remote stream
      pc.ontrack = (event) => {
        remoteStreamRef.current = event.streams[0];
        let remoteAudio = document.getElementById('remoteAudio');
        if (!remoteAudio) {
          remoteAudio = document.createElement('audio');
          remoteAudio.id = 'remoteAudio';
          remoteAudio.autoPlay = true;
          remoteAudio.playsInline = true;
          document.body.appendChild(remoteAudio);
        }
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.play().catch(() => {
          document.addEventListener('click', () => remoteAudio.play(), { once: true });
        });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendIceCandidate(activeCall.callId, event.candidate);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('WebRTC state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setCallStatus('connected');
          markCallConnected(activeCall.callId).catch(() => {});
        }
      };

      // Caller creates offer
      if (user?.role === 'user') {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendOffer(activeCall.callId, offer);
      }
    } catch (error) {
      console.error('WebRTC setup failed:', error);
      toast.error('Call connection failed. Ending call.');
      handleEndCall();
    }
  }, [activeCall, user?.role, socket?.connected, sendOffer, sendIceCandidate, markCallConnected]);

  // WebRTC signaling handlers
  const handleWebRTCOffer = useCallback(async (data) => {
    if (!activeCall || data.callId !== activeCall.callId) return;
    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      sendAnswer(activeCall.callId, answer);
    } catch (error) {
      console.error('Offer handler error:', error);
    }
  }, [activeCall, sendAnswer]);

  const handleWebRTCAnswer = useCallback(async (data) => {
    if (!activeCall || data.callId !== activeCall.callId) return;
    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (error) {
      console.error('Answer handler error:', error);
    }
  }, [activeCall]);

  const handleWebRTCIce = useCallback(async (data) => {
    if (!activeCall || data.callId !== activeCall.callId) return;
    try {
      if (peerConnectionRef.current && data.candidate) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (error) {
      console.error('ICE candidate error:', error);
    }
  }, [activeCall]);

  // Start timer when connected
  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    const startTime = activeCall.startTime || Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setDuration(elapsed);

      // Balance check for user
      if (user?.role === 'user' && activeCall?.tokensPerMinute) {
        const elapsedMinutes = elapsed / 60;
        const cost = Math.ceil(elapsedMinutes) * activeCall.tokensPerMinute;
        const remaining = (user?.tokens || 0) - cost;

        if (remaining <= activeCall.tokensPerMinute && remaining > 0) {
          toast.warning('Low balance! ~1 minute left', { toastId: 'low-balance' });
        }
        if (remaining <= 0) {
          toast.error('Balance exhausted');
          handleEndCall();
        }
      }
    }, 1000);
  }, [activeCall, user]);

  // Timeout for stuck "connecting" state
  useEffect(() => {
    if (callStatus === 'connecting' && activeCall) {
      const timeout = setTimeout(() => {
        if (callStatus === 'connecting') {
          toast.error('Call taking too long');
          handleEndCall();
        }
      }, 30000);
      return () => clearTimeout(timeout);
    }
  }, [callStatus, activeCall]);

  const handleCallStart = useCallback(async () => {
    if (hasStartedCallRef.current) return;
    hasStartedCallRef.current = true;
    try {
      await axios.put(`/api/calls/connect/${activeCall.callId}`);
    } catch (error) {
      console.error('Connect API error:', error);
    }
  }, [activeCall?.callId]);

  // Trigger WebRTC when call accepted
  useEffect(() => {
    if (activeCall && ['accepted', 'ringing', 'connected'].includes(activeCall.status) && !peerConnectionRef.current) {
      setupPeerConnection();
    }
  }, [activeCall, setupPeerConnection]);

  // Update status & timer
  useEffect(() => {
    if (callStatus === 'connected' && !timerRef.current) {
      startTimer();
      handleCallStart();
    }
  }, [callStatus, startTimer, handleCallStart]);

  // Global WebRTC handlers
  useEffect(() => {
    window.webrtcOfferHandler = handleWebRTCOffer;
    window.webrtcAnswerHandler = handleWebRTCAnswer;
    window.webrtcIceHandler = handleWebRTCIce;
    return () => {
      window.webrtcOfferHandler = null;
      window.webrtcAnswerHandler = null;
      window.webrtcIceHandler = null;
    };
  }, [handleWebRTCOffer, handleWebRTCAnswer, handleWebRTCIce]);

  const handleEndCall = useCallback(async () => {
    setIsVisible(false);
    setForceClose(true);

    try {
      if (activeCall) {
        await endCall(activeCall.callId);
        if (activeCall.status === 'connected') {
          const res = await axios.put(`/api/calls/end/${activeCall.callId}`, { initiatedBy: user?.role });
          if (res.data.success && user?.role === 'user') {
            updateTokens(res.data.newBalance);
            toast.success(`Call ended. Duration: ${res.data.call.minutes} min`);
          }
        }
      }
    } catch (error) {
      console.error('End call error:', error);
    } finally {
      resetAll();
    }
  }, [activeCall, user, endCall, updateTokens, resetAll]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleSpeaker = async () => {
    // Visual toggle + toast (advanced sinkId not reliable on all devices)
    setIsSpeakerOn(!isSpeakerOn);
    toast.info(isSpeakerOn ? 'Switched to earpiece' : 'Switched to speaker');
  };

  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Stronger render guard
  if (
    !activeCall ||
    !socket?.connected ||
    !['accepted', 'ringing', 'connected'].includes(activeCall.status) ||
    !isVisible ||
    forceClose
  ) {
    return null;
  }

  if (!remoteUser) {
    return (
      <div className="active-call-overlay">
        <div className="active-call-modal">
          <div className="call-status-badge">
            <div className="status-dot"></div>
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
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="active-call-overlay">
      <div className="active-call-modal">
        <div className="call-status-badge">
          <div className="status-dot"></div>
          <span className="status-text">
            {callStatus === 'connected' ? 'Connected' : 'Setting up...'}
          </span>
        </div>

        <div className="call-user-section">
          <div className="user-avatar-wrapper">
            {remoteUser.avatar ? (
              <img src={remoteUser.avatar} alt={remoteUser.name} className="user-avatar" />
            ) : (
              <div className="user-avatar">
                {remoteUser.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
            )}
            {callStatus === 'connecting' && <div className="avatar-pulse"></div>}
          </div>
          <h2 className="user-name">{remoteUser.name}</h2>
          <p className="user-title">
            {user?.role === 'expert' ? 'User Consultation' : 'Expert Consultation'}
          </p>
        </div>

        {callStatus === 'connected' && (
          <div className="call-timer">
            <div className="timer-value">{formatDuration(duration)}</div>
            <div className="timer-label">Duration</div>
          </div>
        )}

        {callStatus === 'connecting' && (
          <div className="call-connecting">
            <div className="connecting-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}

        <div className="call-controls">
          <button
            className={`control-button mute ${isMuted ? 'active' : ''}`}
            onClick={toggleMute}
            disabled={callStatus !== 'connected'}
          >
            <div className="control-icon">
              <FontAwesomeIcon icon={isMuted ? faMicrophoneSlash : faMicrophone} />
            </div>
            <span className="control-label">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button className="control-button end-call" onClick={handleEndCall}>
            <div className="control-icon">
              <FontAwesomeIcon icon={faPhoneSlash} />
            </div>
            <span className="control-label">End</span>
          </button>

          <button
            className={`control-button speaker ${isSpeakerOn ? 'active' : ''}`}
            onClick={toggleSpeaker}
            disabled={callStatus !== 'connected'}
          >
            <div className="control-icon">
              <FontAwesomeIcon icon={faVolumeUp} />
            </div>
            <span className="control-label">Speaker</span>
          </button>
        </div>

        <audio id="remoteAudio" autoPlay playsInline style={{ display: 'none' }} />
        <audio id="localAudio" autoPlay muted playsInline style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default ActiveCallModal;