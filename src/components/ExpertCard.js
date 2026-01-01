import { BiRupee } from 'react-icons/bi';
import { FaLinkedin } from 'react-icons/fa';
import { FiClock, FiMessageSquare, FiPhone, FiStar, FiUsers } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './ExpertCard.css';
import VerifiedBadge from './VerifiedBadge';

// Country to flag emoji mapping
const getCountryFlag = (country) => {
  const countryFlags = {
    'India': '🇮🇳',
    'United States': '🇺🇸',
    'USA': '🇺🇸',
    'United Kingdom': '🇬🇧',
    'UK': '🇬🇧',
    'Canada': '🇨🇦',
    'Australia': '🇦🇺',
    'Germany': '🇩🇪',
    'France': '🇫🇷',
    'Japan': '🇯🇵',
    'China': '🇨🇳',
    'Brazil': '🇧🇷',
    'Singapore': '🇸🇬',
    'UAE': '🇦🇪',
    'Netherlands': '🇳🇱',
    'Spain': '🇪🇸',
    'Italy': '🇮🇹',
    'South Korea': '🇰🇷',
    'Russia': '🇷🇺',
    'Mexico': '🇲🇽',
    'Indonesia': '🇮🇩',
    'Pakistan': '🇵🇰',
    'Bangladesh': '🇧🇩',
    'Sri Lanka': '🇱🇰',
    'Nepal': '🇳🇵',
  };
  return countryFlags[country] || '🌍';
};

const ExpertCard = ({ expert }) => {
  const socketContext = useSocket();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const isExpertOnlineFn =
    typeof socketContext?.isExpertOnline === 'function'
      ? socketContext.isExpertOnline
      : () => false;

  const isExpertBusyFn =
    typeof socketContext?.isExpertBusy === 'function'
      ? socketContext.isExpertBusy
      : () => false;

  const isOnline = expert.isOnline || isExpertOnlineFn(expert._id);

  const isBusy = isExpertBusyFn(expert._id) || expert.isBusy || false;

  const handleChatClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated) {
      toast.error('Please login to chat');
      navigate('/login');
      return;
    }

    if (user.role === 'expert') {
      toast.error('Experts cannot initiate chats');
      return;
    }

    try {
      await axios.post('/api/chats/get-or-create', {
        participantId: expert.user._id
      });
      navigate(`/chat?expert=${expert.user._id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to start chat');
    }
  };

  const getInitials = (name) => {
    return name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  const sessionCount = expert.totalCalls || 0;
  const ratingValue = expert.rating?.toFixed(1) || '0.0';
  const totalReviews = expert.totalRatings || 0;
  const experienceYears = expert.experience || 0;
  const ratePerMinute = expert.tokensPerMinute || 0;
  const expertiseTags = expert.skills?.length
    ? expert.skills.slice(0, 4)
    : (expert.categories?.map(cat => cat.name).slice(0, 4) || []);
  const displayTags = expertiseTags.slice(0, 2);
  const remainingTags = expertiseTags.length - displayTags.length;
  
  // Use username if available, otherwise use ID
  const expertUrl = expert.user && expert.user.username
    ? `/expert/${expert.user.username}`
    : `/expert/${expert._id}`;

  // Determine status text and class
  // const getStatusInfo = () => {
  //   if (!isOnline) return { text: 'OFFLINE', class: 'offline' };
  //   if (isBusy) return { text: 'BUSY', class: 'busy' };
  //   return { text: 'ONLINE', class: 'online' };
  // };

  // const statusInfo = getStatusInfo();

  return (
    <Link to={expertUrl} className="expert-card">
      <div className="expert-card-content">
        {/* Card Header */}
        <div className="card-header">
          <div className={`expert-avatar ${isOnline ? 'online' : ''}`}>
            {expert.user && expert.user.avatar ? (
              <img src={expert.user.avatar} alt={expert.user && expert.user.name ? expert.user.name : 'Expert'} />
            ) : (
              <span>{getInitials(expert.user && expert.user.name ? expert.user.name : expert.name)}</span>
            )}
            <div className={`status-dot ${isOnline ? 'online' : 'offline'}`}></div>
          </div>

          <div className="header-info">
            <div className="name-row">
              <h3>{(expert.user && expert.user.name) ? expert.user.name : expert.name}</h3>
              <div className="badge-container">
                {expert.isVerified && <VerifiedBadge size="small" />}
                {expert.linkedinVerified && (
                  <span className="linkedin-badge" title="Verified via LinkedIn">
                    <FaLinkedin />
                  </span>
                )}
              </div>
            </div>
            {(expert.country || (expert.user && expert.user.country)) && (
              <span className="expert-country">
                <span className="flag-emoji">{getCountryFlag(expert.country || (expert.user && expert.user.country))}</span> {expert.country || (expert.user && expert.user.country)}
              </span>
            )}
            {/* <span className={`availability-pill ${statusInfo.class}`}>
              <span className="dot" />
              {statusInfo.text}
            </span> */}
            {isBusy && isOnline && (
              <span className="busy-message">
                💬 Talking to someone...
              </span>
            )}
            
          </div>
        </div>

        {/* Card Body */}
        <div className="card-body">
          <p className="expert-title">{expert.title}</p>

          <div className="stats-grid">
            <div className="stat-item">
              <FiStar />
              <span className="stat-value">{ratingValue}</span>
              <span className="stat-label">{totalReviews} reviews</span>
            </div>
            <div className="stat-item">
              <FiUsers />
              <span className="stat-value">{sessionCount}</span>
              <span className="stat-label">Sessions</span>
            </div>
            <div className="stat-item">
              <FiClock />
              <span className="stat-value">{experienceYears}</span>
              <span className="stat-label">Years</span>
            </div>
          </div>

          {expert.bio && (
            <p className="expert-bio">{expert.bio}</p>
          )}

          {(displayTags.length > 0 || remainingTags > 0) && (
            <div className="expert-tags">
              {displayTags.map(tag => (
                <span key={tag} className="tag-chip">
                  {tag}
                </span>
              ))}
              {remainingTags > 0 && (
                <span className="tag-chip more">+{remainingTags}</span>
              )}
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div className="card-footer">
          <div className="rate-display">
            <BiRupee />
            <span className="rate-value">{ratePerMinute}</span>
            <span className="rate-unit">/min</span>
          </div>
          <div className="button-group">
            <button 
              className="connect-button" 
              disabled={!isOnline || isBusy}
              style={{ 
                opacity: (!isOnline || isBusy) ? 0.5 : 1,
                cursor: (!isOnline || isBusy) ? 'not-allowed' : 'pointer'
              }}
            >
              <FiPhone /> {isBusy ? 'Busy' : 'Connect'}
            </button>
            <button 
              className="chat-button" 
              onClick={handleChatClick}
              title="Chat with expert"
            >
              <FiMessageSquare />
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ExpertCard;
