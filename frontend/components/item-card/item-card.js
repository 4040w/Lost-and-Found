import env from '../../config/env';

Component({
  options: {
    multipleSlots: true
  },

  /**
   * 组件的属性列表
   */
  properties: {
    // 物品数据（必传）
    item: {
      type: Object,
      value: {},
      observer(newVal) {
        // 监听数据变化，更新视图
        this.setData({ item: newVal });
      }
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    baseUrl: env.baseUrl
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // Compact date string: 11月15日 / 昨天 / 16:25 (today)
    formatTime(timeStr) {
      if (!timeStr) return '';
      const d = new Date(timeStr);
      if (Number.isNaN(d.getTime())) return timeStr.split(' ')[0] || '';
      const now = new Date();
      const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
      if (sameDay) {
        const hh = `${d.getHours()}`.padStart(2, '0');
        const mm = `${d.getMinutes()}`.padStart(2, '0');
        return `今天 ${hh}:${mm}`;
      }
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      if (
        d.getFullYear() === yest.getFullYear() &&
        d.getMonth() === yest.getMonth() &&
        d.getDate() === yest.getDate()
      ) return '昨天';
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    },

    // 卡片点击事件（触发父页面回调）
    onCardClick(e) {
      this.triggerEvent('cardClick', {
        itemId: e.currentTarget.dataset.id,
        type: e.currentTarget.dataset.type
      });
    }
  }
});