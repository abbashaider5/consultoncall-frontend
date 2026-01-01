import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { axiosInstance } from '../config/api';
import './ChatWindow.css';

const ChatWindow = ({ isOpen, onClose, recipientId, recipientName, recipientAvatar }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const {
        sendMessage,
        sendTyping,
        markMessagesRead,
        newMessage: incomingMessage,
        socket
    } = useSocket();
    const { user, expert, isExpert } = useAuth();

    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const inputRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    const currentUserId = isExpert ? expert._id : user._id;

    // Initial Fetch
    useEffect(() => {
        if (isOpen && recipientId) {
            fetchMessages(1, true);
            // Mark read
            // markMessagesRead(recipientId, []); // We can implement bulk read later
        }
    }, [isOpen, recipientId]);

    // Handle Incoming Real-time Messages
    useEffect(() => {
        if (incomingMessage && isOpen) {
            if (incomingMessage.senderId === recipientId || incomingMessage.receiverId === recipientId) {
                // Check if message already exists (to avoid duplicates from optimistic updates if any)
                setMessages(prev => {
                    const exists = prev.some(m => m._id === incomingMessage.tempId || m._id === incomingMessage._id);
                    if (exists) return prev;
                    return [...prev, {
                        _id: incomingMessage._id || incomingMessage.tempId || Date.now(),
                        sender: incomingMessage.senderId,
                        content: incomingMessage.content,
                        createdAt: incomingMessage.timestamp,
                        type: incomingMessage.type
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

    const fetchMessages = async (pageNum, reset = false) => {
        try {
            if (!recipientId) return;
            setIsLoading(true);
            const res = await axiosInstance.get(`/api/chat/history/${recipientId}?page=${pageNum}`);

            if (res.data.success) {
                setMessages(prev => reset ? res.data.messages : [...res.data.messages, ...prev]);
                setHasMore(res.data.hasMore);
                setPage(pageNum);
                if (reset) scrollToBottom();
            }
        } catch (error) {
            console.error('Failed to fetch messages', error);
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
            status: 'sending'
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setNewMessage('');
        scrollToBottom();

        try {
            // 1. Persist to DB
            const res = await axiosInstance.post('/api/chat/send', {
                receiverId: recipientId,
                content: content
            });

            if (res.data.success) {
                const savedMsg = res.data.message;

                // Update optimistic message with real one
                setMessages(prev => prev.map(m => m._id === tempId ? { ...savedMsg, sender: savedMsg.sender._id } : m));

                // 2. Emit to Socket (for real-time delivery to recipient)
                sendMessage(recipientId, content);
            }
        } catch (error) {
            console.error('Failed to send message', error);
            setMessages(prev => prev.map(m => m._id === tempId ? { ...m, status: 'failed' } : m));
        }
    };

    const handleTyping = (e) => {
        setNewMessage(e.target.value);

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        sendTyping(recipientId, true);

        typingTimeoutRef.current = setTimeout(() => {
            sendTyping(recipientId, false);
        }, 2000);
    };

    if (!isOpen) return null;

    return (
        <div className={`chat-window-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
            <div className="chat-window" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="chat-header">
                    <div className="recipient-info">
                        <div className="avatar-container">
                            {recipientAvatar ? (
                                <img src={recipientAvatar} alt={recipientName} />
                            ) : (
                                <div className="avatar-placeholder">{recipientName?.charAt(0)}</div>
                            )}
                            <div className="online-status-dot"></div>
                        </div>
                        <div className="text-info">
                            <h3>{recipientName}</h3>
                            <span className="status-text">Online</span>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                {/* Messages */}
                <div className="messages-container" ref={chatContainerRef}>
                    {messages.length === 0 && (
                        <div className="empty-state">
                            <p>Start a conversation with {recipientName}</p>
                        </div>
                    )}

                    {messages.map((msg, index) => {
                        const isMe = msg.sender === currentUserId || msg.sender?._id === currentUserId;
                        const showAvatar = !isMe && (index === 0 || messages[index - 1].sender !== msg.sender);

                        return (
                            <div key={msg._id} className={`message-wrapper ${isMe ? 'mine' : 'theirs'}`}>
                                {/* {showAvatar && !isMe && <div className="chat-avatar-small">{recipientName?.charAt(0)}</div>} */}
                                <div className="message-bubble">
                                    {msg.type === 'image' ? (
                                        <img src={msg.content} alt="Attachment" className="msg-image" />
                                    ) : (
                                        <p>{msg.content}</p>
                                    )}
                                    <span className="msg-time">
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {isMe && (
                                            <span className="msg-status">
                                                {msg.status === 'sending' ? '🕒' : '✓'}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <form className="chat-input-area" onSubmit={handleSend}>
                    <button type="button" className="attach-btn">
                        <i className="fa fa-paperclip"></i>
                    </button>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={handleTyping}
                    />
                    <button type="submit" className="send-btn" disabled={!newMessage.trim()}>
                        <i className="fa fa-paper-plane"></i>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatWindow;
