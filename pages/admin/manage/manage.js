const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const PHONE_ROLE_OPTIONS = ['全部身份', '学生/家长', '老师', '管理员'];

function dayIndex(date) {
  const day = new Date(`${date}T00:00:00`).getDay();
  return day === 0 ? 6 : day - 1;
}

function matchesKeyword(item, keyword, fields) {
  const query = String(keyword || '').trim().toLowerCase();
  if (!query) return true;
  return fields.some((field) => String(item[field] || '').toLowerCase().includes(query));
}

function roleName(role) {
  if (role === 'teacher') return '老师';
  if (role === 'admin') return '管理员';
  return '学生/家长';
}

function buildWeekRows(courseTree) {
  const sessions = courseTree.flatMap((course) => (course.sessions || []).map((session) => ({
    id: session.id,
    date: session.date,
    day: dayIndex(session.date),
    time: `${session.startTime}-${session.endTime}`,
    courseName: course.name,
    lesson: session.sessionTitle || session.displayTitle,
    teacherName: course.teacherName,
    classroomName: session.classroomName || course.classroomName,
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
    bootstrap: {
      phoneAccounts: [],
      mediaFiles: [],
      lessonFeedbacks: []
    },
    relations: {
      courseTree: [],
      teachers: [],
      students: [],
      classrooms: []
    },
    overview: {
      liveRooms: []
    },
    weekDays: WEEK_DAYS,
    weekRows: [],
    activePanel: 'classrooms',
    filters: {
      teacherKeyword: '',
      studentKeyword: '',
      courseKeyword: '',
      phoneKeyword: ''
    },
    phoneRoleOptions: PHONE_ROLE_OPTIONS,
    phoneRoleIndex: 0,
    filteredTeachers: [],
    filteredStudents: [],
    filteredCourseTree: [],
    filteredPhoneAccounts: [],
    teacherOptions: [],
    studentOptions: [],
    courseOptions: [],
    phoneOptions: [],
    selectedTeacherId: '',
    selectedStudentId: '',
    selectedCourseId: '',
    selectedStudentCourseId: '',
    selectedTeacher: null,
    selectedStudent: null,
    selectedCourse: null,
    selectedStudentCourse: null
  },

  onShow() {
    if (!Guard.ensureLogin('admin')) return;
    this.load();
  },

  load() {
    Promise.all([
      Api.getBootstrap(),
      Api.getAdminCourseTree(),
      Api.getAdminTeacherRelations(),
      Api.getAdminStudentRelations(),
      Api.getAdminClassroomRelations(),
      Api.getAdminOverview()
    ])
      .then(([bootstrap, courseTree, teachers, students, classrooms, overview]) => {
        this.setData({
          bootstrap,
          relations: { courseTree, teachers, students, classrooms },
          overview,
          weekRows: buildWeekRows(courseTree),
          selectedTeacherId: teachers[0] ? teachers[0].id : '',
          selectedStudentId: students[0] ? students[0].id : '',
          selectedCourseId: courseTree[0] ? courseTree[0].id : '',
          selectedStudentCourseId: students[0] && students[0].courses[0] ? students[0].courses[0].id : ''
        }, () => {
          this.applyFilters();
        });
      })
      .catch((error) => Notice.alert(error.message || '数据加载失败'));
  },

  setPanel(event) {
    this.setData({ activePanel: event.currentTarget.dataset.panel });
  },

  onFilterInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`filters.${field}`]: event.detail.value }, () => {
      this.applyFilters();
    });
  },

  pickTeacher(event) {
    const index = Number(event.detail.value || 0);
    const teacher = this.data.filteredTeachers[index];
    if (!teacher) return;
    this.setData({ selectedTeacherId: teacher.id }, () => this.applyFilters());
  },

  pickStudent(event) {
    const index = Number(event.detail.value || 0);
    const student = this.data.filteredStudents[index];
    if (!student) return;
    this.setData({
      selectedStudentId: student.id,
      selectedStudentCourseId: student.courses[0] ? student.courses[0].id : ''
    }, () => this.applyFilters());
  },

  pickCourse(event) {
    const index = Number(event.detail.value || 0);
    const course = this.data.filteredCourseTree[index];
    if (!course) return;
    this.setData({ selectedCourseId: course.id }, () => this.applyFilters());
  },

  pickPhoneRole(event) {
    this.setData({ phoneRoleIndex: Number(event.detail.value || 0) }, () => {
      this.applyFilters();
    });
  },

  selectStudent(event) {
    const student = this.data.relations.students.find((item) => item.id === event.currentTarget.dataset.id);
    this.setData({
      selectedStudentId: event.currentTarget.dataset.id,
      selectedStudentCourseId: student && student.courses[0] ? student.courses[0].id : ''
    }, () => this.applyFilters());
  },

  selectCourse(event) {
    this.setData({ selectedCourseId: event.currentTarget.dataset.id }, () => this.applyFilters());
  },

  selectStudentCourse(event) {
    this.setData({ selectedStudentCourseId: event.currentTarget.dataset.id }, () => this.applyFilters());
  },

  applyFilters() {
    const { relations, bootstrap, filters, selectedTeacherId, selectedStudentId, selectedCourseId, selectedStudentCourseId, phoneRoleIndex } = this.data;
    const filteredTeachers = relations.teachers.filter((item) => matchesKeyword(item, filters.teacherKeyword, ['name', 'fullName', 'phone', 'subject']));
    const filteredStudents = relations.students.filter((item) => matchesKeyword(item, filters.studentKeyword, ['name', 'phone', 'loginPhone', 'grade']));
    const filteredCourseTree = relations.courseTree.filter((item) => matchesKeyword(item, filters.courseKeyword, ['name', 'subject', 'teacherName', 'classroomName']));
    const roleFilter = PHONE_ROLE_OPTIONS[phoneRoleIndex];
    const filteredPhoneAccounts = bootstrap.phoneAccounts
      .filter((item) => roleFilter === '全部身份' || roleName(item.role) === roleFilter)
      .filter((item) => matchesKeyword(item, filters.phoneKeyword, ['phone', 'nickname', 'role']));

    const selectedTeacher = filteredTeachers.find((item) => item.id === selectedTeacherId) || filteredTeachers[0] || null;
    const selectedStudent = filteredStudents.find((item) => item.id === selectedStudentId) || filteredStudents[0] || null;
    const selectedCourse = filteredCourseTree.find((item) => item.id === selectedCourseId) || filteredCourseTree[0] || null;
    const selectedStudentCourse = selectedStudent
      ? (selectedStudent.courses.find((item) => item.id === selectedStudentCourseId) || selectedStudent.courses[0] || null)
      : null;

    this.setData({
      filteredTeachers,
      filteredStudents,
      filteredCourseTree,
      filteredPhoneAccounts,
      teacherOptions: filteredTeachers.map((item) => `${item.name} · ${item.phone} · ${item.subject}`),
      studentOptions: filteredStudents.map((item) => `${item.name} · ${item.loginPhone}`),
      courseOptions: filteredCourseTree.map((item) => `${item.name} · ${item.teacherName}`),
      phoneOptions: filteredPhoneAccounts.map((item) => `${item.phone} · ${item.nickname}`),
      selectedTeacherId: selectedTeacher ? selectedTeacher.id : '',
      selectedStudentId: selectedStudent ? selectedStudent.id : '',
      selectedCourseId: selectedCourse ? selectedCourse.id : '',
      selectedStudentCourseId: selectedStudentCourse ? selectedStudentCourse.id : '',
      selectedTeacher,
      selectedStudent,
      selectedCourse,
      selectedStudentCourse
    });
  }
});
