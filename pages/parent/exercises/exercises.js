const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    session: {},
    currentStudent: {},
    courses: [],
    feedbacks: [],
    selectedCourseId: ''
  },

  onShow() {
    const session = Guard.ensureLogin('parent');
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    Promise.all([Api.getStudentCourses(), Api.getStudentLessonFeedbacks({ courseId: this.data.selectedCourseId })])
      .then(([courseResult, feedbackResult]) => {
        this.setData({
          currentStudent: courseResult.currentStudent || {},
          courses: courseResult.courses || courseResult.courseGroups || [],
          feedbacks: feedbackResult.feedbacks || []
        });
      })
      .catch((error) => Notice.alert(error.message || '反馈加载失败'));
  },

  setCourse(event) {
    const courseId = event.currentTarget.dataset.id || '';
    this.setData({ selectedCourseId: courseId }, () => this.load());
  },

  previewMedia(event) {
    wx.navigateTo({ url: `/pages/file-preview/file-preview?id=${event.currentTarget.dataset.id}` });
  },

  downloadImage(event) {
    Api.downloadFeedbackImage(event.currentTarget.dataset.id)
      .then((result) => Notice.alert(result.message, '图片下载'))
      .catch((error) => Notice.alert(error.message || '下载失败'));
  },

  playVoice(event) {
    Api.playFeedbackVoice(event.currentTarget.dataset.id)
      .then((result) => Notice.alert(result.message, '语音播放'))
      .catch((error) => Notice.alert(error.message || '播放失败'));
  }
});
