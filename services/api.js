const config = require('./config');
const db = require('./mock-db');
const FeedbackTypes = require('../utils/feedback-types');

let activeSession = null;

const TODAY = '2026-06-03';
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'heic'];
const VIDEO_EXTS = ['mp4', 'mov', 'm4v', 'webm'];
const VOICE_EXTS = ['m4a', 'mp3', 'aac', 'wav'];
const DOCUMENT_EXTS = ['pdf', 'doc', 'docx'];
const IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const VIDEO_MAX_SIZE = 200 * 1024 * 1024;
const VOICE_MAX_SIZE = 20 * 1024 * 1024;
const DOCUMENT_MAX_SIZE = 50 * 1024 * 1024;

function hasWx() {
  return typeof wx !== 'undefined';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function delay(data, ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(clone(data)), ms || 20);
  });
}

function makeError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  error.details = details || null;
  return error;
}

function nowLabel() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addMonthsLabel(months) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function nextId(prefix, collection) {
  return `${prefix}_${String(collection.length + 1).padStart(3, '0')}_${Date.now()}`;
}

function getExt(fileName) {
  const parts = String(fileName || '').split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function readStoredSession() {
  if (!hasWx()) return null;
  return wx.getStorageSync('session') || null;
}

function writeStoredSession(session) {
  if (!hasWx()) return;
  if (session) {
    wx.setStorageSync('session', session);
  } else {
    wx.removeStorageSync('session');
  }
}

function getSession() {
  return activeSession || readStoredSession();
}

function setSession(session) {
  activeSession = session || null;
  db.currentSessionId = session ? session.id : '';
}

function findPhoneAccount(phone) {
  return db.phoneAccounts.find((item) => item.phone === String(phone || '').trim());
}

function getUserRolesByPhone(phone) {
  const cleanPhone = String(phone || '').trim();
  const roles = ensureCollection('userRoles').filter((item) => item.phone === cleanPhone && item.enabled !== false);
  if (roles.length) return roles;
  return db.phoneAccounts
    .filter((item) => item.phone === cleanPhone)
    .map((item) => ({ ...item, userId: `legacy_user_${item.phone}`, enabled: true }));
}

function findUserRole(roleId) {
  return ensureCollection('userRoles').find((item) => item.id === roleId);
}

function findAdminGrant(roleId) {
  return ensureCollection('adminGrants').find((item) => item.roleId === roleId && item.enabled !== false) || null;
}

function describeRole(role) {
  const labels = { parent: '学生/家长', teacher: '教师', admin: '管理员', researcher: '教研' };
  const grant = role.role === 'admin' ? findAdminGrant(role.id) : null;
  return {
    id: role.id,
    role: role.role,
    linkedId: role.linkedId || '',
    label: labels[role.role] || role.role,
    displayName: role.nickname || '',
    isScopedAdmin: Boolean(grant && !grant.fullAccess),
    gradeScopes: grant ? (grant.gradeScopes || []).slice() : [],
    subjectScopes: grant ? (grant.subjectScopes || []).slice() : []
  };
}

function canAdminAccessScope(session, grade, subject) {
  if (!session || session.role !== 'admin') return false;
  const grant = findAdminGrant(session.identityId);
  if (!grant) return false;
  if (grant.fullAccess) return true;
  const gradeScopes = grant.gradeScopes || [];
  const subjectScopes = grant.subjectScopes || [];
  const gradeAllowed = !gradeScopes.length || gradeScopes.includes(grade);
  const subjectAllowed = !subjectScopes.length || subjectScopes.includes(subject);
  return grant.enabled !== false && gradeAllowed && subjectAllowed;
}

function filterCoursesForAdminScope(session, courses) {
  return courses.filter((course) => canAdminAccessScope(session, course.grade || '', course.subject || ''));
}

function findStudent(id) {
  return db.students.find((item) => item.id === id);
}

function findTeacher(id) {
  return db.teachers.find((item) => item.id === id);
}

function findAdmin(id) {
  return db.admins.find((item) => item.id === id);
}

function findCourse(id) {
  return db.courses.find((item) => item.id === id);
}

function findClass(id) {
  return db.classes.find((item) => item.id === id);
}

function findClassroom(id) {
  return db.classrooms.find((item) => item.id === id);
}

function findCourseSession(id) {
  return db.courseSessions.find((item) => item.id === id);
}

function findMedia(id) {
  return db.mediaFiles.find((item) => item.id === id);
}

function findOptionalFile(id) {
  return db.files.find((item) => item.id === id);
}

function findFeedback(id) {
  return db.lessonFeedbacks.find((item) => item.id === id);
}

function ensureCollection(name) {
  if (!Array.isArray(db[name])) db[name] = [];
  return db[name];
}

function addUnique(list, value) {
  if (!Array.isArray(list) || !value || list.includes(value)) return;
  list.push(value);
}

function removeValue(list, value) {
  if (!Array.isArray(list)) return;
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (list[index] === value) list.splice(index, 1);
  }
}

function attachStudentToCourse(student, course) {
  addUnique(course.studentIds, student.id);
  addUnique(student.courseIds, course.id);
  const classItem = findClass(course.classId);
  if (classItem) addUnique(classItem.studentIds, student.id);
  db.courseSessions.forEach((session) => {
    if (session.courseId === course.id) addUnique(session.studentIds, student.id);
  });
}

function detachStudentFromCourse(student, course) {
  removeValue(course.studentIds, student.id);
  removeValue(student.courseIds, course.id);
  const classItem = findClass(course.classId);
  if (classItem) removeValue(classItem.studentIds, student.id);
  db.courseSessions.forEach((session) => {
    if (session.courseId === course.id) removeValue(session.studentIds, student.id);
  });
}
function removeFromCollection(collection, predicate) {
  let removed = 0;
  for (let index = collection.length - 1; index >= 0; index -= 1) {
    if (predicate(collection[index])) {
      collection.splice(index, 1);
      removed += 1;
    }
  }
  return removed;
}

function normalizeId(input) {
  return typeof input === 'string' ? input : (input && input.id) || '';
}

function syncPhoneAccount(role, linkedId, phone, nickname) {
  const accountRole = role === 'student' ? 'parent' : role;
  const cleanPhone = String(phone || '').trim();
  const account = db.phoneAccounts.find((item) => item.role === accountRole && item.linkedId === linkedId);
  if (!cleanPhone) {
    removeFromCollection(db.phoneAccounts, (item) => item.role === accountRole && item.linkedId === linkedId);
    return null;
  }
  if (account) {
    account.phone = cleanPhone;
    account.nickname = nickname || account.nickname;
    return account;
  }
  const created = {
    id: nextId(`account_${accountRole}`, db.phoneAccounts),
    phone: cleanPhone,
    role: accountRole,
    linkedId,
    nickname: nickname || cleanPhone
  };
  db.phoneAccounts.push(created);
  return created;
}

function removePhoneAccounts(role, linkedId) {
  const accountRole = role === 'student' ? 'parent' : role;
  removeFromCollection(db.phoneAccounts, (item) => item.role === accountRole && item.linkedId === linkedId);
}

function getCourseSessions(courseId) {
  return db.courseSessions
    .filter((item) => item.courseId === courseId)
    .sort((a, b) => a.sessionIndex - b.sessionIndex);
}

function getCourseStudents(courseId) {
  const course = findCourse(courseId);
  if (!course) return [];
  return course.studentIds.map(findStudent).filter(Boolean);
}

function getCourseAssignments(courseId, courseSessionId) {
  return db.assignments
    .filter((item) => item.courseId === courseId && (!courseSessionId || item.courseSessionId === courseSessionId))
    .map(assignmentWithFile);
}

function getFeedbacks(filter = {}) {
  return db.lessonFeedbacks.filter((item) => {
    if (filter.studentId && item.studentId !== filter.studentId) return false;
    if (filter.teacherId && item.teacherId !== filter.teacherId) return false;
    if (filter.courseId && item.courseId !== filter.courseId) return false;
    if (filter.courseSessionId && item.courseSessionId !== filter.courseSessionId) return false;
    if (filter.feedbackType && (item.feedbackType || 'post') !== filter.feedbackType) return false;
    if (filter.visibleToStudent && !item.visibleToStudent) return false;
    return true;
  });
}

function statusTone(status) {
  if (status === 'finished') return 'ok';
  if (status === 'scheduled') return 'warn';
  if (status === 'in_progress') return 'ok';
  return 'muted';
}

function liveTone(status) {
  if (status === 'open') return 'ok';
  if (status === 'offline') return 'danger';
  return 'warn';
}

function cameraStatusText(status) {
  if (status === 'ready') return '可用';
  if (status === 'testing') return '联调中';
  return '待配置';
}

function decorateOptionalFile(file) {
  if (!file) return null;
  const ext = file.ext || getExt(file.name);
  return {
    ...file,
    ext,
    canPreview: DOCUMENT_EXTS.includes(ext),
    canDownload: true,
    downloadable: true,
    previewUrl: file.downloadUrl || file.tempPath || '',
    message: '资料文件可预览，下载地址由教务系统签发。'
  };
}

function assignmentWithFile(item) {
  const file = item.fileId ? findOptionalFile(item.fileId) : null;
  const courseSession = findCourseSession(item.courseSessionId);
  return {
    ...item,
    typeText: item.type === 'pre' ? '课堂小测' : '本讲总结',
    file: decorateOptionalFile(file),
    courseSession: courseSession ? decorateSession(courseSession) : null
  };
}

function questionWithFile(item) {
  const file = item.fileId ? findOptionalFile(item.fileId) : null;
  return {
    ...item,
    file: decorateOptionalFile(file)
  };
}

function decorateMedia(file) {
  if (!file) return null;
  const messageMap = {
    image: '图片反馈可在小程序内查看。',
    video: '视频反馈可在小程序内播放。',
    voice: '语音反馈可在小程序内收听。'
  };
  return {
    ...file,
    canPreview: ['image', 'video', 'voice'].includes(file.type),
    canDownload: false,
    downloadable: false,
    previewUrl: file.url || file.tempPath || '',
    message: messageMap[file.type] || '反馈媒体可在小程序内查看。'
  };
}

function feedbackWithMedia(item) {
  const student = findStudent(item.studentId) || {};
  const teacher = findTeacher(item.teacherId) || {};
  const course = findCourse(item.courseId) || {};
  const courseSession = findCourseSession(item.courseSessionId) || {};
  const feedbackType = item.feedbackType || 'post';
  const imageFiles = (item.imageFileIds || []).map(findMedia).filter(Boolean).map(decorateMedia);
  const videoFiles = (item.videoFileIds || []).map(findMedia).filter(Boolean).map(decorateMedia);
  const voiceFiles = (item.voiceFileIds || []).map(findMedia).filter(Boolean).map(decorateMedia);
  const attachFiles = (item.attachFileIds || []).map(findOptionalFile).filter(Boolean).map(decorateOptionalFile);
  return {
    ...item,
    feedbackType,
    feedbackTypeText: FeedbackTypes.feedbackTypeText(feedbackType),
    studentName: student.name || '',
    teacherName: teacher.name || teacher.fullName || '',
    courseName: course.name || '',
    courseSessionTitle: courseSession.displayTitle || courseSession.title || '',
    imageFiles,
    videoFiles,
    voiceFiles,
    attachFiles,
    mediaFiles: imageFiles.concat(videoFiles, voiceFiles),
    imageCount: imageFiles.length,
    videoCount: videoFiles.length,
    voiceCount: voiceFiles.length,
    attachFileCount: attachFiles.length
  };
}

function decorateSession(item, options = {}) {
  const course = findCourse(item.courseId) || {};
  const teacher = findTeacher(item.teacherId || course.teacherId) || {};
  const classroom = findClassroom(item.classroomId || course.classroomId) || {};
  const studentId = options.studentId || '';
  const feedbacks = getFeedbacks({
    courseId: item.courseId,
    courseSessionId: item.id,
    studentId,
    visibleToStudent: options.visibleToStudent
  });
  const preFeedbackCount = feedbacks.filter((feedback) => (feedback.feedbackType || 'post') === 'pre').length;
  const postFeedbackCount = feedbacks.filter((feedback) => (feedback.feedbackType || 'post') === 'post').length;
  return {
    ...item,
    courseName: course.name || '',
    teacherName: teacher.name || teacher.fullName || '',
    classroomName: classroom.name || '待定教室',
    statusTone: statusTone(item.status),
    feedbackCount: feedbacks.length,
    preFeedbackCount,
    postFeedbackCount,
    liveStatusText: '直播入口已准备',
    liveTone: 'ok'
  };
}

function decorateCourse(item, options = {}) {
  const teacher = findTeacher(item.teacherId) || {};
  const classroom = findClassroom(item.classroomId) || {};
  const sessions = getCourseSessions(item.id).map((session) => decorateSession(session, options));
  const classPassStatistic = buildCoursePassStatistic(item);
  const studentId = options.studentId || '';
  const feedbacks = getFeedbacks({ courseId: item.id, studentId, visibleToStudent: options.visibleToStudent });
  const generalFeedbacks = feedbacks.filter((f) => (f.feedbackType || 'post') === 'general');
  const passedSessionIds = new Set(generalFeedbacks.filter((f) => f.passed).map((f) => f.courseSessionId));
  return {
    ...item,
    teacherName: teacher.name || teacher.fullName || '',
    teacherFullName: teacher.fullName || teacher.name || '',
    classroomName: classroom.name || '待定教室',
    studentCount: item.studentIds.length,
    students: getCourseStudents(item.id),
    sessions,
    recentSession: sessions[0] || null,
    recentSessionTitle: sessions[0] ? sessions[0].displayTitle : '',
    feedbackCount: feedbacks.length,
    feedbackStudentCount: new Set(feedbacks.map((f) => f.studentId)).size,
    passedCount: passedSessionIds.size,
    passThresholdPercent: Number(item.passThresholdPercent || 80),
    passRate: sessions.length ? Math.round((passedSessionIds.size / sessions.length) * 100) : 0,
    classCompletedSessions: classPassStatistic.completedSessions,
    classEligibleStudentSessions: classPassStatistic.eligibleStudentSessions,
    classConfirmedPasses: classPassStatistic.confirmedPasses,
    classPassRate: classPassStatistic.passRate,
    assignments: getCourseAssignments(item.id),
    wrongRecords: [],
    liveStatusText: '直播入口已准备',
    liveTone: 'ok'
  };
}

