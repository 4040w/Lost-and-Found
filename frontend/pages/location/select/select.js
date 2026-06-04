import { get } from '../../../utils/request';
import { matchLocationByCoord } from '../../../utils/mapUtil';

// Default fallback coordinates (Beijing) shown while GPS is loading
const DEFAULT_LNG = 116.397428;
const DEFAULT_LAT = 39.90923;

Page({
  data: {
    longitude: DEFAULT_LNG,
    latitude: DEFAULT_LAT,
    markers: [],
    searchKey: '',
    locationList: [],
    selectedLocation: {},
    range: 'only'
  },

  onLoad() {
    this.setData({
      markers: [{
        id: 0,
        longitude: DEFAULT_LNG,
        latitude: DEFAULT_LAT,
        title: '当前选点',
        width: 30,
        height: 30
      }]
    });
    this.getMyLocation();
    this.getCampusLocation();
  },

  // ─── Real GPS with permission-denied → openSetting fallback ───────────────
  getMyLocation() {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (res) => {
        const { longitude, latitude } = res;
        this.setData({
          longitude,
          latitude,
          markers: [{
            id: 0,
            longitude,
            latitude,
            title: '我的位置',
            width: 30,
            height: 30
          }]
        });
      },
      fail: (err) => {
        const denied =
          err.errMsg &&
          (err.errMsg.includes('auth deny') ||
            err.errMsg.includes('AUTH_DENIED') ||
            err.errMsg.includes('permission'));
        if (denied) {
          wx.showModal({
            title: '位置权限未开启',
            content: '需要获取您的位置信息以在地图上定位，请前往设置中开启位置权限',
            confirmText: '去设置',
            cancelText: '暂不',
            success: (modal) => {
              if (modal.confirm) {
                wx.openSetting({
                  success: (setting) => {
                    if (setting.authSetting['scope.userLocation']) {
                      this.getMyLocation();
                    }
                  }
                });
              }
            }
          });
        }
        // Non-permission errors / user cancels: silently keep the default position
      }
    });
  },
  // ──────────────────────────────────────────────────────────────────────────

  async getCampusLocation() {
    const app = getApp();
    if (app.globalData.campusLocation && app.globalData.campusLocation.length > 0) {
      this.setData({ locationList: app.globalData.campusLocation });
      return;
    }
    try {
      const res = await get('/location/list');
      const list = res?.data || (Array.isArray(res) ? res : []);
      app.globalData.campusLocation = list;
      this.setData({ locationList: list });
    } catch (_err) {
      // Non-critical: user can still pick via wx.chooseLocation
    }
  },

  mapClick(e) {
    const { longitude, latitude } = e.detail;
    const location = matchLocationByCoord(this.data.locationList, longitude, latitude);
    this.setData({
      longitude,
      latitude,
      markers: [{
        id: 0,
        longitude,
        latitude,
        title: location?.name || '当前选点',
        width: 30,
        height: 30
      }],
      selectedLocation: location || {}
    });
  },

  onSearchInput(e) {
    this.setData({ searchKey: e.detail.value });
  },

  searchLocation() {
    wx.chooseLocation({
      success: (res) => {
        const { name, address, latitude, longitude } = res;
        const location = {
          id: `${longitude}_${latitude}`,
          name: name || address,
          address: address || '',
          longitude,
          latitude
        };
        const existing = this.data.locationList.filter(l => l.id !== location.id);
        this.setData({
          longitude,
          latitude,
          markers: [{
            id: 0,
            longitude,
            latitude,
            title: location.name,
            width: 30,
            height: 30
          }],
          selectedLocation: location,
          locationList: [location, ...existing]
        });
      },
      fail: (err) => {
        if (err.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({ title: '位置选择失败', icon: 'none' });
        }
      }
    });
  },

  selectLocation(e) {
    const location = e.currentTarget.dataset.location;
    this.setData({
      selectedLocation: location,
      longitude: location.longitude,
      latitude: location.latitude,
      markers: [{
        id: 0,
        longitude: location.longitude,
        latitude: location.latitude,
        title: location.name,
        width: 30,
        height: 30
      }]
    });
  },

  selectRange(e) {
    this.setData({ range: e.currentTarget.dataset.range });
  },

  confirmLocation() {
    const { selectedLocation, range } = this.data;
    if (!selectedLocation.id) {
      wx.showToast({ title: '请先选择地点', icon: 'none' });
      return;
    }
    const eventChannel = this.getOpenerEventChannel();
    eventChannel.emit('selectLocation', {
      id: selectedLocation.id,
      name: selectedLocation.name,
      address: selectedLocation.address || '',
      longitude: selectedLocation.longitude || 0,
      latitude: selectedLocation.latitude || 0,
      range
    });
    wx.navigateBack();
  }
});
