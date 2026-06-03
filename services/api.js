const config = require('./config');
const db = require('./mock-db');

let activeSession = null;

const TODAY = '2026-06-03';
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'heic'];
const VOICE_EXTS = ['m4a', 'mp3', 'aac', 'wav'];
const IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const VOICE_MAX_SIZE = 20 * 1024 * 1024;

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
  return '待接入';
}

function assignmentWithFile(item) {
  const file = item.fileId ? findOptionalFile(item.fileId) : null;
  const courseSession = findCourseSession(item.courseSessionId);
  return {
    ...item,
    typeText: item.type === 'pre' ? '课前测' : '课后测',
    file: file || null,
    courseSession: courseSession ? decorateSession(courseSession) : null
  };
}

function decorateMedia(file) {
  if (!file) return null;
  return {
    ...file,
    canPreview: file.type === 'image' || file.type === 'voice',
    canDownload: file.type === 'image' && file.downloadable,
    previewUrl: file.url || file.tempPath || '',
    message: file.type === 'voice'
      ? '语音反馈仅支持收听，不提供下载入口。'
      : '图片反馈支持查看和下载，正式部署后由后端签发临时地址。'
  };
}

function feedbackWithMedia(item) {
  const student = findStudent(item.studentId) || {};
  const teacher = findTeacher(item.teacherId) || {};
  const course = findCourse(item.courseId) || {};
  const courseSession = findCourseSession(item.courseSessionId) || {};
  const imageFiles = (item.imageFileIds || []).map(findMedia).filter(Boolean).map(decorateMedia);
  const voiceFiles = (item.voiceFileIds || []).map(findMedia).filter(Boolean).map(decorateMedia);
  return {
    ...item,
    studentName: student.name || '',
    teacherName: teacher.name || teacher.fullName || '',
    courseName: course.name || '',
    courseSessionTitle: courseSession.displayTitle || courseSession.title || '',
    imageFiles,
    voiceFiles,
    mediaFiles: imageFiles.concat(voiceFiles),
    imageCount: imageFiles.length,
    voiceCount: voiceFiles.length
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
  return {
    ...item,
    courseName: course.name || '',
    teacherName: teacher.name || teacher.fullName || '',
    classroomName: classroom.name || '待定教室',
    statusTone: statusTone(item.status),
    feedbackCount: feedbacks.length,
    liveStatusText: 'ClassIn 接口待接入',
    liveTone: 'warn'
  };
}

function decorateCourse(item, options = {}) {
  const teacher = findTeacher(item.teacherId) || {};
  const classroom = findClassroom(item.classroomId) || {};
  const sessions = getCourseSessions(item.id).map((session) => decorateSession(session, options));
  const studentId = options.studentId || '';
  const feedbacks = getFeedbacks({ courseId: item.id, studentId, visibleToStudent: options.visibleToStudent });
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
    assignments: getCourseAssignments(item.id),
    wrongRecords: [],
    liveStatusText: 'ClassIn 接口待接入',
    liveTone: 'warn'
  };
}

function canTeacherAccessCourse(session, courseId) {
  const course = findCourse(courseId);
  return Boolean(course && (session.role === 'admin' || course.teacherId === session.teacherId));
}

function canStudentAccessCourse(session, courseId) {
  const course = findCourse(courseId);
  return Boolean(course && session.studentId && course.studentIds.includes(session.studentId));
}

function canAccessCourse(session, courseId) {
  if (session.role === 'admin') return Boolean(findCourse(courseId));
  if (session.role === 'teacher') return canTeacherAccessCourse(session, courseId);
  return canStudentAccessCourse(session, courseId);
}

function canAccessSession(session, courseSessionId) {
  const courseSession = findCourseSession(courseSessionId);
  return Boolean(courseSession && canAccessCourse(session, courseSession.courseId));
}

function canAccessFeedback(session, feedback) {
  if (!feedback) return false;
  if (session.role === 'admin') return true;
  if (session.role === 'teacher') return feedback.teacherId === session.teacherId;
  return feedback.visibleToStudent && feedback.studentId === session.studentId;
}

