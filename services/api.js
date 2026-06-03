const config = require('./config');
const db = require('./mock-db');

let activeSession = null;

const RELATIONS = ['父亲', '母亲', '爷爷', '奶奶', '外公', '外婆', '其他'];
const DOC_EXTS = ['pdf', 'doc', 'docx'];
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'heic'];
const DOC_MAX_SIZE = 20 * 1024 * 1024;
const IMAGE_MAX_SIZE = 10 * 1024 * 1024;

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

function nextId(prefix, collection) {
  return `${prefix}_${String(collection.length + 1).padStart(3, '0')}_${Date.now()}`;
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
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
  if (session && session.wechatAccountId) {
    db.currentWechatAccountId = session.wechatAccountId;
  }
}

function getWechatAccountId(payload) {
  const session = getSession();
  if (payload && payload.wechatAccountId) return payload.wechatAccountId;
  if (session && session.wechatAccountId) return session.wechatAccountId;
  return db.currentWechatAccountId;
}

function findWechatAccount(accountId) {
  return db.wechatAccounts.find((item) => item.id === accountId);
}

function ensureWechatAccount(accountId, payload) {
  let account = findWechatAccount(accountId);
  if (!account) {
    account = {
      id: accountId,
      nickname: payload && payload.nickname ? payload.nickname : '微信账号',
      phone: payload && payload.phone ? payload.phone : '',
      avatarUrl: '',
      activeIdentityId: '',
      activeChildId: ''
    };
    db.wechatAccounts.push(account);
  }
  return account;
}

function findInvite(inviteCode) {
  return db.inviteCodes.find((item) => item.code === normalizeCode(inviteCode));
}

function findStudent(studentId) {
  return db.students.find((item) => item.id === studentId);
}

function findTeacher(teacherId) {
  return db.teachers.find((item) => item.id === teacherId);
}

function findAdmin(adminId) {
  return db.admins.find((item) => item.id === adminId);
}

function findClass(classId) {
  return db.classes.find((item) => item.id === classId);
}

function findCourse(courseId) {
  return db.courses.find((item) => item.id === courseId);
}

function findClassroom(classroomId) {
  return db.classrooms.find((item) => item.id === classroomId);
}

function findCourseSession(courseSessionId) {
  return db.courseSessions.find((item) => item.id === courseSessionId);
}

function findLiveRoomBySession(courseSessionId) {
  return db.liveRooms.find((item) => item.courseSessionId === courseSessionId);
}

function pushAudit(actorId, action, targetType, targetId, message) {
  db.auditLogs.unshift({
    id: nextId('audit', db.auditLogs),
    actorId: actorId || 'system',
    action,
    targetType,
    targetId,
    message,
    createdAt: nowLabel()
  });
}

function decorateCourseSession(item) {
  const course = findCourse(item.courseId) || {};
  const classItem = findClass(item.classId) || {};
  const teacher = findTeacher(item.teacherId) || {};
  const classroom = findClassroom(item.classroomId) || {};
  const liveRoom = findLiveRoomBySession(item.id) || null;
  return {
    ...item,
    course,
    courseName: course.name || item.title,
    subject: course.subject || classItem.subject || '',
    className: classItem.name || '',
    teacherName: teacher.name || '',
    classroomName: classroom.name || '',
    liveStatus: liveRoom ? liveRoom.status : 'none',
    liveStatusText: liveRoom ? liveRoom.statusText : '未配置直播'
  };
}

function parentStudentIds(session) {
  if (!session || session.role !== 'parent') return [];
  return db.guardianBindings
    .filter((item) => item.wechatAccountId === session.wechatAccountId)
    .map((item) => item.studentId);
}

function activeChildId(session) {
  const ids = parentStudentIds(session);
  if (!ids.length) return '';
  if (session && session.activeChildId && ids.includes(session.activeChildId)) {
    return session.activeChildId;
  }
  return ids[0];
}

function buildIdentityLabel(identity) {
  if (identity.role === 'parent') {
    const student = findStudent(identity.targetId);
    return student ? `${student.name}家长` : '学生家长';
  }
  if (identity.role === 'teacher') {
    const teacher = findTeacher(identity.targetId);
    return teacher ? teacher.name : '老师';
  }
  const admin = findAdmin(identity.targetId);
  return admin ? admin.name : '教务管理员';
}

function roleName(role) {
  if (role === 'parent') return '家长端';
  if (role === 'teacher') return '教师端';
  if (role === 'admin') return '管理员端';
  return '未绑定';
}

function buildSession(identity) {
  const account = findWechatAccount(identity.wechatAccountId) || {};
  const base = {
    wechatAccountId: identity.wechatAccountId,
    accountName: account.nickname || '微信账号',
    accountPhone: account.phone || '',
    identityId: identity.id,
    role: identity.role,
    roleName: roleName(identity.role),
    displayName: buildIdentityLabel(identity),
    inviteCode: identity.inviteCode,
    activeChildId: '',
    studentIds: [],
    teacherId: '',
    adminId: '',
    targetId: identity.targetId
  };

  if (identity.role === 'parent') {
    const studentIds = db.guardianBindings
      .filter((item) => item.wechatAccountId === identity.wechatAccountId)
      .map((item) => item.studentId);
    const activeId = account.activeChildId && studentIds.includes(account.activeChildId)
      ? account.activeChildId
      : identity.targetId;
    base.studentIds = studentIds;
    base.activeChildId = activeId;
    base.relation = identity.relation || '';
  }

  if (identity.role === 'teacher') {
    base.teacherId = identity.targetId;
  }

  if (identity.role === 'admin') {
    base.adminId = identity.targetId;
  }

  return base;
}

