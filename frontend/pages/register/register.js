// The backend only supports WeChat OAuth login (POST /user).
// Phone registration endpoints (/user/register, /user/sendCode) do not exist in the backend.
// This page redirects users to the WeChat login flow.

Page({
  onLoad() {
    wx.showModal({
      title: '提示',
      content: '本应用使用微信授权登录，无需手机号注册。',
      showCancel: false,
      confirmText: '去登录',
      success: () => {
        wx.redirectTo({ url: '/pages/login/login' });
      }
    });
  },

  goLogin() {
    wx.redirectTo({ url: '/pages/login/login' });
  }
});
