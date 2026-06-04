import env from '../config/env';

const DEFAULT_BASE_URL = env.baseUrl;

function getBaseURL() {
  try {
    const app = getApp();
    return app?.globalData?.baseUrl || DEFAULT_BASE_URL;
  } catch (_e) {
    return DEFAULT_BASE_URL;
  }
}

function normalizePath(url) {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) return url;
  return url
    .replace(/^\/api\/v\d+(?=\/|$)/, "")
    .replace(/^\/api(?=\/|$)/, "");
}

function buildURL(url) {
  if (/^https?:\/\//.test(url)) return url;
  return getBaseURL() + normalizePath(url);
}

function getAuthHeader() {
  const token = wx.getStorageSync("token");
  return token ? `Bearer ${token}` : "";
}

function checkAdminAuth() {
  const adminToken = wx.getStorageSync("adminToken");
  if (!adminToken) {
    wx.showToast({ title: "请先登录管理员账号", icon: "none" });
    wx.navigateTo({ url: "/pages/admin/login/login" });
    return false;
  }
  return true;
}

function handleAdminUnauthorized() {
  wx.removeStorageSync("adminToken");
  wx.removeStorageSync("isAdmin");
  wx.showToast({ title: "管理员身份已过期，请重新登录", icon: "none" });
  wx.navigateTo({ url: "/pages/admin/login/login" });
}

function request(method, url, data = {}, isAdmin = false, options = {}) {
  return new Promise((resolve, reject) => {
    if (isAdmin && !checkAdminAuth()) {
      reject({ type: "unauthorized", message: "未登录" });
      return;
    }

    const header = {
      "Content-Type": "application/json",
      "Authorization": getAuthHeader(),
      "token": wx.getStorageSync("token") || ""
    };

    if (isAdmin) {
      header["adminToken"] = wx.getStorageSync("adminToken") || "";
    }

    wx.request({
      url: buildURL(url),
      method,
      data,
      timeout: options.timeout || 30000,
      header,
      success: (res) => {
        if (res.statusCode === 401 || res.data?.code === 401) {
          if (isAdmin) handleAdminUnauthorized();
          reject({ type: "unauthorized", res });
          return;
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }

        if (!options.silent) {
          wx.showToast({ title: res.data?.message || "请求失败", icon: "none" });
        }
        reject({ type: "http", statusCode: res.statusCode, res });
      },
      fail: (err) => {
        const isTimeout = /timeout/i.test(err?.errMsg || "");
        if (!options.silent) {
          wx.showToast({
            title: isTimeout ? "请求超时，请检查网络" : "网络异常",
            icon: "none",
          });
        }
        reject({ type: isTimeout ? "timeout" : "network", err });
      }
    });
  });
}

// Resolves a cover/image value to a full URL ready for <image src>.
// External absolute URLs (WeChat CDN, Qiniu CDN, etc.) are returned as-is.
// Root-relative /uploads/ paths get baseUrl prepended.
export function resolveImageUrl(cover, baseUrl) {
  if (!cover) return '';
  if (/^https?:\/\//.test(cover)) return cover;
  const base = (baseUrl || '').replace(/\/$/, '');
  if (cover.startsWith('/')) return base ? base + cover : cover;
  return cover;
}

export function get(url, data = {}, isAdmin = false, options = {}) {
  return request("GET", url, data, isAdmin, options);
}

export function post(url, data = {}, isAdmin = false, options = {}) {
  return request("POST", url, data, isAdmin, options);
}

export function del(url, data = {}, isAdmin = false, options = {}) {
  return request("DELETE", url, data, isAdmin, options);
}

export function patch(url, data = {}, isAdmin = false, options = {}) {
  return request("PATCH", url, data, isAdmin, options);
}

export function uploadImage(filePath, isCompress = true) {
  return new Promise((resolve, reject) => {
    const header = {
      "Authorization": getAuthHeader(),
      "token": wx.getStorageSync("token") || ""
    };

    wx.uploadFile({
      url: buildURL("/photos/upload"),
      filePath,
      name: "file",
      timeout: 30000,
      header,
      formData: { compress: isCompress },
      success: (res) => {
        if (res.statusCode === 401) {
          reject(res);
          return;
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          wx.hideLoading();
          wx.showToast({ title: "图片上传失败", icon: "none" });
          reject(res);
          return;
        }

        try {
          resolve(JSON.parse(res.data));
        } catch (_e) {
          resolve(res.data);
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: "图片上传失败", icon: "none" });
        reject(err);
      }
    });
  });
}
