const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    // 原始数据
    bootstrap: { students: [], courses: [], teachers: [], classrooms: [] },

    // ===== 导入学生表单 =====
    studentOptions: [],
    studentList: [],
    courseOptions: [],
    courseList: [],
    selectedStudentIndex: 0,
    selectedCourseIndex: 0,
    selectedStudentId: '',
    selectedCourseId: '',
    importingStudent: false,
    studentResult: null,
    selectedSourceCourseIndex: 0,
    selectedSourceCourseId: '',
    syncAction: 'enroll',
    syncingEnrollment: false,
    syncResult: null,

    // ===== 导入课程表单 =====
    teacherOptions: [],
    classroomOptions: [],
    courseForm: {
      name: '',
      subject: '',
      grade: '',
      teacherId: '',
      classroomId: '',
      description: ''
    },
    selectedTeacherIndex: 0,
    selectedClassroomIndex: 0,
    importingCourse: false,
    courseResult: null,

    // ===== 标签 =====
    activeTab: 'import-student',   // 'import-student' | 'import-course'
    recentCourses: []              // 最近创建的课程
  },

  onShow() {
    if (!Guard.ensureLogin('admin')) return;
    this.loadAll();
  },

  loadAll() {
    return Promise.all([
      Api.getBootstrap(),
      Api.getAdminCourseTree()
    ])
      .then(([bootstrap, courseTree]) => {
        // ---- 为学生导入准备数据 ----
        const studentList = (bootstrap.students || []).map((s) => ({
          ...s,
          displayLabel: s.name + ' · ' + s.grade + ' · ' + (s.phone || '无手机号')
        }));
        const studentOptions = studentList.map((s) => s.displayLabel);

        const courseList = (bootstrap.courses || []).map((c) => {
          const teacher = (bootstrap.teachers || []).find((t) => t.id === c.teacherId) || {};
          return {
            ...c,
            displayLabel: c.name + ' · ' + (teacher.name || '未知老师') + ' · ' + c.studentIds.length + '名学生'
          };
        });
        const courseOptions = courseList.map((c) => c.displayLabel);

        // ---- 为课程导入准备数据 ----
        const teacherOptions = (bootstrap.teachers || []).map((t) =>
          t.fullName + ' · ' + (t.subject || '')
        );
        const classroomOptions = (bootstrap.classrooms || []).map((r) =>
          r.name + ' · ' + r.campus + ' · ' + r.capacity + '人'
        );

        // 默认课程表单选中第一个老师/教室
        const defaultTeacherId = (bootstrap.teachers || [])[0] ? bootstrap.teachers[0].id : '';
        const defaultClassroomId = (bootstrap.classrooms || [])[0] ? bootstrap.classrooms[0].id : '';

        const selectedStudentId = studentList.length > 0 ? studentList[0].id : '';
        const selectedCourseId = courseList.length > 0 ? courseList[0].id : '';
        const selectedSourceCourseId = courseList.length > 0 ? courseList[0].id : '';

        this.setData({
          bootstrap,
          studentOptions,
          studentList,
          courseOptions,
          courseList,
          selectedStudentIndex: 0,
          selectedCourseIndex: 0,
          selectedSourceCourseIndex: 0,
          selectedStudentId,
          selectedCourseId,
          selectedSourceCourseId,
          teacherOptions,
          classroomOptions,
          selectedTeacherIndex: 0,
          selectedClassroomIndex: 0,
          'courseForm.teacherId': defaultTeacherId,
          'courseForm.classroomId': defaultClassroomId,
          recentCourses: (courseTree || []).slice(0, 5)
        });
      })
      .catch((error) => Notice.alert(error.message || '数据加载失败'));
  },

  // ============ 导入学生 ============

  pickStudent(event) {
    const index = Number(event.detail.value || 0);
    const student = this.data.studentList[index];
    if (!student) return;
    this.setData({
      selectedStudentIndex: index,
      selectedStudentId: student.id,
      studentResult: null,
      syncResult: null
    });
  },

  pickCourse(event) {
    const index = Number(event.detail.value || 0);
    const course = this.data.courseList[index];
    if (!course) return;
    this.setData({
      selectedCourseIndex: index,
      selectedCourseId: course.id,
      studentResult: null,
      syncResult: null
    });
  },

  doImportStudent() {
    const { selectedStudentId, selectedCourseId, studentList, courseList } = this.data;
    if (!selectedStudentId || !selectedCourseId) {
      Notice.toast('请先选择学生和课程');
      return;
    }

    const course = courseList.find((c) => c.id === selectedCourseId);
    if (course && course.studentIds && course.studentIds.includes(selectedStudentId)) {
      const student = studentList.find((s) => s.id === selectedStudentId);
      Notice.alert((student ? student.name : '该学生') + '已在课程「' + (course.name || '') + '」中，无需重复导入。');
      return;
    }

    this.setData({ importingStudent: true, studentResult: null });

    Api.syncEnrollmentChange({ action: 'enroll', studentId: selectedStudentId, toCourseId: selectedCourseId })
      .then(() => {
        const student = studentList.find((s) => s.id === selectedStudentId);
        const course = courseList.find((c) => c.id === selectedCourseId);
        Notice.toast('导入成功', 'success');
        this.setData({
          importingStudent: false,
          studentResult: { success: true, message: '成功将 ' + (student ? student.name : '学生') + ' 导入课程「' + (course ? course.name : '') + '」' }
        });
        this.loadAll();
      })
      .catch((error) => {
        Notice.toast(error.message || '导入失败');
        this.setData({
          importingStudent: false,
          studentResult: { success: false, message: error.message || '导入失败' }
        });
      });
  },

  pickSourceCourse(event) {
    const index = Number(event.detail.value || 0);
    const course = this.data.courseList[index];
    if (!course) return;
    this.setData({
      selectedSourceCourseIndex: index,
      selectedSourceCourseId: course.id,
      syncResult: null
    });
  },

  switchSyncAction(event) {
    const action = event.currentTarget.dataset.action || 'enroll';
    const updates = { syncAction: action, syncResult: null, studentResult: null };
    if (action === 'transfer' && this.data.selectedSourceCourseId === this.data.selectedCourseId && this.data.courseList.length > 1) {
      const nextIndex = this.data.selectedSourceCourseIndex === 0 ? 1 : 0;
      const nextCourse = this.data.courseList[nextIndex];
      updates.selectedCourseIndex = nextIndex;
      updates.selectedCourseId = nextCourse ? nextCourse.id : this.data.selectedCourseId;
    }
    this.setData(updates);
  },

  doSyncEnrollment() {
    const {
      syncAction,
      selectedStudentId,
      selectedCourseId,
      selectedSourceCourseId,
      studentList,
      courseList
    } = this.data;
    if (!selectedStudentId) {
      Notice.toast('请先选择学生');
      return;
    }
    if ((syncAction === 'transfer' || syncAction === 'withdraw') && !selectedSourceCourseId) {
      Notice.toast('请先选择原课程');
      return;
    }
    if ((syncAction === 'enroll' || syncAction === 'transfer') && !selectedCourseId) {
      Notice.toast('请先选择目标课程');
      return;
    }
    if (syncAction === 'transfer' && selectedSourceCourseId === selectedCourseId) {
      Notice.toast('调班前后课程不能相同');
      return;
    }

    const student = studentList.find((s) => s.id === selectedStudentId) || {};
    const sourceCourse = courseList.find((c) => c.id === selectedSourceCourseId) || {};
    const targetCourse = courseList.find((c) => c.id === selectedCourseId) || {};
    const labels = { enroll: '插班', transfer: '调班', withdraw: '退班' };

    this.setData({ syncingEnrollment: true, syncResult: null });
    Api.syncEnrollmentChange({
      action: syncAction,
      studentId: selectedStudentId,
      fromCourseId: selectedSourceCourseId,
      toCourseId: selectedCourseId
    })
      .then(() => {
        const message = syncAction === 'transfer'
          ? `${student.name || '学生'} 已从「${sourceCourse.name || ''}」调班到「${targetCourse.name || ''}」`
          : syncAction === 'withdraw'
            ? `${student.name || '学生'} 已从「${sourceCourse.name || ''}」退班`
            : `${student.name || '学生'} 已插班到「${targetCourse.name || ''}」`;
        Notice.toast(`${labels[syncAction]}成功`, 'success');
        return this.loadAll().then(() => {
          this.setData({
            syncingEnrollment: false,
            syncResult: { success: true, message }
          });
        });
      })
      .catch((error) => {
        Notice.toast(error.message || '同步失败');
        this.setData({
          syncingEnrollment: false,
          syncResult: { success: false, message: error.message || '同步失败' }
        });
      });
  },
  // ============ 导入课程（创建课程） ============

  onCourseFormInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ ['courseForm.' + field]: event.detail.value, courseResult: null });
  },

  pickCourseTeacher(event) {
    const index = Number(event.detail.value || 0);
    const teacher = this.data.bootstrap.teachers[index];
    if (!teacher) return;
    this.setData({
      selectedTeacherIndex: index,
      'courseForm.teacherId': teacher.id,
      courseResult: null
    });
  },

  pickCourseClassroom(event) {
    const index = Number(event.detail.value || 0);
    const classroom = this.data.bootstrap.classrooms[index];
    if (!classroom) return;
    this.setData({
      selectedClassroomIndex: index,
      'courseForm.classroomId': classroom.id,
      courseResult: null
    });
  },

  doCreateCourse() {
    const { courseForm, bootstrap } = this.data;

    // 验证必填字段
    if (!String(courseForm.name || '').trim()) {
      Notice.toast('请输入课程名称');
      return;
    }
    if (!String(courseForm.subject || '').trim()) {
      Notice.toast('请输入课程学科');
      return;
    }
    if (!String(courseForm.grade || '').trim()) {
      Notice.toast('请输入适用年级');
      return;
    }
    if (!courseForm.teacherId) {
      Notice.toast('请选择授课老师');
      return;
    }
    if (!courseForm.classroomId) {
      Notice.toast('请选择上课教室');
      return;
    }

    this.setData({ importingCourse: true, courseResult: null });

    const payload = {
      name: String(courseForm.name || '').trim(),
      subject: String(courseForm.subject || '').trim(),
      grade: String(courseForm.grade || '').trim(),
      teacherId: courseForm.teacherId,
      classroomId: courseForm.classroomId,
      description: String(courseForm.description || '').trim(),
      studentIds: []
    };

    Api.createCourse(payload)
      .then((createdCourse) => {
        const teacher = bootstrap.teachers.find((t) => t.id === payload.teacherId) || {};
        const classroom = bootstrap.classrooms.find((r) => r.id === payload.classroomId) || {};
        Notice.toast('课程创建成功', 'success');
        this.setData({
          importingCourse: false,
          courseResult: {
            success: true,
            message: '课程「' + payload.name + '」已创建 · ' + (teacher.fullName || teacher.name || '') + ' · ' + (classroom.name || '')
          },
          courseForm: {
            name: '',
            subject: '',
            grade: '',
            teacherId: bootstrap.teachers[0] ? bootstrap.teachers[0].id : '',
            classroomId: bootstrap.classrooms[0] ? bootstrap.classrooms[0].id : '',
            description: ''
          },
          selectedTeacherIndex: 0,
          selectedClassroomIndex: 0
        });
        this.loadAll();
      })
      .catch((error) => {
        Notice.toast(error.message || '创建失败');
        this.setData({
          importingCourse: false,
          courseResult: { success: false, message: error.message || '创建失败' }
        });
      });
  },

  // ============ 标签切换 ============
  switchTab(event) {
    const tab = event.currentTarget.dataset.tab;
    this.setData({ activeTab: tab, studentResult: null, courseResult: null });
  }
});