function canTeacherAccessCourse(session, courseId) {
  const course = findCourse(courseId);
  return Boolean(course && (session.role === 'admin'
    ? canAdminAccessScope(session, course.grade || '', course.subject || '')
    : course.teacherId === session.teacherId));
}

function canStudentAccessCourse(session, courseId) {
  const course = findCourse(courseId);
  return Boolean(course && session.studentId && course.studentIds.includes(session.studentId));
}

function canAccessCourse(session, courseId) {
  if (session.role === 'admin') {
    const course = findCourse(courseId);
    return Boolean(course && canAdminAccessScope(session, course.grade || '', course.subject || ''));
  }
  if (session.role === 'teacher') return canTeacherAccessCourse(session, courseId);
  return canStudentAccessCourse(session, courseId);
}

function canAccessSession(session, courseSessionId) {
  const courseSession = findCourseSession(courseSessionId);
  return Boolean(courseSession && canAccessCourse(session, courseSession.courseId));
}

function canAccessFeedback(session, feedback) {
  if (!feedback) return false;
  if (session.role === 'admin') return canAccessCourse(session, feedback.courseId);
  if (session.role === 'teacher') return feedback.teacherId === session.teacherId;
  return feedback.visibleToStudent && feedback.studentId === session.studentId;
}

function canAccessMedia(session, fileId) {
  const feedback = db.lessonFeedbacks.find((item) => {
    const ids = (item.imageFileIds || []).concat(item.videoFileIds || [], item.voiceFileIds || [], item.attachFileIds || []);
    return ids.includes(fileId);
  });
  if (feedback) return canAccessFeedback(session, feedback);
  const optionalFile = findOptionalFile(fileId);
  if (!optionalFile) return false;
  const assignment = db.assignments.find((item) => item.fileId === optionalFile.id);
  if (assignment) return canAccessCourse(session, assignment.courseId);
  const question = ensureCollection('lessonQuestions').find((item) => item.fileId === optionalFile.id);
  if (question) return canAccessCourse(session, question.courseId);
  return session.role === 'admin';
}

function buildSession(account) {
  const availableRoles = getUserRolesByPhone(account.phone).map(describeRole);
  const base = {
    id: `session_${account.id}_${Date.now()}`,
    accountId: account.id,
    identityId: account.id,
    phone: account.phone,
    role: account.role,
    linkedId: account.linkedId,
    nickname: account.nickname,
    displayName: account.nickname,
    userId: account.userId || '',
    availableRoles,
    loginMode: 'phone',
    authMode: config.authMode,
    createdAt: nowLabel()
  };
  if (account.role === 'teacher') {
    const teacher = findTeacher(account.linkedId);
    return {
      ...base,
      teacherId: account.linkedId,
      displayName: teacher ? teacher.name : account.nickname,
      teacherName: teacher ? teacher.name : account.nickname
    };
  }
  if (account.role === 'admin') {
    const admin = findAdmin(account.linkedId);
    const grant = findAdminGrant(account.id);
    return {
      ...base,
      adminId: account.linkedId,
      displayName: admin ? admin.name : account.nickname,
      adminName: admin ? admin.name : account.nickname,
      isSuperAdmin: Boolean(grant && grant.fullAccess),
      isScopedAdmin: Boolean(grant && !grant.fullAccess),
      gradeScopes: grant ? (grant.gradeScopes || []).slice() : [],
      subjectScopes: grant ? (grant.subjectScopes || []).slice() : []
    };
  }
  const student = findStudent(account.linkedId);
  return {
    ...base,
    role: 'parent',
    studentId: account.linkedId,
    studentIds: [account.linkedId],
    activeChildId: account.linkedId,
    displayName: student ? student.name : account.nickname,
    studentName: student ? student.name : account.nickname
  };
}

function requireSession() {
  const session = getSession();
  if (!session || !session.identityId) throw makeError('NO_SESSION', '请先用报班手机号登录。');
  return session;
}

function requireRole(role) {
  const session = requireSession();
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(session.role)) throw makeError('NO_PERMISSION', '当前账号没有权限。');
  return session;
}

function pushAudit(actorId, action, targetType, targetId, message) {
  db.auditLogs.unshift({
    id: nextId('audit', db.auditLogs),
    actorId,
    action,
    targetType,
    targetId,
    message,
    createdAt: nowLabel()
  });
}

function teacherCourses(session) {
  return db.courses
    .filter((item) => session.role === 'admin' || item.teacherId === session.teacherId)
    .map((item) => decorateCourse(item));
}

function studentCourses(session) {
  return db.courses
    .filter((item) => item.studentIds.includes(session.studentId))
    .map((item) => decorateCourse(item, { studentId: session.studentId, visibleToStudent: true }));
}

function validateMediaUpload(payload, type) {
  const ext = getExt(payload.fileName || payload.name || '');
  const size = Number(payload.size || 0);
  const rules = {
    image: { exts: IMAGE_EXTS, maxSize: IMAGE_MAX_SIZE, message: '仅支持图片格式。', tooLarge: '图片不能超过 10MB。' },
    video: { exts: VIDEO_EXTS, maxSize: VIDEO_MAX_SIZE, message: '仅支持常见视频格式。', tooLarge: '视频不能超过 200MB。' },
    voice: { exts: VOICE_EXTS, maxSize: VOICE_MAX_SIZE, message: '仅支持常见音频格式。', tooLarge: '语音不能超过 20MB。' }
  };
  const rule = rules[type];
  if (!rule) throw makeError('VALIDATION_ERROR', '未知媒体类型。');
  if (!rule.exts.includes(ext)) throw makeError('UNSUPPORTED_FILE_TYPE', rule.message);
  if (size > rule.maxSize) throw makeError('FILE_TOO_LARGE', rule.tooLarge);
  return { ext, size };
}

function mediaPlaceholder(type, payload, session) {
  const validation = validateMediaUpload(payload, type);
  const idPrefix = type === 'image' ? 'media_img' : type === 'video' ? 'media_video' : 'media_voice';
  const defaultName = {
    image: '学习反馈图片.jpg',
    video: '学习反馈视频.mp4',
    voice: '学习反馈语音.m4a'
  };
  const id = nextId(idPrefix, db.mediaFiles);
  const file = {
    id,
    type,
    name: payload.fileName || payload.name || defaultName[type],
    url: '',
    tempPath: payload.tempPath || '',
    storageKey: `feedback/pending/${id}.${validation.ext}`,
    size: validation.size,
    duration: type === 'voice' || type === 'video' ? Number(payload.duration || 0) : undefined,
    createdAt: nowLabel(),
    retentionUntil: addMonthsLabel(6),
    downloadable: false,
    uploadedBy: session.teacherId || session.adminId || session.accountId
  };
  db.mediaFiles.unshift(file);
  return file;
}

function validateDocumentUpload(payload) {
  const ext = getExt(payload.fileName || payload.name || '');
  const size = Number(payload.size || 0);
  if (!DOCUMENT_EXTS.includes(ext)) throw makeError('UNSUPPORTED_FILE_TYPE', '仅支持 PDF / Word 文档。');
  if (size > DOCUMENT_MAX_SIZE) throw makeError('FILE_TOO_LARGE', '文档不能超过 50MB。');
  return { ext, size };
}

function optionalFilePlaceholder(payload, session, ownerType) {
  const validation = validateDocumentUpload(payload);
  const id = nextId('file_optional', db.files);
  const file = {
    id,
    name: payload.fileName || payload.name || `学习资料.${validation.ext}`,
    ext: validation.ext,
    mimeType: payload.mimeType || '',
    size: validation.size,
    ownerType: ownerType || 'feedbackAttachment',
    ownerId: payload.ownerId || '',
    uploadedBy: session.teacherId || session.adminId || session.accountId,
    uploadedAt: nowLabel(),
    fileID: '',
    downloadUrl: payload.downloadUrl || payload.tempPath || '',
    tempPath: payload.tempPath || '',
    placeholder: true,
    optional: true
  };
  db.files.unshift(file);
  return file;
}

function getLessonQuestions(filter = {}) {
  return ensureCollection('lessonQuestions')
    .filter((item) => !filter.courseId || item.courseId === filter.courseId)
    .filter((item) => !filter.courseSessionId || item.courseSessionId === filter.courseSessionId)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(questionWithFile);
}

function getWrongSelections(filter = {}) {
  return ensureCollection('wrongQuestionSelections')
    .filter((item) => !filter.studentId || item.studentId === filter.studentId)
    .filter((item) => !filter.courseId || item.courseId === filter.courseId)
    .filter((item) => !filter.courseSessionId || item.courseSessionId === filter.courseSessionId);
}

function decorateWrongSelection(item) {
  const course = findCourse(item.courseId) || {};
  const courseSession = findCourseSession(item.courseSessionId) || {};
  const questions = getLessonQuestions({ courseId: item.courseId, courseSessionId: item.courseSessionId })
    .filter((question) => item.questionIds.includes(question.id));
  return {
    ...item,
    courseName: course.name || '',
    courseSessionTitle: courseSession.displayTitle || courseSession.sessionTitle || '',
    sessionTopic: courseSession.topic || '',
    questions,
    wrongCount: questions.length,
    accuracyText: item.accuracy !== undefined ? `${item.accuracy}%` : '',
    rankText: item.rankText || ''
  };
}

function buildStudentWrongWorkbook(studentId, filter = {}) {
  const records = getWrongSelections({ studentId, courseId: filter.courseId || '', courseSessionId: filter.courseSessionId || '' })
    .map(decorateWrongSelection)
    .filter((item) => item.questions.length);
  const totalWrongQuestions = records.reduce((sum, item) => sum + item.questions.length, 0);
  const accuracyValues = records.map((item) => Number(item.accuracy)).filter((value) => !Number.isNaN(value));
  const averageAccuracy = accuracyValues.length
    ? Math.round(accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length)
    : null;
  return {
    currentStudent: findStudent(studentId),
    records,
    summary: {
      totalSessions: records.length,
      totalWrongQuestions,
      averageAccuracy,
      accuracyText: averageAccuracy === null ? '待录入' : `${averageAccuracy}%`,
      printable: true
    }
  };
}

function buildStudentHonors(studentId, filter = {}) {
  const student = findStudent(studentId) || {};
  const courses = db.courses.filter((course) => course.studentIds.includes(studentId) && (!filter.courseId || course.id === filter.courseId));
  const certificates = [];
  const passHistory = [];
  courses.forEach((course) => {
    const sessions = getCourseSessions(course.id);
    const sessionCount = sessions.length;
    const thresholdPercent = Number(course.passThresholdPercent || 80);
    const passedFeedbacks = getFeedbacks({ studentId, courseId: course.id, feedbackType: 'general', visibleToStudent: true })
      .filter((feedback) => feedback.passed);
    const passedSessionIds = new Set(passedFeedbacks.map((feedback) => feedback.courseSessionId).filter(Boolean));
    const passedCount = passedSessionIds.size;
    const passRate = sessionCount ? Math.round((passedCount / sessionCount) * 100) : 0;
    passedFeedbacks.forEach((feedback) => {
      const courseSession = findCourseSession(feedback.courseSessionId) || {};
      passHistory.push({
        id: feedback.id,
        courseId: course.id,
        courseName: course.name,
        courseSessionId: feedback.courseSessionId,
        sessionTitle: courseSession.displayTitle || courseSession.sessionTitle || '',
        studentName: student.name || '',
        confirmedAt: feedback.updatedAt || feedback.createdAt || '',
        teacherName: (findTeacher(feedback.teacherId) || {}).name || ''
      });
    });
    if (sessionCount && passRate >= thresholdPercent) {
      const latestFeedback = passedFeedbacks[passedFeedbacks.length - 1] || {};
      certificates.push({
        id: `certificate_${course.id}_${studentId}`,
        studentId,
        studentName: student.name || '',
        courseId: course.id,
        courseName: course.name,
        title: `${course.name} 通关证书`,
        passedCount,
        sessionCount,
        passRate,
        thresholdPercent,
        progressText: `${passedCount}/${sessionCount} 讲已通关 · 达成${thresholdPercent}%标准`,
        sealText: '趣帆学习通关认证',
        issuedAt: latestFeedback.updatedAt || latestFeedback.createdAt || nowLabel()
      });
    }
  });
  return { currentStudent: student, certificates, passHistory };
}

function hasConfirmedPass(studentId, courseId, courseSessionId) {
  return getFeedbacks({
    studentId,
    courseId,
    courseSessionId,
    feedbackType: 'general'
  }).some((feedback) => feedback.passed);
}

