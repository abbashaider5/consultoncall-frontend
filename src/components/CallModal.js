import { useState } from 'react';
import { FiPhone, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './CallModal.css';
import VerifiedBadge from './VerifiedBadge';

const CallModal = ({ expert, onClose }) => {
  const { user } = useAuth();
  const { initiateCall, isConnected, connectionError, canExpertReceiveCall, isExpertOnline, isExpertBusy } = useSocket();
  const [loading, setLoading] = useState(false);

  const handleStartCall = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      console.log('🚀 Starting call flow...', { expert, user });

      // Check if user's socket is connected
      if (!isConnected) {
        console.error('❌ Socket not connected:', connectionError);
        toast.error('Connection lost. Please refresh the page.');
        setLoading(false);
        return;
      }

      // Check expert's real-time socket status BEFORE initiating call
      const expertCanReceive = canExpertReceiveCall(expert._id);
      const expertIsOnline = isExpertOnline(expert._id);
      const expertIsBusy = isExpertBusy(expert._id);

      console.log('🔍 Expert socket status check:', {
        expertId: expert._id,
        canReceive: expertCanReceive,
        isOnline: expertIsOnline,
        isBusy: expertIsBusy
      });

      if (!expertIsOnline) {
        console.error('❌ Expert is offline (not connected to socket server)');
        toast.error('Expert is currently offline. Please try again later.');
        setLoading(false);
        return;
      }

      if (expertIsBusy) {
        console.error('❌ Expert is busy on another call');
        toast.error('Expert is currently on another call. Please try again later.');
        setLoading(false);
        return;
      }

      // Check user balance
      const minTokens = (expert.tokensPerMinute || 0) * 5;
      if ((user.tokens || 0) < minTokens) {
        toast.error(`Insufficient balance. Minimum ₹${minTokens} required.`);
        setLoading(false);
        return;
      }

      // Create call in database
      console.log('📞 Creating call in database...');
      const res = await axios.post('/api/calls/initiate', {
        expertId: expert._id
      });

      console.log('✅ Call created in DB:', res.data);
      const newCallId = res.data.call.id;

      // Emit call:initiate to socket server
      // This will trigger ActiveCallModal via SocketContext state update
      console.log('📡 Emitting call:initiate...');
      const ack = await initiateCall({
        callId: newCallId,
        expertId: expert._id,
        userId: user._id,
        callerInfo: {
          name: user.name,
          avatar: user.avatar
        }
      });

      if (ack && ack.success === false) {
        throw new Error(ack.error || 'Call initiation failed');
      }

      console.log('✅ Call initiated successfully');
      onClose(); // Close this modal, ActiveCallModal takes over

    } catch (error) {
      console.error('❌ Start call error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Call failed. Please try again.';
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  if (!expert || !expert.user) return null;

  return (
    <div className="call-modal-overlay">
      <div className="call-modal-content confirmation-mode">
        <button className="close-btn" onClick={onClose} disabled={loading}>
          <FiX />
        </button>

        <div className="expert-display">
          <div className="expert-avatar large">
            {expert.user?.avatar ? (
              <img src={expert.user.avatar} alt={expert.user?.name} />
            ) : (
              <span className="initials">{expert.user?.name?.[0] || 'E'}</span>
            )}
          </div>

          <div className="expert-details-text">
            <div className="name-row">
              <h2>{expert.user?.name}</h2>
              {expert.isVerified && <VerifiedBadge size="medium" />}
            </div>
            <p className="specialization">{expert.title}</p>
          </div>
        </div>

        <div className="call-info-card">
          <div className="info-row">
            <span>Rate</span>
            <span className="value">₹{expert.tokensPerMinute}/min</span>
          </div>
          <div className="info-row">
            <span>Your Balance</span>
            <span className="value">₹{user?.tokens || 0}</span>
          </div>
          <div className="info-row">
            <span>Max Duration</span>
            <span className="value">
              {Math.floor((user?.tokens || 0) / (expert.tokensPerMinute || 1))} mins
            </span>
          </div>
        </div>

        <div className="action-buttons">
          <button 
            className="cancel-btn" 
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            className="confirm-call-btn" 
            onClick={handleStartCall}
            disabled={loading}
          >
            {loading ? (
              <span className="spinner-small"></span>
            ) : (
              <>
                <FiPhone /> Start Call
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallModal;
