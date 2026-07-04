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
      students: [],
      lessonFeedbacks: []
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
      const loader = this.data.session.role === 'parent' ? Api.getStudentCourseDetail : Api.getTeacherCourseDetail;
      loader(this.data.courseId)
        .then((detail) => this.setData({ detail, mode: 'course' }))
        .catch((error) => Notice.alert(error.message || '课程详情加载失败'));
      return;
    }
    if (!this.data.courseSessionId) return;
    const loader = this.data.session.role === 'parent' ? Api.getCourseSessionDetail : Api.getTeacherLessonDetail;
    loader(this.data.courseSessionId)
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

  uploadFeedback(event) {
    if (this.data.session.role !== 'teacher') return;
    const studentId = event.currentTarget.dataset.id;
    const course = this.data.detail.course || {};
    const courseSession = this.data.detail.courseSession || {};
    wx.navigateTo({
      url: `/pages/wrong-record-editor/wrong-record-editor?courseId=${course.id}&courseSessionId=${courseSession.id}&studentId=${studentId}`
    });
  },

  viewFeedback(event) {
    const feedbackId = event.currentTarget.dataset.id;
    if (!feedbackId) return;
    Api.getFeedbackDetail(feedbackId)
      .then((feedback) => {
        Notice.alert(feedback.text || '这条反馈只有图片或语音。', `${feedback.studentName} · 课后反馈`);
      })
      .catch((error) => Notice.alert(error.message || '反馈加载失败'));
  },

  previewMedia(event) {
    wx.navigateTo({ url: `/pages/file-preview/file-preview?id=${event.currentTarget.dataset.id}` });
  },

  publishOptionalRecord(event) {
    if (this.data.session.role !== 'teacher') return;
    const type = event.currentTarget.dataset.type;
    const session = this.data.detail.courseSession || {};
    const course = this.data.detail.course || {};
    const typeText = type === 'pre' ? '课前测' : '课后测';
    Api.publishAssignment({
      courseId: course.id,
      courseSessionId: session.id,
      type,
      title: `${session.sessionTitle || '本课次'}${typeText}记录`,
      fileName: `${course.name || '课程'}-${session.sessionTitle || '课次'}-${typeText}.pdf`,
      size: 2048
    })
      .then(() => {
        Notice.toast('可选资料记录已保存', 'success');
        this.load();
      })
      .catch((error) => Notice.alert(error.message || '保存失败'));
  }
});
