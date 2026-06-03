const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

function buildTimetableRows(courses) {
  return courses
    .flatMap((course) => (course.sessions || []).map((session) => ({
      id: session.id,
      time: `${session.date}\n${session.startTime}-${session.endTime}`,
      courseName: course.name,
      lesson: session.sessionTitle,
      classroom: session.classroomName || course.classroomName || '待定教室',
      statusText: session.statusText || '未开始'
    })))
    .sort((a, b) => `${a.time}${a.courseName}`.localeCompare(`${b.time}${b.courseName}`));
}

Page({
  data: {
    session: {},
    teacher: {},
    courseGroups: [],
    timetableRows: []
  },

  onShow() {
    const session = Guard.ensureLogin('teacher');
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    Api.getTeacherCourses()
      .then((result) => {
        const courseGroups = result.courseGroups || result.courses || [];
        this.setData({
          teacher: result.teacher || {},
          courseGroups,
          timetableRows: buildTimetableRows(courseGroups)
        });
      })
      .catch((error) => Notice.alert(error.message || '课程加载失败'));
  },

  goCourse(event) {
    wx.navigateTo({ url: `/pages/course-detail/course-detail?courseId=${event.currentTarget.dataset.id}` });
  },

  goSession(event) {
    wx.navigateTo({ url: `/pages/course-detail/course-detail?id=${event.currentTarget.dataset.id}` });
  }
});
