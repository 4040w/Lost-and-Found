Component({
  /**
   * 组件的属性列表
   */
  properties: {
    // 标题
    title: {
      type: String,
      value: '校园失物招领'
    },
    // 是否显示返回按钮
    showBack: {
      type: Boolean,
      value: true
    },
    // 右侧按钮文本
    rightText: {
      type: String,
      value: ''
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 返回按钮点击
    onBackClick() {
      wx.navigateBack();
    },
    // 右侧按钮点击
    onRightClick() {
      this.triggerEvent('rightClick');
    }
  }
});