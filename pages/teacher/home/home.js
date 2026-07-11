const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

const TODAY = '2026-06-06';

function lower(value) {
  return String(value || '').toLowerCase();
}

function includesQuery(searchText, query) {
  if (!query) return true;
  return lower(searchText).includes(lower(query));
}

function sessionMeta(session) {
  const date = session.date || '';
  const time = session.startTime && session.endTime ? `${session.startTime}-${session.endTime}` : '';
  return [date, time].filter(Boolean).join(' ');
}

function decorateCourse(course) {
  const sessions = (course.sessions || [])
    .map((session) => ({
      ...session,
      sessionMeta: sessionMeta(session),
      title: session.displayTitle || session.sessionTitle || ''
    }))
    .sort((a, b) => `${a.date || ''}${a.startTime || ''}`.localeCompare(`${b.date || ''}${b.startTime || ''}`));

  const students = (course.students || []).map((student) => ({
    ...student,
    searchText: [student.name, student.grade, student.phone].join(' ')
  }));

  const nextSession = sessions.find((session) => session.status === 'scheduled') || sessions[sessions.length - 1] || {};

  return {
    ...course,
    sessions,
    students,
    studentTotal: students.length,
    sessionTotal: sessions.length,
    nextSessionId: nextSession.id || '',
    nextSessionTime: nextSession.sessionMeta || '暂无排课',
    searchText: [
      course.name,
      course.subject,
      course.grade,
      course.classroomName,
      students.map((student) => student.name).join(' ')
    ].join(' ')
  };
}

Page({
  data: {
    session: {},
    teacherName: '',
    viewMode: 'overview',
    courses: [],
    todayCourses: [],
    filteredCourses: [],
    activeCourse: null,
    filteredStudents: [],
    teacherTodos: [],
    pendingPassCount: 0,
    courseSearchQuery: '',
    studentSearchQuery: '',
    expandedCourseKey: '',
    expandedStudentKey: ''
  },

  onShow() {
    const session = Guard.ensureLogin('teacher');
    if (!session) return;
    this.setData({ session });
    this.loadCourses();
  },

  loadCourses() {
    Promise.all([Api.getTeacherCourses(), Api.getTeacherTodos ? Api.getTeacherTodos() : Promise.resolve({ items: [], pendingPassCount: 0 })])
      .then(([result, todos]) => {
        const courses = (result.courseGroups || result.courses || []).map(decorateCourse);
        const teacher = result.teacher || {};
        const todayCourses = courses
          .flatMap((course) => (course.sessions || [])
            .filter((session) => session.date === TODAY)
            .map((session) => ({
              ...session,
              courseId: course.id,
              courseName: course.name,
              courseMeta: `${course.subject || '-'} · ${course.grade || '-'} · ${session.classroomName || course.classroomName || '待定教室'}`
            })))
          .sort((a, b) => `${a.startTime || ''}`.localeCompare(`${b.startTime || ''}`));
        this.setData({
          teacherName: teacher.name || teacher.fullName || this.data.session.displayName || '教师',
          courses,
          todayCourses,
          filteredCourses: courses,
          teacherTodos: todos.items || [],
          pendingPassCount: todos.pendingPassCount || 0
        });
        this.applyCourseSearch(this.data.courseSearchQuery);
      })
      .catch((error) => Notice.alert(error.message || '课程加载失败'));
  },

  openCourseCollection() {
    this.setData({
      viewMode: 'courses',
      courseSearchQuery: '',
      expandedCourseKey: ''
    });
    this.applyCourseSearch('');
  },

  backOverview() {
    this.setData({
      viewMode: 'overview',
      activeCourse: null,
      courseSearchQuery: '',
      studentSearchQuery: '',
      expandedCourseKey: '',
      expandedStudentKey: ''
    });
  },

  backCourses() {
    this.setData({
      viewMode: 'courses',
      activeCourse: null,
      studentSearchQuery: '',
      expandedStudentKey: ''
    });
  },

  onCourseSearchInput(event) {
    const query = event.detail.value || '';
    this.setData({ courseSearchQuery: query, expandedCourseKey: '' });
    this.applyCourseSearch(query);
  },

  clearCourseSearch() {
    this.setData({ courseSearchQuery: '', expandedCourseKey: '' });
    this.applyCourseSearch('');
  },

  applyCourseSearch(query) {
    this.setData({
      filteredCourses: this.data.courses.filter((course) => includesQuery(course.searchText, query))
    });
  },

  toggleCourse(event) {
    const id = event.currentTarget.dataset.id;
    const activeCourse = this.data.courses.find((course) => course.id === id) || null;
    const willCollapse = this.data.expandedCourseKey === id;
    this.setData({
      expandedCourseKey: willCollapse ? '' : id,
      activeCourse: willCollapse ? null : activeCourse,
      filteredStudents: willCollapse ? [] : (activeCourse && activeCourse.students) || [],
      studentSearchQuery: ''
    });
  },

  openStudentCollection(event) {
    const courseId = event.currentTarget.dataset.courseId;
    const activeCourse = this.data.courses.find((course) => course.id === courseId);
    if (!activeCourse) return;
    this.setData({
      viewMode: 'students',
      activeCourse,
      filteredStudents: activeCourse.students || [],
      studentSearchQuery: '',
      expandedStudentKey: ''
    });
  },

  onStudentSearchInput(event) {
    const query = event.detail.value || '';
    const students = (this.data.activeCourse && this.data.activeCourse.students) || [];
    this.setData({
      studentSearchQuery: query,
      expandedStudentKey: '',
      filteredStudents: students.filter((student) => includesQuery(student.searchText, query))
    });
  },

  clearStudentSearch() {
    const students = (this.data.activeCourse && this.data.activeCourse.students) || [];
    this.setData({
      studentSearchQuery: '',
      expandedStudentKey: '',
      filteredStudents: students
    });
  },

  toggleStudent(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({ expandedStudentKey: this.data.expandedStudentKey === id ? '' : id });
  },

  goFeedbackStudents(event) {
    const { courseId, courseName, feedbackType, sessionId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/teacher/feedback-students/feedback-students?courseId=${courseId}&courseName=${encodeURIComponent(courseName)}&feedbackType=${feedbackType}&courseSessionId=${sessionId || ''}`
    });
  },

  goFeedbackDetail(event) {
    const { courseId, courseName, studentId, studentName, feedbackType, sessionId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/teacher/feedback-detail/feedback-detail?courseId=${courseId}&courseName=${encodeURIComponent(courseName)}&studentId=${studentId}&studentName=${encodeURIComponent(studentName)}&feedbackType=${feedbackType || 'post'}&courseSessionId=${sessionId || ''}`
    });
  }
});