function activateIdentity(identity) {
  const account = findWechatAccount(identity.wechatAccountId);
  if (account) {
    account.activeIdentityId = identity.id;
    if (identity.role === 'parent' && !account.activeChildId) {
      account.activeChildId = identity.targetId;
    }
  }
  activeSession = buildSession(identity);
  db.sessions[identity.wechatAccountId] = activeSession;
  return activeSession;
}

function listAccountIdentities(accountId) {
  return db.identities
    .filter((item) => item.wechatAccountId === accountId)
    .map((item) => ({
      ...item,
      label: buildIdentityLabel(item),
      roleName: roleName(item.role)
    }));
}

function requireSession() {
  const session = getSession();
  if (!session || !session.identityId) {
    throw makeError('NO_PERMISSION', '当前账号没有权限，请先绑定身份。');
  }
  return session;
}

function requireRole(roles) {
  const session = requireSession();
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(session.role)) {
    throw makeError('NO_PERMISSION', '当前账号没有权限。');
  }
  return session;
}

function parentCanAccessStudent(session, studentId) {
  return parentStudentIds(session).includes(studentId);
}

function teacherCanAccessClass(session, classId) {
  if (!session || session.role !== 'teacher') return false;
  return db.courseSessions.some((item) => item.teacherId === session.teacherId && item.classId === classId);
}

function canAccessCourseSession(session, courseSession) {
  if (!session || !courseSession) return false;
  if (session.role === 'admin') return true;
  if (session.role === 'teacher') return courseSession.teacherId === session.teacherId;
  if (session.role === 'parent') {
    return courseSession.studentIds.some((studentId) => parentCanAccessStudent(session, studentId));
  }
  return false;
}

function filterCourseSessionsForSession(session) {
  if (!session) return [];
  if (session.role === 'admin') return db.courseSessions;
  if (session.role === 'teacher') {
    return db.courseSessions.filter((item) => item.teacherId === session.teacherId);
  }
  if (session.role === 'parent') {
    const ids = parentStudentIds(session);
    return db.courseSessions.filter((item) => item.studentIds.some((studentId) => ids.includes(studentId)));
  }
  return [];
}

function filterAssignmentsForSession(session) {
  if (!session) return [];
  if (session.role === 'admin') return db.assignments;
  if (session.role === 'teacher') {
    return db.assignments.filter((item) => item.teacherId === session.teacherId);
  }
  if (session.role === 'parent') {
    const activeId = activeChildId(session);
    const student = findStudent(activeId);
    return db.assignments.filter((item) => student && item.classId === student.classId);
  }
  return [];
}

function filterWrongRecordsForSession(session) {
  if (!session) return [];
  if (session.role === 'admin') return db.wrongRecords;
  if (session.role === 'teacher') {
    return db.wrongRecords.filter((item) => item.teacherId === session.teacherId);
  }
  if (session.role === 'parent') {
    const ids = parentStudentIds(session);
    return db.wrongRecords.filter((item) => ids.includes(item.studentId));
  }
  return [];
}

function assignmentWithFile(item) {
  const file = item.fileId ? db.files.find((entry) => entry.id === item.fileId) : null;
  const session = findCourseSession(item.courseSessionId);
  return {
    ...item,
    file,
    courseSession: session ? decorateCourseSession(session) : null,
    typeText: item.type === 'pre' ? '课前测' : '课后测',
    statusText: assignmentStatusText(item.status)
  };
}

function assignmentStatusText(status) {
  const map = {
    not_uploaded: '文件未上传',
    pending: '待完成',
    pending_grading: '待批改',
    grading: '批改中',
    closed: '已完成'
  };
  return map[status] || status || '待确认';
}

function wrongRecordWithFile(item) {
  const file = item.imageFileId ? db.files.find((entry) => entry.id === item.imageFileId) : null;
  return {
    ...item,
    imageFile: file || null,
    statusText: item.status === 'corrected' ? '已订正' : '待订正'
  };
}

