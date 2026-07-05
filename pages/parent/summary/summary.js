const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    courseId: '',
    courseName: '',
    summaries: [],
    currentIndex: 0,
    currentSummary: null,
    honors: [],
    passHistory: [],
    loading: true
  },

  onLoad(options) {
    const session = Guard.ensureLogin('parent');
    if (!session) return;
    this.setData({ courseId: options.courseId || '' });
    this.load();
  },

  onShow() {
    if (this.data.courseId) this.load();
  },

  load() {
    const { courseId } = this.data;
    if (!courseId) {
      this.setData({ loading: false });
      return;
    }

    Promise.all([
      Api.getStudentCourseDetail(courseId),
      Api.getStudentHonors ? Api.getStudentHonors({ courseId }) : Promise.resolve({ certificates: [], passHistory: [] })
    ])
      .then(([detail, honors]) => {
        const course = detail.course || {};
        const sessions = (detail.sessions || []).sort(
          (a, b) => a.sessionIndex - b.sessionIndex
        );
        const feedbacks = detail.lessonFeedbacks || [];

        const summaries = sessions.map((s) => {
          const sessionFeedbacks = feedbacks.filter(
            (f) => f.courseSessionId === s.id && (f.feedbackType || 'post') === 'general'
          );

          return {
            sessionId: s.id,
            sessionIndex: s.sessionIndex,
            sessionTitle: s.sessionTitle || s.displayTitle || `第${s.sessionIndex}次课`,
            date: s.date || '',
            time: s.startTime && s.endTime ? `${s.startTime}-${s.endTime}` : '',
            status: s.status,
            statusText: s.status === 'finished' ? '已完成' : '未开始',
            summary: s.summary || '',
            feedbacks: sessionFeedbacks.map((f) => ({
              id: f.id,
              text: f.text || '',
              teacherName: f.teacherName || '',
              createdAt: f.createdAt || '',
              passed: !!f.passed,
              imageFiles: f.imageFiles || [],
              voiceFiles: f.voiceFiles || [],
              attachFiles: f.attachFiles || []
            }))
          };
        });

        const lastFeedbackIndex = summaries.reduce((latestIndex, item, index) => (
          item.feedbacks.length ? index : latestIndex
        ), -1);
        const defaultIndex = lastFeedbackIndex >= 0 ? lastFeedbackIndex : (summaries.length > 0 ? summaries.length - 1 : 0);

        this.setData({
          courseName: course.name || '',
          summaries,
          currentIndex: defaultIndex,
          currentSummary: summaries[defaultIndex] || null,
          honors: honors.certificates || [],
          passHistory: honors.passHistory || [],
          loading: false
        });
      })
      .catch((error) => {
        this.setData({ loading: false });
        Notice.alert(error.message || '加载失败');
      });
  },

  switchTab(event) {
    const index = event.currentTarget.dataset.index;
    this.setData({
      currentIndex: index,
      currentSummary: this.data.summaries[index]
    });
  },

  previewImage(event) {
    const current = event.currentTarget.dataset.current;
    const urls = (event.currentTarget.dataset.urls || []).map((f) => f.previewUrl).filter(Boolean);
    wx.previewImage({
      current,
      urls: urls.length ? urls : [current]
    });
  },

  playVoice(event) {
    const url = event.currentTarget.dataset.url;
    if (!url) return;
    const innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.src = url;
    innerAudioContext.play();
    innerAudioContext.onEnded(() => { innerAudioContext.destroy(); });
    innerAudioContext.onError(() => {
      innerAudioContext.destroy();
      Notice.alert('语音播放失败');
    });
  }
});
