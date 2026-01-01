import { useCallback, useEffect, useState } from 'react';
import { BiRupee } from 'react-icons/bi';
import { FiCalendar, FiClock, FiDownload, FiPhone, FiTrendingUp } from 'react-icons/fi';
import { toast } from 'react-toastify';
import DashboardLayout from '../components/DashboardLayout';
import { axiosInstance as axios } from '../config/api';
import './Dashboard.css';

const ExpertEarnings = () => {
  const [earnings, setEarnings] = useState({
    totalEarnings: 0,
    unclaimedEarnings: 0,
    claimedEarnings: 0,
    totalCalls: 0,
    totalMinutes: 0
  });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const fetchEarnings = useCallback(async () => {
    try {
      const res = await axios.get('/api/experts/earnings');
      
      setEarnings({
        totalEarnings: res.data.tokensEarned || 0,
        unclaimedEarnings: res.data.unclaimedTokens || 0,
        claimedEarnings: res.data.tokensClaimed || 0,
        totalCalls: res.data.totalCalls || 0,
        totalMinutes: res.data.totalMinutes || 0
      });
    } catch (error) {
      console.error('Error fetching earnings:', error);
      // Silently fail - backend returns empty data on error
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await axios.get('/api/calls/expert-history?limit=20');
      setTransactions(res.data.calls || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEarnings();
    fetchTransactions();
  }, [fetchEarnings, fetchTransactions]);

  const handleClaim = async () => {
    if (earnings.unclaimedEarnings <= 0) {
      toast.info('No earnings to claim');
      return;
    }

    setClaiming(true);
    try {
      const res = await axios.post('/api/experts/claim-tokens');

      setEarnings(prev => ({
        ...prev,
        unclaimedEarnings: 0,
        claimedEarnings: prev.claimedEarnings + res.data.claimedAmount
      }));

      toast.success(`Successfully claimed ₹${res.data.claimedAmount}!`);
    } catch (error) {
      toast.error(error.response?.data?.msg || 'Failed to claim earnings');
    } finally {
      setClaiming(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <DashboardLayout title="Earnings">
        <div className="earnings-content">
          <div className="page-header">
            <div className="skeleton skeleton-text" style={{width: '200px', height: '32px', marginBottom: '8px'}}></div>
            <div className="skeleton skeleton-text" style={{width: '250px', height: '20px'}}></div>
          </div>

          {/* Earnings Stats Skeleton */}
          <div className="stats-grid">
            <div className="stat-card skeleton">
              <div className="stat-icon-wrapper skeleton" style={{width: '48px', height: '48px', borderRadius: '12px', marginBottom: '12px'}}></div>
              <div className="stat-info">
                <div className="skeleton skeleton-text" style={{width: '80px', height: '24px', marginBottom: '4px'}}></div>
                <div className="skeleton skeleton-text" style={{width: '100px', height: '16px'}}></div>
              </div>
            </div>

            <div className="stat-card skeleton">
              <div className="stat-icon-wrapper skeleton" style={{width: '48px', height: '48px', borderRadius: '12px', marginBottom: '12px'}}></div>
              <div className="stat-info">
                <div className="skeleton skeleton-text" style={{width: '70px', height: '24px', marginBottom: '4px'}}></div>
                <div className="skeleton skeleton-text" style={{width: '120px', height: '16px'}}></div>
              </div>
              <div className="skeleton" style={{width: '100px', height: '36px', borderRadius: '6px'}}></div>
            </div>

            <div className="stat-card skeleton">
              <div className="stat-icon-wrapper skeleton" style={{width: '48px', height: '48px', borderRadius: '12px', marginBottom: '12px'}}></div>
              <div className="stat-info">
                <div className="skeleton skeleton-text" style={{width: '75px', height: '24px', marginBottom: '4px'}}></div>
                <div className="skeleton skeleton-text" style={{width: '90px', height: '16px'}}></div>
              </div>
            </div>

            <div className="stat-card skeleton">
              <div className="stat-icon-wrapper skeleton" style={{width: '48px', height: '48px', borderRadius: '12px', marginBottom: '12px'}}></div>
              <div className="stat-info">
                <div className="skeleton skeleton-text" style={{width: '50px', height: '24px', marginBottom: '4px'}}></div>
                <div className="skeleton skeleton-text" style={{width: '80px', height: '16px'}}></div>
              </div>
            </div>
          </div>

          {/* Transaction History Skeleton */}
          <div className="dashboard-card transactions-card skeleton">
            <div className="card-header-row" style={{marginBottom: '20px'}}>
              <div className="skeleton skeleton-text" style={{width: '180px', height: '24px'}}></div>
            </div>

            <div className="transactions-list">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="transaction-item skeleton">
                  <div className="transaction-info">
                    <div className="skeleton skeleton-text" style={{width: '120px', height: '16px', marginBottom: '4px'}}></div>
                    <div className="skeleton skeleton-text" style={{width: '80px', height: '14px'}}></div>
                  </div>
                  <div className="transaction-amount">
                    <div className="skeleton skeleton-text" style={{width: '60px', height: '16px'}}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Fallback: If analytics are 0 but transactions exist, sum from transactions
  let fallbackTotalEarnings = 0;
  let fallbackTotalCalls = 0;
  let fallbackClaimed = 0;
  if (earnings.totalEarnings === 0 && transactions.length > 0) {
    transactions.forEach(call => {
      if (call.status === 'completed') {
        fallbackTotalEarnings += call.tokensSpent || 0;
        fallbackTotalCalls++;
      }
      if (call.status === 'completed' && call.claimed) {
        fallbackClaimed += call.tokensSpent || 0;
      }
    });
  }
  return (
    <DashboardLayout title="Earnings">
      <div className="earnings-content">
        <div className="page-header">
          <h1>Earnings Overview</h1>
          <p>Track your earnings and claim your money</p>
        </div>

        {/* Earnings Stats */}
        <div className="stats-grid" style={{ maxHeight: '220px', overflowY: 'auto' }}>
          <div className="stat-card earnings-total">
            <FiTrendingUp className="stat-icon" />
            <div className="stat-info">
              <span className="stat-value"><BiRupee /> {parseInt(earnings.totalEarnings, 10) || fallbackTotalEarnings}</span>
              <span className="stat-label">Total Earnings</span>
            </div>
          </div>

          <div className="stat-card earnings-unclaimed">
            <BiRupee className="stat-icon" />
            <div className="stat-info">
              <span className="stat-value"><BiRupee /> {parseInt(earnings.unclaimedEarnings, 10) || 0}</span>
              <span className="stat-label">Available to Claim</span>
            </div>
            {earnings.unclaimedEarnings > 0 && (
              <button 
                className="claim-btn" 
                onClick={handleClaim}
                disabled={claiming}
              >
                {claiming ? 'Claiming...' : 'Claim Now'}
              </button>
            )}
          </div>

          <div className="stat-card earnings-claimed">
            <FiDownload className="stat-icon" />
            <div className="stat-info">
              <span className="stat-value"><BiRupee /> {parseInt(earnings.claimedEarnings, 10) || fallbackClaimed}</span>
              <span className="stat-label">Total Claimed</span>
            </div>
          </div>

          <div className="stat-card">
            <FiPhone className="stat-icon" />
            <div className="stat-info">
              <span className="stat-value">{parseInt(earnings.totalCalls, 10) || fallbackTotalCalls}</span>
              <span className="stat-label">Total Calls</span>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="dashboard-card transactions-card" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <div className="card-header-row">
            <h2>Recent Transactions</h2>
          </div>

          {transactions.length === 0 ? (
            <div className="empty-state">
              <FiPhone className="empty-icon" />
              <h3>No Transactions Yet</h3>
              <p>Your call earnings will appear here</p>
            </div>
          ) : (
            <div className="transactions-list">
              {transactions.map((call) => (
                <div key={call._id} className="transaction-item">
                  <div className="transaction-info">
                    <div className="transaction-avatar">
                      {call.caller?.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="transaction-details">
                      <span className="transaction-name">{call.caller?.name || 'Unknown'}</span>
                      <span className="transaction-meta">
                        <FiCalendar /> {new Date(call.createdAt).toLocaleDateString()}
                        <FiClock /> {formatDuration(call.duration)}
                      </span>
                    </div>
                  </div>
                  <div className="transaction-amount">
                    <span className="amount-value">
                      <BiRupee /> {call.tokensSpent || 0}
                    </span>
                    <span className={`transaction-status ${call.status}`}>
                      {call.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ExpertEarnings;
