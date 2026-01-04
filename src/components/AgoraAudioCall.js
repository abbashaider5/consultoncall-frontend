import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './AgoraAudioCall.css';

const AgoraAudioCall = () => {
  const { activeCall, endCall } = useSocket();
  const { user, updateTokens } = useAuth();
  const [callStatus, setCallStatus] = useState('connecting'); // connecting, ringing, connected, ended, failed
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteUser, setRemoteUser] = useState(null);
  
  const clientRef = useRef(null);
  const audioTrackRef = useRef(null);
  const timerRef = useRef(null);
  const billingStartedRef = useRef(false);
  const mountedRef = useRef(true);

  // Sync status with activeCall
  useEffect(() => {
    if (!activeCall) return;

    // Map SocketContext status to local status
    const statusMap = {
      'ringing': 'ringing',
      'accepted': 'connecting',
      'connected': 'connected',
      'ended': 'ended'
    };

    setCallStatus(statusMap[activeCall.status] || 'connecting');
  }, [activeCall?.status]);

  // Initialize Agora client only when call is accepted
  // CRITICAL: Only join Agora AFTER expert accepts, NOT before
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'accepted') {
      console.log('🔌 Waiting for call to be accepted... current status:', activeCall?.status);
      return;
    }

    console.log('✅ Call accepted, initializing Agora...');

    const initAgora = async () => {
      try {
        console.log('🎤 Initializing Agora client...');
        
        // Dynamically import Agora RTC SDK
        const AgoraRTC = await import('agora-rtc-sdk-ng');
        
        // Create client
        const client = AgoraRTC.createClient({
          mode: 'rtc',
          codec: 'vp8'
        });

        clientRef.current = client;

        // Join channel
        const userType = user?.role === 'expert' ? 'expert' : 'user';
        console.log('📡 Requesting Agora token...', { callId: activeCall.callId, userType });
        
        const tokenResponse = await axios.post('/api/agora/rtc-token', {
          callId: activeCall.callId,
          userType
        });

        const { appId, channel, uid, token } = tokenResponse.data;
        console.log('✅ Agora token received, joining channel...', { channel, uid });

        // Join channel
        await client.join(appId, channel, token, uid);
        console.log('✅ Joined Agora channel successfully');

        // Create local audio track
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        audioTrackRef.current = audioTrack;

        // Publish local track
        await client.publish(audioTrack);
        console.log('✅ Local audio track published');

        // Handle remote users joining
        client.on('user-published', async (remoteUser, mediaType) => {
          console.log('📨 Remote user published:', remoteUser.uid, mediaType);
          
          await client.subscribe(remoteUser, mediaType);
          
          if (mediaType === 'audio') {
            remoteUser.audioTrack.play();
            console.log('✅ Remote audio track playing');
            
            // Update status to connected and start billing
            setCallStatus('connected');
            
            // Notify backend that call is connected (starts billing)
            await startBilling();
          }
        });

        // Handle remote users leaving
        client.on('user-left', (remoteUser) => {
          console.log('👋 Remote user left:', remoteUser.uid);
          handleEndCall('Remote user ended the call');
        });

        // Handle connection state changes
        client.on('connection-state-change', (state, reason) => {
          console.log('🔌 Connection state changed:', state, reason);
          
          if (state === 'DISCONNECTED') {
            console.warn('⚠️ Agora connection lost, ending call');
            handleEndCall('Connection lost');
          } else if (state === 'CONNECTING') {
            setCallStatus('connecting');
          }
        });

        console.log('✅ Agora client initialized successfully');

      } catch (error) {
        console.error('❌ Agora initialization error:', error);
        if (!mountedRef.current) return;
        
        toast.error('Failed to connect call. Please try again.');
        setCallStatus('failed');
        handleEndCall('Call initialization failed');
      }
    };

    initAgora();

    return () => {
      console.log('🧹 Cleaning up Agora resources...');
      cleanup();
    };
  }, [activeCall?.callId, activeCall?.status, user?.role]);

  // Fetch remote user info
  useEffect(() => {
    const fetchRemoteUser = async () => {
      if (!activeCall || !user?.role) return;

      try {
        const remoteUserId = user?.role === 'expert' ? activeCall.userId : activeCall.expertId;
        
        if (!remoteUserId) {
          setRemoteUser({
            name: user?.role === 'expert' ? 'Caller' : 'Expert',
            avatar: null
          });
          return;
        }
        
        const endpoint = user?.role === 'expert' ? `/api/users/${remoteUserId}` : `/api/experts/${remoteUserId}`;
        const res = await axios.get(endpoint);
        
        let userData;
        if (user?.role === 'expert') {
          userData = res.data;
        } else {
          userData = res.data.user || res.data;
        }
        
        setRemoteUser({
          name: userData.name,
          avatar: userData.avatar
        });
      } catch (error) {
        console.error('Error fetching remote user:', error);
        setRemoteUser({
          name: user?.role === 'expert' ? 'Caller' : 'Expert',
          avatar: null
        });
      }
    };

    fetchRemoteUser();
  }, [activeCall, user?.role]);

  // Start billing when call connects
  const startBilling = useCallback(async () => {
    if (billingStartedRef.current) {
      console.log('💰 Billing already started');
      return;
    }

    if (!activeCall?.callId) {
      console.warn('⚠️ No callId for billing');
      return;
    }

    try {
      console.log('💰 Starting billing for call:', activeCall.callId);
      await axios.put(`/api/calls/connect/${activeCall.callId}`);
      billingStartedRef.current = true;
      console.log('✅ Billing started successfully');
      startTimer();
    } catch (error) {
      console.error('❌ Error starting billing:', error);
      toast.error('Failed to start billing. Call may not be charged.');
    }
  }, [activeCall?.callId]);

  // Stop billing
  const stopBilling = useCallback(async () => {
    if (!billingStartedRef.current) {
      console.log('💰 Billing not started, nothing to stop');
      return;
    }

    if (!activeCall?.callId) {
      console.warn('⚠️ No callId to stop billing');
      return;
    }

    try {
      console.log('💰 Stopping billing for call:', activeCall.callId);
      await axios.put(`/api/calls/end/${activeCall.callId}`, {
        initiatedBy: user?.role || 'unknown'
      });
      billingStartedRef.current = false;
      console.log('✅ Billing stopped successfully');
    } catch (error) {
      console.error('❌ Error stopping billing:', error);
      toast.error('Error ending billing. Please contact support.');
    }
  }, [activeCall?.callId, user?.role]);

  // Start call timer
  const startTimer = useCallback(() => {
    if (timerRef.current) {
      console.log('⏱️ Timer already running');
      return;
    }
    
    const startTime = Date.now();
    console.log('⏱️ Starting timer at:', new Date(startTime));
    
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setDuration(elapsed);
      
      // Check balance every second (for users only)
      if (user?.role === 'user' && activeCall?.tokensPerMinute) {
        const elapsedMinutes = elapsed / 60;
        const estimatedCost = Math.ceil(elapsedMinutes) * activeCall.tokensPerMinute;
        const remainingBalance = (user?.tokens || 0) - estimatedCost;
        
        // Warn at 1 minute remaining
        if (remainingBalance > 0 && remainingBalance <= activeCall.tokensPerMinute) {
          toast.warning(`⚠️ Low balance! ~1 minute remaining`, {
            position: 'top-center',
            autoClose: 3000,
            toastId: 'low-balance-warning'
          });
        }
        
        // Auto-disconnect if balance exhausted
        if (remainingBalance <= 0) {
          console.warn('💸 Balance exhausted - ending call');
          toast.error('💰 Balance exhausted. Call ending...', {
            position: 'top-center',
            autoClose: 2000
          });
          handleEndCall('Balance exhausted');
        }
      }
    }, 1000);
  }, [activeCall, user]);

  // End call
  const handleEndCall = useCallback(async (reason = 'Call ended') => {
    console.log('🔚 Ending call:', reason);
    
    // Mark as unmounted to prevent duplicate calls
    mountedRef.current = false;
    
    // Update status
    setCallStatus('ended');
    
    // Stop timer immediately
    if (timerRef.current) {
      console.log('⏱️ Stopping timer');
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      // Stop billing if it was started
      if (billingStartedRef.current) {
        const token = localStorage.getItem('token');
        const res = await axios.put(
          `/api/calls/end/${activeCall.callId}`,
          { initiatedBy: user?.role || 'unknown' },
          { headers: { 'x-auth-token': token } }
        );
        
        if (res.data.success) {
          console.log('✅ Call ended successfully:', res.data);
          
          // Update user tokens
          if (user?.role === 'user') {
            updateTokens(res.data.newBalance);
            toast.success(
              `✅ Call ended. Duration: ${res.data.call.minutes} min, Cost: ₹${res.data.call.tokensSpent}`,
              { position: 'top-center', autoClose: 5000 }
            );
          } else {
            toast.success(`✅ Call ended. Duration: ${res.data.call.minutes} min`, {
              position: 'top-center',
              autoClose: 5000
            });
          }
        }
      } else {
        console.log('ℹ️ Call never connected, no charge');
        toast.info('Call ended. No charge as call did not connect.');
      }
    } catch (error) {
      console.error('❌ Error ending call:', error);
      toast.error('Error ending call. Please refresh if issues persist.');
    } finally {
      // Cleanup Agora
      cleanup();
      
      // Notify socket to clear active call state
      if (activeCall?.callId) {
        endCall({ callId: activeCall.callId, initiatedBy: user?.role || 'unknown' });
      }
    }
  }, [activeCall, user, endCall, updateTokens]);

  // Cleanup Agora resources
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up Agora resources...');
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Cleanup audio track
    if (audioTrackRef.current) {
      try {
        audioTrackRef.current.stop();
        audioTrackRef.current.close();
        audioTrackRef.current = null;
      } catch (error) {
        console.error('Error stopping audio track:', error);
      }
    }

    // Leave channel and cleanup client
    if (clientRef.current) {
      try {
        clientRef.current.leave();
        clientRef.current.removeAllListeners();
        clientRef.current = null;
      } catch (error) {
        console.error('Error leaving Agora channel:', error);
      }
    }
  }, []);

  // Toggle mute
  const toggleMute = async () => {
    if (clientRef.current) {
      try {
        const localAudioTrack = clientRef.current.localAudioTracks[0];
        if (localAudioTrack) {
          const newMutedState = !isMuted;
          await localAudioTrack.setMuted(newMutedState);
          setIsMuted(newMutedState);
          console.log(newMutedState ? '🔇 Microphone muted' : '🎤 Microphone unmuted');
          toast.info(newMutedState ? '🔇 Microphone muted' : '🎤 Microphone unmuted');
        }
      } catch (error) {
        console.error('Error toggling mute:', error);
        toast.error('Failed to toggle microphone');
      }
    }
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get status message
  const getStatusMessage = () => {
    switch (callStatus) {
      case 'ringing':
        return 'Ringing...';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      case 'ended':
        return 'Call Ended';
      case 'failed':
        return 'Call Failed';
      default:
        return '';
    }
  };

  // Get status color
  const getStatusColor = () => {
    switch (callStatus) {
      case 'ringing':
        return '#ffc107'; // Yellow
      case 'connecting':
        return '#17a2b8'; // Blue
      case 'connected':
        return '#28a745'; // Green
      case 'ended':
        return '#6c757d'; // Gray
      case 'failed':
        return '#dc3545'; // Red
      default:
        return '#6c757d';
    }
  };

  // Don't render if no active call
  if (!activeCall) {
    console.log('🚫 No active call, not rendering AgoraAudioCall');
    return null;
  }

  console.log('✅ Rendering AgoraAudioCall with status:', callStatus);

  return (
    <div className="agora-audio-call-overlay">
      <div className="agora-audio-call-modal">
        {/* Status Badge */}
        <div className="call-status-badge">
          <div className="status-dot" style={{ backgroundColor: getStatusColor() }}></div>
          <span className="status-text">{getStatusMessage()}</span>
        </div>

        {/* User Section */}
        <div className="call-user-section">
          <div className="user-avatar-wrapper">
            {remoteUser?.avatar ? (
              <img src={remoteUser.avatar} alt={remoteUser.name} className="user-avatar" />
            ) : (
              <div className="user-avatar initials">
                {remoteUser?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
              </div>
            )}
            {(callStatus === 'ringing' || callStatus === 'connecting') && <div className="avatar-pulse"></div>}
            {callStatus === 'connected' && (
              <div className="audio-indicator">
                <div className="audio-wave"></div>
                <div className="audio-wave"></div>
                <div className="audio-wave"></div>
              </div>
            )}
          </div>
          
          <h2 className="user-name">{remoteUser?.name || 'Loading...'}</h2>
          <p className="user-title">
            {user?.role === 'expert' ? 'Customer Call' : 'Expert Consultation'}
          </p>
        </div>

        {/* Call Info */}
        <div className="call-info-section">
          {user?.role === 'user' && activeCall?.tokensPerMinute && (
            <div className="call-rate-badge">
              <span className="rate-label">Rate:</span>
              <span className="rate-value">₹{activeCall.tokensPerMinute}/min</span>
            </div>
          )}

          {callStatus === 'connected' && (
            <div className="call-duration">{formatDuration(duration)}</div>
          )}
        </div>

        {/* Connecting Animation */}
        {(callStatus === 'ringing' || callStatus === 'connecting') && (
          <div className="call-connecting">
            <div className="connecting-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="call-controls-footer">
          <button
            className={`control-btn ${isMuted ? 'active-state' : ''}`}
            onClick={toggleMute}
            disabled={callStatus !== 'connected'}
            title={isMuted ? 'Unmute' : 'Mute'}
            style={{ opacity: callStatus === 'connected' ? 1 : 0.5, cursor: callStatus === 'connected' ? 'pointer' : 'not-allowed' }}
          >
            <div className="icon-circle">
              {isMuted ? '🎤' : '🔇'}
            </div>
            <span className="btn-label">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            className="control-btn end-call-btn"
            onClick={() => handleEndCall('User ended call')}
            title="End Call"
          >
            <div className="icon-circle">
              📞
            </div>
            <span className="btn-label">End</span>
          </button>

          <button
            className="control-btn"
            disabled={true}
            title="Speaker"
            style={{ opacity: 0.5, cursor: 'not-allowed' }}
          >
            <div className="icon-circle">
              🔊
            </div>
            <span className="btn-label">Speaker</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgoraAudioCall;
