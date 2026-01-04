import { AgoraChat } from 'agora-chat';
import { useEffect, useRef, useState } from 'react';
import { FiSend, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import './AgoraChatWindow.css';

// Import message sound
const newMessageSound = new Audio('/assets/new-message-tone.mp3');

const AgoraChatWindow = ({ isOpen, onClose, recipientId, recipientName, recipientAvatar }) => {
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [chatConnection, setChatConnection] = useState('disconnected');
  const messagesEndRef = useRef(null);
  const chatClientRef = useRef(null);
  const { user } = useAuth();

  // Initialize Agora Chat
  useEffect(() => {
    if (!isOpen || !user?._id) return;

    const initAgoraChat = async () => {
      try {
        console.log('🔌 Initializing Agora Chat...');
        
        // Get Agora Chat token from backend
        const { data } = await axios.get('/api/agora/chat-token');
        
        // Initialize Agora Chat SDK
        const chatClient = new AgoraChat.connection({
          appKey: process.env.REACT_APP_AGORA_CHAT_APP_KEY,
        });

        chatClientRef.current = chatClient;

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
        });

        // Listen for new messages
        chatClient.addEventHandler('message', {
          onTextMessage: (message) => {
            console.log('📨 New message received:', message);
            
            // Play notification sound
            if (!document.hidden) {
              newMessageSound.play().catch(e => console.log('Could not play sound:', e));
            }
            
            // Show toast notification
            toast.success(`New message from ${recipientName}`, {
              position: 'top-right',
              autoClose: 3000,
              toastId: `msg-${message.id}`,
              hideProgressBar: true
            });
            
            // Add message to list
            const newMessage = {
              _id: message.id,
              content: message.msg,
              sender: message.from,
              createdAt: new Date(message.time).toISOString(),
              status: 'received'
            };
            setMessages(prev => [...prev, newMessage]);
            scrollToBottom();
          },
        });

        // Login to Agora Chat
        await chatClient.open({
          user: user._id,
          accessToken: data.token,
        });

        console.log('✅ Agora Chat initialized and connected');
      } catch (error) {
        console.error('❌ Agora Chat initialization error:', error);
        setChatConnection('error');
        toast.error('Failed to connect to chat');
      }
    };

    initAgoraChat();

    // Load message history from backend
    loadMessages();

    return () => {
      if (chatClientRef.current) {
        chatClientRef.current.removeEventHandler('connection');
        chatClientRef.current.removeEventHandler('message');
        chatClientRef.current.close();
      }
    };
  }, [isOpen, user?._id, recipientId, recipientName]);

  // Load message history from backend
  const loadMessages = async () => {
    try {
      const { data } = await axios.get(`/api/chats/get-or-create/messages?participantId=${recipientId}`);
      if (data.messages) {
        setMessages(data.messages);
        // Auto-scroll to bottom after loading
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!messageText.trim() || !chatClientRef.current) return;

    if (chatConnection !== 'connected') {
      toast.error('Chat not connected. Please wait...');
      return;
    }

    setSending(true);

    // Optimistic UI update
    const tempMessage = {
      _id: `temp-${Date.now()}`,
      content: messageText.trim(),
      sender: user._id,
      createdAt: new Date().toISOString(),
      status: 'sending',
      isOptimistic: true
    };

    setMessages(prev => [...prev, tempMessage]);
    setMessageText('');
    scrollToBottom();

    try {
      // Send via Agora Chat
      const msg = AgoraChat.message.create({
        type: 'txt',
        msg: messageText.trim(),
        to: recipientId,
        chatType: 'singleChat',
      });

      await chatClientRef.current.send(msg);
      
      // Also save to backend for persistence
      const { data } = await axios.post(`/api/chats/get-or-create/messages`, {
        participantId: recipientId,
        content: messageText.trim()
      });

      // Replace temp message with real message
      setMessages(prev => prev.map(msg => 
        msg._id === tempMessage._id ? { ...data, status: 'sent' } : msg
      ));

    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Failed to send message');
      
      // Mark message as failed
      setMessages(prev => prev.map(msg => 
        msg._id === tempMessage._id ? { ...msg, status: 'failed' } : msg
      ));
    } finally {
      setSending(false);
    }
  };

  // Check if message is from current user
  const isOwnMessage = (msg) => String(msg.sender?._id || msg.sender) === String(user._id);

  // Format time
  const formatTime = (date) => {
    const messageDate = new Date(date);
    const now = new Date();
    const isToday = messageDate.toDateString() === now.toDateString();
    
    if (isToday) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
             messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="agora-chat-window-overlay" onClick={onClose}>
      <div className="agora-chat-window" onClick={e => e.stopPropagation()}>
        
        {/* Chat Header */}
        <div className="agora-chat-header">
          <div className="agora-chat-header-info">
            <div className="recipient-avatar">
              {recipientAvatar ? (
                <img src={recipientAvatar} alt={recipientName} />
              ) : (
                <div className="avatar-placeholder">
                  {recipientName?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="recipient-details">
              <div className="recipient-name">
                {recipientName}
                {/* Could add verified badge here if expert */}
              </div>
              <div className={`recipient-status ${isOnline ? 'online' : 'offline'}`}>
                <span className="status-dot"></span>
                <span className="status-text">{isOnline ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>
          <button className="close-chat-btn" onClick={onClose} title="Close chat">
            <FiX />
          </button>
        </div>

        {/* Messages Area */}
        <div className="agora-chat-messages">
          {messages.length === 0 ? (
            <div className="no-messages">
              <div className="empty-icon">💬</div>
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const own = isOwnMessage(msg);
              
              return (
                <div key={msg._id || index} className={`agora-message ${own ? 'own' : 'other'}`}>
                  {!own && (
                    <div className="message-avatar-small">
                      {recipientAvatar ? (
                        <img src={recipientAvatar} alt="" />
                      ) : (
                        <div className="avatar-placeholder-small">
                          {recipientName?.charAt(0)?.toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="message-content-wrapper">
                    <div className={`message-bubble ${own ? 'sent' : 'received'} ${msg.status}`}>
                      <p>{msg.content}</p>
                      <div className="message-meta">
                        <span className="message-time">{formatTime(msg.createdAt)}</span>
                        {own && (
                          <span className="message-status">
                            {msg.status === 'sending' ? '🕒' : 
                             msg.status === 'failed' ? '⚠️' : '✓✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {own && (
                    <div className="message-avatar-small">
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
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="agora-chat-input-wrapper">
          {isBlocked ? (
            <div className="blocked-message">
              <span className="blocked-icon">🚫</span>
              <span>This conversation is blocked</span>
            </div>
          ) : (
            <form className="agora-chat-input-form" onSubmit={handleSendMessage}>
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={chatConnection !== 'connected' ? 'Connecting...' : 'Type a message...'}
                className="agora-chat-input"
                disabled={sending || chatConnection !== 'connected'}
                maxLength={1000}
              />
              <button 
                type="submit" 
                className="send-message-btn"
                disabled={sending || !messageText.trim() || chatConnection !== 'connected'}
                title="Send message"
              >
                {sending ? '🕒' : <FiSend />}
              </button>
            </form>
          )}
        </div>

        {/* Connection Status Indicator */}
        {chatConnection !== 'connected' && (
          <div className="connection-status-indicator">
            <span className={`status-dot ${chatConnection}`}></span>
            <span className="status-text">
              {chatConnection === 'connecting' ? 'Connecting...' : 
               chatConnection === 'error' ? 'Connection error' : 'Disconnected'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgoraChatWindow;
