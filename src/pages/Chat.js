import { useCallback, useEffect, useRef, useState } from 'react';
import { FiArrowLeft, FiSearch, FiSend, FiSlash, FiTrash2 } from 'react-icons/fi';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import VerifiedBadge from '../components/VerifiedBadge';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import './Chat.css';

import {
  connectChatSession,
  fromRtmUserId,
  sendTextMessage,
  subscribeToConnection,
  subscribeToMessages,
  toRtmUserId,
} from '../services/agoraChatClient';

const Chat = () => {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatConnection, setChatConnection] = useState('disconnected');
  const [unreadCount, setUnreadCount] = useState({});
  const messagesEndRef = useRef(null);
  const chatSessionRef = useRef(null);
  const selectedChatRef = useRef(null);
  const chatsRef = useRef([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUserId = user?._id;

  const getOtherParticipant = useCallback((chat) => {
    return chat.participants.find(p => p._id !== currentUserId);
  }, [currentUserId]);

  // Load chats
  const loadChats = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/chats');
      if (Array.isArray(data)) {
        setChats(data);
      } else {
        setChats([]);
      }
    } catch {
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/assets/new-message-tone.mp3');
      audio.play().catch(() => {});
    } catch {
      // ignore
    }
  }, []);

  const findChatIdByParticipant = useCallback((participantId) => {
    const chat = chatsRef.current.find(chat => {
      const other = getOtherParticipant(chat);
      return other && other._id.toString() === participantId;
    });
    return chat?._id;
  }, [getOtherParticipant]);

  const handleIncomingMessage = useCallback((message) => {
    const senderRtmUserId = message.from;
    const senderDbId = fromRtmUserId(senderRtmUserId);
    const content = message.msg;
    const messageTime = new Date(message.time).toISOString();

    // Ignore self-echo if any
    if (String(senderRtmUserId) === String(toRtmUserId(currentUserId))) {
      return;
    }
    
    // Check if this message belongs to currently selected chat
    const activeChat = selectedChatRef.current;
    const otherParticipant = activeChat ? getOtherParticipant(activeChat) : null;
    const isForCurrentChat = otherParticipant && String(senderDbId) === String(otherParticipant._id);

    if (isForCurrentChat) {
      // Add message to current chat
      setMessages(prev => {
        // Prevent duplicates
        if (prev.some(msg => msg._id === message.id)) {
          return prev;
        }
        return [...prev, {
          _id: message.id,
          content: content,
          sender: senderDbId,
          createdAt: messageTime,
          read: true
        }];
      });
      scrollToBottom();
      
      // Play notification sound
      playNotificationSound();
    } else {
      // Increment unread count for the chat
      const chatId = findChatIdByParticipant(senderDbId);
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
  }, [currentUserId, findChatIdByParticipant, getOtherParticipant, loadChats, playNotificationSound, scrollToBottom]);

  // Initialize Agora Chat - singleton/session
  useEffect(() => {
    if (!user?._id) return;

    let release = null;
    const unsubscribeConn = subscribeToConnection((status) => setChatConnection(status));
    const unsubscribeMsg = subscribeToMessages((message) => handleIncomingMessage(message));

    (async () => {
      try {
        setChatConnection('connecting');
        const session = await connectChatSession(user._id);
        chatSessionRef.current = session;
        release = session.release;
      } catch {
        setChatConnection('error');
        toast.error('Failed to connect to chat');
      }
    })();

    return () => {
      unsubscribeConn();
      unsubscribeMsg();
      if (release) release();
      chatSessionRef.current = null;
    };
  }, [handleIncomingMessage, user?._id]);

  // Filter chats by search
  const filteredChats = chats.filter(chat => {
    if (!searchQuery) return true;
    const other = getOtherParticipant(chat);
    return other?.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  

  // Initial load and periodic refresh
  useEffect(() => {
    loadChats();
    const interval = setInterval(loadChats, 30000);
    return () => clearInterval(interval);
  }, [loadChats]);

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

    const loadAndMarkRead = async () => {
      await loadMessages(selectedChat._id);
      
      try {
        await axios.put(`/api/chats/${selectedChat._id}/read`);
        setUnreadCount(prev => {
          const newState = { ...prev };
          delete newState[selectedChat._id];
          return newState;
        });
      } catch (e) {
        console.log('Mark read error:', e);
      }
    };

    loadAndMarkRead();
  }, [selectedChat, getOtherParticipant]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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
    } catch {
      toast.error(`Failed to ${action} user`);
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
  }, [selectedChat, getOtherParticipant]);

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!messageText.trim() || !selectedChat || !chatSessionRef.current || chatConnection !== 'connected') {
      return;
    }

    const otherUser = getOtherParticipant(selectedChat);
    if (!otherUser) return;

    const tempId = `temp-${Date.now()}`;
    const contentToSend = messageText.trim();
    setMessageText('');
    scrollToBottom();

    // Optimistic UI update
    setMessages(prev => [...prev, {
      _id: tempId,
      content: contentToSend,
      sender: currentUserId,
      createdAt: new Date().toISOString(),
      status: 'sending',
      isOptimistic: true
    }]);

    try {
      // Send via Agora Chat
      await sendTextMessage({
        to: toRtmUserId(otherUser._id),
        text: contentToSend
      });

      setMessages(prev => prev.map(m =>
        m._id === tempId ? { ...m, status: 'sent', isOptimistic: false } : m
      ));

      // Also save to backend for persistence
      const { data } = await axios.post(`/api/chats/${selectedChat._id}/messages`, {
        content: contentToSend
      });

      // Update with backend data
      setMessages(prev => prev.map(m =>
        m._id === tempId ? { ...data, status: 'sent' } : m
      ));

      // Reload chats to update last message
      loadChats();

    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      if (errorMessage?.includes('blocked')) {
        setIsBlockedByOther(true);
      }
      
      toast.error(errorMessage || 'Failed to send message');
      
      setMessages(prev => prev.map(m =>
        m._id === tempId ? { ...m, status: 'failed' } : m
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
            <div className="connection-status" title="Connected">
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
              <div className="no-chats-icon"></div>
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
                  {otherUser?.avatar ? (
                    <img
                      src={otherUser.avatar}
                      alt={otherUser?.name}
                      className="chat-avatar"
                    />
                  ) : (
                    <div className="chat-avatar chat-avatar-placeholder">
                      {otherUser?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
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
                  {getOtherParticipant(selectedChat)?.avatar ? (
                    <img
                      src={getOtherParticipant(selectedChat)?.avatar}
                      alt={getOtherParticipant(selectedChat)?.name}
                      className="chat-header-avatar"
                    />
                  ) : (
                    <div className="chat-header-avatar chat-avatar-placeholder">
                      {getOtherParticipant(selectedChat)?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
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
                  <div className="empty-icon"></div>
                  <h3>No messages yet</h3>
                  <p>Start conversation with {getOtherParticipant(selectedChat)?.name}</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const senderValue = msg.sender?._id || msg.sender;
                  const isOwn = String(senderValue) === String(currentUserId) || String(senderValue) === String(toRtmUserId(currentUserId));
                  const prevMsg = index > 0 ? messages[index - 1] : null;
                  const showDateSeparator = shouldShowDateSeparator(msg, prevMsg);
                  const otherUser = getOtherParticipant(selectedChat);
                  const prevSenderValue = prevMsg ? (prevMsg.sender?._id || prevMsg.sender) : null;
                  const isGroupStart = !prevMsg || showDateSeparator || String(prevSenderValue) !== String(senderValue);

                  return (
                    <div key={msg._id || index}>
                      {showDateSeparator && (
                        <div className="date-separator">
                          <span>{formatDateSeparator(msg.createdAt)}</span>
                        </div>
                      )}
                      <div className={`message ${isOwn ? 'own' : 'other'}`}>
                        {!isOwn && (
                          <div className={`message-avatar ${isGroupStart ? '' : 'message-avatar-spacer'}`}>
                            {isGroupStart ? (
                              otherUser?.avatar ? (
                                <img src={otherUser.avatar} alt="" />
                              ) : (
                                <div className="avatar-placeholder-small">
                                  {otherUser?.name?.charAt(0)?.toUpperCase()}
                                </div>
                              )
                            ) : null}
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
                              {isOwn && msg.status === 'failed' && (
                                <span className="message-status failed">Failed</span>
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
                <div className="blocked-icon"></div>
                <div className="blocked-text">
                  <strong>You are blocked</strong>
                  <p>This expert has blocked you. You cannot send messages.</p>
                </div>
              </div>
            ) : isBlocked ? (
              <div className="blocked-input-notice">
                <div className="blocked-icon"></div>
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
                    chatConnection === 'error' ? 'Reconnecting...' :
                    chatConnection === 'disconnected' ? 'Reconnecting...' :
                    'Type a message...'
                  }
                  className="message-input"
                  disabled={chatConnection !== 'connected'}
                  autoFocus
                  maxLength={1000}
                />
                <button 
                  type="submit" 
                  className="send-btn" 
                  disabled={!messageText.trim() || chatConnection !== 'connected'}
                >
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
