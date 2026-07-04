const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    courseId: '',
    courseName: '',
    preCount: 0,
    postCount: 0
  },

  onLoad(options) {
    const session = Guard.ensureLogin('parent');
    if (!session) return;
    this.setData({ courseId: options.courseId || '' });
    this.load();
  },

  load() {
    const { courseId } = this.data;
    if (!courseId) return;

    Api.getStudentDashboard()
      .then((dashboard) => {
        const courses = dashboard.courses || [];
        const course = courses.find((c) => c.id === courseId);
        if (!course) return;

        const sessions = course.sessions || [];
        const preCount = sessions.reduce((sum, s) => sum + (s.preFeedbackCount || 0), 0);
        const postCount = sessions.reduce((sum, s) => sum + (s.postFeedbackCount || 0), 0);

        this.setData({
          courseName: course.name || '',
          preCount,
          postCount
        });
      })
      .catch((error) => {
        Notice.alert(error.message || '加载失败');
      });
  },

  goTest(event) {
    const type = event.currentTarget.dataset.type;
    const { courseId } = this.data;
    wx.navigateTo({
      url: `/pages/parent/exercises/exercises?courseId=${courseId}&type=${type}`
    });
  }
});
