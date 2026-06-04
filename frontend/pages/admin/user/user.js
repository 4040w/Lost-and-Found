import { get, post } from '../../../utils/request';

Page({
  data: {
    userList: []
  },

  onLoad() {
    this.getList();
  },

  async getList() {
    // ✅ 管理员接口，加 true
    const res = await get('/api/admin/user/list', {}, true);
    this.setData({ userList: res.data || [] });
  },

  async banUser(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认封禁',
      success: async (res) => {
        if (!res.confirm) return;
        await post('/api/admin/user/ban', { id }, true);
        this.getList();
      }
    });
  },

  async unbanUser(e) {
    const id = e.currentTarget.dataset.id;
    // ✅ 管理员接口，加 true
    await post('/api/admin/user/unban', { id }, true);
    this.getList();
  }
});