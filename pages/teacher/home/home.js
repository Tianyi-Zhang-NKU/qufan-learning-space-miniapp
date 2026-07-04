const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    session: {},
    teacherName: '',
    courses: []
  },

  onShow() {
    const session = Guard.ensureLogin('teacher');
    if (!session) return;
    this.setData({ session });
    this.loadCourses();
  },

  loadCourses() {
    Api.getTeacherCourses()
      .then((result) => {
        const courseGroups = result.courseGroups || result.courses || [];
        // 为每个课程补充上课时间信息
        const courses = courseGroups.map((course) => {
          const nextSession = this.findNextSession(course.sessions || []);
          return {
            ...course,
            nextSessionTime: nextSession
              ? `${nextSession.date} ${nextSession.startTime}-${nextSession.endTime}`
              : '暂无排课',
            nextSessionDate: nextSession ? nextSession.date : ''
          };
        });
        this.setData({
          teacherName: (result.teacher && (result.teacher.name || result.teacher.fullName))
            || session.displayName
            || '教师',
          courses
        });
      })
      .catch((error) => Notice.alert(error.message || '课程加载失败'));
  },

  /** 找到最近一次未开始的课次，如果没有则返回最近的课次 */
  findNextSession(sessions) {
    if (!sessions || !sessions.length) return null;
    const sorted = [...sessions].sort((a, b) => {
      const dateA = `${a.date} ${a.startTime}`;
      const dateB = `${b.date} ${b.startTime}`;
      return dateA.localeCompare(dateB);
    });
    // 优先返回最近一次 scheduled 的课次
    const upcoming = sorted.find((s) => s.status === 'scheduled');
    if (upcoming) return upcoming;
    // 否则返回最后一次课次
    return sorted[sorted.length - 1];
  },

  /** 跳转课前测错题反馈 */
  goPreTest(event) {
    const { courseId, courseName } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/teacher/feedback-students/feedback-students?courseId=${courseId}&courseName=${encodeURIComponent(courseName)}&feedbackType=pre`
    });
  },

  /** 跳转课后测错题反馈 */
  goPostTest(event) {
    const { courseId, courseName } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/teacher/feedback-students/feedback-students?courseId=${courseId}&courseName=${encodeURIComponent(courseName)}&feedbackType=post`
    });
  },

  /** 跳转课程错题反馈学生名单 */
  goFeedback(event) {
    const { courseId, courseName } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/teacher/feedback-students/feedback-students?courseId=${courseId}&courseName=${encodeURIComponent(courseName)}&feedbackType=general`
    });
  }
});
