import AgoraChat from 'agora-chat';
import { axiosInstance as axios } from '../config/api';

let client = null;
let clientHandlersAttached = false;

let initPromise = null;
let currentRtmUserId = null;
let currentToken = null;

let refCount = 0;

let reconnectTimeoutId = null;
let reconnectAttempt = 0;
let reconnectInFlight = false;

const connectionSubscribers = new Set();
const messageSubscribers = new Set();

const isDev = process.env.NODE_ENV === 'development';
const debugLog = (...args) => {
  if (isDev) console.log(...args);
};

export const toRtmUserId = (dbUserId) => {
  if (!dbUserId) return null;
  return `chat_${String(dbUserId)}`;
};

export const fromRtmUserId = (rtmUserId) => {
  if (!rtmUserId) return null;
  const str = String(rtmUserId);
  return str.startsWith('chat_') ? str.slice('chat_'.length) : str;
};

const emitConnection = (status) => {
  for (const cb of connectionSubscribers) {
    try {
      cb(status);
    } catch {
      // ignore subscriber errors
    }
  }
};

const emitMessage = (message) => {
  for (const cb of messageSubscribers) {
    try {
      cb(message);
    } catch {
      // ignore subscriber errors
    }
  }
};

const ensureClient = () => {
  if (client) return client;

  const appKey = process.env.REACT_APP_AGORA_CHAT_APP_KEY;
  if (!appKey) {
    throw new Error('Agora Chat App Key not configured');
  }

  client = new AgoraChat.connection({ appKey });
  clientHandlersAttached = false;
  return client;
};

const isClientOpened = (chatClient) => {
  if (!chatClient) return false;
  try {
    if (typeof chatClient.isOpened === 'function') return !!chatClient.isOpened();
    if (typeof chatClient.isOpened !== 'undefined') return !!chatClient.isOpened;
  } catch {
    return false;
  }
  return false;
};

const clearReconnectTimer = () => {
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
};

const scheduleReconnect = () => {
  if (!currentRtmUserId) return;
  if (refCount <= 0) return;
  if (reconnectInFlight) return;
  if (reconnectTimeoutId) return;

  const delayMs = Math.min(1500 * Math.pow(2, reconnectAttempt), 15000);
  reconnectTimeoutId = setTimeout(async () => {
    reconnectTimeoutId = null;
    reconnectInFlight = true;
    reconnectAttempt += 1;
    try {
      await doOpenIfNeeded(currentRtmUserId);
      reconnectAttempt = 0;
    } catch (e) {
      debugLog('Reconnect attempt failed', e);
      scheduleReconnect();
    } finally {
      reconnectInFlight = false;
    }
  }, delayMs);
};

const attachHandlersOnce = () => {
  if (!client || clientHandlersAttached) return;

  client.addEventHandler('connection', {
    onConnected: () => {
      debugLog('✅ Agora Chat connected');
      emitConnection('connected');
    },
    onDisconnected: () => {
      debugLog('🔌 Agora Chat disconnected');
      emitConnection('disconnected');
      scheduleReconnect();
    },
    onTokenWillExpire: async () => {
      debugLog('🔄 Agora token expiring; refreshing');
      try {
        const { data } = await axios.get('/api/agora/chat-token');
        if (data?.success && data?.token) {
          currentToken = data.token;
          client.renewToken(data.token);
        }
      } catch (e) {
        debugLog('Token refresh failed', e);
      }
    },
    onError: (error) => {
      // Avoid red console spam in production; consumers can show UI feedback.
      debugLog('Agora connection error', error);
      emitConnection('error');
    },
  });

  client.addEventHandler('message', {
    onTextMessage: (message) => {
      emitMessage(message);
    },
  });

  clientHandlersAttached = true;
};

const fetchToken = async () => {
  const { data } = await axios.get('/api/agora/chat-token');
  if (!data?.success) {
    throw new Error(data?.message || 'Failed to fetch chat token');
  }
  if (!data?.rtmUserId || !data?.token) {
    throw new Error('Invalid chat token response');
  }
  return data;
};

const doOpenIfNeeded = async (expectedRtmUserId) => {
  const chatClient = ensureClient();
  attachHandlersOnce();

  if (currentRtmUserId === expectedRtmUserId && isClientOpened(chatClient)) {
    return;
  }

  emitConnection('connecting');

  const tokenResp = await fetchToken();
  if (tokenResp.rtmUserId !== expectedRtmUserId) {
    throw new Error('Chat identity mismatch (rtmUserId mismatch)');
  }

  currentRtmUserId = tokenResp.rtmUserId;
  currentToken = tokenResp.token;

  await chatClient.open({
    user: currentRtmUserId,
    accessToken: currentToken,
  });

  emitConnection('connected');
};

export const connectChatSession = async (dbUserId) => {
  const expectedRtmUserId = toRtmUserId(dbUserId);
  if (!expectedRtmUserId) {
    throw new Error('User not authenticated');
  }

  refCount += 1;
  clearReconnectTimer();

  if (!initPromise) {
    initPromise = (async () => {
      await doOpenIfNeeded(expectedRtmUserId);
    })().catch((e) => {
      // reset so future attempts can retry
      initPromise = null;
      throw e;
    });
  }

  await initPromise;

  return {
    getClient: () => client,
    rtmUserId: currentRtmUserId,
    release: () => {
      refCount -= 1;
      if (refCount <= 0) {
        refCount = 0;
        disconnectChat();
      }
    },
  };
};

export const disconnectChat = () => {
  if (!client) return;
  clearReconnectTimer();
  reconnectAttempt = 0;
  reconnectInFlight = false;
  try {
    client.removeEventHandler('connection');
    client.removeEventHandler('message');
    client.close();
  } catch {
    // ignore
  }
  client = null;
  initPromise = null;
  clientHandlersAttached = false;
  currentRtmUserId = null;
  currentToken = null;
  emitConnection('disconnected');
};

export const subscribeToConnection = (cb) => {
  connectionSubscribers.add(cb);
  return () => connectionSubscribers.delete(cb);
};

export const subscribeToMessages = (cb) => {
  messageSubscribers.add(cb);
  return () => messageSubscribers.delete(cb);
};

export const sendTextMessage = async ({ to, text }) => {
  const chatClient = ensureClient();
  if (!chatClient.isOpened?.()) {
    throw new Error('Chat not connected');
  }
  const msg = AgoraChat.message.create({
    type: 'txt',
    msg: text,
    to,
    chatType: 'singleChat',
  });

  await chatClient.send(msg);
  return msg;
};
