import { get, del } from '../../../utils/request';
import { checkLogin } from '../../../utils/authUtil';

Page({
  data: {
    activeStatus: 'all', // 当前筛选状态（all/pending/agree/found）
    publishList: [] // 发布列表
  },

  onShow() {
    // 检查登录状态
    if (!checkLogin()) return;
    // 加载发布列表
    this.loadPublishList();
  },

  // 切换状态筛选
  changeStatus(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ activeStatus: status }, () => {
      this.loadPublishList();
    });
  },

  // 加载发布列表
  async loadPublishList() {
    wx.showLoading({ title: '加载中...' });
    try {
      const [lostRes, foundRes] = await Promise.allSettled([
        get('/lost/list', { pageCurrent: 1, pageSize: 50 }),
        get('/found/list', { pageCurrent: 1, pageSize: 50 })
      ]);
      const lostItems = (lostRes.status === 'fulfilled' ? lostRes.value?.lostData || [] : [])
        .map(item => ({ ...item, itemType: 'lost' }));
      const foundItems = (foundRes.status === 'fulfilled' ? foundRes.value?.foundData || [] : [])
        .map(item => ({ ...item, itemType: 'found' }));
      this.setData({ publishList: [...lostItems, ...foundItems] });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 跳转到物品详情
  goToDetail(e) {
    const itemId = e.detail.itemId;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${itemId}`
    });
  },

  // 编辑物品（仅待审核状态可编辑）
  onEdit(e) {
    const itemId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/publish/lost/lost?id=${itemId}&type=edit`
    });
  },
  // 删除物品
  onDelete(e) {
    const itemId = e.currentTarget.dataset.id;
    const itemType = e.currentTarget.dataset.type;
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      success: async (res) => {
        if (!res.confirm) return;
        const path = itemType === 'found' ? `/found/${itemId}` : `/lost/${itemId}`;
        let ok = false;
        try {
          await del(path);
          ok = true;
        } catch (_err) {}
        wx.showToast({ title: ok ? '删除成功' : '删除失败', icon: ok ? 'success' : 'none' });
        if (ok) this.loadPublishList();
      }
    });
  },
  // 跳转到发布页
  goToPublish() {
    wx.navigateTo({
      url: '/pages/publish/lost/lost'
    });
  }
});