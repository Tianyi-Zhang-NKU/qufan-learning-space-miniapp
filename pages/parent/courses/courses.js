const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    session: {},
    children: [],
    currentChild: {},
    courses: []
  },

  onShow() {
    const session = Guard.ensureLogin('parent');
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    Promise.all([Api.getParentChildren(), Api.getParentCourses({})])
      .then(([children, result]) => {
        this.setData({
          children,
          currentChild: result.currentChild,
          courses: result.courses
        });
      })
      .catch((error) => Notice.alert(error.message || '课程加载失败'));
  },

  switchChild(event) {
    Api.switchActiveChild(event.currentTarget.dataset.id).then((session) => {
      getApp().setSession(session);
      this.setData({ session });
      this.load();
    });
  },

  goDetail(event) {
    wx.navigateTo({ url: `/pages/course-detail/course-detail?id=${event.currentTarget.dataset.id}` });
  },

  goLive(event) {
    wx.navigateTo({ url: `/pages/live-player/live-player?id=${event.currentTarget.dataset.id}` });
  }
});
