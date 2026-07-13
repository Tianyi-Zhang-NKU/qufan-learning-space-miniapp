const Api = require('../../services/api');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

function roleName(role) {
  if (role === 'teacher') return '教师端';
  if (role === 'admin') return '管理端';
  return '学生/家长端';
}

function buildIdentity(session, profile) {
  const role = session.role;
  if (role === 'teacher') {
    const name = profile.name || profile.fullName || session.displayName || '教师';
    const subject = profile.subject || (profile.subjects || []).join('、') || profile.title || '授课教师';
    return {
      identityName: name,
      identitySub: subject,
      identityInitial: name.charAt(0) || '师',
      identityBadge: '教师'
    };
  }
  if (role === 'admin') {
    const name = session.displayName || profile.name || '管理员';
    return {
      identityName: name,
      identitySub: profile.roleTitle || '校区管理',
      identityInitial: name.charAt(0) || '管',
      identityBadge: '管理'
    };
  }
  const name = profile.name || session.displayName || '学生';
  return {
    identityName: name,
    identitySub: [profile.grade, '学生档案'].filter(Boolean).join(' · '),
    identityInitial: name.charAt(0) || '生',
    identityBadge: '学生'
  };
}

Page({
  data: {
    session: {},
    profile: {},
    roleName: '',
    identityName: '',
    identitySub: '',
    identityInitial: '',
    identityBadge: '',
    identities: [],
    switchingIdentityId: '',

    // 教师端专属
    teacherName: '',
    teacherSubject: '',
    teacherInitial: '师',
    teacherCourses: [],
    teacherStudents: [],
    totalPassConfirmations: 0
  },

  onShow() {
    const session = Guard.ensureLogin();
    if (!session) return;
    Promise.all([Api.getCurrentUserProfile(), Api.listIdentities()])
      .then(([result, identities]) => {
        const active = result.session || session;
        this.setData({
          session: active,
          profile: result.profile || {},
          roleName: roleName(active.role),
          ...buildIdentity(active, result.profile || {}),
          identities: identities || []
        });

        // 教师端加载额外数据
        if (active.role === 'teacher') {
          this.loadTeacherData(active);
        }
      })
      .catch((error) => Notice.alert(error.message || '个人信息加载失败'));
  },

  /** 加载教师端专属数据 */
  loadTeacherData(session) {
    Api.getTeacherCourses()
      .then((result) => {
        const teacher = result.teacher || {};
        const courses = result.courseGroups || result.courses || [];

        // 统计学生（去重）
        const studentMap = new Map();
        let totalPassConfirmations = 0;
        courses.forEach((course) => {
          totalPassConfirmations += course.classConfirmedPasses || 0;
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
          totalPassConfirmations
        });
      })
      .catch(() => {
        // 静默处理
      });
  },
  /** 点击课程 → 跳转教师课程表 */
  goTeacherCourses() {
    wx.navigateTo({ url: '/pages/teacher/courses/courses' });
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

  goExercises() {
    wx.navigateTo({ url: '/pages/parent/exercises/exercises' });
  },

  goMedals() {
    wx.navigateTo({ url: '/pages/parent/medals/medals' });
  },

  switchIdentity(event) {
    const identityId = event.currentTarget.dataset.id;
    if (!identityId || identityId === this.data.session.identityId || this.data.switchingIdentityId) return;
    this.setData({ switchingIdentityId: identityId });
    Api.switchIdentity(identityId)
      .then((session) => {
        getApp().setSession(session);
        wx.redirectTo({ url: Guard.roleHome(session.role) });
      })
      .catch((error) => {
        this.setData({ switchingIdentityId: '' });
        Notice.alert(error.message || '身份切换失败');
      });
  },

  logout() {
    Api.logout().then(() => {
      getApp().clearSession();
      Notice.toast('已退出');
      wx.redirectTo({ url: '/pages/login/login' });
    });
  }
});
