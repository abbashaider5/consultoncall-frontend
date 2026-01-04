import { useCallback, useEffect, useState } from 'react';
import { BiRupee } from 'react-icons/bi';
import { FaLinkedin, FaShareAlt, FaStar } from 'react-icons/fa';
import * as FiIcons from 'react-icons/fi';
import { FiClock, FiMessageSquare, FiPhone, FiUsers } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import AgoraChatWindow from '../components/AgoraChatWindow';
import CallModal from '../components/CallModal';
import VerifiedBadge from '../components/VerifiedBadge';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './ExpertProfile.css';

const getCountryFlag = (country) => {
  const flags = {
    'India': '🇮🇳',
    'United States': '🇺🇸',
    'USA': '🇺🇸',
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
    'Nepal': '🇳🇵'
  };
  return flags[country] || '🌍';
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

  useEffect(() => {
    if (activeCall && showCallModal) {
      setShowCallModal(false);
    }
  }, [activeCall, showCallModal]);

  const handleCallClick = () => {
    try {
      if (!isAuthenticated) {
        toast.error('Please login to make a call');
        navigate('/login');
        return;
      }
      if (!user?._id) {
        toast.error('Please login again');
        navigate('/login');
        return;
      }
      if (!expert?._id) {
        toast.error('Expert not available');
        return;
      }
      if (user?.role === 'expert') {
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
      const minTokens = (expert.tokensPerMinute || 0) * 5;
      if ((user.tokens || 0) < minTokens) {
        toast.error(`Minimum ₹${minTokens} required. Please add money.`);
        navigate('/add-money');
        return;
      }
      setShowCallModal(true);
    } catch (e) {
      console.error('Call click failed:', e);
      toast.error('Call failed – try again');
    }
  };

  const handleChatClick = async () => {
    try {
      if (!isAuthenticated) {
        toast.error('Please login to chat');
        navigate('/login');
        return;
      }
      if (user?.role === 'expert') {
        toast.error('Experts cannot initiate chats');
        return;
      }
      if (isBlocked) {
        toast.error('You have blocked this user');
        return;
      }
      if (!expert?.user?._id) {
        toast.error('Expert not available');
        return;
      }
      await axios.post('/api/chats/get-or-create', {
        participantId: expert.user._id
      });
      navigate(`/chat?expert=${expert.user._id}`);
    } catch (error) {
      console.error('Chat click failed:', error);
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
      try {
        await navigator.clipboard.writeText(`${shareText} ${profileUrl}`);
        toast.success('Profile link copied to clipboard!');
      } catch (error) {
        const textArea = document.createElement('textarea');
        textArea.value = `${shareText} ${profileUrl}`;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        toast.success('Profile link copied to clipboard!');
        document.body.removeChild(textArea);
      }
    }
  };

  if (loading) {
    return (
      <div className="expert-profile-page">
        <div className="container">
          <div className="profile-content">
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
  const isAway = !isOnline && !isBusy;
  const canCall = isOnline && !isBusy;

  const getStatusType = () => {
    if (isBusy) return 'busy';
    if (isOnline) return 'online';
    if (isAway) return 'away';
    return 'offline';
  };

  const formatLastSeen = (lastSeenDate) => {
    if (!lastSeenDate) return 'Recently';
    
    const now = new Date();
    const lastSeen = new Date(lastSeenDate);
    const diffMs = now - lastSeen;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    
    return lastSeen.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getStatusMessage = () => {
    if (isBusy) return 'Currently in another call';
    if (isOnline) return 'Available for call now';
    if (isAway) return `Last seen ${formatLastSeen(expert.lastSeen)}`;
    return 'Not available right now';
  };

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

  return (
    <div className="expert-profile-page">
      <div className="container">
        <div className="profile-grid-layout">
          <div className="profile-left-col">
            <div className="profile-header-card">
              <div className="profile-header-content">
                <div className="profile-avatar-container">
                  <div className={`profile-avatar-lg ${getStatusType()}`}>
                    {expert.user?.avatar ? (
                      <img src={expert.user.avatar} alt={expert.user?.name} />
                    ) : (
                      <span>{getInitials(expert.user?.name)}</span>
                    )}
                  </div>
                </div>

                <div className="profile-identity">
                  <div className="identity-header">
                    <div className="name-verification-row">
                      <h1>{expert.user?.name}</h1>
                      <div className="badges-row">
                        {expert.isVerified && <VerifiedBadge size="medium" />}
                        {expert.linkedinVerified && <FaLinkedin className="linkedin-icon" title="LinkedIn Verified" />}
                      </div>
                    </div>
                  </div>

                  <div className="identity-body">
                    <div className="profile-location-row">
                      <div className="location-group">
                        {expert.user?.country && (
                          <>
                            <span className="location-text">
                              {getCountryFlag(expert.user.country)} {expert.user.country}
                            </span>
                            <span className="location-separator">·</span>
                          </>
                        )}
                        <span className={`status-pill status-${getStatusType().toLowerCase()}`}>
                          <span className="status-dot"></span>
                          <span className="stat-icon-expert">{getStatusType()}</span>
                        </span>
                      </div>
                    </div>

                    <p className="profile-headline">{expert.title}</p>

                    <div className="profile-stats-horizontal">
                      <div className="stat-row">
                        <FiUsers className="stat-icon-expert" />
                        <span className="stat-number">{expert.totalCalls || 0}</span>
                        <span className="stat-label">Sessions</span>
                      </div> |
                      <div className="stat-row">
                        <FaStar className="stat-icon-expert star" />
                        <span className="stat-number">{expert.rating?.toFixed(1) || '0.0'}</span>
                        <span className="stat-label">Rating</span>
                      </div> |
                      <div className="stat-row">
                        <FiClock className="stat-icon-expert" />
                        <span className="stat-number">{expert.experience || 0}</span>
                        <span className="stat-label">Years Experience</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="profile-section card">
              <h2>About</h2>
              <p className="bio-text">
                {expert.bio || 'No bio information available.'}
              </p>
            </div>

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

          <div className="profile-right-col">
            <div className="rate-card card sticky-sidebar">
              <h3>Consultation Rate</h3>
              <div className="rate-price">
                <BiRupee />{expert.tokensPerMinute} <span className="period">/ min</span>
              </div>

              <div className="sidebar-actions">
                <button
                  className={`action-btn-primary ${!canCall ? 'disabled' : ''}`}
                  onClick={handleCallClick}
                  disabled={!canCall}
                  title={getStatusMessage()}
                >
                  <FiPhone /> {isBusy ? 'Busy' : 'Connect Now'}
                </button>
                <button
                  className="action-btn-secondary"
                  onClick={handleChatClick}
                  title="Chat with expert"
                >
                  <FiMessageSquare /> Chat
                </button>
              </div>

              <div className="status-message">
                {getStatusMessage()}
                {!isOnline && !isBusy && expert.lastSeen && (
                  <div className="last-seen-detail">
                    <FiClock className="last-seen-icon" />
                    <span>Last seen {formatLastSeen(expert.lastSeen)}</span>
                  </div>
                )}
              </div>

              <div className="rate-features">
                <div className="feature-item"><FiPhone /> Voice Call</div>
                <div className="feature-item"><FiMessageSquare /> Free Chat Support</div>
              </div>
            </div>

            <div className="stats-card card">
              <h3>Expert Statistics</h3>
              <div className="profile-stats-grid">
                <div className="p-stat-item">
                  <div className="p-stat-icon-expert"><FiUsers /></div>
                  <div className="p-stat-info">
                    <span className="p-stat-value">{expert.totalCalls || 0}</span>
                    <span className="p-stat-label">Consultations</span>
                  </div>
                </div>
                <div className="p-stat-item">
                  <div className="p-stat-icon-expert star"><FaStar /></div>
                  <div className="p-stat-info">
                    <span className="p-stat-value">{expert.rating?.toFixed(1) || '0.0'}</span>
                    <span className="p-stat-label">Rating</span>
                  </div>
                </div>
                <div className="p-stat-item">
                  <div className="p-stat-icon-expert"><FiClock /></div>
                  <div className="p-stat-info">
                    <span className="p-stat-value">{expert.experience || 0} Years</span>
                    <span className="p-stat-label">Experience</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="share-section card">
              <h3>Share Profile</h3>
              <div className="share-buttons-col">
                <button
                  className="share-btn whatsapp"
                  onClick={() => {
                    const url = window.location.href;
                    const text = `Check out ${expert.user?.name} on ConsultOnCall`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
                  }}
                >
                  <FaShareAlt /> Share on WhatsApp
                </button>
                <button
                  className="share-btn linkedin"
                  onClick={() => {
                    const url = window.location.href;
                    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
                  }}
                >
                  <FaLinkedin /> Share on LinkedIn
                </button>
                <button className="share-btn copy" onClick={handleShareProfile}>
                   <FiIcons.FiCopy /> Copy Link
                </button>
              </div>
            </div>

            {isAuthenticated && user?.role !== 'expert' && (
               <button className="block-btn" onClick={handleBlockToggle}>
                  {isBlocked ? 'Unblock Expert' : 'Block Expert'}
               </button>
            )}
          </div>
        </div>

        {showCallModal && (
          <CallModal
            expert={expert}
            onClose={() => setShowCallModal(false)}
          />
        )}

        {showChat && (
          <AgoraChatWindow
            isOpen={showChat}
            onClose={() => setShowChat(false)}
            recipientId={expert.user?._id || expert._id || expert.id}
            recipientName={expert.user?.name || 'Expert'}
            recipientAvatar={expert.user?.avatar || null}
          />
        )}

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
              title={getStatusMessage()}
            >
              <FiPhone /> {isBusy ? 'Busy' : 'Connect Now'}
            </button>
          </div>
        </div>
      </div>
      </div>
    );
};

export default ExpertProfile;
