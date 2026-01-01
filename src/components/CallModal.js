import { useCallback, useEffect, useRef, useState } from 'react';
import { FiMessageSquare, FiMicOff, FiPhoneOff, FiVolume2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './CallModal.css';
import VerifiedBadge from './VerifiedBadge';

const CallModal = ({ expert, onClose }) => {
  const { user, updateTokens } = useAuth();
  const {
    initiateCall,
    endCall,
    activeCall,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    markCallConnected,
    isConnected,
    connectionError,
    socket
  } = useSocket();

  // Call Statuses: initiating, ringing (Stage A), connected (Stage C), ending
  const [callStatus, setCallStatus] = useState('initiating');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callId, setCallId] = useState(null);
  const [showChat, setShowChat] = useState(false); // Placeholder for chat toggle logic

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const timerRef = useRef(null);
  const hasStartedCallRef = useRef(false);

  // Setup WebRTC handlers
  useEffect(() => {
    window.webrtcOfferHandler = handleWebRTCOffer;
    window.webrtcAnswerHandler = handleWebRTCAnswer;
    window.webrtcIceHandler = handleWebRTCIce;

    return () => {
      window.webrtcOfferHandler = null;
      window.webrtcAnswerHandler = null;
      window.webrtcIceHandler = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  // Monitor active call status changes
  useEffect(() => {
    if (activeCall && activeCall.status === 'accepted' && callStatus === 'ringing') {
      setCallStatus('connecting');
      setupPeerConnection();
    } else if (activeCall && activeCall.status === 'connected' && callStatus !== 'connected') {
      setCallStatus('connected');
      startTimer();
      if (!hasStartedCallRef.current) {
        hasStartedCallRef.current = true;
        handleCallStart();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCall]);

  // Listen for call_accepted event (when expert accepts)
  useEffect(() => {
    const handleCallAccepted = (data) => {
      if (data.callId === callId) {
        console.log('✅ Expert accepted the call:', data);
        setCallStatus('connecting');
        setupPeerConnection();
      }
    };

    socket?.on('call_accepted', handleCallAccepted);

    return () => {
      socket?.off('call_accepted', handleCallAccepted);
    };
  }, [callId, socket, setupPeerConnection]);

  // Listen for call ended event
  useEffect(() => {
    const handleCallEnded = () => {
      console.log('Call ended remotely, closing modal');
      cleanup();
      onClose();
    };

    const handleCallRejected = (data) => {
      if (data.callId === callId) {
        console.log('❌ Expert rejected the call:', data);
        toast.error(data.reason || 'Expert declined the call');
        cleanup();
        onClose();
      }
    };

    const handleCallTimeout = (data) => {
      if (data.callId === callId) {
        console.log('⏱️ Call timeout:', data);
        toast.info('Expert did not respond');
        cleanup();
        onClose();
      }
    };

    socket?.on('call_ended', handleCallEnded);
    socket?.on('call_rejected', handleCallRejected);
    socket?.on('call_timeout', handleCallTimeout);

    return () => {
      socket?.off('call_ended', handleCallEnded);
      socket?.off('call_rejected', handleCallRejected);
      socket?.off('call_timeout', handleCallTimeout);
    };
  }, [socket, onClose, callId]);

  // Initialize call
  useEffect(() => {
    startCall();
    return () => {
      // End call if it's still active when component unmounts
      if (callId && (callStatus === 'ringing' || callStatus === 'connecting' || callStatus === 'connected')) {
        endCall(callId);
      }
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCall = async () => {
    try {
      console.log('🚀 Starting call...', { expert, user });

      if (!isConnected || !socket) {
        console.error('❌ Socket not connected:', { isConnected, hasSocket: !!socket, connectionError });
        toast.error(connectionError || 'Socket not connected. Please refresh and try again.');
        onClose();
        return;
      }

      // Check user balance
      const minTokens = expert.tokensPerMinute * 5;
      if (user.tokens < minTokens) {
        toast.error(`Minimum ₹${minTokens} required for this call`);
        onClose();
        return;
      }

      setCallStatus('initiating');

      // Create call in database
      console.log('📞 Creating call in database...');
      const res = await axios.post('/api/calls/initiate', {
        expertId: expert._id
      });

      console.log('✅ Call created in DB:', res.data);
      const newCallId = res.data.call.id;
      setCallId(newCallId);

      // Get user media
      try {
        console.log('🎤 Requesting microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });
        localStreamRef.current = stream;
        console.log('✅ Microphone access granted');
      } catch (mediaError) {
        console.warn('⚠️ Could not access microphone:', mediaError);
        toast.warning('Could not access microphone. Call may have audio issues.');
      }

      setCallStatus('ringing');

      // CRITICAL FIX: Pass data object properly
      console.log('📡 Emitting call:initiate to socket server...', { callId: newCallId, expertId: expert._id });
      const ack = await initiateCall({
        callId: newCallId,
        expertId: expert._id,
        userId: user._id
      });

      console.log('📡 Socket response:', ack);

      if (ack && ack.success === false) {
        console.error('❌ Call initiation failed:', ack.error);
        toast.error(ack.error || 'Unable to connect the call. Please try again.');
        try {
          await axios.put(`/api/calls/end/${newCallId}`, { initiatedBy: 'user' });
        } catch (e) {
          console.error('Failed to end call after initiation failure:', e);
        }
        cleanup();
        onClose();
        return;
      }

      console.log('✅ Call initiated successfully');

      // Set 60s timeout for ringing state
      const ringingTimeout = setTimeout(() => {
        if (callStatus === 'ringing') {
          console.log('⏰ Call timeout - no answer after 60s');
          toast.info('Expert did not answer');
          handleEndCall();
        }
      }, 60000);

      return () => clearTimeout(ringingTimeout);
    } catch (error) {
      console.error('❌ Start call error:', error);
      setCallStatus('failed');
      const errorMessage = error.response?.data?.message || error.message || 'Call failed. Please try again.';
      toast.error(errorMessage);
      cleanup();
      setTimeout(() => onClose(), 2000);
    }
  };

  const setupPeerConnection = useCallback(async () => {
    if (!callId || peerConnectionRef.current) return;

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(config);
    peerConnectionRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0];
      const audio = document.getElementById('remoteAudio');
      if (audio) {
        audio.srcObject = event.streams[0];
        audio.play().catch(err => console.warn('Audio play failed:', err));

        // Handle speaker toggle
        if (typeof audio.setSinkId === 'function' && isSpeakerOn) {
          // Need device ID enumeration to specific set output, simpler to just rely on system default for now or basic output
          // This is complex due to browser restrictions without specific device permission
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendIceCandidate(callId, event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        markCallConnected(callId).catch(console.error);
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendOffer(callId, offer);
    } catch (error) {
      console.error('Create offer error:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, isSpeakerOn]);

  const handleWebRTCOffer = async (data) => {
    if (data.callId !== callId) return;
    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      sendAnswer(callId, answer);
    } catch (error) {
      console.error('Handle offer error:', error);
    }
  };

  const handleWebRTCAnswer = async (data) => {
    if (data.callId !== callId) return;
    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (error) {
      console.error('Handle answer error:', error);
    }
  };

  const handleWebRTCIce = async (data) => {
    if (data.callId !== callId) return;
    try {
      if (peerConnectionRef.current && data.candidate) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (error) {
      console.error('Handle ICE candidate error:', error);
    }
  };

  const handleCallStart = async () => {
    try {
      await axios.put(`/api/calls/connect/${callId}`);
    } catch (error) {
      console.error('Connect call API error:', error);
    }
  };

  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  };

  const handleEndCall = async () => {
    try {
      if (callId) {
        const res = await axios.put(`/api/calls/end/${callId}`, {
          initiatedBy: 'user'
        });

        if (res.data?.success) {
          if (res.data.newBalance !== undefined) {
            updateTokens(res.data.newBalance);
          }
          if (callStatus === 'connected') {
            toast.success(`Call Ended. Time: ${res.data.call?.minutes || 0}m | Cost: ₹${res.data.call?.tokensSpent || 0}`);
          } else {
            toast.info('Call Cancelled');
          }
        }

        await endCall(callId);
      }

      cleanup();
      onClose();
    } catch (error) {
      console.error('End call error:', error);
      cleanup();
      onClose();
    }
  };

  const cleanup = () => {
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
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleSpeaker = () => {
    // Note: Switching output device purely via JS is limited in many browsers without setSinkId support
    const audio = document.getElementById('remoteAudio');
    if (audio && typeof audio.setSinkId === 'function') {
      // This logic depends on device enumeration which allows switching between loud speaker and earpiece on supported mobile browsers
      // For now, we mainly toggle the state for UI feedback
    }
    setIsSpeakerOn(!isSpeakerOn);
    toast.info(isSpeakerOn ? "Speaker Off" : "Speaker On");
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // UI RENDER HELPERS
  const isStageA = callStatus === 'initiating' || callStatus === 'ringing' || callStatus === 'connecting';
  const isStageC = callStatus === 'connected';

  // Safety check for rendering
  if (!expert || !expert.user) {
    console.error('❌ CallModal render: Invalid expert data');
    return null;
  }

  return (
    <div className={`call-modal-overlay stage-${isStageA ? 'a' : 'c'}`}>
      <div className="call-modal-content">

        {/* SHARED HEADER: EXPERT INFO */}
        <div className={`expert-display ${isStageC ? 'minimized' : ''}`}>
          <div className={`expert-avatar ${isStageA ? 'pulsing' : ''}`}>
            {expert.user?.avatar ? (
              <img src={expert.user.avatar} alt={expert.user?.name || 'Expert'} />
            ) : (
              <span className="initials">{expert.user?.name?.[0] || 'E'}</span>
            )}
          </div>

          <div className="expert-details-text">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <h2>{expert.user?.name || 'Expert'}</h2>
              {expert.isVerified && <VerifiedBadge size="small" />}
            </div>
            <p className="specialization">{expert.title || 'Expert Consultant'}</p>
            {isStageA && (
              <p className="status-label">
                {callStatus === 'initiating' ? 'Connecting...' : callStatus === 'ringing' ? 'Ringing...' : 'Connecting call...'}
              </p>
            )}
          </div>
        </div>

        {/* STAGE C: TIMER */}
        {isStageC && (
          <div className="active-call-timer">
            {formatDuration(duration)}
          </div>
        )}

        {/* CONTROLS FOOTER */}
        <div className="call-controls-footer">

          {/* Stage C Controls: Mute, Speaker, Chat */}
          {isStageC && (
            <>
              <button className={`control-btn ${isMuted ? 'active-state' : ''}`} onClick={toggleMute}>
                <div className="icon-circle"><FiMicOff /></div>
                <span className="btn-label">{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              <button className={`control-btn ${isSpeakerOn ? 'active-state' : ''}`} onClick={toggleSpeaker}>
                <div className="icon-circle"><FiVolume2 /></div>
                <span className="btn-label">Speaker</span>
              </button>

              <button className="control-btn" onClick={() => setShowChat(!showChat)}>
                <div className="icon-circle"><FiMessageSquare /></div>
                <span className="btn-label">Chat</span>
              </button>
            </>
          )}

          {/* END CALL BUTTON (Shared Stage A & C) */}
          <button className="control-btn end-call-btn" onClick={handleEndCall}>
            <div className="icon-circle bg-red"><FiPhoneOff /></div>
            <span className="btn-label">{isStageA ? 'Cancel' : 'End'}</span>
          </button>

        </div>

        <audio id="remoteAudio" autoPlay playsInline />
      </div>
    </div>
  );
};

export default CallModal;
