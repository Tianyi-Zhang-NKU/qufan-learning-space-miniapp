const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

const GRADE_OPTIONS = [
  '小学一年级', '小学二年级', '小学三年级', '小学四年级', '小学五年级', '小学六年级',
  '初一', '初二', '初三',
  '高一', '高二', '高三',
  '其他'
];

const SUBJECT_OPTIONS = [
  '语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '道德与法治',
  '科学', '信息科技', '体育', '音乐', '美术', '心理', '综合实践',
  '小升初衔接', '中考冲刺', '高考冲刺', '其他'
];

const COLLECTIONS = {
  courses: { title: '课程合集', subtitle: '按课程查看老师、学生、课次与反馈', icon: '/assets/icons/course.svg' },
  students: { title: '学生合集', subtitle: '按学生检索课程、手机号和反馈', icon: '/assets/icons/student.svg' },
  teachers: { title: '教师合集', subtitle: '按教师查看负责课程与学生', icon: '/assets/icons/teacher.svg' },
  classrooms: { title: '教室合集', subtitle: '按教室查看容量、校区和排课', icon: '/assets/icons/classroom.svg' }
};

const CAMERA_OPTIONS = [
  { value: 'pending', label: '待配置' },
  { value: 'testing', label: '联调中' },
  { value: 'ready', label: '可用' }
];

const BASE_SESSION_DATE = '2026-06-06';
const DEFAULT_START_TIME = '18:30';
const DEFAULT_END_TIME = '20:00';

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

function addDaysLabel(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function clampSessionCount(value) {
  const count = Number(value || 0);
  if (!Number.isFinite(count) || count < 0) return 0;
  return Math.min(40, Math.floor(count));
}

function classroomIndexOf(options, classroomId) {
  return Math.max(0, (options || []).findIndex((option) => option.id === classroomId));
}

function buildSessionDraft(session, index, classroomOptions, fallbackClassroom) {
  const fallback = fallbackClassroom || classroomOptions[0] || {};
  const classroomId = session ? session.classroomId || fallback.id || '' : fallback.id || '';
  const classroomIndex = classroomIndexOf(classroomOptions, classroomId);
  const classroom = classroomOptions[classroomIndex] || fallback || {};
  const sessionIndex = session ? session.sessionIndex || index : index;
  return {
    id: session ? session.id : '',
    sessionIndex,
    sessionTitle: session ? session.sessionTitle || session.displayTitle || `第${sessionIndex}次课` : `第${sessionIndex}次课`,
    topic: session ? session.topic || '' : '',
    date: session ? session.date || '' : addDaysLabel(BASE_SESSION_DATE, (index - 1) * 7),
    startTime: session ? session.startTime || '' : DEFAULT_START_TIME,
    endTime: session ? session.endTime || '' : DEFAULT_END_TIME,
    classroomId: classroom.id || classroomId,
    classroomName: classroom.name || (session && session.classroomName) || '',
    classroomIndex
  };
}

function gradeRank(grade) {
  const value = String(grade || '');
  if (value.includes('初一')) return 1;
  if (value.includes('初二')) return 2;
  if (value.includes('初三')) return 3;
  if (value.includes('高一')) return 4;
  if (value.includes('高二')) return 5;
  if (value.includes('高三')) return 6;
  return 99;
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
  return (courseTree || []).map((course, index) => {
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
      createdOrder: index,
      mergedStudents,
      sessions,
      studentTotal: mergedStudents.length,
      sessionTotal: sessions.length,
      feedbackTotal: mergedStudents.reduce((sum, student) => sum + (student.feedbackCount || 0), 0),
      courseMeta: `${course.subject || '-'} · ${course.grade || '-'} · ${mergedStudents.length}名学生 · ${sessions.length}次课`,
      searchText
    };
  }).sort((a, b) => b.createdOrder - a.createdOrder);
}

