import { useState } from 'react';
import { BiRupee } from 'react-icons/bi';
import { FaLinkedin } from 'react-icons/fa';
import {
    FiBarChart2,
    FiClock,
    FiDollarSign,
    FiEdit,
    FiGrid,
    FiHome,
    FiList,
    FiLogOut,
    FiMenu,
    FiMessageSquare,
    FiPhone,
    FiSettings,
    FiUsers,

    FiX
} from 'react-icons/fi';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useAuth } from '../context/AuthContext';
import './DashboardLayout.css';

const DashboardLayout = ({ children, title, expert, onToggleOnline }) => {
  const { user, logout, isExpert } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const userMenuItems = [
    { path: '/dashboard', icon: FiGrid, label: 'Dashboard' },
    { path: '/chat', icon: FiMessageSquare, label: 'Messages' },
    { path: '/call-history', icon: FiClock, label: 'Call History' },
    { path: '/transactions', icon: FiList, label: 'Transactions' },
    { path: '/add-money', icon: FiDollarSign, label: 'Add Money' },
    { path: '/edit-profile', icon: FiEdit, label: 'Edit Profile' },
  ];

  const expertMenuItems = [
    { path: '/expert-dashboard', icon: FiGrid, label: 'Dashboard' },
    { path: '/chat', icon: FiMessageSquare, label: 'Messages' },
    { path: '/call-history', icon: FiClock, label: 'Sessions' },
    { path: '/edit-profile', icon: FiEdit, label: 'Edit Profile' },
    { path: '/expert-earnings', icon: FiDollarSign, label: 'Earnings' },
  ];

  const adminMenuItems = [
    { path: '/admin', icon: FiGrid, label: 'Overview' },
    { path: '/admin/users', icon: FiUsers, label: 'Users' },
    { path: '/admin/experts', icon: FiBarChart2, label: 'Experts' },
    { path: '/admin/calls', icon: FiPhone, label: 'Calls' },
    { path: '/admin/settings', icon: FiSettings, label: 'Settings' },
  ];

  const getMenuItems = () => {
    if (user?.role === 'admin') return adminMenuItems;
    if (user?.role === 'expert') return expertMenuItems;
    return userMenuItems;
  };

  const menuItems = getMenuItems();

  return (
    <div className="dashboard-layout">
      {/* Mobile Header */}
      <div className="dashboard-mobile-header">
        <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <FiX /> : <FiMenu />}
        </button>
        <h1 className="mobile-title">{title}</h1>
        <div className="mobile-balance">
          <BiRupee /> {user?.tokens || 0}
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand">
            <img src={logo} alt="ConsultOnCall" className="sidebar-logo" />
          </Link>
        </div>

        {/* User Profile */}
        <div className="sidebar-profile compact-profile">
          <button className="profile-avatar-btn" tabIndex={0} aria-label="Profile" onClick={() => navigate('/edit-profile')}>
            <div className="profile-avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} />
              ) : (
                <span>{user?.name?.charAt(0)?.toUpperCase() || '?'}</span>
              )}
              {expert?.isOnline && <span className="online-dot"></span>}
            </div>
          </button>
          <div className="profile-info">
            <div className="profile-name-row">
              <h3>{user?.name}</h3>
              {expert?.linkedinVerified && (
                <span className="linkedin-badge-small" title="Verified via LinkedIn">
                  <FaLinkedin />
                </span>
              )}
            </div>
            <p>{expert?.title || user?.role}</p>
          </div>
          <button className="profile-edit-btn" tabIndex={0} aria-label="Edit Profile" onClick={() => navigate('/edit-profile')}>
            <FiEdit />
          </button>
        </div>

        {/* Online Status Toggle - Above Navigation */}
        {isExpert && onToggleOnline && (
          <div className="sidebar-status-section">
            <div className="status-toggle-container">
              <span className="status-label">Status</span>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  id="online-toggle"
                  checked={expert?.isOnline || false}
                  onChange={() => onToggleOnline()}
                  className="toggle-input"
                />
                <label htmlFor="online-toggle" className="toggle-slider">
                  <span className="toggle-text online">ONLINE</span>
                  <span className="toggle-text offline">OFFLINE</span>
                </label>
              </div>
            </div>
            <p className="status-helper">You will receive calls only when Online</p>
          </div>
        )}

        {/* Navigation */}
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
              tabIndex={0}
            >
              <span className="nav-icon-btn" tabIndex={-1}>
                <item.icon className="nav-icon" />
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <Link to="/" className="nav-item" tabIndex={0}>
            <span className="nav-icon-btn" tabIndex={-1}>
              <FiHome className="nav-icon" />
            </span>
            <span>Back to Home</span>
          </Link>
          <button className="nav-item logout-btn" onClick={handleLogout} tabIndex={0}>
            <span className="nav-icon-btn" tabIndex={-1}>
              <FiLogOut className="nav-icon" />
            </span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="dashboard-content">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
