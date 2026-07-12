const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

function lower(value) {
  return String(value || '').trim().toLowerCase();
}

function includesQuery(searchText, query) {
  if (!query) return true;
  return lower(searchText).includes(lower(query));
}

Page({
  data: {
    session: {},
    courseId: '',
    courseName: '',
    courseSessionId: '',
    sessionLabel: '全部课次',
    feedbackType: 'post',
    feedbackTypeLabel: '本讲总结错题',
    courseInfo: {
      subject: '',
      grade: '',
      classroomName: '',
      teacherName: '',
      sessionCount: 0
    },
    students: [],
    filteredStudents: [],
    studentSearchQuery: '',
    totalFeedbackCount: 0
  },

  onLoad(options) {
    const { courseId, courseName, feedbackType, courseSessionId } = options;
    const type = feedbackType === 'pre' ? 'pre' : 'post';
    const typeLabel = type === 'pre' ? '课堂小测错题' : '本讲总结错题';
    this.setData({
      courseId: courseId || '',
      courseName: decodeURIComponent(courseName || ''),
      courseSessionId: courseSessionId || '',
      feedbackType: type,
      feedbackTypeLabel: typeLabel
    });
    wx.setNavigationBarTitle({ title: `${typeLabel} - ${this.data.courseName}` });
  },

  onShow() {
    const session = Guard.ensureLogin('teacher');
    if (!session) return;
    this.setData({ session });
    if (this.data.courseId) {
      this.loadCourseData();
    }
  },

  /** 加载课程数据（含学生名单） */
  loadCourseData() {
    Api.getTeacherCourseDetail(this.data.courseId)
      .then((data) => {
        const course = data.course || {};
        const sessions = data.sessions || [];
        const currentSession = sessions.find((item) => item.id === this.data.courseSessionId) || null;
        const courseInfo = {
          subject: course.subject || '',
          grade: course.grade || '',
          classroomName: course.classroomName || '',
          teacherName: course.teacherName || '',
          sessionCount: sessions.length
        };

        const feedbacks = (data.lessonFeedbacks || []).filter((feedback) => {
          if ((feedback.feedbackType || 'post') !== this.data.feedbackType) return false;
          if (this.data.courseSessionId && feedback.courseSessionId !== this.data.courseSessionId) return false;
          return true;
        });
        const totalFeedbackCount = feedbacks.length;

        const students = (data.students || []).map((student) => {
          const studentFeedbacks = feedbacks.filter((f) => f.studentId === student.id);
          return {
            ...student,
            feedbackCount: studentFeedbacks.length,
            searchText: [student.name, student.grade, student.phone].join(' ')
          };
        });
        const filteredStudents = this.filterStudents(students, this.data.studentSearchQuery);

        this.setData({
          courseInfo,
          sessionLabel: currentSession
            ? `${currentSession.displayTitle || currentSession.sessionTitle || ''} ${currentSession.topic || ''}`.trim()
            : '全部课次',
          students,
          filteredStudents,
          totalFeedbackCount
        });
      })
      .catch((error) => Notice.alert(error.message || '课程数据加载失败'));
  },

  filterStudents(students, query) {
    return (students || []).filter((student) => includesQuery(student.searchText, query));
  },

  onStudentSearchInput(event) {
    const query = event.detail.value || '';
    this.setData({
      studentSearchQuery: query,
      filteredStudents: this.filterStudents(this.data.students, query)
    });
  },

  clearStudentSearch() {
    this.setData({
      studentSearchQuery: '',
      filteredStudents: this.data.students
    });
  },

  /** 跳转到学生反馈详情页 */
  goFeedbackDetail(event) {
    const { studentId, studentName } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/teacher/feedback-detail/feedback-detail?courseId=${this.data.courseId}&courseName=${encodeURIComponent(this.data.courseName)}&studentId=${studentId}&studentName=${encodeURIComponent(studentName)}&feedbackType=${this.data.feedbackType}&courseSessionId=${this.data.courseSessionId || ''}`
    });
  }
});
