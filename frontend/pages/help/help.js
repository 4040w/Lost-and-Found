Page({
  /**
   * 页面的初始数据
   */
  data: {
    activeTab: 'publish' // 默认选中「发布物品」标签
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {},

  /**
   * 切换帮助分类标签
   */
  changeTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  }
});