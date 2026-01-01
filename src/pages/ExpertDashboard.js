import { useCallback, useEffect, useState } from 'react';
import { BiRupee } from 'react-icons/bi';
import { FaBriefcase, FaLightbulb, FaLinkedin, FaPhone, FaStar, FaWallet } from 'react-icons/fa';
import { FiCheck, FiLink, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-toastify';
import DashboardLayout from '../components/DashboardLayout';
import API_URL, { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './ExpertDashboard.css';

const ExpertDashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [expert, setExpert] = useState(null);
  const [stats, setStats] = useState({
    totalCalls: 0,
    experience: 0,
    totalEarnings: 0,
    unclaimedEarnings: 0
  });
  const [recentCalls, setRecentCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linkedinSyncing, setLinkedinSyncing] = useState(false);

  const fetchExpertStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');

      // Get expert profile
      const expertRes = await axios.get(`/api/experts/user/${user._id}`, {
        headers: { 'x-auth-token': token }
      });
      setExpert(expertRes.data);

      // Get earnings
      const earningsRes = await axios.get('/api/experts/earnings', {
        headers: { 'x-auth-token': token }
      });

      setStats({
        totalCalls: earningsRes.data.totalCalls,
        experience: expertRes.data.experience || 0,
        totalEarnings: earningsRes.data.tokensEarned,
        unclaimedEarnings: earningsRes.data.unclaimedTokens
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching expert stats:', error);
      setLoading(false);
    }
  }, [user._id]);

  const fetchRecentCalls = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/calls/expert-history?limit=5', {
        headers: { 'x-auth-token': token }
      });
      // Filter only completed calls for display in sessions
      const completedCalls = res.data.calls.filter(call => call.status === 'completed');
      setRecentCalls(completedCalls);
    } catch (error) {
      console.error('Error fetching recent calls:', error);
      setRecentCalls([]);
    }
  }, []);

  useEffect(() => {
    fetchExpertStats();
    fetchRecentCalls();
  }, [fetchExpertStats, fetchRecentCalls]);

  // Listen for expert status changes from socket
  useEffect(() => {
    if (socket && expert) {
      const handleStatusChange = (data) => {
        if (data.expertId === expert._id) {
          console.log('🔄 Expert status updated via socket:', data);
          setExpert(prev => ({ ...prev, isOnline: data.isOnline }));
        }
      };

      socket.on('expert_status_changed', handleStatusChange);

      return () => {
        socket.off('expert_status_changed', handleStatusChange);
      };
    }
  }, [socket, expert]);

  const toggleOnlineStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const newStatus = !expert.isOnline;

      await axios.put('/api/experts/toggle-online',
        {},
        { headers: { 'x-auth-token': token } }
      );

      setExpert({ ...expert, isOnline: newStatus });

      if (socket) {
        socket.emit('expert-status-change', { expertId: expert._id, isOnline: newStatus });
      }

      toast.success(`You are now ${newStatus ? 'online' : 'offline'}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleClaimTokens = async () => {
    if (stats.unclaimedEarnings <= 0) {
      toast.info('No earnings to claim');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/experts/claim-tokens', {}, {
        headers: { 'x-auth-token': token }
      });

      setStats({
        ...stats,
        unclaimedEarnings: 0
      });
      setExpert({
        ...expert,
        unclaimedTokens: 0,
        tokensClaimed: res.data.tokensClaimed
      });

      toast.success(`Successfully claimed ₹${res.data.claimedAmount}!`);
    } catch (error) {
      toast.error(error.response?.data?.msg || 'Failed to claim earnings');
    }
  };

  const handleLinkedInConnect = () => {
    window.location.href = `${API_URL}/api/auth/linkedin?role=expert&sync=true`;
  };

  const handleLinkedInSync = async () => {
    setLinkedinSyncing(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/experts/sync-linkedin', {}, {
        headers: { 'x-auth-token': token }
      });
      toast.success('LinkedIn profile synced successfully!');
      fetchExpertStats();
    } catch (error) {
      toast.error('Failed to sync LinkedIn profile');
    } finally {
      setLinkedinSyncing(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <DashboardLayout title="Expert Dashboard">
        <div className="expert-dashboard-content">
          {/* Skeleton Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card skeleton">
              <div className="stat-icon-wrapper skeleton"></div>
              <div className="stat-info">
                <div className="stat-value skeleton skeleton-text"></div>
                <div className="stat-label skeleton skeleton-text"></div>
              </div>
            </div>
            <div className="stat-card skeleton">
              <div className="stat-icon-wrapper skeleton"></div>
              <div className="stat-info">
                <div className="stat-value skeleton skeleton-text"></div>
                <div className="stat-label skeleton skeleton-text"></div>
              </div>
            </div>
            <div className="stat-card skeleton">
              <div className="stat-icon-wrapper skeleton"></div>
              <div className="stat-info">
                <div className="stat-value skeleton skeleton-text"></div>
                <div className="stat-label skeleton skeleton-text"></div>
              </div>
            </div>
            <div className="stat-card skeleton">
              <div className="stat-icon-wrapper skeleton"></div>
              <div className="stat-info">
                <div className="stat-value skeleton skeleton-text"></div>
                <div className="stat-label skeleton skeleton-text"></div>
              </div>
            </div>
          </div>

          {/* Skeleton Dashboard Grid */}
          <div className="dashboard-grid">
            <div className="dashboard-card profile-card skeleton">
              <div className="skeleton skeleton-title"></div>
              <div className="profile-details">
                <div className="detail-row skeleton">
                  <div className="detail-label skeleton skeleton-text"></div>
                  <div className="detail-value skeleton skeleton-text"></div>
                </div>
                <div className="detail-row skeleton">
                  <div className="detail-label skeleton skeleton-text"></div>
                  <div className="detail-value skeleton skeleton-text"></div>
                </div>
                <div className="detail-row skeleton">
                  <div className="detail-label skeleton skeleton-text"></div>
                  <div className="detail-value skeleton skeleton-text"></div>
                </div>
              </div>
            </div>

            <div className="dashboard-card calls-card skeleton">
              <div className="skeleton skeleton-title"></div>
              <div className="calls-list">
                <div className="call-item skeleton">
                  <div className="call-item-info">
                    <div className="caller-name skeleton skeleton-text"></div>
                    <div className="call-date skeleton skeleton-text"></div>
                  </div>
                  <div className="call-item-stats">
                    <div className="call-earning skeleton skeleton-text"></div>
                  </div>
                </div>
                <div className="call-item skeleton">
                  <div className="call-item-info">
                    <div className="caller-name skeleton skeleton-text"></div>
                    <div className="call-date skeleton skeleton-text"></div>
                  </div>
                  <div className="call-item-stats">
                    <div className="call-earning skeleton skeleton-text"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Expert Dashboard" expert={expert} onToggleOnline={toggleOnlineStatus}>
      <div className="expert-dashboard-content">

        <div className="stats-grid">
          <div className="stat-card calls-stat">
            <div className="stat-icon-wrapper calls">
              <FaPhone className="stat-icon" />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.totalCalls}</span>
              <span className="stat-label">Total Calls</span>
            </div>
          </div>

          <div className="stat-card experience-stat">
            <div className="stat-icon-wrapper experience">
              <FaBriefcase className="stat-icon" />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.experience}</span>
              <span className="stat-label">Years Experience</span>
            </div>
          </div>

          <div className="stat-card earnings-stat">
            <div className="stat-icon-wrapper earnings">
              <FaStar className="stat-icon" />
            </div>
            <div className="stat-info">
              <span className="stat-value"><BiRupee className="token-icon" /> {stats.totalEarnings}</span>
              <span className="stat-label">Total Earnings</span>
            </div>
          </div>

          <div className="stat-card claim-card" onClick={handleClaimTokens}>
            <div className="stat-icon-wrapper unclaimed">
              <FaWallet className="stat-icon" />
            </div>
            <div className="stat-info">
              <span className="stat-value"><BiRupee className="token-icon" /> {stats.unclaimedEarnings}</span>
              <span className="stat-label">Unclaimed Earnings</span>
              {stats.unclaimedEarnings > 0 && (
                <button className="claim-btn">Claim Now</button>
              )}
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card profile-card" style={{ maxHeight: '320px', overflowY: 'auto' }}>
            <h2>Profile Info</h2>
            <div className="profile-details">
              <div className="detail-row">
                <span className="detail-label">Name</span>
                <span className="detail-value">{expert?.user?.name || user?.name || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Category</span>
                <span className="detail-value">{expert?.categories?.[0]?.name || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Rate</span>
                <span className="detail-value"><BiRupee className="token-icon" /> {expert?.tokensPerMinute || 0}/min</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Rating</span>
                <span className="detail-value"><FaStar className="star-icon" /> {expert?.rating?.toFixed(1) || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="dashboard-card linkedin-card" style={{ maxHeight: '320px', overflowY: 'auto' }}>
            <h2><FaLinkedin className="linkedin-icon" /> LinkedIn Integration</h2>
            <div className="linkedin-content">
              {expert?.linkedinId ? (
                <div className="linkedin-connected">
                  <div className="linkedin-status">
                    <FiCheck className="check-icon" />
                    <span>LinkedIn Connected</span>
                  </div>
                  <p className="linkedin-info">Your profile is linked with LinkedIn</p>
                  <button
                    className="sync-btn"
                    onClick={handleLinkedInSync}
                    disabled={linkedinSyncing}
                  >
                    {linkedinSyncing ? (
                      <>
                        <FiRefreshCw className="spinning" /> Syncing...
                      </>
                    ) : (
                      <>
                        <FiRefreshCw /> Sync Profile
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="linkedin-not-connected">
                  <FiLink className="link-icon" />
                  <p>Connect your LinkedIn to auto-fill your professional details</p>
                  <button className="connect-linkedin-btn" onClick={handleLinkedInConnect}>
                    <FaLinkedin /> Connect LinkedIn
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="dashboard-card calls-card" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <h2>Recent Sessions</h2>
            {recentCalls.length === 0 ? (
              <p className="no-calls">No completed calls yet. Calls will appear here once accepted and completed.</p>
            ) : (
              <div className="calls-list">
                {recentCalls.map((call) => (
                  <div key={call._id} className="call-item">
                    <div className="call-info">
                      <span className="caller-name">
                        {call.caller?.name || 'Unknown'}
                      </span>
                      <span className="call-date">
                        {call.createdAt ? new Date(call.createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="call-details">
                      <span className="call-duration">{formatDuration(call.duration || 0)}</span>
                      <span className="call-tokens"><BiRupee className="token-icon" /> {call.tokensSpent || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-tips">
          <h3><FaLightbulb className="tip-icon" /> Tips for Success</h3>
          <ul>
            <li>Stay online during peak hours to receive more calls</li>
            <li>Respond promptly to incoming calls</li>
            <li>Provide quality guidance to get better ratings</li>
            <li>Claim your tokens regularly</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ExpertDashboard;
