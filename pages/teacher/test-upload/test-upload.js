const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');
const FeedbackTypes = require('../../../utils/feedback-types');

Page({
  data: {
    session: {},
    courseId: '',
    courseName: '',
    type: 'pre',
    typeLabel: '课堂小测',
    sessions: [],
    assignments: [],
    currentSession: null,
    activeSessionId: '',
    uploadedFiles: [],
    questionSlots: [],
    newQuestionTitle: '',
    uploading: false,
    uploadingFileName: ''
  },

  onLoad(options) {
    const { courseId, courseName, type, courseSessionId } = options;
    const typeLabel = FeedbackTypes.feedbackTypeShortLabel(type === 'pre' ? 'pre' : 'post');
    this.setData({
      courseId: courseId || '',
      courseName: decodeURIComponent(courseName || ''),
      type: type || 'pre',
      typeLabel,
      activeSessionId: courseSessionId || ''
    });
    wx.setNavigationBarTitle({ title: `${typeLabel} - ${this.data.courseName}` });
  },

  onShow() {
    const session = Guard.ensureLogin('teacher');
    if (!session) return;
    this.setData({ session });
    if (this.data.courseId) {
      this.loadCourseData();
    }
  },

  /** 加载课程数据（课次列表和已有上传） */
  loadCourseData() {
    Api.getTeacherCourseDetail(this.data.courseId)
      .then((data) => {
        const sessions = data.sessions || [];
        const assignments = data.assignments || [];
        const keepActive = sessions.some((item) => item.id === this.data.activeSessionId);
        const activeSessionId = keepActive
          ? this.data.activeSessionId
          : (sessions.length ? sessions[0].id : '');
        const currentSession = sessions.find((item) => item.id === activeSessionId) || null;
        this.setData({
          sessions,
          assignments,
          activeSessionId,
          currentSession
        });
        this.loadQuestions();
      })
      .catch((error) => Notice.alert(error.message || '课程数据加载失败'));
  },

  /** 选择课次 */
  selectSession(event) {
    const sessionId = event.currentTarget.dataset.sessionId;
    const currentSession = this.data.sessions.find((s) => s.id === sessionId);
    this.setData({ activeSessionId: sessionId, currentSession });
    this.loadQuestions();
  },

  /** 加载已上传的 assignment 文件 */
  loadAssignments(allAssignments, questions) {
    const questionSlots = questions || this.data.questionSlots || [];
    const assignments = (allAssignments || []).filter(
      (a) => a.type === this.data.type && a.courseSessionId === this.data.activeSessionId
    );
    const files = assignments
      .filter((a) => a.file)
      .map((a) => ({
        id: a.id,
        name: a.file.name || '未命名文件',
        ext: a.file.ext || '',
        sizeText: this.formatSize(a.file.size || 0),
        uploadedAt: a.file.uploadedAt || '',
        fileId: a.fileId,
        questionId: (questionSlots.find((question) => question.fileId === a.fileId) || {}).id || ''
      }));
    this.setData({ uploadedFiles: files });
  },

  loadQuestions() {
    if (!this.data.activeSessionId || !Api.getTeacherLessonDetail) return;
    Api.getTeacherLessonDetail(this.data.activeSessionId)
      .then((detail) => {
        const questionSlots = detail.questions || [];
        this.setData({ questionSlots });
        this.loadAssignments(this.data.assignments, questionSlots);
      })
      .catch(() => this.setData({ questionSlots: [] }));
  },

  onQuestionTitleInput(event) {
    this.setData({ newQuestionTitle: event.detail.value || '' });
  },
  /** 选择文件上传 */
  chooseFile() {
    if (this.data.uploading) return;
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf', 'doc', 'docx'],
      success: (res) => {
        const file = res.tempFiles[0];
        this.doUpload(file);
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('cancel')) return;
        Notice.toast('选择文件失败');
      }
    });
  },

  /** 执行上传 */
  doUpload(file) {
    const fileName = file.name || '未命名文件';
    this.setData({ uploading: true, uploadingFileName: fileName });

    Api.uploadFeedbackFile({ fileName, tempPath: file.path || file.tempFilePath || '', size: file.size || 0 })
      .then((uploadedFile) => Api.publishAssignment({
        courseId: this.data.courseId,
        courseSessionId: this.data.activeSessionId,
        type: this.data.type,
        title: `${this.data.typeLabel} - ${fileName}`,
        fileId: uploadedFile.id
      }).then(() => uploadedFile))
      .then((uploadedFile) => Api.createLessonQuestions({
        courseId: this.data.courseId,
        courseSessionId: this.data.activeSessionId,
        questions: [{
          title: this.data.newQuestionTitle.trim() || `${this.data.typeLabel}题目 ${this.data.questionSlots.length + 1}`,
          order: this.data.questionSlots.length + 1,
          fileId: uploadedFile.id
        }]
      }))
      .then(() => {
        Notice.toast('题目资料已上传');
        this.setData({ uploading: false, uploadingFileName: '', newQuestionTitle: '' });
        this.loadCourseData();
      })
      .catch((error) => {
        this.setData({ uploading: false });
        Notice.alert(error.message || '上传失败，请重试');
      });
  },

  /** 删除已上传文件 */
  removeFile(event) {
    const questionId = event.currentTarget.dataset.questionId;
    if (!questionId) {
      Notice.alert('该资料没有关联题目，暂不能删除。');
      return;
    }
    wx.showModal({
      title: '确认删除',
      content: '删除后会同步移除题目框和相关学生错题记录，且不可恢复。',
      confirmText: '删除',
      confirmColor: '#ef4444',
      success: (res) => {
        if (!res.confirm) return;
        Api.deleteLessonQuestion({
          courseId: this.data.courseId,
          courseSessionId: this.data.activeSessionId,
          questionId
        })
          .then(() => {
            Notice.toast('题目资料已删除');
            this.loadCourseData();
          })
          .catch((error) => Notice.alert(error.message || '删除失败'));
      }
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
