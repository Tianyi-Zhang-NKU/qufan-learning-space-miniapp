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
    }
  },

  onShow() {
    const session = Guard.ensureLogin('parent');
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    Api.getDashboard()
      .then((dashboard) => this.setData({ dashboard }))
      .catch((error) => Notice.alert(error.message || '首页加载失败'));
  },

  switchChild(event) {
    const studentId = event.currentTarget.dataset.id;
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
