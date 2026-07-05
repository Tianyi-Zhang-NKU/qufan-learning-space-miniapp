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

function readText(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
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

function profileWxssHasCalendarStyle() {
  const profileWxss = readText('pages/profile/profile.wxss');
  return profileWxss.includes('profile-schedule-board') && profileWxss.includes('schedule-day-card');
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
    ['待', '批', '改'].join(''),
    ['批', '改', '中'].join(''),
    ['作', '业', '批', '改'].join(''),
    ['课', '后', '反', '馈'].join('')
  ];
  const hits = [];
  walkTextFiles((full, text) => {
    const relative = path.relative(root, full).replace(/\\/g, '/');
    if (relative.startsWith('docs/client-meeting-') || relative.startsWith('docs/superpowers/')) return;
    if (blockedWords.some((word) => text.includes(word))) hits.push(relative);
  });
  assert(hits.length === 0, `deprecated main-flow copy found: ${hits.join(', ')}`);
}

async function run() {
  const appJson = readJson('app.json');
  assertPageFiles(appJson);
  assert(!appJson.tabBar, 'app.json should not keep native tabBar');
  assert(appJson.usingComponents['qf-role-tabbar'], 'qf-role-tabbar should be registered');
  assert(appJson.window.navigationBarBackgroundColor === '#FFFFFF', 'top navigation should use white background');
  assert(appJson.window.navigationBarTextStyle === 'black', 'top navigation should use black title text');

  const roleTabbarJs = readText('components/qf-role-tabbar/qf-role-tabbar.js');
  const roleTabbarWxml = readText('components/qf-role-tabbar/qf-role-tabbar.wxml');
  const roleTabbarWxss = readText('components/qf-role-tabbar/qf-role-tabbar.wxss');
  assert(!roleTabbarJs.includes('mark:') && roleTabbarJs.includes('/assets/icons/'), 'role tabbar should use local vector icon assets instead of text marks');
  assert(roleTabbarWxml.includes('<image') && roleTabbarWxml.includes('item.icon'), 'role tabbar should render icon images');
  assert(!roleTabbarJs.includes("mark: '+'") && !roleTabbarJs.includes('primary: true'), 'role tabbar should not keep raised plus primary entry');
  assert(!roleTabbarJs.includes('/pages/parent/exercises/exercises'), 'student tabbar should not expose standalone wrong-feedback page');
  assert(roleTabbarJs.includes('/pages/parent/courses/courses') && roleTabbarJs.includes("text: '课表'"), 'student tabbar should expose schedule as a bottom tab');
  assert(roleTabbarJs.includes('/pages/teacher/courses/courses') && roleTabbarJs.includes("text: '课程表'"), 'teacher schedule should be a standalone bottom tab');
  assert(!roleTabbarWxss.includes('.qf-role-tab.primary'), 'role tabbar CSS should use unified item styling');
  assert(roleTabbarWxss.includes('width: 100vw') && roleTabbarWxss.includes('border-radius: 0'), 'role tabbar should fill both screen edges without side gaps');
  assert(readText('custom-tab-bar/index.wxss').includes('padding: 18rpx 0') && readText('custom-tab-bar/index.wxss').includes('border-radius: 0'), 'custom tabbar should fill both screen edges without side gaps');

  const styleGuide = readText('docs/qufan-style-guide.md');
  const componentContract = readText('docs/qufan-component-contract.md');
  const appWxss = readText('app.wxss');
  assert(styleGuide.includes('浅纸感管理风') && styleGuide.includes('#E9E6DA') && styleGuide.includes('#10224A'), 'style guide should document the light paper management theme');
  assert(componentContract.includes('浅纸感管理风') && componentContract.includes('#FFFDF6'), 'component contract should document the updated shared component theme');
  assert(appWxss.includes('#E9E6DA') && appWxss.includes('#10224A') && appWxss.includes('#FFFDF6'), 'app.wxss should expose the new paper theme colors');

  const feedbackTypes = require('../utils/feedback-types');
  assert(feedbackTypes.feedbackTypeText('pre') === '课堂小测学习反馈', 'shared feedback type text should format pre-test feedback');
  assert(feedbackTypes.feedbackTypeText('post') === '本讲总结学习反馈', 'shared feedback type text should format post-test feedback');
  assert(feedbackTypes.feedbackTypeText('general') === '本讲总结反馈', 'shared feedback type text should format general feedback');
  assert(feedbackTypes.feedbackTypeText('unknown') === '本讲总结学习反馈', 'unknown feedback type should keep the existing post-test fallback');
  assert(feedbackTypes.feedbackTypeWrongLabel('general') === '本讲反馈', 'shared feedback type labels should support teacher wrong-feedback tabs');
  assert(feedbackTypes.feedbackTypeShortLabel('general') === '本讲总结', 'shared feedback type labels should preserve parent general-type wording');

  const scheduleCalendar = require('../utils/schedule-calendar');
  const calendarDays = scheduleCalendar.buildCalendarDays(2026, 6, '2026-06-06', new Set(['2026-06-06']), '2026-06-07');
  assert(calendarDays.length === 42, 'shared calendar builder should keep a stable 42-cell grid');
  assert(calendarDays[0].date === '2026-06-01' && calendarDays[0].isCurrentMonth, 'June 2026 calendar should start on Monday without filler days');
  assert(calendarDays.find((day) => day.date === '2026-06-06').hasCourse, 'shared calendar builder should mark course dates');
  assert(calendarDays.find((day) => day.date === '2026-06-07').isToday, 'shared calendar builder should support deterministic today markers');
  assert(scheduleCalendar.formatDisplayDate('2026-06-07', '2026-06-07') === '今天', 'shared date display should render today');
  assert(scheduleCalendar.formatDisplayDate('2026-06-08', '2026-06-07') === '明天', 'shared date display should render tomorrow');
  const scheduleCourses = [{
    id: 'course_smoke',
    name: 'Smoke 课程',
    teacherName: 'Smoke 老师',
    classroomName: '1号教室',
    studentCount: 2,
    sessions: [
      { id: 'lesson_late', date: '2026-06-06', startTime: '20:00', endTime: '21:00', displayTitle: '第2次课', status: 'scheduled' },
      { id: 'lesson_early', date: '2026-06-06', startTime: '18:30', endTime: '20:00', displayTitle: '第1次课', topic: 'Smoke 主题', status: 'finished' }
    ]
  }];
  const courseDates = scheduleCalendar.collectCourseDates(scheduleCourses);
  const sessionsForDate = scheduleCalendar.getSessionsForDate(scheduleCourses, '2026-06-06');
  assert(courseDates.has('2026-06-06'), 'shared schedule helper should collect dates from nested sessions');
  assert(sessionsForDate[0].id === 'lesson_early' && sessionsForDate[0].courseName === 'Smoke 课程', 'shared schedule helper should sort and decorate sessions for a date');

  const profileWxml = readText('pages/profile/profile.wxml');
  const profileJs = readText('pages/profile/profile.js');
  assert(profileWxml.includes('profile-identity-header') && profileWxml.includes('avatar-badge'), 'profile should use the unified role identity header for all roles');
  assert(!profileWxml.includes('我的课表') && !profileJs.includes('parentSchedule') && !profileJs.includes('teacherSchedule'), 'profile should remove embedded schedule sections from student and teacher centers');
  assert(!profileWxml.includes('我的错题本'), 'profile should not keep a separate wrongbook entry');
  assert(!profileWxml.includes('查看完整课表'), 'profile schedules should be embedded directly instead of jump-only cards');
  assert(!profileWxml.includes('今日课程提醒') && !profileJs.includes('todayTeacherSchedule'), 'teacher profile should remove today course reminder from personal center');
  assert(!profileWxml.includes('profile-schedule-board') && !profileWxssHasCalendarStyle(), 'profile should not keep calendar board styling after schedule moves out');

  const teacherHomeJs = readText('pages/teacher/home/home.js');
  const teacherHomeWxml = readText('pages/teacher/home/home.wxml');
  assert(teacherHomeJs.includes('courseSearchQuery') && teacherHomeJs.includes('studentSearchQuery'), 'teacher home should support course and student search');
  assert(teacherHomeWxml.includes('今日课程提醒'), 'teacher home should show today course reminders');
  assert(teacherHomeWxml.includes('课次合集') && teacherHomeWxml.includes('学生路径'), 'teacher course collection should expose session and student feedback paths');
  assert(!teacherHomeWxml.includes('学生合集</text>'), 'teacher home overview should not keep standalone student collection');

  const adminHomeJs = readText('pages/admin/home/home.js');
  const adminHomeWxml = readText('pages/admin/home/home.wxml');
  assert(adminHomeJs.includes('gradeFilters') && adminHomeJs.includes('subjectFilters') && adminHomeJs.includes('teacherSubjectFilters'), 'admin collections should expose grade and subject filters');
  assert(adminHomeJs.includes('GRADE_OPTIONS') && adminHomeJs.includes('SUBJECT_OPTIONS'), 'admin filters should use full grade and subject option catalogs');
  assert(adminHomeWxml.includes('bindchange="onGradeFilterChange"') && adminHomeWxml.includes('bindchange="onSubjectFilterChange"'), 'admin filters should be picker dropdowns');
  assert(adminHomeWxml.includes('bindchange="onEditorSubjectChange"') && adminHomeWxml.includes('bindchange="onEditorGradeChange"'), 'course editor subject and grade should be picker dropdowns');

  const adminManageWxml = readText('pages/admin/manage/manage.wxml');
  assert(adminManageWxml.includes('导入学生') && !adminManageWxml.includes('导入课程'), 'admin data management should only keep import-student action');
  assert(adminManageWxml.includes('教务同步') && adminManageWxml.includes('data-action="transfer"') && adminManageWxml.includes('data-action="withdraw"'), 'admin data management should expose enrollment sync actions for insert, transfer and withdraw');
  assert(readText('pages/admin/manage/manage.js').includes('syncEnrollmentChange'), 'admin data management should call enrollment sync API');

  assert(readText('pages/parent/home/home.wxml').includes('/pages/live-player/live-player'), 'student pages should expose course live entry');
  assert(readText('pages/parent/home/home.wxml').includes('course-actions tests-row') && readText('pages/parent/home/home.wxml').includes('course-actions live-row'), 'student home should split test buttons and live entry into separate rows');
  assert(readText('pages/parent/home/home.wxml').includes('scroll-view') && readText('pages/parent/home/home.wxml').includes('course-schedule-scroll'), 'student home schedule lines should be scrollable');
  assert(readText('pages/parent/home/home.wxss').includes('course-schedule-scroll') && readText('pages/parent/home/home.wxss').includes('max-height'), 'student home schedule scroll should limit visible rows');
  assert(!readText('pages/parent/home/home.wxss').includes('justify-content: flex-start') && !readText('pages/parent/home/home.wxss').includes('padding-left: 34rpx'), 'student live button should keep centered text');
  assert(readText('pages/parent/courses/courses.js').includes('/pages/parent/exercises/exercises?courseId=') && !readText('pages/parent/courses/courses.js').includes('/pages/course-detail/course-detail?id=${sessionId}'), 'student schedule test buttons should navigate to the parent wrong-feedback page with course and session context');
  assert(readText('pages/parent/exercises/exercises.js').includes('courseId && sessionId && type'), 'student wrong-feedback page should support session-scoped pre/post test entries');
  assert(teacherHomeWxml.includes('/pages/live-player/live-player'), 'teacher home should expose course live entry');
  assert(readText('pages/teacher/courses/courses.wxml').includes('current="/pages/teacher/courses/courses"'), 'teacher schedule page tabbar current should point to itself');
  assert(readText('pages/teacher/courses/courses.wxml').includes('bindtap="editSession"') && readText('pages/teacher/courses/courses.wxml').includes('session-editor'), 'teacher schedule should expose lesson rename/topic editor');
  assert(readText('pages/admin/home/home.wxml').includes('/pages/live-player/live-player'), 'admin course collection should expose course live entry');
  assert(adminHomeWxml.includes('课次数量') && adminHomeWxml.includes('onSessionCountInput') && adminHomeWxml.includes('onSessionDraftInput') && adminHomeWxml.includes('onSessionClassroomChange'), 'admin course editor should expose editable session count, classroom and time fields');
  assert(adminHomeJs.includes('syncCourseSessionsForEditor') && adminHomeJs.includes('saveCourseEditor'), 'admin course editor should persist course session count and lesson edits');
  assert(teacherHomeWxml.includes('教师待办') && teacherHomeWxml.includes('confirmPass') === false && teacherHomeWxml.includes('确认通关'), 'teacher home should expose pass-confirmation todo cards');
  assert(readText('pages/teacher/home/home.js').includes('getTeacherTodos') && readText('pages/teacher/home/home.wxss').includes('todo-card'), 'teacher home should load and style teacher todos');
  assert(readText('pages/teacher/feedback-detail/feedback-detail.wxml').includes('pass-quick-card') && readText('pages/teacher/feedback-detail/feedback-detail.js').includes('confirmPassNow'), 'feedback detail should expose fixed pass confirmation action');
  assert(readText('pages/teacher/feedback-detail/feedback-detail.wxml').includes('wrong-question-card') && readText('pages/teacher/feedback-detail/feedback-detail.js').includes('markStudentWrongQuestions'), 'feedback detail should let teachers mark student wrong questions');
  assert(readText('pages/teacher/test-upload/test-upload.wxml').includes('本课题目框') && readText('pages/teacher/test-upload/test-upload.js').includes('createLessonQuestions'), 'teacher upload page should create question slots for wrong workbook');
  assert(readText('pages/teacher/feedback-students/feedback-students.wxml').includes('student-grid') && readText('pages/teacher/feedback-students/feedback-students.wxss').includes('grid-template-columns: repeat(4'), 'teacher student list should use compact avatar grid');
  assert(readText('pages/parent/home/home.wxml').includes('我的荣誉') && readText('pages/parent/home/home.js').includes('getStudentHonors'), 'student home should expose honor certificates');
  assert(readText('pages/parent/summary/summary.wxml').includes('honor-card') && readText('pages/parent/summary/summary.wxml').includes('feedback-docs'), 'lesson summary should show honors and feedback documents inline');
  assert(readText('pages/parent/exercises/exercises.wxml').includes('workbook-export-card') && readText('pages/parent/exercises/exercises.js').includes('exportStudentWrongWorkbook'), 'wrong workbook should expose printable PDF export');
  assert(readText('pages/parent/exercises/exercises.wxml').includes('data-format="docx"') && readText('pages/parent/exercises/exercises.wxml').includes('导出 Word'), 'wrong workbook should also expose printable Word export');

  const loginWxss = readText('pages/login/login.wxss');
  const loginWxml = readText('pages/login/login.wxml');
  assert(loginWxml.includes('<z-bg mode="auth"'), 'login page should keep its own full-screen auth background');
  assert(loginWxml.includes('LOGO') && !loginWxml.includes('QF'), 'login page should keep a formal LOGO placeholder instead of the old QF monogram');
  assert(loginWxml.includes('login-card-title') && loginWxml.includes('login-helper'), 'login page should use a formal form card and weak helper copy');
  assert(!loginWxml.includes('login-signal-row') && !loginWxml.includes('演示账号'), 'login page should remove large debug/explainer blocks');
  assert(loginWxml.includes('debug-login-toggle') && loginWxss.includes('debug-login-toggle'), 'login page should keep only a small debug account entry');
  assert(loginWxss.includes('animation: none') && loginWxss.includes('opacity: 1'), 'login page should not inherit global page entrance animation');
  assert(!loginWxss.includes('calc(100vh'), 'login page should avoid calc viewport sizing that can collapse in miniapp renderers');
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
  assert(db.teachers.some((teacher) => (teacher.courseIds || []).length >= 2), 'at least one teacher should teach multiple courses');
  assert(db.courseSessions.filter((item) => item.courseId === 'course_bio_001').length >= 4, 'core demo course should model a multi-week term schedule');
  assert(db.teachers.every((teacher) => !teacher.subjects || teacher.subjects.length >= 1), 'each teacher should expose subject metadata');
  assert(db.courses.every((course) => {
    const teacher = db.teachers.find((item) => item.id === course.teacherId);
    return teacher && teacher.subject === course.subject;
  }), 'course subject should match its teacher subject');
  assert(db.courses.every((course) => db.courseSessions.filter((item) => item.courseId === course.id).length >= 2), 'each course should have at least 2 lessons');
  assert(db.courseSessions.every((item) => item.displayTitle === item.sessionTitle) && db.courseSessions.some((item) => item.topic), 'lesson default display title should be short 第x次课 while keeping editable topic metadata');
  assert(db.lessonFeedbacks.length >= 3, 'should include lesson feedback samples');
  assert(db.mediaFiles.some((item) => item.type === 'image' && item.downloadable === false), 'image media should preview in miniapp without download');
  assert(db.mediaFiles.some((item) => item.type === 'video' && item.downloadable === false), 'video media should preview in miniapp without download');
  assert(db.mediaFiles.some((item) => item.type === 'voice' && item.downloadable === false), 'voice media should not be downloadable');
  assert(db.mediaFiles.every((item) => item.url), 'mock media should use realistic preview URLs instead of empty placeholders');
  assert(db.liveRooms.some((item) => item.streamUrl || item.previewVideoUrl || item.classinEntryUrl), 'mock live room should expose a realistic demo entry or stream URL');

  const Api = require('../services/api');
  assert(typeof Api.loginByPhone === 'function', 'loginByPhone missing');
  assert(typeof Api.createLessonFeedback === 'function', 'createLessonFeedback missing');
  assert(typeof Api.uploadFeedbackFile === 'function', 'uploadFeedbackFile missing');
  assert(typeof Api.uploadFeedbackVideo === 'function', 'uploadFeedbackVideo missing');
  assert(typeof Api.requestClassInLiveEntry === 'function', 'requestClassInLiveEntry missing');
  assert(typeof Api.getTeacherTodos === 'function', 'teacher todo API missing');
  assert(typeof Api.confirmStudentPass === 'function', 'pass confirmation API missing');
  assert(typeof Api.createLessonQuestions === 'function', 'lesson question upload API missing');
  assert(typeof Api.markStudentWrongQuestions === 'function', 'wrong-question selection API missing');
  assert(typeof Api.getStudentWrongWorkbook === 'function', 'student wrong workbook API missing');
  assert(typeof Api.exportStudentWrongWorkbook === 'function', 'wrong workbook export API missing');
  assert(typeof Api.getStudentHonors === 'function', 'student honors API missing');
  assert(typeof Api.updateCourse === 'function' && typeof Api.deleteCourse === 'function', 'admin course CRUD missing');
  assert(typeof Api.updateCourseSession === 'function' && typeof Api.deleteCourseSession === 'function', 'course session edit/delete APIs missing');
  assert(typeof Api.updateStudent === 'function' && typeof Api.deleteStudent === 'function', 'admin student CRUD missing');
  assert(typeof Api.updateTeacher === 'function' && typeof Api.deleteTeacher === 'function', 'admin teacher CRUD missing');
  assert(typeof Api.updateClassroom === 'function' && typeof Api.deleteClassroom === 'function', 'admin classroom CRUD missing');
  assert(typeof Api.syncEnrollmentChange === 'function' && typeof Api.transferStudentCourse === 'function' && typeof Api.removeStudentFromCourse === 'function', 'admin enrollment sync APIs missing');
  assert(!Object.prototype.hasOwnProperty.call(Api, ['b', 'i', 'n', 'd', 'I', 'n', 'v', 'i', 't', 'e'].join('')), 'old auth API should not be exported');

  const teacherSession = await Api.loginByPhone({ phone: '13800000002' });
  assert(teacherSession.role === 'teacher' && teacherSession.teacherId === 'teacher_001', 'teacher phone should login as teacher');
  Api.setSession(teacherSession);

  const teacherCourses = await Api.getTeacherCourses();
  assert(teacherCourses.courseGroups.length >= 1, 'teacher should see own courses');
  assert(teacherCourses.courseGroups.every((item) => item.teacherId === 'teacher_001'), 'teacher courses should be scoped');
  assert(teacherCourses.courseGroups.every((item) => item.subject === '生物'), 'teacher courses should stay in one subject');
  const bioCourse = teacherCourses.courseGroups.find((item) => item.id === 'course_bio_001');
  assert(bioCourse && bioCourse.sessions.length >= 2, 'teacher course should expand lessons');

  const lessonDetail = await Api.getTeacherLessonDetail('lesson_bio_001_01');
  assert(lessonDetail.students.length >= 2, 'teacher lesson should list students');
  assert(lessonDetail.students.some((item) => item.id === 'stu_001'), 'lesson should include target student');
  const renamedLesson = await Api.updateCourseSession({
    id: 'lesson_bio_001_02',
    sessionTitle: '第2次课',
    topic: 'Smoke 可编辑主题'
  });
  assert(renamedLesson.sessionTitle === '第2次课' && renamedLesson.topic === 'Smoke 可编辑主题', 'teacher should rename own lesson and add topic');

  const uploadedImage = await Api.uploadFeedbackImage({
    fileName: 'smoke-feedback.jpg',
    size: 2048,
    tempPath: ''
  });
  assert(uploadedImage.type === 'image' && uploadedImage.downloadable === false, 'feedback image metadata should preview without download');

  const uploadedVideo = await Api.uploadFeedbackVideo({
    fileName: 'smoke-feedback.mp4',
    size: 8192,
    duration: 18,
    tempPath: ''
  });
  assert(uploadedVideo.type === 'video' && uploadedVideo.downloadable === false, 'feedback video metadata should preview without download');

  const uploadedVoice = await Api.uploadFeedbackVoice({
    fileName: 'smoke-feedback.m4a',
    size: 4096,
    duration: 12,
    tempPath: ''
  });
  assert(uploadedVoice.type === 'voice' && uploadedVoice.downloadable === false, 'feedback voice metadata should not be downloadable');

  const uploadedDoc = await Api.uploadFeedbackFile({
    fileName: 'smoke-feedback.docx',
    size: 4096,
    tempPath: ''
  });
  assert(uploadedDoc.ext === 'docx' && uploadedDoc.canPreview, 'feedback document should be uploadable and previewable');

  const createdFeedback = await Api.createLessonFeedback({
    studentId: 'stu_001',
    teacherId: 'teacher_001',
    courseId: 'course_bio_001',
    courseSessionId: 'lesson_bio_001_01',
    text: 'Smoke 文字反馈',
    feedbackType: 'pre',
    imageFileIds: [uploadedImage.id],
    videoFileIds: [uploadedVideo.id],
    voiceFileIds: [uploadedVoice.id],
    attachFileIds: [uploadedDoc.id]
  });
  assert(createdFeedback.id, 'teacher should create lesson feedback');
  assert(createdFeedback.feedbackType === 'pre' && createdFeedback.feedbackTypeText === '课堂小测学习反馈', 'feedback should preserve pre/post wrong-feedback type');
  assert(createdFeedback.text.includes('Smoke'), 'feedback should support text');
  assert(createdFeedback.imageFiles.length === 1, 'feedback should support image media');
  assert(createdFeedback.videoFiles.length === 1, 'feedback should support video media');
  assert(createdFeedback.voiceFiles.length === 1, 'feedback should support voice media');
  assert(createdFeedback.attachFiles.length === 1, 'feedback should support document attachments');

  const editedFeedback = await Api.createLessonFeedback({
    studentId: 'stu_001',
    teacherId: 'teacher_001',
    courseId: 'course_bio_001',
    courseSessionId: 'lesson_bio_001_01',
    text: 'Smoke 二次编辑反馈 😊\n已补充主讲老师点评',
    feedbackType: 'pre',
    imageFileIds: [uploadedImage.id],
    voiceFileIds: [uploadedVoice.id],
    attachFileIds: [uploadedDoc.id]
  });
  assert(editedFeedback.id === createdFeedback.id, 'repeated lesson feedback save should update the same student/session/type record');
  assert(editedFeedback.editCount >= 2 && editedFeedback.updatedAt, 'edited feedback should expose edit history metadata');

  const uploadedQuestionFile = await Api.uploadFeedbackFile({
    fileName: 'smoke-question.pdf',
    size: 8192,
    tempPath: ''
  });
  const lessonQuestions = await Api.createLessonQuestions({
    courseId: 'course_bio_001',
    courseSessionId: 'lesson_bio_001_01',
    questions: [
      { title: '细胞结构辨析', order: 1, fileId: uploadedQuestionFile.id },
      { title: '显微镜使用步骤', order: 2 }
    ]
  });
  assert(lessonQuestions.questions.length === 2 && lessonQuestions.questions[0].file, 'teacher should pre-upload lesson question slots with files');

  const wrongSelection = await Api.markStudentWrongQuestions({
    studentId: 'stu_001',
    courseId: 'course_bio_001',
    courseSessionId: 'lesson_bio_001_01',
    questionIds: lessonQuestions.questions.map((item) => item.id),
    accuracy: 60,
    rankText: '超过班级 40% 同学'
  });
  assert(wrongSelection.questionIds.length === 2 && wrongSelection.accuracy === 60, 'teacher should mark wrong questions by student');

  const lessonDetailAfterWrongSelection = await Api.getTeacherLessonDetail('lesson_bio_001_01');
  assert(lessonDetailAfterWrongSelection.wrongSelections.some((item) => item.studentId === 'stu_001' && item.questionIds.length === 2), 'teacher lesson detail should expose saved wrong-question selections');

  const todosBeforePass = await Api.getTeacherTodos();
  assert(todosBeforePass.pendingPassCount >= 1, 'teacher todos should include pending pass confirmations');
  assert(todosBeforePass.items.some((item) => item.studentId === 'stu_001' && item.courseSessionId === 'lesson_bio_001_01'), 'teacher todos should list pending student/session pass items');

  const passResult = await Api.confirmStudentPass({
    studentId: 'stu_001',
    courseId: 'course_bio_001',
    courseSessionId: 'lesson_bio_001_01',
    passed: true,
    comment: 'Smoke 确认通关'
  });
  assert(passResult.passed && passResult.feedback.passed, 'teacher should confirm pass for one student/session');
  const todosAfterPass = await Api.getTeacherTodos();
  assert(!todosAfterPass.items.some((item) => item.studentId === 'stu_001' && item.courseSessionId === 'lesson_bio_001_01'), 'confirmed pass item should disappear from teacher todos');

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
  const preWrongFeedbacks = await Api.getStudentLessonFeedbacks({ courseId: 'course_bio_001', feedbackType: 'pre' });
  assert(preWrongFeedbacks.feedbacks.every((item) => item.feedbackType === 'pre'), 'student pre-test view should show only pre wrong feedbacks');
  const workbook = await Api.getStudentWrongWorkbook({ courseId: 'course_bio_001' });
  assert(workbook.records.some((item) => item.courseSessionId === 'lesson_bio_001_01' && item.questions.length === 2), 'student wrong workbook should aggregate selected wrong questions');
  assert(workbook.summary.totalWrongQuestions >= 2 && workbook.summary.accuracyText, 'student wrong workbook should expose totals and accuracy text');
  const exportedWorkbook = await Api.exportStudentWrongWorkbook({ courseId: 'course_bio_001', format: 'pdf' });
  assert(exportedWorkbook.format === 'pdf' && exportedWorkbook.fileName.endsWith('.pdf') && exportedWorkbook.printable, 'parent should export wrong workbook as a printable single file');
  const exportedWordWorkbook = await Api.exportStudentWrongWorkbook({ courseId: 'course_bio_001', format: 'docx' });
  assert(exportedWordWorkbook.format === 'docx' && exportedWordWorkbook.fileName.endsWith('.docx') && exportedWordWorkbook.printable, 'parent should export wrong workbook as a printable Word file');
  const honors = await Api.getStudentHonors({ courseId: 'course_bio_001' });
  assert(honors.certificates.some((item) => item.studentName === '陈一诺' && item.courseName), 'student honors should expose named course certificates');
  await expectReject(Api.getFeedbackDetail('feedback_002'), 'NO_PERMISSION');

  const imagePreview = await Api.getMediaPreview(uploadedImage.id);
  assert(imagePreview.kind === 'image' && imagePreview.downloadable === false, 'image preview should not require download');
  const videoPreview = await Api.getMediaPreview(uploadedVideo.id);
  assert(videoPreview.kind === 'video' && videoPreview.downloadable === false, 'video preview should not require download');
  const voicePreview = await Api.getMediaPreview(uploadedVoice.id);
  assert(voicePreview.kind === 'voice' && voicePreview.downloadable === false, 'voice preview should not allow download');
  const voicePlay = await Api.playFeedbackVoice(uploadedVoice.id);
  assert(voicePlay.downloadable === false, 'voice play response should not expose download');

  const liveEntry = await Api.requestClassInLiveEntry({
    courseId: 'course_bio_001',
    courseSessionId: 'lesson_bio_001_01'
  });
  assert(liveEntry.status === 'ready' && liveEntry.provider === 'classin', 'ClassIn demo entry shape missing');
  assert(liveEntry.classinEntryUrl && (liveEntry.previewVideoUrl || liveEntry.streamUrl), 'ClassIn demo entry should expose playable preview fields');

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

  const createdClassroom = await Api.createClassroom({ name: 'Smoke CRUD 教室', campus: '东校区', capacity: 16, cameraStatus: 'ready' });
  const updatedClassroom = await Api.updateClassroom({ id: createdClassroom.id, name: 'Smoke CRUD 教室A', capacity: 20, cameraStatus: 'testing' });
  assert(updatedClassroom.name === 'Smoke CRUD 教室A' && updatedClassroom.capacity === 20, 'admin should update classroom');

  const createdTeacher = await Api.createTeacher({ fullName: 'Smoke 老师', name: 'Smoke 老师', phone: '13900009991', subject: '物理', title: '物理老师' });
  const updatedTeacher = await Api.updateTeacher({ id: createdTeacher.id, fullName: 'Smoke 老师A', name: 'Smoke 老师A', phone: '13900009992', subject: '化学' });
  assert(updatedTeacher.fullName === 'Smoke 老师A' && updatedTeacher.subject === '化学', 'admin should update teacher');

  const createdStudent = await Api.createStudent({ name: 'Smoke 学生', phone: '13900009993', grade: '初一' });
  const updatedStudent = await Api.updateStudent({ id: createdStudent.id, name: 'Smoke 学生A', phone: '13900009994', grade: '初二' });
  assert(updatedStudent.name === 'Smoke 学生A' && updatedStudent.grade === '初二', 'admin should update student');

  const createdCourse = await Api.createCourse({
    name: 'Smoke CRUD 课程',
    subject: '化学',
    grade: '初二',
    teacherId: updatedTeacher.id,
    classroomId: updatedClassroom.id,
    studentIds: [updatedStudent.id],
    description: 'CRUD smoke'
  });
  const updatedCourse = await Api.updateCourse({ id: createdCourse.id, name: 'Smoke CRUD 课程A', subject: '化学', grade: '初三', teacherId: updatedTeacher.id, classroomId: updatedClassroom.id });
  assert(updatedCourse.name === 'Smoke CRUD 课程A' && updatedCourse.grade === '初三', 'admin should update course');
  const createdSession = await Api.createCourseSession({
    courseId: createdCourse.id,
    date: '2026-08-01',
    startTime: '08:00',
    endTime: '09:30',
    classroomId: updatedClassroom.id,
    topic: 'Smoke 首次课'
  });
  assert(createdSession.sessionTitle === '第1次课' && createdSession.topic === 'Smoke 首次课', 'admin should create default-numbered course lesson');

  const transferCourse = await Api.createCourse({
    name: 'Smoke 调班目标课程',
    subject: '化学',
    grade: '初三',
    teacherId: updatedTeacher.id,
    classroomId: updatedClassroom.id,
    studentIds: [],
    description: 'enrollment sync smoke'
  });
  const transferSession = await Api.createCourseSession({
    courseId: transferCourse.id,
    date: '2026-08-01',
    startTime: '12:00',
    endTime: '13:30',
    classroomId: updatedClassroom.id,
    topic: 'Smoke 调班目标课'
  });
  const enrolledChange = await Api.syncEnrollmentChange({ action: 'enroll', studentId: updatedStudent.id, toCourseId: transferCourse.id });
  assert(enrolledChange.course.studentIds.includes(updatedStudent.id), 'admin enrollment sync should insert student into target course');
  assert(Api.__mockDb.courseSessions.find((item) => item.id === transferSession.id).studentIds.includes(updatedStudent.id), 'inserted student should sync into target course sessions');
  const transferredChange = await Api.syncEnrollmentChange({ action: 'transfer', studentId: updatedStudent.id, fromCourseId: createdCourse.id, toCourseId: transferCourse.id });
  assert(!transferredChange.fromCourse.studentIds.includes(updatedStudent.id) && transferredChange.toCourse.studentIds.includes(updatedStudent.id), 'admin enrollment sync should transfer student between courses');
  assert(!Api.__mockDb.courseSessions.find((item) => item.id === createdSession.id).studentIds.includes(updatedStudent.id), 'transferred student should leave source course sessions');
  const withdrawnChange = await Api.syncEnrollmentChange({ action: 'withdraw', studentId: updatedStudent.id, fromCourseId: transferCourse.id });
  assert(!withdrawnChange.course.studentIds.includes(updatedStudent.id), 'admin enrollment sync should withdraw student from course');
  assert(!Api.__mockDb.courseSessions.find((item) => item.id === transferSession.id).studentIds.includes(updatedStudent.id), 'withdrawn student should leave target course sessions');

  const updatedSession = await Api.updateCourseSession({
    id: createdSession.id,
    sessionTitle: '第1次课',
    topic: 'Smoke 更新主题',
    date: '2026-08-02',
    startTime: '10:00',
    endTime: '11:30',
    classroomId: updatedClassroom.id
  });
  assert(updatedSession.topic === 'Smoke 更新主题' && updatedSession.date === '2026-08-02', 'admin should update lesson topic, room and time');
  await Api.deleteCourseSession(updatedSession.id);
  await Api.deleteCourse(transferCourse.id);
  await Api.deleteCourse(createdCourse.id);
  await Api.deleteStudent(updatedStudent.id);
  await Api.deleteTeacher(updatedTeacher.id);
  await Api.deleteClassroom(updatedClassroom.id);

  console.log('Smoke test passed.');
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
