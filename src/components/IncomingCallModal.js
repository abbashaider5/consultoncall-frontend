import { faPhone, faPhoneSlash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './IncomingCallModal.css';

const IncomingCallModal = () => {
  const { user, expert, isExpert } = useAuth();
  const { socket, incomingCall, acceptCall, rejectCall } = useSocket();
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  console.log('🔄 IncomingCallModal render cycle:', {
    hasIncomingCall: !!incomingCall,
    incomingCallId: incomingCall?.callId,
    incomingCallStatus: incomingCall?.status,
    isExpert,
    hasExpertProfile: !!expert,
    userRole: user?.role,
    expertId: expert?._id
  });

  // Only show when there's an incoming call
  if (!incomingCall) {
    console.log('❌ IncomingCallModal: No incomingCall - returning null');
    return null;
  }

  // Only experts should see this modal
  if (!isExpert && !expert && user?.role !== 'expert') {
    console.log('🚫 IncomingCallModal: Not an expert, not rendering');
    console.log('👤 User info:', { 
      userRole: user?.role, 
      hasExpert: !!expert, 
      isExpert, 
      expertId: expert?._id 
    });
    return null;
  }

  console.log('✅✅✅ IncomingCallModal: RENDERING MODAL ✅✅✅');
  console.log('📞 Call info:', {
    callerName: incomingCall.callerInfo?.name,
    callId: incomingCall.callId,
    status: incomingCall.status,
    expertId: incomingCall.expertId
  });

  const handleAccept = async () => {
    if (!incomingCall || accepting || rejecting) return;

    const expertId = expert?._id || expert?.id || incomingCall.expertId;
    if (!expertId) {
      toast.error('Unable to accept call - missing expert ID');
      return;
    }

    try {
      setAccepting(true);
      console.log('📞 Expert accepting call:', incomingCall);

      // Update backend first (source of truth)
      const token = localStorage.getItem('token');
      await axios.put(`/api/calls/accept/${incomingCall.callId}`, {}, {
        headers: { 'x-auth-token': token }
      });

      console.log('✅ Call accepted in backend');

      // Emit call_accepted via socket (notify caller)
      socket.emit('call_accepted', {
        callId: incomingCall.callId,
        userId: incomingCall.userId,
        expertId: expertId
      });

      console.log('✅ Emitted call_accepted to caller');

      // SocketContext will handle setting activeCall
      // This will trigger AgoraAudioCall to initialize
      acceptCall({
        callId: incomingCall.callId,
        userId: incomingCall.userId,
        expertId: expertId,
        callerInfo: incomingCall.caller || {
          name: incomingCall.callerInfo?.name || 'Caller',
          avatar: incomingCall.callerInfo?.avatar || null
        }
      });

      toast.success('Call accepted! Connecting...', { position: 'top-center' });

    } catch (error) {
      console.error('❌ Error accepting call:', error);
      toast.error(error.response?.data?.message || 'Failed to accept call');
      setAccepting(false);
    }
  };

  const handleReject = async (reason = 'Expert declined') => {
    if (!incomingCall || accepting || rejecting) return;

    try {
      setRejecting(true);
      console.log('📞 Expert rejecting call:', incomingCall);

      // Update backend
      const token = localStorage.getItem('token');
      await axios.put(`/api/calls/reject/${incomingCall.callId}`, { reason }, {
        headers: { 'x-auth-token': token }
      });

      console.log('✅ Call rejected in backend');

      // Emit call_rejected via socket (notify caller)
      socket.emit('call_rejected', {
        callId: incomingCall.callId,
        userId: incomingCall.userId,
        expertId: expert?._id || expert?.id,
        reason
      });

      console.log('✅ Emitted call_rejected to caller');

      // Clear incoming call state
      rejectCall({ callId: incomingCall.callId, reason });

      toast.info('Call declined', { position: 'top-center' });

    } catch (error) {
      console.error('❌ Error rejecting call:', error);
      toast.error('Failed to decline call');
      setRejecting(false);
    }
  };

  const callerName = incomingCall.callerInfo?.name || 
                     incomingCall.caller?.name || 
                     'Caller';
  const callerAvatar = incomingCall.callerInfo?.avatar || 
                      incomingCall.caller?.avatar;

  return (
    <div className="call-modal-overlay">
      <div className="call-modal-content stage-a">
        <div className="expert-display">
          <div className="expert-avatar pulsing">
            {callerAvatar ? (
              <img src={callerAvatar} alt={callerName} />
            ) : (
              <span className="initials">{callerName?.[0] || '?'}</span>
            )}
          </div>

          <div className="expert-details-text">
            <h2>{callerName}</h2>
            <p className="specialization">Incoming Call</p>
            <p className="status-label">Incoming...</p>
          </div>
        </div>

        <div className="call-controls-footer">
          <button 
            className="control-btn end-call-btn" 
            onClick={() => handleReject()}
            disabled={rejecting}
          >
            <div className="icon-circle">
              <FontAwesomeIcon icon={faPhoneSlash} />
            </div>
            <span className="btn-label">
              {rejecting ? 'Declining...' : 'Reject'}
            </span>
          </button>

          <button 
            className="control-btn accept-call-btn" 
            onClick={handleAccept}
            disabled={accepting}
          >
            <div className="icon-circle">
              <FontAwesomeIcon icon={faPhone} />
            </div>
            <span className="btn-label">
              {accepting ? 'Accepting...' : 'Accept'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
