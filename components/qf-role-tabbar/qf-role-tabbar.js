const TABS = {
  parent: [
    { text: '首页', icon: '/assets/icons/home.svg', url: '/pages/parent/home/home' },
    { text: '课表', icon: '/assets/icons/calendar.svg', url: '/pages/parent/courses/courses' },
    { text: '我的', icon: '/assets/icons/profile.svg', url: '/pages/profile/profile' }
  ],
  teacher: [
    { text: '首页', icon: '/assets/icons/home.svg', url: '/pages/teacher/home/home' },
    { text: '课程表', icon: '/assets/icons/calendar.svg', url: '/pages/teacher/courses/courses' },
    { text: '我的', icon: '/assets/icons/profile.svg', url: '/pages/profile/profile' }
  ],
  admin: [
    { text: '首页', icon: '/assets/icons/home.svg', url: '/pages/admin/home/home' },
    { text: '数据', icon: '/assets/icons/data.svg', url: '/pages/admin/manage/manage' },
    { text: '课表', icon: '/assets/icons/calendar.svg', url: '/pages/admin/schedule-board/schedule-board' },
    { text: '我的', icon: '/assets/icons/profile.svg', url: '/pages/profile/profile' }
  ]
};

Component({
  properties: {
    role: {
      type: String,
      value: 'parent'
    },
    current: {
      type: String,
      value: ''
    },
    fixed: {
      type: Boolean,
      value: true
    }
  },

  data: {
    list: [],
    activeIndex: 0,
    sliderStyle: ''
  },

  lifetimes: {
    attached() {
      this.refresh();
    }
  },

  observers: {
    'role,current': function refreshTabs() {
      this.refresh();
    }
  },

  methods: {
    refresh() {
      const source = TABS[this.data.role] || TABS.parent;
      const list = source.map((item) => ({
        ...item,
        active: item.url.split('?')[0] === this.data.current.split('?')[0]
      }));
      const activeIndex = Math.max(0, list.findIndex((item) => item.active));
      const width = 100 / list.length;
      this.setData({
        list,
        activeIndex,
        sliderStyle: `width: ${width}%; transform: translateX(${activeIndex * 100}%);`
      });
    },

    go(event) {
      const url = event.currentTarget.dataset.url;
      if (!url || url === this.data.current) return;
      wx.redirectTo({ url });
    }
  }
});
