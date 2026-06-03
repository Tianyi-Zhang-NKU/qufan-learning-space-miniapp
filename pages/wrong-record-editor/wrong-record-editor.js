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
      text: ''
    },
    imageFiles: [],
    voiceFiles: [],
    saving: false
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
      'draft.teacherId': session.teacherId
    });
    this.loadContext();
  },

  loadContext() {
    if (!this.data.draft.courseSessionId) return;
    Api.getTeacherLessonDetail(this.data.draft.courseSessionId)
      .then((detail) => {
        const student = (detail.students || []).find((item) => item.id === this.data.draft.studentId) || {};
        this.setData({
          context: {
            course: detail.course || {},
            courseSession: detail.courseSession || {},
            student
          },
          'draft.courseId': detail.course ? detail.course.id : this.data.draft.courseId
        });
      })
      .catch((error) => Notice.alert(error.message || '反馈上下文加载失败'));
  },

  inputText(event) {
    this.setData({ 'draft.text': event.detail.value });
  },

  chooseImage() {
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 6,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const files = res.tempFiles || [];
          this.uploadImages(files.map((item, index) => ({
            fileName: item.tempFilePath ? item.tempFilePath.split('/').pop() : `feedback-${index + 1}.jpg`,
            size: item.size || 0,
            tempPath: item.tempFilePath || ''
          })));
        }
      });
      return;
    }
    this.addMockImage();
  },

  uploadImages(files) {
    Promise.all(files.map((file) => Api.uploadFeedbackImage(file)))
      .then((uploaded) => {
        this.setData({ imageFiles: this.data.imageFiles.concat(uploaded) });
      })
      .catch((error) => Notice.alert(error.message || '图片上传失败'));
  },

  addMockImage() {
    Api.uploadFeedbackImage({
      fileName: `课后反馈图片-${this.data.imageFiles.length + 1}.jpg`,
      size: 260000,
      tempPath: ''
    })
      .then((file) => this.setData({ imageFiles: this.data.imageFiles.concat(file) }))
      .catch((error) => Notice.alert(error.message || '图片上传失败'));
  },

  addMockVoice() {
    Api.uploadFeedbackVoice({
      fileName: `课后反馈语音-${this.data.voiceFiles.length + 1}.m4a`,
      size: 120000,
      duration: 18,
      tempPath: ''
    })
      .then((file) => this.setData({ voiceFiles: this.data.voiceFiles.concat(file) }))
      .catch((error) => Notice.alert(error.message || '语音上传失败'));
  },

  removeImage(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({ imageFiles: this.data.imageFiles.filter((item) => item.id !== id) });
  },

  removeVoice(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({ voiceFiles: this.data.voiceFiles.filter((item) => item.id !== id) });
  },

  save() {
    if (!String(this.data.draft.text || '').trim() && !this.data.imageFiles.length && !this.data.voiceFiles.length) {
      Notice.toast('请填写文字反馈或添加图片/语音');
      return;
    }
    this.setData({ saving: true });
    Api.createLessonFeedback({
      ...this.data.draft,
      imageFileIds: this.data.imageFiles.map((item) => item.id),
      voiceFileIds: this.data.voiceFiles.map((item) => item.id)
    })
      .then(() => {
        Notice.toast('反馈已保存', 'success');
        wx.navigateBack();
      })
      .catch((error) => Notice.alert(error.message || '保存失败'))
      .finally(() => {
        this.setData({ saving: false });
      });
  }
});
