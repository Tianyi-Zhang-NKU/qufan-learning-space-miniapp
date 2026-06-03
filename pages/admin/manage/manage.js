const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    bootstrap: {
      students: [],
      teachers: [],
      classes: [],
      classrooms: [],
      courses: [],
      inviteCodes: []
    },
    teacherForm: { name: '新老师', phone: '13800009901', subject: '数学' },
    studentForm: { name: '新学生', classId: 'class_001', grade: '初二', primaryGuardian: '家长', guardianPhone: '13800009902' },
    classroomForm: { name: '16号教室', capacity: 20 },
    courseForm: { name: '几何专题', subject: '数学', grade: '初二' },
    inviteForm: { role: 'parent', targetId: 'stu_001', targetName: '陈一诺' },
    latestInvite: null
  },

  onShow() {
    if (!Guard.ensureLogin('admin')) return;
    this.load();
  },

  load() {
    Api.getBootstrap().then((bootstrap) => this.setData({ bootstrap }));
  },

  input(event) {
    const group = event.currentTarget.dataset.group;
    const field = event.currentTarget.dataset.field;
    this.setData({ [`${group}.${field}`]: event.detail.value });
  },

  createTeacher() {
    Api.createTeacher(this.data.teacherForm)
      .then(() => {
        Notice.toast('教师已保存', 'success');
        this.load();
      })
      .catch((error) => Notice.alert(error.message || '保存失败'));
  },

  createStudent() {
    Api.createStudent(this.data.studentForm)
      .then((student) => {
        Notice.toast('学生已保存', 'success');
        this.setData({ 'inviteForm.targetId': student.id, 'inviteForm.targetName': student.name });
        this.load();
      })
      .catch((error) => Notice.alert(error.message || '保存失败'));
  },

  createClassroom() {
    Api.createClassroom(this.data.classroomForm)
      .then(() => {
        Notice.toast('教室已保存', 'success');
        this.load();
      })
      .catch((error) => Notice.alert(error.message || '保存失败'));
  },

  createCourse() {
    Api.createCourse(this.data.courseForm)
      .then(() => {
        Notice.toast('课程已保存', 'success');
        this.load();
      })
      .catch((error) => Notice.alert(error.message || '保存失败'));
  },

  setInviteRole(event) {
    const role = event.currentTarget.dataset.role;
    this.setData({ 'inviteForm.role': role });
  },

  createInvite() {
    Api.createInvite(this.data.inviteForm)
      .then((invite) => {
        this.setData({ latestInvite: invite });
        Notice.toast('邀请码已生成', 'success');
        this.load();
      })
      .catch((error) => Notice.alert(error.message || '生成失败'));
  }
});
