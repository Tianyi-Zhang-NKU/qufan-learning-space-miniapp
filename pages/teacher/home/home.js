const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    session: {},
    dashboard: {
      metrics: [],
      todayCourses: [],
      pendingFeedbackSessions: [],
      recentFeedbacks: []
    },
    activePanel: 'pending'
  },

  onShow() {
    const session = Guard.ensureLogin('teacher');
    if (!session) return;
    this.setData({ session });
    Api.getTeacherDashboard()
      .then((dashboard) => this.setData({ dashboard }))
      .catch((error) => Notice.alert(error.message || '首页加载失败'));
  },

  goCourses() {
    wx.redirectTo({ url: '/pages/teacher/courses/courses' });
  },

  goSession(event) {
    wx.navigateTo({ url: `/pages/course-detail/course-detail?id=${event.currentTarget.dataset.id}` });
  },

  setPanel(event) {
    this.setData({ activePanel: event.currentTarget.dataset.panel });
  }
});