function checkScheduleConflictsRaw(payload) {
  const conflicts = [];
  const date = payload.date;
  const startTime = payload.startTime;
  const endTime = payload.endTime;
  if (!date || !startTime || !endTime) {
    return { hasConflict: false, conflicts };
  }

  db.courseSessions.forEach((item) => {
    if (payload.excludeId && item.id === payload.excludeId) return;
    if (item.date !== date) return;
    const overlap = startTime < item.endTime && endTime > item.startTime;
    if (!overlap) return;
    const decorated = decorateCourseSession(item);
    if (payload.teacherId && item.teacherId === payload.teacherId) {
      conflicts.push({
        type: 'teacher',
        label: '老师时间冲突',
        message: `${decorated.teacherName} 在 ${item.startTime}-${item.endTime} 已有 ${item.title}`,
        courseSessionId: item.id
      });
    }
    if (payload.classroomId && item.classroomId === payload.classroomId) {
      conflicts.push({
        type: 'classroom',
        label: '教室时间冲突',
        message: `${decorated.classroomName} 在 ${item.startTime}-${item.endTime} 已被占用`,
        courseSessionId: item.id
      });
    }
    if (payload.classId && item.classId === payload.classId) {
      conflicts.push({
        type: 'class',
        label: '班级时间冲突',
        message: `${decorated.className} 在 ${item.startTime}-${item.endTime} 已有课次`,
        courseSessionId: item.id
      });
    }
  });

  return {
    hasConflict: conflicts.length > 0,
    conflicts
  };
}

function validateFile(file, allowedExts, maxSize) {
  const fileName = file.fileName || file.name || '';
  const ext = getExt(fileName || file.ext);
  const size = Number(file.size || file.fileSize || 0);
  if (!allowedExts.includes(ext)) {
    throw makeError('UNSUPPORTED_FILE_TYPE', '文件类型不支持。');
  }
  if (size > maxSize) {
    throw makeError('FILE_TOO_LARGE', '文件过大。');
  }
  return { fileName, ext, size };
}

function canAccessFile(session, file) {
  if (!session || !file) return false;
  if (session.role === 'admin') return true;

  if (file.ownerType === 'assignment') {
    const assignment = db.assignments.find((item) => item.id === file.ownerId);
    if (!assignment) return false;
    if (session.role === 'teacher') return assignment.teacherId === session.teacherId;
    if (session.role === 'parent') {
      const student = findStudent(activeChildId(session));
      return Boolean(student && student.classId === assignment.classId);
    }
  }

  if (file.ownerType === 'wrongRecord') {
    const record = db.wrongRecords.find((item) => item.id === file.ownerId);
    if (!record) return false;
    if (session.role === 'teacher') return record.teacherId === session.teacherId;
    if (session.role === 'parent') return parentCanAccessStudent(session, record.studentId);
  }

  return false;
}

function adminOverview() {
  const today = '2026-06-03';
  const todaySessions = db.courseSessions.filter((item) => item.date === today);
  const conflictCount = db.courseSessions.reduce((sum, item) => {
    const result = checkScheduleConflictsRaw({
      ...item,
      excludeId: item.id
    });
    return sum + (result.hasConflict ? 1 : 0);
  }, 0);
  return {
    metrics: [
      { label: '老师数', value: db.teachers.length },
      { label: '学生数', value: db.students.length },
      { label: '教室数', value: db.classrooms.length },
      { label: '今日课次', value: todaySessions.length },
      { label: '冲突数', value: conflictCount },
      { label: '直播房间', value: db.liveRooms.length }
    ],
    liveRooms: db.liveRooms.map((item) => ({
      ...item,
      classroom: findClassroom(item.classroomId),
      courseSession: decorateCourseSession(findCourseSession(item.courseSessionId) || {})
    })),
    recentAuditLogs: db.auditLogs.slice(0, 8),
    todaySessions: todaySessions.map(decorateCourseSession)
  };
}

function parentDashboard(session) {
  const childId = activeChildId(session);
  const child = findStudent(childId);
  const sessions = filterCourseSessionsForSession(session).filter((item) => item.studentIds.includes(childId));
  const todayCourses = sessions.filter((item) => item.date === '2026-06-03').map(decorateCourseSession);
  const assignments = filterAssignmentsForSession(session).map(assignmentWithFile);
  const wrongRecords = filterWrongRecordsForSession(session)
    .filter((item) => item.studentId === childId)
    .map(wrongRecordWithFile);
  return {
    session,
    currentChild: child || null,
    children: db.students.filter((item) => parentStudentIds(session).includes(item.id)),
    metrics: [
      { label: '今日课程', value: todayCourses.length },
      { label: '待完成习题', value: assignments.filter((item) => item.status !== 'closed').length },
      { label: '待订正错题', value: wrongRecords.filter((item) => item.status !== 'corrected').length },
      { label: '可看直播', value: todayCourses.filter((item) => item.status === 'in_progress').length }
    ],
    todayCourses,
    pendingAssignments: assignments.filter((item) => item.status !== 'closed').slice(0, 4),
    pendingWrongRecords: wrongRecords.filter((item) => item.status !== 'corrected').slice(0, 4)
  };
}

function teacherDashboard(session) {
  const sessions = filterCourseSessionsForSession(session).map(decorateCourseSession);
  const assignments = filterAssignmentsForSession(session).map(assignmentWithFile);
  const wrongRecords = filterWrongRecordsForSession(session).map(wrongRecordWithFile);
  return {
    session,
    metrics: [
      { label: '今日授课', value: sessions.filter((item) => item.date === '2026-06-03').length },
      { label: '待上传测验', value: assignments.filter((item) => item.status === 'not_uploaded').length },
      { label: '待批改', value: assignments.reduce((sum, item) => sum + Number(item.pendingCount || 0), 0) },
      { label: '近期错题', value: wrongRecords.length }
    ],
    todayCourses: sessions.filter((item) => item.date === '2026-06-03'),
    pendingAssignments: assignments.filter((item) => item.status !== 'closed').slice(0, 5),
    recentWrongRecords: wrongRecords.slice(0, 5)
  };
}

