const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    session: {},
    teacher: {},
    courseGroups: []
  },

  onShow() {
    const session = Guard.ensureLogin('teacher');
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    Api.getTeacherCourseGroups()
      .then((result) => {
        this.setData({
          teacher: result.teacher || {},
          courseGroups: result.courseGroups || result.courses || []
        });
      })
      .catch((error) => Notice.alert(error.message || '课程加载失败'));
  },

  goCourse(event) {
    wx.navigateTo({ url: `/pages/course-detail/course-detail?courseId=${event.currentTarget.dataset.id}` });
  },

  goSession(event) {
    wx.navigateTo({ url: `/pages/course-detail/course-detail?id=${event.currentTarget.dataset.id}` });
  },

  previewFile(event) {
    wx.navigateTo({ url: `/pages/file-preview/file-preview?id=${event.currentTarget.dataset.id}` });
  }
});
