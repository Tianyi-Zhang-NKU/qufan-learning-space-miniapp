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

function walkTextFiles(callback) {
  const exts = new Set(['.js', '.json', '.wxml', '.wxss', '.md', '.txt']);
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'miniprogram_npm'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!exts.has(path.extname(entry.name))) continue;
      callback(full, fs.readFileSync(full, 'utf8'));
    }
  }
  walk(root);
}

function assertPageFiles(appJson) {
  const requiredPages = [
    'pages/login/login',
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
  const hits = [];
  walkTextFiles((full, text) => {
    if (oldBrandWords.some((word) => text.includes(word))) hits.push(path.relative(root, full));
  });
  assert(hits.length === 0, `old brand strings found: ${hits.join(', ')}`);
}

function assertNoDeprecatedMainCopy() {
  const blockedWords = [
    ['邀', '请', '码'].join(''),
    ['b', 'i', 'n', 'd', 'I', 'n', 'v', 'i', 't', 'e'].join(''),
    ['d', 'e', 'm', 'o', 'I', 'n', 'v', 'i', 't', 'e', 's'].join(''),
    ['i', 'n', 'v', 'i', 't', 'e', 'C', 'o', 'd', 'e'].join(''),
    ['生', '成', '邀', '请', '码'].join(''),
    ['最', '近', '邀', '请', '码'].join(''),
    ['多', '孩', '子'].join(''),
    ['父', '亲'].join(''),
    ['母', '亲'].join(''),
    ['爷', '爷'].join(''),
    ['奶', '奶'].join(''),
    ['错', '题', '录', '入'].join(''),
    ['错', '题', '本'].join(''),
    ['待', '批', '改'].join(''),
    ['批', '改', '中'].join(''),
    ['作', '业', '批', '改'].join('')
  ];
  const hits = [];
  walkTextFiles((full, text) => {
    if (blockedWords.some((word) => text.includes(word))) hits.push(path.relative(root, full));
  });
  assert(hits.length === 0, `deprecated main-flow copy found: ${hits.join(', ')}`);
}

async function run() {
  const appJson = readJson('app.json');
  assertPageFiles(appJson);
  assert(!appJson.tabBar, 'app.json should not keep native tabBar');
  assert(appJson.usingComponents['qf-role-tabbar'], 'qf-role-tabbar should be registered');
  assertNoOldBrand();
  assertNoDeprecatedMainCopy();

  const config = require('../services/config');
  const db = require('../services/mock-db');
  const oldDemoAuthKey = ['d', 'e', 'm', 'o', 'I', 'n', 'v', 'i', 't', 'e', 's'].join('');
  assert(config.authMode === 'mock', 'authMode should default to mock');
  assert(!Object.prototype.hasOwnProperty.call(config, oldDemoAuthKey), 'demo phone login should not use old demo auth config');
  assert(Array.isArray(db.phoneAccounts), 'phoneAccounts collection missing');
  assert(db.phoneAccounts.some((item) => item.phone === '13800000002' && item.role === 'teacher'), 'teacher demo phone missing');
  assert(db.phoneAccounts.some((item) => item.phone === '13800000001' && item.role === 'parent'), 'student demo phone missing');
  assert(db.phoneAccounts.some((item) => item.phone === '13800000003' && item.role === 'admin'), 'admin demo phone missing');
  assert(db.classrooms.length === 15, 'should model 15 classrooms');
  assert(db.liveRooms.length === 15, 'should keep 15 live room placeholders');
  assert(db.teachers.length >= 2, 'should model at least 2 teachers');
  assert(db.students.length >= 4, 'should model at least 4 students');
  assert(db.courses.length >= 3, 'should model at least 3 courses');
  assert(db.courses.every((course) => db.courseSessions.filter((item) => item.courseId === course.id).length >= 2), 'each course should have at least 2 lessons');
  assert(db.lessonFeedbacks.length >= 3, 'should include lesson feedback samples');
  assert(db.mediaFiles.some((item) => item.type === 'image' && item.downloadable === true), 'image media should be downloadable');
  assert(db.mediaFiles.some((item) => item.type === 'voice' && item.downloadable === false), 'voice media should not be downloadable');

  const Api = require('../services/api');
  assert(typeof Api.loginByPhone === 'function', 'loginByPhone missing');
  assert(typeof Api.createLessonFeedback === 'function', 'createLessonFeedback missing');
  assert(typeof Api.requestClassInLiveEntry === 'function', 'requestClassInLiveEntry missing');
  assert(!Object.prototype.hasOwnProperty.call(Api, ['b', 'i', 'n', 'd', 'I', 'n', 'v', 'i', 't', 'e'].join('')), 'old auth API should not be exported');

  const teacherSession = await Api.loginByPhone({ phone: '13800000002' });
  assert(teacherSession.role === 'teacher' && teacherSession.teacherId === 'teacher_001', 'teacher phone should login as teacher');
  Api.setSession(teacherSession);

  const teacherCourses = await Api.getTeacherCourses();
  assert(teacherCourses.courseGroups.length >= 2, 'teacher should see own courses');
  assert(teacherCourses.courseGroups.every((item) => item.teacherId === 'teacher_001'), 'teacher courses should be scoped');
  const bioCourse = teacherCourses.courseGroups.find((item) => item.id === 'course_bio_001');
  assert(bioCourse && bioCourse.sessions.length >= 2, 'teacher course should expand lessons');

  const lessonDetail = await Api.getTeacherLessonDetail('lesson_bio_001_01');
  assert(lessonDetail.students.length >= 2, 'teacher lesson should list students');
  assert(lessonDetail.students.some((item) => item.id === 'stu_001'), 'lesson should include target student');

  const uploadedImage = await Api.uploadFeedbackImage({
    fileName: 'smoke-feedback.jpg',
    size: 2048,
    tempPath: ''
  });
  assert(uploadedImage.type === 'image' && uploadedImage.downloadable === true, 'feedback image metadata should be downloadable');

  const uploadedVoice = await Api.uploadFeedbackVoice({
    fileName: 'smoke-feedback.m4a',
    size: 4096,
    duration: 12,
    tempPath: ''
  });
  assert(uploadedVoice.type === 'voice' && uploadedVoice.downloadable === false, 'feedback voice metadata should not be downloadable');

  const createdFeedback = await Api.createLessonFeedback({
    studentId: 'stu_001',
    teacherId: 'teacher_001',
    courseId: 'course_bio_001',
    courseSessionId: 'lesson_bio_001_01',
    text: 'Smoke 文字反馈',
    imageFileIds: [uploadedImage.id],
    voiceFileIds: [uploadedVoice.id]
  });
  assert(createdFeedback.id, 'teacher should create lesson feedback');
  assert(createdFeedback.text.includes('Smoke'), 'feedback should support text');
  assert(createdFeedback.imageFiles.length === 1, 'feedback should support image media');
  assert(createdFeedback.voiceFiles.length === 1, 'feedback should support voice media');

  await expectReject(Api.createLessonFeedback({
    studentId: 'stu_004',
    teacherId: 'teacher_001',
    courseId: 'course_eng_001',
    courseSessionId: 'lesson_eng_001_01',
    text: 'not allowed'
  }), 'NO_PERMISSION');

  const studentSession = await Api.loginByPhone({ phone: '13800000001' });
  assert(studentSession.role === 'parent' && studentSession.studentId === 'stu_001', 'student phone should login as parent role');
  Api.setSession(studentSession);

  const studentCourses = await Api.getStudentCourses();
  assert(studentCourses.courseGroups.length >= 1, 'student should see own courses');
  assert(studentCourses.courseGroups.every((item) => item.studentIds.includes('stu_001')), 'student courses should be scoped');
  const studentFeedbacks = await Api.getStudentLessonFeedbacks({ courseId: 'course_bio_001' });
  assert(studentFeedbacks.feedbacks.length >= 1, 'student should see own feedbacks');
  assert(studentFeedbacks.feedbacks.every((item) => item.studentId === 'stu_001'), 'student should only see own feedbacks');
  assert(studentFeedbacks.feedbacks.some((item) => item.id === createdFeedback.id), 'student should see newly created feedback');
  await expectReject(Api.getFeedbackDetail('feedback_002'), 'NO_PERMISSION');

  const imagePreview = await Api.getMediaPreview(uploadedImage.id);
  assert(imagePreview.kind === 'image' && imagePreview.downloadable === true, 'image preview should allow download');
  const imageDownload = await Api.downloadFeedbackImage(uploadedImage.id);
  assert(imageDownload.file.downloadable === true, 'download image should preserve downloadable=true');
  const voicePreview = await Api.getMediaPreview(uploadedVoice.id);
  assert(voicePreview.kind === 'voice' && voicePreview.downloadable === false, 'voice preview should not allow download');
  const voicePlay = await Api.playFeedbackVoice(uploadedVoice.id);
  assert(voicePlay.downloadable === false, 'voice play response should not expose download');

  const liveEntry = await Api.requestClassInLiveEntry({
    courseId: 'course_bio_001',
    courseSessionId: 'lesson_bio_001_01'
  });
  assert(liveEntry.status === 'pending' && liveEntry.provider === 'classin', 'ClassIn placeholder shape missing');
  assert(Object.prototype.hasOwnProperty.call(liveEntry, 'classinEntryUrl'), 'ClassIn entry URL field missing');

  const adminSession = await Api.loginByPhone({ phone: '13800000003' });
  assert(adminSession.role === 'admin', 'admin phone should login as admin');
  Api.setSession(adminSession);
  const overview = await Api.getAdminOverview();
  assert(overview.metrics.find((item) => item.label === '学生数').value >= 4, 'admin should see student count');
  const courseTree = await Api.getAdminCourseTree();
  assert(courseTree.length >= 3, 'admin course tree should include courses');
  assert(courseTree.every((course) => course.sessions.every((session) => typeof session.feedbackCount === 'number')), 'course tree should expose feedback counts');
  const teacherRelations = await Api.getAdminTeacherRelations();
  assert(teacherRelations.every((item) => item.phone && Array.isArray(item.courses)), 'teacher relation should expose phone and courses');
  const studentRelations = await Api.getAdminStudentRelations();
  assert(studentRelations.every((item) => item.loginPhone && Array.isArray(item.courses)), 'student relation should expose phone and courses');

  console.log('Smoke test passed.');
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