function buildCoursePassStatistic(course) {
  const completedSessions = getCourseSessions(course.id).filter((item) => item.status === 'finished');
  let eligibleStudentSessions = 0;
  let confirmedPasses = 0;

  completedSessions.forEach((courseSession) => {
    (courseSession.studentIds || []).forEach((studentId) => {
      eligibleStudentSessions += 1;
      if (hasConfirmedPass(studentId, course.id, courseSession.id)) confirmedPasses += 1;
    });
  });

  return {
    courseId: course.id,
    courseName: course.name,
    grade: course.grade || '',
    subject: course.subject || '',
    teacherId: course.teacherId || '',
    teacherName: (findTeacher(course.teacherId) || {}).name || '',
    completedSessions: completedSessions.length,
    eligibleStudentSessions,
    confirmedPasses,
    passRate: eligibleStudentSessions ? Math.round((confirmedPasses / eligibleStudentSessions) * 100) : 0
  };
}

function buildPassStatisticSummary(courses) {
  const courseStatistics = courses.map(buildCoursePassStatistic);
  const completedSessions = courseStatistics.reduce((sum, item) => sum + item.completedSessions, 0);
  const eligibleStudentSessions = courseStatistics.reduce((sum, item) => sum + item.eligibleStudentSessions, 0);
  const confirmedPasses = courseStatistics.reduce((sum, item) => sum + item.confirmedPasses, 0);
  return {
    completedSessions,
    eligibleStudentSessions,
    confirmedPasses,
    passRate: eligibleStudentSessions ? Math.round((confirmedPasses / eligibleStudentSessions) * 100) : 0,
    courseStatistics
  };
}

function groupPassStatistics(courses, key, label) {
  const grouped = {};
  courses.forEach((course) => {
    const groupKey = String(course[key] || '未分类');
    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push(course);
  });
  return Object.keys(grouped).sort().map((groupKey) => {
    const summary = buildPassStatisticSummary(grouped[groupKey]);
    return {
      [key]: groupKey,
      [label]: groupKey,
      ...summary
    };
  });
}

function findAttentionNote(studentId, courseId) {
  return ensureCollection('studentAttentionNotes').find((item) => item.studentId === studentId && item.courseId === courseId)
    || ensureCollection('studentAttentionNotes').find((item) => item.studentId === studentId && !item.courseId)
    || null;
}

function buildFocusStudentRecords(courses) {
  const rules = db.attentionRules || {};
  const needsAttention = [];
  const excellent = [];

  courses.forEach((course) => {
    const completedSessions = getCourseSessions(course.id).filter((item) => item.status === 'finished');
    if (!completedSessions.length) return;
    const studentIds = Array.from(new Set(completedSessions.flatMap((item) => item.studentIds || [])));
    studentIds.forEach((studentId) => {
      const student = findStudent(studentId);
      if (!student) return;
      const studentSessions = completedSessions.filter((item) => (item.studentIds || []).includes(studentId));
      const confirmedPasses = studentSessions.filter((item) => hasConfirmedPass(studentId, course.id, item.id)).length;
      const passRate = studentSessions.length ? Math.round((confirmedPasses / studentSessions.length) * 100) : 0;
      let consecutiveUnpassedCount = 0;
      for (let index = studentSessions.length - 1; index >= 0; index -= 1) {
        if (hasConfirmedPass(studentId, course.id, studentSessions[index].id)) break;
        consecutiveUnpassedCount += 1;
      }
      const note = findAttentionNote(studentId, course.id);
      const record = {
        id: `focus_${course.id}_${studentId}`,
        studentId,
        studentName: student.name,
        grade: student.grade || course.grade || '',
        courseId: course.id,
        courseName: course.name,
        subject: course.subject || '',
        teacherId: course.teacherId || '',
        teacherName: (findTeacher(course.teacherId) || {}).name || '',
        completedSessions: studentSessions.length,
        confirmedPasses,
        passRate,
        consecutiveUnpassedCount,
        note: note ? note.note : '',
        noteStatus: note ? note.status : 'open',
        noteUpdatedAt: note ? note.updatedAt : ''
      };
      if (consecutiveUnpassedCount >= Number(rules.consecutiveUnpassedThreshold || 2) || passRate < Number(rules.lowPassRateThreshold || 60)) {
        needsAttention.push(record);
      }
      if (studentSessions.length >= Number(rules.excellentCompletedSessionThreshold || 3) && passRate >= Number(rules.excellentPassRateThreshold || 90)) {
        excellent.push(record);
      }
    });
  });

  const compareFocus = (left, right) => right.consecutiveUnpassedCount - left.consecutiveUnpassedCount || left.passRate - right.passRate || left.studentName.localeCompare(right.studentName);
  return {
    needsAttention: needsAttention.sort(compareFocus),
    excellent: excellent.sort((left, right) => right.passRate - left.passRate || right.completedSessions - left.completedSessions || left.studentName.localeCompare(right.studentName))
  };
}
function classInEntryForSession(courseId, courseSessionId) {
  const course = findCourse(courseId) || {};
  const courseSession = findCourseSession(courseSessionId) || {};
  const classroom = findClassroom(courseSession.classroomId || course.classroomId) || {};
  const liveRoom = db.liveRooms.find((item) => item.courseSessionId === courseSessionId)
    || db.liveRooms.find((item) => item.classroomId === classroom.id)
    || {};
  return {
    status: liveRoom.status || 'ready',
    provider: 'classin',
    message: liveRoom.message || '课堂入口已准备。',
    classinEntryUrl: liveRoom.classinEntryUrl || 'https://www.classin.com/',
    streamUrl: liveRoom.streamUrl || '',
    previewVideoUrl: liveRoom.previewVideoUrl || '',
    playerType: 'classin-webview-or-live-player',
    signedAt: liveRoom.signedAt || nowLabel(),
    expiresAt: liveRoom.expiresAt || addMonthsLabel(1),
    roomName: classroom.name || '',
    courseName: course.name || '',
    lessonTitle: courseSession.displayTitle || courseSession.title || '',
    startTime: courseSession.startTime || '',
    endTime: courseSession.endTime || '',
    requiredServerFields: ['classinEntryUrl', 'streamUrl', 'signedAt', 'expiresAt'],
    courseId,
    courseSessionId
  };
}

function checkScheduleConflictsRaw(payload = {}) {
  const normalized = {
    courseId: payload.courseId || '',
    teacherId: payload.teacherId || '',
    classroomId: payload.classroomId || '',
    date: payload.date || '',
    startTime: payload.startTime || '',
    endTime: payload.endTime || ''
  };
  const conflicts = [];
  db.courseSessions.forEach((item) => {
    if (item.id === payload.id || item.date !== normalized.date) return;
    const overlap = normalized.startTime < item.endTime && normalized.endTime > item.startTime;
    if (!overlap) return;
    if (normalized.teacherId && item.teacherId === normalized.teacherId) conflicts.push({ type: 'teacher', session: decorateSession(item) });
    if (normalized.classroomId && item.classroomId === normalized.classroomId) conflicts.push({ type: 'classroom', session: decorateSession(item) });
    if (normalized.courseId && item.courseId === normalized.courseId) conflicts.push({ type: 'course', session: decorateSession(item) });
  });
  return { hasConflict: conflicts.length > 0, conflicts };
}

