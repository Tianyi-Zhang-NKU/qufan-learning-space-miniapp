const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

const COLLECTIONS = {
  courses: { title: '课程合集', subtitle: '按课程查看老师、学生、课次与反馈', icon: '课' },
  students: { title: '学生合集', subtitle: '按学生检索课程、手机号和反馈', icon: '生' },
  teachers: { title: '教师合集', subtitle: '按教师查看负责课程与学生', icon: '师' },
  classrooms: { title: '教室合集', subtitle: '按教室查看容量、校区和排课', icon: '室' }
};

const CAMERA_OPTIONS = [
  { value: 'pending', label: '待接入' },
  { value: 'testing', label: '联调中' },
  { value: 'ready', label: '可用' }
];

function lower(value) {
  return String(value || '').toLowerCase();
}

function includesQuery(searchText, query) {
  if (!query) return true;
  return lower(searchText).includes(lower(query));
}

function uniq(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function mergeCourseStudents(course) {
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
      studentMap[student.id].feedbackCount += student.feedbackCount || 0;
      studentMap[student.id].feedbacks = studentMap[student.id].feedbacks.concat(student.feedbacks || []);
    });
  });
  return Object.values(studentMap);
}

function buildCourses(courseTree) {
  return (courseTree || []).map((course) => {
    const mergedStudents = mergeCourseStudents(course);
    const sessions = (course.sessions || []).map((session) => ({
      ...session,
      sessionMeta: `${session.date || ''} ${session.startTime || ''}-${session.endTime || ''}`,
      studentCount: (session.students || []).length
    }));
    const searchText = [
      course.name,
      course.subject,
      course.grade,
      course.teacherName,
      course.classroomName,
      mergedStudents.map((student) => student.name).join(' ')
    ].join(' ');
    return {
      ...course,
      mergedStudents,
      sessions,
      studentTotal: mergedStudents.length,
      sessionTotal: sessions.length,
      feedbackTotal: mergedStudents.reduce((sum, student) => sum + (student.feedbackCount || 0), 0),
      courseMeta: `${course.subject || '-'} · ${course.grade || '-'} · ${mergedStudents.length}名学生 · ${sessions.length}次课`,
      searchText
    };
  });
}

function buildStudents(studentRelations) {
  return (studentRelations || []).map((student) => {
    const courses = student.courses || [];
    const searchText = [
      student.name,
      student.phone,
      student.loginPhone,
      student.grade,
      (student.courseNames || []).join(' '),
      courses.map((course) => course.teacherName).join(' ')
    ].join(' ');
    return {
      ...student,
      courseTotal: courses.length,
      feedbackTotal: student.feedbackCount || 0,
      courses,
      searchText
    };
  });
}

function buildTeachers(teacherRelations) {
  return (teacherRelations || []).map((teacher) => {
    const courses = teacher.courses || [];
    const studentNames = uniq(courses.flatMap((course) => (course.students || []).map((student) => student.name)));
    const searchText = [
      teacher.fullName,
      teacher.name,
      teacher.phone,
      teacher.subject,
      (teacher.courseNames || []).join(' '),
      studentNames.join(' ')
    ].join(' ');
    return {
      ...teacher,
      displayName: teacher.fullName || teacher.name,
      courseTotal: courses.length,
      studentTotal: studentNames.length,
      courses,
      searchText
    };
  });
}

function buildClassrooms(bootstrap) {
  const courses = bootstrap.courses || [];
  const teachers = bootstrap.teachers || [];
  const sessions = bootstrap.courseSessions || [];
  return (bootstrap.classrooms || []).map((room) => {
    const roomSessions = sessions
      .filter((session) => session.classroomId === room.id)
      .map((session) => {
        const course = courses.find((item) => item.id === session.courseId) || {};
        const teacher = teachers.find((item) => item.id === session.teacherId) || {};
        return {
          ...session,
          courseName: course.name || '',
          courseSubject: course.subject || '',
          teacherName: teacher.fullName || teacher.name || '',
          displayMeta: `${session.date || ''} ${session.startTime || ''}-${session.endTime || ''}`
        };
      })
      .sort((a, b) => `${a.date || ''}${a.startTime || ''}`.localeCompare(`${b.date || ''}${b.startTime || ''}`));
    const courseNames = uniq(roomSessions.map((session) => session.courseName));
    const teacherNames = uniq(roomSessions.map((session) => session.teacherName));
    const searchText = [
      room.name,
      room.campus,
      room.capacity,
      room.cameraStatus,
      courseNames.join(' '),
      teacherNames.join(' ')
    ].join(' ');
    return {
      ...room,
      sessions: roomSessions,
      courseNames,
      teacherNames,
      courseTotal: courseNames.length,
      sessionTotal: roomSessions.length,
      searchText
    };
  });
}

