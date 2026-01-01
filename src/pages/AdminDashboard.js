import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiUsers,
  FiUser,
  FiPhone,
  FiShield,
  FiRefreshCw,
  FiUserCheck,
  FiSearch,
  FiCheckCircle,
  FiXCircle,
  FiLock,
  FiUnlock,
  FiTrash2,
  FiAlertCircle,
  FiClock,
  FiSlash,
  FiActivity
} from 'react-icons/fi';
import { BiRupee } from 'react-icons/bi';
import DashboardLayout from '../components/DashboardLayout';
import { axiosInstance as axios } from '../config/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const location = useLocation();

  // Get active tab from URL
  const getTabFromPath = useCallback(() => {
    const path = location.pathname;
    if (path.includes('/admin/users')) return 'users';
    if (path.includes('/admin/experts')) return 'experts';
    if (path.includes('/admin/calls')) return 'calls';
    if (path.includes('/admin/settings')) return 'settings';
    return 'overview';
  }, [location.pathname]);

  const [activeTab, setActiveTab] = useState(getTabFromPath());
  const [statistics, setStatistics] = useState(null);
  const [users, setUsers] = useState([]);
  const [experts, setExperts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [expertFilter, setExpertFilter] = useState('all');

  useEffect(() => {
    setActiveTab(getTabFromPath());
  }, [getTabFromPath]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, usersRes, expertsRes] = await Promise.all([
        axios.get('/api/users/admin/statistics', { headers }),
        axios.get('/api/users/admin/all', { headers }),
        axios.get('/api/experts/admin/all', { headers })
      ]);

      setStatistics(statsRes.data);
      setUsers(usersRes.data);
      setExperts(expertsRes.data);
    } catch (error) {
      console.error('Fetch admin data error:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const updateUserStatus = async (userId, status, reason = '') => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(
        `/api/users/admin/${userId}/status`,
        { status, statusReason: reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUsers(users.map(u => (u._id === userId ? res.data.user : u)));
      toast.success(res.data.message);
    } catch (error) {
      console.error('Update user status error:', error);
      toast.error('Failed to update user status');
    }
  };

  const toggleVerification = async (expertId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(
        `/api/experts/admin/${expertId}/verify`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setExperts(experts.map(exp => (exp._id === expertId ? res.data.expert : exp)));
      toast.success(res.data.message);
    } catch (error) {
      console.error('Toggle verification error:', error);
      toast.error('Failed to update verification status');
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/users/admin/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setUsers(users.filter(u => u._id !== userId));
      toast.success('User deleted successfully');
    } catch (error) {
      console.error('Delete user error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const syncExpertBusyStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        '/api/experts/admin/sync-busy-status',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`Status synced! ${res.data.updates.length} experts updated`);
      fetchData();
    } catch (error) {
      console.error('Sync status error:', error);
      toast.error(error.response?.data?.message || 'Failed to sync status');
    }
  };

  const deleteExpert = async (expertId) => {
    if (!window.confirm('Are you sure you want to delete this expert? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/experts/admin/${expertId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setExperts(experts.filter(exp => exp._id !== expertId));
      toast.success('Expert deleted successfully');
    } catch (error) {
      console.error('Delete expert error:', error);
      toast.error('Failed to delete expert');
    }
  };

  const approveExpert = async (expertId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(
        `/api/experts/admin/${expertId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setExperts(experts.map(exp => (exp._id === expertId ? res.data.expert : exp)));
      toast.success(res.data.message || 'Expert approved successfully');
    } catch (error) {
      console.error('Approve expert error:', error);
      toast.error(error.response?.data?.message || 'Failed to approve expert');
    }
  };

  const rejectExpert = async (expertId) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason || reason.trim() === '') {
      toast.error('Rejection reason is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(
        `/api/experts/admin/${expertId}/reject`,
        { rejectionReason: reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setExperts(experts.map(exp => (exp._id === expertId ? res.data.expert : exp)));
      toast.success(res.data.message || 'Expert rejected successfully');
    } catch (error) {
      console.error('Reject expert error:', error);
      toast.error(error.response?.data?.message || 'Failed to reject expert');
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: { icon: <FiCheckCircle />, class: 'active', text: 'Active' },
      blocked: { icon: <FiLock />, class: 'blocked', text: 'Blocked' },
      suspended: { icon: <FiSlash />, class: 'suspended', text: 'Suspended' }
    };
    const badge = badges[status] || badges.active;
    return (
      <span className={`status-badge ${badge.class}`}>
        {badge.icon} {badge.text}
      </span>
    );
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());

    if (userFilter === 'active') return matchesSearch && user.status === 'active';
    if (userFilter === 'blocked') return matchesSearch && user.status === 'blocked';
    if (userFilter === 'suspended') return matchesSearch && user.status === 'suspended';
    if (userFilter === 'users') return matchesSearch && user.role === 'user';
    if (userFilter === 'experts') return matchesSearch && user.role === 'expert';
    return matchesSearch;
  });

  const filteredExperts = experts.filter(expert => {
    const matchesSearch = expert.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expert.title?.toLowerCase().includes(searchTerm.toLowerCase());

    if (expertFilter === 'verified') return matchesSearch && expert.isVerified;
    if (expertFilter === 'unverified') return matchesSearch && !expert.isVerified;
    if (expertFilter === 'online') return matchesSearch && expert.isOnline;
    if (expertFilter === 'pending') return matchesSearch && !expert.isApproved;
    if (expertFilter === 'approved') return matchesSearch && expert.isApproved;
    return matchesSearch;
  });

  if (loading || !statistics) {
    return (
      <DashboardLayout title="Admin Dashboard">
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Admin Dashboard">
      <div className="admin-dashboard">
        <div className="container">
          {/* Header */}
          <div className="admin-header">
            <div className="header-content">
              <h1><FiShield /> Admin Dashboard</h1>
              <p>Comprehensive platform management and analytics</p>
            </div>
            <button onClick={fetchData} className="refresh-btn">
              <FiRefreshCw /> Refresh
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="admin-tabs">
            <button
              className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <FiActivity /> Overview
            </button>
            <button
              className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <FiUsers /> Users ({users.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'experts' ? 'active' : ''}`}
              onClick={() => setActiveTab('experts')}
            >
              <FiUser /> Experts ({experts.length})
            </button>
          </div>

          {/* Admin Actions */}
          <div className="admin-actions">
            <h2><FiShield /> Admin Actions</h2>
            <div className="actions-grid">
              <div>
                <button onClick={syncExpertBusyStatus} className="sync-btn">
                  <FiRefreshCw /> Sync Expert Busy Status
                </button>
                <p className="action-description">
                  Synchronize expert busy status with active socket connections. This ensures the database matches real-time call states and prevents experts from being stuck as busy.
                </p>
              </div>
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* Statistics Cards */}
              <div className="stats-grid">
                <div className="stat-card primary">
                  <div className="stat-icon">
                    <FiUsers />
                  </div>
                  <div className="stat-details">
                    <span className="stat-value">{statistics.totalUsers}</span>
                    <span className="stat-label">Total Users</span>
                  </div>
                </div>

                <div className="stat-card success">
                  <div className="stat-icon">
                    <FiUser />
                  </div>
                  <div className="stat-details">
                    <span className="stat-value">{statistics.totalExperts}</span>
                    <span className="stat-label">Total Experts</span>
                  </div>
                </div>

                <div className="stat-card warning">
                  <div className="stat-icon">
                    <FiPhone />
                  </div>
                  <div className="stat-details">
                    <span className="stat-value">{statistics.totalCalls}</span>
                    <span className="stat-label">Total Calls</span>
                  </div>
                </div>

                <div className="stat-card accent">
                  <div className="stat-icon">
                    <BiRupee />
                  </div>
                  <div className="stat-details">
                    <span className="stat-value">{statistics.totalRevenue}</span>
                    <span className="stat-label">Total Revenue (₹)</span>
                  </div>
                </div>

                <div className="stat-card info">
                  <div className="stat-icon">
                    <FiCheckCircle />
                  </div>
                  <div className="stat-details">
                    <span className="stat-value">{statistics.verifiedExperts}</span>
                    <span className="stat-label">Verified Experts</span>
                  </div>
                </div>

                <div className="stat-card online">
                  <div className="stat-icon">
                    <FiUserCheck />
                  </div>
                  <div className="stat-details">
                    <span className="stat-value">{statistics.onlineUsers}</span>
                    <span className="stat-label">Online Now</span>
                  </div>
                </div>
              </div>

              {/* Status Overview */}
              <div className="status-overview card">
                <h2><FiAlertCircle /> User Status Overview</h2>
                <div className="status-bars">
                  <div className="status-bar">
                    <div className="status-bar-label">
                      <span>Active Users</span>
                      <span className="status-bar-value">{statistics.activeUsers}</span>
                    </div>
                    <div className="status-bar-track">
                      <div
                        className="status-bar-fill active"
                        style={{
                          width: `${(statistics.activeUsers / users.length) * 100}%`
                        }}
                      />
                    </div>
                  </div>

                  <div className="status-bar">
                    <div className="status-bar-label">
                      <span>Blocked Users</span>
                      <span className="status-bar-value">{statistics.blockedUsers}</span>
                    </div>
                    <div className="status-bar-track">
                      <div
                        className="status-bar-fill blocked"
                        style={{
                          width: `${(statistics.blockedUsers / users.length) * 100}%`
                        }}
                      />
                    </div>
                  </div>

                  <div className="status-bar">
                    <div className="status-bar-label">
                      <span>Suspended Users</span>
                      <span className="status-bar-value">{statistics.suspendedUsers}</span>
                    </div>
                    <div className="status-bar-track">
                      <div
                        className="status-bar-fill suspended"
                        style={{
                          width: `${(statistics.suspendedUsers / users.length) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="recent-activity card">
                <h2><FiClock /> Recent Users</h2>
                <div className="activity-list">
                  {statistics.recentUsers.map(user => (
                    <div key={user._id} className="activity-item">
                      <div className="activity-avatar">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} />
                        ) : (
                          <span>{getInitials(user.name)}</span>
                        )}
                      </div>
                      <div className="activity-info">
                        <span className="activity-name">{user.name}</span>
                        <span className="activity-email">{user.email}</span>
                      </div>
                      <span className="activity-role">{user.role}</span>
                      {getStatusBadge(user.status)}
                      <span className="activity-date">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <>
              <div className="admin-filters card">
                <div className="search-box">
                  <FiSearch className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="filter-buttons">
                  <button
                    className={`filter-btn ${userFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setUserFilter('all')}
                  >
                    All ({users.length})
                  </button>
                  <button
                    className={`filter-btn ${userFilter === 'active' ? 'active' : ''}`}
                    onClick={() => setUserFilter('active')}
                  >
                    <FiCheckCircle /> Active
                  </button>
                  <button
                    className={`filter-btn ${userFilter === 'blocked' ? 'active' : ''}`}
                    onClick={() => setUserFilter('blocked')}
                  >
                    <FiLock /> Blocked
                  </button>
                  <button
                    className={`filter-btn ${userFilter === 'suspended' ? 'active' : ''}`}
                    onClick={() => setUserFilter('suspended')}
                  >
                    <FiSlash /> Suspended
                  </button>
                </div>
              </div>

              <div className="data-table card">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Balance</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user._id}>
                        <td data-label="User">
                          <div className="user-cell">
                            <div className="user-avatar">
                              {user.avatar ? (
                                <img src={user.avatar} alt={user.name} />
                              ) : (
                                <span>{getInitials(user.name)}</span>
                              )}
                            </div>
                            <div className="user-info">
                              <span className="user-name">{user.name}</span>
                              <span className="user-email">{user.email}</span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Role">
                          <span className={`role-badge ${user.role}`}>
                            {user.role}
                          </span>
                        </td>
                        <td data-label="Balance">
                          <span className="tokens-display">
                            <BiRupee /> {user.tokens}
                          </span>
                        </td>
                        <td data-label="Status">{getStatusBadge(user.status)}</td>
                        <td data-label="Joined">{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td data-label="Actions">
                          <div className="action-buttons">
                            {user.role !== 'admin' && (
                              <>
                                {user.status !== 'active' && (
                                  <button
                                    className="action-btn activate"
                                    onClick={() => updateUserStatus(user._id, 'active')}
                                    title="Activate user"
                                  >
                                    <FiUnlock />
                                  </button>
                                )}
                                {user.status !== 'blocked' && (
                                  <button
                                    className="action-btn block"
                                    onClick={() => {
                                      const reason = prompt('Reason for blocking:');
                                      if (reason) updateUserStatus(user._id, 'blocked', reason);
                                    }}
                                    title="Block user"
                                  >
                                    <FiLock />
                                  </button>
                                )}
                                {user.status !== 'suspended' && (
                                  <button
                                    className="action-btn suspend"
                                    onClick={() => {
                                      const reason = prompt('Reason for suspension:');
                                      if (reason) updateUserStatus(user._id, 'suspended', reason);
                                    }}
                                    title="Suspend user"
                                  >
                                    <FiSlash />
                                  </button>
                                )}
                                <button
                                  className="action-btn delete"
                                  onClick={() => deleteUser(user._id)}
                                  title="Delete user"
                                >
                                  <FiTrash2 />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredUsers.length === 0 && (
                  <div className="no-results">
                    <p>No users found matching your criteria.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Experts Tab */}
          {activeTab === 'experts' && (
            <>
              <div className="admin-filters card">
                <div className="search-box">
                  <FiSearch className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search experts by name or title..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="filter-buttons">
                  <button
                    className={`filter-btn ${expertFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setExpertFilter('all')}
                  >
                    All ({experts.length})
                  </button>
                  <button
                    className={`filter-btn ${expertFilter === 'pending' ? 'active' : ''}`}
                    onClick={() => setExpertFilter('pending')}
                  >
                    <FiClock /> Pending ({experts.filter(e => !e.isApproved).length})
                  </button>
                  <button
                    className={`filter-btn ${expertFilter === 'approved' ? 'active' : ''}`}
                    onClick={() => setExpertFilter('approved')}
                  >
                    <FiCheckCircle /> Approved ({experts.filter(e => e.isApproved).length})
                  </button>
                  <button
                    className={`filter-btn ${expertFilter === 'verified' ? 'active' : ''}`}
                    onClick={() => setExpertFilter('verified')}
                  >
                    <FiCheckCircle /> Verified
                  </button>
                  <button
                    className={`filter-btn ${expertFilter === 'unverified' ? 'active' : ''}`}
                    onClick={() => setExpertFilter('unverified')}
                  >
                    <FiXCircle /> Unverified
                  </button>
                  <button
                    className={`filter-btn ${expertFilter === 'online' ? 'active' : ''}`}
                    onClick={() => setExpertFilter('online')}
                  >
                    <FiUserCheck /> Online
                  </button>
                </div>
              </div>

              <div className="data-table card">
                <table>
                  <thead>
                    <tr>
                      <th>Expert</th>
                      <th>Title</th>
                      <th>Rate</th>
                      <th>Calls</th>
                      <th>Status</th>
                      <th>Approval</th>
                      <th>Verified</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExperts.map(expert => (
                      <tr key={expert._id}>
                        <td data-label="Expert">
                          <div className="user-cell">
                            <div className="user-avatar">
                              {expert.user?.avatar ? (
                                <img src={expert.user.avatar} alt={expert.user?.name} />
                              ) : (
                                <span>{getInitials(expert.user?.name)}</span>
                              )}
                            </div>
                            <div className="user-info">
                              <span className="user-name">{expert.user?.name}</span>
                              <span className="user-email">{expert.user?.email}</span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Title">{expert.title}</td>
                        <td data-label="Rate">
                          <span className="rate-badge">
                            <BiRupee /> {expert.tokensPerMinute}/min
                          </span>
                        </td>
                        <td data-label="Calls">{expert.totalCalls || 0}</td>
                        <td data-label="Status">
                          <span className={`status-badge ${expert.isOnline ? 'online' : 'offline'}`}>
                            {expert.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td data-label="Approval">
                          <span className={`status-badge ${expert.isApproved ? 'approved' : 'pending'}`}>
                            {expert.isApproved ? (
                              <><FiCheckCircle /> Approved</>
                            ) : (
                              <><FiClock /> Pending</>
                            )}
                          </span>
                        </td>
                        <td data-label="Verified">
                          <span className={`verified-status ${expert.isVerified ? 'verified' : 'unverified'}`}>
                            {expert.isVerified ? (
                              <><FiCheckCircle /> Verified</>
                            ) : (
                              <><FiXCircle /> Unverified</>
                            )}
                          </span>
                        </td>
                        <td data-label="Actions">
                          <div className="action-buttons">
                            {!expert.isApproved ? (
                              <>
                                <button
                                  className="action-btn approve"
                                  onClick={() => approveExpert(expert._id)}
                                  title="Approve expert"
                                >
                                  <FiCheckCircle />
                                </button>
                                <button
                                  className="action-btn reject"
                                  onClick={() => rejectExpert(expert._id)}
                                  title="Reject expert"
                                >
                                  <FiXCircle />
                                </button>
                              </>
                            ) : (
                              <button
                                className={`action-btn ${expert.isVerified ? 'unverify' : 'verify'}`}
                                onClick={() => toggleVerification(expert._id)}
                                title={expert.isVerified ? 'Remove verification' : 'Verify expert'}
                              >
                                {expert.isVerified ? <FiXCircle /> : <FiCheckCircle />}
                              </button>
                            )}
                            <button
                              className="action-btn delete"
                              onClick={() => deleteExpert(expert._id)}
                              title="Delete expert"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredExperts.length === 0 && (
                  <div className="no-results">
                    <p>No experts found matching your criteria.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
