const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function dayIndex(date) {
  const day = new Date(`${date}T00:00:00`).getDay();
  return day === 0 ? 6 : day - 1;
}

function buildWeekRows(courses) {
  const sessions = (courses || []).flatMap((course) => (course.sessions || []).map((session) => ({
    id: session.id,
    date: session.date,
    day: dayIndex(session.date),
    time: `${session.startTime}-${session.endTime}`,
    courseName: course.name,
    lesson: session.sessionTitle || session.displayTitle,
    classroom: session.classroomName || course.classroomName || '待定教室',
    feedbackCount: session.feedbackCount || 0
  })));
  const slots = Array.from(new Set(sessions.map((item) => item.time))).sort();
  return slots.map((slot) => ({
    time: slot,
    cells: WEEK_DAYS.map((dayName, day) => ({
      day: dayName,
      sessions: sessions.filter((item) => item.time === slot && item.day === day)
    }))
  }));
}

Page({
  data: {
    session: {},
    dashboard: {
      currentStudent: {},
      metrics: [],
      courses: [],
      todayCourses: [],
      recentFeedbacks: []
    },
    weekDays: WEEK_DAYS,
    weekRows: [],
    activePanel: 'feedback'
  },

  onShow() {
    const session = Guard.ensureLogin('parent');
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    Api.getStudentDashboard()
      .then((dashboard) => this.setData({
        dashboard,
        weekRows: buildWeekRows(dashboard.courses)
      }))
      .catch((error) => Notice.alert(error.message || '首页加载失败'));
  },

  goCourses() {
    wx.redirectTo({ url: '/pages/parent/courses/courses' });
  },

  goFeedbacks() {
    wx.redirectTo({ url: '/pages/parent/exercises/exercises' });
  },

  goSession(event) {
    wx.navigateTo({ url: `/pages/course-detail/course-detail?id=${event.currentTarget.dataset.id}` });
  },

  goLive(event) {
    wx.navigateTo({ url: `/pages/live-player/live-player?id=${event.currentTarget.dataset.id}` });
  },

  setPanel(event) {
    this.setData({ activePanel: event.currentTarget.dataset.panel });
  }
});
