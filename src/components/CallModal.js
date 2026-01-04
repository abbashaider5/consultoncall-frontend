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
  const { socket, isConnected } = useSocket();
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

      // Check socket connection
      if (!socket || !isConnected) {
        toast.error('Not connected to server. Please wait...');
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

      // Emit incoming_call to expert ONLY (NOT setting activeCall yet)
      console.log('📡 Emitting incoming_call to expert:', expert._id);
      socket.emit('incoming_call', {
        callId: newCallId,
        userId: user._id,
        expertId: expert._id,
        caller: {
          name: user.name,
          avatar: user.avatar
        }
      });

      console.log('✅ Incoming call sent to expert - waiting for acceptance');
      onClose(); // Close this modal
      
      // Show "Calling..." toast
      toast.info(`📞 Calling ${expert.user?.name}...`, {
        position: 'top-center',
        autoClose: false,
        toastId: 'calling-toast',
        closeOnClick: false
      });

      // Listen for call_accepted response
      socket.once('call_accepted', (data) => {
        console.log('✅ Expert accepted call:', data);
        toast.dismiss('calling-toast');
        toast.success('Call accepted! Connecting...', { position: 'top-center' });
        // SocketContext will handle setting activeCall
      });

      // Listen for call_rejected response
      socket.once('call_rejected', (data) => {
        console.log('❌ Expert rejected call:', data);
        toast.dismiss('calling-toast');
        toast.error(data.reason || 'Call declined', { position: 'top-center' });
      });

      // Listen for call_timeout response
      socket.once('call_timeout', (data) => {
        console.log('⏱️ Call timeout:', data);
        toast.dismiss('calling-toast');
        toast.error('Call timed out. Expert did not respond.', { position: 'top-center' });
      });

    } catch (error) {
      console.error('❌ Start call error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Call failed. Please try again.';
      toast.error(errorMessage);
      toast.dismiss('calling-toast');
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
