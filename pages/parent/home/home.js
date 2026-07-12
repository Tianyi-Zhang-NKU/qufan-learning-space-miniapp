const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    session: {},
    studentName: '',
    courses: [],
    honors: [],
    loading: true
  },

  onShow() {
    const session = Guard.ensureLogin('parent');
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    this.setData({ loading: true });
    Promise.all([
      Api.getStudentDashboard(),
      Api.getStudentHonors ? Api.getStudentHonors({}) : Promise.resolve({ certificates: [] })
    ])
      .then(([dashboard, honors]) => {
        const courses = (dashboard.courses || []).map((course) =>
          this.buildCourseCard(course)
        );
        this.setData({
          studentName: (dashboard.currentStudent || {}).name || (dashboard.currentChild || {}).name || '',
          courses,
          honors: honors.certificates || [],
          loading: false
        });
      })
      .catch((error) => {
        this.setData({ loading: false });
        Notice.alert(error.message || '首页加载失败');
      });
  },

  buildCourseCard(course) {
    const sessions = (course.sessions || []).sort(
      (a, b) => a.sessionIndex - b.sessionIndex
    );
    const nextSession = sessions.find((session) => session.status === 'scheduled') || null;
    const latestSession = sessions[sessions.length - 1] || {};
    const sessionForClassroom = nextSession || latestSession;
    const teacherName = course.teacherName || '';

    const sessionTests = sessions.map((s) => {
      return {
        sessionId: s.id,
        sessionTitle: s.sessionTitle || s.displayTitle || `第${s.sessionIndex}次课`,
        sessionIndex: s.sessionIndex,
        date: s.date,
        time: s.startTime ? `${s.startTime}-${s.endTime}` : '',
        preCount: s.preFeedbackCount || 0,
        postCount: s.postFeedbackCount || 0
      };
    });

    const totalPreCount = sessionTests.reduce((sum, s) => sum + s.preCount, 0);
    const totalPostCount = sessionTests.reduce((sum, s) => sum + s.postCount, 0);

    return {
      id: course.id,
      name: course.name,
      subject: course.subject || '',
      grade: course.grade || '',
      teacherName,
      nextSessionId: nextSession ? nextSession.id : '',
      nextSessionTitle: nextSession
        ? (nextSession.sessionTitle || nextSession.displayTitle || `第${nextSession.sessionIndex}次课`)
        : '暂未安排下一次课程',
      nextSessionTime: nextSession && nextSession.startTime
        ? `${nextSession.date || ''} ${nextSession.startTime}-${nextSession.endTime || ''}`
        : '',
      nextSessionClassroom: sessionForClassroom.classroomName || course.classroomName || '待定教室',
      sessionCount: sessions.length,
      totalPreCount,
      totalPostCount,
      passedCount: course.passedCount || 0
    };
  },

  goQuiz(event) {
    const courseId = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/parent/quiz/quiz?courseId=${courseId}`
    });
  },

  goSummary(event) {
    const courseId = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/parent/summary/summary?courseId=${courseId}`
    });
  },

  goLive(event) {
    const sessionId = event.currentTarget.dataset.sessionId;
    if (!sessionId) {
      Notice.toast('暂无直播课次');
      return;
    }
    wx.navigateTo({ url: `/pages/live-player/live-player?id=${sessionId}` });
  }
});