function mockBindInvite(payload) {
  const invite = findInvite(payload.inviteCode);
  if (!invite || invite.status !== 'active') {
    throw makeError('INVITE_NOT_FOUND', '邀请码不存在。');
  }
  if (!invite.reusable && invite.useCount > 0) {
    throw makeError('INVITE_USED', '邀请码已被使用。');
  }
  if (invite.maxUses && invite.useCount >= invite.maxUses) {
    throw makeError('INVITE_USED', '邀请码使用次数已达上限。');
  }

  const accountId = getWechatAccountId(payload);
  const account = ensureWechatAccount(accountId, payload);
  db.currentWechatAccountId = accountId;

  if (invite.role === 'parent') {
    const student = findStudent(invite.targetId);
    if (!student) throw makeError('INVITE_TARGET_MISSING', '邀请码绑定的学生不存在。');
    const existing = db.identities.find((item) => (
      item.wechatAccountId === accountId && item.role === 'parent' && item.targetId === student.id
    ));
    if (existing) {
      throw makeError('DUPLICATE_BINDING', '重复绑定同一个学生。');
    }
    if (!payload.relation || !RELATIONS.includes(payload.relation)) {
      throw makeError('NEED_RELATION', '学生邀请码首次绑定需要选择亲属关系。', { relations: RELATIONS });
    }

    const identity = {
      id: nextId('identity_parent', db.identities),
      wechatAccountId: accountId,
      role: 'parent',
      targetId: student.id,
      relation: payload.relation,
      inviteCode: invite.code,
      createdAt: nowLabel()
    };
    db.identities.push(identity);
    db.guardianBindings.push({
      id: nextId('guardian', db.guardianBindings),
      wechatAccountId: accountId,
      studentId: student.id,
      relation: payload.relation,
      createdAt: nowLabel()
    });
    account.activeChildId = student.id;
    invite.useCount += 1;
    pushAudit(accountId, 'bind_invite', 'student', student.id, `绑定学生邀请码 ${invite.code}`);
    return activateIdentity(identity);
  }

  if (invite.role === 'teacher') {
    const teacher = findTeacher(invite.targetId);
    if (!teacher) throw makeError('INVITE_TARGET_MISSING', '邀请码绑定的老师不存在。');
    const existing = db.identities.find((item) => (
      item.wechatAccountId === accountId && item.role === 'teacher' && item.targetId === teacher.id
    ));
    if (existing) throw makeError('DUPLICATE_BINDING', '重复绑定同一个老师身份。');
    const identity = {
      id: nextId('identity_teacher', db.identities),
      wechatAccountId: accountId,
      role: 'teacher',
      targetId: teacher.id,
      inviteCode: invite.code,
      createdAt: nowLabel()
    };
    db.identities.push(identity);
    invite.useCount += 1;
    pushAudit(accountId, 'bind_invite', 'teacher', teacher.id, `绑定教师邀请码 ${invite.code}`);
    return activateIdentity(identity);
  }

  const admin = findAdmin(invite.targetId);
  if (!admin) throw makeError('INVITE_TARGET_MISSING', '邀请码绑定的管理员不存在。');
  const existing = db.identities.find((item) => (
    item.wechatAccountId === accountId && item.role === 'admin' && item.targetId === admin.id
  ));
  if (existing) throw makeError('DUPLICATE_BINDING', '重复绑定同一个管理员身份。');
  const identity = {
    id: nextId('identity_admin', db.identities),
    wechatAccountId: accountId,
    role: 'admin',
    targetId: admin.id,
    inviteCode: invite.code,
    createdAt: nowLabel()
  };
  db.identities.push(identity);
  invite.useCount += 1;
  pushAudit(accountId, 'bind_invite', 'admin', admin.id, `绑定管理员邀请码 ${invite.code}`);
  return activateIdentity(identity);
}

