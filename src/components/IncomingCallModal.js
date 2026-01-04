import { faPhone, faPhoneSlash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './IncomingCallModal.css';

const IncomingCallModal = () => {
  const { user, expert } = useAuth();
  const { incomingCall, acceptCall, rejectCall } = useSocket();
  const [callerInfo, setCallerInfo] = useState(null);

  const fetchCallerInfo = useCallback(async () => {
    if (!incomingCall) return;

    // Use caller info from socket payload if available
    if (incomingCall.callerInfo) {
      setCallerInfo({
        name: incomingCall.callerInfo.name,
        avatar: incomingCall.callerInfo.avatar
      });
      return;
    }

    // Fallback to API call
    try {
      const res = await axios.get(`/api/users/${incomingCall.callerId}`);
      setCallerInfo(res.data);
    } catch (error) {
      console.error('Fetch caller info error:', error);
      // Set a default caller if fetch fails
      setCallerInfo({
        name: 'User',
        avatar: null
      });
    }
  }, [incomingCall]);

  useEffect(() => {
    if (incomingCall) {
      fetchCallerInfo();

      // Auto-reject after 30 seconds if not answered
      const timeout = setTimeout(() => {
        if (incomingCall) {
          rejectCall({
            callId: incomingCall.callId,
            reason: 'No answer - timeout'
          });
          toast.info('Call missed - auto-rejected');
        }
      }, 30000);

      // Vibrate if supported
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }

      return () => {
        clearTimeout(timeout);
      };
    }
  }, [incomingCall, fetchCallerInfo, rejectCall]);

  const handleAccept = () => {
    if (!incomingCall) return;

    // Determine current user id (expert or regular user)
    const currentUserId = (expert && (expert._id || expert.id)) || (user && (user._id || user.id));
    if (!currentUserId) {
      toast.error('Unable to accept call: user not identified');
      return;
    }

    // Pass data as object
    acceptCall({
      callId: incomingCall.callId,
      userId: incomingCall.callerId,
      expertId: currentUserId,
      callerInfo: incomingCall.callerInfo
    });
    toast.success('Accepted');
  };

  const handleReject = () => {
    if (!incomingCall) return;
    // Pass data as object
    rejectCall({
      callId: incomingCall.callId,
      reason: 'User declined'
    });
  };

  if (!incomingCall) return null;

  return (
    <div className="incoming-modal-overlay">
      <div className="incoming-modal-content">

        {/* Caller Info Header */}
        <div className="caller-display">
          <div className="caller-avatar-stage-b">
            {callerInfo?.avatar ? (
              <img src={callerInfo.avatar} alt={callerInfo.name} />
            ) : (
              <span className="initials">{callerInfo?.name?.[0] || '?'}</span>
            )}
          </div>
          <h2 className="caller-name-b">{callerInfo?.name || 'Incoming Call'}</h2>
          <p className="call-status-b">Incoming Audio Call...</p>
        </div>

        {/* Action Buttons: 2 Large Circles */}
        <div className="incoming-actions-b">

          {/* Decline Button */}
          <button className="action-circle decline" onClick={handleReject}>
            <FontAwesomeIcon icon={faPhoneSlash} className="icon-b" />
            <span className="label-b">Decline</span>
          </button>

          {/* Accept Button */}
          <button className="action-circle accept" onClick={handleAccept}>
            <FontAwesomeIcon icon={faPhone} className="icon-b shake-animation" />
            <span className="label-b">Accept</span>
          </button>

        </div>

      </div>
    </div>
  );
};

export default IncomingCallModal;
