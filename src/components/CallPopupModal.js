import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faMicrophoneSlash, faPhone, faPhoneSlash, faVolumeUp, faIndianRupeeSign } from '@fortawesome/free-solid-svg-icons';
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

  // Determine if this is incoming or outgoing
  const isIncoming = Boolean(incomingCall && !activeCall);
  const callData = isIncoming ? incomingCall : activeCall;

  const [callStatus, setCallStatus] = useState(isIncoming ? 'ringing' : 'connecting');
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
        const remoteId = user.role === 'expert' ? callData.userId : callData.expertId;
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

  // Accept/reject handlers
  const handleAccept = () => {
    if (!incomingCall || !expert) return;
    acceptCall(incomingCall.callId, incomingCall.callerId, expert._id || expert.id);
    setCallStatus('connecting');
    toast.success('Call accepted!');
  };
  const handleReject = () => {
    if (!incomingCall) return;
    rejectCall(incomingCall.callId, incomingCall.callerId);
    setIsVisible(false);
    setForceClose(true);
    toast.info('Call declined');
  };
  const handleEndCall = async () => {
    setIsVisible(false);
    setForceClose(true);
    if (callData) {
      try {
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
  if (!callData || !isVisible || forceClose) return null;
  // UI
  return (
    <div className="call-modal-overlay">
      <div className="call-modal unified">
        <div className="call-info">
          <div className="call-avatar">
            {remoteUser?.avatar ? (
              <img src={remoteUser.avatar} alt={remoteUser.name} />
            ) : (
              <span>{remoteUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}</span>
            )}
          </div>
          <h2>{remoteUser?.name || 'User'}</h2>
          <div className="call-chips-row">
            <span className="call-chip"><FontAwesomeIcon icon={faIndianRupeeSign} />{expert?.tokensPerMinute || 0}/min</span>
            <span className="call-chip"><FontAwesomeIcon icon={faPhone} /> {isIncoming ? 'Incoming' : 'Outgoing'}</span>
          </div>
        </div>
        <div className="call-status">
          <p className={`status-text ${callStatus}`}>{callStatus === 'connected' ? 'Connected' : callStatus === 'ringing' ? 'Ringing...' : 'Connecting...'}</p>
          {callStatus === 'connected' && (
            <p className="call-duration">{formatDuration(duration)}</p>
          )}
          {(callStatus === 'ringing' || callStatus === 'connecting') && (
            <div className="ringing-animation">
              <span></span><span></span><span></span>
            </div>
          )}
        </div>
        <div className="call-actions">
          {isIncoming && callStatus === 'ringing' ? (
            <>
              <button className="action-btn accept-btn" onClick={handleAccept} title="Accept Call"><FontAwesomeIcon icon={faPhone} /></button>
              <button className="action-btn end-btn" onClick={handleReject} title="Decline"><FontAwesomeIcon icon={faPhoneSlash} /></button>
            </>
          ) : (
            <>
              <button className={`action-btn mute-btn ${isMuted ? 'active' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'} disabled={callStatus !== 'connected'}>{isMuted ? <FontAwesomeIcon icon={faMicrophoneSlash} /> : <FontAwesomeIcon icon={faMicrophone} />}</button>
              <button className={`action-btn speaker-btn ${isSpeakerOn ? 'active' : ''}`} onClick={toggleSpeaker} title={isSpeakerOn ? 'Switch to earpiece' : 'Switch to speaker'} disabled={callStatus !== 'connected'}><FontAwesomeIcon icon={faVolumeUp} /></button>
              <button className="action-btn end-btn" onClick={handleEndCall} title="End Call"><FontAwesomeIcon icon={faPhoneSlash} /></button>
            </>
          )}
        </div>
        <audio id="remoteAudio" autoPlay playsInline />
        <audio id="localAudio" style={{ display: 'none' }} autoPlay muted playsInline />
      </div>
    </div>
  );
};

export default CallPopupModal;
