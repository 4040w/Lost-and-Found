import { post, uploadImage } from '../../../utils/request';
import { checkLogin } from '../../../utils/authUtil';

Page({
  data: {
    step: 1,
    typeList: ['证件', '电子设备', '衣物', '文具', '食品', '其他'],
    typeIndex: 0,
    formData: {
      title: '',
      type: '',
      time: '',
      feature: '',
      reward: 0,
      isMail: false,
      contact: '',
      remark: ''
    },
    locationList: [],
    imgList: [],
    isCommit: false,
    isSubmitting: false
  },

  onLoad() {
    this.setData({ 'formData.type': this.data.typeList[0] });
    checkLogin();
  },

  onFormInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`formData.${key}`]: e.detail.value });
  },

  onTypeChange(e) {
    const index = e.detail.value;
    this.setData({
      typeIndex: index,
      'formData.type': this.data.typeList[index]
    });
  },

  onDateChange(e) {
    this.setData({ 'formData.time': e.detail.value });
  },

  onMailChange(e) {
    this.setData({ 'formData.isMail': e.detail.value });
  },

  checkStep1() {
    const { title, time, feature, contact } = this.data.formData;
    return title && time && feature && contact;
  },

  toStep1() { this.setData({ step: 1 }); },

  // Validate step-1 fields before advancing, matching lost.js behaviour
  toStep2() {
    if (!this.checkStep1()) {
      wx.showToast({ title: '请填写完整必填信息', icon: 'none', duration: 2000 });
      return;
    }
    this.setData({ step: 2 });
  },

  toStep3() {
    if (this.data.locationList.length === 0) {
      wx.showToast({ title: '请至少添加一个拾获地点', icon: 'none', duration: 2000 });
      return;
    }
    this.setData({ step: 3 });
  },

  toStep4() { this.setData({ step: 4 }); },

  // Open native Tencent Maps POI picker; capture full geo data
  toSelectLocation() {
    wx.chooseLocation({
      success: (res) => {
        const { name, address, longitude, latitude } = res;
        this.addLocation({
          id: `${longitude}_${latitude}`,
          name: name || address,
          address: address || '',
          longitude,
          latitude,
          range: 'only'
        });
      },
      fail: (err) => {
        if (err.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({ title: '位置选择失败', icon: 'none' });
        }
      }
    });
  },

  addLocation(location) {
    if (!location) return;
    this.setData({
      locationList: [...this.data.locationList, {
        ...location,
        sort: this.data.locationList.length
      }]
    });
  },

  upLocation(e) {
    const index = +e.currentTarget.dataset.index;
    if (index === 0) return;
    const list = [...this.data.locationList];
    [list[index], list[index - 1]] = [list[index - 1], list[index]];
    list.forEach((item, i) => item.sort = i);
    this.setData({ locationList: list });
  },

  downLocation(e) {
    const index = +e.currentTarget.dataset.index;
    if (index >= this.data.locationList.length - 1) return;
    const list = [...this.data.locationList];
    [list[index], list[index + 1]] = [list[index + 1], list[index]];
    list.forEach((item, i) => item.sort = i);
    this.setData({ locationList: list });
  },

  delLocation(e) {
    const index = e.currentTarget.dataset.index;
    const list = [...this.data.locationList];
    list.splice(index, 1);
    list.forEach((item, i) => item.sort = i);
    this.setData({ locationList: list });
  },

  chooseImg() {
    wx.chooseImage({
      count: 9 - this.data.imgList.length,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          imgList: [...this.data.imgList, ...res.tempFilePaths]
        });
      },
      fail: (err) => {
        wx.showToast({ title: '图片选择失败', icon: 'none' });
        console.error('选择图片失败：', err);
      }
    });
  },

  delImg(e) {
    const index = e.currentTarget.dataset.index;
    const list = [...this.data.imgList];
    list.splice(index, 1);
    this.setData({ imgList: list });
  },

  // checkbox-group fires e.detail.value = ['agree'] when checked, [] when unchecked
  onCommitChange(e) {
    this.setData({ isCommit: e.detail.value.length > 0 });
  },

  async uploadAllImages() {
    const imgList = this.data.imgList;
    if (imgList.length === 0) return { cover: '', imgList: [] };

    // Upload with compression enabled (isCompress: true)
    const coverRes = await uploadImage(imgList[0], true);
    const cover = coverRes?.data || coverRes || '';

    const otherImgs = imgList.slice(1);
    const imgListRes = await Promise.all(otherImgs.map(img => uploadImage(img, true)));
    const imgListData = imgListRes.map(item => item?.data || item || '').filter(Boolean);

    return { cover, imgList: imgListData };
  },

  async publishFound() {
    if (!this.checkStep1()) {
      wx.showToast({ title: '请完善必填信息', icon: 'none' });
      return;
    }

    if (!this.data.isCommit) {
      wx.showToast({ title: '请同意发布承诺', icon: 'none' });
      return;
    }

    // Guard against duplicate submissions from double-tap
    if (this.data.isSubmitting) return;
    this.setData({ isSubmitting: true });

    wx.showLoading({ title: '发布中...', mask: true });

    try {
      const { cover, imgList } = await this.uploadAllImages();

      // Send all selected locations; `place` keeps the primary name for
      // backward-compatibility while `places` carries the full ordered list
      const publishData = {
        title: this.data.formData.title,
        contact: this.data.formData.contact,
        category: this.data.formData.type,
        foundTime: this.data.formData.time,
        detail: this.data.formData.feature || this.data.formData.remark,
        place: this.data.locationList[0]?.name || '',
        places: this.data.locationList.map(({ name, address, range, longitude, latitude, sort }) => ({
          name, address: address || '', range, longitude: longitude || 0, latitude: latitude || 0, sort
        })),
        cover,
        image: [cover, ...imgList].filter(Boolean)
      };

      const res = await post('/found', publishData, false);
      const newId = res?._id || res?.id;

      console.log('Publish success, navigating to ID:', newId);

      wx.showToast({ title: '发布成功', icon: 'success', duration: 1500 });

      setTimeout(() => {
        // Posts go live immediately — drop user back on the home list page.
        wx.switchTab({ url: '/pages/index/index' });
      }, 1500);
    } catch (_err) {
      wx.showToast({ title: '发布失败，请稍后重试', icon: 'none', duration: 2000 });
    } finally {
      wx.hideLoading();
      this.setData({ isSubmitting: false });
    }
  }
});
