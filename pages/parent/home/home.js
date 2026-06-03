const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    session: {},
    dashboard: {
      currentChild: {},
      metrics: [],
      children: [],
      todayCourses: [],
      pendingAssignments: [],
      pendingWrongRecords: []
    },
    childOptions: [],
    childIndex: 0,
    currentChildLabel: ''
  },

  onShow() {
    const session = Guard.ensureLogin('parent');
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    Api.getDashboard()
      .then((dashboard) => {
        const children = dashboard.children || [];
        const activeId = dashboard.currentChild ? dashboard.currentChild.id : '';
        const childIndex = Math.max(0, children.findIndex((item) => item.id === activeId));
        this.setData({
          dashboard,
          childOptions: children.map((item) => item.displayLabel || item.name),
          childIndex,
          currentChildLabel: children[childIndex] ? (children[childIndex].displayLabel || children[childIndex].name) : ''
        });
      })
      .catch((error) => Notice.alert(error.message || '首页加载失败'));
  },

  switchChild(event) {
    const child = this.data.dashboard.children[Number(event.detail.value || 0)];
    const studentId = child ? child.id : '';
    if (!studentId) return;
    Api.switchActiveChild(studentId)
      .then((session) => {
        getApp().setSession(session);
        this.setData({ session });
        this.load();
      })
      .catch((error) => Notice.alert(error.message || '切换孩子失败'));
  },

  goCourses() {
    wx.redirectTo({ url: '/pages/parent/courses/courses' });
  },

  goExercises() {
    wx.redirectTo({ url: '/pages/parent/exercises/exercises' });
  },

  goLive(event) {
    wx.navigateTo({ url: `/pages/live-player/live-player?id=${event.currentTarget.dataset.id}` });
  }
});
