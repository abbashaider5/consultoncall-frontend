import { useEffect, useRef, useState } from 'react';
import { FaCheckCircle } from 'react-icons/fa';
import { FiMoreVertical, FiPaperclip, FiPhone, FiSend, FiVideo, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { axiosInstance } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './ChatWindow.css';

const ChatWindow = ({ isOpen, onClose, recipientId, recipientName, recipientAvatar, isVerified }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [onlineStatus, setOnlineStatus] = useState('offline');
    const [menuOpen, setMenuOpen] = useState(false);

    // Message sound
    const messageSoundRef = useRef(null);

    const {
        sendMessage,
        sendTyping,
        markMessagesRead,
        newMessage: incomingMessage,
        unreadCounts,
        clearUnreadCount,
        socket,
        getExpertStatus
    } = useSocket();
    const { user, expert, isExpert } = useAuth();

    const currentUserId = isExpert ? expert._id : user._id;
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const inputRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Initialize message sound
    useEffect(() => {
        if (!messageSoundRef.current) {
            messageSoundRef.current = new Audio('/assets/new-message-tone.mp3');
            messageSoundRef.current.volume = 0.3;
        }
    }, []);

    // Play message sound for incoming messages
    const playMessageSound = () => {
        if (messageSoundRef.current) {
            messageSoundRef.current.play().catch(err => console.log('Sound play error:', err));
        }
    };

    // Get online status from SocketContext
    useEffect(() => {
        if (recipientId) {
            const status = getExpertStatus(recipientId);
            setOnlineStatus(status.status || 'offline');
        }
    }, [recipientId, getExpertStatus]);

    // Check block status
    useEffect(() => {
        const checkBlockStatus = async () => {
            if (!recipientId) return;
            try {
                const { data } = await axiosInstance.get('/api/users/blocked');
                const blocked = data.some(blocked => blocked._id === recipientId);
                setIsBlocked(blocked);
            } catch (error) {
                console.error('Error checking block status:', error);
            }
        };
        if (isOpen) {
            checkBlockStatus();
        }
    }, [isOpen, recipientId]);

    // Clear unread count when chat opens
    useEffect(() => {
        if (isOpen && recipientId) {
            clearUnreadCount(recipientId);
        }
    }, [isOpen, recipientId, clearUnreadCount]);

    // Handle typing indicator
    useEffect(() => {
        const handleTyping = (e) => {
            if (e.detail?.senderId === recipientId) {
                setIsTyping(e.detail.isTyping);
            }
        };

        window.addEventListener('chat_typing', handleTyping);
        return () => window.removeEventListener('chat_typing', handleTyping);
    }, [recipientId]);

    // Handle block/unblock
    const handleBlockToggle = async () => {
        try {
            if (isBlocked) {
                await axiosInstance.post(`/api/users/unblock/${recipientId}`);
                setIsBlocked(false);
                toast.success('User unblocked');
            } else {
                await axiosInstance.post(`/api/users/block/${recipientId}`);
                setIsBlocked(true);
                toast.success('User blocked');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed');
        }
        setMenuOpen(false);
    };

    // Initial Fetch
    useEffect(() => {
        if (isOpen && recipientId) {
            fetchMessages();
        }
    }, [isOpen, recipientId]);

    // Handle Incoming Real-time Messages
    useEffect(() => {
        if (incomingMessage && isOpen) {
            if (incomingMessage.senderId === recipientId || incomingMessage.receiverId === recipientId) {
                // Check if message already exists (to avoid duplicates from optimistic updates)
                setMessages(prev => {
                    const exists = prev.some(m => m._id === incomingMessage.tempId || m._id === incomingMessage._id);
                    if (exists) return prev;
                    
                    // Play sound for incoming messages
                    if (incomingMessage.senderId === recipientId) {
                        playMessageSound();
                    }
                    
                    return [...prev, {
                        _id: incomingMessage._id || incomingMessage.tempId || Date.now(),
                        sender: incomingMessage.senderId,
                        content: incomingMessage.content,
                        createdAt: incomingMessage.timestamp || new Date().toISOString(),
                        type: incomingMessage.type || 'text'
                    }];
                });
                scrollToBottom();

                // Mark as read if from recipient
                if (incomingMessage.senderId === recipientId) {
                    markMessagesRead(recipientId, [incomingMessage._id]);
                }
            }
        }
    }, [incomingMessage, isOpen, recipientId]);

    const fetchMessages = async () => {
        try {
            if (!recipientId) return;
            setIsLoading(true);
            const res = await axiosInstance.get(`/api/chat/history/${recipientId}`);

            if (res.data.success) {
                setMessages(res.data.messages || []);
                setTimeout(scrollToBottom, 100);
            }
        } catch (error) {
            console.error('Failed to fetch messages', error);
            toast.error('Failed to load messages');
        } finally {
            setIsLoading(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const content = newMessage.trim();
        const tempId = Date.now().toString();

        // Optimistic UI Update
        const optimisticMsg = {
            _id: tempId,
            sender: currentUserId,
            content: content,
            createdAt: new Date().toISOString(),
            status: 'sending',
            type: 'text'
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setNewMessage('');
        scrollToBottom();
        inputRef.current?.focus();

        try {
            // 1. Persist to DB
            const res = await axiosInstance.post('/api/chat/send', {
                receiverId: recipientId,
                content: content
            });

            if (res.data.success) {
                const savedMsg = res.data.message;

                // Update optimistic message with real one
                setMessages(prev => prev.map(m => m._id === tempId ? { 
                    ...savedMsg, 
                    sender: savedMsg.sender._id,
                    status: 'sent',
                    type: 'text'
                } : m));

                // 2. Emit to Socket (for real-time delivery to recipient)
                await sendMessage(recipientId, content);
            }
        } catch (error) {
            console.error('Failed to send message', error);
            setMessages(prev => prev.map(m => m._id === tempId ? { ...m, status: 'failed' } : m));
            toast.error('Failed to send message');
        }
    };

    const handleTypingChange = (e) => {
        setNewMessage(e.target.value);

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        sendTyping(recipientId, true);

        typingTimeoutRef.current = setTimeout(() => {
            sendTyping(recipientId, false);
        }, 2000);
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        
        if (isToday) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
    };

    const isMe = (msg) => msg.sender === currentUserId || msg.sender?._id === currentUserId;

    if (!isOpen) return null;

    return (
        <div className={`messenger-chat-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
            <div className="messenger-chat-container" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="messenger-header">
                    <div className="header-left">
                        <button className="back-btn" onClick={onClose}>
                            <FiX />
                        </button>
                        <div className="profile-info">
                            <div className="avatar-wrapper">
                                {recipientAvatar ? (
                                    <img src={recipientAvatar} alt={recipientName} />
                                ) : (
                                    <div className="avatar-placeholder">{recipientName?.charAt(0)}</div>
                                )}
                                <div className={`status-indicator status-${onlineStatus}`}></div>
                            </div>
                            <div className="info-text">
                                <div className="name-row">
                                    <h3>{recipientName}</h3>
                                    {isVerified && <FaCheckCircle className="verified-badge" />}
                                </div>
                                <span className="status-label">
                                    {isTyping ? 'Typing...' : 
                                     onlineStatus === 'online' ? 'Active now' : 
                                     onlineStatus === 'busy' ? 'In a call' : 'Offline'}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="header-right">
                        <div className="header-actions">
                            <button className="action-btn" title="Voice Call">
                                <FiPhone />
                            </button>
                            <button className="action-btn" title="Video Call">
                                <FiVideo />
                            </button>
                            <div className="menu-wrapper">
                                <button 
                                    className="action-btn menu-btn" 
                                    onClick={() => setMenuOpen(!menuOpen)}
                                >
                                    <FiMoreVertical />
                                </button>
                                {menuOpen && (
                                    <div className="menu-dropdown">
                                        {isExpert && (
                                            <button className="menu-item" onClick={handleBlockToggle}>
                                                {isBlocked ? 'Unblock User' : 'Block User'}
                                            </button>
                                        )}
                                        <button className="menu-item" onClick={() => setMenuOpen(false)}>
                                            View Profile
                                        </button>
                                        <button className="menu-item" onClick={() => setMenuOpen(false)}>
                                            Search in Conversation
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="messenger-messages" ref={chatContainerRef}>
                    {isLoading && messages.length === 0 ? (
                        <div className="messages-loading">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className={`message-skeleton ${i % 2 === 0 ? 'received' : 'sent'}`}>
                                    <div className="skeleton-avatar"></div>
                                    <div className="skeleton-content">
                                        <div className="skeleton-bubble"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="empty-conversation">
                            <div className="empty-icon">💬</div>
                            <h3>No messages yet</h3>
                            <p>Start a conversation with {recipientName}</p>
                        </div>
                    ) : (
                        <div className="messages-list">
                            {messages.map((msg, index) => {
                                const sent = isMe(msg);
                                const showAvatar = !sent && (index === 0 || !isMe(messages[index - 1]));
                                
                                return (
                                    <div key={msg._id} className={`message-row ${sent ? 'sent' : 'received'}`}>
                                        {!sent && (
                                            <div className="message-avatar">
                                                {recipientAvatar ? (
                                                    <img src={recipientAvatar} alt="" />
                                                ) : (
                                                    <div className="avatar-placeholder-small">
                                                        {recipientName?.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="message-content">
                                            {!sent && showAvatar && (
                                                <span className="sender-name">{recipientName}</span>
                                            )}
                                            <div className="message-bubble-wrapper">
                                                <div className={`message-bubble ${sent ? 'sent' : 'received'} ${msg.type}`}>
                                                    {msg.type === 'image' ? (
                                                        <img src={msg.content} alt="Attachment" className="message-image" />
                                                    ) : (
                                                        <span className="message-text">{msg.content}</span>
                                                    )}
                                                    <div className="message-meta">
                                                        <span className="message-time">{formatTime(msg.createdAt)}</span>
                                                        {sent && (
                                                            <span className="message-status">
                                                                {msg.status === 'sending' ? (
                                                                    <span className="status-icon sending">🕒</span>
                                                                ) : msg.status === 'failed' ? (
                                                                    <span className="status-icon failed">⚠️</span>
                                                                ) : (
                                                                    <span className="status-icon sent">✓</span>
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Input Area */}
                {isBlocked ? (
                    <div className="blocked-notice">
                        <div className="blocked-icon">🚫</div>
                        <div className="blocked-text">
                            <strong>Conversation Blocked</strong>
                            <p>You have blocked this user. Unblock to send messages.</p>
                        </div>
                        {isExpert && (
                            <button className="unblock-btn" onClick={handleBlockToggle}>
                                Unblock
                            </button>
                        )}
                    </div>
                ) : (
                    <form className="messenger-input-area" onSubmit={handleSend}>
                        <button type="button" className="input-action-btn" title="Attach file">
                            <FiPaperclip />
                        </button>
                        <div className="input-wrapper">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Type a message..."
                                value={newMessage}
                                onChange={handleTypingChange}
                                autoComplete="off"
                            />
                        </div>
                        <button type="submit" className="send-btn" disabled={!newMessage.trim()}>
                            <FiSend />
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ChatWindow;