const mockApi = {
  loginByPhone(payload = {}) {
    const phone = String(payload.phone || '').trim();
    const roles = getUserRolesByPhone(phone);
    const account = payload.roleId ? roles.find((item) => item.id === payload.roleId) : roles[0];
    if (!account) throw makeError('ACCOUNT_NOT_FOUND', '手机号未匹配到老师、学生或管理员档案。');
    const session = buildSession(account);
    db.sessions[session.id] = session;
    setSession(session);
    writeStoredSession(session);
    return delay(session);
  },

  getAvailableRoles(payload = {}) {
    const phone = String(payload.phone || '').trim();
    const roles = getUserRolesByPhone(phone);
    if (!roles.length) throw makeError('ACCOUNT_NOT_FOUND', '手机号未匹配到可用身份。');
    const user = ensureCollection('users').find((item) => item.id === roles[0].userId) || {};
    return delay({
      phone,
      user: { id: user.id || '', displayName: user.displayName || roles[0].nickname || '', avatarUrl: user.avatarUrl || '' },
      roles: roles.map(describeRole)
    });
  },

  selectActiveRole(payload = {}) {
    const current = requireSession();
    const role = getUserRolesByPhone(current.phone).find((item) => item.id === payload.roleId);
    if (!role) throw makeError('NO_PERMISSION', '当前手机号不能切换到该身份。');
    const session = buildSession(role);
    db.sessions[session.id] = session;
    setSession(session);
    writeStoredSession(session);
    return delay(session);
  },

  logout() {
    setSession(null);
    writeStoredSession(null);
    return delay({ ok: true });
  },

  getCurrentSession() {
    return delay(getSession());
  },

  getCurrentUserProfile() {
    const session = requireSession();
    if (session.role === 'teacher') return delay({ session, profile: findTeacher(session.teacherId) });
    if (session.role === 'admin') return delay({ session, profile: findAdmin(session.adminId) });
    return delay({ session, profile: findStudent(session.studentId) });
  },

  getTeacherDashboard() {
    const session = requireRole(['teacher', 'admin']);
    const courses = teacherCourses(session);
    const courseIds = courses.map((item) => item.id);
    const sessions = db.courseSessions.filter((item) => courseIds.includes(item.courseId));
    const todayCourses = sessions.filter((item) => item.date === TODAY).map(decorateSession);
    const pendingFeedbackSessions = sessions
      .filter((item) => ['finished', 'in_progress'].includes(item.status))
      .map((item) => {
        const decorated = decorateSession(item);
        decorated.expectedFeedbackCount = item.studentIds.length;
        return decorated;
      })
      .filter((item) => item.feedbackCount < item.expectedFeedbackCount);
    const recentFeedbacks = getFeedbacks({ teacherId: session.teacherId }).map(feedbackWithMedia).slice(0, 5);
    const teacher = findTeacher(session.teacherId) || {};
    return delay({
      teacher,
      teacherName: teacher.name || session.displayName,
      metrics: [
        { label: '我的课程', value: courses.length },
        { label: '名下学生', value: new Set(courses.flatMap((item) => item.studentIds)).size },
        { label: '今日课程', value: todayCourses.length },
        { label: '已上传反馈', value: getFeedbacks({ teacherId: session.teacherId }).length }
      ],
      todayCourses,
      pendingFeedbackSessions,
      recentFeedbacks,
      courseGroups: courses,
      courses
    });
  },

  getTeacherCourses() {
    const session = requireRole(['teacher', 'admin']);
    const teacher = findTeacher(session.teacherId) || {};
    const courses = teacherCourses(session);
    return delay({ teacher, courses, courseGroups: courses });
  },

  getTeacherCourseDetail(courseId) {
    const session = requireRole(['teacher', 'admin']);
    const course = findCourse(courseId);
    if (!course) throw makeError('NOT_FOUND', '课程不存在。');
    if (!canTeacherAccessCourse(session, courseId)) throw makeError('NO_PERMISSION', '当前老师不能查看这门课程。');
    const decoratedCourse = decorateCourse(course);
    return delay({
      mode: 'course',
      course: decoratedCourse,
      students: getCourseStudents(courseId),
      sessions: decoratedCourse.sessions,
      assignments: getCourseAssignments(courseId),
      lessonFeedbacks: getFeedbacks({ courseId }).map(feedbackWithMedia),
      wrongRecords: []
    });
  },

  getTeacherLessonDetail(courseSessionId) {
    const session = requireRole(['teacher', 'admin']);
    const courseSession = findCourseSession(courseSessionId);
    if (!courseSession) throw makeError('NOT_FOUND', '课次不存在。');
    if (!canTeacherAccessCourse(session, courseSession.courseId)) throw makeError('NO_PERMISSION', '当前老师不能查看这个课次。');
    const course = findCourse(courseSession.courseId);
    const feedbacks = getFeedbacks({ courseSessionId }).map(feedbackWithMedia);
    const students = getCourseStudents(courseSession.courseId).map((student) => {
      const studentFeedbacks = feedbacks.filter((item) => item.studentId === student.id);
      return {
        ...student,
        feedbackCount: studentFeedbacks.length,
        latestFeedback: studentFeedbacks[0] || null
      };
    });
    return delay({
      mode: 'session',
      course: decorateCourse(course),
      courseSession: decorateSession(courseSession),
      students,
      assignments: getCourseAssignments(courseSession.courseId, courseSession.id),
      questions: getLessonQuestions({ courseId: courseSession.courseId, courseSessionId: courseSession.id }),
      wrongSelections: getWrongSelections({ courseId: courseSession.courseId, courseSessionId: courseSession.id }).map(decorateWrongSelection),
      lessonFeedbacks: feedbacks,
      feedbacks,
      wrongRecords: []
    });
  },

  getTeacherStudentsByCourse(courseId) {
    const session = requireRole(['teacher', 'admin']);
    if (!canTeacherAccessCourse(session, courseId)) throw makeError('NO_PERMISSION', '当前老师不能查看这门课程的学生。');
    return delay(getCourseStudents(courseId));
  },

  createLessonFeedback(payload = {}) {
    const session = requireRole(['teacher', 'admin']);
    const course = findCourse(payload.courseId);
    const courseSession = findCourseSession(payload.courseSessionId);
    const student = findStudent(payload.studentId);
    if (!course || !courseSession || !student) throw makeError('VALIDATION_ERROR', '课程、课次或学生不存在。');
    if (courseSession.courseId !== course.id) throw makeError('VALIDATION_ERROR', '课次不属于当前课程。');
    if (!course.studentIds.includes(student.id)) throw makeError('NO_PERMISSION', '学生不在当前课程中。');
    const teacherId = payload.teacherId || session.teacherId;
    if (session.role === 'teacher' && (course.teacherId !== session.teacherId || teacherId !== session.teacherId)) {
      throw makeError('NO_PERMISSION', '老师只能给自己课程下的学生创建反馈。');
    }
    const imageFileIds = payload.imageFileIds || [];
    const videoFileIds = payload.videoFileIds || [];
    const voiceFileIds = payload.voiceFileIds || [];
    const attachFileIds = payload.attachFileIds || [];
    const feedbackType = FeedbackTypes.normalizeFeedbackType(payload.feedbackType);
    imageFileIds.forEach((id) => {
      const file = findMedia(id);
      if (!file || file.type !== 'image') throw makeError('VALIDATION_ERROR', '图片媒体不存在。');
    });
    videoFileIds.forEach((id) => {
      const file = findMedia(id);
      if (!file || file.type !== 'video') throw makeError('VALIDATION_ERROR', '视频媒体不存在。');
    });
    voiceFileIds.forEach((id) => {
      const file = findMedia(id);
      if (!file || file.type !== 'voice') throw makeError('VALIDATION_ERROR', '语音媒体不存在。');
    });
    attachFileIds.forEach((id) => {
      const file = findOptionalFile(id);
      if (!file) throw makeError('VALIDATION_ERROR', '附件文件不存在。');
    });
    if (!String(payload.text || '').trim() && !imageFileIds.length && !videoFileIds.length && !voiceFileIds.length && !attachFileIds.length) {
      throw makeError('VALIDATION_ERROR', '请填写文字反馈或添加图片/视频/语音。');
    }

    const existing = db.lessonFeedbacks.find((item) =>
      item.studentId === student.id
      && item.courseId === course.id
      && item.courseSessionId === courseSession.id
      && (item.feedbackType || 'post') === feedbackType
    );
    const timestamp = nowLabel();
    const nextFields = {
      studentId: student.id,
      teacherId,
      courseId: course.id,
      courseSessionId: courseSession.id,
      feedbackType,
      text: String(payload.text || '').trim(),
      imageFileIds: Array.isArray(payload.imageFileIds) ? imageFileIds.slice() : null,
      videoFileIds: Array.isArray(payload.videoFileIds) ? videoFileIds.slice() : null,
      voiceFileIds: Array.isArray(payload.voiceFileIds) ? voiceFileIds.slice() : null,
      attachFileIds: Array.isArray(payload.attachFileIds) ? attachFileIds.slice() : null,
      visibleToStudent: payload.visibleToStudent !== false
    };

    let record;
    if (existing) {
      existing.editHistory = existing.editHistory || [];
      existing.editHistory.push({
        editedAt: existing.updatedAt || existing.createdAt || timestamp,
        teacherId: existing.teacherId,
        text: existing.text || '',
        imageFileIds: (existing.imageFileIds || []).slice(),
        videoFileIds: (existing.videoFileIds || []).slice(),
        voiceFileIds: (existing.voiceFileIds || []).slice(),
        attachFileIds: (existing.attachFileIds || []).slice(),
        passed: !!existing.passed
      });
      Object.assign(existing, nextFields, {
        imageFileIds: nextFields.imageFileIds || (existing.imageFileIds || []).slice(),
        videoFileIds: nextFields.videoFileIds || (existing.videoFileIds || []).slice(),
        voiceFileIds: nextFields.voiceFileIds || (existing.voiceFileIds || []).slice(),
        attachFileIds: nextFields.attachFileIds || (existing.attachFileIds || []).slice(),
        passed: payload.passed !== undefined ? !!payload.passed : !!existing.passed,
        updatedAt: timestamp,
        editCount: existing.editHistory.length + 1
      });
      record = existing;
      pushAudit(session.identityId, 'update_lesson_feedback', 'lessonFeedback', record.id, `更新 ${student.name} 的${FeedbackTypes.feedbackTypeText(feedbackType)}`);
    } else {
      record = {
        id: nextId('feedback', db.lessonFeedbacks),
        ...nextFields,
        imageFileIds: nextFields.imageFileIds || [],
        videoFileIds: nextFields.videoFileIds || [],
        voiceFileIds: nextFields.voiceFileIds || [],
        attachFileIds: nextFields.attachFileIds || [],
        passed: !!payload.passed,
        createdAt: timestamp,
        updatedAt: timestamp,
        editHistory: [],
        editCount: 1
      };
      db.lessonFeedbacks.unshift(record);
      pushAudit(session.identityId, 'create_lesson_feedback', 'lessonFeedback', record.id, `为 ${student.name} 保存${FeedbackTypes.feedbackTypeText(feedbackType)}`);
    }
    return delay(feedbackWithMedia(record));
  },

  uploadFeedbackFile(payload = {}) {
    const session = requireRole(['teacher', 'admin']);
    const file = optionalFilePlaceholder(payload, session, 'feedbackAttachment');
    return delay(decorateOptionalFile(file));
  },

  uploadFeedbackImage(payload = {}) {
    const session = requireRole(['teacher', 'admin']);
    return delay(decorateMedia(mediaPlaceholder('image', payload, session)));
  },

  uploadFeedbackVideo(payload = {}) {
    const session = requireRole(['teacher', 'admin']);
    return delay(decorateMedia(mediaPlaceholder('video', payload, session)));
  },

  uploadFeedbackVoice(payload = {}) {
    const session = requireRole(['teacher', 'admin']);
    return delay(decorateMedia(mediaPlaceholder('voice', payload, session)));
  },

  getStudentDashboard() {
    const session = requireRole('parent');
    const student = findStudent(session.studentId);
    const courses = studentCourses(session);
    const todayCourses = db.courseSessions
      .filter((item) => item.date === TODAY && courses.some((course) => course.id === item.courseId))
      .map((item) => decorateSession(item, { studentId: session.studentId, visibleToStudent: true }));
    const recentFeedbacks = getFeedbacks({ studentId: session.studentId, visibleToStudent: true }).map(feedbackWithMedia).slice(0, 6);
    return delay({
      currentStudent: student,
      currentChild: student,
      children: student ? [{ ...student, displayLabel: `${student.name} · ${student.grade}` }] : [],
      metrics: [
        { label: '我的课程', value: courses.length },
        { label: '今日课程', value: todayCourses.length },
        { label: '老师反馈', value: recentFeedbacks.length },
        { label: '直播入口', value: '预留' }
      ],
      courses,
      courseGroups: courses,
      todayCourses,
      recentFeedbacks,
      pendingAssignments: [],
      pendingWrongRecords: []
    });
  },

  getStudentCourses() {
    const session = requireRole('parent');
    const student = findStudent(session.studentId);
    const courses = studentCourses(session);
    return delay({ currentStudent: student, currentChild: student, courses, courseGroups: courses });
  },

  getStudentCourseDetail(courseId) {
    const session = requireRole('parent');
    const course = findCourse(courseId);
    if (!course) throw makeError('NOT_FOUND', '课程不存在。');
    if (!canStudentAccessCourse(session, courseId)) throw makeError('NO_PERMISSION', '当前手机号不能查看这门课程。');
    const decoratedCourse = decorateCourse(course, { studentId: session.studentId, visibleToStudent: true });
    return delay({
      mode: 'course',
      course: decoratedCourse,
      currentStudent: findStudent(session.studentId),
      students: [findStudent(session.studentId)].filter(Boolean),
      sessions: decoratedCourse.sessions,
      assignments: getCourseAssignments(courseId),
      lessonFeedbacks: getFeedbacks({ studentId: session.studentId, courseId, visibleToStudent: true }).map(feedbackWithMedia),
      wrongRecords: []
    });
  },

  getStudentLessonFeedbacks(payload = {}) {
    const session = requireRole('parent');
    const feedbacks = getFeedbacks({
      studentId: session.studentId,
      courseId: payload.courseId || '',
      courseSessionId: payload.courseSessionId || '',
      feedbackType: payload.feedbackType || '',
      visibleToStudent: true
    }).map(feedbackWithMedia);
    return delay({
      currentStudent: findStudent(session.studentId),
      feedbacks
    });
  },

  getFeedbackDetail(feedbackId) {
    const session = requireSession();
    const feedback = findFeedback(feedbackId);
    if (!feedback) throw makeError('NOT_FOUND', '反馈不存在。');
    if (!canAccessFeedback(session, feedback)) throw makeError('NO_PERMISSION', '当前账号不能查看这条反馈。');
    return delay(feedbackWithMedia(feedback));
  },

  getMediaPreview(fileId) {
    const session = requireSession();
    const media = findMedia(fileId);
    if (media) {
      if (!canAccessMedia(session, fileId)) throw makeError('NO_PERMISSION', '当前账号不能查看该媒体。');
      const decorated = decorateMedia(media);
      return delay({
        kind: media.type,
        file: decorated,
        message: decorated.message,
        canPreview: true,
        canDownload: false,
        downloadable: false
      });
    }
    const optionalFile = findOptionalFile(fileId);
    if (!optionalFile) throw makeError('NOT_FOUND', '文件不存在。');
    if (!canAccessMedia(session, fileId)) throw makeError('NO_PERMISSION', '当前账号不能查看该文件。');
    return delay({
      kind: 'optionalFile',
      file: optionalFile,
      message: '资料文件可预览，下载地址由教务系统签发。',
      canPreview: ['pdf', 'doc', 'docx'].includes(optionalFile.ext),
      canDownload: true,
      downloadable: true,
      placeholderStatus: optionalFile.fileID ? 'ready' : 'not_connected'
    });
  },

  downloadFeedbackImage(fileId) {
    const session = requireSession();
    const media = findMedia(fileId);
    if (!media || media.type !== 'image') throw makeError('VALIDATION_ERROR', '只能下载图片反馈。');
    if (!canAccessMedia(session, fileId)) throw makeError('NO_PERMISSION', '当前账号不能下载该图片。');
    return delay({
      status: media.url ? 'ready' : 'pending',
      file: decorateMedia(media),
      downloadUrl: media.url || '',
      message: media.url ? '图片下载地址已生成。' : '图片下载地址暂未生成，请联系教务开启下载权限。'
    });
  },

  playFeedbackVoice(fileId) {
    const session = requireSession();
    const media = findMedia(fileId);
    if (!media || media.type !== 'voice') throw makeError('VALIDATION_ERROR', '只能播放语音反馈。');
    if (!canAccessMedia(session, fileId)) throw makeError('NO_PERMISSION', '当前账号不能播放该语音。');
    return delay({
      status: media.url || media.tempPath ? 'ready' : 'pending',
      file: decorateMedia(media),
      playUrl: media.url || media.tempPath || '',
      downloadable: false,
      message: media.url || media.tempPath ? '语音播放地址已生成。' : '语音播放地址暂未生成，请稍后重试或联系教务。'
    });
  },

  getAdminOverview() {
    const session = requireRole('admin');
    const courses = filterCoursesForAdminScope(session, db.courses);
    const scopedStudentIds = new Set(courses.flatMap((course) => course.studentIds || []));
    const scopedTeacherIds = new Set(courses.map((course) => course.teacherId));
    const relationOverview = courses.map((course) => {
      const decorated = decorateCourse(course);
      return {
        courseId: course.id,
        courseName: course.name,
        grade: course.grade || '',
        subject: course.subject || '',
        teacherName: decorated.teacherName,
        classroomName: decorated.classroomName,
        studentCount: course.studentIds.length,
        phoneAccountCount: course.studentIds
          .map((studentId) => db.phoneAccounts.find((account) => account.linkedId === studentId))
          .filter(Boolean).length,
        feedbackCount: getFeedbacks({ courseId: course.id }).length,
        recentOrNextSession: decorated.sessions[0] || null,
        liveStatusText: '直播入口已准备',
        liveTone: 'ok'
      };
    });
    const todaySessions = db.courseSessions
      .filter((item) => item.date === TODAY)
      .filter((item) => canAdminAccessScope(session, (findCourse(item.courseId) || {}).grade || '', (findCourse(item.courseId) || {}).subject || ''))
      .map(decorateSession);
    return delay({
      metrics: [
        { label: '老师数', value: scopedTeacherIds.size },
        { label: '学生数', value: scopedStudentIds.size },
        { label: '课程数', value: courses.length },
        { label: '反馈数', value: db.lessonFeedbacks.filter((item) => canAccessFeedback(session, item)).length },
        { label: '手机号映射', value: db.phoneAccounts.filter((item) => scopedStudentIds.has(item.linkedId) || scopedTeacherIds.has(item.linkedId)).length }
      ],
      relationOverview,
      todaySessions,
      liveRooms: [],
      recentFeedbacks: db.lessonFeedbacks.filter((item) => canAccessFeedback(session, item)).slice(0, 6).map(feedbackWithMedia),
      recentAuditLogs: session.isSuperAdmin ? db.auditLogs.slice(0, 6) : []
    });
  },

  getAdminDashboard(payload = {}) {
    const session = requireRole('admin');
    const courses = filterCoursesForAdminScope(session, db.courses)
      .filter((course) => !payload.grade || course.grade === payload.grade)
      .filter((course) => !payload.subject || course.subject === payload.subject)
      .filter((course) => !payload.teacherId || course.teacherId === payload.teacherId);
    const summary = buildPassStatisticSummary(courses);
    const focusStudents = buildFocusStudentRecords(courses);
    return delay({
      scope: {
        grade: payload.grade || '',
        subject: payload.subject || '',
        teacherId: payload.teacherId || '',
        isSuperAdmin: !!session.isSuperAdmin,
        gradeScopes: (session.gradeScopes || []).slice(),
        subjectScopes: (session.subjectScopes || []).slice()
      },
      summary: {
        courseCount: courses.length,
        completedSessions: summary.completedSessions,
        eligibleStudentSessions: summary.eligibleStudentSessions,
        confirmedPasses: summary.confirmedPasses,
        passRate: summary.passRate
      },
      gradeStatistics: groupPassStatistics(courses, 'grade', 'gradeName'),
      subjectStatistics: groupPassStatistics(courses, 'subject', 'subjectName'),
      teacherStatistics: groupPassStatistics(courses, 'teacherId', 'teacherName').map((item) => ({
        ...item,
        teacherName: (findTeacher(item.teacherId) || {}).name || item.teacherId
      })),
      focusStudents,
      attentionRules: clone(db.attentionRules || {})
    });
  },

  getPassStatistics(payload = {}) {
    const session = requireRole('admin');
    const courses = filterCoursesForAdminScope(session, db.courses)
      .filter((course) => !payload.courseId || course.id === payload.courseId)
      .filter((course) => !payload.grade || course.grade === payload.grade)
      .filter((course) => !payload.subject || course.subject === payload.subject)
      .filter((course) => !payload.teacherId || course.teacherId === payload.teacherId);
    const summary = buildPassStatisticSummary(courses);
    return delay({
      scope: {
        courseId: payload.courseId || '',
        grade: payload.grade || '',
        subject: payload.subject || '',
        teacherId: payload.teacherId || ''
      },
      course: payload.courseId ? summary.courseStatistics[0] || null : null,
      courses: summary.courseStatistics,
      completedSessions: summary.completedSessions,
      eligibleStudentSessions: summary.eligibleStudentSessions,
      confirmedPasses: summary.confirmedPasses,
      passRate: summary.passRate,
      gradeStatistics: groupPassStatistics(courses, 'grade', 'gradeName'),
      subjectStatistics: groupPassStatistics(courses, 'subject', 'subjectName'),
      teacherStatistics: groupPassStatistics(courses, 'teacherId', 'teacherName').map((item) => ({
        ...item,
        teacherName: (findTeacher(item.teacherId) || {}).name || item.teacherId
      }))
    });
  },

  getFocusStudents(payload = {}) {
    const session = requireRole('admin');
    const courses = filterCoursesForAdminScope(session, db.courses)
      .filter((course) => !payload.courseId || course.id === payload.courseId)
      .filter((course) => !payload.grade || course.grade === payload.grade)
      .filter((course) => !payload.subject || course.subject === payload.subject)
      .filter((course) => !payload.teacherId || course.teacherId === payload.teacherId);
    return delay({
      rules: clone(db.attentionRules || {}),
      ...buildFocusStudentRecords(courses)
    });
  },

  saveStudentAttentionNote(payload = {}) {
    const session = requireRole('admin');
    const student = findStudent(payload.studentId);
    if (!student) throw makeError('NOT_FOUND', '学生不存在。');
    const courseId = payload.courseId || '';
    const course = courseId ? findCourse(courseId) : null;
    if (courseId && !course) throw makeError('NOT_FOUND', '课程不存在。');
    if (course && !canAdminAccessScope(session, course.grade || '', course.subject || '')) throw makeError('NO_PERMISSION', '当前管理员不能编辑该课程的重点关注备注。');
    const note = String(payload.note || '').trim();
    const status = ['open', 'following', 'resolved'].includes(payload.status) ? payload.status : 'open';
    const store = ensureCollection('studentAttentionNotes');
    let record = store.find((item) => item.studentId === student.id && item.courseId === courseId);
    if (!record) {
      record = {
        id: nextId('attention_note', store),
        studentId: student.id,
        courseId,
        createdAt: nowLabel(),
        createdBy: session.identityId
      };
      store.unshift(record);
    }
    Object.assign(record, {
      note,
      status,
      updatedAt: nowLabel(),
      updatedBy: session.identityId
    });
    pushAudit(session.identityId, 'save_student_attention_note', 'studentAttentionNote', record.id, `更新 ${student.name} 的重点关注备注`);
    return delay(record);
  },

  getAdminGrants() {
    const session = requireRole('admin');
    if (!session.isSuperAdmin) throw makeError('NO_PERMISSION', '只有超级管理员可以查看管理员授权。');
    return delay(ensureCollection('adminGrants').map((grant) => {
      const role = findUserRole(grant.roleId) || {};
      const user = ensureCollection('users').find((item) => item.id === role.userId) || {};
      return {
        ...grant,
        phone: role.phone || user.phone || '',
        displayName: user.displayName || role.nickname || '',
        role: role.role || 'admin'
      };
    }));
  },

  saveAdminGrant(payload = {}) {
    const session = requireRole('admin');
    if (!session.isSuperAdmin) throw makeError('NO_PERMISSION', '只有超级管理员可以修改管理员授权。');
    const role = findUserRole(payload.roleId);
    if (!role || role.role !== 'admin') throw makeError('VALIDATION_ERROR', '请选择有效的管理员身份。');
    const store = ensureCollection('adminGrants');
    let grant = store.find((item) => item.roleId === role.id);
    if (!grant) {
      grant = {
        id: nextId('admin_grant', store),
        roleId: role.id,
        createdAt: nowLabel()
      };
      store.unshift(grant);
    }
    const fullAccess = payload.fullAccess === true;
    Object.assign(grant, {
      gradeScopes: Array.from(new Set((payload.gradeScopes || []).filter(Boolean))),
      subjectScopes: Array.from(new Set((payload.subjectScopes || []).filter(Boolean))),
      fullAccess,
      enabled: payload.enabled !== false,
      updatedAt: nowLabel(),
      updatedBy: session.identityId
    });
    pushAudit(session.identityId, 'save_admin_grant', 'adminGrant', grant.id, `更新 ${role.phone} 的管理员授权`);
    return delay(grant);
  },

  getAdminCourseTree() {
    const session = requireRole('admin');
    return delay(filterCoursesForAdminScope(session, db.courses).map((course) => ({
      ...decorateCourse(course),
      sessions: getCourseSessions(course.id).map((session) => ({
        ...decorateSession(session),
        feedbackCount: getFeedbacks({ courseSessionId: session.id }).length,
        students: getCourseStudents(course.id).map((student) => ({
          ...student,
          feedbackCount: getFeedbacks({ courseSessionId: session.id, studentId: student.id }).length,
          feedbacks: getFeedbacks({ courseSessionId: session.id, studentId: student.id }).map(feedbackWithMedia)
        })),
        assignments: getCourseAssignments(course.id, session.id)
      }))
    })));
  },

  getAdminTeacherRelations() {
    const session = requireRole('admin');
    const scopedCourses = filterCoursesForAdminScope(session, db.courses);
    return delay(db.teachers.map((teacher) => {
      const courses = scopedCourses.filter((course) => course.teacherId === teacher.id);
      if (!courses.length) return null;
      return {
        ...teacher,
        displayName: teacher.name,
        courseNames: courses.map((course) => course.name),
        courses: courses.map((course) => ({
          id: course.id,
          name: course.name,
          grade: course.grade || '',
          subject: course.subject || '',
          studentCount: course.studentIds.length,
          students: getCourseStudents(course.id),
          studentsText: getCourseStudents(course.id).map((student) => student.name).join('、') || '暂无学生'
        }))
      };
    }).filter(Boolean));
  },

  getAdminStudentRelations() {
    const session = requireRole('admin');
    const scopedCourses = filterCoursesForAdminScope(session, db.courses);
    return delay(db.students.map((student) => {
      const courses = scopedCourses.filter((course) => course.studentIds.includes(student.id));
      if (!courses.length) return null;
      const account = db.phoneAccounts.find((item) => item.linkedId === student.id);
      return {
        ...student,
        loginPhone: account ? account.phone : student.phone,
        courseNames: courses.map((course) => course.name),
        courses: courses.map((course) => ({
          id: course.id,
          name: course.name,
          grade: course.grade || '',
          subject: course.subject || '',
          teacherName: (findTeacher(course.teacherId) || {}).name || '',
          classroomName: (findClassroom(course.classroomId) || {}).name || '',
          feedbackCount: getFeedbacks({ studentId: student.id, courseId: course.id }).length,
          feedbacks: getFeedbacks({ studentId: student.id, courseId: course.id }).map(feedbackWithMedia)
        })),
        feedbackCount: getFeedbacks({ studentId: student.id }).filter((item) => courses.some((course) => course.id === item.courseId)).length,
        feedbacks: getFeedbacks({ studentId: student.id }).filter((item) => courses.some((course) => course.id === item.courseId)).map(feedbackWithMedia)
      };
    }).filter(Boolean));
  },

  requestClassInLiveEntry(payload = {}) {
    const session = requireSession();
    const courseSessionId = typeof payload === 'string' ? payload : (payload.courseSessionId || payload.id || '');
    const courseSession = findCourseSession(courseSessionId);
    if (!courseSession) throw makeError('NOT_FOUND', '课次不存在。');
    if (!canAccessSession(session, courseSession.id)) throw makeError('NO_PERMISSION', '当前账号不能进入这个直播入口。');
    const courseId = payload.courseId || courseSession.courseId;
    return delay(classInEntryForSession(courseId, courseSession.id));
  },

  listIdentities() {
    const session = getSession();
    if (!session) return delay([]);
    return delay(getUserRolesByPhone(session.phone).map((role) => ({
      ...describeRole(role),
      roleName: role.role === 'teacher' ? '教师端' : role.role === 'admin' ? '管理端' : role.role === 'researcher' ? '教研端' : '学生/家长端',
      phone: role.phone,
      active: role.id === session.identityId
    })));
  },

  switchIdentity(identityId) {
    return this.selectActiveRole({ roleId: identityId });
  },

  getDashboard() {
    const session = requireSession();
    if (session.role === 'teacher') return this.getTeacherDashboard();
    if (session.role === 'admin') return this.getAdminOverview();
    return this.getStudentDashboard();
  },

  getParentChildren() {
    const session = requireRole('parent');
    const student = findStudent(session.studentId);
    return delay(student ? [{ ...student, displayLabel: `${student.name} · ${student.grade}` }] : []);
  },

  listParentChildren() {
    return this.getParentChildren();
  },

  switchActiveChild(studentId) {
    const session = requireRole('parent');
    if (studentId !== session.studentId) throw makeError('NO_PERMISSION', '当前手机号只绑定一名学生。');
    session.activeChildId = studentId;
    setSession(session);
    writeStoredSession(session);
    return delay(session);
  },

  getParentCourses() {
    return this.getStudentCourses();
  },

  getParentExercises(payload = {}) {
    return Promise.all([
      this.getStudentDashboard(),
      this.getStudentLessonFeedbacks(payload)
    ]).then(([dashboard, result]) => ({
      currentChild: dashboard.currentStudent,
      assignments: [],
      wrongRecords: [],
      lessonFeedbacks: result.feedbacks,
      feedbacks: result.feedbacks
    }));
  },

  getTeacherCourseGroups() {
    return this.getTeacherCourses();
  },

  getTeacherCoursesGrouped() {
    return this.getTeacherCourses();
  },

  getCourseGroupDetail(courseId) {
    const session = requireSession();
    if (session.role === 'parent') return this.getStudentCourseDetail(courseId);
    return this.getTeacherCourseDetail(courseId);
  },

  getCourseSessionDetail(courseSessionId) {
    const session = requireSession();
    if (session.role === 'parent') {
      const courseSession = findCourseSession(courseSessionId);
      if (!courseSession) throw makeError('NOT_FOUND', '课次不存在。');
      return this.getStudentCourseDetail(courseSession.courseId).then((detail) => ({
        ...detail,
        mode: 'session',
        courseSession: decorateSession(courseSession, { studentId: session.studentId, visibleToStudent: true }),
        lessonFeedbacks: getFeedbacks({
          studentId: session.studentId,
          courseSessionId,
          visibleToStudent: true
        }).map(feedbackWithMedia),
        feedbacks: getFeedbacks({
          studentId: session.studentId,
          courseSessionId,
          visibleToStudent: true
        }).map(feedbackWithMedia)
      }));
    }
    return this.getTeacherLessonDetail(courseSessionId);
  },

  getCourseDetail(id) {
    const courseSession = findCourseSession(id);
    if (courseSession) return this.getCourseSessionDetail(id);
    return this.getCourseGroupDetail(id);
  },

  getTeacherTodos() {
    const session = requireRole(['teacher', 'admin']);
    const items = [];
    teacherCourses(session).forEach((course) => {
      getCourseSessions(course.id).forEach((courseSession) => {
        const hasActivity = courseSession.status === 'finished'
          || getFeedbacks({ courseId: course.id, courseSessionId: courseSession.id }).length > 0
          || getWrongSelections({ courseId: course.id, courseSessionId: courseSession.id }).length > 0;
        if (!hasActivity) return;
        getCourseStudents(course.id).forEach((student) => {
          const passed = getFeedbacks({
            studentId: student.id,
            courseId: course.id,
            courseSessionId: courseSession.id,
            feedbackType: 'general'
          }).some((feedback) => feedback.passed);
          if (passed) return;
          const wrongSelection = getWrongSelections({ studentId: student.id, courseId: course.id, courseSessionId: courseSession.id })[0] || null;
          items.push({
            id: `todo_${courseSession.id}_${student.id}`,
            type: 'pass_confirmation',
            courseId: course.id,
            courseName: course.name,
            courseSessionId: courseSession.id,
            sessionTitle: courseSession.displayTitle || courseSession.sessionTitle || '',
            sessionTopic: courseSession.topic || '',
            studentId: student.id,
            studentName: student.name,
            wrongCount: wrongSelection ? wrongSelection.questionIds.length : 0,
            statusText: '待确认通关'
          });
        });
      });
    });
    return delay({ pendingPassCount: items.length, items });
  },

  confirmStudentPass(payload = {}) {
    const session = requireRole(['teacher', 'admin']);
    const course = findCourse(payload.courseId);
    const courseSession = findCourseSession(payload.courseSessionId);
    const student = findStudent(payload.studentId);
    if (!course || !courseSession || !student) throw makeError('VALIDATION_ERROR', '课程、课次或学生不存在。');
    if (courseSession.courseId !== course.id) throw makeError('VALIDATION_ERROR', '课次不属于当前课程。');
    if (!canTeacherAccessCourse(session, course.id)) throw makeError('NO_PERMISSION', '当前账号不能确认这门课的通关。');
    return this.createLessonFeedback({
      studentId: student.id,
      teacherId: session.teacherId || course.teacherId,
      courseId: course.id,
      courseSessionId: courseSession.id,
      feedbackType: 'general',
      text: payload.comment || '老师已确认本讲通关。',
      imageFileIds: payload.imageFileIds || [],
      videoFileIds: payload.videoFileIds || [],
      voiceFileIds: payload.voiceFileIds || [],
      attachFileIds: payload.attachFileIds || [],
      passed: payload.passed !== false,
      visibleToStudent: true
    }).then((feedback) => ({ passed: feedback.passed, feedback }));
  },

  createLessonQuestions(payload = {}) {
    const session = requireRole(['teacher', 'admin']);
    const course = findCourse(payload.courseId);
    const courseSession = findCourseSession(payload.courseSessionId);
    if (!course || !courseSession) throw makeError('VALIDATION_ERROR', '课程或课次不存在。');
    if (courseSession.courseId !== course.id) throw makeError('VALIDATION_ERROR', '课次不属于当前课程。');
    if (!canTeacherAccessCourse(session, course.id)) throw makeError('NO_PERMISSION', '当前账号不能维护这门课的题目。');
    const store = ensureCollection('lessonQuestions');
    const incoming = Array.isArray(payload.questions) ? payload.questions : [];
    if (!incoming.length) throw makeError('VALIDATION_ERROR', '请至少添加一道题目。');
    const existingForSession = store.filter((item) => item.courseId === course.id && item.courseSessionId === courseSession.id);
    const created = incoming.map((question, index) => {
      if (question.fileId && !findOptionalFile(question.fileId)) throw makeError('VALIDATION_ERROR', '题目资料文件不存在。');
      const current = question.id ? store.find((item) => item.id === question.id) : null;
      const record = current || {
        id: nextId('question', store),
        courseId: course.id,
        courseSessionId: courseSession.id,
        createdAt: nowLabel()
      };
      Object.assign(record, {
        title: String(question.title || `第${existingForSession.length + index + 1}题`).trim(),
        order: Number(question.order || index + 1),
        fileId: question.fileId || '',
        points: Number(question.points || 0),
        updatedAt: nowLabel(),
        uploadedBy: session.teacherId || session.adminId
      });
      if (!current) store.push(record);
      return questionWithFile(record);
    });
    pushAudit(session.identityId, 'upsert_lesson_questions', 'courseSession', courseSession.id, `维护 ${created.length} 道课次题目`);
    return delay({ course: decorateCourse(course), courseSession: decorateSession(courseSession), questions: created });
  },

  deleteLessonQuestion(payload = {}) {
    const session = requireRole(['teacher', 'admin']);
    const course = findCourse(payload.courseId);
    const courseSession = findCourseSession(payload.courseSessionId);
    if (!course || !courseSession || courseSession.courseId !== course.id) {
      throw makeError('VALIDATION_ERROR', '课程或课次不存在。');
    }
    if (!canTeacherAccessCourse(session, course.id)) throw makeError('NO_PERMISSION', '当前账号不能删除这门课的题目。');

    const questions = ensureCollection('lessonQuestions');
    const index = questions.findIndex((item) => item.id === payload.questionId && item.courseId === course.id && item.courseSessionId === courseSession.id);
    if (index < 0) throw makeError('NOT_FOUND', '题目不存在。');

    const [deletedQuestion] = questions.splice(index, 1);
    const fileId = deletedQuestion.fileId;
    const selections = ensureCollection('wrongQuestionSelections');
    for (let selectionIndex = selections.length - 1; selectionIndex >= 0; selectionIndex -= 1) {
      const selection = selections[selectionIndex];
      if (selection.courseId !== course.id || selection.courseSessionId !== courseSession.id) continue;
      selection.questionIds = (selection.questionIds || []).filter((id) => id !== deletedQuestion.id);
      selection.updatedAt = nowLabel();
      if (!selection.questionIds.length) selections.splice(selectionIndex, 1);
    }

    if (fileId) {
      db.assignments = db.assignments.filter((item) => !(item.courseId === course.id && item.courseSessionId === courseSession.id && item.fileId === fileId));
      const fileStillUsed = questions.some((item) => item.fileId === fileId) || db.assignments.some((item) => item.fileId === fileId);
      if (!fileStillUsed) db.files = db.files.filter((item) => item.id !== fileId);
    }
    pushAudit(session.identityId, 'delete_lesson_question', 'lessonQuestion', deletedQuestion.id, `删除 ${courseSession.displayTitle || courseSession.sessionTitle} 的题目：${deletedQuestion.title}`);
    return delay({ deletedQuestionId: deletedQuestion.id, deletedFileId: fileId || '' });
  },

  markStudentWrongQuestions(payload = {}) {
    const session = requireRole(['teacher', 'admin']);
    const course = findCourse(payload.courseId);
    const courseSession = findCourseSession(payload.courseSessionId);
    const student = findStudent(payload.studentId);
    if (!course || !courseSession || !student) throw makeError('VALIDATION_ERROR', '课程、课次或学生不存在。');
    if (courseSession.courseId !== course.id || !course.studentIds.includes(student.id)) throw makeError('VALIDATION_ERROR', '学生或课次不属于当前课程。');
    if (!canTeacherAccessCourse(session, course.id)) throw makeError('NO_PERMISSION', '当前账号不能标记这门课的错题。');
    const validQuestionIds = getLessonQuestions({ courseId: course.id, courseSessionId: courseSession.id }).map((item) => item.id);
    const questionIds = (payload.questionIds || []).filter((id) => validQuestionIds.includes(id));
    const store = ensureCollection('wrongQuestionSelections');
    let record = store.find((item) => item.studentId === student.id && item.courseId === course.id && item.courseSessionId === courseSession.id);
    if (!record) {
      record = {
        id: nextId('wrong_selection', store),
        studentId: student.id,
        courseId: course.id,
        courseSessionId: courseSession.id,
        createdAt: nowLabel()
      };
      store.push(record);
    }
    Object.assign(record, {
      questionIds,
      accuracy: payload.accuracy !== undefined ? Number(payload.accuracy) : undefined,
      rankText: payload.rankText || '',
      note: payload.note || '',
      updatedAt: nowLabel(),
      updatedBy: session.teacherId || session.adminId
    });
    pushAudit(session.identityId, 'mark_wrong_questions', 'wrongQuestionSelection', record.id, `标记 ${student.name} ${questionIds.length} 道错题`);
    return delay(decorateWrongSelection(record));
  },

  getStudentWrongWorkbook(payload = {}) {
    const session = requireRole('parent');
    return delay(buildStudentWrongWorkbook(session.studentId, payload));
  },

  exportStudentWrongWorkbook(payload = {}) {
    const session = requireRole('parent');
    const workbook = buildStudentWrongWorkbook(session.studentId, payload);
    const student = findStudent(session.studentId) || {};
    const format = payload.format === 'docx' ? 'docx' : 'pdf';
    const file = {
      id: nextId('file_export', db.files),
      name: `${student.name || '学生'}错题本.${format}`,
      ext: format,
      mimeType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: Math.max(1, workbook.summary.totalWrongQuestions) * 1024,
      ownerType: 'wrongWorkbookExport',
      ownerId: student.id || '',
      uploadedBy: session.accountId,
      uploadedAt: nowLabel(),
      fileID: '',
      downloadUrl: '',
      placeholder: true,
      optional: true
    };
    db.files.unshift(file);
    return delay({
      format,
      fileName: file.name,
      file: decorateOptionalFile(file),
      printable: true,
      workbook
    });
  },

  getStudentHonors(payload = {}) {
    const session = requireRole('parent');
    return delay(buildStudentHonors(session.studentId, payload));
  },

  getStudentMedals() {
    const session = requireRole('parent');
    const student = findStudent(session.studentId) || {};
    const courses = db.courses.filter((course) => course.studentIds.includes(session.studentId));
    const honors = buildStudentHonors(session.studentId, {});
    const certMap = {};
    (honors.certificates || []).forEach((cert) => { certMap[cert.courseId] = cert; });

    const medals = courses.map((course) => {
      const sessions = getCourseSessions(course.id);
      const sessionCount = sessions.length;
      const passedFeedbacks = getFeedbacks({ studentId: session.studentId, courseId: course.id, feedbackType: 'general', visibleToStudent: true })
        .filter((feedback) => feedback.passed);
      const passedSessionIds = new Set(passedFeedbacks.map((feedback) => feedback.courseSessionId).filter(Boolean));
      const passedCount = passedSessionIds.size;
      const unlocked = sessionCount > 0 && passedCount === sessionCount;
      const cert = certMap[course.id];
      return {
        courseId: course.id,
        courseName: course.name,
        subject: course.subject || '',
        unlocked,
        passedCount,
        sessionCount,
        passRate: sessionCount ? Math.round((passedCount / sessionCount) * 100) : 0,
        progressText: `${passedCount}/${sessionCount} 讲已通关`,
        issuedAt: unlocked && cert ? cert.issuedAt : '',
        sealText: unlocked ? '趣帆学习通关认证' : ''
      };
    });

    medals.sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      return a.courseName.localeCompare(b.courseName);
    });

    const unlockedCount = medals.filter((m) => m.unlocked).length;
    return delay({ currentStudent: student, medals, unlockedCount, totalCount: medals.length });
  },
  getStudentsByCourse(courseId) {
    return this.getTeacherStudentsByCourse(courseId);
  },

  uploadWrongRecordImage(payload = {}) {
    return this.uploadFeedbackImage(payload);
  },

  createWrongRecord(payload = {}) {
    const text = [payload.topic, payload.mistakeReason, payload.correction].filter(Boolean).join('\n');
    return this.createLessonFeedback({
      studentId: payload.studentId,
      teacherId: payload.teacherId,
      courseId: payload.courseId,
      courseSessionId: payload.courseSessionId,
      text,
      imageFileIds: payload.imageFileId ? [payload.imageFileId] : [],
      voiceFileIds: []
    });
  },

  getFeedbacks(payload = {}) {
    const session = requireSession();
    if (session.role === 'teacher') {
      return delay(getFeedbacks({ teacherId: session.teacherId, ...payload }).map(feedbackWithMedia));
    }
    if (session.role === 'admin') return delay(getFeedbacks(payload).map(feedbackWithMedia));
    return this.getStudentLessonFeedbacks(payload).then((result) => result.feedbacks);
  },

  getWrongRecords() {
    return delay([]);
  },

  addWrongRecord(payload = {}) {
    return this.createWrongRecord(payload);
  },

  publishAssignment(payload = {}) {
    const session = requireRole(['teacher', 'admin']);
    const courseSession = findCourseSession(payload.courseSessionId);
    const course = findCourse(payload.courseId || (courseSession && courseSession.courseId));
    if (!course || !courseSession) throw makeError('VALIDATION_ERROR', '课程或课次不存在。');
    if (session.role === 'teacher' && course.teacherId !== session.teacherId) throw makeError('NO_PERMISSION', '当前老师不能保存这门课程的资料。');
    const existingFile = payload.fileId ? findOptionalFile(payload.fileId) : null;
    if (payload.fileId && !existingFile) throw makeError('VALIDATION_ERROR', '资料文件不存在。');
    const file = existingFile || (payload.fileName ? {
      id: nextId('file_optional', db.files),
      name: payload.fileName,
      ext: getExt(payload.fileName),
      mimeType: '',
      size: Number(payload.size || 0),
      ownerType: 'optionalMaterial',
      ownerId: '',
      uploadedBy: session.teacherId || session.adminId,
      uploadedAt: nowLabel(),
      fileID: '',
      downloadUrl: '',
      placeholder: true,
      optional: true
    } : null);
    if (file && !existingFile) db.files.unshift(file);
    const assignment = {
      id: nextId('assignment_optional', db.assignments),
      courseId: course.id,
      courseSessionId: courseSession.id,
      teacherId: course.teacherId,
      type: payload.type || 'post',
      title: payload.title || '可选测验记录',
      status: 'optional',
      statusText: '可选记录',
      fileId: file ? file.id : '',
      dueAt: payload.dueAt || ''
    };
    if (file && !file.ownerId) file.ownerId = assignment.id;
    db.assignments.unshift(assignment);
    return delay({ assignment: assignmentWithFile(assignment), file });
  },

  uploadAssignmentFile(payload = {}) {
    return this.publishAssignment(payload).then((result) => result.file);
  },

  getFilePreview(fileId) {
    return this.getMediaPreview(fileId);
  },

  getBootstrap() {
    const session = requireRole('admin');
    const courses = filterCoursesForAdminScope(session, db.courses);
    const courseIds = new Set(courses.map((item) => item.id));
    const studentIds = new Set(courses.flatMap((item) => item.studentIds || []));
    const teacherIds = new Set(courses.map((item) => item.teacherId));
    const classIds = new Set(courses.map((item) => item.classId));
    const classroomIds = new Set(courses.map((item) => item.classroomId));
    const courseSessions = db.courseSessions.filter((item) => courseIds.has(item.courseId));
    const sessionIds = new Set(courseSessions.map((item) => item.id));
    const lessonFeedbacks = db.lessonFeedbacks.filter((item) => courseIds.has(item.courseId));
    const mediaIds = new Set(lessonFeedbacks.flatMap((item) => ([]).concat(item.imageFileIds || [], item.videoFileIds || [], item.voiceFileIds || [], item.attachFileIds || [])));
    return delay({
      phoneAccounts: db.phoneAccounts.filter((item) => studentIds.has(item.linkedId) || teacherIds.has(item.linkedId) || item.id === session.identityId),
      students: db.students.filter((item) => studentIds.has(item.id)),
      teachers: db.teachers.filter((item) => teacherIds.has(item.id)),
      admins: session.isSuperAdmin ? db.admins : db.admins.filter((item) => item.id === session.adminId),
      classes: db.classes.filter((item) => classIds.has(item.id)),
      classrooms: db.classrooms.filter((item) => classroomIds.has(item.id)),
      courses,
      courseSessions,
      assignments: db.assignments.filter((item) => courseIds.has(item.courseId) && sessionIds.has(item.courseSessionId)),
      lessonFeedbacks,
      mediaFiles: db.mediaFiles.filter((item) => mediaIds.has(item.id)),
      liveRooms: [],
      demoPhones: config.demoPhones
    });
  },

  getAdminRelationsOverview() {
    return this.getAdminOverview().then((overview) => overview.relationOverview);
  },

  getAdminClassroomRelations() {
    requireRole('admin');
    return delay(db.classrooms.map((room) => {
      const sessions = db.courseSessions.filter((item) => item.classroomId === room.id).map(decorateSession);
      return {
        ...room,
        cameraStatusText: cameraStatusText(room.cameraStatus),
        sessions,
        current: sessions[0] || null,
        next: sessions[1] || null
      };
    }));
  },

  getAdminStudentGuardianRelations() {
    return this.getAdminStudentRelations();
  },

  getAdminParentRelations() {
    requireRole('admin');
    return delay(db.phoneAccounts
      .filter((account) => account.role === 'parent')
      .map((account) => ({
        ...account,
        student: findStudent(account.linkedId),
        courses: db.courses.filter((course) => course.studentIds.includes(account.linkedId))
      })));
  },

  getSchedule() {
    const session = requireSession();
    return delay(db.courseSessions
      .filter((item) => canAccessCourse(session, item.courseId))
      .map(decorateSession));
  },

  getLiveRooms() {
    const session = requireSession();
    return delay(db.liveRooms
      .filter((item) => !item.courseSessionId || session.role === 'admin' || canAccessSession(session, item.courseSessionId))
      .map((item) => ({
        ...item,
        classroom: findClassroom(item.classroomId) || {},
        courseSession: item.courseSessionId ? decorateSession(findCourseSession(item.courseSessionId)) : null,
        playerReady: Boolean(item.classinEntryUrl),
        placeholder: true
      })));
  },

  getTests() {
    const session = requireSession();
    return delay(db.assignments
      .filter((item) => canAccessCourse(session, item.courseId))
      .map(assignmentWithFile));
  },

  importTest(payload = {}) {
    return this.publishAssignment({
      ...payload,
      title: payload.title || payload.name || '可选测验记录',
      fileName: payload.fileName || payload.name || 'optional.pdf'
    }).then((result) => result.assignment);
  },

  markOneGraded(assignmentId) {
    requireRole(['teacher', 'admin']);
    const assignment = db.assignments.find((item) => item.id === assignmentId);
    if (!assignment) throw makeError('NOT_FOUND', '记录不存在。');
    assignment.status = 'optional';
    assignment.statusText = '可选记录';
    return delay(assignmentWithFile(assignment));
  },

  createTeacher(payload = {}) {
    requireRole('admin');
    const teacher = {
      id: nextId('teacher', db.teachers),
      fullName: payload.fullName || payload.name || '新老师',
      name: payload.name || `${payload.fullName || '新老师'}老师`,
      phone: payload.phone || '',
      subject: payload.subject || '',
      subjects: payload.subject ? [payload.subject] : [],
      courseIds: [],
      title: payload.title || '老师',
      status: 'active'
    };
    db.teachers.push(teacher);
    syncPhoneAccount('teacher', teacher.id, teacher.phone, teacher.name);
    return delay(teacher);
  },

  updateTeacher(payload = {}) {
    requireRole('admin');
    const teacher = findTeacher(payload.id);
    if (!teacher) throw makeError('NOT_FOUND', '教师不存在。');
    const fullName = payload.fullName !== undefined ? String(payload.fullName || '').trim() : teacher.fullName;
    const name = payload.name !== undefined ? String(payload.name || '').trim() : teacher.name;
    teacher.fullName = fullName || name || teacher.fullName;
    teacher.name = name || (teacher.fullName ? `${teacher.fullName}老师` : teacher.name);
    teacher.phone = payload.phone !== undefined ? String(payload.phone || '').trim() : teacher.phone;
    teacher.subject = payload.subject !== undefined ? String(payload.subject || '').trim() : teacher.subject;
    teacher.subjects = teacher.subject ? [teacher.subject] : [];
    teacher.title = payload.title !== undefined ? String(payload.title || '').trim() : teacher.title;
    syncPhoneAccount('teacher', teacher.id, teacher.phone, teacher.name);
    pushAudit(getSession().identityId, 'update_teacher', 'teacher', teacher.id, `更新教师 ${teacher.name}`);
    return delay({ ...teacher });
  },

  deleteTeacher(input) {
    requireRole('admin');
    const id = normalizeId(input);
    const teacher = findTeacher(id);
    if (!teacher) throw makeError('NOT_FOUND', '教师不存在。');
    const usedCourses = db.courses.filter((course) => course.teacherId === id);
    if (usedCourses.length) throw makeError('VALIDATION_ERROR', '该教师仍负责课程，请先调整课程老师。');
    removeFromCollection(db.teachers, (item) => item.id === id);
    removePhoneAccounts('teacher', id);
    pushAudit(getSession().identityId, 'delete_teacher', 'teacher', id, `删除教师 ${teacher.name}`);
    return delay({ ok: true, id });
  },

  createStudent(payload = {}) {
    requireRole('admin');
    const student = {
      id: nextId('stu', db.students),
      name: payload.name || payload.studentName || '新学生',
      phone: payload.phone || payload.guardianPhone || '',
      grade: payload.grade || '',
      courseIds: [],
      status: 'active'
    };
    db.students.push(student);
    syncPhoneAccount('student', student.id, student.phone, student.name);
    return delay(student);
  },

  updateStudent(payload = {}) {
    requireRole('admin');
    const student = findStudent(payload.id);
    if (!student) throw makeError('NOT_FOUND', '学生不存在。');
    student.name = payload.name !== undefined ? String(payload.name || '').trim() || student.name : student.name;
    student.phone = payload.phone !== undefined ? String(payload.phone || '').trim() : student.phone;
    student.grade = payload.grade !== undefined ? String(payload.grade || '').trim() : student.grade;
    syncPhoneAccount('student', student.id, student.phone, student.name);
    pushAudit(getSession().identityId, 'update_student', 'student', student.id, `更新学生 ${student.name}`);
    return delay({ ...student });
  },

  deleteStudent(input) {
    requireRole('admin');
    const id = normalizeId(input);
    const student = findStudent(id);
    if (!student) throw makeError('NOT_FOUND', '学生不存在。');
    db.courses.forEach((course) => {
      course.studentIds = (course.studentIds || []).filter((studentId) => studentId !== id);
    });
    db.classes.forEach((classItem) => {
      classItem.studentIds = (classItem.studentIds || []).filter((studentId) => studentId !== id);
    });
    db.courseSessions.forEach((courseSession) => {
      courseSession.studentIds = (courseSession.studentIds || []).filter((studentId) => studentId !== id);
    });
    removeFromCollection(db.lessonFeedbacks, (feedback) => feedback.studentId === id);
    removeFromCollection(db.students, (item) => item.id === id);
    removePhoneAccounts('student', id);
    pushAudit(getSession().identityId, 'delete_student', 'student', id, `删除学生 ${student.name}`);
    return delay({ ok: true, id });
  },

  createStudentGuardian(payload = {}) {
    return this.createStudent({
      name: payload.studentName,
      phone: payload.guardianPhone,
      grade: payload.grade
    }).then((student) => ({ student, phoneAccount: db.phoneAccounts.find((item) => item.linkedId === student.id) }));
  },

  createClassroom(payload = {}) {
    requireRole('admin');
    const classroom = {
      id: nextId('room', db.classrooms),
      name: payload.name || '新教室',
      capacity: Number(payload.capacity || 18),
      campus: payload.campus || '主校区',
      cameraStatus: payload.cameraStatus || 'pending',
      streamPlaceholder: '',
      liveProvider: 'classin',
      liveConfigStatus: 'pending'
    };
    db.classrooms.push(classroom);
    return delay(classroom);
  },

  updateClassroom(payload = {}) {
    requireRole('admin');
    const classroom = findClassroom(payload.id);
    if (!classroom) throw makeError('NOT_FOUND', '教室不存在。');
    classroom.name = payload.name !== undefined ? String(payload.name || '').trim() || classroom.name : classroom.name;
    classroom.campus = payload.campus !== undefined ? String(payload.campus || '').trim() || classroom.campus : classroom.campus;
    classroom.capacity = payload.capacity !== undefined ? Number(payload.capacity || 0) || classroom.capacity : classroom.capacity;
    classroom.cameraStatus = payload.cameraStatus !== undefined ? payload.cameraStatus || 'pending' : classroom.cameraStatus;
    pushAudit(getSession().identityId, 'update_classroom', 'classroom', classroom.id, `更新教室 ${classroom.name}`);
    return delay({ ...classroom, cameraStatusText: cameraStatusText(classroom.cameraStatus) });
  },

  deleteClassroom(input) {
    requireRole('admin');
    const id = normalizeId(input);
    const classroom = findClassroom(id);
    if (!classroom) throw makeError('NOT_FOUND', '教室不存在。');
    const used = db.courses.some((course) => course.classroomId === id || course.defaultClassroomId === id)
      || db.classes.some((classItem) => classItem.defaultClassroomId === id)
      || db.courseSessions.some((courseSession) => courseSession.classroomId === id);
    if (used) throw makeError('VALIDATION_ERROR', '该教室仍有关联课程或课次，请先调整排课。');
    removeFromCollection(db.classrooms, (item) => item.id === id);
    removeFromCollection(db.liveRooms, (item) => item.classroomId === id);
    pushAudit(getSession().identityId, 'delete_classroom', 'classroom', id, `删除教室 ${classroom.name}`);
    return delay({ ok: true, id });
  },

  createCourse(payload = {}) {
    requireRole('admin');
    const teacher = findTeacher(payload.teacherId) || db.teachers[0];
    const classroom = findClassroom(payload.classroomId) || db.classrooms[0];
    const studentIds = (payload.studentIds || []).filter((id) => Boolean(findStudent(id)));
    const course = {
      id: nextId('course', db.courses),
      classId: nextId('class', db.classes),
      name: payload.name || '新课程',
      subject: payload.subject || '',
      grade: payload.grade || '',
      teacherId: teacher.id,
      mainTeacherId: teacher.id,
      classroomId: classroom.id,
      defaultClassroomId: classroom.id,
      studentIds,
      defaultDurationMinutes: 90,
      passThresholdPercent: Number(payload.passThresholdPercent || 80),
      status: 'active',
      description: payload.description || ''
    };
    db.courses.push(course);
    addUnique(teacher.courseIds, course.id);
    studentIds.forEach((studentId) => {
      const student = findStudent(studentId);
      if (student) addUnique(student.courseIds, course.id);
    });
    db.classes.push({
      id: course.classId,
      courseId: course.id,
      name: course.name,
      subject: course.subject,
      grade: course.grade,
      mainTeacherId: teacher.id,
      studentIds: course.studentIds.slice(),
      defaultClassroomId: classroom.id,
      status: 'active'
    });
    return delay(decorateCourse(course));
  },

  updateCourse(payload = {}) {
    requireRole('admin');
    const course = findCourse(payload.id);
    if (!course) throw makeError('NOT_FOUND', '课程不存在。');
    const oldTeacher = findTeacher(course.teacherId);
    const teacher = payload.teacherId ? findTeacher(payload.teacherId) : oldTeacher;
    const classroom = payload.classroomId ? findClassroom(payload.classroomId) : findClassroom(course.classroomId);
    if (!teacher) throw makeError('VALIDATION_ERROR', '授课教师不存在。');
    if (!classroom) throw makeError('VALIDATION_ERROR', '教室不存在。');
    course.name = payload.name !== undefined ? String(payload.name || '').trim() || course.name : course.name;
    course.subject = payload.subject !== undefined ? String(payload.subject || '').trim() : course.subject;
    course.grade = payload.grade !== undefined ? String(payload.grade || '').trim() : course.grade;
    course.description = payload.description !== undefined ? String(payload.description || '').trim() : course.description;
    if (payload.passThresholdPercent !== undefined) course.passThresholdPercent = Number(payload.passThresholdPercent || 80);
    course.teacherId = teacher.id;
    course.mainTeacherId = teacher.id;
    course.classroomId = classroom.id;
    course.defaultClassroomId = classroom.id;
    if (Array.isArray(payload.studentIds)) {
      const nextStudentIds = payload.studentIds.filter((id) => Boolean(findStudent(id)));
      const previousStudentIds = course.studentIds.slice();
      course.studentIds = nextStudentIds;
      previousStudentIds.forEach((studentId) => {
        if (!nextStudentIds.includes(studentId)) {
          const student = findStudent(studentId);
          if (student) student.courseIds = student.courseIds.filter((courseId) => courseId !== course.id);
        }
      });
      nextStudentIds.forEach((studentId) => {
        const student = findStudent(studentId);
        if (student) addUnique(student.courseIds, course.id);
      });
    }
    if (oldTeacher && oldTeacher.id !== teacher.id) {
      oldTeacher.courseIds = oldTeacher.courseIds.filter((courseId) => courseId !== course.id);
    }
    addUnique(teacher.courseIds, course.id);
    const classItem = findClass(course.classId);
    if (classItem) {
      classItem.name = course.name;
      classItem.subject = course.subject;
      classItem.grade = course.grade;
      classItem.mainTeacherId = teacher.id;
      classItem.defaultClassroomId = classroom.id;
      classItem.studentIds = course.studentIds.slice();
    }
    db.courseSessions.forEach((courseSession) => {
      if (courseSession.courseId === course.id) {
        courseSession.teacherId = teacher.id;
        courseSession.classroomId = classroom.id;
        courseSession.studentIds = course.studentIds.slice();
      }
    });
    pushAudit(getSession().identityId, 'update_course', 'course', course.id, `更新课程 ${course.name}`);
    return delay(decorateCourse(course));
  },

  deleteCourse(input) {
    requireRole('admin');
    const id = normalizeId(input);
    const course = findCourse(id);
    if (!course) throw makeError('NOT_FOUND', '课程不存在。');
    db.teachers.forEach((teacher) => {
      teacher.courseIds = (teacher.courseIds || []).filter((courseId) => courseId !== id);
    });
    db.students.forEach((student) => {
      student.courseIds = (student.courseIds || []).filter((courseId) => courseId !== id);
    });
    removeFromCollection(db.assignments, (assignment) => assignment.courseId === id);
    removeFromCollection(db.lessonFeedbacks, (feedback) => feedback.courseId === id);
    removeFromCollection(db.courseSessions, (courseSession) => courseSession.courseId === id);
    removeFromCollection(db.classes, (classItem) => classItem.courseId === id || classItem.id === course.classId);
    removeFromCollection(db.courses, (item) => item.id === id);
    pushAudit(getSession().identityId, 'delete_course', 'course', id, `删除课程 ${course.name}`);
    return delay({ ok: true, id });
  },

  checkScheduleConflicts(payload = {}) {
    requireRole('admin');
    return delay(checkScheduleConflictsRaw(payload));
  },

  createCourseSession(payload = {}) {
    requireRole('admin');
    const course = findCourse(payload.courseId);
    if (!course) throw makeError('NOT_FOUND', '课程不存在。');
    const teacherId = payload.teacherId || course.teacherId;
    const classroomId = payload.classroomId || course.classroomId;
    const conflict = checkScheduleConflictsRaw({
      courseId: course.id,
      teacherId,
      classroomId,
      date: payload.date,
      startTime: payload.startTime,
      endTime: payload.endTime
    });
    if (conflict.hasConflict) throw makeError('SCHEDULE_CONFLICT', '排课时间冲突。', conflict);
    const sessionIndex = getCourseSessions(course.id).length + 1;
    const defaultTitle = `第${sessionIndex}次课`;
    const sessionTitle = String(payload.sessionTitle || payload.displayTitle || defaultTitle).trim() || defaultTitle;
    const topic = String(payload.topic || '').trim();
    const courseSession = {
      id: nextId('lesson', db.courseSessions),
      courseId: course.id,
      classId: course.classId,
      sessionIndex,
      sessionTitle,
      title: payload.title || (topic ? `${sessionTitle}：${topic}` : sessionTitle),
      displayTitle: sessionTitle,
      topic,
      date: payload.date,
      startTime: payload.startTime,
      endTime: payload.endTime,
      teacherId,
      classroomId,
      studentIds: course.studentIds.slice(),
      status: 'scheduled',
      statusText: '未开始',
      liveRoomId: '',
      note: '本讲总结课次。'
    };
    db.courseSessions.push(courseSession);
    return delay(decorateSession(courseSession));
  },

  updateCourseSession(payload = {}) {
    const session = requireRole(['admin', 'teacher']);
    const courseSession = findCourseSession(payload.id);
    if (!courseSession) throw makeError('NOT_FOUND', '课次不存在。');
    const course = findCourse(courseSession.courseId);
    if (!course) throw makeError('NOT_FOUND', '课程不存在。');
    if (!canTeacherAccessCourse(session, course.id)) throw makeError('NO_PERMISSION', '当前账号不能编辑这个课次。');

    const canManageSchedule = session.role === 'admin';
    const nextTeacherId = canManageSchedule && payload.teacherId ? payload.teacherId : courseSession.teacherId;
    const nextClassroomId = canManageSchedule && payload.classroomId ? payload.classroomId : courseSession.classroomId;
    const nextDate = canManageSchedule && payload.date !== undefined ? String(payload.date || '').trim() : courseSession.date;
    const nextStartTime = canManageSchedule && payload.startTime !== undefined ? String(payload.startTime || '').trim() : courseSession.startTime;
    const nextEndTime = canManageSchedule && payload.endTime !== undefined ? String(payload.endTime || '').trim() : courseSession.endTime;

    if (!findTeacher(nextTeacherId)) throw makeError('VALIDATION_ERROR', '授课教师不存在。');
    if (!findClassroom(nextClassroomId)) throw makeError('VALIDATION_ERROR', '教室不存在。');
    if (canManageSchedule && nextDate && nextStartTime && nextEndTime) {
      if (nextStartTime >= nextEndTime) throw makeError('VALIDATION_ERROR', '课次结束时间必须晚于开始时间。');
      const conflict = checkScheduleConflictsRaw({
        id: courseSession.id,
        courseId: course.id,
        teacherId: nextTeacherId,
        classroomId: nextClassroomId,
        date: nextDate,
        startTime: nextStartTime,
        endTime: nextEndTime
      });
      if (conflict.hasConflict) throw makeError('SCHEDULE_CONFLICT', '排课时间冲突。', conflict);
    }

    const fallbackTitle = `第${courseSession.sessionIndex || getCourseSessions(course.id).length}次课`;
    const sessionTitle = payload.sessionTitle !== undefined || payload.displayTitle !== undefined
      ? String(payload.sessionTitle || payload.displayTitle || '').trim() || fallbackTitle
      : courseSession.sessionTitle || courseSession.displayTitle || fallbackTitle;
    const topic = payload.topic !== undefined ? String(payload.topic || '').trim() : (courseSession.topic || '');

    courseSession.sessionTitle = sessionTitle;
    courseSession.displayTitle = sessionTitle;
    courseSession.topic = topic;
    courseSession.title = payload.title !== undefined
      ? String(payload.title || '').trim() || (topic ? `${sessionTitle}：${topic}` : sessionTitle)
      : (topic ? `${sessionTitle}：${topic}` : sessionTitle);
    if (canManageSchedule) {
      courseSession.teacherId = nextTeacherId;
      courseSession.classroomId = nextClassroomId;
      courseSession.date = nextDate;
      courseSession.startTime = nextStartTime;
      courseSession.endTime = nextEndTime;
    }
    pushAudit(session.identityId, 'update_course_session', 'courseSession', courseSession.id, `更新课次 ${courseSession.title}`);
    return delay(decorateSession(courseSession));
  },

  deleteCourseSession(input) {
    const session = requireRole('admin');
    const id = normalizeId(input);
    const courseSession = findCourseSession(id);
    if (!courseSession) throw makeError('NOT_FOUND', '课次不存在。');
    removeFromCollection(db.assignments, (assignment) => assignment.courseSessionId === id);
    removeFromCollection(db.lessonFeedbacks, (feedback) => feedback.courseSessionId === id);
    removeFromCollection(db.courseSessions, (item) => item.id === id);
    pushAudit(session.identityId, 'delete_course_session', 'courseSession', id, `删除课次 ${courseSession.sessionTitle || id}`);
    return delay({ ok: true, id });
  },

  addStudentToCourse(payload = {}) {
    requireRole('admin');
    const student = findStudent(payload.studentId);
    const course = findCourse(payload.courseId || payload.toCourseId);
    if (!student) throw makeError('NOT_FOUND', '学生不存在。');
    if (!course) throw makeError('NOT_FOUND', '课程不存在。');
    if (course.studentIds.includes(student.id)) throw makeError('ALREADY_EXISTS', '学生已在该课程中。');
    attachStudentToCourse(student, course);
    pushAudit(getSession().identityId, 'add_student_to_course', 'course', course.id, `将 ${student.name} 插班到 ${course.name}`);
    return delay({ action: 'enroll', student, course: decorateCourse(course) });
  },

  removeStudentFromCourse(payload = {}) {
    requireRole('admin');
    const student = findStudent(payload.studentId);
    const course = findCourse(payload.courseId || payload.fromCourseId);
    if (!student) throw makeError('NOT_FOUND', '学生不存在。');
    if (!course) throw makeError('NOT_FOUND', '课程不存在。');
    if (!course.studentIds.includes(student.id)) throw makeError('NOT_FOUND', '学生不在该课程中。');
    detachStudentFromCourse(student, course);
    pushAudit(getSession().identityId, 'remove_student_from_course', 'course', course.id, `将 ${student.name} 从 ${course.name} 退班`);
    return delay({ action: 'withdraw', student, course: decorateCourse(course) });
  },

  transferStudentCourse(payload = {}) {
    requireRole('admin');
    const student = findStudent(payload.studentId);
    const fromCourse = findCourse(payload.fromCourseId || payload.sourceCourseId);
    const toCourse = findCourse(payload.toCourseId || payload.targetCourseId);
    if (!student) throw makeError('NOT_FOUND', '学生不存在。');
    if (!fromCourse || !toCourse) throw makeError('NOT_FOUND', '源课程或目标课程不存在。');
    if (fromCourse.id === toCourse.id) throw makeError('VALIDATION_ERROR', '调班前后课程不能相同。');
    if (!fromCourse.studentIds.includes(student.id)) throw makeError('NOT_FOUND', '学生不在源课程中。');
    detachStudentFromCourse(student, fromCourse);
    attachStudentToCourse(student, toCourse);
    pushAudit(getSession().identityId, 'transfer_student_course', 'course', toCourse.id, `将 ${student.name} 从 ${fromCourse.name} 调班到 ${toCourse.name}`);
    return delay({
      action: 'transfer',
      student,
      fromCourse: decorateCourse(fromCourse),
      toCourse: decorateCourse(toCourse)
    });
  },

  syncEnrollmentChange(payload = {}) {
    const action = payload.action || payload.type || 'enroll';
    if (action === 'enroll' || action === 'insert') {
      return this.addStudentToCourse({ studentId: payload.studentId, courseId: payload.courseId || payload.toCourseId || payload.targetCourseId });
    }
    if (action === 'transfer') {
      return this.transferStudentCourse(payload);
    }
    if (action === 'withdraw' || action === 'drop' || action === 'remove') {
      return this.removeStudentFromCourse({ studentId: payload.studentId, courseId: payload.courseId || payload.fromCourseId || payload.sourceCourseId });
    }
    throw makeError('VALIDATION_ERROR', '未知教务同步动作。');
  },

  createInvite() {
    throw makeError('LEGACY_AUTH_DISABLED', '历史登录码生成功能已停用，请维护手机号映射。');
  },

  createSchedule(payload = {}) {
    return this.createCourseSession(payload);
  }
};

