const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    session: {},
    courseId: '',
    courseName: '',
    studentId: '',
    studentName: '',

    // 课次相关
    sessions: [],
    activeSessionId: '',

    // 已有反馈
    existingFeedback: null,

    // 表单数据
    feedbackText: '',
    imageFiles: [],     // { id, name, tempPath, type }
    attachFiles: [],    // { id, name, ext, size, sizeText, tempPath }
    submitting: false
  },

  onLoad(options) {
    const { courseId, courseName, studentId, studentName } = options;
    this.setData({
      courseId: courseId || '',
      courseName: decodeURIComponent(courseName || ''),
      studentId: studentId || '',
      studentName: decodeURIComponent(studentName || '')
    });
    wx.setNavigationBarTitle({ title: `反馈 - ${this.data.studentName}` });
  },

  onShow() {
    const session = Guard.ensureLogin('teacher');
    if (!session) return;
    this.setData({ session });
    if (this.data.courseId) {
      this.loadCourseData();
    }
  },

  /** 加载课程数据（含课次列表和学生已有反馈） */
  loadCourseData() {
    Api.getTeacherCourseDetail(this.data.courseId)
      .then((data) => {
        const sessions = data.sessions || [];
        // 默认选中第一个课次
        const activeSessionId = sessions.length ? sessions[0].id : '';
        this.setData({ sessions, activeSessionId });
        if (activeSessionId) {
          this.loadSessionFeedback(activeSessionId);
        }
      })
      .catch((error) => Notice.alert(error.message || '课程数据加载失败'));
  },

  /** 选择课次，加载对应反馈 */
  selectSession(event) {
    const sessionId = event.currentTarget.dataset.sessionId;
    this.setData({ activeSessionId: sessionId });
    this.loadSessionFeedback(sessionId);
  },

  /** 加载指定课次下该学生的已有反馈 */
  loadSessionFeedback(sessionId) {
    Api.getTeacherLessonDetail(sessionId)
      .then((data) => {
        const feedbacks = (data.lessonFeedbacks || data.feedbacks || [])
          .filter(
            (f) => f.studentId === this.data.studentId
              && f.teacherId === this.data.session.teacherId
          );

        if (feedbacks.length) {
          // 取最新的反馈
          const fb = feedbacks[0];
          const existingFeedback = {
            ...fb,
            imageFiles: fb.imageFiles || [],
            voiceFiles: fb.voiceFiles || [],
            attachFiles: fb.attachFiles || []
          };
          this.setData({ existingFeedback, feedbackText: fb.text || '' });
        } else {
          this.setData({ existingFeedback: null, feedbackText: '' });
        }
      })
      .catch(() => {
        // 加载失败时静默处理
        this.setData({ existingFeedback: null, feedbackText: '' });
      });
  },

  /** 文本输入 */
  onTextInput(event) {
    this.setData({ feedbackText: event.detail.value });
  },

  /** 选择图片 */
  chooseImage() {
    wx.chooseMedia({
      count: 3,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map((file, index) => ({
          id: `img_${Date.now()}_${index}`,
          name: `反馈图片_${Date.now()}.jpg`,
          tempPath: file.tempFilePath,
          size: file.size,
          type: 'image'
        }));
        this.setData({
          imageFiles: [...this.data.imageFiles, ...newImages]
        });
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('cancel')) return;
        Notice.toast('选择图片失败');
      }
    });
  },

  /** 选择 PDF/Word 附件 */
  chooseAttachFile() {
    wx.chooseMessageFile({
      count: 3,
      type: 'file',
      extension: ['pdf', 'doc', 'docx'],
      success: (res) => {
        const newFiles = res.tempFiles.map((file, index) => ({
          id: `file_${Date.now()}_${index}`,
          name: file.name || '未命名文件',
          ext: (file.name || '').split('.').pop().toLowerCase(),
          size: file.size || 0,
          sizeText: this.formatSize(file.size || 0),
          tempPath: file.path
        }));
        this.setData({
          attachFiles: [...this.data.attachFiles, ...newFiles]
        });
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('cancel')) return;
        Notice.toast('选择文件失败');
      }
    });
  },

  /** 移除媒体或文件 */
  removeMedia(event) {
    const { id, type } = event.currentTarget.dataset;
    if (type === 'image') {
      const imageFiles = this.data.imageFiles.filter((f) => f.id !== id);
      this.setData({ imageFiles });
    } else if (type === 'file') {
      const attachFiles = this.data.attachFiles.filter((f) => f.id !== id);
      this.setData({ attachFiles });
    }
  },

  /** 提交反馈 */
  submitFeedback() {
    if (this.data.submitting) return;

    // 验证：至少要有文字、图片或文件
    if (!this.data.feedbackText.trim()
      && !this.data.imageFiles.length
      && !this.data.attachFiles.length) {
      Notice.toast('请至少填写文字反馈、上传图片或文件');
      return;
    }

    this.setData({ submitting: true });

    const imageUploads = this.data.imageFiles.map((file) =>
      Api.uploadFeedbackImage({
        fileName: file.name,
        tempPath: file.tempPath,
        size: file.size
      })
    );

    const fileUploads = this.data.attachFiles.map((file) =>
      Api.uploadAssignmentFile({
        courseId: this.data.courseId,
        courseSessionId: this.data.activeSessionId,
        fileName: file.name,
        size: file.size,
        type: 'post'
      })
    );

    // 先上传所有图片和文件
    Promise.all([
      ...imageUploads,
      ...fileUploads
    ])
      .then((results) => {
        const imageResults = results.slice(0, this.data.imageFiles.length);
        const fileResults = results.slice(this.data.imageFiles.length);

        const imageFileIds = imageResults.map((r) => r.id);
        const attachFileIds = fileResults.filter((r) => r && r.id).map((r) => r.id);

        return Api.createLessonFeedback({
          studentId: this.data.studentId,
          courseId: this.data.courseId,
          courseSessionId: this.data.activeSessionId,
          text: this.data.feedbackText.trim(),
          imageFileIds,
          voiceFileIds: [],
          attachFileIds
        });
      })
      .then(() => {
        Notice.toast('反馈提交成功');
        this.setData({
          submitting: false,
          feedbackText: '',
          imageFiles: [],
          attachFiles: []
        });
        // 重新加载当前课次反馈
        this.loadSessionFeedback(this.data.activeSessionId);
      })
      .catch((error) => {
        this.setData({ submitting: false });
        Notice.alert(error.message || '反馈提交失败');
      });
  },

  /** 格式化文件大小 */
  formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
});
