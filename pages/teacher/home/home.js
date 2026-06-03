const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    session: {},
    dashboard: {
      metrics: [],
      todayCourses: [],
      pendingAssignments: [],
      recentWrongRecords: []
    }
  },

  onShow() {
    const session = Guard.ensureLogin('teacher');
    if (!session) return;
    this.setData({ session });
    Api.getDashboard()
      .then((dashboard) => this.setData({ dashboard }))
      .catch((error) => Notice.alert(error.message || '首页加载失败'));
  },

  goCourses() {
    wx.redirectTo({ url: '/pages/teacher/courses/courses' });
  }
});
