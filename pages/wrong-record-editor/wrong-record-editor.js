const Api = require('../../services/api');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

Page({
  data: {
    session: {},
    context: {
      course: {},
      courseSession: {},
      student: {}
    },
    draft: {
      courseId: '',
      courseSessionId: '',
      studentId: '',
      teacherId: '',
      topic: '',
      mistakeReason: '',
      correction: ''
    },
    imageFile: null
  },

  onLoad(query) {
    this.setData({
      'draft.courseId': query.courseId || '',
      'draft.courseSessionId': query.courseSessionId || '',
      'draft.studentId': query.studentId || ''
    });
  },

  onShow() {
    const session = Guard.ensureLogin('teacher');
    if (!session) return;
    this.setData({
      session,
      'draft.teacherId': session.teacherId || ''
    });
    this.loadContext();
  },

  loadContext() {
    if (!this.data.draft.courseSessionId || !this.data.draft.studentId) return;
    Api.getCourseSessionDetail(this.data.draft.courseSessionId)
      .then((detail) => {
        const student = (detail.students || []).find((item) => item.id === this.data.draft.studentId) || {};
        this.setData({
          context: {
            course: detail.course || {},
            courseSession: detail.courseSession || {},
            student
          },
          'draft.courseId': (detail.course && detail.course.id) || this.data.draft.courseId
        });
      })
      .catch((error) => Notice.alert(error.message || '错题上下文加载失败'));
  },

  input(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`draft.${field}`]: event.detail.value });
  },

  mockImage() {
    Api.uploadWrongRecordImage({
      fileName: '错题图片.png',
      size: 320000
    })
      .then((file) => {
        this.setData({ imageFile: file });
        Notice.toast('已保存图片元信息');
      })
      .catch((error) => Notice.alert(error.message || '图片上传失败'));
  },

  save() {
    if (!this.data.draft.topic) {
      Notice.toast('请填写知识点');
      return;
    }
    Api.createWrongRecord({
      ...this.data.draft,
      imageFileId: this.data.imageFile ? this.data.imageFile.id : ''
    })
      .then(() => {
        Notice.toast('错题已保存', 'success');
        wx.navigateBack();
      })
      .catch((error) => Notice.alert(error.message || '保存失败'));
  }
});
