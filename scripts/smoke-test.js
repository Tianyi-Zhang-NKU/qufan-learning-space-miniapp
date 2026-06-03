const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectReject(promise, code) {
  try {
    await promise;
  } catch (error) {
    if (code) assert(error.code === code, `expected ${code}, got ${error.code || error.message}`);
    return error;
  }
  throw new Error(`expected rejection ${code || ''}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

function assertPageFiles(appJson) {
  const requiredPages = [
    'pages/identity-switch/identity-switch',
    'pages/profile/profile',
    'pages/course-detail/course-detail',
    'pages/live-player/live-player',
    'pages/file-preview/file-preview',
    'pages/wrong-record-editor/wrong-record-editor',
    'pages/parent/home/home',
    'pages/parent/courses/courses',
    'pages/parent/exercises/exercises',
    'pages/teacher/home/home',
    'pages/teacher/courses/courses',
    'pages/admin/home/home',
    'pages/admin/manage/manage',
    'pages/admin/schedule-board/schedule-board'
  ];
  requiredPages.forEach((page) => {
    assert(appJson.pages.includes(page), `app.json missing page: ${page}`);
  });
  appJson.pages.forEach((page) => {
    ['js', 'json', 'wxml', 'wxss'].forEach((ext) => {
      const file = path.join(root, `${page}.${ext}`);
      assert(fs.existsSync(file), `missing page file: ${page}.${ext}`);
    });
  });
}

function assertNoOldBrand() {
  const oldBrandWords = [
    ['Z', 'e', 'r', 'r', 'o', 'r'].join(''),
    ['z', 'e', 'r', 'r', 'o', 'r'].join(''),
    ['知', '芽'].join('')
  ];
  const exts = new Set(['.js', '.json', '.wxml', '.wxss', '.md', '.txt']);
  const hits = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'miniprogram_npm'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!exts.has(path.extname(entry.name))) continue;
      const text = fs.readFileSync(full, 'utf8');
      if (oldBrandWords.some((word) => text.includes(word))) hits.push(path.relative(root, full));
    }
  }
  walk(root);
  assert(hits.length === 0, `old brand strings found: ${hits.join(', ')}`);
}

function assertNoDeprecatedCopy() {
  const blockedWords = [
    ['待', '批', '改'].join(''),
    ['批', '改', '中'].join(''),
    ['批', '改', '进', '度'].join(''),
    ['作', '业', '批', '改'].join(''),
    ['手', '动', '批', '改'].join('')
  ];
  const exts = new Set(['.js', '.json', '.wxml', '.wxss', '.md', '.txt']);
  const hits = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'miniprogram_npm'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!exts.has(path.extname(entry.name))) continue;
      const text = fs.readFileSync(full, 'utf8');
      if (blockedWords.some((word) => text.includes(word))) hits.push(path.relative(root, full));
    }
  }
  walk(root);
  assert(hits.length === 0, `deprecated teacher copy found: ${hits.join(', ')}`);
}

async function run() {
  const appJson = readJson('app.json');
  assertPageFiles(appJson);
  assert(!appJson.tabBar, 'app.json should not keep the old native tabBar');
  assert(appJson.usingComponents['qf-role-tabbar'], 'qf-role-tabbar should be registered');
  assertNoOldBrand();
  assertNoDeprecatedCopy();

  const db = require('../services/mock-db');
  assert(Array.isArray(db.wechatAccounts), 'wechatAccounts collection missing');
  assert(Array.isArray(db.identities), 'identities collection missing');
  assert(Array.isArray(db.inviteCodes), 'inviteCodes collection missing');
  assert(Array.isArray(db.guardianBindings), 'guardianBindings collection missing');
  assert(db.classrooms.length === 15, 'should model 15 classrooms');
  assert(db.teachers.length >= 2, 'should model at least 2 teachers');
  assert(db.teachers.every((item) => item.fullName && item.name.includes(item.fullName)), 'teachers should expose full names');
  assert(db.students.length >= 3, 'should model at least 3 students');
  assert(db.admins.length >= 1, 'should model at least 1 admin');
  assert(db.classes.length >= 2, 'should model at least 2 classes');
  assert(db.courses.length >= 3, 'should model several courses');
  assert(db.courses.every((item) => item.teacherId && item.classroomId && Array.isArray(item.studentIds)), 'courses should be complete course classes');
  assert(db.courseSessions.every((item) => item.courseId && item.sessionIndex && item.sessionTitle), 'course sessions should belong to course classes');
  assert(db.courseSessions.some((item) => item.status === 'in_progress'), 'should include an in-progress course');
  assert(db.assignments.some((item) => item.type === 'pre'), 'should include pre-class assignment');
  assert(db.assignments.some((item) => item.type === 'post'), 'should include post-class assignment');
  assert(db.wrongRecords.length >= 1, 'should include wrong-record samples');
  assert(db.files.some((item) => item.ext === 'pdf'), 'should include PDF file metadata');
  assert(db.files.some((item) => item.ext === 'docx'), 'should include Word file metadata');
  assert(db.files.some((item) => ['jpg', 'png'].includes(item.ext)), 'should include wrong-record image metadata');
  assert(db.liveRooms.length >= 3, 'should include live room placeholders');
  assert(db.auditLogs.length >= 1, 'should include audit logs');

  const inviteCodes = db.inviteCodes.map((item) => item.code);
  assert(inviteCodes.includes('STUDENT-001'), 'missing STUDENT-001 invite');
  assert(inviteCodes.includes('TEACHER-2026'), 'missing TEACHER-2026 invite');
  assert(inviteCodes.includes('ADMIN-2026'), 'missing ADMIN-2026 invite');

  const Api = require('../services/api');
  const accountId = 'wx_test_smoke';
  const bindingsBefore = db.guardianBindings.length;

  const parentSession = await Api.bindInvite({
    wechatAccountId: accountId,
    inviteCode: 'STUDENT-001',
    relation: '母亲'
  });
  Api.setSession(parentSession);
  assert(parentSession.role === 'parent', 'student invite should create parent identity');
  assert(parentSession.studentIds.includes('stu_001'), 'parent should bind target student');
  assert(db.guardianBindings.length === bindingsBefore + 1, 'guardian binding should be created once');

  const parentDashboard = await Api.getDashboard();
  assert(parentDashboard.metrics.length >= 4, 'getDashboard should return parent metrics');
  const children = await Api.getParentChildren();
  assert(children.some((item) => item.id === 'stu_001'), 'getParentChildren should return bound child');
  const listedChildren = await Api.listParentChildren();
  assert(listedChildren.every((item) => item.displayLabel), 'listParentChildren should provide picker labels');
  const childSwitch = await Api.switchActiveChild('stu_001');
  assert(childSwitch.activeChildId === 'stu_001', 'switchActiveChild should update active child');

  await expectReject(Api.bindInvite({
    wechatAccountId: accountId,
    inviteCode: 'STUDENT-001',
    relation: '母亲'
  }), 'DUPLICATE_BINDING');
  assert(db.guardianBindings.length === bindingsBefore + 1, 'duplicate student binding should not duplicate records');

  let identities = await Api.listIdentities({ wechatAccountId: accountId });
  assert(identities.length === 1 && identities[0].role === 'parent', 'identity list should include parent identity');

  const parentCourses = await Api.getParentCourses({ studentId: 'stu_001' });
  assert(parentCourses.courseGroups.length >= 1, 'parent should see bound student course groups');
  assert(parentCourses.courseGroups.every((item) => item.studentIds.includes('stu_001')), 'parent courses should be filtered by child');
  assert(parentCourses.courseGroups.every((item) => Array.isArray(item.sessions)), 'parent course groups should include sessions');
  await expectReject(Api.getParentCourses({ studentId: 'stu_003' }), 'NO_PERMISSION');

  const parentExercises = await Api.getParentExercises({ studentId: 'stu_001' });
  assert(parentExercises.assignments.every((item) => db.courses.find((course) => course.id === item.courseId).studentIds.includes('stu_001')), 'parent assignments should be child-course filtered');
  assert(parentExercises.wrongRecords.every((item) => item.studentId === 'stu_001'), 'parent wrong records should be child filtered');

  const liveTicket = await Api.requestLiveTicket('cs_001');
  assert(liveTicket.status === 'placeholder' && !liveTicket.streamUrl, 'live without streamUrl should return placeholder status');
  await expectReject(Api.requestLiveTicket('cs_003'), 'NO_PERMISSION');

  const filePreview = await Api.getFilePreview('file_pdf_001');
  assert(filePreview.placeholderStatus === 'not_connected', 'file without fileID should return placeholder status');

  const teacherSession = await Api.bindInvite({
    wechatAccountId: accountId,
    inviteCode: 'TEACHER-2026'
  });
  Api.setSession(teacherSession);
  identities = await Api.listIdentities({ wechatAccountId: accountId });
  assert(identities.length >= 2, 'multi-identity list should be available');
  const parentIdentity = identities.find((item) => item.role === 'parent');
  const teacherIdentity = identities.find((item) => item.role === 'teacher');
  assert(parentIdentity && teacherIdentity, 'parent and teacher identities should both exist');

  const switchedTeacher = await Api.switchIdentity(teacherIdentity.id);
  assert(switchedTeacher.role === 'teacher', 'switchIdentity should activate teacher identity');
  const teacherCourses = await Api.getTeacherCourseGroups({});
  assert(teacherCourses.courseGroups.length >= 1, 'teacher should see own course groups');
  assert(teacherCourses.courseGroups.every((item) => item.teacherId === 'teacher_001'), 'teacher data should be filtered by teacher');
  assert(teacherCourses.courseGroups.every((item) => item.sessions.length >= 1), 'teacher course groups should include sessions');
  const groupDetail = await Api.getCourseGroupDetail('course_001');
  assert(groupDetail.mode === 'course' && groupDetail.course.sessions.length >= 1, 'course group detail should expose sessions');
  const sessionDetail = await Api.getCourseSessionDetail('cs_001');
  assert(sessionDetail.mode === 'session' && sessionDetail.students.length >= 1, 'course session detail should expose students');
  const courseStudents = await Api.getStudentsByCourse('course_001');
  assert(courseStudents.some((item) => item.id === 'stu_001'), 'getStudentsByCourse should return course students');
  await expectReject(Api.getCourseDetail('cs_003'), 'NO_PERMISSION');
  await expectReject(Api.uploadAssignmentFile({
    courseSessionId: 'cs_001',
    fileName: 'bad.txt',
    size: 1000
  }), 'UNSUPPORTED_FILE_TYPE');
  await expectReject(Api.uploadWrongRecordImage({
    fileName: 'too-large.png',
    size: 11 * 1024 * 1024
  }), 'FILE_TOO_LARGE');
  const uploadedAssignment = await Api.publishAssignment({
    courseId: 'course_001',
    courseSessionId: 'cs_001',
    title: 'Smoke PDF',
    type: 'post',
    fileName: 'smoke-test.pdf',
    size: 2048
  });
  assert(uploadedAssignment.file.placeholder, 'teacher upload should save placeholder file metadata');
  const uploadedImage = await Api.uploadWrongRecordImage({
    fileName: 'smoke-wrong.jpg',
    size: 2048
  });
  assert(uploadedImage.id, 'teacher should upload wrong-record image metadata');
  const createdWrong = await Api.createWrongRecord({
    courseId: 'course_001',
    studentId: 'stu_001',
    courseSessionId: 'cs_001',
    topic: 'Smoke 错题',
    imageFileId: uploadedImage.id
  });
  assert(createdWrong.id && createdWrong.imageFile, 'teacher should create wrong record with image metadata');
  assert(createdWrong.courseId === 'course_001' && createdWrong.teacherId === 'teacher_001', 'wrong record should auto-link course and teacher');

  const adminSession = await Api.bindInvite({
    wechatAccountId: accountId,
    inviteCode: 'ADMIN-2026'
  });
  Api.setSession(adminSession);
  identities = await Api.listIdentities({ wechatAccountId: accountId });
  assert(identities.length >= 3, 'account should support multiple identities');
  const adminIdentity = identities.find((item) => item.role === 'admin');
  const switchedAdmin = await Api.switchIdentity(adminIdentity.id);
  assert(switchedAdmin.role === 'admin', 'switchIdentity should activate admin identity');

  const overview = await Api.getAdminOverview();
  assert(overview.metrics.find((item) => item.label === '学生数').value >= 3, 'admin should see full student count');
  assert(overview.relationOverview.length >= 3, 'admin overview should include course relation cards');
  const adminRelations = await Api.getAdminRelationsOverview();
  assert(adminRelations.every((item) => item.courseName && item.teacherName && item.classroomName), 'admin relation overview should connect courses, teachers and classrooms');
  const classroomRelations = await Api.getAdminClassroomRelations();
  assert(classroomRelations.length === 15, 'admin classroom relations should include 15 classrooms');
  assert(classroomRelations.every((item) => item.cameraStatusText), 'classroom relation should expose camera status');
  const teacherRelations = await Api.getAdminTeacherRelations();
  assert(teacherRelations.every((item) => item.displayName && Array.isArray(item.courseNames)), 'teacher relation should expose full name and courses');
  const studentGuardianRelations = await Api.getAdminStudentGuardianRelations();
  assert(studentGuardianRelations.every((item) => Array.isArray(item.courseNames) && Array.isArray(item.guardians)), 'student relation should expose courses and guardians');
  const courseTree = await Api.getAdminCourseTree();
  assert(courseTree.every((item) => item.sessions.every((session) => Array.isArray(session.assignments))), 'course tree should expose sessions and assignments');

  const newInvite = await Api.createInvite({
    role: 'parent',
    targetId: 'stu_002',
    targetName: '许知远'
  });
  assert(newInvite.code.startsWith('STUDENT-'), 'admin should create student invite');

  const newTeacher = await Api.createTeacher({
    name: '测试老师',
    phone: '13800008888',
    subject: '化学'
  });
  assert(newTeacher.id, 'admin should create teacher');

  const newStudent = await Api.createStudent({
    name: '测试学生',
    classId: 'class_001',
    grade: '初二',
    primaryGuardian: '测试家长',
    guardianPhone: '13800007777'
  });
  assert(newStudent.id, 'admin should create student');

  const newClassroom = await Api.createClassroom({
    name: '测试教室',
    capacity: 18
  });
  assert(newClassroom.id, 'admin should create classroom');

  const newCourse = await Api.createCourse({
    name: '测试课程',
    subject: '数学',
    grade: '初二'
  });
  assert(newCourse.id, 'admin should create course');

  const conflict = await Api.checkScheduleConflicts({
    courseId: 'course_001',
    classId: 'class_001',
    teacherId: 'teacher_001',
    classroomId: 'room_08',
    date: '2026-06-03',
    startTime: '18:40',
    endTime: '19:20'
  });
  assert(conflict.hasConflict, 'conflict check should detect overlaps');
  assert(conflict.conflicts.some((item) => item.type === 'teacher'), 'teacher conflict missing');
  assert(conflict.conflicts.some((item) => item.type === 'classroom'), 'classroom conflict missing');
  assert(conflict.conflicts.some((item) => item.type === 'class'), 'class conflict missing');

  const newSession = await Api.createCourseSession({
    courseId: newCourse.id,
    title: '测试课次',
    teacherId: newTeacher.id,
    classroomId: 'room_01',
    date: '2026-06-07',
    startTime: '18:30',
    endTime: '20:00'
  });
  assert(newSession.id, 'admin should create non-conflicting course session');

  await Api.switchIdentity(parentIdentity.id);
  const sessionAfterSwitch = await Api.getCurrentSession();
  assert(sessionAfterSwitch.role === 'parent', 'switchIdentity should return to parent identity');

  await Api.logout();
  const afterLogout = await Api.getCurrentSession();
  assert(!afterLogout, 'logout should clear current session');

  console.log('Smoke test passed.');
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
