const Api = require('../../services/api');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

Page({
  data: {
    session: {},
    courseId: '',
    courseSessionId: '',
    mode: 'session',
    detail: {
      mode: '',
      course: {},
      courseSession: {},
      assignments: [],
      students: []
    }
  },

  onLoad(query) {
    this.setData({
      courseId: query.courseId || '',
      courseSessionId: query.id || query.courseSessionId || ''
    });
  },

  onShow() {
    const session = Guard.ensureLogin();
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    if (this.data.courseId) {
      Api.getCourseGroupDetail(this.data.courseId)
        .then((detail) => this.setData({ detail, mode: 'course' }))
        .catch((error) => Notice.alert(error.message || '课程详情加载失败'));
      return;
    }
    if (!this.data.courseSessionId) return;
    Api.getCourseSessionDetail(this.data.courseSessionId)
      .then((detail) => this.setData({ detail, mode: 'session' }))
      .catch((error) => Notice.alert(error.message || '课次详情加载失败'));
  },

  openSession(event) {
    wx.navigateTo({ url: `/pages/course-detail/course-detail?id=${event.currentTarget.dataset.id}` });
  },

  goLive(event) {
    const id = event.currentTarget.dataset.id || this.data.detail.courseSession.id;
    wx.navigateTo({ url: `/pages/live-player/live-player?id=${id}` });
  },

  previewFile(event) {
    wx.navigateTo({ url: `/pages/file-preview/file-preview?id=${event.currentTarget.dataset.id}` });
  },

  publishAssignment(event) {
    if (this.data.session.role !== 'teacher') return;
    const type = event.currentTarget.dataset.type;
    const session = this.data.detail.courseSession || {};
    const course = this.data.detail.course || {};
    const typeText = type === 'pre' ? '课前测' : '课后测';
    Api.publishAssignment({
      courseId: course.id,
      courseSessionId: session.id,
      type,
      title: `${session.sessionTitle || '本课次'}${typeText}`,
      fileName: `${course.name || '课程'}-${session.sessionTitle || '课次'}-${typeText}.pdf`,
      size: 2048
    })
      .then(() => {
        Notice.toast('已保存文件元信息', 'success');
        this.load();
      })
      .catch((error) => Notice.alert(error.message || '发布失败'));
  },

  recordWrong(event) {
    if (this.data.session.role !== 'teacher') return;
    const studentId = event.currentTarget.dataset.id;
    const course = this.data.detail.course || {};
    const session = this.data.detail.courseSession || {};
    wx.navigateTo({
      url: `/pages/wrong-record-editor/wrong-record-editor?courseId=${course.id}&courseSessionId=${session.id}&studentId=${studentId}`
    });
  }
});
