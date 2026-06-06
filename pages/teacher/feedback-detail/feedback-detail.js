const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

const FEEDBACK_TYPES = [
  { value: 'pre', label: '课前测错题' },
  { value: 'post', label: '课后测错题' },
  { value: 'general', label: '课程错题' }
];

function extFromPath(path, fallback) {
  const parts = String(path || '').split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : fallback;
}

Page({
  recorderManager: null,
  recordStartAt: 0,

  data: {
    session: {},
    courseId: '',
    courseName: '',
    studentId: '',
    studentName: '',

    sessions: [],
    activeSessionId: '',

    feedbackTypes: FEEDBACK_TYPES,
    feedbackType: 'post',
    existingFeedback: null,

    feedbackText: '',
    imageFiles: [],
    videoFiles: [],
    voiceFiles: [],
    recording: false,
    submitting: false
  },

  onLoad(options) {
    const { courseId, courseName, studentId, studentName, feedbackType } = options;
    this.setData({
      courseId: courseId || '',
      courseName: decodeURIComponent(courseName || ''),
      studentId: studentId || '',
      studentName: decodeURIComponent(studentName || ''),
      feedbackType: ['pre', 'post', 'general'].includes(feedbackType) ? feedbackType : 'post'
    });
    this.initRecorder();
    wx.setNavigationBarTitle({ title: `错题反馈 - ${this.data.studentName}` });
  },

  onShow() {
    const session = Guard.ensureLogin('teacher');
    if (!session) return;
    this.setData({ session });
    if (this.data.courseId) this.loadCourseData();
  },

  onUnload() {
    if (this.data.recording && this.recorderManager) {
      this.recorderManager.stop();
    }
  },

  initRecorder() {
    if (!wx.getRecorderManager) return;
    this.recorderManager = wx.getRecorderManager();
    this.recorderManager.onStart(() => {
      this.recordStartAt = Date.now();
      this.setData({ recording: true });
    });
    this.recorderManager.onStop((res) => {
      const duration = Math.max(1, Math.round((res.duration || (Date.now() - this.recordStartAt)) / 1000));
      const id = `voice_${Date.now()}`;
      this.setData({
        recording: false,
        voiceFiles: this.data.voiceFiles.concat([{
          id,
          name: `错题讲解_${Date.now()}.mp3`,
          tempPath: res.tempFilePath || '',
          size: res.fileSize || 0,
          duration,
          type: 'voice'
        }])
      });
    });
    this.recorderManager.onError(() => {
      this.setData({ recording: false });
      Notice.toast('录音失败');
    });
  },

  loadCourseData() {
    Api.getTeacherCourseDetail(this.data.courseId)
      .then((data) => {
        const sessions = data.sessions || [];
        const activeSessionId = this.data.activeSessionId || (sessions.length ? sessions[0].id : '');
        this.setData({ sessions, activeSessionId });
        if (activeSessionId) this.loadSessionFeedback(activeSessionId);
      })
      .catch((error) => Notice.alert(error.message || '课程数据加载失败'));
  },

  selectSession(event) {
    const sessionId = event.currentTarget.dataset.sessionId;
    this.setData({ activeSessionId: sessionId });
    this.loadSessionFeedback(sessionId);
  },

  selectFeedbackType(event) {
    const feedbackType = event.currentTarget.dataset.type;
    if (!feedbackType || feedbackType === this.data.feedbackType) return;
    this.setData({
      feedbackType,
      existingFeedback: null,
      feedbackText: '',
      imageFiles: [],
      videoFiles: [],
      voiceFiles: []
    });
    if (this.data.activeSessionId) this.loadSessionFeedback(this.data.activeSessionId);
  },

  loadSessionFeedback(sessionId) {
    Api.getTeacherLessonDetail(sessionId)
      .then((data) => {
        const feedbacks = (data.lessonFeedbacks || data.feedbacks || [])
          .filter((feedback) =>
            feedback.studentId === this.data.studentId
            && feedback.teacherId === this.data.session.teacherId
            && (feedback.feedbackType || 'post') === this.data.feedbackType
          );

        if (feedbacks.length) {
          const feedback = feedbacks[0];
          this.setData({
            existingFeedback: {
              ...feedback,
              imageFiles: feedback.imageFiles || [],
              videoFiles: feedback.videoFiles || [],
              voiceFiles: feedback.voiceFiles || []
            },
            feedbackText: feedback.text || ''
          });
        } else {
          this.setData({ existingFeedback: null, feedbackText: '' });
        }
      })
      .catch(() => {
        this.setData({ existingFeedback: null, feedbackText: '' });
      });
  },

  onTextInput(event) {
    this.setData({ feedbackText: event.detail.value });
  },

  chooseMedia() {
    wx.chooseMedia({
      count: 6,
      mediaType: ['image', 'video'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      maxDuration: 90,
      success: (res) => {
        const nextImages = [];
        const nextVideos = [];
        (res.tempFiles || []).forEach((file, index) => {
          const isVideo = file.fileType === 'video';
          const tempPath = file.tempFilePath || '';
          const ext = extFromPath(tempPath, isVideo ? 'mp4' : 'jpg');
          const base = {
            id: `${isVideo ? 'video' : 'img'}_${Date.now()}_${index}`,
            name: `${isVideo ? '错题讲解视频' : '错题图片'}_${Date.now()}.${ext}`,
            tempPath,
            size: file.size || 0,
            duration: Math.round(file.duration || 0),
            type: isVideo ? 'video' : 'image'
          };
          if (isVideo) nextVideos.push(base);
          else nextImages.push(base);
        });
        this.setData({
          imageFiles: this.data.imageFiles.concat(nextImages),
          videoFiles: this.data.videoFiles.concat(nextVideos)
        });
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('cancel')) return;
        Notice.toast('选择媒体失败');
      }
    });
  },

  startRecord() {
    if (!this.recorderManager) {
      Notice.alert('当前微信环境不支持录音。');
      return;
    }
    if (this.data.recording) return;
    try {
      this.recorderManager.start({
        duration: 10 * 60 * 1000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'mp3'
      });
    } catch (error) {
      this.setData({ recording: false });
      Notice.alert('录音启动失败');
    }
  },

  stopRecord() {
    if (!this.recorderManager || !this.data.recording) return;
    this.recorderManager.stop();
  },

  removeMedia(event) {
    const { id, type } = event.currentTarget.dataset;
    if (type === 'image') {
      this.setData({ imageFiles: this.data.imageFiles.filter((file) => file.id !== id) });
    } else if (type === 'video') {
      this.setData({ videoFiles: this.data.videoFiles.filter((file) => file.id !== id) });
    } else if (type === 'voice') {
      this.setData({ voiceFiles: this.data.voiceFiles.filter((file) => file.id !== id) });
    }
  },

  submitFeedback() {
    if (this.data.submitting) return;
    if (!this.data.feedbackText.trim()
      && !this.data.imageFiles.length
      && !this.data.videoFiles.length
      && !this.data.voiceFiles.length) {
      Notice.toast('请至少填写文字、图片、视频或语音');
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
    const videoUploads = this.data.videoFiles.map((file) =>
      Api.uploadFeedbackVideo({
        fileName: file.name,
        tempPath: file.tempPath,
        size: file.size,
        duration: file.duration
      })
    );
    const voiceUploads = this.data.voiceFiles.map((file) =>
      Api.uploadFeedbackVoice({
        fileName: file.name,
        tempPath: file.tempPath,
        size: file.size,
        duration: file.duration
      })
    );

    Promise.all(imageUploads.concat(videoUploads, voiceUploads))
      .then((results) => {
        const imageResults = results.slice(0, this.data.imageFiles.length);
        const videoResults = results.slice(this.data.imageFiles.length, this.data.imageFiles.length + this.data.videoFiles.length);
        const voiceResults = results.slice(this.data.imageFiles.length + this.data.videoFiles.length);
        return Api.createLessonFeedback({
          studentId: this.data.studentId,
          teacherId: this.data.session.teacherId,
          courseId: this.data.courseId,
          courseSessionId: this.data.activeSessionId,
          feedbackType: this.data.feedbackType,
          text: this.data.feedbackText.trim(),
          imageFileIds: imageResults.map((file) => file.id),
          videoFileIds: videoResults.map((file) => file.id),
          voiceFileIds: voiceResults.map((file) => file.id)
        });
      })
      .then(() => {
        Notice.toast('错题反馈已保存');
        this.setData({
          submitting: false,
          feedbackText: '',
          imageFiles: [],
          videoFiles: [],
          voiceFiles: []
        });
        this.loadSessionFeedback(this.data.activeSessionId);
      })
      .catch((error) => {
        this.setData({ submitting: false });
        Notice.alert(error.message || '反馈提交失败');
      });
  },

  formatSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
});
