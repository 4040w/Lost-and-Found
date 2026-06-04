import { post, get } from '../../utils/request';

const LOGIN_TIMEOUT = 20000;

// Promisified WeChat APIs
const wxCheckSession = () =>
  new Promise((resolve) => wx.checkSession({ success: () => resolve(true), fail: () => resolve(false) }));

const wxLogin = () =>
  new Promise((resolve, reject) =>
    wx.login({
      success: (res) => (res.code ? resolve(res.code) : reject(new Error('code missing'))),
      fail: reject,
    }),
  );

Page({
  data: {
    logging: false,
    statusText: '',
  },

  onLoad() {
    // If we already have a token and session is still valid on WeChat's side,
    // verify it with the backend; success → bounce to home, no re-login needed.
    this.trySilentLogin();
  },

  async trySilentLogin() {
    const token = wx.getStorageSync('token');
    if (!token) return;

    const sessionValid = await wxCheckSession();
    if (!sessionValid) {
      // Code/session expired — clear stored token so user re-logs in
      wx.removeStorageSync('token');
      wx.removeStorageSync('userInfo');
      return;
    }

    try {
      await get('/auth/check_logged', {}, false, { silent: true, timeout: 8000 });
      // Token still good — go straight to home
      wx.switchTab({ url: '/pages/index/index' });
    } catch (_e) {
      // Token rejected — drop it and stay on login page
      wx.removeStorageSync('token');
      wx.removeStorageSync('userInfo');
    }
  },

  // Canonical login: wx.login → POST code → JWT. No profile collection here.
  async handleWechatLogin() {
    if (this.data.logging) return;
    this.setData({ logging: true, statusText: '正在获取微信授权...' });

    try {
      const code = await wxLogin();
      this.setData({ statusText: '正在登录服务器...' });

      const res = await this.postCodeWithRetry(code);

      getApp().updateLoginStatus(res.data || res);
      this.setData({ statusText: '登录成功' });
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 1200);
    } catch (err) {
      this.handleLoginError(err);
    } finally {
      this.setData({ logging: false });
    }
  },

  // POST /user with one retry on timeout (codes are single-use, so we must
  // request a fresh code before retrying).
  async postCodeWithRetry(code) {
    try {
      return await post('/user', { id: code }, false, { timeout: LOGIN_TIMEOUT, silent: true });
    } catch (err) {
      if (err?.type !== 'timeout') throw err;
      // Timeout → fresh code, one more try
      this.setData({ statusText: '网络较慢，正在重试...' });
      const freshCode = await wxLogin();
      return post('/user', { id: freshCode }, false, { timeout: LOGIN_TIMEOUT, silent: true });
    }
  },

  handleLoginError(err) {
    let title = '登录失败';
    if (err?.type === 'timeout') {
      title = '服务器响应超时，请检查网络后重试';
    } else if (err?.type === 'network') {
      title = '网络异常，请检查后端服务或域名配置';
    } else if (err?.type === 'http') {
      title = err.res?.data?.message || `服务器错误 (${err.statusCode})`;
    } else if (err?.message) {
      title = err.message;
    }
    this.setData({ statusText: '' });
    wx.showToast({ title, icon: 'none', duration: 2500 });
    console.error('[Login Failed]', err);
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) });
  },
});
