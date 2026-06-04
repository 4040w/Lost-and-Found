import { get, post } from '../../../utils/request';

Page({
  data: {
    itemList: []
  },

  onLoad() {
    this.getList();
  },

  async getList() {
    // ✅ 管理员接口，加 true
    const res = await get('/api/admin/item/list', {}, true);
    this.setData({ itemList: res.data || [] });
  },

  async passItem(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认通过',
      success: async (res) => {
        if (!res.confirm) return;
        await post('/api/admin/item/pass', { id }, true);
        this.getList();
      }
    });
  },

  async rejectItem(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认拒绝',
      success: async (res) => {
        if (!res.confirm) return;
        await post('/api/admin/item/reject', { id }, true);
        this.getList();
      }
    });
  }
});