import { useEffect, useRef, useState } from 'react';
import { FiArrowLeft, FiSearch, FiSend, FiSlash, FiTrash2 } from 'react-icons/fi';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import VerifiedBadge from '../components/VerifiedBadge';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './Chat.css';

// Message sound
let messageSound = null;

const Chat = () => {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const { newMessage, sendChatMessage, clearUnreadCount, unreadCounts, getExpertStatus } = useSocket();
  const { isExpert, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUserId = localStorage.getItem('userId');

  // Initialize message sound
  useEffect(() => {
    if (!messageSound) {
      messageSound = new Audio('/assets/new-message-tone.mp3');
      messageSound.volume = 0.3;
    }
  }, []);

  const playMessageSound = () => {
    if (messageSound) {
      messageSound.play().catch(err => console.log('Sound play error:', err));
    }
  };

  // Filter chats by search
  const filteredChats = chats.filter(chat => {
    if (!searchQuery) return true;
    const other = getOtherParticipant(chat);
    return other?.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Load chats
  useEffect(() => {
    loadChats();
  }, []);

  // Auto-select chat with expert from URL parameter
  useEffect(() => {
    const expertId = searchParams.get('expert');
    if (expertId && chats.length > 0) {
      const chatWithExpert = chats.find(chat => {
        const otherParticipant = chat.participants.find(p => p._id !== currentUserId);
        return otherParticipant && otherParticipant._id === expertId;
      });

      if (chatWithExpert && !selectedChat) {
        setSelectedChat(chatWithExpert);
        // Clear the URL parameter after selecting
        navigate('/chat', { replace: true });
      }
    }
  }, [chats, searchParams, currentUserId, selectedChat, navigate]);

  // Handle typing indicator
  useEffect(() => {
    const handleTyping = (e) => {
      if (selectedChat && e.detail?.chatId === selectedChat._id) {
        setIsTyping(e.detail.isTyping);
      }
    };

    window.addEventListener('chat_typing', handleTyping);
    return () => window.removeEventListener('chat_typing', handleTyping);
  }, [selectedChat]);

  // Handle new messages
  useEffect(() => {
    if (!newMessage || !selectedChat) return;
    if (newMessage.chatId && newMessage.chatId === selectedChat._id && newMessage.message) {
      // Play sound for incoming messages
      if (newMessage.message.sender !== currentUserId) {
        playMessageSound();
      }
      
      setMessages(prev => [...prev, newMessage.message]);
      scrollToBottom();
      clearUnreadCount?.(selectedChat._id);
    }
  }, [newMessage, selectedChat, clearUnreadCount, currentUserId]);

  // Load messages + mark read when chat is selected
  useEffect(() => {
    if (!selectedChat) return;

    loadMessages(selectedChat._id);

    // Mark read in backend (source of truth)
    (async () => {
      try {
        await axios.put(`/api/chats/${selectedChat._id}/read`);
        clearUnreadCount?.(selectedChat._id);
      } catch (e) {
        // Non-fatal
      }
    })();
  }, [selectedChat, clearUnreadCount]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChats = async () => {
    try {
      const { data } = await axios.get('/api/chats');
      if (Array.isArray(data)) {
        setChats(data);
      } else {
        setChats([]);
        console.warn('Unexpected chats data format:', data);
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
      setChats([]);
      if (error.response?.status !== 404) {
        toast.error(error.response?.data?.message || 'Failed to load chats');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (chatId) => {
    setLoadingMessages(true);
    try {
      const { data } = await axios.get(`/api/chats/${chatId}/messages`);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
      toast.error(error.response?.data?.message || 'Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleBlockToggle = async () => {
    if (!selectedChat) return;
    const otherParticipant = getOtherParticipant(selectedChat);
    if (!otherParticipant) return;

    const action = isBlocked ? 'unblock' : 'block';
    const confirmMessage = isBlocked
      ? `Are you sure you want to unblock ${otherParticipant.name}?`
      : `Are you sure you want to block ${otherParticipant.name}?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      await axios.post(`/api/users/${action}/${otherParticipant._id}`);
      setIsBlocked(!isBlocked);
      toast.success(isBlocked ? 'User unblocked' : 'User blocked');
    } catch (error) {
      toast.error(`Failed to ${action} user`);
      console.error(error);
    }
  };

  // Check if user is blocked when chat is selected
  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!selectedChat) return;
      const other = getOtherParticipant(selectedChat);
      if (!other) return;

      try {
        // Check if current user has blocked the other user
        const { data } = await axios.get('/api/users/blocked');
        const blockedIds = data.map(u => u._id);
        const hasBlocked = blockedIds.includes(other._id);
        setIsBlocked(hasBlocked);

        // Check if other user has blocked current user by trying to check their profile
        // We'll detect this when trying to send a message
        setIsBlockedByOther(false);
      } catch {
        setIsBlocked(false);
        setIsBlockedByOther(false);
      }
    };
    checkBlockStatus();
  }, [selectedChat]);

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!messageText.trim() || !selectedChat) return;

    // Optimistic UI update
    const tempMessage = {
      _id: `temp-${Date.now()}`,
      content: messageText.trim(),
      sender: currentUserId,
      createdAt: new Date().toISOString(),
      status: 'sending'
    };

    setMessages(prev => [...prev, tempMessage]);
    setMessageText('');
    scrollToBottom();

    try {
      const { data } = await axios.post(`/api/chats/${selectedChat._id}/messages`, {
        content: messageText.trim()
      });

      // Replace temp message with real message
      setMessages(prev => prev.map(msg => 
        msg._id === tempMessage._id ? { ...data, status: 'sent' } : msg
      ));

      // Send via socket for real-time delivery
      const other = getOtherParticipant(selectedChat);
      if (sendChatMessage && other?._id) {
        await sendChatMessage(selectedChat._id, other._id, { content: data.content });
      }

    } catch (error) {
      console.error('Send message error:', error);
      
      // Check if blocked by other user
      const errorMessage = error.response?.data?.message;
      if (errorMessage?.includes('blocked by this user') || errorMessage?.includes('cannot send messages')) {
        setIsBlockedByOther(true);
        toast.error(errorMessage);
      } else {
        toast.error(errorMessage || 'Failed to send message');
      }
      
      setMessages(prev => prev.map(msg => 
        msg._id === tempMessage._id ? { ...msg, status: 'failed' } : msg
      ));
    }
  };

  const handleDeleteChat = async (chatId) => {
    if (!window.confirm('Delete this conversation?')) return;

    try {
      await axios.delete(`/api/chats/${chatId}`);
      setChats(prev => prev.filter(c => c._id !== chatId));
      if (selectedChat?._id === chatId) {
        setSelectedChat(null);
        setMessages([]);
      }
      toast.success('Chat deleted');
    } catch (error) {
      console.error('Delete chat error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete chat');
    }
  };

  const getOtherParticipant = (chat) => {
    return chat.participants.find(p => p._id !== currentUserId);
  };

  const formatTime = (date) => {
    const messageDate = new Date(date);
    const now = new Date();
    const isToday = messageDate.toDateString() === now.toDateString();
    
    if (isToday) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  const formatDateSeparator = (date) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  const shouldShowDateSeparator = (currentMsg, prevMsg) => {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.createdAt).toDateString();
    const prevDate = new Date(prevMsg.createdAt).toDateString();
    return currentDate !== prevDate;
  };

  if (loading) {
    return <div className="chat-loading">Loading chats...</div>;
  }

  return (
    <div className="chat-container">
      {/* Chat List Sidebar */}
      <div className={`chat-list ${selectedChat ? 'hidden-mobile' : ''}`}>
        <div className="chat-list-header">
          <h2>Messages</h2>
        </div>
        <div className="chat-search">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="chat-list-items">
          {loading ? (
            /* Skeleton Loading for Chat List */
            <>
              {Array(5).fill(0).map((_, i) => (
                <div className="chat-item" key={i}>
                  <Skeleton circle={true} height={50} width={50} />
                  <div className="chat-item-content" style={{ flex: 1, marginLeft: '15px' }}>
                    <div className="chat-item-header">
                      <span className="chat-name"><Skeleton width={100} /></span>
                      <span className="chat-time"><Skeleton width={50} /></span>
                    </div>
                    <div className="chat-item-footer">
                      <p className="chat-last-message"><Skeleton width={150} /></p>
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : chats.length === 0 ? (
            <div className="no-chats">
              <div className="no-chats-icon">💬</div>
              <h3>No conversations yet</h3>
              <p>Start chatting with experts to get personalized advice</p>
              <button onClick={() => navigate('/experts')} className="btn-primary">
                Find an Expert
              </button>
            </div>
          ) : (
            filteredChats.map(chat => {
              const otherUser = getOtherParticipant(chat);
              const unread = unreadCounts[chat._id] || 0;

              return (
                <div
                  key={chat._id}
                  className={`chat-item ${selectedChat?._id === chat._id ? 'active' : ''}`}
                  onClick={() => setSelectedChat(chat)}
                >
                  <img
                    src={otherUser?.avatar || 'https://via.placeholder.com/50'}
                    alt={otherUser?.name}
                    className="chat-avatar"
                  />
              <div className="chat-item-content">
                <div className="chat-item-header">
                  <span className="chat-name">
                    {otherUser?.name}
                    {otherUser?.role === 'expert' && otherUser?.isVerified && (
                      <VerifiedBadge size="small" />
                    )}
                  </span>
                  <span className="chat-time">{formatTime(chat.lastMessageTime)}</span>
                </div>
                <div className="chat-item-footer">
                  <p className="chat-last-message">{chat.lastMessage || 'No messages yet'}</p>
                  {unread > 0 && <span className="unread-badge">{unread}</span>}
                </div>
              </div>
            </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className={`chat-window ${!selectedChat ? 'hidden-mobile' : ''}`}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div className="chat-header-left">
                <button className="back-btn" onClick={() => setSelectedChat(null)}>
                  <FiArrowLeft />
                </button>
                <div className="avatar-wrapper">
                  <img
                    src={getOtherParticipant(selectedChat)?.avatar || 'https://via.placeholder.com/40'}
                    alt={getOtherParticipant(selectedChat)?.name}
                    className="chat-header-avatar"
                  />
                  {getOtherParticipant(selectedChat)?.role === 'expert' && (
                    <div className={`status-indicator status-${getExpertStatus?.(getOtherParticipant(selectedChat)?._id)?.status || 'offline'}`}></div>
                  )}
                </div>
                <div className="chat-header-info">
                  <div className="name-row">
                    <h3>{getOtherParticipant(selectedChat)?.name}</h3>
                    {getOtherParticipant(selectedChat)?.role === 'expert' && getOtherParticipant(selectedChat)?.isVerified && (
                      <VerifiedBadge size="small" />
                    )}
                  </div>
                  <span className="status-label">
                    {isTyping ? 'Typing...' : 
                     getOtherParticipant(selectedChat)?.role === 'expert'
                      ? (getExpertStatus?.(getOtherParticipant(selectedChat)?._id)?.text || 'Offline')
                      : 'User'
                    }
                  </span>
                </div>
              </div>
              <div className="chat-header-actions">
                <button
                  className={`chat-options-btn ${isBlocked ? 'unblock-btn' : 'block-btn'}`}
                  onClick={handleBlockToggle}
                  title={isBlocked ? 'Unblock User' : 'Block User'}
                >
                  <FiSlash style={{ marginRight: '4px' }} />
                  {isBlocked ? 'Unblock' : 'Block'}
                </button>
                <button
                  className="chat-options-btn delete-btn"
                  onClick={() => handleDeleteChat(selectedChat._id)}
                  title="Delete Conversation"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>

              {/* Messages Area */}
              <div className="messages-container">
                {loadingMessages ? (
                  /* Skeleton Loading for Messages */
                  <div className="messages-skeleton">
                    <div className="message other"><div className="message-bubble"><Skeleton width={150} /></div></div>
                    <div className="message own"><div className="message-bubble"><Skeleton width={200} /></div></div>
                    <div className="message other"><div className="message-bubble"><Skeleton width={120} /><Skeleton width={80} /></div></div>
                    <div className="message own"><div className="message-bubble"><Skeleton width={180} /></div></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="no-messages">
                    <div className="empty-icon">💬</div>
                    <h3>No messages yet</h3>
                    <p>Start the conversation with {getOtherParticipant(selectedChat)?.name}</p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isOwn = msg.sender === currentUserId;
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const showDateSeparator = shouldShowDateSeparator(msg, prevMsg);

                    return (
                      <div key={msg._id || index}>
                        {showDateSeparator && (
                          <div className="date-separator">
                            <span>{formatDateSeparator(msg.createdAt)}</span>
                          </div>
                        )}
                        <div className={`message ${isOwn ? 'own' : 'other'}`}>
                          {!isOwn && (
                            <div className="message-avatar">
                              {getOtherParticipant(selectedChat)?.avatar ? (
                                <img src={getOtherParticipant(selectedChat)?.avatar} alt="" />
                              ) : (
                                <div className="avatar-placeholder-small">
                                  {getOtherParticipant(selectedChat)?.name?.charAt(0)}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="message-content">
                            {!isOwn && (
                              <span className="sender-name">{getOtherParticipant(selectedChat)?.name}</span>
                            )}
                            <div className={`message-bubble ${isOwn ? 'sent' : 'received'}`}>
                              <p>{msg.content}</p>
                              <div className="message-meta">
                                <span className="message-time">{formatTime(msg.createdAt)}</span>
                                {isOwn && (
                                  <span className="message-status">
                                    {msg.status === 'sending' ? '🕒' : 
                                     msg.status === 'failed' ? '⚠️' : '✓✓'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            {isBlockedByOther ? (
              <div className="blocked-input-notice blocked-by-other">
                <div className="blocked-icon">🚫</div>
                <div className="blocked-text">
                  <strong>You are blocked</strong>
                  <p>This expert has blocked you. You cannot send messages.</p>
                </div>
              </div>
            ) : isBlocked ? (
              <div className="blocked-input-notice">
                <div className="blocked-icon">🚫</div>
                <div className="blocked-text">
                  <strong>Conversation Blocked</strong>
                  <p>You have blocked this user. Unblock to send messages.</p>
                </div>
                <button className="unblock-btn" onClick={handleBlockToggle}>
                  Unblock
                </button>
              </div>
            ) : (
              <form className="message-input-container" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="message-input"
                  disabled={sending}
                />
                <button type="submit" className="send-btn" disabled={sending || !messageText.trim()}>
                  <FiSend />
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="no-chat-selected">
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
