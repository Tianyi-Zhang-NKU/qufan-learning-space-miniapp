const TABS = {
  parent: [
    { text: '首页', mark: '首', url: '/pages/parent/home/home' },
    { text: '课程中心', mark: '课', url: '/pages/parent/courses/courses' },
    { text: '习题中心', mark: '习', url: '/pages/parent/exercises/exercises' },
    { text: '个人中心', mark: '我', url: '/pages/profile/profile' }
  ],
  teacher: [
    { text: '首页', mark: '首', url: '/pages/teacher/home/home' },
    { text: '课程管理', mark: '课', url: '/pages/teacher/courses/courses' },
    { text: '个人中心', mark: '我', url: '/pages/profile/profile' }
  ],
  admin: [
    { text: '首页', mark: '首', url: '/pages/admin/home/home' },
    { text: '数据管理', mark: '管', url: '/pages/admin/manage/manage' },
    { text: '排课看板', mark: '表', url: '/pages/admin/schedule-board/schedule-board' },
    { text: '个人中心', mark: '我', url: '/pages/profile/profile' }
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
    }
  },

  data: {
    list: []
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
      const list = (TABS[this.data.role] || TABS.parent).map((item) => ({
        ...item,
        active: item.url === this.data.current
      }));
      this.setData({ list });
    },

    go(event) {
      const url = event.currentTarget.dataset.url;
      if (!url || url === this.data.current) return;
      wx.redirectTo({ url });
    }
  }
});
