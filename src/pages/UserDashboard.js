import { Link } from 'react-router-dom';
import { BiRupee } from 'react-icons/bi';
import { FiCreditCard, FiPhone, FiBarChart2, FiEdit, FiPlus, FiUser, FiMail, FiZap } from 'react-icons/fi';
import { FaLightbulb } from 'react-icons/fa';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import './UserDashboard.css';

const UserDashboard = () => {
  const { user } = useAuth();

  return (
    <DashboardLayout title="Dashboard">
      <div className="user-dashboard-content">
        <div className="dashboard-header">
          <h1>Welcome, {user?.name?.split(' ')[0]}!</h1>
          <p>Manage your account and view your activity</p>
        </div>

        <div className="dashboard-grid">
          {/* Balance Card */}
          <div className="dashboard-card balance-card">
            <div className="card-icon">
              <FiCreditCard />
            </div>
            <div className="card-content">
              <h3>Current Balance</h3>
              <p className="balance-amount"><BiRupee className="rupee-icon" />{user?.tokens || 0}</p>
            </div>
            <Link to="/add-money" className="btn-add-money">
              <FiPlus /> Add Money
            </Link>
          </div>

          {/* Quick Actions */}
          <div className="dashboard-card">
            <h3><FiZap /> Quick Actions</h3>
            <div className="quick-actions">
              <Link to="/" className="action-item">
                <FiPhone className="action-icon" />
                <span>Browse Experts</span>
              </Link>
              <Link to="/call-history" className="action-item">
                <FiBarChart2 className="action-icon" />
                <span>Call History</span>
              </Link>
              <Link to="/add-money" className="action-item">
                <FiCreditCard className="action-icon" />
                <span>Add Money</span>
              </Link>
              <Link to="/edit-profile" className="action-item">
                <FiEdit className="action-icon" />
                <span>Edit Profile</span>
              </Link>
            </div>
          </div>

          {/* Profile Info */}
          <div className="dashboard-card">
            <h3><FiUser /> Profile Information</h3>
            <div className="profile-details">
              <div className="detail-row">
                <span className="detail-label"><FiUser /> Name</span>
                <span className="detail-value">{user?.name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label"><FiMail /> Email</span>
                <span className="detail-value">{user?.email}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Account Type</span>
                <span className="detail-value capitalize">{user?.role}</span>
              </div>
            </div>
          </div>

          {/* Tips Card */}
          <div className="dashboard-card tips-card">
            <h3><FaLightbulb /> Tips</h3>
            <ul className="tips-list">
              <li>Add minimum ₹10 balance to start making calls</li>
              <li>Browse experts by category to find the right one for you</li>
              <li>Check if an expert is online before making a call</li>
              <li>Rate your calls to help other users</li>
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default UserDashboard;
