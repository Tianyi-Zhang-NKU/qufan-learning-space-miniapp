const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function dayIndex(date) {
  const day = new Date(`${date}T00:00:00`).getDay();
  return day === 0 ? 6 : day - 1;
}

function buildWeekRows(courses) {
  const sessions = courses.flatMap((course) => (course.sessions || []).map((session) => ({
    id: session.id,
    date: session.date,
    day: dayIndex(session.date),
    startTime: session.startTime,
    endTime: session.endTime,
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
      sessions: sessions
        .filter((item) => item.time === slot && item.day === day)
        .sort((a, b) => a.date.localeCompare(b.date))
    }))
  }));
}

Page({
  data: {
    session: {},
    currentStudent: {},
    courseGroups: [],
    weekDays: WEEK_DAYS,
    weekRows: []
  },

  onShow() {
    const session = Guard.ensureLogin('parent');
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    Api.getStudentCourses()
      .then((result) => {
        const courseGroups = result.courseGroups || result.courses || [];
        this.setData({
          currentStudent: result.currentStudent || {},
          courseGroups,
          weekRows: buildWeekRows(courseGroups)
        });
      })
      .catch((error) => Notice.alert(error.message || '课程加载失败'));
  },

  goDetail(event) {
    wx.navigateTo({ url: `/pages/course-detail/course-detail?courseId=${event.currentTarget.dataset.id}` });
  },

  goSession(event) {
    wx.navigateTo({ url: `/pages/course-detail/course-detail?id=${event.currentTarget.dataset.id}` });
  },

  goLive(event) {
    wx.navigateTo({ url: `/pages/live-player/live-player?id=${event.currentTarget.dataset.id}` });
  }
});
