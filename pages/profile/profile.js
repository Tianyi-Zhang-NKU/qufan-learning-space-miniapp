const Api = require('../../services/api');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

function roleName(role) {
  if (role === 'teacher') return '教师端';
  if (role === 'admin') return '管理端';
  return '学生/家长端';
}

Page({
  data: {
    session: {},
    profile: {},
    roleName: '',

    // 教师端专属
    teacherName: '',
    teacherSubject: '',
    teacherInitial: '师',
    teacherCourses: [],
    teacherStudents: [],
    totalFeedbacks: 0
  },

  onShow() {
    const session = Guard.ensureLogin();
    if (!session) return;
    Api.getCurrentUserProfile()
      .then((result) => {
        const active = result.session || session;
        this.setData({
          session: active,
          profile: result.profile || {},
          roleName: roleName(active.role)
        });

        // 教师端加载额外数据
        if (active.role === 'teacher') {
          this.loadTeacherData(active);
        }
      })
      .catch((error) => Notice.alert(error.message || '个人信息加载失败'));
  },

  /** 加载教师端专属数据：课程合集、学生合集 */
  loadTeacherData(session) {
    Api.getTeacherCourses()
      .then((result) => {
        const teacher = result.teacher || {};
        const courses = result.courseGroups || result.courses || [];

        // 统计学生（去重）
        const studentMap = new Map();
        let totalFeedbacks = 0;
        courses.forEach((course) => {
          totalFeedbacks += course.feedbackCount || 0;
          (course.students || []).forEach((student) => {
            if (!studentMap.has(student.id)) {
              studentMap.set(student.id, {
                id: student.id,
                name: student.name,
                grade: student.grade || '',
                courseCount: 1,
                feedbackCount: course.feedbackCount || 0
              });
            } else {
              const existing = studentMap.get(student.id);
              existing.courseCount += 1;
              existing.feedbackCount += course.feedbackCount || 0;
            }
          });
        });

        const teacherStudents = Array.from(studentMap.values());

        this.setData({
          teacherName: teacher.name || teacher.fullName || session.displayName || '教师',
          teacherSubject: teacher.subject || (teacher.subjects || []).join('、') || '',
          teacherInitial: (teacher.name || session.displayName || '师').charAt(0),
          teacherCourses: courses,
          teacherStudents,
          totalFeedbacks
        });
      })
      .catch(() => {
        // 静默处理
      });
  },

  goWrongBook() {
    wx.navigateTo({ url: '/pages/parent/exercises/exercises?all=1' });
  },

  /** 点击课程 → 跳转课程详情 */
  goCourseDetail(event) {
    const courseId = event.currentTarget.dataset.courseId;
    wx.navigateTo({ url: `/pages/course-detail/course-detail?id=${courseId}` });
  },

  /** 点击学生 → 跳转该学生在第一个课程中的反馈 */
  goStudentFeedback(event) {
    const { studentId, studentName } = event.currentTarget.dataset;
    // 找该学生所属的第一门课程
    const course = this.data.teacherCourses.find(
      (c) => (c.students || []).some((s) => s.id === studentId)
    );
    if (course) {
      wx.navigateTo({
        url: `/pages/teacher/feedback-detail/feedback-detail?courseId=${course.id}&courseName=${encodeURIComponent(course.name)}&studentId=${studentId}&studentName=${encodeURIComponent(studentName)}`
      });
    } else {
      Notice.toast('暂无该学生的课程数据');
    }
  },

  logout() {
    Api.logout().then(() => {
      getApp().clearSession();
      Notice.toast('已退出');
      wx.redirectTo({ url: '/pages/login/login' });
    });
  }
});