function getCollectionItems(data, type) {
  if (type === 'courses') return data.courses;
  if (type === 'students') return data.students;
  if (type === 'teachers') return data.teachers;
  return data.classrooms;
}

Page({
  data: {
    loading: true,
    viewMode: 'overview',
    activeType: '',
    activeTitle: '',
    activeSubtitle: '',
    searchQuery: '',
    expandedKey: '',

    collections: [],
    courses: [],
    students: [],
    teachers: [],
    classrooms: [],
    filteredCourses: [],
    filteredStudents: [],
    filteredTeachers: [],
    filteredClassrooms: [],

    teacherOptions: [],
    classroomOptions: [],
    cameraOptions: CAMERA_OPTIONS,
    showEditor: false,
    editorMode: 'create',
    editorTitle: '',
    editorForm: {}
  },

  onShow() {
    if (!Guard.ensureLogin('admin')) return;
    this.loadAll();
  },

  loadAll() {
    this.setData({ loading: true });
    Promise.all([
      Api.getBootstrap(),
      Api.getAdminCourseTree(),
      Api.getAdminStudentRelations(),
      Api.getAdminTeacherRelations()
    ])
      .then(([bootstrap, courseTree, studentRelations, teacherRelations]) => {
        const courses = buildCourses(courseTree);
        const students = buildStudents(studentRelations);
        const teachers = buildTeachers(teacherRelations);
        const classrooms = buildClassrooms(bootstrap);
        const collections = [
          { ...COLLECTIONS.courses, type: 'courses', count: courses.length },
          { ...COLLECTIONS.students, type: 'students', count: students.length },
          { ...COLLECTIONS.teachers, type: 'teachers', count: teachers.length },
          { ...COLLECTIONS.classrooms, type: 'classrooms', count: classrooms.length }
        ];
        this.setData({
          loading: false,
          collections,
          courses,
          students,
          teachers,
          classrooms,
          teacherOptions: teachers.map((teacher) => ({ id: teacher.id, name: teacher.displayName || teacher.fullName || teacher.name })),
          classroomOptions: classrooms.map((room) => ({ id: room.id, name: room.name })),
          filteredCourses: courses,
          filteredStudents: students,
          filteredTeachers: teachers,
          filteredClassrooms: classrooms
        });
        this.applySearch(this.data.searchQuery);
      })
      .catch((error) => {
        this.setData({ loading: false });
        Notice.alert(error.message || '数据加载失败');
      });
  },

  openCollection(event) {
    const type = event.currentTarget.dataset.type;
    const meta = COLLECTIONS[type];
    if (!meta) return;
    this.setData({
      viewMode: 'detail',
      activeType: type,
      activeTitle: meta.title,
      activeSubtitle: meta.subtitle,
      searchQuery: '',
      expandedKey: ''
    });
    this.applySearch('');
  },

  backOverview() {
    this.setData({
      viewMode: 'overview',
      activeType: '',
      activeTitle: '',
      activeSubtitle: '',
      searchQuery: '',
      expandedKey: ''
    });
    this.applySearch('');
  },

  onSearchInput(event) {
    const query = event.detail.value || '';
    this.setData({ searchQuery: query, expandedKey: '' });
    this.applySearch(query);
  },

  clearSearch() {
    this.setData({ searchQuery: '', expandedKey: '' });
    this.applySearch('');
  },

  applySearch(query) {
    this.setData({
      filteredCourses: this.data.courses.filter((item) => includesQuery(item.searchText, query)),
      filteredStudents: this.data.students.filter((item) => includesQuery(item.searchText, query)),
      filteredTeachers: this.data.teachers.filter((item) => includesQuery(item.searchText, query)),
      filteredClassrooms: this.data.classrooms.filter((item) => includesQuery(item.searchText, query))
    });
  },

  toggleDetail(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({
      expandedKey: this.data.expandedKey === key ? '' : key
    });
  },

  noop() {},

  openCreate() {
    const type = this.data.activeType;
    if (!type) return;
    this.setData({
      showEditor: true,
      editorMode: 'create',
      editorTitle: `新增${COLLECTIONS[type].title.replace('合集', '')}`,
      editorForm: this.buildEditorForm(type, null)
    });
  },

  openEdit(event) {
    const id = event.currentTarget.dataset.id;
    const type = this.data.activeType;
    const item = getCollectionItems(this.data, type).find((entry) => entry.id === id);
    if (!item) return;
    this.setData({
      showEditor: true,
      editorMode: 'edit',
      editorTitle: `编辑${COLLECTIONS[type].title.replace('合集', '')}`,
      editorForm: this.buildEditorForm(type, item)
    });
  },

  closeEditor() {
    this.setData({ showEditor: false, editorForm: {} });
  },

  buildEditorForm(type, item) {
    const teacherIndex = Math.max(0, this.data.teacherOptions.findIndex((option) => option.id === (item && item.teacherId)));
    const classroomIndex = Math.max(0, this.data.classroomOptions.findIndex((option) => option.id === (item && (item.classroomId || item.defaultClassroomId))));
    const cameraIndex = Math.max(0, CAMERA_OPTIONS.findIndex((option) => option.value === (item && item.cameraStatus)));
    if (type === 'courses') {
      return {
        id: item ? item.id : '',
        name: item ? item.name : '',
        subject: item ? item.subject : '',
        grade: item ? item.grade : '',
        teacherId: item ? item.teacherId : (this.data.teacherOptions[0] || {}).id || '',
        teacherName: item ? item.teacherFullName || item.teacherName : (this.data.teacherOptions[0] || {}).name || '',
        teacherIndex,
        classroomId: item ? item.classroomId || item.defaultClassroomId : (this.data.classroomOptions[0] || {}).id || '',
        classroomName: item ? item.classroomName : (this.data.classroomOptions[0] || {}).name || '',
        classroomIndex,
        description: item ? item.description : ''
      };
    }
    if (type === 'students') {
      return {
        id: item ? item.id : '',
        name: item ? item.name : '',
        grade: item ? item.grade : '',
        phone: item ? item.loginPhone || item.phone : ''
      };
    }
    if (type === 'teachers') {
      return {
        id: item ? item.id : '',
        fullName: item ? item.fullName || item.displayName || item.name : '',
        name: item ? item.name : '',
        subject: item ? item.subject : '',
        phone: item ? item.phone : '',
        title: item ? item.title : ''
      };
    }
    return {
      id: item ? item.id : '',
      name: item ? item.name : '',
      campus: item ? item.campus : '主校区',
      capacity: item ? item.capacity : 18,
      cameraStatus: item ? item.cameraStatus : 'pending',
      cameraStatusText: CAMERA_OPTIONS[cameraIndex].label,
      cameraIndex
    };
  },

  onEditorInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`editorForm.${field}`]: event.detail.value });
  },

  onTeacherChange(event) {
    const index = Number(event.detail.value || 0);
    const option = this.data.teacherOptions[index] || {};
    this.setData({
      'editorForm.teacherIndex': index,
      'editorForm.teacherId': option.id || '',
      'editorForm.teacherName': option.name || ''
    });
  },

  onClassroomChange(event) {
    const index = Number(event.detail.value || 0);
    const option = this.data.classroomOptions[index] || {};
    this.setData({
      'editorForm.classroomIndex': index,
      'editorForm.classroomId': option.id || '',
      'editorForm.classroomName': option.name || ''
    });
  },

  onCameraChange(event) {
    const index = Number(event.detail.value || 0);
    const option = CAMERA_OPTIONS[index] || CAMERA_OPTIONS[0];
    this.setData({
      'editorForm.cameraIndex': index,
      'editorForm.cameraStatus': option.value,
      'editorForm.cameraStatusText': option.label
    });
  },

  saveEditor() {
    const type = this.data.activeType;
    const form = this.data.editorForm;
    const isEdit = this.data.editorMode === 'edit';
    const methodMap = {
      courses: isEdit ? 'updateCourse' : 'createCourse',
      students: isEdit ? 'updateStudent' : 'createStudent',
      teachers: isEdit ? 'updateTeacher' : 'createTeacher',
      classrooms: isEdit ? 'updateClassroom' : 'createClassroom'
    };
    const method = methodMap[type];
    if (!method) return;
    const payload = { ...form };
    if (type === 'teachers' && !payload.name) payload.name = payload.fullName;
    Api[method](payload)
      .then(() => {
        Notice.toast(isEdit ? '修改成功' : '新增成功');
        this.setData({ showEditor: false, editorForm: {}, expandedKey: '' });
        this.loadAll();
      })
      .catch((error) => Notice.alert(error.message || '保存失败'));
  },

  deleteItem(event) {
    const id = event.currentTarget.dataset.id;
    const type = this.data.activeType;
    const item = getCollectionItems(this.data, type).find((entry) => entry.id === id);
    if (!item) return;
    const methodMap = {
      courses: 'deleteCourse',
      students: 'deleteStudent',
      teachers: 'deleteTeacher',
      classrooms: 'deleteClassroom'
    };
    const method = methodMap[type];
    wx.showModal({
      title: '确认删除',
      content: `确定删除“${item.name || item.displayName || item.fullName}”吗？`,
      confirmText: '删除',
      confirmColor: '#dc2626',
      success: (res) => {
        if (!res.confirm) return;
        Api[method](id)
          .then(() => {
            Notice.toast('删除成功');
            this.setData({ expandedKey: '' });
            this.loadAll();
          })
          .catch((error) => Notice.alert(error.message || '删除失败'));
      }
    });
  }
});
