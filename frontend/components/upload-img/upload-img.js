import { uploadImage } from '../../utils/request';

Component({
  /**
   * 组件的属性列表
   */
  properties: {
    // 已选择的图片列表（用于编辑场景回显）
    imgList: {
      type: Array,
      value: [],
      observer(newVal) {
        this.setData({ currentImgList: newVal });
      }
    },
    // 最大上传数量（默认9张）
    maxCount: {
      type: Number,
      value: 9
    },
    // 上传提示文案
    tip: {
      type: String,
      value: ''
    },
    // 添加按钮文本（可选）
    btnText: {
      type: String,
      value: ''
    },
    // 是否显示数量统计（默认true）
    showCount: {
      type: Boolean,
      value: true
    },
    // 图片尺寸限制（单位px，默认不限制）
    maxWidth: {
      type: Number,
      value: 0
    },
    maxHeight: {
      type: Number,
      value: 0
    },
    // 图片大小限制（单位MB，默认5MB）
    maxSize: {
      type: Number,
      value: 5
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    currentImgList: [] // 当前选中的图片列表（本地路径+已上传URL）
  },

  /**
   * 生命周期函数
   */
  attached() {
    // 初始化图片列表
    this.setData({ currentImgList: this.properties.imgList });
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 选择图片
    chooseImg() {
      const remainingCount = this.properties.maxCount - this.data.currentImgList.length;
      if (remainingCount <= 0) return;

      wx.chooseImage({
        count: remainingCount, // 剩余可选择数量
        sizeType: ['original', 'compressed'], // 原图/压缩图
        sourceType: ['album', 'camera'], // 相册/相机
        success: (res) => {
          // 图片本地临时路径
          const tempPaths = res.tempFilePaths;
          // 图片信息（尺寸/大小）
          const tempFiles = res.tempFiles;

          // 校验图片尺寸和大小
          const validPaths = [];
          for (let i = 0; i < tempPaths.length; i++) {
            const file = tempFiles[i];
            const path = tempPaths[i];

            // 校验大小（转换为MB）
            const fileSize = file.size / 1024 / 1024;
            if (fileSize > this.properties.maxSize) {
              wx.showToast({
                title: `图片大小不能超过${this.properties.maxSize}MB`,
                icon: 'none'
              });
              continue;
            }

            // 校验尺寸（需先获取图片信息）
            this.getImageInfo(path, (imgInfo) => {
              const { width, height } = imgInfo;
              const hasSizeLimit = this.properties.maxWidth > 0 || this.properties.maxHeight > 0;
              if (hasSizeLimit) {
                const widthValid = this.properties.maxWidth <= 0 || width <= this.properties.maxWidth;
                const heightValid = this.properties.maxHeight <= 0 || height <= this.properties.maxHeight;
                if (!widthValid || !heightValid) {
                  wx.showToast({
                    title: `图片尺寸不能超过${this.properties.maxWidth}x${this.properties.maxHeight}px`,
                    icon: 'none'
                  });
                  return;
                }
              }

              // 校验通过，添加到列表
              validPaths.push(path);
              this.updateImgList([...this.data.currentImgList, ...validPaths]);
            });
          }

          // 无尺寸限制时直接更新
          if (this.properties.maxWidth <= 0 && this.properties.maxHeight <= 0) {
            this.updateImgList([...this.data.currentImgList, ...tempPaths]);
          }
        }
      });
    },

    // 获取图片信息（尺寸）
    getImageInfo(path, callback) {
      wx.getImageInfo({
        src: path,
        success: (res) => callback(res),
        fail: () => {
          wx.showToast({ title: '获取图片信息失败', icon: 'none' });
        }
      });
    },

    // 删除图片
    deleteImg(e) {
      const index = e.currentTarget.dataset.index;
      const newList = [...this.data.currentImgList];
      newList.splice(index, 1);
      this.updateImgList(newList);
    },

    // 预览图片
    previewImg(e) {
      const index = e.currentTarget.dataset.index;
      wx.previewImage({
        current: this.data.currentImgList[index],
        urls: this.data.currentImgList
      });
    },

    // 上传图片到服务器（对外暴露的方法，需父组件调用）
    async uploadToServer() {
      wx.showLoading({ title: '图片上传中...' });
      try {
        const uploadUrls = [];
        // 遍历本地图片路径，逐一上传
        for (const path of this.data.currentImgList) {
          // 已上传的路径直接跳过（编辑场景）：绝对URL 或 /uploads/ 相对路径
          if (path.startsWith('http') || path.startsWith('/uploads/')) {
            uploadUrls.push(path);
            continue;
          }
          // 调用上传接口（utils/request.js中的uploadImage）
          const res = await uploadImage(path, false);
          uploadUrls.push(res.data);
        }
        wx.hideLoading();
        return uploadUrls; // 返回服务器图片URL列表
      } catch (err) {
        wx.hideLoading();
        wx.showToast({ title: '图片上传失败', icon: 'none' });
        return [];
      }
    },

    // 更新图片列表并通知父组件
    updateImgList(newList) {
      this.setData({ currentImgList: newList });
      // 触发父组件事件，同步图片列表
      this.triggerEvent('change', {
        imgList: newList,
        count: newList.length
      });
    }
  }
});