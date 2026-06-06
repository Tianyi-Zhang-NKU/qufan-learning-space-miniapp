const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    session: {},
    courseId: '',
    courseName: '',
    type: 'pre',        // 'pre' 或 'post'
    typeLabel: '课前测',
    sessions: [],
    assignments: [],
    currentSession: null,
    activeSessionId: '',
    uploadedFiles: [],
    uploading: false,
    uploadingFileName: ''
  },

  onLoad(options) {
    const { courseId, courseName, type } = options;
    const typeLabel = type === 'pre' ? '课前测' : '课后测';
    this.setData({
      courseId: courseId || '',
      courseName: decodeURIComponent(courseName || ''),
      type: type || 'pre',
      typeLabel
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
        this.loadAssignments(assignments);
      })
      .catch((error) => Notice.alert(error.message || '课程数据加载失败'));
  },

  /** 选择课次 */
  selectSession(event) {
    const sessionId = event.currentTarget.dataset.sessionId;
    const currentSession = this.data.sessions.find((s) => s.id === sessionId);
    this.setData({ activeSessionId: sessionId, currentSession });
    this.loadAssignments(this.data.assignments);
  },

  /** 加载已上传的 assignment 文件 */
  loadAssignments(allAssignments) {
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
        fileId: a.fileId
      }));
    this.setData({ uploadedFiles: files });
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

    Api.publishAssignment({
      courseId: this.data.courseId,
      courseSessionId: this.data.activeSessionId,
      type: this.data.type,
      title: `${this.data.typeLabel} - ${fileName}`,
      fileName: fileName,
      size: file.size || 0
    })
      .then(() => {
        Notice.toast('上传成功');
        this.setData({ uploading: false, uploadingFileName: '' });
        // 重新加载数据
        this.loadCourseData();
      })
      .catch((error) => {
        this.setData({ uploading: false, uploadingFileName: '' });
        Notice.alert(error.message || '上传失败，请重试');
      });
  },

  /** 删除已上传文件 */
  removeFile(event) {
    const fileId = event.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该文件吗？删除后不可恢复。',
      confirmText: '删除',
      confirmColor: '#ef4444',
      success: (res) => {
        if (!res.confirm) return;
        const files = this.data.uploadedFiles.filter((f) => f.id !== fileId);
        this.setData({ uploadedFiles: files });
        Notice.toast('已删除');
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
