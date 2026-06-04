/**
 * 检查是否登录，未登录则跳转登录页
 * @returns {Boolean} 是否登录
 */
export const checkLogin = () => {
  const app = getApp();
  if (!app.globalData.isLogin) {
    wx.showToast({
      title: '请先登录',
      icon: 'none'
    });
    wx.navigateTo({
      url: '/pages/login/login'
    });
    return false;
  }
  return true;
};

/**
 * 获取当前登录用户信息
 * @returns {Object} 用户信息
 */
export const getUserInfo = () => {
  const app = getApp();
  return app.globalData.userInfo;
};

/**
 * 检查用户权限（是否为管理员）
 * @returns {Boolean} 是否为管理员
 */
export const checkAdmin = () => {
  const userInfo = getUserInfo();
  return userInfo && userInfo.user_type === 'admin';
};