import { del, get } from '../../../utils/request';
import { checkLogin } from '../../../utils/authUtil';
import env from '../../../config/env';

Page({
  data: {
    activeStatus: 'all',
    claimList: [],
    baseUrl: env.baseUrl
  },

  onShow() {
    if (!checkLogin()) return;
    this.loadClaimList();
  },

  changeStatus(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ activeStatus: status }, () => {
      this.loadClaimList();
    });
  },

  async loadClaimList() {
    wx.showLoading({ title: '加载中...' });
    try {
      const params = {};
      if (this.data.activeStatus !== 'all') {
        params.status = this.data.activeStatus;
      }
      const res = await get('/api/claim/list', params);
      const list = res?.data || (Array.isArray(res) ? res : []);
      this.setData({ claimList: list });
    } catch (_err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  goToDetail(e) {
    const claimId = e.currentTarget.dataset.id;
    const claimItem = this.data.claimList.find(item => (item._id || item.id) === claimId);
    if (!claimItem?.itemId) return;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${claimItem.itemId}`
    });
  },

  cancelClaim(e) {
    const claimId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认撤销',
      content: '确定要撤销该认领申请吗？',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        try {
          await del(`/api/claim/${claimId}`);
          wx.showToast({ title: '申请已撤销', icon: 'success' });
          this.loadClaimList();
        } catch (_err) {
          wx.showToast({ title: '撤销失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  goToIndex() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