function callByMode(mode, methodName, payload) {
  if (!hasWx()) {
    return Promise.reject(makeError('ADAPTER_PLACEHOLDER', `${mode} 服务模式尚未启用。`, { methodName, payload }));
  }
  return Promise.reject(makeError('ADAPTER_PLACEHOLDER', `${mode} 服务模式尚未启用，请切换到当前演示数据源。`, { methodName, payload }));
}

function createPlaceholderAdapter(mode) {
  const adapter = {};
  Object.keys(mockApi).forEach((methodName) => {
    adapter[methodName] = function placeholder(payload) {
      return callByMode(mode, methodName, payload);
    };
  });
  return adapter;
}

const adapters = {
  mock: mockApi,
  local: createPlaceholderAdapter('local'),
  cloud: createPlaceholderAdapter('cloud'),
  http: createPlaceholderAdapter('http')
};

const api = adapters[config.apiMode] || mockApi;

Object.keys(api).forEach((methodName) => {
  const original = api[methodName];
  if (typeof original !== 'function') return;
  api[methodName] = function wrappedMethod(...args) {
    try {
      return original.apply(api, args);
    } catch (error) {
      return Promise.reject(error);
    }
  };
});

api.setSession = setSession;
api.getSession = getSession;
api.__mockDb = db;

module.exports = api;
