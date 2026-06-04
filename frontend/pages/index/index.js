import { get, resolveImageUrl } from "../../utils/request";

const VALID_STATUSES = new Set(['pending', 'agree', 'found', 'expired']);

function resolveStatus(item) {
  if (item.status && VALID_STATUSES.has(item.status)) return item.status;
  if (item.state === false) return 'found';
  if (item.state === 'pending') return 'pending';
  if (item.state === 'expired') return 'expired';
  return 'agree';
}

function toCardItem(item, type) {
  return {
    ...item,
    id: item.id || item._id,
    cover: resolveImageUrl(item.cover || ''),
    type,
    feature: item.detail || item.feature || "",
    create_time: item.created || item.create_time || item.lostTime || item.foundTime || "",
    status: resolveStatus(item)
  };
}

function normalizeList(res, activeTab) {
  if (Array.isArray(res?.lostFound)) {
    const lost = res.lostFound[0]?.lostData || [];
    const found = res.lostFound[1]?.foundData || [];
    return [
      ...lost.map((item) => toCardItem(item, "lost")),
      ...found.map((item) => toCardItem(item, "found"))
    ];
  }

  if (Array.isArray(res?.lostData)) {
    return res.lostData.map((item) => toCardItem(item, "lost"));
  }

  if (Array.isArray(res?.foundData)) {
    return res.foundData.map((item) => toCardItem(item, "found"));
  }

  if (Array.isArray(res)) {
    const lost = res[0]?.lostData || [];
    const found = res[1]?.foundData || [];
    return [
      ...lost.map((item) => toCardItem(item, "lost")),
      ...found.map((item) => toCardItem(item, "found"))
    ];
  }

  // Search response: { data: [[lostItems...], [foundItems...]] }
  if (Array.isArray(res?.data)) {
    const lostItems = Array.isArray(res.data[0]) ? res.data[0] : [];
    const foundItems = Array.isArray(res.data[1]) ? res.data[1] : [];
    return [
      ...lostItems.map((item) => toCardItem(item, "lost")),
      ...foundItems.map((item) => toCardItem(item, "found"))
    ];
  }

  const records = res?.data?.records || res?.records || [];
  return records.map((item) => toCardItem(item, item.type || activeTab));
}

