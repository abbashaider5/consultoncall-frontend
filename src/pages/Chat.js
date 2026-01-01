import { useEffect, useRef, useState } from 'react';
import { FiArrowLeft, FiSend, FiSlash, FiTrash2 } from 'react-icons/fi';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import VerifiedBadge from '../components/VerifiedBadge';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './Chat.css';

const Chat = () => {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const messagesEndRef = useRef(null);
  const { newMessage, sendChatMessage, clearUnreadCount, unreadCounts, getExpertStatus } = useSocket();
  const { isExpert, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUserId = localStorage.getItem('userId');

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

  // Handle new messages
  useEffect(() => {
    if (!newMessage || !selectedChat) return;
    if (newMessage.chatId && newMessage.chatId === selectedChat._id && newMessage.message) {
      setMessages(prev => [...prev, newMessage.message]);
      scrollToBottom();
      clearUnreadCount?.(selectedChat._id);
    }
  }, [newMessage, selectedChat, clearUnreadCount]);

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
      if (!selectedChat || !isExpert) return;
      const other = getOtherParticipant(selectedChat);
      if (!other) return;

      try {
        const { data } = await axios.get('/api/users/blocked');
        const blockedIds = data.map(u => u._id);
        setIsBlocked(blockedIds.includes(other._id));
      } catch {
        setIsBlocked(false);
      }
    };
    checkBlockStatus();
  }, [selectedChat, isExpert]);

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!messageText.trim() || !selectedChat) return;

    setSending(true);
    try {
      const { data } = await axios.post(`/api/chats/${selectedChat._id}/messages`, {
        content: messageText.trim()
      });

      setMessages(prev => [...prev, data]);
      setMessageText('');

      // Send via socket for real-time delivery
      const other = getOtherParticipant(selectedChat);
      if (sendChatMessage && other?._id) {
        // Relay minimal data; receiver will update UI via receive_message
        await sendChatMessage(selectedChat._id, other._id, { content: data.content });
      }

    } catch (error) {
      console.error('Send message error:', error);
      toast.error(error.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
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
    const diffTime = Math.abs(now - messageDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return messageDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return messageDate.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
              <p>No conversations yet</p>
              <button onClick={() => navigate('/experts')} className="btn-primary">
                Find an Expert
              </button>
            </div>
          ) : (
            chats.map(chat => {
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
                      <span className="chat-name">{otherUser?.name}</span>
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
                <img
                  src={getOtherParticipant(selectedChat)?.avatar || 'https://via.placeholder.com/40'}
                  alt={getOtherParticipant(selectedChat)?.name}
                  className="chat-header-avatar"
                />
                <div className="chat-header-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h3>{getOtherParticipant(selectedChat)?.name}</h3>
                    {getOtherParticipant(selectedChat)?.role === 'expert' && getOtherParticipant(selectedChat)?.isVerified && (
                      <VerifiedBadge size="small" />
                    )}
                  </div>
                  <span
                    className="chat-header-role"
                    style={{
                      color: getOtherParticipant(selectedChat)?.role === 'expert'
                        ? (getExpertStatus?.(getOtherParticipant(selectedChat)?._id)?.color || '#6c757d')
                        : '#6c757d'
                    }}
                  >
                    {getOtherParticipant(selectedChat)?.role === 'expert'
                      ? (getExpertStatus?.(getOtherParticipant(selectedChat)?._id)?.text || 'Offline')
                      : 'User'
                    }
                  </span>
                </div>
              </div>
              <div className="chat-header-actions">
                {isExpert && (
                  <button
                    className={`chat-options-btn ${isBlocked ? 'unblock-btn' : 'block-btn'}`}
                    onClick={handleBlockToggle}
                    title={isBlocked ? 'Unblock User' : 'Block User'}
                  >
                    <FiSlash style={{ marginRight: '4px' }} />
                    {isBlocked ? 'Unblock' : 'Block'}
                  </button>
                )}
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
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isOwn = msg.sender === currentUserId;
                  const prevMsg = index > 0 ? messages[index - 1] : null;
                  const showDateSeparator = shouldShowDateSeparator(msg, prevMsg);

                  return (
                    <div key={index}>
                      {showDateSeparator && (
                        <div className="date-separator">
                          <span>{formatDateSeparator(msg.createdAt)}</span>
                        </div>
                      )}
                      <div className={`message ${isOwn ? 'own' : 'other'}`}>
                        <div className="message-bubble">
                          <p>{msg.content}</p>
                          <span className="message-time">{formatTime(msg.createdAt)}</span>
                          {isOwn && <span className="message-status">✓✓</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
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
