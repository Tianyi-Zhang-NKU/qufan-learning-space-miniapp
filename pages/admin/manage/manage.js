const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

function optionLabels(items, labeler) {
  return items.map(labeler);
}

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
    relations: {
      overview: [],
      classrooms: [],
      teachers: [],
      students: [],
      parents: [],
      courseTree: []
    },
    classOptions: [],
    teacherOptions: [],
    classroomOptions: [],
    inviteTargetOptions: [],
    studentClassIndex: 0,
    courseTeacherIndex: 0,
    courseClassroomIndex: 0,
    inviteTargetIndex: 0,
    teacherForm: { name: '新老师', phone: '13800009901', subject: '数学' },
    studentForm: { name: '新学生', classId: 'class_001', grade: '初二', primaryGuardian: '家长', guardianPhone: '13800009902' },
    classroomForm: { name: '16号教室', capacity: 20 },
    courseForm: { name: '初二数学B班', subject: '数学', grade: '初二', teacherId: 'teacher_001', classroomId: 'room_01' },
    inviteForm: { role: 'parent', targetId: 'stu_001', targetName: '陈一诺' },
    latestInvite: null
  },

  onShow() {
    if (!Guard.ensureLogin('admin')) return;
    this.load();
  },

  load() {
    Promise.all([
      Api.getBootstrap(),
      Api.getAdminRelationsOverview(),
      Api.getAdminClassroomRelations(),
      Api.getAdminTeacherRelations(),
      Api.getAdminStudentGuardianRelations(),
      Api.getAdminParentRelations(),
      Api.getAdminCourseTree()
    ]).then(([bootstrap, overview, classrooms, teachers, students, parents, courseTree]) => {
      this.setData({
        bootstrap,
        relations: { overview, classrooms, teachers, students, parents, courseTree },
        classOptions: optionLabels(bootstrap.classes, (item) => item.name),
        teacherOptions: optionLabels(bootstrap.teachers, (item) => item.name),
        classroomOptions: optionLabels(bootstrap.classrooms, (item) => `${item.name} · ${item.capacity}人`),
        inviteTargetOptions: optionLabels(bootstrap.students, (item) => item.name)
      });
      this.syncPickerDefaults();
    });
  },

  syncPickerDefaults() {
    const { bootstrap, studentForm, courseForm, inviteForm } = this.data;
    const studentClassIndex = Math.max(0, bootstrap.classes.findIndex((item) => item.id === studentForm.classId));
    const courseTeacherIndex = Math.max(0, bootstrap.teachers.findIndex((item) => item.id === courseForm.teacherId));
    const courseClassroomIndex = Math.max(0, bootstrap.classrooms.findIndex((item) => item.id === courseForm.classroomId));
    let targets = bootstrap.students;
    if (inviteForm.role === 'teacher') targets = bootstrap.teachers;
    if (inviteForm.role === 'admin') targets = bootstrap.admins;
    const inviteTargetIndex = Math.max(0, targets.findIndex((item) => item.id === inviteForm.targetId));
    this.setData({ studentClassIndex, courseTeacherIndex, courseClassroomIndex, inviteTargetIndex });
  },

  input(event) {
    const group = event.currentTarget.dataset.group;
    const field = event.currentTarget.dataset.field;
    this.setData({ [`${group}.${field}`]: event.detail.value });
  },

  pickStudentClass(event) {
    const index = Number(event.detail.value || 0);
    const item = this.data.bootstrap.classes[index];
    if (!item) return;
    this.setData({
      studentClassIndex: index,
      'studentForm.classId': item.id,
      'studentForm.grade': item.grade
    });
  },

  pickCourseTeacher(event) {
    const index = Number(event.detail.value || 0);
    const item = this.data.bootstrap.teachers[index];
    if (!item) return;
    this.setData({
      courseTeacherIndex: index,
      'courseForm.teacherId': item.id
    });
  },

  pickCourseClassroom(event) {
    const index = Number(event.detail.value || 0);
    const item = this.data.bootstrap.classrooms[index];
    if (!item) return;
    this.setData({
      courseClassroomIndex: index,
      'courseForm.classroomId': item.id
    });
  },

  currentInviteTargets(role) {
    if (role === 'teacher') return this.data.bootstrap.teachers;
    if (role === 'admin') return this.data.bootstrap.admins;
    return this.data.bootstrap.students;
  },

  refreshInviteTargets(role) {
    const targets = this.currentInviteTargets(role);
    const target = targets[0] || {};
    this.setData({
      inviteTargetOptions: optionLabels(targets, (item) => item.name),
      inviteTargetIndex: 0,
      'inviteForm.targetId': target.id || '',
      'inviteForm.targetName': target.name || ''
    });
  },

  pickInviteTarget(event) {
    const index = Number(event.detail.value || 0);
    const target = this.currentInviteTargets(this.data.inviteForm.role)[index];
    if (!target) return;
    this.setData({
      inviteTargetIndex: index,
      'inviteForm.targetId': target.id,
      'inviteForm.targetName': target.name
    });
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
        Notice.toast('课程班已保存', 'success');
        this.load();
      })
      .catch((error) => Notice.alert(error.message || '保存失败'));
  },

  setInviteRole(event) {
    const role = event.currentTarget.dataset.role;
    this.setData({ 'inviteForm.role': role });
    this.refreshInviteTargets(role);
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
