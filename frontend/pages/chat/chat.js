import { get, post } from '../../utils/request';
import env from '../../config/env';

const HEARTBEAT_MS = 25000;
const RECONNECT_DELAY_MS = 3000;

Page({
  data: {
    sessionId: '',
    messages: [],         // [{ _id, senderId, content, type, createdAt, mine }]
    inputValue: '',
    sending: false,
    connected: false,
    scrollIntoView: '',   // id of the last message bubble
    myUserId: '',
  },

  onLoad(options) {
    const sessionId = options.sessionId || '';
    if (!sessionId) {
      wx.showToast({ title: '会话不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    const app = getApp();
    const myUserId = String(app.globalData.userInfo?._id || app.globalData.userInfo?.id || '');

    this.setData({ sessionId, myUserId });
    this.loadHistory();
    this.markRead();
    this.connect();
  },

  // Fire-and-forget — used so the chat-list badge clears next refresh.
  markRead() {
    post(`/chat/sessions/${this.data.sessionId}/read`, {}, false, { silent: true })
      .catch(() => {});
  },

  onUnload() {
    this.intentionalClose = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socketTask) {
      try { this.socketTask.close({}); } catch (_e) {}
    }
  },

  async loadHistory() {
    try {
      const history = await get(`/chat/history/${this.data.sessionId}`);
      const list = Array.isArray(history) ? history : history?.data || [];
      const messages = list.map((m) => this.decorateMessage(m));
      this.setData({ messages }, () => this.scrollToBottom());
    } catch (err) {
      wx.showToast({ title: '加载历史失败', icon: 'none' });
    }
  },

  decorateMessage(m) {
    const senderId = m.senderId?.toString?.() || m.senderId || '';
    return {
      _id: m._id || `local-${Date.now()}-${Math.random()}`,
      senderId,
      content: m.content,
      type: m.type || 'text',
      createdAt: m.createdAt || new Date().toISOString(),
      mine: senderId === this.data.myUserId,
    };
  },

  // Open WS, authenticate via token in query string (WeChat does not
  // reliably support custom WS handshake headers).
  connect() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const url = `${env.wsUrl}/chat?token=${encodeURIComponent(token)}`;
    console.log('[WS] connecting:', url);
    this.socketTask = wx.connectSocket({
      url,
      fail: (err) => {
        console.error('[WS] connectSocket fail:', err);
        wx.showToast({ title: 'WebSocket 连接失败', icon: 'none' });
      },
    });

    this.socketTask.onOpen(() => {
      console.log('[WS] open');
      this.setData({ connected: true });
      this.send('joinSession', { sessionId: this.data.sessionId });
      this.startHeartbeat();
    });

    this.socketTask.onMessage((res) => this.handleIncoming(res.data));

    this.socketTask.onClose((e) => {
      console.warn('[WS] close', e);
      this.setData({ connected: false });
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      if (!this.intentionalClose) this.scheduleReconnect();
    });

    this.socketTask.onError((e) => {
      console.error('[WS] error', e);
      this.setData({ connected: false });
      if (!this.intentionalClose) this.scheduleReconnect();
    });
  },

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
  },

  startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.send('ping', {});
    }, HEARTBEAT_MS);
  },

  handleIncoming(raw) {
    let payload;
    try { payload = typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch (_e) { return; }

    const { event, data } = payload || {};
    if (event === 'receiveMessage') {
      const decorated = this.decorateMessage(data);
      // Replace optimistic temp message if echoed back from our own send
      const messages = this.data.messages.filter(
        (m) => !(m.mine && m.pending && m.content === decorated.content),
      );
      messages.push(decorated);
      this.setData({ messages }, () => this.scrollToBottom());
      // If the new message is from the other party, mark as read immediately
      if (!decorated.mine) this.markRead();
    } else if (event === 'error') {
      wx.showToast({ title: data?.message || '错误', icon: 'none', duration: 2500 });
      // Auth errors cannot be retried with the same token — stop reconnecting
      // and redirect to login so the user can get a fresh token.
      if (data?.message?.includes('认证') || data?.message?.includes('登录')) {
        this.intentionalClose = true;
        setTimeout(() => {
          getApp().logout();
          wx.navigateTo({ url: '/pages/login/login' });
        }, 1500);
      }
    } else if (event === 'joined') {
      // no-op — could show a "已连接" indicator
    }
  },

  send(event, data) {
    if (!this.socketTask) return;
    try {
      this.socketTask.send({ data: JSON.stringify({ event, data }) });
    } catch (_e) {}
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  onSendTap() {
    const content = this.data.inputValue.trim();
    if (!content) return;
    if (!this.data.connected) {
      wx.showToast({ title: '正在连接，请稍候...', icon: 'none' });
      return;
    }

    // Optimistic append — server will echo back via receiveMessage with the real _id
    const tempMsg = {
      _id: `pending-${Date.now()}`,
      senderId: this.data.myUserId,
      content,
      type: 'text',
      createdAt: new Date().toISOString(),
      mine: true,
      pending: true,
    };
    this.setData({
      messages: [...this.data.messages, tempMsg],
      inputValue: '',
    }, () => this.scrollToBottom());

    this.send('sendMessage', { sessionId: this.data.sessionId, content, type: 'text' });
  },

  scrollToBottom() {
    const list = this.data.messages;
    if (!list.length) return;
    const lastId = `msg-${list[list.length - 1]._id}`;
    this.setData({ scrollIntoView: lastId });
  },
});
