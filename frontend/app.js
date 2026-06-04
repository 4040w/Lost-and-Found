import { get } from "./utils/request";
import env from "./config/env";

App({
  onLaunch() {
    this.checkLogin();

    this.globalData.systemInfo = {
      ...wx.getWindowInfo(),
      ...wx.getDeviceInfo(),
      ...wx.getAppBaseInfo()
    };

    get("/ping")
      .then((res) => {
        console.log("[API Test] Connection Successful:", res);
      })
      .catch((err) => {
        console.error("[API Test] Connection Failed:", err);
      });
  },

  checkLogin() {
    const token = wx.getStorageSync("token");
    if (!token) {
      this.globalData.isLogin = false;
      return;
    }

    this.globalData.userInfo = wx.getStorageSync("userInfo") || null;

    get("/auth/check_logged")
      .then(() => {
        this.globalData.isLogin = true;
      })
      .catch(() => {
        wx.removeStorageSync("token");
        wx.removeStorageSync("userInfo");
        this.globalData.isLogin = false;
        this.globalData.userInfo = null;
      });
  },

  globalData: {
    isLogin: false,
    userInfo: null,
    systemInfo: null,
    campusLocation: [],
    baseUrl: env.baseUrl
  },

  updateLoginStatus(loginData) {
    const user = loginData.user || loginData;
    this.globalData.isLogin = true;
    this.globalData.userInfo = user;
    wx.setStorageSync("token", loginData.token);
    wx.setStorageSync("userInfo", user);
  },

  logout() {
    this.globalData.isLogin = false;
    this.globalData.userInfo = null;
    wx.removeStorageSync("token");
    wx.removeStorageSync("userInfo");
    wx.switchTab({
      url: "/pages/index/index"
    });
  }
});
