import { get, post, resolveImageUrl } from '../../utils/request';
import { checkLogin } from '../../utils/authUtil';
import env from '../../config/env';

const VALID_STATUSES = new Set(['pending', 'agree', 'found', 'expired']);

function resolveStatus(raw) {
  if (raw.status && VALID_STATUSES.has(raw.status)) return raw.status;
  if (raw.state === false) return 'found';
  if (raw.state === 'pending') return 'pending';
  if (raw.state === 'expired') return 'expired';
  return 'agree';
}

function normalizeItem(raw, type) {
  let locationList = [];
  if (Array.isArray(raw.places) && raw.places.length > 0) {
    locationList = raw.places;
  } else if (raw.place) {
    locationList = [{ name: raw.place, range: 'only' }];
  }

  return {
    ...raw,
    type,
    feature: raw.detail || raw.feature || '',
    create_time: raw.created || raw.create_time || raw.lostTime || raw.foundTime || '',
    status: resolveStatus(raw),
    cover: resolveImageUrl(raw.cover || ''),
    locationList,
  };
}

Page({
  data: {
    item: {},
    baseUrl: env.baseUrl,
    isAuthor: false,  // true when current viewer is the post's creator
  },

  onLoad(options) {
    const id = options.id;
    const type = options.type || '';
    this.loadItemDetail(id, type);
  },

  async loadItemDetail(id, type) {
    wx.showLoading({ title: '加载中...' });
    try {
      let item;
      if (type === 'lost') {
        const raw = await get(`/lost/${id}`);
        item = normalizeItem(raw, 'lost');
      } else if (type === 'found') {
        const raw = await get(`/found/${id}`);
        item = normalizeItem(raw, 'found');
      } else {
        try {
          const raw = await get(`/lost/${id}`);
          item = normalizeItem(raw, 'lost');
        } catch (_e) {
          // not a lost item — try found
        }
        if (!item) {
          const raw = await get(`/found/${id}`);
          item = normalizeItem(raw, 'found');
        }
      }

      // Author check: hide "Contact TA" if viewer posted this item themselves
      const myId = getApp().globalData.userInfo?._id || getApp().globalData.userInfo?.id;
      const authorId =
        item?.user?._id?.toString?.() ||
        item?.user?._id ||
        (typeof item?.user === 'string' ? item.user : '');
      const isAuthor = !!(myId && authorId && String(myId) === String(authorId));

      this.setData({ item, isAuthor });
    } catch (err) {
      wx.showToast({ title: '加载失败，接口不匹配或数据不存在', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  goToClaim() {
    const id = this.data.item._id || this.data.item.id;
    wx.navigateTo({ url: `/pages/claim/claim?itemId=${id}` });
  },

  // Open a chat with the item's poster — create session then navigate
  async contactAuthor() {
    if (!checkLogin()) return;
    const itemId = this.data.item._id || this.data.item.id;
    const itemType = this.data.item.type;
    if (!itemId || !itemType) return;

    wx.showLoading({ title: '连接中...', mask: true });
    try {
      const session = await post('/chat/session', { itemId, itemType });
      wx.hideLoading();
      const sessionId = session._id || session.id;
      wx.navigateTo({ url: `/pages/chat/chat?sessionId=${sessionId}` });
    } catch (err) {
      wx.hideLoading();
      const msg = err?.res?.data?.message || '无法开启聊天';
      wx.showToast({ title: msg, icon: 'none' });
    }
  },
});
