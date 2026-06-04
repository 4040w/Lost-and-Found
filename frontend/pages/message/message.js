import { get, post } from '../../utils/request';
import { checkLogin } from '../../utils/authUtil';

Page({
  data: {
    activeTab: 'all', // 当前选中的消息分类（all/system/claim）
    messageList: [], // 消息列表
    unreadCount: 0, // 全部未读消息数
    systemUnread: 0, // 系统通知未读数
    claimUnread: 0 // 认领相关未读数
  },

  onShow() {
    // 检查登录状态
    if (!checkLogin()) return;
    // 加载消息列表
    this.loadMessageList();
  },

  // 切换消息分类
  changeTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab }, () => {
      this.loadMessageList();
    });
  },

  // 加载消息列表
  async loadMessageList() {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await get('/message/list');
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      const unread = list.filter(m => !m.isRead).length;
      this.setData({
        messageList: list,
        unreadCount: unread,
        systemUnread: list.filter(m => !m.isRead && m.type === 'system').length,
        claimUnread: list.filter(m => !m.isRead && m.type === 'claim').length
      });
    } catch (err) {
      this.setData({ messageList: [], unreadCount: 0, systemUnread: 0, claimUnread: 0 });
    } finally {
      wx.hideLoading();
    }
  },

  // 标记全部已读
  markAllRead() {
    wx.showToast({ title: '暂无消息', icon: 'none' });
  },

  // 跳转到消息详情页
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    // 标记当前消息为已读（未读时）
    const msgIndex = this.data.messageList.findIndex(msg => msg.id === id);
    if (msgIndex !== -1 && !this.data.messageList[msgIndex].isRead) {
      const newMessageList = [...this.data.messageList];
      newMessageList[msgIndex].isRead = true;
      this.setData({ messageList: newMessageList });
      // 调用接口标记已读（避免刷新后恢复未读）
      post(`/api/message/markRead/${id}`);
    }
    // 跳转到消息详情页（如需查看完整内容，可扩展详情页）
    wx.navigateTo({
      url: `/pages/message/detail/detail?id=${id}`
    });
  }
});