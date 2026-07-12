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
    'pages/live-player/live-player',
    'pages/file-preview/file-preview',
    'pages/parent/home/home',
    'pages/parent/courses/courses',
    'pages/parent/exercises/exercises',
    'pages/parent/quiz/quiz',
    'pages/parent/summary/summary',
    'pages/teacher/home/home',
    'pages/teacher/courses/courses',
    'pages/teacher/test-upload/test-upload',
    'pages/teacher/feedback-students/feedback-students',
    'pages/teacher/feedback-detail/feedback-detail',
    'pages/admin/home/home',
    'pages/admin/manage/manage',
    'pages/admin/schedule-board/schedule-board'
  ];
  requiredPages.forEach((page) => {
    assert(appJson.pages.includes(page), `app.json missing page: ${page}`);
  });
  const removedPages = [
    'pages/home/home',
    'pages/schedule/schedule',
    'pages/live/live',
    'pages/exercises/exercises',
    'pages/wrongbook/wrongbook',
    'pages/parent/parent',
    'pages/teacher/teacher',
    'pages/admin/admin',
    'pages/identity-switch/identity-switch',
    'pages/course-detail/course-detail',
    'pages/wrong-record-editor/wrong-record-editor'
  ];
  removedPages.forEach((page) => {
    assert(!appJson.pages.includes(page), `removed pages should not be registered: ${page}`);
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

function assertNoPresentationEmoji() {
  const blockedEmoji = ['🎙️', '📝', '✅', '📄', '📷', '🎬', '👨‍🏫', '👩‍🏫', '👥', '📍', '🕐', '📅', '📖', '📋', '＋', '●', '■'];
  const hits = [];
  walkTextFiles((full, text) => {
    const relative = path.relative(root, full).replace(/\\/g, '/');
    if (!relative.startsWith('pages/') && !relative.startsWith('components/') && !relative.startsWith('custom-tab-bar/')) return;
    if (!['.wxml', '.wxss'].includes(path.extname(relative))) return;
    const found = blockedEmoji.filter((emoji) => text.includes(emoji));
    if (found.length) hits.push(`${relative}: ${found.join(' ')}`);
  });
  assert(hits.length === 0, `presentation emoji found; use local icon assets instead: ${hits.join(', ')}`);
}

function assertNoNestedCards() {
  const hits = [];
  walkTextFiles((full, text) => {
    const relative = path.relative(root, full).replace(/\\/g, '/');
    if (!relative.startsWith('pages/') && !relative.startsWith('components/')) return;
    if (path.extname(relative) !== '.wxml') return;
    const stack = [];
    const tagRe = /<\/?([a-zA-Z0-9-]+)\b[^>]*>/g;
    let match;
    while ((match = tagRe.exec(text))) {
      const tag = match[0];
      const name = match[1];
      if (tag.startsWith('</')) {
        for (let i = stack.length - 1; i >= 0; i -= 1) {
          if (stack[i].name === name) {
            stack.splice(i);
            break;
          }
        }
        continue;
      }
      const className = (tag.match(/class="([^"]*)"/) || [null, ''])[1];
      if (/\bqf-card\b/.test(className)) {
        const parentCard = stack.findLast((item) => /\bqf-card\b/.test(item.className));
        if (parentCard) hits.push(`${relative}: nested qf-card near ${tag.slice(0, 80)}`);
      }
      if (!tag.endsWith('/>') && !['image', 'input'].includes(name)) stack.push({ name, className });
    }
  });
  assert(hits.length === 0, `nested qf-card structures found: ${hits.join(', ')}`);
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
  const apiSource = readText('services/api.js');
  assert(!apiSource.includes('mock 占位') && !apiSource.includes('ClassIn 接口待接入') && !apiSource.includes('adapter 待接入真实服务'), 'service copy should avoid engineering placeholder wording');

  const feedbackTypes = require('../utils/feedback-types');
  assert(feedbackTypes.feedbackTypeText('pre') === '课堂小测学习反馈', 'shared feedback type text should format pre-test feedback');
  assert(feedbackTypes.feedbackTypeText('post') === '本讲总结学习反馈', 'shared feedback type text should format post-test feedback');
  assert(feedbackTypes.feedbackTypeText('general') === '通关确认反馈', 'shared feedback type text should format general feedback as pass confirmation');
  assert(feedbackTypes.feedbackTypeText('unknown') === '本讲总结学习反馈', 'unknown feedback type should keep the existing post-test fallback');
  assert(feedbackTypes.feedbackTypeWrongLabel('general') === '通关确认', 'shared feedback type labels should support teacher pass-confirmation tabs');
  assert(feedbackTypes.feedbackTypeShortLabel('pre') === '课堂小测', 'shared pre feedback short label should use client-facing classroom quiz wording');
  assert(feedbackTypes.feedbackTypeShortLabel('post') === '本讲总结', 'shared post feedback short label should use client-facing lesson summary wording');
  assert(feedbackTypes.feedbackTypeShortLabel('general') === '通关确认', 'shared general feedback short label should describe teacher pass confirmation');

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
  assert(profileWxml.includes('goTeacherCourses') && profileJs.includes('/pages/teacher/courses/courses'), 'profile course cards should route to current teacher course schedule');
  assert(!profileWxml.includes('goCourseDetail') && !profileJs.includes('/pages/course-detail/course-detail'), 'profile should not route to removed course detail page');

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
  assert(adminHomeWxml.includes('cameraStatusText'), 'admin classroom list should display human-readable camera status');

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
  const parentCoursesWxml = readText('pages/parent/courses/courses.wxml');
  assert(parentCoursesWxml.includes('>课堂小测</button>') && parentCoursesWxml.includes('>本讲总结</button>'), 'student schedule actions should use classroom quiz and lesson summary wording');
  assert(!parentCoursesWxml.includes('课前练习') && !parentCoursesWxml.includes('课后巩固'), 'student schedule should not expose legacy pre/post practice wording');
  assert(!readText('pages/parent/home/home.js').includes('/pages/course-detail/course-detail'), 'student home should not keep removed course-detail navigation');
  const parentExercisesJs = readText('pages/parent/exercises/exercises.js');
  assert(parentExercisesJs.includes('courseId && sessionId && type'), 'student wrong-feedback page should support session-scoped pre/post test entries');
  assert(parentExercisesJs.includes('requestedIndex') && parentExercisesJs.includes('item.sessionId === this.data.sessionId'), 'student session-scoped test entry should open the requested lesson instead of defaulting to the latest lesson');
  assert(teacherHomeWxml.includes('/pages/live-player/live-player'), 'teacher home should expose course live entry');
  assert(teacherHomeWxml.includes('/pages/teacher/test-upload/test-upload?courseId=') && teacherHomeWxml.includes('题目资料'), 'teacher course collection should expose lesson question upload entry');
  assert(readText('pages/live-player/live-player.js').includes('query.sessionId'), 'live player should accept teacher-home sessionId links as well as id/courseSessionId links');
  assert(readText('pages/teacher/courses/courses.wxml').includes('current="/pages/teacher/courses/courses"'), 'teacher schedule page tabbar current should point to itself');
  assert(readText('pages/teacher/courses/courses.wxml').includes('bindtap="editSession"') && readText('pages/teacher/courses/courses.wxml').includes('session-editor'), 'teacher schedule should expose lesson rename/topic editor');
  assert(!readText('pages/teacher/courses/courses.wxml').includes('课前错题') && !readText('pages/teacher/courses/courses.wxml').includes('课后错题'), 'teacher schedule should use classroom quiz/summary wording instead of pre/post wrong-question copy');
  assert(readText('pages/admin/home/home.wxml').includes('/pages/live-player/live-player'), 'admin course collection should expose course live entry');
  assert(adminHomeWxml.includes('课次数量') && adminHomeWxml.includes('onSessionCountInput') && adminHomeWxml.includes('onSessionDraftInput') && adminHomeWxml.includes('onSessionClassroomChange'), 'admin course editor should expose editable session count, classroom and time fields');
  assert(adminHomeWxml.includes('通关标准%') && adminHomeWxml.includes('data-field="passThresholdPercent"') && adminHomeJs.includes('passThresholdPercent'), 'admin course editor should expose teacher-defined pass threshold');
  assert(adminHomeJs.includes('syncCourseSessionsForEditor') && adminHomeJs.includes('saveCourseEditor'), 'admin course editor should persist course session count and lesson edits');
  assert(teacherHomeWxml.includes('教师待办') && teacherHomeWxml.includes('confirmPass') === false && teacherHomeWxml.includes('确认通关'), 'teacher home should expose pass-confirmation todo cards');
  assert(readText('pages/teacher/home/home.js').includes('getTeacherTodos') && readText('pages/teacher/home/home.wxss').includes('todo-card'), 'teacher home should load and style teacher todos');
  assert(readText('pages/teacher/feedback-detail/feedback-detail.wxml').includes('pass-quick-card') && readText('pages/teacher/feedback-detail/feedback-detail.js').includes('confirmPassNow'), 'feedback detail should expose fixed pass confirmation action');
  assert(readText('pages/teacher/feedback-detail/feedback-detail.wxml').includes('wrong-question-card') && readText('pages/teacher/feedback-detail/feedback-detail.js').includes('markStudentWrongQuestions'), 'feedback detail should let teachers mark student wrong questions');
  assert(readText('pages/teacher/test-upload/test-upload.wxml').includes('本课题目框') && readText('pages/teacher/test-upload/test-upload.js').includes('createLessonQuestions'), 'teacher upload page should create question slots for wrong workbook');
  const teacherFeedbackStudentsWxml = readText('pages/teacher/feedback-students/feedback-students.wxml');
  const teacherFeedbackStudentsJs = readText('pages/teacher/feedback-students/feedback-students.js');
  const teacherFeedbackDetailJs = readText('pages/teacher/feedback-detail/feedback-detail.js');
  assert(teacherFeedbackStudentsWxml.includes('student-grid') && readText('pages/teacher/feedback-students/feedback-students.wxss').includes('grid-template-columns: repeat(4'), 'teacher student list should use compact avatar grid');
  assert(teacherFeedbackStudentsWxml.includes('student-search-card') && teacherFeedbackStudentsJs.includes('filteredStudents'), 'teacher student list should support searching large class rosters');
  assert(teacherFeedbackStudentsJs.includes('courseSessionId') && teacherFeedbackStudentsJs.includes('&courseSessionId='), 'teacher student list should preserve session context when opening feedback detail');
  assert(teacherFeedbackDetailJs.includes('courseSessionId') && teacherFeedbackDetailJs.includes('activeSessionId: courseSessionId') && teacherFeedbackDetailJs.includes('sessions.some((item) => item.id === requestedSessionId)'), 'teacher feedback detail should honor and validate the session context from todos/course entry');
  assert(readText('pages/parent/home/home.wxml').includes('我的荣誉') && readText('pages/parent/home/home.wxml').includes('home-honor-seal') && readText('pages/parent/home/home.js').includes('getStudentHonors'), 'student home should expose honor certificates with electronic seal');
  const parentSummaryWxml = readText('pages/parent/summary/summary.wxml');
  const parentSummaryJs = readText('pages/parent/summary/summary.js');
  assert(parentSummaryWxml.includes('honor-card') && parentSummaryWxml.includes('honor-seal') && parentSummaryWxml.includes('pass-history-panel') && parentSummaryWxml.includes('feedback-docs'), 'lesson summary should show honors, electronic seals, pass history and feedback documents inline');
  assert(parentSummaryJs.includes('lastFeedbackIndex'), 'lesson summary should open the latest session that actually has feedback');
  assert(parentSummaryJs.includes("(f.feedbackType || 'post') === 'post'"), 'lesson summary should filter post feedback instead of pass confirmations');
  assert(
    parentSummaryWxml.indexOf('class="feedback-images"') < parentSummaryWxml.indexOf('class="feedback-text"')
      && parentSummaryWxml.indexOf('class="feedback-text"') < parentSummaryWxml.indexOf('class="feedback-voices"')
      && parentSummaryWxml.includes('feedback-voice-bar disabled'),
    'lesson summary feedback card should render image, comment and voice state inline in the client-requested order'
  );
  const parentExercisesWxml = readText('pages/parent/exercises/exercises.wxml');
  const parentExercisesWxss = readText('pages/parent/exercises/exercises.wxss');
  assert(parentExercisesWxml.includes('workbook-export-card') && readText('pages/parent/exercises/exercises.js').includes('exportStudentWrongWorkbook'), 'wrong workbook should expose printable PDF export');
  assert(parentExercisesWxml.includes('data-format="docx"') && parentExercisesWxml.includes('导出 Word'), 'wrong workbook should also expose printable Word export');
  assert(parentExercisesWxml.includes('data-scope="course"') && parentExercisesWxml.includes('data-scope="session"'), 'wrong workbook export should expose course and session scoped export actions');
  assert(parentExercisesJs.includes('courseId: this.data.courseId') && parentExercisesJs.includes('courseSessionId: this.data.sessionId'), 'wrong workbook export should pass active course/session filters to the API');
  assert(parentExercisesWxml.includes('record-inline-images') && parentExercisesWxml.includes('record-voice-bar'), 'single-session and all-record wrong feedback should render media inline instead of forcing secondary view buttons');
  assert(parentExercisesWxml.includes('workbook-record-list') && parentExercisesWxml.includes('workbook-question-item'), 'wrong workbook should render aggregated wrong-question records, not only export totals');
  const allRecordsStart = parentExercisesWxml.indexOf("mode === 'allRecords'");
  const workbookExportStart = parentExercisesWxml.indexOf('workbook-export-card', allRecordsStart);
  const allRecordsContentStart = parentExercisesWxml.indexOf('wx:else class="content-area"', allRecordsStart);
  assert(allRecordsStart >= 0 && workbookExportStart > allRecordsContentStart, 'wrong workbook export card should render inside the all-records content area, not in the page header');
  assert(/\.workbook-export-card\s*\{[^}]*flex-wrap:\s*wrap/.test(parentExercisesWxss) && /\.workbook-export-copy\s*\{[^}]*width:\s*100%/.test(parentExercisesWxss), 'wrong workbook export summary should keep its full width when export actions are displayed');
  ['session-preview-count', 'session-entry-badge', 'session-entry-count', 'all-session-count', 'test-session-label', 'workbook-badge'].forEach((className) => {
    const selector = new RegExp(`\\.${className.replace(/-/g, '\\-')}\\s*\\{[^}]*display:\\s*(?:inline-)?flex[^}]*align-items:\\s*center[^}]*justify-content:\\s*center[^}]*min-height:[^}]*line-height:\\s*1`, 's');
    assert(selector.test(parentExercisesWxss), `${className} should vertically center its label text`);
  });
  assert(!/<text[^>]*class="(?:session-preview-count|session-entry-badge|session-entry-count|all-session-count|workbook-badge)/.test(parentExercisesWxml), 'wrong workbook labels should use view elements so vertical flex alignment applies');
  assert(!/<text[^>]*class="meta-status/.test(parentExercisesWxml), 'wrong workbook status dots should use view elements so vertical flex alignment applies');

  const centeredLabelStyles = [
    ['app.wxss', 'qf-tag'],
    ['components/z-status/z-status.wxss', 'status'],
    ['components/z-chip/z-chip.wxss', 'chip'],
    ['pages/teacher/test-upload/test-upload.wxss', 'session-tab-status'],
    ['pages/teacher/feedback-detail/feedback-detail.wxss', 'session-tab-status-dot'],
    ['pages/teacher/feedback-detail/feedback-detail.wxss', 'media-tag'],
    ['pages/profile/profile.wxss', 'avatar-badge'],
    ['pages/admin/home/home.wxss', 'info-chip']
  ];
  centeredLabelStyles.forEach(([file, className]) => {
    const stylesheet = readText(file);
    const selector = new RegExp(`\\.${className.replace(/-/g, '\\-')}\\s*\\{[^}]*display:\\s*(?:inline-)?flex[^}]*align-items:\\s*center[^}]*justify-content:\\s*center[^}]*min-height:[^}]*line-height:\\s*1`, 's');
    assert(selector.test(stylesheet), `${file} .${className} should explicitly center label text on both axes`);
  });

  const loginWxss = readText('pages/login/login.wxss');
  const loginWxml = readText('pages/login/login.wxml');
  assert(loginWxml.includes('<z-bg mode="auth"'), 'login page should keep its own full-screen auth background');
  assert(loginWxml.includes('login-brand-mark') && loginWxml.includes('/assets/images/qufan-applet-icon.png') && !loginWxml.includes('LOGO') && !loginWxml.includes('QF'), 'login page should use the Qufan applet icon instead of a placeholder logo');
  assert(loginWxml.includes('login-card-title') && loginWxml.includes('login-helper'), 'login page should use a formal form card and weak helper copy');
  assert(!loginWxml.includes('login-signal-row') && !loginWxml.includes('演示账号'), 'login page should remove large debug/explainer blocks');
  assert(loginWxml.includes('quick-login-toggle') && loginWxml.includes('快速体验') && loginWxss.includes('quick-login-toggle'), 'login page should keep only a small low-emphasis quick-experience entry');
  assert(loginWxss.includes('animation: none') && loginWxss.includes('opacity: 1'), 'login page should not inherit global page entrance animation');
  assert(!loginWxss.includes('calc(100vh'), 'login page should avoid calc viewport sizing that can collapse in miniapp renderers');
  assertNoOldBrand();
  assertNoDeprecatedMainCopy();
  assertNoPresentationEmoji();
  assertNoNestedCards();

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
  assert(typeof Api.getPassStatistics === 'function', 'pass statistics API missing');
  assert(typeof Api.getFocusStudents === 'function', 'focus students API missing');
  assert(typeof Api.saveStudentAttentionNote === 'function', 'student attention note API missing');
  assert(typeof Api.createLessonQuestions === 'function', 'lesson question upload API missing');
  assert(typeof Api.markStudentWrongQuestions === 'function', 'wrong-question selection API missing');
  assert(typeof Api.deleteLessonQuestion === 'function', 'lesson question deletion API missing');
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

  const uploadedSecondQuestionFile = await Api.uploadFeedbackFile({
    fileName: 'smoke-question-02.pdf',
    size: 4096,
    tempPath: ''
  });
  const secondLessonQuestions = await Api.createLessonQuestions({
    courseId: 'course_bio_001',
    courseSessionId: 'lesson_bio_001_02',
    questions: [
      { title: '遗传规律判断', order: 1, fileId: uploadedSecondQuestionFile.id }
    ]
  });
  await Api.markStudentWrongQuestions({
    studentId: 'stu_001',
    courseId: 'course_bio_001',
    courseSessionId: 'lesson_bio_001_02',
    questionIds: secondLessonQuestions.questions.map((item) => item.id),
    accuracy: 80,
    rankText: '超过班级 60% 同学'
  });

  const lessonDetailAfterWrongSelection = await Api.getTeacherLessonDetail('lesson_bio_001_01');
  assert(lessonDetailAfterWrongSelection.wrongSelections.some((item) => item.studentId === 'stu_001' && item.questionIds.length === 2), 'teacher lesson detail should expose saved wrong-question selections');

  const disposableQuestion = await Api.createLessonQuestions({
    courseId: 'course_bio_001',
    courseSessionId: 'lesson_bio_001_01',
    questions: [{ title: '待删除题目', order: 3 }]
  });
  const disposableQuestionId = disposableQuestion.questions[0].id;
  await Api.markStudentWrongQuestions({
    studentId: 'stu_001',
    courseId: 'course_bio_001',
    courseSessionId: 'lesson_bio_001_01',
    questionIds: lessonQuestions.questions.map((item) => item.id).concat(disposableQuestionId),
    accuracy: 40
  });
  await Api.deleteLessonQuestion({
    courseId: 'course_bio_001',
    courseSessionId: 'lesson_bio_001_01',
    questionId: disposableQuestionId
  });
  const lessonDetailAfterQuestionDeletion = await Api.getTeacherLessonDetail('lesson_bio_001_01');
  const selectionAfterQuestionDeletion = lessonDetailAfterQuestionDeletion.wrongSelections.find((item) => item.studentId === 'stu_001');
  assert(!lessonDetailAfterQuestionDeletion.questions.some((item) => item.id === disposableQuestionId), 'deleted lesson question should not remain in the lesson');
  assert(selectionAfterQuestionDeletion && !selectionAfterQuestionDeletion.questionIds.includes(disposableQuestionId), 'deleted lesson question should be removed from student wrong selections');

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
  const earlyStudentSession = await Api.loginByPhone({ phone: '13800000001' });
  Api.setSession(earlyStudentSession);
  const earlyHonors = await Api.getStudentHonors({ courseId: 'course_bio_001' });
  assert(!earlyHonors.certificates.length && earlyHonors.passHistory.length === 1, 'single lesson pass should create pass history but not issue course certificate before threshold');
  Api.setSession(teacherSession);
  for (const courseSessionId of ['lesson_bio_001_02', 'lesson_bio_001_03', 'lesson_bio_001_04', 'lesson_bio_001_05', 'lesson_bio_001_06', 'lesson_bio_001_07']) {
    const thresholdPass = await Api.confirmStudentPass({
      studentId: 'stu_001',
      courseId: 'course_bio_001',
      courseSessionId,
      passed: true,
      comment: 'Smoke 达成通关标准'
    });
    assert(thresholdPass.passed, 'teacher should confirm enough sessions to reach honor threshold');
  }

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
  assert(workbook.summary.totalWrongQuestions >= 3 && workbook.summary.accuracyText, 'student wrong workbook should expose course totals and accuracy text');
  const sessionWorkbook = await Api.getStudentWrongWorkbook({ courseId: 'course_bio_001', courseSessionId: 'lesson_bio_001_01' });
  assert(sessionWorkbook.summary.totalWrongQuestions === 2 && sessionWorkbook.records.every((item) => item.courseSessionId === 'lesson_bio_001_01'), 'student wrong workbook should support session-scoped filtering');
  const exportedWorkbook = await Api.exportStudentWrongWorkbook({ courseId: 'course_bio_001', format: 'pdf' });
  assert(exportedWorkbook.format === 'pdf' && exportedWorkbook.fileName.endsWith('.pdf') && exportedWorkbook.printable, 'parent should export wrong workbook as a printable single file');
  const exportedSessionWorkbook = await Api.exportStudentWrongWorkbook({ courseId: 'course_bio_001', courseSessionId: 'lesson_bio_001_01', format: 'pdf' });
  assert(exportedSessionWorkbook.workbook.summary.totalWrongQuestions === 2, 'parent should export only the active lesson when a session filter is provided');
  const exportedWordWorkbook = await Api.exportStudentWrongWorkbook({ courseId: 'course_bio_001', format: 'docx' });
  assert(exportedWordWorkbook.format === 'docx' && exportedWordWorkbook.fileName.endsWith('.docx') && exportedWordWorkbook.printable, 'parent should export wrong workbook as a printable Word file');
  const honors = await Api.getStudentHonors({ courseId: 'course_bio_001' });
  assert(honors.certificates.some((item) => item.studentName === '陈一诺' && item.courseName && item.passRate >= item.thresholdPercent), 'student honors should issue named course certificates only after threshold');
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
  ['lesson_bio_001_02', 'lesson_bio_001_03'].forEach((id) => {
    const session = Api.__mockDb.courseSessions.find((item) => item.id === id);
    session.status = 'finished';
    session.statusText = '已结束';
  });
  const passStatistics = await Api.getPassStatistics({ courseId: 'course_bio_001' });
  assert(passStatistics.course.passRate === 50, 'pass statistics should count only completed student-session confirmations');
  assert(passStatistics.course.eligibleStudentSessions === 6 && passStatistics.course.confirmedPasses === 3, 'pass statistics should expose completed-session denominator and confirmed-pass numerator');
  const focusStudents = await Api.getFocusStudents({ courseId: 'course_bio_001' });
  assert(focusStudents.needsAttention.some((item) => item.studentId === 'stu_003' && item.consecutiveUnpassedCount === 3), 'focus students should identify consecutive unfinished passes');
  assert(focusStudents.excellent.some((item) => item.studentId === 'stu_001' && item.passRate === 100), 'focus students should identify sustained high pass rate');
  const savedAttentionNote = await Api.saveStudentAttentionNote({
    studentId: 'stu_003',
    note: '连续未通关，需联系任课老师跟进。',
    status: 'following'
  });
  assert(savedAttentionNote.note === '连续未通关，需联系任课老师跟进。' && savedAttentionNote.status === 'following', 'admin should save a focus-student note');
  const focusStudentsWithNote = await Api.getFocusStudents({ courseId: 'course_bio_001' });
  assert(focusStudentsWithNote.needsAttention.find((item) => item.studentId === 'stu_003').note === '连续未通关，需联系任课老师跟进。', 'focus-student note should persist in the focus list');
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
  const updatedCourse = await Api.updateCourse({ id: createdCourse.id, name: 'Smoke CRUD 课程A', subject: '化学', grade: '初三', teacherId: updatedTeacher.id, classroomId: updatedClassroom.id, passThresholdPercent: 75 });
  assert(updatedCourse.name === 'Smoke CRUD 课程A' && updatedCourse.grade === '初三' && updatedCourse.passThresholdPercent === 75, 'admin should update course and pass threshold');
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
