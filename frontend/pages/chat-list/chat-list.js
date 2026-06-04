import { get, del, resolveImageUrl } from '../../utils/request';
import { checkLogin } from '../../utils/authUtil';
import { formatChatTime } from '../../utils/timeFormat';
import env from '../../config/env';

const DEFAULT_AVATAR = '/images/user.png';
const ACTION_WIDTH_PX = 80;  // width of the "删除" button revealed on swipe

Page({
  data: {
    sessions: [],
    loading: false,
    actionWidth: ACTION_WIDTH_PX,
    screenWidth: 375,
  },

  onLoad() {
    const { windowWidth } = wx.getSystemInfoSync();
    this.setData({ screenWidth: windowWidth });
  },

  onShow() {
    if (!checkLogin()) return;
    this.loadSessions();
  },

  onPullDownRefresh() {
    this.loadSessions().finally(() => wx.stopPullDownRefresh());
  },

  async loadSessions() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const res = await get('/chat/sessions');
      const list = Array.isArray(res) ? res : res?.data || [];
      const sessions = list.map((s) => this.decorate(s));
      this.setData({ sessions });
    } catch (_err) {
      // request.js already toasted; nothing else to do
    } finally {
      this.setData({ loading: false });
    }
  },

  decorate(s) {
    const counterparty = s.counterparty || {};
    return {
      sessionId: s.sessionId,
      counterparty: {
        id: counterparty.id || '',
        username: counterparty.username || '微信用户',
        avatarUrl: counterparty.avatarUrl
          ? resolveImageUrl(counterparty.avatarUrl, env.baseUrl)
          : DEFAULT_AVATAR,
      },
      associatedItemLabel: s.associatedItem
        ? `关于「${s.associatedItem.name || '物品'}」的对话`
        : '关于已失效物品的对话',
      lastMessageText: s.lastMessage?.content || '暂无消息',
      timeLabel: formatChatTime(s.lastMessage?.createdAt || s.updatedAt),
      unreadCount: s.unreadCount || 0,
      // movable-view per-row state — reset each refresh
      x: 0,
    };
  },

  // Tap → open the chat. Suppressed when the row is swiped open.
  onItemTap(e) {
    const { id, x } = e.currentTarget.dataset;
    if (x && x < 0) {
      // Row is in swipe-open state; first tap closes it
      this.resetRow(id);
      return;
    }
    wx.navigateTo({ url: `/pages/chat/chat?sessionId=${id}` });
  },

  // movable-view emits change events frequently while dragging.
  // We only persist the final x so we know if the row is open or closed.
  onMoveEnd(e) {
    const { id } = e.currentTarget.dataset;
    const x = e.detail.x;
    const sessions = this.data.sessions.map((s) =>
      s.sessionId === id ? { ...s, x: x < -ACTION_WIDTH_PX / 2 ? -ACTION_WIDTH_PX : 0 } : s,
    );
    this.setData({ sessions });
  },

  resetRow(sessionId) {
    const sessions = this.data.sessions.map((s) =>
      s.sessionId === sessionId ? { ...s, x: 0 } : s,
    );
    this.setData({ sessions });
  },

  async onDeleteTap(e) {
    const { id } = e.currentTarget.dataset;
    const ok = await new Promise((resolve) =>
      wx.showModal({
        title: '删除会话',
        content: '删除后此会话将从列表移除，对方再发送消息时会重新出现。',
        confirmColor: '#FF3B30',
        success: (res) => resolve(res.confirm),
      }),
    );
    if (!ok) {
      this.resetRow(id);
      return;
    }

    wx.showLoading({ title: '删除中...', mask: true });
    try {
      await del(`/chat/sessions/${id}`);
      this.setData({
        sessions: this.data.sessions.filter((s) => s.sessionId !== id),
      });
      wx.showToast({ title: '已删除', icon: 'success' });
    } catch (_err) {
      this.resetRow(id);
    } finally {
      wx.hideLoading();
    }
  },
});