Page({
  data: {
    keyword: "",
    searchKeyword: "",
    showFilter: false,
    activeTab: "all",
    filterForm: {
      type: [],
      locationId: "",
      range: "",
      status: ""
    },
    typeList: [["\u8bc1\u4ef6", "\u7535\u5b50\u8bbe\u5907", "\u8863\u7269", "\u6587\u5177", "\u98df\u54c1", "\u5176\u4ed6"]],
    locationList: [],
    rangeList: ["\u4ec5\u8be5\u5730\u70b9", "50\u7c73\u5185", "\u6574\u4e2a\u6821\u533a"],
    statusList: ["\u5f85\u5ba1\u6838", "\u5df2\u4e0a\u7ebf", "\u5df2\u627e\u56de", "\u5df2\u5931\u6548"],
    selectedTypeText: "",
    selectedLocation: {},
    selectedRangeText: "",
    selectedStatusText: "",
    filterActive: false,
    itemList: [],
    loading: false,
    refreshing: false,
    page: 1,
    size: 10,
    hasMore: true,
    unreadCount: 0,
  },

  onLoad() {
    this.loadItemList();
  },

  onShow() {
    // Skip if initial load hasn't completed yet or a request is already in flight
    if (this.data.itemList.length > 0 && !this.data.loading) {
      this.setData({ page: 1, hasMore: true });
      this.loadItemList();
    }
    this.refreshUnreadDot();
  },

  async refreshUnreadDot() {
    if (!getApp().globalData.isLogin) {
      this.setData({ unreadCount: 0 });
      return;
    }
    try {
      const res = await get('/chat/unread-count', {}, false, { silent: true });
      const count = res?.count ?? res?.data?.count ?? 0;
      this.setData({ unreadCount: count });
    } catch (_e) {
      this.setData({ unreadCount: 0 });
    }
  },

  goToChat() {
    if (!getApp().globalData.isLogin) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/chat-list/chat-list' });
  },

  // No-op for catchtap on sheet content (prevents bubbling to mask)
  noop() {},

  onRefresh() {
    this.setData({
      page: 1,
      hasMore: true,
      refreshing: true
    });
    this.loadItemList(() => {
      this.setData({ refreshing: false });
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadItemList();
    }
  },

  onSearchInput(e) {
    this.setData({
      keyword: e.detail.value,
      searchKeyword: e.detail.value
    });
  },

  onKeywordInput(e) {
    this.onSearchInput(e);
  },

  handleSearch() {
    this.setData({
      page: 1,
      hasMore: true
    });
    this.loadItemList();
  },

  toggleFilter() {
    this.setData({ showFilter: !this.data.showFilter });
  },

  onTypeChange(e) {
    const typeIndex = e.detail.value[0];
    const typeText = this.data.typeList[0][typeIndex];
    this.setData({
      "filterForm.type": [typeIndex],
      selectedTypeText: typeText
    });
  },

  onLocationChange(e) {
    const index = e.detail.value;
    const location = this.data.locationList[index] || {};
    this.setData({
      "filterForm.locationId": location.id || "",
      selectedLocation: location
    });
  },

  onRangeChange(e) {
    const index = e.detail.value;
    const rangeText = this.data.rangeList[index];
    const ranges = ["only", "50m", "campus"];
    this.setData({
      "filterForm.range": ranges[index] || "",
      selectedRangeText: rangeText
    });
  },

  onStatusChange(e) {
    const index = e.detail.value;
    const statusText = this.data.statusList[index];
    const statuses = ["pending", "agree", "found", "expired"];
    this.setData({
      "filterForm.status": statuses[index] || "",
      selectedStatusText: statusText
    });
  },

  resetFilter() {
    this.setData({
      filterForm: {
        type: [],
        locationId: "",
        range: "",
        status: ""
      },
      selectedTypeText: "",
      selectedLocation: {},
      selectedRangeText: "",
      selectedStatusText: "",
      filterActive: false,
    });
  },

  confirmFilter() {
    const f = this.data.filterForm;
    const filterActive = !!(
      (f.type && f.type.length > 0) ||
      f.locationId ||
      f.range ||
      f.status
    );
    this.setData({
      page: 1,
      hasMore: true,
      showFilter: false,
      filterActive,
    });
    this.loadItemList();
  },

  changeTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab,
      page: 1,
      hasMore: true
    });
    this.loadItemList();
  },

  getListApi() {
    if (this.data.keyword) return "/aggregate/search";
    if (this.data.activeTab === "lost") return "/aggregate/lost";
    if (this.data.activeTab === "found") return "/aggregate/found";
    return "/aggregate/last";
  },

  getListParams() {
    if (this.data.keyword) {
      return { search: this.data.keyword };
    }

    return {
      pageCurrent: this.data.page,
      pageSize: this.data.size
    };
  },

  async loadItemList(callback) {
    if (!this.data.hasMore || this.data.loading) {
      if (callback) callback();
      return;
    }

    this.setData({ loading: true });

    try {
      const res = await get(this.getListApi(), this.getListParams());
      const records = normalizeList(res, this.data.activeTab);
      const itemList = this.data.page === 1
        ? records
        : [...this.data.itemList, ...records];

      this.setData({
        itemList,
        hasMore: !this.data.keyword && records.length >= this.data.size,
        loading: false
      });
    } catch (_err) {
      this.setData({ loading: false });
    } finally {
      if (callback) callback();
    }
  },

  goToDetail(e) {
    const id = e.detail?.itemId || e.currentTarget.dataset.id;
    if (!id) return;
    const type = e.detail?.type || e.currentTarget.dataset.type || '';
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}&type=${type}`
    });
  }
});