function buildStudents(studentRelations) {
  return (studentRelations || []).map((student, index) => {
    const courses = student.courses || [];
    const subjectNames = uniq(courses.map((course) => course.subject).concat((student.courseNames || []).map((name) => {
      const matched = courses.find((course) => course.name === name);
      return matched ? matched.subject : '';
    })));
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
      createdOrder: index,
      subjectNames,
      courseTotal: courses.length,
      feedbackTotal: student.feedbackCount || 0,
      courses,
      searchText
    };
  }).sort((a, b) => {
    const gradeDiff = gradeRank(a.grade) - gradeRank(b.grade);
    if (gradeDiff) return gradeDiff;
    return b.createdOrder - a.createdOrder;
  });
}

function buildTeachers(teacherRelations) {
  return (teacherRelations || []).map((teacher, index) => {
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
      createdOrder: index,
      displayName: teacher.fullName || teacher.name,
      courseTotal: courses.length,
      studentTotal: studentNames.length,
      courses,
      searchText
    };
  }).sort((a, b) => {
    const timeDiff = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    return timeDiff || (b.createdOrder - a.createdOrder);
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
    const statusOption = CAMERA_OPTIONS.find((option) => option.value === room.cameraStatus) || CAMERA_OPTIONS[0];
    const searchText = [
      room.name,
      room.campus,
      room.capacity,
      room.cameraStatus,
      statusOption.label,
      courseNames.join(' '),
      teacherNames.join(' ')
    ].join(' ');
    return {
      ...room,
      sessions: roomSessions,
      courseNames,
      teacherNames,
      cameraStatusText: statusOption.label,
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
    activeGradeFilter: '',
    activeSubjectFilter: '',
    activeGradeLabel: '全部学年',
    activeSubjectLabel: '全部学科',
    gradeFilterOptions: [{ label: '全部学年', value: '' }].concat(GRADE_OPTIONS.map((value) => ({ label: value, value }))),
    subjectFilterOptions: [{ label: '全部学科', value: '' }].concat(SUBJECT_OPTIONS.map((value) => ({ label: value, value }))),
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
    gradeFilters: [],
    subjectFilters: [],
    courseGradeFilters: [],
    courseSubjectFilters: [],
    studentGradeFilters: [],
    studentSubjectFilters: [],
    teacherSubjectFilters: [],
    gradeOptions: GRADE_OPTIONS,
    subjectOptions: SUBJECT_OPTIONS,

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
          filteredClassrooms: classrooms,
          courseGradeFilters: GRADE_OPTIONS,
          courseSubjectFilters: SUBJECT_OPTIONS,
          studentGradeFilters: GRADE_OPTIONS,
          studentSubjectFilters: SUBJECT_OPTIONS,
          teacherSubjectFilters: SUBJECT_OPTIONS,
          gradeFilters: GRADE_OPTIONS,
          subjectFilters: SUBJECT_OPTIONS
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
      activeGradeFilter: '',
      activeSubjectFilter: '',
      activeGradeLabel: '全部学年',
      activeSubjectLabel: '全部学科',
      expandedKey: ''
    });
    this.refreshActiveFilters(type);
    this.applySearch('');
  },

  backOverview() {
    this.setData({
      viewMode: 'overview',
      activeType: '',
      activeTitle: '',
      activeSubtitle: '',
      searchQuery: '',
      activeGradeFilter: '',
      activeSubjectFilter: '',
      activeGradeLabel: '全部学年',
      activeSubjectLabel: '全部学科',
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
    const { activeGradeFilter, activeSubjectFilter } = this.data;
    this.setData({
      filteredCourses: this.data.courses.filter((item) =>
        includesQuery(item.searchText, query)
        && (!activeGradeFilter || item.grade === activeGradeFilter)
        && (!activeSubjectFilter || item.subject === activeSubjectFilter)
      ),
      filteredStudents: this.data.students.filter((item) =>
        includesQuery(item.searchText, query)
        && (!activeGradeFilter || item.grade === activeGradeFilter)
        && (!activeSubjectFilter || (item.subjectNames || []).includes(activeSubjectFilter))
      ),
      filteredTeachers: this.data.teachers.filter((item) =>
        includesQuery(item.searchText, query)
        && (!activeSubjectFilter || item.subject === activeSubjectFilter)
      ),
      filteredClassrooms: this.data.classrooms.filter((item) => includesQuery(item.searchText, query))
    });
  },

  refreshActiveFilters(type) {
    if (type === 'courses') {
      this.setData({
        gradeFilters: this.data.courseGradeFilters,
        subjectFilters: this.data.courseSubjectFilters
      });
      return;
    }
    if (type === 'students') {
      this.setData({
        gradeFilters: this.data.studentGradeFilters,
        subjectFilters: this.data.studentSubjectFilters
      });
      return;
    }
    if (type === 'teachers') {
      this.setData({
        gradeFilters: [],
        subjectFilters: this.data.teacherSubjectFilters
      });
      return;
    }
    this.setData({ gradeFilters: [], subjectFilters: [] });
  },

  onGradeFilterChange(event) {
    const option = this.data.gradeFilterOptions[Number(event.detail.value || 0)] || this.data.gradeFilterOptions[0];
    this.setData({
      activeGradeFilter: option.value,
      activeGradeLabel: option.label,
      expandedKey: ''
    });
    this.applySearch(this.data.searchQuery);
  },

  onSubjectFilterChange(event) {
    const option = this.data.subjectFilterOptions[Number(event.detail.value || 0)] || this.data.subjectFilterOptions[0];
    this.setData({
      activeSubjectFilter: option.value,
      activeSubjectLabel: option.label,
      expandedKey: ''
    });
    this.applySearch(this.data.searchQuery);
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
    const subjectIndex = Math.max(0, SUBJECT_OPTIONS.findIndex((value) => value === (item && item.subject)));
    const gradeIndex = Math.max(0, GRADE_OPTIONS.findIndex((value) => value === (item && item.grade)));
    if (type === 'courses') {
      const fallbackClassroom = item
        ? { id: item.classroomId || item.defaultClassroomId || '', name: item.classroomName || '' }
        : this.data.classroomOptions[classroomIndex] || {};
      const sessionDrafts = (item && item.sessions ? item.sessions : [])
        .sort((a, b) => (a.sessionIndex || 0) - (b.sessionIndex || 0))
        .map((session, index) => buildSessionDraft(session, index + 1, this.data.classroomOptions, fallbackClassroom));
      return {
        id: item ? item.id : '',
        name: item ? item.name : '',
        subject: item ? item.subject : SUBJECT_OPTIONS[0],
        subjectIndex,
        grade: item ? item.grade : GRADE_OPTIONS[6],
        gradeIndex: item ? gradeIndex : 6,
        teacherId: item ? item.teacherId : (this.data.teacherOptions[0] || {}).id || '',
        teacherName: item ? item.teacherFullName || item.teacherName : (this.data.teacherOptions[0] || {}).name || '',
        teacherIndex,
        classroomId: item ? item.classroomId || item.defaultClassroomId : (this.data.classroomOptions[0] || {}).id || '',
        classroomName: item ? item.classroomName : (this.data.classroomOptions[0] || {}).name || '',
        classroomIndex,
        description: item ? item.description : '',
        passThresholdPercent: item ? Number(item.passThresholdPercent || 80) : 80,
        sessionCount: sessionDrafts.length,
        sessionDrafts,
        removedSessionIds: []
      };
    }
    if (type === 'students') {
      return {
        id: item ? item.id : '',
        name: item ? item.name : '',
        grade: item ? item.grade : GRADE_OPTIONS[6],
        gradeIndex: item ? gradeIndex : 6,
        phone: item ? item.loginPhone || item.phone : ''
      };
    }
    if (type === 'teachers') {
      return {
        id: item ? item.id : '',
        fullName: item ? item.fullName || item.displayName || item.name : '',
        name: item ? item.name : '',
        subject: item ? item.subject : SUBJECT_OPTIONS[0],
        subjectIndex,
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

  onSessionCountInput(event) {
    const nextCount = clampSessionCount(event.detail.value);
    const form = this.data.editorForm || {};
    const currentDrafts = (form.sessionDrafts || []).slice();
    const removedSessionIds = (form.removedSessionIds || []).slice();
    const fallbackClassroom = {
      id: form.classroomId || (this.data.classroomOptions[0] || {}).id || '',
      name: form.classroomName || (this.data.classroomOptions[0] || {}).name || ''
    };
    let sessionDrafts = currentDrafts.slice(0, nextCount);
    if (currentDrafts.length > nextCount) {
      currentDrafts.slice(nextCount).forEach((draft) => {
        if (draft.id && !removedSessionIds.includes(draft.id)) removedSessionIds.push(draft.id);
      });
    }
    while (sessionDrafts.length < nextCount) {
      sessionDrafts.push(buildSessionDraft(null, sessionDrafts.length + 1, this.data.classroomOptions, fallbackClassroom));
    }
    sessionDrafts = sessionDrafts.map((draft, index) => ({
      ...draft,
      sessionIndex: index + 1,
      sessionTitle: draft.sessionTitle || `第${index + 1}次课`
    }));
    this.setData({
      'editorForm.sessionCount': nextCount,
      'editorForm.sessionDrafts': sessionDrafts,
      'editorForm.removedSessionIds': removedSessionIds
    });
  },

  onSessionDraftInput(event) {
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    if (!field || !Number.isFinite(index)) return;
    this.setData({ [`editorForm.sessionDrafts.${index}.${field}`]: event.detail.value });
  },

  onSessionClassroomChange(event) {
    const index = Number(event.currentTarget.dataset.index);
    const classroomIndex = Number(event.detail.value || 0);
    const option = this.data.classroomOptions[classroomIndex] || {};
    if (!Number.isFinite(index)) return;
    this.setData({
      [`editorForm.sessionDrafts.${index}.classroomIndex`]: classroomIndex,
      [`editorForm.sessionDrafts.${index}.classroomId`]: option.id || '',
      [`editorForm.sessionDrafts.${index}.classroomName`]: option.name || ''
    });
  },

  onEditorSubjectChange(event) {
    const index = Number(event.detail.value || 0);
    const value = SUBJECT_OPTIONS[index] || SUBJECT_OPTIONS[0];
    this.setData({
      'editorForm.subjectIndex': index,
      'editorForm.subject': value
    });
  },

  onEditorGradeChange(event) {
    const index = Number(event.detail.value || 0);
    const value = GRADE_OPTIONS[index] || GRADE_OPTIONS[0];
    this.setData({
      'editorForm.gradeIndex': index,
      'editorForm.grade': value
    });
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
    if (type === 'courses') {
      this.saveCourseEditor(form, isEdit);
      return;
    }
    const methodMap = {
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

  saveCourseEditor(form, isEdit) {
    const method = isEdit ? 'updateCourse' : 'createCourse';
    const payload = {
      id: form.id,
      name: form.name,
      subject: form.subject,
      grade: form.grade,
      teacherId: form.teacherId,
      classroomId: form.classroomId,
      description: form.description,
      passThresholdPercent: Number(form.passThresholdPercent || 80),
      studentIds: form.studentIds
    };
    Api[method](payload)
      .then((course) => this.syncCourseSessionsForEditor(course.id || form.id, form))
      .then(() => {
        Notice.toast(isEdit ? '修改成功' : '新增成功');
        this.setData({ showEditor: false, editorForm: {}, expandedKey: '' });
        this.loadAll();
      })
      .catch((error) => Notice.alert(error.message || '保存失败'));
  },

  syncCourseSessionsForEditor(courseId, form) {
    const sessionCount = clampSessionCount(form.sessionCount);
    const drafts = (form.sessionDrafts || []).slice(0, sessionCount);
    const removedSessionIds = form.removedSessionIds || [];
    const tasks = drafts.map((draft, index) => () => {
      const payload = {
        id: draft.id,
        courseId,
        sessionTitle: draft.sessionTitle || `第${index + 1}次课`,
        topic: draft.topic || '',
        date: draft.date || '',
        startTime: draft.startTime || '',
        endTime: draft.endTime || '',
        classroomId: draft.classroomId || form.classroomId || ''
      };
      if (draft.id) return Api.updateCourseSession(payload);
      if (!payload.date || !payload.startTime || !payload.endTime || !payload.classroomId) return Promise.resolve(null);
      return Api.createCourseSession(payload);
    });
    removedSessionIds.forEach((id) => {
      tasks.push(() => Api.deleteCourseSession(id));
    });
    return tasks.reduce((promise, task) => promise.then(task), Promise.resolve());
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
