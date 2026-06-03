const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    session: {},
    courses: [],
    uploadDraft: {
      courseSessionId: 'cs_001',
      title: '课堂统一测验',
      type: 'post',
      fileName: '课堂统一测验.pdf',
      size: 1024000
    }
  },

  onShow() {
    const session = Guard.ensureLogin('teacher');
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    Api.getTeacherCourses()
      .then((result) => this.setData({ courses: result.courses }))
      .catch((error) => Notice.alert(error.message || '课程加载失败'));
  },

  input(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`uploadDraft.${field}`]: event.detail.value });
  },

  uploadFile() {
    Api.uploadAssignmentFile(this.data.uploadDraft)
      .then(() => {
        Notice.toast('已保存文件元信息', 'success');
        this.load();
      })
      .catch((error) => Notice.alert(error.message || '上传失败'));
  },

  goDetail(event) {
    wx.navigateTo({ url: `/pages/course-detail/course-detail?id=${event.currentTarget.dataset.id}` });
  },

  previewFile(event) {
    wx.navigateTo({ url: `/pages/file-preview/file-preview?id=${event.currentTarget.dataset.id}` });
  },

  addWrong() {
    wx.navigateTo({ url: '/pages/wrong-record-editor/wrong-record-editor' });
  }
});
