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
    // 初始化物品类型
    this.setData({ 'formData.type': this.data.typeList[0] });
    // 检查登录状态
    checkLogin();
  },

  // 表单输入
  onFormInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`formData.${key}`]: e.detail.value });
  },

  // 选择物品类型
  onTypeChange(e) {
    const index = e.detail.value;
    this.setData({
      typeIndex: index,
      'formData.type': this.data.typeList[index]
    });
  },

  // 选择遗失时间
  onDateChange(e) {
    this.setData({ 'formData.time': e.detail.value });
  },

  // 是否接受邮寄
  onMailChange(e) {
    this.setData({ 'formData.isMail': e.detail.value });
  },

  // 步骤1验证
  checkStep1() {
    const { title, time, feature, contact } = this.data.formData;
    return title && time && feature && contact;
  },

  // ========== 新增/修改：步骤跳转 + 前置验证 ==========
  toStep1() { 
    this.setData({ step: 1 }); 
  },
  
  // 步骤1→步骤2：先验证，通过才跳转
  toStep2() { 
    if (!this.checkStep1()) {
      wx.showToast({
        title: '请填写完整必填信息',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    this.setData({ step: 2 }); 
  },
  
  toStep3() { 
    // 可选：步骤2→步骤3的验证（比如检查地点是否填写）
    if (this.data.locationList.length === 0) {
      wx.showToast({
        title: '请至少添加一个遗失地点',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    this.setData({ step: 3 }); 
  },
  
  toStep4() { 
    // 可选：步骤3→步骤4的验证（比如检查图片是否上传）
    this.setData({ step: 4 }); 
  },

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

  // 地点上移
  upLocation(e) {
    const index = +e.currentTarget.dataset.index;
    if (index === 0) return; // 第一个不能上移
    const list = [...this.data.locationList];
    [list[index], list[index - 1]] = [list[index - 1], list[index]];
    list.forEach((item, i) => item.sort = i);
    this.setData({ locationList: list });
  },

  // 地点下移
  downLocation(e) {
    const index = +e.currentTarget.dataset.index;
    if (index === this.data.locationList.length - 1) return; // 最后一个不能下移
    const list = [...this.data.locationList];
    [list[index], list[index + 1]] = [list[index + 1], list[index]];
    list.forEach((item, i) => item.sort = i);
    this.setData({ locationList: list });
  },

  // 删除地点
  delLocation(e) {
    const index = e.currentTarget.dataset.index;
    const list = this.data.locationList;
    list.splice(index, 1);
    list.forEach((item, i) => item.sort = i); // 删除后重新排序
    this.setData({ locationList: list });
  },

  // 选择图片
  chooseImg() {
    wx.chooseImage({
      count: 9 - this.data.imgList.length,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          imgList: [...this.data.imgList, ...res.tempFilePaths]
        });
      }
    });
  },

  // 删除图片
  delImg(e) {
    const index = e.currentTarget.dataset.index;
    const list = this.data.imgList;
    list.splice(index, 1);
    this.setData({ imgList: list });
  },

  // checkbox-group fires e.detail.value = ['agree'] when checked, [] when unchecked
  onCommitChange(e) {
    this.setData({ isCommit: e.detail.value.length > 0 });
  },

  // 发布寻物启事
  async publishLost() {
    if (!this.data.isCommit) {
      wx.showToast({ title: '请同意发布承诺', icon: 'none', duration: 2000 });
      return;
    }

    // Guard against duplicate submissions from double-tap
    if (this.data.isSubmitting) return;
    this.setData({ isSubmitting: true });

    wx.showLoading({ title: '发布中...', mask: true });

    try {
      // 1. Upload images with compression enabled; first image is the cover
      let cover = '';
      let imageUrls = [];
      if (this.data.imgList.length > 0) {
        const coverRes = await uploadImage(this.data.imgList[0], true);
        cover = coverRes?.data || coverRes || '';

        const otherImgs = this.data.imgList.slice(1);
        const otherUploadResults = await Promise.all(
          otherImgs.map((imgPath) => uploadImage(imgPath, true))
        );
        imageUrls = otherUploadResults
          .map((item) => item?.data || item || '')
          .filter(Boolean);
      }

      // 2. Send all selected locations; `place` keeps the primary name for
      //    backward-compatibility while `places` carries the full ordered list
      const publishData = {
        title: this.data.formData.title,
        contact: this.data.formData.contact,
        category: this.data.formData.type,
        lostTime: this.data.formData.time,
        detail: this.data.formData.feature || this.data.formData.remark,
        place: this.data.locationList[0]?.name || '',
        places: this.data.locationList.map(({ name, address, range, longitude, latitude, sort }) => ({
          name, address: address || '', range, longitude: longitude || 0, latitude: latitude || 0, sort
        })),
        cover,
        image: [cover, ...imageUrls].filter(Boolean)
      };

      const res = await post('/lost', publishData, false);
      const newId = res?._id || res?.id;

      console.log('Publish success, navigating to ID:', newId);

      wx.showToast({ title: '发布成功', icon: 'success', duration: 1500 });

      setTimeout(() => {
        // Posts go live immediately — drop user back on the home list page.
        wx.switchTab({ url: '/pages/index/index' });
      }, 1500);
    } catch (_err) {
      wx.showToast({ title: '发布失败，请稍后重试', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ isSubmitting: false });
    }
  }
});