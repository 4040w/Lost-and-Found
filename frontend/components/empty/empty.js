Component({
  /**
   * 组件的属性列表
   */
  properties: {
    // 自定义图标（emoji/图片路径）
    icon: {
      type: String,
      value: ''
    },
    // 主文案
    text: {
      type: String,
      value: '暂无相关数据'
    },
    // 副文案
    subtext: {
      type: String,
      value: ''
    },
    // 按钮文本（不传则不显示）
    btnText: {
      type: String,
      value: ''
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 按钮点击事件
    onBtnClick() {
      this.triggerEvent('btnClick');
    }
  }
});