const mockApi = {
  bindInvite(payload = {}) {
    try {
      const session = mockBindInvite(payload);
      return delay(session);
    } catch (error) {
      return Promise.reject(error);
    }
  },

  listIdentities(payload = {}) {
    const accountId = getWechatAccountId(payload);
    ensureWechatAccount(accountId, payload);
    return delay(listAccountIdentities(accountId));
  },

  switchIdentity(identityId) {
    const accountId = getWechatAccountId();
    const identity = db.identities.find((item) => item.id === identityId && item.wechatAccountId === accountId);
    if (!identity) return Promise.reject(makeError('NO_PERMISSION', '当前账号没有权限。'));
    return delay(activateIdentity(identity));
  },

  logout() {
    activeSession = null;
    writeStoredSession(null);
    return delay({ ok: true });
  },

  getCurrentSession() {
    return delay(getSession());
  },

  getDashboard() {
    const session = requireSession();
    if (session.role === 'admin') return delay(adminOverview());
    if (session.role === 'teacher') return delay(teacherDashboard(session));
    return delay(parentDashboard(session));
  },

  getParentChildren() {
    const session = requireRole('parent');
    const ids = parentStudentIds(session);
    return delay(db.students.filter((item) => ids.includes(item.id)));
  },

  switchActiveChild(studentId) {
    const session = requireRole('parent');
    if (!parentCanAccessStudent(session, studentId)) {
      return Promise.reject(makeError('NO_PERMISSION', '当前账号没有权限。'));
    }
    const account = findWechatAccount(session.wechatAccountId);
    if (account) account.activeChildId = studentId;
    activeSession = { ...session, activeChildId: studentId };
    db.sessions[session.wechatAccountId] = activeSession;
    return delay(activeSession);
  },

  getParentCourses(payload = {}) {
    const session = requireRole('parent');
    const childId = payload.studentId || activeChildId(session);
    if (!parentCanAccessStudent(session, childId)) {
      return Promise.reject(makeError('NO_PERMISSION', '当前账号没有权限。'));
    }
    const courses = filterCourseSessionsForSession(session)
      .filter((item) => item.studentIds.includes(childId))
      .map(decorateCourseSession);
    return delay({
      currentChild: findStudent(childId),
      courses
    });
  },

  getParentExercises(payload = {}) {
    const session = requireRole('parent');
    const childId = payload.studentId || activeChildId(session);
    if (!parentCanAccessStudent(session, childId)) {
      return Promise.reject(makeError('NO_PERMISSION', '当前账号没有权限。'));
    }
    const student = findStudent(childId);
    let assignments = db.assignments
      .filter((item) => student && item.classId === student.classId)
      .map(assignmentWithFile);
    let wrongRecords = db.wrongRecords
      .filter((item) => item.studentId === childId)
      .map(wrongRecordWithFile);

    if (payload.courseId) {
      assignments = assignments.filter((item) => item.courseId === payload.courseId);
      wrongRecords = wrongRecords.filter((item) => item.courseId === payload.courseId);
    }
    if (payload.status) {
      assignments = assignments.filter((item) => item.status === payload.status);
      wrongRecords = wrongRecords.filter((item) => item.status === payload.status);
    }

    return delay({
      currentChild: student,
      assignments,
      wrongRecords
    });
  },

  getTeacherCourses() {
    const session = requireRole('teacher');
    const courses = filterCourseSessionsForSession(session).map((item) => {
      const classItem = findClass(item.classId);
      return {
        ...decorateCourseSession(item),
        students: db.students.filter((student) => classItem && classItem.studentIds.includes(student.id)),
        assignments: db.assignments.filter((assignment) => assignment.courseSessionId === item.id).map(assignmentWithFile),
        wrongRecords: db.wrongRecords.filter((record) => record.courseSessionId === item.id).map(wrongRecordWithFile)
      };
    });
    return delay({ courses });
  },

  uploadAssignmentFile(payload = {}) {
    const session = requireRole(['teacher', 'admin']);
    const courseSession = findCourseSession(payload.courseSessionId);
    if (!courseSession || !canAccessCourseSession(session, courseSession)) {
      return Promise.reject(makeError('NO_PERMISSION', '当前账号没有权限。'));
    }
    const fileInfo = validateFile(payload, DOC_EXTS, DOC_MAX_SIZE);
    const assignmentId = payload.assignmentId || nextId('assignment', db.assignments);
    const file = {
      id: nextId('file', db.files),
      name: fileInfo.fileName,
      ext: fileInfo.ext,
      mimeType: fileInfo.ext === 'pdf' ? 'application/pdf' : 'application/msword',
      size: fileInfo.size,
      ownerType: 'assignment',
      ownerId: assignmentId,
      uploadedBy: session.teacherId || session.adminId,
      uploadedAt: nowLabel(),
      fileID: payload.fileID || '',
      downloadUrl: payload.downloadUrl || '',
      placeholder: !payload.fileID && !payload.downloadUrl
    };
    db.files.unshift(file);

    let assignment = db.assignments.find((item) => item.id === payload.assignmentId);
    if (assignment) {
      assignment.fileId = file.id;
      assignment.status = payload.status || 'pending_grading';
    } else {
      assignment = {
        id: assignmentId,
        courseSessionId: courseSession.id,
        courseId: courseSession.courseId,
        classId: courseSession.classId,
        teacherId: courseSession.teacherId,
        type: payload.type || 'pre',
        title: payload.title || '未命名测验',
        status: payload.status || 'pending_grading',
        fileId: file.id,
        dueAt: payload.dueAt || '',
        pendingCount: payload.pendingCount || 0,
        gradedCount: 0,
        totalCount: payload.totalCount || 0
      };
      db.assignments.unshift(assignment);
    }

    pushAudit(session.identityId, 'upload_assignment_file', 'assignment', assignment.id, `上传测验文件 ${file.name}`);
    return delay({ file, assignment: assignmentWithFile(assignment) });
  },

  uploadWrongRecordImage(payload = {}) {
    const session = requireRole(['teacher', 'admin']);
    const fileInfo = validateFile(payload, IMAGE_EXTS, IMAGE_MAX_SIZE);
    const file = {
      id: nextId('file', db.files),
      name: fileInfo.fileName,
      ext: fileInfo.ext,
      mimeType: `image/${fileInfo.ext === 'jpg' ? 'jpeg' : fileInfo.ext}`,
      size: fileInfo.size,
      ownerType: 'wrongRecord',
      ownerId: payload.wrongRecordId || '',
      uploadedBy: session.teacherId || session.adminId,
      uploadedAt: nowLabel(),
      fileID: payload.fileID || '',
      downloadUrl: payload.downloadUrl || '',
      placeholder: !payload.fileID && !payload.downloadUrl
    };
    db.files.unshift(file);
    return delay(file);
  },

  createWrongRecord(payload = {}) {
    const session = requireRole(['teacher', 'admin']);
    const student = findStudent(payload.studentId);
    if (!student) return Promise.reject(makeError('NOT_FOUND', '学生不存在。'));
    if (session.role === 'teacher' && !teacherCanAccessClass(session, student.classId)) {
      return Promise.reject(makeError('NO_PERMISSION', '当前账号没有权限。'));
    }
    const courseSession = payload.courseSessionId ? findCourseSession(payload.courseSessionId) : null;
    const record = {
      id: nextId('wrong', db.wrongRecords),
      studentId: student.id,
      studentName: student.name,
      courseSessionId: courseSession ? courseSession.id : '',
      courseId: courseSession ? courseSession.courseId : payload.courseId || '',
      classId: student.classId,
      teacherId: session.teacherId || payload.teacherId || '',
      subject: payload.subject || (courseSession ? (findCourse(courseSession.courseId) || {}).subject : ''),
      topic: payload.topic || '待补充知识点',
      source: payload.source || '老师手动导入',
      mistakeReason: payload.mistakeReason || '待补充错因',
      correction: payload.correction || '待学生订正后复盘。',
      imageFileId: payload.imageFileId || '',
      status: 'todo',
      tags: payload.tags || ['老师导入'],
      createdAt: nowLabel()
    };
    db.wrongRecords.unshift(record);
    const file = payload.imageFileId ? db.files.find((item) => item.id === payload.imageFileId) : null;
    if (file) file.ownerId = record.id;
    pushAudit(session.identityId, 'create_wrong_record', 'wrongRecord', record.id, `创建错题记录 ${student.name}`);
    return delay(wrongRecordWithFile(record));
  },

  getAdminOverview() {
    requireRole('admin');
    return delay(adminOverview());
  },

  createTeacher(payload = {}) {
    const session = requireRole('admin');
    if (!payload.name || !payload.phone) {
      return Promise.reject(makeError('VALIDATION_ERROR', '请填写老师姓名和手机号。'));
    }
    const teacher = {
      id: nextId('teacher', db.teachers),
      name: payload.name,
      phone: payload.phone,
      subjects: payload.subjects || (payload.subject ? [payload.subject] : []),
      title: payload.title || '任课老师',
      status: 'active'
    };
    db.teachers.push(teacher);
    pushAudit(session.identityId, 'create_teacher', 'teacher', teacher.id, `录入教师 ${teacher.name}`);
    return delay(teacher);
  },

  createStudent(payload = {}) {
    const session = requireRole('admin');
    if (!payload.name || !payload.classId) {
      return Promise.reject(makeError('VALIDATION_ERROR', '请填写学生姓名和班级。'));
    }
    const classItem = findClass(payload.classId);
    if (!classItem) return Promise.reject(makeError('NOT_FOUND', '班级不存在。'));
    const student = {
      id: nextId('stu', db.students),
      name: payload.name,
      grade: payload.grade || classItem.grade,
      classId: classItem.id,
      className: classItem.name,
      status: 'active',
      primaryGuardian: payload.primaryGuardian || '',
      guardianPhone: payload.guardianPhone || ''
    };
    db.students.push(student);
    classItem.studentIds.push(student.id);
    pushAudit(session.identityId, 'create_student', 'student', student.id, `录入学生 ${student.name}`);
    return delay(student);
  },

  createClassroom(payload = {}) {
    const session = requireRole('admin');
    if (!payload.name) return Promise.reject(makeError('VALIDATION_ERROR', '请填写教室名称。'));
    const classroom = {
      id: nextId('room', db.classrooms),
      name: payload.name,
      capacity: Number(payload.capacity || 20),
      campus: payload.campus || '主校区',
      cameraStatus: payload.cameraStatus || 'pending',
      streamPlaceholder: payload.streamPlaceholder || ''
    };
    db.classrooms.push(classroom);
    pushAudit(session.identityId, 'create_classroom', 'classroom', classroom.id, `录入教室 ${classroom.name}`);
    return delay(classroom);
  },

  createCourse(payload = {}) {
    const session = requireRole('admin');
    if (!payload.name || !payload.subject) {
      return Promise.reject(makeError('VALIDATION_ERROR', '请填写课程名称和科目。'));
    }
    const course = {
      id: nextId('course', db.courses),
      name: payload.name,
      subject: payload.subject,
      grade: payload.grade || '',
      defaultDurationMinutes: Number(payload.defaultDurationMinutes || 90),
      status: 'active'
    };
    db.courses.push(course);
    pushAudit(session.identityId, 'create_course', 'course', course.id, `录入课程 ${course.name}`);
    return delay(course);
  },

  checkScheduleConflicts(payload = {}) {
    requireRole('admin');
    return delay(checkScheduleConflictsRaw(payload));
  },

  createCourseSession(payload = {}) {
    const session = requireRole('admin');
    const required = ['courseId', 'classId', 'teacherId', 'classroomId', 'date', 'startTime', 'endTime'];
    const missing = required.filter((key) => !payload[key]);
    if (missing.length) {
      return Promise.reject(makeError('VALIDATION_ERROR', '请完整填写排课信息。', { missing }));
    }
    const conflict = checkScheduleConflictsRaw(payload);
    if (conflict.hasConflict) {
      return Promise.reject(makeError('SCHEDULE_CONFLICT', '排课冲突。', conflict));
    }
    const course = findCourse(payload.courseId);
    const classItem = findClass(payload.classId);
    const teacher = findTeacher(payload.teacherId);
    const classroom = findClassroom(payload.classroomId);
    if (!course || !classItem || !teacher || !classroom) {
      return Promise.reject(makeError('NOT_FOUND', '课程、班级、老师或教室不存在。'));
    }
    const courseSession = {
      id: nextId('cs', db.courseSessions),
      courseId: course.id,
      title: payload.title || course.name,
      date: payload.date,
      startTime: payload.startTime,
      endTime: payload.endTime,
      teacherId: teacher.id,
      classroomId: classroom.id,
      classId: classItem.id,
      studentIds: classItem.studentIds.slice(),
      status: payload.status || 'scheduled',
      statusText: payload.statusText || '未开始',
      liveRoomId: '',
      note: payload.note || ''
    };
    db.courseSessions.push(courseSession);
    const liveRoom = {
      id: nextId('live_room', db.liveRooms),
      courseSessionId: courseSession.id,
      classroomId: classroom.id,
      status: 'scheduled',
      statusText: '待上课开放',
      streamUrl: '',
      provider: 'placeholder',
      lastHeartbeatAt: '',
      note: '演示数据，暂无真实播放流。'
    };
    db.liveRooms.push(liveRoom);
    courseSession.liveRoomId = liveRoom.id;
    pushAudit(session.identityId, 'create_course_session', 'courseSession', courseSession.id, `创建课次 ${courseSession.title}`);
    return delay(decorateCourseSession(courseSession));
  },

  createInvite(payload = {}) {
    const session = requireRole('admin');
    const role = payload.role || 'parent';
    const targetId = payload.targetId || payload.studentId || payload.teacherId || payload.adminId || '';
    if (!['parent', 'teacher', 'admin'].includes(role)) {
      return Promise.reject(makeError('VALIDATION_ERROR', '邀请码角色不正确。'));
    }
    if (!targetId) return Promise.reject(makeError('VALIDATION_ERROR', '请设置邀请码绑定目标。'));

    const prefix = role === 'parent' ? 'STUDENT' : role.toUpperCase();
    const code = normalizeCode(payload.code) || `${prefix}-${Math.floor(Math.random() * 9000 + 1000)}`;
    if (findInvite(code)) return Promise.reject(makeError('VALIDATION_ERROR', '邀请码已存在。'));

    const invite = {
      id: nextId('invite', db.inviteCodes),
      code,
      role,
      targetType: role === 'parent' ? 'student' : role,
      targetId,
      targetName: payload.targetName || '',
      reusable: payload.reusable !== false,
      maxUses: Number(payload.maxUses || 0),
      useCount: 0,
      status: 'active',
      expiresAt: payload.expiresAt || '',
      createdBy: session.adminId,
      note: payload.note || ''
    };
    db.inviteCodes.unshift(invite);
    pushAudit(session.identityId, 'create_invite', 'inviteCode', invite.id, `生成邀请码 ${invite.code}`);
    return delay(invite);
  },

  getCourseDetail(courseSessionId) {
    const session = requireSession();
    const courseSession = findCourseSession(courseSessionId);
    if (!courseSession) return Promise.reject(makeError('NOT_FOUND', '课次不存在。'));
    if (!canAccessCourseSession(session, courseSession)) {
      return Promise.reject(makeError('NO_PERMISSION', '当前账号没有权限。'));
    }
    const classItem = findClass(courseSession.classId);
    const detail = {
      courseSession: decorateCourseSession(courseSession),
      course: findCourse(courseSession.courseId),
      classInfo: classItem,
      teacher: findTeacher(courseSession.teacherId),
      classroom: findClassroom(courseSession.classroomId),
      liveRoom: findLiveRoomBySession(courseSession.id),
      assignments: db.assignments.filter((item) => item.courseSessionId === courseSession.id).map(assignmentWithFile),
      wrongRecords: db.wrongRecords.filter((item) => item.courseSessionId === courseSession.id).map(wrongRecordWithFile),
      students: session.role === 'parent'
        ? db.students.filter((item) => parentCanAccessStudent(session, item.id) && courseSession.studentIds.includes(item.id))
        : db.students.filter((item) => classItem && classItem.studentIds.includes(item.id))
    };
    return delay(detail);
  },

  requestLiveTicket(courseSessionId) {
    const session = requireSession();
    const courseSession = findCourseSession(courseSessionId);
    if (!courseSession || !canAccessCourseSession(session, courseSession)) {
      return Promise.reject(makeError('NO_PERMISSION', '当前账号没有权限。'));
    }
    const liveRoom = findLiveRoomBySession(courseSession.id);
    if (!liveRoom || courseSession.status !== 'in_progress' || liveRoom.status !== 'open') {
      return Promise.reject(makeError('LIVE_NOT_OPEN', '直播未开放。'));
    }
    if (!liveRoom.streamUrl) {
      return delay({
        courseSessionId,
        liveRoomId: liveRoom.id,
        status: 'placeholder',
        streamUrl: '',
        expiresIn: 600,
        message: '直播待接入：演示数据，暂无真实播放流。'
      });
    }
    return delay({
      courseSessionId,
      liveRoomId: liveRoom.id,
      status: 'ready',
      streamUrl: liveRoom.streamUrl,
      expiresIn: 600,
      message: '直播播放地址已签发。'
    });
  },

  getFilePreview(fileId) {
    const session = requireSession();
    const file = db.files.find((item) => item.id === fileId);
    if (!file) return Promise.reject(makeError('NOT_FOUND', '文件不存在。'));
    if (!canAccessFile(session, file)) {
      return Promise.reject(makeError('NO_PERMISSION', '当前账号没有权限。'));
    }
    return delay({
      file,
      canPreview: Boolean(file.fileID || file.downloadUrl),
      canDownload: Boolean(file.fileID || file.downloadUrl),
      placeholderStatus: file.fileID || file.downloadUrl ? 'ready' : 'not_connected',
      message: file.fileID || file.downloadUrl ? '文件可预览。' : '文件预览待接入：暂无真实 fileID 或下载地址。'
    });
  },

  getBootstrap() {
    return delay({
      session: getSession(),
      students: db.students,
      teachers: db.teachers,
      admins: db.admins,
      classes: db.classes,
      classrooms: db.classrooms,
      courses: db.courses,
      courseSessions: db.courseSessions.map(decorateCourseSession),
      inviteCodes: db.inviteCodes,
      demoInvites: config.demoInvites
    });
  },

  getSchedule() {
    const session = requireSession();
    return delay(filterCourseSessionsForSession(session).map(decorateCourseSession));
  },

  getLiveRooms() {
    const session = requireSession();
    const sessions = filterCourseSessionsForSession(session);
    const sessionIds = sessions.map((item) => item.id);
    return delay(db.liveRooms
      .filter((item) => session.role === 'admin' || sessionIds.includes(item.courseSessionId))
      .map((item) => ({
        ...item,
        courseSession: decorateCourseSession(findCourseSession(item.courseSessionId) || {}),
        playerReady: Boolean(item.streamUrl),
        placeholder: !item.streamUrl
      })));
  },

  getTests() {
    const session = requireSession();
    return delay(filterAssignmentsForSession(session).map(assignmentWithFile));
  },

  importTest(payload = {}) {
    return this.uploadAssignmentFile({
      ...payload,
      courseSessionId: payload.courseSessionId || 'cs_001',
      fileName: payload.fileName || payload.name || 'demo.pdf',
      size: payload.size || 1024
    }).then((result) => result.assignment);
  },

  markOneGraded(assignmentId) {
    const session = requireRole(['teacher', 'admin']);
    const assignment = db.assignments.find((item) => item.id === assignmentId);
    if (!assignment) return Promise.reject(makeError('NOT_FOUND', '测试不存在。'));
    if (session.role === 'teacher' && assignment.teacherId !== session.teacherId) {
      return Promise.reject(makeError('NO_PERMISSION', '当前账号没有权限。'));
    }
    if (assignment.pendingCount > 0) {
      assignment.pendingCount -= 1;
      assignment.gradedCount += 1;
      assignment.status = assignment.pendingCount === 0 ? 'closed' : 'grading';
    }
    return delay(assignmentWithFile(assignment));
  },

  getWrongRecords() {
    const session = requireSession();
    return delay(filterWrongRecordsForSession(session).map(wrongRecordWithFile));
  },

  addWrongRecord(payload = {}) {
    return this.createWrongRecord(payload);
  },

  createStudentGuardian(payload = {}) {
    return this.createStudent({
      name: payload.studentName,
      grade: payload.grade,
      classId: payload.classId,
      primaryGuardian: payload.guardianName,
      guardianPhone: payload.guardianPhone
    }).then((student) => this.createInvite({
      role: 'parent',
      targetId: student.id,
      targetName: student.name
    }).then((invite) => ({ student, inviteCode: invite.code })));
  },

  createSchedule(payload = {}) {
    return this.createCourseSession({
      courseId: payload.courseId || 'course_001',
      title: payload.title,
      classId: payload.classId,
      teacherId: payload.teacherId || 'teacher_001',
      classroomId: payload.classroomId,
      date: payload.date,
      startTime: payload.startTime,
      endTime: payload.endTime
    });
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
