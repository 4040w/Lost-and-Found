import { get } from '../../../utils/request';
import { checkLogin } from '../../../utils/authUtil';

Page({
  data: {
    message: {} // 消息详情
  },

  onLoad(options) {
    const id = options.id;
    // 检查登录状态
    if (!checkLogin()) return;
    // 加载消息详情
    this.loadMessageDetail(id);
  },

  // 加载消息详情
  async loadMessageDetail(id) {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await get(`/message/detail/${id}`);
      // Response interceptor only wraps arrays; object responses pass through directly
      this.setData({ message: res.data || res });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 跳转到物品详情页
  goToItemDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  }
});