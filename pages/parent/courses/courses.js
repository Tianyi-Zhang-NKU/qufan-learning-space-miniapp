const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    session: {},
    currentStudent: {},
    courseGroups: []
  },

  onShow() {
    const session = Guard.ensureLogin('parent');
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    Api.getStudentCourses()
      .then((result) => {
        this.setData({
          currentStudent: result.currentStudent || {},
          courseGroups: result.courseGroups || result.courses || []
        });
      })
      .catch((error) => Notice.alert(error.message || '课程加载失败'));
  },

  goDetail(event) {
    wx.navigateTo({ url: `/pages/course-detail/course-detail?courseId=${event.currentTarget.dataset.id}` });
  },

  goSession(event) {
    wx.navigateTo({ url: `/pages/course-detail/course-detail?id=${event.currentTarget.dataset.id}` });
  },

  goLive(event) {
    wx.navigateTo({ url: `/pages/live-player/live-player?id=${event.currentTarget.dataset.id}` });
  }
});
