const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    courses: [],
    expandedCourseId: '',
    expandedStudents: {}  // key: "courseId_studentId" -> true
  },

  onShow() {
    if (!Guard.ensureLogin('admin')) return;
    this.loadCourses();
  },

  loadCourses() {
    Api.getAdminCourseTree()
      .then((courseTree) => {
        const courses = (courseTree || []).map((course) => {
          // 从所有课次中合并学生（含反馈数据），按 studentId 去重
          const studentMap = {};
          (course.sessions || []).forEach((session) => {
            (session.students || []).forEach((student) => {
              if (!studentMap[student.id]) {
                studentMap[student.id] = {
                  ...student,
                  feedbackCount: 0,
                  feedbacks: []
                };
              }
              // 累加反馈数据
              studentMap[student.id].feedbackCount += (student.feedbackCount || 0);
              studentMap[student.id].feedbacks = (studentMap[student.id].feedbacks || []).concat(student.feedbacks || []);
            });
          });
          const mergedStudents = Object.values(studentMap);

          return {
            ...course,
            _expanded: false,
            mergedStudents,  // 带反馈数据的学生列表
            courseMeta: course.subject + ' · ' + course.grade + ' · ' + mergedStudents.length + '名学生 · ' + (course.sessions || []).length + '次课',
            sessions: (course.sessions || []).map((s) => ({
              ...s,
              sessionMeta: s.date + ' ' + (s.startTime || '') + '-' + (s.endTime || ''),
              studentCount: (s.students || []).length
            }))
          };
        });
        this.setData({ courses, expandedCourseId: '', expandedStudents: {} });
      })
      .catch((error) => Notice.alert(error.message || '课程加载失败'));
  },

  // 切换课程卡片的展开/折叠
  toggleCourse(event) {
    const courseId = event.currentTarget.dataset.courseId;
    const { expandedCourseId } = this.data;
    const newExpandedId = expandedCourseId === courseId ? '' : courseId;
    this.setData({ expandedCourseId: newExpandedId });
  },

  // 切换学生详情（在已展开的课程卡片内）
  toggleStudentDetail(event) {
    const { courseId, studentId } = event.currentTarget.dataset;
    const key = courseId + '_' + studentId;
    const expandedStudents = { ...this.data.expandedStudents };
    if (expandedStudents[key]) {
      delete expandedStudents[key];
    } else {
      expandedStudents[key] = true;
    }
    this.setData({ expandedStudents });
  }
});
