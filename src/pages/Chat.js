import { useEffect, useRef, useState } from 'react';
import { FiArrowLeft, FiSearch, FiSend, FiSlash, FiTrash2 } from 'react-icons/fi';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import VerifiedBadge from '../components/VerifiedBadge';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import './Chat.css';

// Import Agora Chat SDK
import { AgoraChat } from 'agora-chat';

let chatClient = null;

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
  const [chatConnection, setChatConnection] = useState('disconnected');
  const [unreadCount, setUnreadCount] = useState({});
  const messagesEndRef = useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUserId = user?._id;

  // Initialize Agora Chat
  useEffect(() => {
    if (!user?._id) return;

    const initAgoraChat = async () => {
      try {
        setChatConnection('connecting');
        console.log('🔌 Initializing Agora Chat...');

        // Get Agora Chat token from backend
        const { data } = await axios.get('/api/agora/chat-token');
        
        if (!data.success || !data.token) {
          throw new Error('Failed to get chat token from backend');
        }

        // Initialize Agora Chat SDK
        if (chatClient) {
          chatClient.removeEventHandler('connection');
          chatClient.removeEventHandler('message');
          chatClient.close();
        }

        chatClient = new AgoraChat.connection({
          appKey: process.env.REACT_APP_AGORA_CHAT_APP_KEY || data.appKey,
        });

        // Listen for connection events
        chatClient.addEventHandler('connection', {
          onConnected: () => {
            console.log('✅ Agora Chat connected');
            setChatConnection('connected');
          },
          onDisconnected: () => {
            console.log('🔌 Agora Chat disconnected');
            setChatConnection('disconnected');
          },
          onTokenWillExpire: () => {
            console.log('🔄 Token expiring, refreshing...');
            // Handle token refresh
            axios.get('/api/agora/chat-token')
              .then(res => {
                if (res.data.success) {
                  chatClient.renewToken(res.data.token);
                }
              })
              .catch(err => console.error('Token refresh error:', err));
          },
        });

        // Listen for new messages
        chatClient.addEventHandler('message', {
          onTextMessage: (message) => {
            console.log('📨 New message received:', message);
            handleIncomingMessage(message);
          },
        });

        // Login to Agora Chat
        await chatClient.open({
          user: user._id.toString(),
          accessToken: data.token,
        });

        console.log('✅ Agora Chat initialized and connected');
        setChatConnection('connected');
      } catch (error) {
        console.error('❌ Agora Chat initialization error:', error);
        setChatConnection('error');
        toast.error(error.message || 'Failed to connect to chat');
      }
    };

    initAgoraChat();

    return () => {
      if (chatClient) {
        chatClient.removeEventHandler('connection');
        chatClient.removeEventHandler('message');
        chatClient.close();
        chatClient = null;
      }
    };
  }, [user?._id]);

  const handleIncomingMessage = (message) => {
    const senderId = message.from;
    const content = message.msg;
    const messageTime = new Date(message.time).toISOString();
    
    // Check if this message belongs to the currently selected chat
    const otherParticipant = selectedChat ? getOtherParticipant(selectedChat) : null;
    const isForCurrentChat = otherParticipant && senderId === otherParticipant._id.toString();

    if (isForCurrentChat) {
      // Add message to current chat
      const newMessage = {
        _id: message.id,
        content: content,
        sender: senderId,
        createdAt: messageTime,
        read: true
      };
      setMessages(prev => [...prev, newMessage]);
      scrollToBottom();
      
      // Play notification sound
      playNotificationSound();
    } else {
      // Increment unread count for the chat
      const chatId = findChatIdByParticipant(senderId);
      if (chatId) {
        setUnreadCount(prev => ({
          ...prev,
          [chatId]: (prev[chatId] || 0) + 1
        }));
        playNotificationSound();
      }
    }
    
    // Reload chats to update last message
    loadChats();
  };

  const playNotificationSound = () => {
    try {
      const audio = new Audio('/assets/new-message-tone.mp3');
      audio.play().catch(err => console.log('Audio play error:', err));
    } catch (e) {
      console.log('Sound notification error:', e);
    }
  };

  const findChatIdByParticipant = (participantId) => {
    const chat = chats.find(chat => {
      const other = getOtherParticipant(chat);
      return other && other._id.toString() === participantId;
    });
    return chat?._id;
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
    const interval = setInterval(loadChats, 30000);
    return () => clearInterval(interval);
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
        navigate('/chat', { replace: true });
      }
    }
  }, [chats, searchParams, currentUserId, selectedChat, navigate]);

  // Load messages when chat is selected
  useEffect(() => {
    if (!selectedChat) return;

    loadMessages(selectedChat._id);

    // Mark as read in backend
    (async () => {
      try {
        await axios.put(`/api/chats/${selectedChat._id}/read`);
        // Clear unread count for this chat
        setUnreadCount(prev => {
          const newState = { ...prev };
          delete newState[selectedChat._id];
          return newState;
        });
      } catch (e) {
        console.log('Mark read error:', e);
      }
    })();
  }, [selectedChat]);

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
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
      setChats([]);
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
        const { data } = await axios.get('/api/users/blocked');
        const blockedIds = data.map(u => u._id);
        const hasBlocked = blockedIds.includes(other._id);
        setIsBlocked(hasBlocked);
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

    if (!messageText.trim() || !selectedChat || !chatClient) return;

    const otherUser = getOtherParticipant(selectedChat);
    if (!otherUser) return;

    // Optimistic UI update
    const tempMessage = {
      _id: `temp-${Date.now()}`,
      content: messageText.trim(),
      sender: currentUserId,
      createdAt: new Date().toISOString(),
      status: 'sending',
      isOptimistic: true
    };

    setMessages(prev => [...prev, tempMessage]);
    const messageToSend = messageText.trim();
    setMessageText('');
    scrollToBottom();

    setSending(true);

    try {
      // Send via Agora Chat
      const msg = AgoraChat.message.create({
        type: 'txt',
        msg: messageToSend,
        to: otherUser._id.toString(),
        chatType: 'singleChat',
      });

      await chatClient.send(msg);
      
      // Also save to backend for persistence and history
      const { data } = await axios.post(`/api/chats/${selectedChat._id}/messages`, {
        content: messageToSend
      });

      // Replace temp message with real message
      setMessages(prev => prev.map(msg => 
        msg._id === tempMessage._id ? { ...data, status: 'sent' } : msg
      ));

      // Reload chats to update last message
      loadChats();

    } catch (error) {
      console.error('Send message error:', error);
      
      const errorMessage = error.response?.data?.message || error.message;
      if (errorMessage?.includes('blocked')) {
        setIsBlockedByOther(true);
      }
      
      toast.error(errorMessage || 'Failed to send message');
      
      setMessages(prev => prev.map(msg => 
        msg._id === tempMessage._id ? { ...msg, status: 'failed' } : msg
      ));
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
          {chatConnection === 'connected' && (
            <div className="connection-status" title="Agora Chat Connected">
              <div className="status-dot connected"></div>
            </div>
          )}
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
              <button onClick={() => navigate('/')} className="btn-primary">
                Find an Expert
              </button>
            </div>
          ) : (
            filteredChats.map(chat => {
              const otherUser = getOtherParticipant(chat);

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
                      {unreadCount[chat._id] > 0 && (
                        <span className="unread-badge">{unreadCount[chat._id]}</span>
                      )}
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
                </div>
                <div className="chat-header-info">
                  <div className="name-row">
                    <h3>{getOtherParticipant(selectedChat)?.name}</h3>
                    {getOtherParticipant(selectedChat)?.role === 'expert' && getOtherParticipant(selectedChat)?.isVerified && (
                      <VerifiedBadge size="small" />
                    )}
                  </div>
                  <span className="status-label">
                    {chatConnection === 'connected' ? 'Online' : 
                     chatConnection === 'connecting' ? 'Connecting...' : 'Offline'}
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
                  <p>Start conversation with {getOtherParticipant(selectedChat)?.name}</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isOwn = String(msg.sender?._id || msg.sender) === String(currentUserId);
                  const prevMsg = index > 0 ? messages[index - 1] : null;
                  const showDateSeparator = shouldShowDateSeparator(msg, prevMsg);
                  const otherUser = getOtherParticipant(selectedChat);

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
                            {otherUser?.avatar ? (
                              <img src={otherUser.avatar} alt="" />
                            ) : (
                              <div className="avatar-placeholder-small">
                                {otherUser?.name?.charAt(0)?.toUpperCase()}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="message-content">
                          {!isOwn && (
                            <span className="sender-name">{otherUser?.name}</span>
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
                        {isOwn && (
                          <div className="message-avatar">
                            {user?.avatar ? (
                              <img src={user.avatar} alt="" />
                            ) : (
                              <div className="avatar-placeholder-small">
                                {user?.name?.charAt(0)?.toUpperCase()}
                              </div>
                            )}
                          </div>
                        )}
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
                  placeholder={
                    chatConnection === 'connecting' ? 'Connecting...' :
                    chatConnection === 'error' ? 'Connection error' :
                    chatConnection === 'disconnected' ? 'Disconnected' :
                    'Type a message...'
                  }
                  className="message-input"
                  disabled={sending || chatConnection !== 'connected'}
                  autoFocus
                  maxLength={1000}
                />
                <button type="submit" className="send-btn" disabled={sending || !messageText.trim() || chatConnection !== 'connected'}>
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
