import { faPhone, faPhoneSlash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './CallModal.css';

// Unified call popup for both user and expert
const CallPopupModal = () => {
  const { user, expert } = useAuth();
  const {
    incomingCall,
    acceptCall,
    rejectCall,
    socket
  } = useSocket();

  // Avoid duplicating the user-side outgoing call modal.
  // This popup is dedicated to the expert-side incoming/active call UI.
  const isExpertUser = user?.role === 'expert';

  // Incoming-only popup: once accepted, ActiveCallModal takes over.
  const callData = incomingCall;

  const [remoteUser, setRemoteUser] = useState(null);
  const [isVisible, setIsVisible] = useState(true);
  const [forceClose, setForceClose] = useState(false);

  // Fetch remote user info
  useEffect(() => {
    if (!callData) return;

    if (incomingCall?.callerInfo) {
      setRemoteUser({
        name: incomingCall.callerInfo.name,
        avatar: incomingCall.callerInfo.avatar
      });
      return;
    }

    // fallback: fetch from API
    const fetchRemote = async () => {
      try {
        const remoteId = callData.userId;
        if (!remoteId) {
          setRemoteUser({ name: 'User', avatar: null });
          return;
        }
        const res = await axios.get(`/api/users/${remoteId}`);
        setRemoteUser(res.data);
      } catch {
        setRemoteUser({ name: 'User', avatar: null });
      }
    };
    fetchRemote();
  }, [callData, incomingCall]);

  // Listen for call ended event
  useEffect(() => {
    if (!callData) return;
    setIsVisible(true);
    setForceClose(false);
    const handleCallEnded = () => {
      setIsVisible(false);
      setForceClose(true);
    };
    socket?.on('call_ended', handleCallEnded);
    return () => {
      socket?.off('call_ended', handleCallEnded);
    };
  }, [callData, socket]);

  // Reset to ringing when new incoming call arrives
  useEffect(() => {
    if (incomingCall) {
      setIsVisible(true);
      setForceClose(false);
    }
  }, [incomingCall]);

  // Accept/reject handlers
  const handleAccept = () => {
    if (!incomingCall) return;
    const expertId = (expert?._id || expert?.id || incomingCall.expertId);
    if (!expertId) {
      toast.error('Unable to accept call');
      return;
    }
    acceptCall({
      callId: incomingCall.callId,
      userId: incomingCall.userId,
      expertId,
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

  if (!isExpertUser) return null;
  if (!callData || !isVisible || forceClose) return null;

  const isStageA = true;

  return (
    <div className="call-modal-overlay stage-a">
      <div className="call-modal-content">
        <div className="expert-display">
          <div className="expert-avatar pulsing">
            {remoteUser?.avatar ? (
              <img src={remoteUser.avatar} alt={remoteUser.name} />
            ) : (
              <span className="initials">{remoteUser?.name?.[0] || '?'}</span>
            )}
          </div>

          <div className="expert-details-text">
            <h2>{remoteUser?.name || 'Caller'}</h2>
            <p className="specialization">Incoming Call</p>
            <p className="status-label">Incoming...</p>
          </div>
        </div>

        <div className="call-controls-footer">
          {/* INCOMING CALL: Show Accept/Reject buttons */}
          {isStageA ? (
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
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default CallPopupModal;
