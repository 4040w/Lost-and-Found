import { get, patch, resolveImageUrl } from '../../utils/request';
import { checkLogin } from '../../utils/authUtil';
import env from '../../config/env';

Page({
  data: {
    isLogin: false,
    userInfo: null,
    isAdmin: false,
    editing: false,
    tempAvatar: '',
    tempNickName: '',
    unreadCount: 0,
  },

  onShow() {
    const app = getApp();
    let userInfo = app.globalData.userInfo;
    if (userInfo?.avatarUrl) {
      userInfo = { ...userInfo, avatarUrl: resolveImageUrl(userInfo.avatarUrl, env.baseUrl) };
    }
    this.setData({
      isLogin: app.globalData.isLogin,
      userInfo,
      isAdmin: wx.getStorageSync('isAdmin') || false,
    });
    this.refreshUnreadBadge();
  },

  async refreshUnreadBadge() {
    if (!getApp().globalData.isLogin) {
      this.setData({ unreadCount: 0 });
      return;
    }
    try {
      const res = await get('/chat/unread-count', {}, false, { silent: true });
      const count = res?.count ?? res?.data?.count ?? 0;
      this.setData({ unreadCount: count });
    } catch (_e) {
      this.setData({ unreadCount: 0 });
    }
  },

  // Called when user taps avatar button (open-type="chooseAvatar")
  onChooseAvatar(e) {
    this.setData({ tempAvatar: e.detail.avatarUrl, editing: true });
  },

  // Called on nickname input — type="nickname" auto-fills real WeChat nickname
  onNickNameInput(e) {
    this.setData({ tempNickName: e.detail.value, editing: true });
  },

  // Save profile to backend via PATCH /user
  async saveProfile() {
    const { tempAvatar, tempNickName, userInfo } = this.data;
    const nickName = tempNickName.trim() || userInfo?.nickName || '微信用户';
    const avatarUrl = tempAvatar || userInfo?.avatarUrl || '';

    // hideLoading must be called before showToast — WeChat dismisses one when
    // the other is shown, causing a "must be paired" warning if order is wrong.
    wx.showLoading({ title: '保存中...' });
    let saved = false;
    try {
      await patch('/user', { nickName, avatarUrl });
      const app = getApp();
      const updated = { ...userInfo, nickName, avatarUrl };
      app.globalData.userInfo = updated;
      wx.setStorageSync('userInfo', updated);
      this.setData({ userInfo: updated, editing: false, tempAvatar: '', tempNickName: '' });
      saved = true;
    } catch (_err) {
      // handled below
    }
    wx.hideLoading();
    wx.showToast({ title: saved ? '保存成功' : '保存失败', icon: saved ? 'success' : 'none' });
  },

  logout() {
    getApp().logout();
  },

  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goToMyPublish() {
    if (!checkLogin()) return;
    wx.navigateTo({ url: '/pages/user/publish/publish' });
  },

  goToMyClaim() {
    if (!checkLogin()) return;
    wx.navigateTo({ url: '/pages/user/claim/claim' });
  },

  goToMessage() {
    if (!checkLogin()) return;
    // Real chat sessions live in /pages/chat-list/chat-list now.
    wx.navigateTo({ url: '/pages/chat-list/chat-list' });
  },

  goToAdmin() {
    wx.navigateTo({ url: '/pages/admin/check/check' });
  },

  goToHelp() {
    wx.navigateTo({ url: '/pages/help/help' });
  },
});
