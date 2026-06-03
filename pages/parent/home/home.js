const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    session: {},
    dashboard: {
      currentStudent: {},
      metrics: [],
      courses: [],
      todayCourses: [],
      recentFeedbacks: []
    },
    activePanel: 'feedback'
  },

  onShow() {
    const session = Guard.ensureLogin('parent');
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    Api.getStudentDashboard()
      .then((dashboard) => this.setData({ dashboard }))
      .catch((error) => Notice.alert(error.message || '首页加载失败'));
  },

  goCourses() {
    wx.redirectTo({ url: '/pages/parent/courses/courses' });
  },

  goFeedbacks() {
    wx.redirectTo({ url: '/pages/parent/exercises/exercises' });
  },

  goLive(event) {
    wx.navigateTo({ url: `/pages/live-player/live-player?id=${event.currentTarget.dataset.id}` });
  },

  setPanel(event) {
    this.setData({ activePanel: event.currentTarget.dataset.panel });
  }
});
