import { useCallback, useEffect, useState } from 'react';
import { BiRupee } from 'react-icons/bi';
import { BsPatchCheckFill } from 'react-icons/bs';
import { FaLinkedin, FaShareAlt, FaStar } from 'react-icons/fa';
import * as FiIcons from 'react-icons/fi';
import { FiMessageSquare, FiPhone } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import CallModal from '../components/CallModal';
import ChatWindow from '../components/ChatWindow';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
// import { useCallLogic } from '../hooks/useCallLogic';
import './ExpertProfile.css';

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

const ExpertProfile = () => {
  const { usernameOrId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { isExpertOnline, activeCall } = useSocket();
  const [expert, setExpert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const fetchExpert = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/experts/${usernameOrId}`);
      setExpert(res.data);
    } catch (error) {
      console.error('Fetch expert error:', error);
      toast.error('Expert not found');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [usernameOrId, navigate]);

  useEffect(() => {
    fetchExpert();
  }, [fetchExpert]);

  // Check if expert is blocked
  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!isAuthenticated || !expert) return;
      try {
        const { data } = await axios.get('/api/users/blocked');
        setIsBlocked(data.some(blocked => blocked._id === expert.user?._id));
      } catch (error) {
        console.error('Error checking block status:', error);
      }
    };
    checkBlockStatus();
  }, [isAuthenticated, expert]);

  // Close call modal when call becomes active
  useEffect(() => {
    if (activeCall) {
      setShowCallModal(false);
    }
  }, [activeCall]);

  const handleCallClick = () => {
    if (!isAuthenticated) {
      toast.error('Please login to make a call');
      navigate('/login');
      return;
    }

    if (user.role === 'expert') {
      toast.error('Experts cannot make calls');
      return;
    }

    const isOnline = expert.isOnline || isExpertOnline(expert._id);
    if (!isOnline) {
      toast.error('Expert is currently offline');
      return;
    }

    if (expert.isBusy) {
      toast.error('Expert is currently busy on another call');
      return;
    }

    const minTokens = expert.tokensPerMinute * 5;
    if (user.tokens < minTokens) {
      toast.error(`Minimum ₹${minTokens} required. Please add money.`);
      navigate('/add-money');
      return;
    }

    setShowCallModal(true);
  };

  const handleChatClick = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to chat');
      navigate('/login');
      return;
    }

    if (user.role === 'expert') {
      toast.error('Experts cannot initiate chats');
      return;
    }

    if (isBlocked) {
      toast.error('You have blocked this user');
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

  const handleBlockToggle = async () => {
    if (!isAuthenticated) {
      toast.error('Please login');
      return;
    }

    try {
      if (isBlocked) {
        await axios.post(`/api/users/unblock/${expert.user._id}`);
        setIsBlocked(false);
        toast.success('User unblocked');
      } else {
        await axios.post(`/api/users/block/${expert.user._id}`);
        setIsBlocked(true);
        toast.success('User blocked');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed');
    }
  };

  const handleShareProfile = async () => {
    const profileUrl = `${window.location.origin}/expert/${expert.user?.username || expert._id}`;
    const shareText = `Check out ${expert.user?.name}'s expert profile on ConsultOnCall!`;

    if (navigator.share) {
      // Use Web Share API if available
      try {
        await navigator.share({
          title: `${expert.user?.name} - Expert Profile`,
          text: shareText,
          url: profileUrl,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(`${shareText} ${profileUrl}`);
        toast.success('Profile link copied to clipboard!');
      } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = `${shareText} ${profileUrl}`;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast.success('Profile link copied to clipboard!');
      }
    }
  };



  if (loading) {
    return (
      <div className="expert-profile-page">
        <div className="container">
          <div className="profile-content">
            {/* Main Profile - Skeleton */}
            <div className="profile-main">
              <div className="profile-header-card card skeleton">
                <div className="profile-top">
                  <div className="profile-avatar skeleton" style={{ width: '120px', height: '120px', borderRadius: '50%' }}></div>
                  <div className="profile-info" style={{ flex: 1 }}>
                    <div className="profile-name-row" style={{ marginBottom: '8px' }}>
                      <div className="skeleton skeleton-text" style={{ width: '200px', height: '32px' }}></div>
                      <div className="skeleton" style={{ width: '80px', height: '24px', borderRadius: '12px' }}></div>
                    </div>
                    <div className="skeleton skeleton-text" style={{ width: '150px', height: '20px', marginBottom: '12px' }}></div>
                    <div className="profile-top-meta" style={{ marginBottom: '16px' }}>
                      <div className="skeleton" style={{ width: '100px', height: '20px', borderRadius: '12px', marginRight: '8px' }}></div>
                      <div className="skeleton" style={{ width: '120px', height: '20px', borderRadius: '12px' }}></div>
                    </div>
                    <div className="profile-stats" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                      <div className="skeleton" style={{ width: '80px', height: '20px', borderRadius: '4px' }}></div>
                      <div className="skeleton" style={{ width: '70px', height: '20px', borderRadius: '4px' }}></div>
                      <div className="skeleton" style={{ width: '60px', height: '20px', borderRadius: '4px' }}></div>
                      <div className="skeleton" style={{ width: '75px', height: '20px', borderRadius: '4px' }}></div>
                    </div>
                    <div className="profile-categories" style={{ display: 'flex', gap: '8px' }}>
                      <div className="skeleton" style={{ width: '100px', height: '28px', borderRadius: '14px' }}></div>
                      <div className="skeleton" style={{ width: '90px', height: '28px', borderRadius: '14px' }}></div>
                      <div className="skeleton" style={{ width: '85px', height: '28px', borderRadius: '14px' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="profile-section card skeleton">
                <div className="skeleton skeleton-text" style={{ width: '60px', height: '24px', marginBottom: '12px' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '100%', height: '16px', marginBottom: '8px' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '90%', height: '16px', marginBottom: '8px' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '80%', height: '16px' }}></div>
              </div>

              <div className="profile-section card skeleton">
                <div className="skeleton skeleton-text" style={{ width: '50px', height: '24px', marginBottom: '12px' }}></div>
                <div className="skills-list" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <div className="skeleton" style={{ width: '80px', height: '32px', borderRadius: '16px' }}></div>
                  <div className="skeleton" style={{ width: '90px', height: '32px', borderRadius: '16px' }}></div>
                  <div className="skeleton" style={{ width: '70px', height: '32px', borderRadius: '16px' }}></div>
                  <div className="skeleton" style={{ width: '85px', height: '32px', borderRadius: '16px' }}></div>
                  <div className="skeleton" style={{ width: '75px', height: '32px', borderRadius: '16px' }}></div>
                </div>
              </div>

              <div className="profile-section card skeleton">
                <div className="skeleton skeleton-text" style={{ width: '90px', height: '24px', marginBottom: '12px' }}></div>
                <div className="languages-list" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <div className="skeleton" style={{ width: '70px', height: '32px', borderRadius: '16px' }}></div>
                  <div className="skeleton" style={{ width: '80px', height: '32px', borderRadius: '16px' }}></div>
                  <div className="skeleton" style={{ width: '65px', height: '32px', borderRadius: '16px' }}></div>
                </div>
              </div>
            </div>

            {/* Sidebar - Skeleton */}
            <div className="profile-sidebar">
              <div className="call-card card skeleton">
                <div className="call-card-main" style={{ textAlign: 'center', padding: '24px' }}>
                  <div className="skeleton" style={{ width: '120px', height: '48px', borderRadius: '8px', margin: '0 auto 16px' }}></div>
                  <div className="skeleton" style={{ width: '140px', height: '44px', borderRadius: '8px', margin: '0 auto 16px' }}></div>
                  <div className="skeleton skeleton-text" style={{ width: '100px', height: '16px', margin: '0 auto 8px' }}></div>
                  <div className="skeleton skeleton-text" style={{ width: '120px', height: '16px', margin: '0 auto' }}></div>
                </div>
              </div>

              <div className="stats-card card skeleton">
                <div className="skeleton skeleton-text" style={{ width: '100px', height: '24px', marginBottom: '16px' }}></div>
                <div className="stats-grid">
                  <div className="stat-box skeleton" style={{ textAlign: 'center', padding: '16px' }}>
                    <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%', margin: '0 auto 8px' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '30px', height: '20px', margin: '0 auto 4px' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '50px', height: '14px', margin: '0 auto' }}></div>
                  </div>
                  <div className="stat-box skeleton" style={{ textAlign: 'center', padding: '16px' }}>
                    <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%', margin: '0 auto 8px' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '25px', height: '20px', margin: '0 auto 4px' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '45px', height: '14px', margin: '0 auto' }}></div>
                  </div>
                  <div className="stat-box skeleton" style={{ textAlign: 'center', padding: '16px' }}>
                    <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%', margin: '0 auto 8px' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '20px', height: '20px', margin: '0 auto 4px' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '35px', height: '14px', margin: '0 auto' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!expert) {
    return (
      <div className="not-found">
        <h2>Expert not found</h2>
      </div>
    );
  }

  const isOnline = expert.isOnline || isExpertOnline(expert._id);
  const isBusy = expert.isBusy || false;
  const canCall = isOnline && !isBusy;

  const getInitials = (name) => {
    return name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  const getIcon = (iconName) => {
    const IconComponent = FiIcons[iconName];
    return IconComponent ? <IconComponent /> : null;
  };

  /* Clean Professional Layout - NO BANNER */
  return (
    <div className="expert-profile-page">
      <div className="container">
        {/* Header Card - DP LEFT | INFO RIGHT */}
        <div className="profile-header-card">
          <div className="profile-header-content">
            {/* LEFT: Avatar (120px) */}
            <div className="profile-avatar-container">
              <div className={`profile-avatar-lg ${isOnline ? 'online' : ''}`}>
                {expert.user?.avatar ? (
                  <img src={expert.user.avatar} alt={expert.user?.name} />
                ) : (
                  <span>{getInitials(expert.user?.name)}</span>
                )}
              </div>
            </div>

            {/* RIGHT: Info Section */}
            <div className="profile-identity">
              <div className="name-verification-row">
                <h1>{expert.user?.name}</h1>
                {expert.isVerified && <BsPatchCheckFill className="verified-icon" title="Verified Expert" />}
                {expert.linkedinVerified && <FaLinkedin className="linkedin-icon" title="LinkedIn Verified" />}
              </div>
              <p className="profile-headline">{expert.title}</p>
              <div className="profile-location-row">
                <span className="location-text">
                  {expert.user?.country && <>{getCountryFlag(expert.user.country)} {expert.user.country}</>}
                </span>
                <span className="dot-separator">•</span>
                <span className="join-date">Joined {new Date(expert.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
              </div>

              <div className="profile-stats-row">
                <span className="stat-link">
                  <strong>{expert.totalCalls || 0}</strong> consultations
                </span>
                <span className="stat-link">
                  <strong>{expert.rating?.toFixed(1) || '0.0'}</strong> rating
                </span>
              </div>

              {/* Action Buttons - Desktop Only */}
              <div className="profile-actions-desktop">
                {isAuthenticated && user?.role !== 'expert' && (
                  <>
                    <button
                      className={`action-btn-primary ${!canCall ? 'disabled' : ''}`}
                      onClick={handleCallClick}
                      disabled={!canCall}
                    >
                      <FiPhone /> {isBusy ? 'Busy' : 'Connect Now'}
                    </button>
                    <button
                      className="action-btn-secondary"
                      onClick={handleChatClick}
                    >
                      <FiMessageSquare /> Free Chat
                    </button>
                  </>
                )}
                <button className="action-btn-icon" onClick={handleShareProfile} title="Share">
                  <FaShareAlt />
                </button>
                {isAuthenticated && user?.role !== 'expert' && (
                  <button className="action-btn-icon" onClick={handleBlockToggle} title={isBlocked ? "Unblock" : "Block"}>
                    {isBlocked ? <span style={{ color: 'red' }}>🚫</span> : <span>🚫</span>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Share Section - WhatsApp & LinkedIn */}
        <div className="share-section">
          <h3>Share Profile</h3>
          <div className="share-buttons">
            <button
              className="share-btn whatsapp"
              onClick={() => {
                const profileUrl = window.location.href;
                const shareText = `Check out ${expert.user?.name} on ConsultOnCall`;
                window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + profileUrl)}`, '_blank');
              }}
            >
              <FaShareAlt /> WhatsApp
            </button>
            <button
              className="share-btn linkedin"
              onClick={() => {
                const profileUrl = window.location.href;
                window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`, '_blank');
              }}
            >
              <FaLinkedin /> LinkedIn
            </button>
          </div>
        </div>

        <div className="profile-grid-layout">
          {/* Left Column: Details */}
          <div className="profile-left-col">
            {/* About Section */}
            <div className="profile-section card">
              <h2>About</h2>
              <p className="bio-text">{expert.bio}</p>
            </div>

            {/* Skills & Categories */}
            <div className="profile-section card">
              <h2>Expertise</h2>
              <div className="categories-cloud">
                {expert.categories?.map(cat => (
                  <span key={cat._id} className="category-pill">
                    {getIcon(cat.icon)} {cat.name}
                  </span>
                ))}
              </div>

              {expert.skills?.length > 0 && (
                <div className="skills-cloud">
                  {expert.skills.map((skill, index) => (
                    <span key={index} className="skill-pill">{skill}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Reviews */}
            <div className="profile-section card">
              <h2>Reviews ({expert.reviews?.length || 0})</h2>
              <div className="reviews-list">
                {expert.reviews && expert.reviews.length > 0 ? (
                  expert.reviews
                    .filter(review => review.rating && review.text)
                    .map((review, index) => (
                      <div key={index} className="review-card">
                        <div className="review-author">
                          <div className="review-avatar">
                            {review.avatar ? <img src={review.avatar} alt={review.name} /> : <span>{review.name?.[0]}</span>}
                          </div>
                          <div>
                            <div className="review-name">{review.name}</div>
                            <div className="review-meta">
                              <span className="review-stars">
                                {[...Array(5)].map((_, i) => (
                                  <FaStar key={i} className={i < review.rating ? 'filled' : 'empty'} />
                                ))}
                              </span>
                              <span className="review-date">{new Date(review.date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <p className="review-content">{review.text}</p>
                      </div>
                    ))
                ) : (
                  <p className="no-data-msg">No reviews yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Sidebar (Sticky) */}
          <div className="profile-right-col">
            <div className="rate-card card sticky-sidebar">
              <h3>Consultation Rate</h3>
              <div className="rate-price">
                <BiRupee />{expert.tokensPerMinute} <span className="period">/ min</span>
              </div>
              <div className="rate-features">
                <div className="feature-item"><FiPhone /> Voice/Video Call</div>
                <div className="feature-item"><FiMessageSquare /> Chat Support</div>
              </div>

              {/* Desktop Call Actions - Hidden on mobile */}
              <div className="desktop-call-actions">
                <button
                  className={`call-button-lg ${!canCall ? 'disabled' : ''}`}
                  onClick={handleCallClick}
                  disabled={!canCall}
                >
                  {!isOnline ? 'Offline' : isBusy ? 'Busy' : 'Connect Now'}
                </button>
                <p className="min-balance-hint">Min balance: ₹{expert.tokensPerMinute * 5}</p>
              </div>
            </div>
          </div>
        </div>
      </div>


      {showCallModal && (
        <CallModal
          expert={expert}
          onClose={() => setShowCallModal(false)}
        />
      )}

      {showChat && (
        <ChatWindow
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          recipientId={expert._id || expert.id}
          recipientName={expert.user.name}
          recipientAvatar={expert.user.avatar}
        />
      )}

      {/* Mobile Sticky Footer - Rate | Free Chat | Call Now */}
      <div className="mobile-sticky-footer">
        <div className="footer-content">
          <div className="footer-rate">
            <span className="footer-rate-label">Rate</span>
            <div className="footer-rate-value">
              <BiRupee />{expert.tokensPerMinute}<span className="period">/min</span>
            </div>
          </div>

          <button
            className="footer-chat-btn"
            onClick={handleChatClick}
          >
            <FiMessageSquare /> Free Chat
          </button>

          <button
            className={`footer-call-btn ${!canCall ? 'disabled' : ''}`}
            onClick={handleCallClick}
            disabled={!canCall}
          >
            <FiPhone /> {isBusy ? 'Busy' : 'Call Now'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpertProfile;