function canAccessMedia(session, fileId) {
  const feedback = db.lessonFeedbacks.find((item) => {
    const ids = (item.imageFileIds || []).concat(item.voiceFileIds || []);
    return ids.includes(fileId);
  });
  if (feedback) return canAccessFeedback(session, feedback);
  const optionalFile = findOptionalFile(fileId);
  if (!optionalFile) return false;
  const assignment = db.assignments.find((item) => item.fileId === optionalFile.id);
  return assignment ? canAccessCourse(session, assignment.courseId) : session.role === 'admin';
}

function buildSession(account) {
  const base = {
    id: `session_${account.id}_${Date.now()}`,
    accountId: account.id,
    identityId: account.id,
    phone: account.phone,
    role: account.role,
    linkedId: account.linkedId,
    nickname: account.nickname,
    displayName: account.nickname,
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
    return {
      ...base,
      adminId: account.linkedId,
      displayName: admin ? admin.name : account.nickname,
      adminName: admin ? admin.name : account.nickname
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
  const supported = type === 'image' ? IMAGE_EXTS : VOICE_EXTS;
  const maxSize = type === 'image' ? IMAGE_MAX_SIZE : VOICE_MAX_SIZE;
  if (!supported.includes(ext)) throw makeError('UNSUPPORTED_FILE_TYPE', type === 'image' ? '仅支持图片格式。' : '仅支持常见音频格式。');
  if (size > maxSize) throw makeError('FILE_TOO_LARGE', type === 'image' ? '图片不能超过 10MB。' : '语音不能超过 20MB。');
  return { ext, size };
}

function mediaPlaceholder(type, payload, session) {
  const validation = validateMediaUpload(payload, type);
  const id = nextId(type === 'image' ? 'media_img' : 'media_voice', db.mediaFiles);
  const file = {
    id,
    type,
    name: payload.fileName || payload.name || (type === 'image' ? '课后反馈图片.jpg' : '课后反馈语音.m4a'),
    url: '',
    tempPath: payload.tempPath || '',
    storageKey: `feedback/pending/${id}.${validation.ext}`,
    size: validation.size,
    duration: type === 'voice' ? Number(payload.duration || 0) : undefined,
    createdAt: nowLabel(),
    retentionUntil: addMonthsLabel(6),
    downloadable: type === 'image',
    uploadedBy: session.teacherId || session.adminId || session.accountId
  };
  db.mediaFiles.unshift(file);
  return file;
}

function classInEntryForSession(courseId, courseSessionId) {
  return {
    status: 'pending',
    provider: 'classin',
    message: 'ClassIn 直播接口待接入',
    classinEntryUrl: '',
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
    const account = findPhoneAccount(phone);
    if (!account) throw makeError('ACCOUNT_NOT_FOUND', '手机号未匹配到老师、学生或管理员档案。');
    const session = buildSession(account);
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
    const voiceFileIds = payload.voiceFileIds || [];
    imageFileIds.forEach((id) => {
      const file = findMedia(id);
      if (!file || file.type !== 'image') throw makeError('VALIDATION_ERROR', '图片媒体不存在。');
    });
    voiceFileIds.forEach((id) => {
      const file = findMedia(id);
      if (!file || file.type !== 'voice') throw makeError('VALIDATION_ERROR', '语音媒体不存在。');
    });
    if (!String(payload.text || '').trim() && !imageFileIds.length && !voiceFileIds.length) {
      throw makeError('VALIDATION_ERROR', '请填写文字反馈或添加图片/语音。');
    }
    const record = {
      id: nextId('feedback', db.lessonFeedbacks),
      studentId: student.id,
      teacherId,
      courseId: course.id,
      courseSessionId: courseSession.id,
      text: String(payload.text || '').trim(),
      imageFileIds: imageFileIds.slice(),
      voiceFileIds: voiceFileIds.slice(),
      createdAt: nowLabel(),
      visibleToStudent: payload.visibleToStudent !== false
    };
    db.lessonFeedbacks.unshift(record);
    pushAudit(session.identityId, 'create_lesson_feedback', 'lessonFeedback', record.id, `为 ${student.name} 保存课后反馈`);
    return delay(feedbackWithMedia(record));
  },

  uploadFeedbackImage(payload = {}) {
    const session = requireRole(['teacher', 'admin']);
    return delay(decorateMedia(mediaPlaceholder('image', payload, session)));
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
      return delay({
        kind: media.type,
        file: decorateMedia(media),
        message: media.type === 'image'
          ? '图片可查看并下载，真实部署后由后端签发临时下载地址。'
          : '语音只能收听，不提供下载入口。',
        canPreview: true,
        canDownload: media.type === 'image' && media.downloadable,
        downloadable: media.type === 'image' && media.downloadable
      });
    }
    const optionalFile = findOptionalFile(fileId);
    if (!optionalFile) throw makeError('NOT_FOUND', '文件不存在。');
    if (!canAccessMedia(session, fileId)) throw makeError('NO_PERMISSION', '当前账号不能查看该文件。');
    return delay({
      kind: 'optionalFile',
      file: optionalFile,
      message: '这是可选资料文件，非第一版主流程。真实部署后由后端签发临时地址。',
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
      message: media.url ? '图片下载地址已生成。' : '图片下载地址需要后端或云函数签发，当前为 mock 占位。'
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
      message: media.url || media.tempPath ? '语音播放地址已生成。' : '语音播放地址需要后端或云函数签发，当前为 mock 占位。'
    });
  },

  getAdminOverview() {
    requireRole('admin');
    const relationOverview = db.courses.map((course) => {
      const decorated = decorateCourse(course);
      return {
        courseId: course.id,
        courseName: course.name,
        teacherName: decorated.teacherName,
        classroomName: decorated.classroomName,
        studentCount: course.studentIds.length,
        phoneAccountCount: course.studentIds
          .map((studentId) => db.phoneAccounts.find((account) => account.linkedId === studentId))
          .filter(Boolean).length,
        feedbackCount: getFeedbacks({ courseId: course.id }).length,
        recentOrNextSession: decorated.sessions[0] || null,
        liveStatusText: 'ClassIn 接口待接入',
        liveTone: 'warn'
      };
    });
    const todaySessions = db.courseSessions.filter((item) => item.date === TODAY).map(decorateSession);
    return delay({
      metrics: [
        { label: '老师数', value: db.teachers.length },
        { label: '学生数', value: db.students.length },
        { label: '课程数', value: db.courses.length },
        { label: '反馈数', value: db.lessonFeedbacks.length },
        { label: '手机号映射', value: db.phoneAccounts.length },
        { label: '直播配置', value: '待接入' }
      ],
      relationOverview,
      todaySessions,
      liveRooms: db.liveRooms.map((item) => ({ ...item, classroom: findClassroom(item.classroomId) || {} })),
      recentFeedbacks: db.lessonFeedbacks.slice(0, 6).map(feedbackWithMedia),
      recentAuditLogs: db.auditLogs.slice(0, 6)
    });
  },

  getAdminCourseTree() {
    requireRole('admin');
    return delay(db.courses.map((course) => ({
      ...decorateCourse(course),
      sessions: getCourseSessions(course.id).map((session) => ({
        ...decorateSession(session),
        feedbackCount: getFeedbacks({ courseSessionId: session.id }).length,
        students: getCourseStudents(course.id).map((student) => ({
          ...student,
          feedbackCount: getFeedbacks({ courseSessionId: session.id, studentId: student.id }).length
        })),
        assignments: getCourseAssignments(course.id, session.id)
      }))
    })));
  },

  getAdminTeacherRelations() {
    requireRole('admin');
    return delay(db.teachers.map((teacher) => {
      const courses = db.courses.filter((course) => course.teacherId === teacher.id);
      return {
        ...teacher,
        displayName: teacher.name,
        courseNames: courses.map((course) => course.name),
        courses: courses.map((course) => ({
          id: course.id,
          name: course.name,
          studentCount: course.studentIds.length,
          students: getCourseStudents(course.id)
        }))
      };
    }));
  },

  getAdminStudentRelations() {
    requireRole('admin');
    return delay(db.students.map((student) => {
      const courses = db.courses.filter((course) => course.studentIds.includes(student.id));
      const account = db.phoneAccounts.find((item) => item.linkedId === student.id);
      return {
        ...student,
        loginPhone: account ? account.phone : student.phone,
        courseNames: courses.map((course) => course.name),
        courses: courses.map((course) => ({
          id: course.id,
          name: course.name,
          teacherName: (findTeacher(course.teacherId) || {}).name || '',
          feedbackCount: getFeedbacks({ studentId: student.id, courseId: course.id }).length
        })),
        feedbackCount: getFeedbacks({ studentId: student.id }).length
      };
    }));
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
    return delay([{
      id: session.identityId,
      role: session.role,
      roleName: session.role === 'teacher' ? '教师端' : session.role === 'admin' ? '管理端' : '学生/家长端',
      displayName: session.displayName,
      phone: session.phone,
      active: true
    }]);
  },

  switchIdentity(identityId) {
    const account = db.phoneAccounts.find((item) => item.id === identityId);
    if (!account) throw makeError('NOT_FOUND', '身份不存在。');
    return this.loginByPhone({ phone: account.phone });
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
    const file = payload.fileName ? {
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
    } : null;
    if (file) db.files.unshift(file);
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
    if (file) file.ownerId = assignment.id;
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
    requireRole('admin');
    return delay({
      phoneAccounts: db.phoneAccounts,
      students: db.students,
      teachers: db.teachers,
      admins: db.admins,
      classes: db.classes,
      classrooms: db.classrooms,
      courses: db.courses,
      courseSessions: db.courseSessions,
      assignments: db.assignments,
      lessonFeedbacks: db.lessonFeedbacks,
      mediaFiles: db.mediaFiles,
      liveRooms: db.liveRooms,
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
    if (teacher.phone) {
      db.phoneAccounts.push({
        id: nextId('account_teacher', db.phoneAccounts),
        phone: teacher.phone,
        role: 'teacher',
        linkedId: teacher.id,
        nickname: teacher.name
      });
    }
    return delay(teacher);
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
    if (student.phone) {
      db.phoneAccounts.push({
        id: nextId('account_student', db.phoneAccounts),
        phone: student.phone,
        role: 'parent',
        linkedId: student.id,
        nickname: student.name
      });
    }
    return delay(student);
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
      cameraStatus: 'pending',
      streamPlaceholder: '',
      liveProvider: 'classin',
      liveConfigStatus: 'pending'
    };
    db.classrooms.push(classroom);
    return delay(classroom);
  },

  createCourse(payload = {}) {
    requireRole('admin');
    const teacher = findTeacher(payload.teacherId) || db.teachers[0];
    const classroom = findClassroom(payload.classroomId) || db.classrooms[0];
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
      studentIds: payload.studentIds || [],
      defaultDurationMinutes: 90,
      status: 'active',
      description: payload.description || ''
    };
    db.courses.push(course);
    teacher.courseIds.push(course.id);
    db.classes.push({
      id: course.classId,
      courseId: course.id,
      name: course.name,
      subject: course.subject,
      grade: course.grade,
      mainTeacherId: teacher.id,
      studentIds: course.studentIds,
      defaultClassroomId: classroom.id,
      status: 'active'
    });
    return delay(decorateCourse(course));
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
    const courseSession = {
      id: nextId('lesson', db.courseSessions),
      courseId: course.id,
      classId: course.classId,
      sessionIndex,
      sessionTitle: `第${sessionIndex}次课`,
      title: payload.title || `第${sessionIndex}次课`,
      displayTitle: payload.title || `第${sessionIndex}次课`,
      date: payload.date,
      startTime: payload.startTime,
      endTime: payload.endTime,
      teacherId,
      classroomId,
      studentIds: course.studentIds.slice(),
      status: 'scheduled',
      statusText: '未开始',
      liveRoomId: '',
      note: '课后反馈课次。'
    };
    db.courseSessions.push(courseSession);
    return delay(decorateSession(courseSession));
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
    return Promise.reject(makeError('ADAPTER_PLACEHOLDER', `${mode} adapter 待接入真实服务。`, { methodName, payload }));
  }
  return Promise.reject(makeError('ADAPTER_PLACEHOLDER', `${mode} adapter 已保留，当前仅 mock 完整实现。`, { methodName, payload }));
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
