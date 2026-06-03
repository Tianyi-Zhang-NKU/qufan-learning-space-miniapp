const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    bootstrap: {
      courseSessions: []
    },
    form: {
      courseId: 'course_001',
      title: '新课次',
      classId: 'class_001',
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
    Api.getBootstrap().then((bootstrap) => this.setData({ bootstrap }));
  },

  input(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
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
