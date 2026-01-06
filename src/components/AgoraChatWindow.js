import { useCallback, useEffect, useRef, useState } from 'react';
import { FiSend, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import {
    connectChatSession,
    fromRtmUserId,
    sendTextMessage,
    subscribeToConnection,
    subscribeToMessages,
    toRtmUserId,
} from '../services/agoraChatClient';
import './AgoraChatWindow.css';

// Import message sound
const newMessageSound = new Audio('/assets/new-message-tone.mp3');

const AgoraChatWindow = ({ isOpen, onClose, recipientId, recipientName, recipientAvatar }) => {
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [isOnline] = useState(false);
  const [isBlocked] = useState(false);
  const [chatConnection, setChatConnection] = useState('disconnected');
  const messagesEndRef = useRef(null);
  const chatSessionRef = useRef(null);
  const { user } = useAuth();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const { data } = await axios.get(`/api/chats/get-or-create/messages?participantId=${recipientId}`);
      if (data.messages) {
        setMessages(data.messages);
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, [recipientId, scrollToBottom]);

  // Initialize Agora Chat
  useEffect(() => {
    if (!isOpen || !user?._id) return;

    let release = null;
    const unsubscribeConn = subscribeToConnection((status) => setChatConnection(status));
    const unsubscribeMsg = subscribeToMessages((message) => {
      const senderDbId = fromRtmUserId(message.from);
      if (String(senderDbId) !== String(recipientId)) return;

      // Prevent duplicates
      setMessages(prev => {
        if (prev.some(m => m._id === message.id)) return prev;
        return [...prev, {
          _id: message.id,
          content: message.msg,
          sender: senderDbId,
          createdAt: new Date(message.time).toISOString(),
          status: 'received'
        }];
      });

      if (!document.hidden) {
        newMessageSound.play().catch(() => {});
      }

      toast.success(`New message from ${recipientName}`, {
        position: 'top-right',
        autoClose: 3000,
        toastId: `msg-${message.id}`,
        hideProgressBar: true
      });
    });

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

    // Load message history from backend
    loadMessages();

    return () => {
      unsubscribeConn();
      unsubscribeMsg();
      if (release) release();
      chatSessionRef.current = null;
    };
  }, [isOpen, user?._id, recipientId, recipientName, loadMessages]);

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!messageText.trim() || !chatSessionRef.current) return;

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
    const contentToSend = messageText.trim();
    setMessageText('');
    scrollToBottom();

    try {
      // Send via Agora Chat
      await sendTextMessage({ to: toRtmUserId(recipientId), text: contentToSend });
      
      // Also save to backend for persistence
      const { data } = await axios.post(`/api/chats/get-or-create/messages`, {
        participantId: recipientId,
        content: contentToSend
      });

      // Replace temp message with real message
      setMessages(prev => prev.map(msg => 
        msg._id === tempMessage._id ? { ...data, status: 'sent' } : msg
      ));

    } catch (error) {
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
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const prevSender = prevMsg ? (prevMsg.sender?._id || prevMsg.sender) : null;
              const sender = msg.sender?._id || msg.sender;
              const isGroupStart = !prevMsg || String(prevSender) !== String(sender);
              
              return (
                <div key={msg._id || index} className={`agora-message ${own ? 'own' : 'other'}`}>
                  {!own && (
                    <div className={`message-avatar-small ${isGroupStart ? '' : 'message-avatar-spacer'}`}>
                      {isGroupStart ? (
                        recipientAvatar ? (
                          <img src={recipientAvatar} alt="" />
                        ) : (
                          <div className="avatar-placeholder-small">
                            {recipientName?.charAt(0)?.toUpperCase()}
                          </div>
                        )
                      ) : null}
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
