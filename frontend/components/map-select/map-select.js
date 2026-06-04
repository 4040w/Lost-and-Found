import { get } from '../../utils/request';
import { matchLocationByCoord } from '../../utils/mapUtil';

Component({
  properties: {
    initLongitude: {
      type: Number,
      value: 116.397428
    },
    initLatitude: {
      type: Number,
      value: 39.90923
    },
    placeholder: {
      type: String,
      value: '搜索校园地点'
    }
  },

  data: {
    longitude: 0,
    latitude: 0,
    markers: [],
    searchKey: '',
    resultList: [],
    campusLocationList: [],
    selectedLocation: {},
    range: 'only'
  },

  attached() {
    // Show prop-based fallback immediately, then try real GPS
    this.setData({
      longitude: this.properties.initLongitude,
      latitude: this.properties.initLatitude,
      markers: [{
        id: 0,
        longitude: this.properties.initLongitude,
        latitude: this.properties.initLatitude,
        width: 30,
        height: 30
      }]
    });
    this.getMyLocation();
    this.loadCampusLocations();
  },

  methods: {
    // ─── Real GPS with permission-denied → openSetting fallback ─────────────
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
        }
      });
    },
    // ────────────────────────────────────────────────────────────────────────

    async loadCampusLocations() {
      const app = getApp();
      if (app.globalData.campusLocation && app.globalData.campusLocation.length > 0) {
        this.setData({ campusLocationList: app.globalData.campusLocation });
        return;
      }
      try {
        const res = await get('/location/list');
        const list = res?.data || (Array.isArray(res) ? res : []);
        app.globalData.campusLocation = list;
        this.setData({ campusLocationList: list });
      } catch (_err) {
        // Non-critical: map-tap matching degrades gracefully when list is empty
      }
    },

    onMapClick(e) {
      const { longitude, latitude } = e.detail;
      const location = matchLocationByCoord(this.data.campusLocationList, longitude, latitude);
      this.setData({
        longitude,
        latitude,
        markers: [{
          id: 0,
          longitude,
          latitude,
          width: 30,
          height: 30
        }],
        selectedLocation: location || {}
      });
    },

    onSearchInput(e) {
      this.setData({ searchKey: e.detail.value });
    },

    onSearch() {
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
          this.setData({
            longitude,
            latitude,
            markers: [{
              id: 0,
              longitude,
              latitude,
              width: 30,
              height: 30
            }],
            selectedLocation: location,
            resultList: [location]
          });
        },
        fail: (err) => {
          if (err.errMsg && !err.errMsg.includes('cancel')) {
            wx.showToast({ title: '位置选择失败', icon: 'none' });
          }
        }
      });
    },

    onResultSelect(e) {
      const item = e.currentTarget.dataset.item;
      this.setData({
        longitude: item.longitude,
        latitude: item.latitude,
        markers: [{
          id: 0,
          longitude: item.longitude,
          latitude: item.latitude,
          width: 30,
          height: 30
        }],
        selectedLocation: item
      });
    },

    onRangeSelect(e) {
      this.setData({ range: e.currentTarget.dataset.range });
    },

    onConfirm() {
      const { selectedLocation, range } = this.data;
      if (!selectedLocation.id) {
        wx.showToast({ title: '请先选择地点', icon: 'none' });
        return;
      }
      this.triggerEvent('confirm', {
        location: selectedLocation,
        range
      });
    }
  }
});
