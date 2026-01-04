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
  const { initiateCall } = useSocket();
  const [loading, setLoading] = useState(false);

  const handleStartCall = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      console.log('🚀 Starting Agora audio call...', { expert, user });

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

      // Notify expert via socket (for incoming call UI only)
      // Actual audio connection will be via Agora
      console.log('📡 Notifying expert via socket...');
      await initiateCall({
        callId: newCallId,
        expertId: expert._id,
        userId: user._id,
        callerInfo: {
          name: user.name,
          avatar: user.avatar
        }
      });

      console.log('✅ Call initiated successfully - AgoraAudioCall will open');
      onClose(); // Close this modal, AgoraAudioCall takes over

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
