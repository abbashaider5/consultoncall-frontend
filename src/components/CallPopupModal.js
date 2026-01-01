import { faMicrophone, faMicrophoneSlash, faPhone, faPhoneSlash, faVolumeUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './CallModal.css';

// Unified call popup for both user and expert
const CallPopupModal = () => {
  const { user, expert } = useAuth();
  const {
    activeCall,
    incomingCall,
    endCall,
    acceptCall,
    rejectCall,
    socket
  } = useSocket();

  // Avoid duplicating the user-side outgoing call modal.
  // This popup is dedicated to the expert-side incoming/active call UI.
  const isExpertUser = user?.role === 'expert';

  // CRITICAL FIX: incomingCall takes priority; if it exists, show incoming modal
  const isIncoming = Boolean(incomingCall);
  const callData = incomingCall || activeCall;

  const [callStatus, setCallStatus] = useState('ringing');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [remoteUser, setRemoteUser] = useState(null);
  const [isVisible, setIsVisible] = useState(true);
  const [forceClose, setForceClose] = useState(false);

  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const timerRef = useRef(null);

  // Fetch remote user info
  useEffect(() => {
    if (!callData) return;
    if (isIncoming && incomingCall?.callerInfo) {
      setRemoteUser({
        name: incomingCall.callerInfo.name,
        avatar: incomingCall.callerInfo.avatar
      });
      return;
    }
    if (!isIncoming && activeCall?.callerInfo) {
      setRemoteUser({
        name: activeCall.callerInfo.name,
        avatar: activeCall.callerInfo.avatar
      });
      return;
    }
    // fallback: fetch from API
    const fetchRemote = async () => {
      try {
        if (!user) {
          setRemoteUser({ name: 'User', avatar: null });
          return;
        }
        const remoteId = callData.userId;
        const res = await axios.get(`/api/users/${remoteId}`);
        setRemoteUser(res.data);
      } catch {
        setRemoteUser({ name: 'User', avatar: null });
      }
    };
    fetchRemote();
  }, [callData, isIncoming, user, incomingCall, activeCall]);

  // Listen for call ended event
  useEffect(() => {
    if (!callData) return;
    setIsVisible(true);
    setForceClose(false);
    const handleCallEnded = () => {
      setIsVisible(false);
      setForceClose(true);
      cleanup();
    };
    socket?.on('call_ended', handleCallEnded);
    return () => {
      socket?.off('call_ended', handleCallEnded);
    };
  }, [callData, socket]);

  // Timer
  useEffect(() => {
    if (callStatus === 'connected') {
      if (!timerRef.current) {
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [callStatus]);

  // Sync callStatus with activeCall status changes
  useEffect(() => {
    if (activeCall) {
      if (activeCall.status === 'accepted') {
        setCallStatus('connecting');
      } else if (activeCall.status === 'connected') {
        setCallStatus('connected');
      }
    } else if (incomingCall) {
      setCallStatus('ringing');
    }
  }, [activeCall, incomingCall]);

  // Accept/reject handlers
  const handleAccept = () => {
    if (!incomingCall || !expert) return;
    acceptCall({
      callId: incomingCall.callId,
      userId: incomingCall.userId,
      expertId: expert._id || expert.id,
      callerInfo: incomingCall.callerInfo
    });
    // Don't manually set connected - wait for socket event
    toast.success('Call accepted');
  };
  const handleReject = () => {
    if (!incomingCall) return;
    rejectCall({ callId: incomingCall.callId, reason: 'Expert declined' });
    setIsVisible(false);
    setForceClose(true);
    toast.info('Call declined');
  };
  const handleEndCall = async () => {
    setIsVisible(false);
    setForceClose(true);
    if (callData) {
      try {
        // End call in backend first (source of truth)
        const token = localStorage.getItem('token');
        if (token) {
          await axios.put(`/api/calls/end/${callData.callId}`, { initiatedBy: 'expert' }, { headers: { 'x-auth-token': token } });
        }
        await endCall(callData.callId);
      } catch {}
    }
    cleanup();
  };
  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
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
    setIsSpeakerOn(!isSpeakerOn);
    toast.info(isSpeakerOn ? 'Switched to earpiece' : 'Switched to speaker');
  };
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isExpertUser) return null;
  if (!callData || !isVisible || forceClose) return null;

  const isStageA = isIncoming && callStatus === 'ringing';
  const isStageC = !isIncoming || callStatus === 'connected';

  return (
    <div className={`call-modal-overlay stage-${isStageA ? 'a' : 'c'}`}>
      <div className="call-modal-content">
        <div className={`expert-display ${isStageC ? 'minimized' : ''}`}>
          <div className={`expert-avatar ${isStageA ? 'pulsing' : ''}`}>
            {remoteUser?.avatar ? (
              <img src={remoteUser.avatar} alt={remoteUser.name} />
            ) : (
              <span className="initials">{remoteUser?.name?.[0] || '?'}</span>
            )}
          </div>

          <div className="expert-details-text">
            <h2>{remoteUser?.name || 'User'}</h2>
            {isIncoming && <p className="specialization">Incoming Call</p>}
            {isStageA && <p className="status-label">Incoming...</p>}
          </div>
        </div>

        {isStageC && (
          <div className="active-call-timer">{formatDuration(duration)}</div>
        )}

        <div className="call-controls-footer">
          {isIncoming && isStageA ? (
            <>
              <button className="control-btn end-call-btn" onClick={handleReject}>
                <div className="icon-circle"><FontAwesomeIcon icon={faPhoneSlash} /></div>
                <span className="btn-label">Reject</span>
              </button>

              <button className="control-btn accept-call-btn" onClick={handleAccept}>
                <div className="icon-circle"><FontAwesomeIcon icon={faPhone} /></div>
                <span className="btn-label">Accept</span>
              </button>
            </>
          ) : (
            <>
              <button className={`control-btn ${isMuted ? 'active-state' : ''}`} onClick={toggleMute}>
                <div className="icon-circle">{isMuted ? <FontAwesomeIcon icon={faMicrophoneSlash} /> : <FontAwesomeIcon icon={faMicrophone} />}</div>
                <span className="btn-label">{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              <button className={`control-btn ${isSpeakerOn ? 'active-state' : ''}`} onClick={toggleSpeaker}>
                <div className="icon-circle"><FontAwesomeIcon icon={faVolumeUp} /></div>
                <span className="btn-label">Speaker</span>
              </button>

              <button className="control-btn end-call-btn" onClick={handleEndCall}>
                <div className="icon-circle"><FontAwesomeIcon icon={faPhoneSlash} /></div>
                <span className="btn-label">End</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallPopupModal;
