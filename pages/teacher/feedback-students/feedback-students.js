const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    session: {},
    courseId: '',
    courseName: '',
    feedbackType: 'post',
    feedbackTypeLabel: '课后测错题',
    courseInfo: {
      subject: '',
      grade: '',
      classroomName: '',
      teacherName: '',
      sessionCount: 0
    },
    students: [],
    totalFeedbackCount: 0
  },

  onLoad(options) {
    const { courseId, courseName, feedbackType } = options;
    const type = ['pre', 'post', 'general'].includes(feedbackType) ? feedbackType : 'post';
    const typeLabel = type === 'pre' ? '课前测错题' : type === 'post' ? '课后测错题' : '课程错题';
    this.setData({
      courseId: courseId || '',
      courseName: decodeURIComponent(courseName || ''),
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
        const courseInfo = {
          subject: course.subject || '',
          grade: course.grade || '',
          classroomName: course.classroomName || '',
          teacherName: course.teacherName || '',
          sessionCount: (data.sessions || []).length
        };

        // 计算每个学生的反馈数量
        const feedbacks = (data.lessonFeedbacks || []).filter(
          (feedback) => (feedback.feedbackType || 'post') === this.data.feedbackType
        );
        const totalFeedbackCount = feedbacks.length;

        const students = (data.students || []).map((student) => {
          const studentFeedbacks = feedbacks.filter(
            (f) => f.studentId === student.id
          );
          return {
            ...student,
            feedbackCount: studentFeedbacks.length
          };
        });

        this.setData({
          courseInfo,
          students,
          totalFeedbackCount
        });
      })
      .catch((error) => Notice.alert(error.message || '课程数据加载失败'));
  },

  /** 跳转到学生反馈详情页 */
  goFeedbackDetail(event) {
    const { studentId, studentName } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/teacher/feedback-detail/feedback-detail?courseId=${this.data.courseId}&courseName=${encodeURIComponent(this.data.courseName)}&studentId=${studentId}&studentName=${encodeURIComponent(studentName)}&feedbackType=${this.data.feedbackType}`
    });
  }
});
