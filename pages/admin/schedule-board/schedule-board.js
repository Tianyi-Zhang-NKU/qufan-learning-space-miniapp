const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    bootstrap: {
      courses: [],
      teachers: [],
      classrooms: [],
      courseSessions: []
    },
    courseOptions: [],
    teacherOptions: [],
    classroomOptions: [],
    courseIndex: 0,
    teacherIndex: 0,
    classroomIndex: 0,
    form: {
      courseId: 'course_bio_001',
      title: '新课次',
      teacherId: 'teacher_001',
      classroomId: 'room_01',
      date: '2026-06-07',
      startTime: '18:30',
      endTime: '20:00'
    },
    conflicts: []
  },

  onShow() {
    if (!Guard.ensureLogin('admin')) return;
    this.load();
  },

  load() {
    Api.getBootstrap().then((bootstrap) => {
      this.setData({
        bootstrap,
        courseOptions: bootstrap.courses.map((item) => item.name),
        teacherOptions: bootstrap.teachers.map((item) => item.name),
        classroomOptions: bootstrap.classrooms.map((item) => `${item.name} · ${item.capacity}人`)
      });
      this.syncDefaults();
    });
  },

  syncDefaults() {
    const { bootstrap, form } = this.data;
    this.setData({
      courseIndex: Math.max(0, bootstrap.courses.findIndex((item) => item.id === form.courseId)),
      teacherIndex: Math.max(0, bootstrap.teachers.findIndex((item) => item.id === form.teacherId)),
      classroomIndex: Math.max(0, bootstrap.classrooms.findIndex((item) => item.id === form.classroomId))
    });
  },

  input(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  pickCourse(event) {
    const index = Number(event.detail.value || 0);
    const course = this.data.bootstrap.courses[index];
    if (!course) return;
    const teacherIndex = Math.max(0, this.data.bootstrap.teachers.findIndex((item) => item.id === course.teacherId));
    const classroomIndex = Math.max(0, this.data.bootstrap.classrooms.findIndex((item) => item.id === course.classroomId));
    this.setData({
      courseIndex: index,
      teacherIndex,
      classroomIndex,
      'form.courseId': course.id,
      'form.teacherId': course.teacherId,
      'form.classroomId': course.classroomId
    });
  },

  pickTeacher(event) {
    const index = Number(event.detail.value || 0);
    const teacher = this.data.bootstrap.teachers[index];
    if (!teacher) return;
    this.setData({
      teacherIndex: index,
      'form.teacherId': teacher.id
    });
  },

  pickClassroom(event) {
    const index = Number(event.detail.value || 0);
    const classroom = this.data.bootstrap.classrooms[index];
    if (!classroom) return;
    this.setData({
      classroomIndex: index,
      'form.classroomId': classroom.id
    });
  },

  checkConflicts() {
    return Api.checkScheduleConflicts(this.data.form).then((result) => {
      this.setData({ conflicts: result.conflicts });
      if (result.hasConflict) {
        Notice.toast('发现排课冲突');
      } else {
        Notice.toast('未发现冲突', 'success');
      }
      return result;
    });
  },

  save() {
    this.checkConflicts().then((result) => {
      if (result.hasConflict) return;
      Api.createCourseSession(this.data.form)
        .then(() => {
          Notice.toast('课次已创建', 'success');
          this.load();
        })
        .catch((error) => Notice.alert(error.message || '创建失败'));
    });
  }
});
