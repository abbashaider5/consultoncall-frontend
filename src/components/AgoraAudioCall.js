import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './AgoraAudioCall.css';

const AgoraAudioCall = () => {
  const { activeCall, endCall } = useSocket();
  const { user, updateTokens } = useAuth();
  const [callStatus, setCallStatus] = useState('connecting');
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

    const statusMap = {
      'ringing': 'ringing',
      'accepted': 'connecting',
      'connected': 'connected',
      'ended': 'ended'
    };

    setCallStatus(statusMap[activeCall.status] || 'connecting');
  }, [activeCall?.status]);

  // Initialize Agora client only when call is accepted
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'accepted') {
      return;
    }

    const initAgora = async () => {
      try {
        const AgoraRTC = await import('agora-rtc-sdk-ng');
        
        const client = AgoraRTC.createClient({
          mode: 'rtc',
          codec: 'vp8'
        });

        clientRef.current = client;

        const userType = user?.role === 'expert' ? 'expert' : 'user';
        
        const tokenResponse = await axios.post('/api/agora/rtc-token', {
          callId: activeCall.callId,
          userType
        });

        const { appId, channel, uid, token } = tokenResponse.data;

        await client.join(appId, channel, token, uid);

        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        audioTrackRef.current = audioTrack;

        await client.publish(audioTrack);

        client.on('user-published', async (remoteUser, mediaType) => {
          await client.subscribe(remoteUser, mediaType);
          
          if (mediaType === 'audio') {
            remoteUser.audioTrack.play();
            setCallStatus('connected');
            await startBilling();
          }
        });

        client.on('user-left', (remoteUser) => {
          handleEndCall('Remote user ended call');
        });

        client.on('connection-state-change', (state, reason) => {
          if (state === 'DISCONNECTED') {
            handleEndCall('Connection lost');
          } else if (state === 'CONNECTING') {
            setCallStatus('connecting');
          }
        });

      } catch (error) {
        console.error('Agora initialization error:', error);
        if (!mountedRef.current) return;
        
        toast.error('Failed to connect call. Please try again.');
        setCallStatus('failed');
        handleEndCall('Call initialization failed');
      }
    };

    initAgora();

    return () => {
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
      return;
    }

    if (!activeCall?.callId) {
      return;
    }

    try {
      await axios.put(`/api/calls/connect/${activeCall.callId}`);
      billingStartedRef.current = true;
      startTimer();
    } catch (error) {
      console.error('Error starting billing:', error);
      toast.error('Failed to start billing. Call may not be charged.');
    }
  }, [activeCall?.callId]);

  // Start call timer
  const startTimer = useCallback(() => {
    if (timerRef.current) {
      return;
    }
    
    const startTime = Date.now();
    
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setDuration(elapsed);
      
      if (user?.role === 'user' && activeCall?.tokensPerMinute) {
        const elapsedMinutes = elapsed / 60;
        const estimatedCost = Math.ceil(elapsedMinutes) * activeCall.tokensPerMinute;
        const remainingBalance = (user?.tokens || 0) - estimatedCost;
        
        if (remainingBalance > 0 && remainingBalance <= activeCall.tokensPerMinute) {
          toast.warning('Low balance! ~1 minute remaining', {
            position: 'top-center',
            autoClose: 3000,
            toastId: 'low-balance-warning'
          });
        }
        
        if (remainingBalance <= 0) {
          toast.error('Balance exhausted. Call ending...', {
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
    mountedRef.current = false;
    setCallStatus('ended');
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      if (billingStartedRef.current && activeCall?.callId) {
        const res = await axios.put(`/api/calls/end/${activeCall.callId}`, {
          initiatedBy: user?.role || 'unknown'
        });
        
        if (res.data.success) {
          if (user?.role === 'user') {
            updateTokens(res.data.newBalance);
            toast.success(
              `Call ended. Duration: ${res.data.call.minutes} min, Cost: ${res.data.call.tokensSpent}`,
              { position: 'top-center', autoClose: 5000 }
            );
          } else {
            toast.success(`Call ended. Duration: ${res.data.call.minutes} min`, {
              position: 'top-center', autoClose: 5000
            });
          }
        }
      }
    } catch (error) {
      console.error('Error ending call:', error);
      toast.error('Error ending call. Please refresh if issues persist.');
    } finally {
      cleanup();
      
      if (activeCall?.callId) {
        endCall({ callId: activeCall.callId, initiatedBy: user?.role || 'unknown' });
      }
    }
  }, [activeCall, user, endCall, updateTokens]);

  // Cleanup Agora resources
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (audioTrackRef.current) {
      try {
        audioTrackRef.current.stop();
        audioTrackRef.current.close();
        audioTrackRef.current = null;
      } catch (error) {
        console.error('Error stopping audio track:', error);
      }
    }

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
          toast.info(newMutedState ? 'Microphone muted' : 'Microphone unmuted');
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
        return '#ffc107';
      case 'connecting':
        return '#17a2b8';
      case 'connected':
        return '#28a745';
      case 'ended':
        return '#6c757d';
      case 'failed':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  if (!activeCall) {
    return null;
  }

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
              <span className="rate-value">{activeCall.tokensPerMinute}/min</span>
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
            style={{ opacity: callStatus === 'connected' ? 1 : 0.5 }}
          >
            <div className="icon-circle">
              {isMuted ? 'Muted' : 'Mic'}
            </div>
            <span className="btn-label">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            className="control-btn end-call-btn"
            onClick={() => handleEndCall('User ended call')}
            title="End Call"
          >
            <div className="icon-circle">
              End
            </div>
            <span className="btn-label">End</span>
          </button>

          <button
            className="control-btn"
            disabled={true}
            title="Speaker"
            style={{ opacity: 0.5 }}
          >
            <div className="icon-circle">
              Speaker
            </div>
            <span className="btn-label">Speaker</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgoraAudioCall;
