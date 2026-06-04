import { get, post, uploadImage } from '../../utils/request';
import { checkLogin } from '../../utils/authUtil';

Page({
  data: {
    itemId: '',
    item: {},
    formData: {
      credentials: '',
      contact: ''
    },
    imgList: [],
    isSubmitting: false
  },

  onLoad(options) {
    const itemId = options.itemId || '';
    this.setData({ itemId });
    this.loadItemDetail(itemId);
    checkLogin();
  },
  // 加载物品详情，先尝试失物接口，再 fallback 到寻物接口
  async loadItemDetail(itemId) {
    if (!itemId) return;
    try {
      let item;
      try {
        item = await get(`/lost/${itemId}`);
      } catch {
        item = await get(`/found/${itemId}`);
      }
      this.setData({ item });
    } catch (err) {
      wx.showToast({ title: '加载详情失败', icon: 'none' });
    }
  },
  // 表单输入
  onFormInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`formData.${key}`]: e.detail.value });
  },

  // 选择图片
  chooseImg() {
    wx.chooseImage({
      count: 3 - this.data.imgList.length,
      success: (res) => {
        this.setData({ imgList: [...this.data.imgList, ...res.tempFilePaths] });
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

  // 提交认领申请
  async submitClaim() {
    if (this.data.isSubmitting) return;
    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '提交中...', mask: true });

    try {
      let imgUrls = [];
      for (const path of this.data.imgList) {
        const res = await uploadImage(path, false);
        imgUrls.push(res?.data || res || '');
      }

      const payload = {
        itemId: this.data.itemId,
        credentials: this.data.formData.credentials,
        contact: this.data.formData.contact,
        imgUrls: imgUrls.filter(Boolean)
      };

      await post('/claim/apply', payload, false);

      // hideLoading must come before showToast — they share one overlay layer
      wx.hideLoading();
      wx.showToast({ title: '申请成功，待管理员审核', icon: 'success' });
      setTimeout(() => { wx.navigateBack(); }, 2000);
    } catch (_err) {
      wx.hideLoading();
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});