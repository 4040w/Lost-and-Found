import { post } from '../../../utils/request';

Page({
  data: {
    username: '',
    password: ''
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value })
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value })
  },

  async adminLogin() {
    const { username, password } = this.data;
    if (!username || !password) {
      wx.showToast({ title: '请输入账号密码', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '登录中...' });
    try {
      const res = await post('/api/admin/login', { username, password });
      // backend returns { code: 200, data: { token } }
      const token = res?.data?.token || res?.token;
      if (token) {
        wx.setStorageSync('adminToken', token);
        wx.setStorageSync('isAdmin', true);
        wx.showToast({ title: '登录成功' });
        setTimeout(() => {
          wx.navigateTo({ url: '/pages/admin/check/check' });
        }, 1500);
      } else {
        wx.showToast({ title: res?.message || '登录失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '登录失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});