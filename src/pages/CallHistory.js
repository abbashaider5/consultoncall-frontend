import { useCallback, useEffect, useState } from 'react';
import { BiRupee } from 'react-icons/bi';
import { FiClock, FiPhone, FiStar } from 'react-icons/fi';
import { toast } from 'react-toastify';
import DashboardLayout from '../components/DashboardLayout';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import './CallHistory.css';

const CallHistory = () => {
  const { isExpert } = useAuth();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [ratingModal, setRatingModal] = useState(null);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');

  const fetchCalls = useCallback(async () => {
    try {
      setLoading(true);
      const endpoint = isExpert ? '/api/calls/expert-history' : '/api/calls/history';
      const res = await axios.get(`${endpoint}?page=${page}&limit=10`);
      setCalls(res.data.calls);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      console.error('Fetch calls error:', error);
      toast.error('Failed to fetch call history');
    } finally {
      setLoading(false);
    }
  }, [isExpert, page]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const handleRateCall = async (callId) => {
    try {
      await axios.put(`/api/calls/rate/${callId}`, { rating, review });
      toast.success('Rating submitted!');
      setRatingModal(null);
      fetchCalls();
    } catch (error) {
      console.error('Rate call error:', error);
      toast.error('Failed to submit rating');
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: { class: 'badge-success', label: 'Completed' },
      ongoing: { class: 'badge-info', label: 'Ongoing' },
      missed: { class: 'badge-warning', label: 'Missed' },
      rejected: { class: 'badge-danger', label: 'Rejected' },
      failed: { class: 'badge-danger', label: 'Failed' },
      initiated: { class: 'badge-info', label: 'Initiated' },
      ringing: { class: 'badge-info', label: 'Ringing' }
    };
    const config = statusConfig[status] || { class: '', label: status };
    return <span className={`badge ${config.class}`}>{config.label}</span>;
  };

  return (
    <DashboardLayout title="Call History">
      <div className="call-history-content">
        <div className="page-header">
          <h1>Call History</h1>
          <p>{isExpert ? 'View calls you received' : 'View your call history with experts'}</p>
        </div>

        {loading ? (
          <div className="calls-loading">
            {/* Desktop Table Skeleton */}
            <div className="calls-table-wrapper desktop-only">
              <table className="calls-table">
                <thead>
                  <tr>
                    <th>{isExpert ? 'Caller' : 'Expert'}</th>
                    <th>Date & Time</th>
                    <th>Duration</th>
                    <th>Rate</th>
                    <th>{isExpert ? 'Earned' : 'Charged'}</th>
                    <th>Status</th>
                    {!isExpert && <th>Rating</th>}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="skeleton-row">
                      <td>
                        <div className="call-user">
                          <div className="call-avatar skeleton"></div>
                          <div className="call-user-info">
                            <div className="skeleton skeleton-text" style={{width: '100px', height: '16px', marginBottom: '4px'}}></div>
                            {!isExpert && <div className="skeleton skeleton-text" style={{width: '80px', height: '14px'}}></div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="call-datetime">
                          <div className="skeleton skeleton-text" style={{width: '80px', height: '16px', marginBottom: '4px'}}></div>
                          <div className="skeleton skeleton-text" style={{width: '50px', height: '14px'}}></div>
                        </div>
                      </td>
                      <td>
                        <div className="skeleton skeleton-text" style={{width: '60px', height: '16px'}}></div>
                      </td>
                      <td>
                        <div className="skeleton skeleton-text" style={{width: '50px', height: '16px'}}></div>
                      </td>
                      <td>
                        <div className="skeleton skeleton-text" style={{width: '60px', height: '16px'}}></div>
                      </td>
                      <td>
                        <div className="skeleton" style={{width: '70px', height: '24px', borderRadius: '12px'}}></div>
                      </td>
                      {!isExpert && (
                        <td>
                          <div className="skeleton" style={{width: '40px', height: '24px', borderRadius: '4px'}}></div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards Skeleton */}
            <div className="calls-cards mobile-only">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="call-card skeleton">
                  <div className="call-card-header">
                    <div className="call-user">
                      <div className="call-avatar skeleton"></div>
                      <div className="call-user-info">
                        <div className="skeleton skeleton-text" style={{width: '100px', height: '16px', marginBottom: '4px'}}></div>
                        {!isExpert && <div className="skeleton skeleton-text" style={{width: '80px', height: '14px'}}></div>}
                      </div>
                    </div>
                    <div className="skeleton" style={{width: '70px', height: '24px', borderRadius: '12px'}}></div>
                  </div>

                  <div className="call-card-details">
                    <div className="call-detail-row">
                      <div className="skeleton skeleton-text" style={{width: '140px', height: '16px'}}></div>
                    </div>
                    <div className="call-detail-row">
                      <div className="skeleton skeleton-text" style={{width: '100px', height: '16px'}}></div>
                    </div>
                    <div className="call-detail-row">
                      <div className="skeleton skeleton-text" style={{width: '80px', height: '16px'}}></div>
                    </div>
                    <div className="call-detail-row">
                      <div className="skeleton skeleton-text" style={{width: '90px', height: '16px'}}></div>
                    </div>
                    {!isExpert && (
                      <div className="call-detail-row">
                        <div className="skeleton skeleton-text" style={{width: '60px', height: '16px'}}></div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : calls.length === 0 ? (
          <div className="empty-state">
            <FiPhone className="empty-icon" />
            <h3>No Calls Yet</h3>
            <p>Your call history will appear here</p>
          </div>
        ) : (
          <>
              {/* Desktop Table View */}
            <div className="calls-table-wrapper desktop-only">
              <table className="calls-table">
                <thead>
                  <tr>
                    <th>{isExpert ? 'Caller' : 'Expert'}</th>
                    <th>Date & Time</th>
                    <th>Duration</th>
                    <th>Rate</th>
                    <th>{isExpert ? 'Earned' : 'Charged'}</th>
                    <th>Status</th>
                    {!isExpert && <th>Rating</th>}
                  </tr>
                </thead>
                <tbody>
                  {calls.map(call => (
                    <tr key={call._id}>
                      <td>
                        <div className="call-user">
                          <div className="call-avatar">
                            {isExpert 
                              ? call.caller?.name?.charAt(0).toUpperCase()
                              : call.expert?.user?.name?.charAt(0).toUpperCase()
                            }
                          </div>
                          <div className="call-user-info">
                            <span className="call-user-name">
                              {isExpert ? call.caller?.name : call.expert?.user?.name}
                            </span>
                            {!isExpert && (
                              <span className="call-user-title">{call.expert?.title}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="call-datetime">
                          <span>{new Date(call.createdAt).toLocaleDateString()}</span>
                          <span className="call-time">
                            {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="call-duration">
                          <FiClock />
                          <span>{formatDuration(call.duration)}</span>
                        </div>
                      </td>
                      <td><BiRupee className="rupee-icon" />{call.tokensPerMinute}/min</td>
                      <td>
                        <span className={isExpert ? 'text-success' : 'text-danger'}>
                          {isExpert ? '+' : '-'}<BiRupee className="rupee-icon" />{isExpert ? Math.floor(call.tokensSpent * 0.8) : call.tokensSpent}
                        </span>
                      </td>
                      <td>{getStatusBadge(call.status)}</td>
                      {!isExpert && (
                        <td>
                          {call.status === 'completed' && !call.rating ? (
                            <button
                              className="rate-btn"
                              onClick={() => setRatingModal(call)}
                            >
                              Rate Call
                            </button>
                          ) : call.rating ? (
                            <div className="call-rating">
                              <FiStar className="star-icon filled" />
                              <span>{call.rating}</span>
                            </div>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="calls-cards mobile-only">
              {calls.map(call => (
                <div key={call._id} className="call-card">
                  <div className="call-card-header">
                    <div className="call-user">
                      <div className="call-avatar">
                        {isExpert 
                          ? call.caller?.name?.charAt(0).toUpperCase()
                          : call.expert?.user?.name?.charAt(0).toUpperCase()
                        }
                      </div>
                      <div className="call-user-info">
                        <span className="call-user-name">
                          {isExpert ? call.caller?.name : call.expert?.user?.name}
                        </span>
                        {!isExpert && (
                          <span className="call-user-title">{call.expert?.title}</span>
                        )}
                      </div>
                    </div>
                    <div className="call-status">
                      {getStatusBadge(call.status)}
                    </div>
                  </div>

                  <div className="call-card-details">
                    <div className="call-detail-row">
                      <span className="detail-label">Date & Time:</span>
                      <span className="detail-value">
                        {new Date(call.createdAt).toLocaleDateString()} at {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="call-detail-row">
                      <span className="detail-label">Duration:</span>
                      <span className="detail-value">
                        <FiClock className="detail-icon" />
                        {formatDuration(call.duration)}
                      </span>
                    </div>

                    <div className="call-detail-row">
                      <span className="detail-label">Rate:</span>
                      <span className="detail-value">
                        <BiRupee className="rupee-icon" />{call.tokensPerMinute}/min
                      </span>
                    </div>

                    <div className="call-detail-row">
                      <span className="detail-label">{isExpert ? 'Earned:' : 'Charged:'}</span>
                      <span className={`detail-value ${isExpert ? 'amount-positive' : 'amount-negative'}`}>
                        {isExpert ? '+' : '-'}<BiRupee className="rupee-icon" />{isExpert ? Math.floor(call.tokensSpent * 0.8) : call.tokensSpent}
                      </span>
                    </div>

                    {!isExpert && (
                      <div className="call-detail-row">
                        <span className="detail-label">Rating:</span>
                        <span className="detail-value">
                          {call.status === 'completed' && !call.rating ? (
                            <button
                              className="rate-btn"
                              onClick={() => setRatingModal(call)}
                            >
                              Rate
                            </button>
                          ) : call.rating ? (
                            <div className="call-rating">
                              <FiStar className="star-icon filled" />
                              <span>{call.rating}</span>
                            </div>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-outline"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </button>
                <span className="page-info">Page {page} of {totalPages}</span>
                <button
                  className="btn btn-outline"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Rating Modal */}
      {ratingModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Rate Your Call</h2>
              <button className="close-btn" onClick={() => setRatingModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>How was your experience with {ratingModal.expert?.user?.name}?</p>
              
              <div className="rating-stars">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    className={`star-btn ${rating >= star ? 'active' : ''}`}
                    onClick={() => setRating(star)}
                  >
                    <FiStar />
                  </button>
                ))}
              </div>

              <div className="input-group">
                <label>Review (Optional)</label>
                <textarea
                  placeholder="Share your experience..."
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  className="input"
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setRatingModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => handleRateCall(ratingModal._id)}>
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default CallHistory;
