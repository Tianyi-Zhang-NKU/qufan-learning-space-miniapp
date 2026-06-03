const http = require('http');
const url = require('url');
const db = require('../services/mock-db');

const PORT = 8787;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function send(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-demo-user'
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        resolve({});
      }
    });
  });
}

function findSession(req) {
  const userId = req.headers['x-demo-user'];
  if (userId && db.sessions[userId]) return db.sessions[userId];
  return Object.values(db.sessions)[0] || null;
}

function findStudent(studentId) {
  return db.students.find((student) => student.id === studentId);
}

function roleSchedule(session) {
  if (!session) return db.schedule;
  if (session.role === 'parent') {
    return db.schedule.filter((item) => item.studentIds.some((id) => session.studentIds.includes(id)));
  }
  if (session.role === 'teacher') {
    return db.schedule.filter((item) => item.teacherId === session.teacherId);
  }
  return db.schedule;
}

function roleTests(session) {
  if (!session) return db.tests;
  if (session.role === 'teacher') {
    return db.tests.filter((item) => item.teacherId === session.teacherId);
  }
  if (session.role === 'parent') {
    const student = findStudent(session.studentIds[0]);
    return db.tests.filter((item) => student && item.classId === student.classId);
  }
  return db.tests;
}

function roleWrongRecords(session) {
  if (!session) return db.wrongRecords;
  if (session.role === 'parent') {
    return db.wrongRecords.filter((item) => session.studentIds.includes(item.studentId));
  }
  if (session.role === 'teacher') {
    const classIds = session.classIds || [];
    const classNames = db.classes.filter((item) => classIds.includes(item.id)).map((item) => item.name);
    return db.wrongRecords.filter((item) => classNames.includes(item.className));
  }
  return db.wrongRecords;
}

function canWatch(room, session) {
  if (!session) return false;
  if (session.role === 'admin' || session.role === 'teacher') return true;
  return room.authorizedStudentIds.some((id) => session.studentIds.includes(id));
}

function dashboard(session) {
  const schedule = roleSchedule(session);
  const tests = roleTests(session);
  const wrongRecords = roleWrongRecords(session);
  const liveRooms = db.liveRooms.filter((room) => canWatch(room, session));
  const todaySchedule = schedule.filter((item) => item.date === '2026-06-03');

  return {
    session,
    metrics: [
      { label: '今日课程', value: todaySchedule.length },
      { label: '已发布测验', value: tests.filter((item) => item.status !== '未发布').length },
      { label: '错题记录', value: wrongRecords.length },
      { label: '可看直播', value: liveRooms.length }
    ],
    todaySchedule,
    liveRooms,
    recentWrongRecords: wrongRecords.slice(0, 2),
    pendingTests: tests.filter((item) => item.pendingCount > 0).slice(0, 3)
  };
}

function nowLabel() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function handle(req, res) {
  if (req.method === 'OPTIONS') {
    send(res, 204, {});
    return;
  }

  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;
  const session = findSession(req);

  if (req.method === 'GET' && path === '/api/health') {
    send(res, 200, { ok: true, service: 'qufan-learning-space-demo-backend' });
    return;
  }

  if (req.method === 'POST' && path === '/api/auth/bind-invite') {
    const body = await readBody(req);
    const invite = db.invites[String(body.inviteCode || '').trim().toUpperCase()];
    if (!invite) {
      send(res, 404, { message: '邀请码不存在，请联系教务老师确认。' });
      return;
    }

    const newSession = {
      userId: invite.userId,
      name: invite.name,
      phone: body.phone || invite.phone,
      role: invite.role,
      studentIds: invite.studentIds || [],
      teacherId: invite.teacherId || '',
      classIds: invite.classIds || [],
      campusId: invite.campusId || '',
      inviteCode: body.inviteCode
    };
    db.sessions[newSession.userId] = newSession;
    send(res, 200, clone(newSession));
    return;
  }

  if (req.method === 'GET' && path === '/api/bootstrap') {
    send(res, 200, clone({
      session,
      students: db.students,
      teachers: db.teachers,
      classes: db.classes,
      classrooms: db.classrooms
    }));
    return;
  }

  if (req.method === 'GET' && path === '/api/dashboard') {
    send(res, 200, clone(dashboard(session)));
    return;
  }

  if (req.method === 'GET' && path === '/api/schedule') {
    send(res, 200, clone(roleSchedule(session)));
    return;
  }

  if (req.method === 'GET' && path === '/api/live/rooms') {
    send(res, 200, clone(db.liveRooms.map((room) => ({
      ...room,
      canWatch: canWatch(room, session),
      playerReady: Boolean(room.streamUrl)
    }))));
    return;
  }

  if (req.method === 'GET' && path === '/api/live/ticket') {
    const room = db.liveRooms.find((item) => item.id === parsed.query.roomId);
    if (!room) {
      send(res, 404, { message: '直播教室不存在。' });
      return;
    }
    if (!canWatch(room, session)) {
      send(res, 403, { message: '当前账号无权查看该教室。' });
      return;
    }
    send(res, 200, {
      roomId: room.id,
      expiresIn: 600,
      streamUrl: room.streamUrl,
      note: room.streamUrl ? '正式播放地址已签发。' : 'demo 暂未配置真实流地址，待线下硬件联调后由后端签发。'
    });
    return;
  }

  if (req.method === 'GET' && path === '/api/tests') {
    send(res, 200, clone(roleTests(session)));
    return;
  }

  if (req.method === 'POST' && path === '/api/tests/import') {
    const body = await readBody(req);
    const newTest = {
      id: `test_${Date.now()}`,
      type: body.type || 'pre',
      title: body.title || '未命名测试',
      subject: body.subject || '综合',
      classId: body.classId || 'class_001',
      className: body.className || '初二数学 A 班',
      teacherId: session && session.teacherId ? session.teacherId : 'teacher_001',
      fileName: body.fileName || 'demo.pdf',
      fileType: body.fileType || 'pdf',
      uploadedAt: nowLabel(),
      status: '已发布',
      pendingCount: body.totalCount || 18,
      gradedCount: 0,
      totalCount: body.totalCount || 18,
      note: 'demo 已保存文件元信息，正式版接云存储 fileID。'
    };
    db.tests.unshift(newTest);
    send(res, 200, clone(newTest));
    return;
  }

  if (req.method === 'POST' && path === '/api/tests/grade') {
    const body = await readBody(req);
    const test = db.tests.find((item) => item.id === body.testId);
    if (!test) {
      send(res, 404, { message: '测试不存在。' });
      return;
    }
    if (test.pendingCount > 0) {
      test.pendingCount -= 1;
      test.gradedCount += 1;
      test.status = test.pendingCount === 0 ? '已完成' : '已发布';
    }
    send(res, 200, clone(test));
    return;
  }

  if (req.method === 'GET' && path === '/api/wrong-records') {
    send(res, 200, clone(roleWrongRecords(session)));
    return;
  }

  if (req.method === 'POST' && path === '/api/wrong-records') {
    const body = await readBody(req);
    const student = findStudent(body.studentId) || db.students[0];
    const record = {
      id: `wrong_${Date.now()}`,
      studentId: student.id,
      studentName: student.name,
      subject: body.subject || '数学',
      topic: body.topic || '待补充知识点',
      source: body.source || '老师手动导入',
      className: student.className,
      teacherName: '周老师',
      mistakeReason: body.mistakeReason || '老师录入后补充错因',
      correction: body.correction || '待学生订正后复盘。',
      imageUrl: body.imageUrl || '',
      createdAt: '2026-06-03',
      status: '待复盘',
      tags: body.tags || ['老师导入']
    };
    db.wrongRecords.unshift(record);
    send(res, 200, clone(record));
    return;
  }

  if (req.method === 'POST' && path === '/api/invites') {
    const body = await readBody(req);
    const role = body.role || 'parent';
    const inviteCode = `${role.toUpperCase()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    db.invites[inviteCode] = {
      role,
      userId: `u_${role}_${Date.now()}`,
      name: body.name || '新用户',
      phone: body.phone || '',
      studentIds: body.studentId ? [body.studentId] : [],
      teacherId: body.teacherId || '',
      classIds: body.classId ? [body.classId] : []
    };
    send(res, 200, clone({ inviteCode, invite: db.invites[inviteCode] }));
    return;
  }

  if (req.method === 'POST' && path === '/api/students') {
    const body = await readBody(req);
    const classItem = db.classes.find((item) => item.id === body.classId) || db.classes[0];
    const student = {
      id: `stu_${Date.now()}`,
      name: body.studentName || '新学生',
      classId: classItem.id,
      className: classItem.name,
      guardianName: body.guardianName || '家长',
      guardianPhone: body.guardianPhone || ''
    };
    db.students.push(student);

    const inviteCode = `PARENT-${Math.floor(Math.random() * 9000 + 1000)}`;
    db.invites[inviteCode] = {
      role: 'parent',
      userId: `u_parent_${Date.now()}`,
      name: student.guardianName,
      phone: student.guardianPhone,
      studentIds: [student.id]
    };

    send(res, 200, clone({ student, inviteCode }));
    return;
  }

  if (req.method === 'POST' && path === '/api/schedule') {
    const body = await readBody(req);
    const classItem = db.classes.find((item) => item.id === body.classId) || db.classes[0];
    const classroom = db.classrooms.find((item) => item.id === body.classroomId) || db.classrooms[0];
    const teacher = db.teachers.find((item) => item.id === body.teacherId) || db.teachers[0];
    const schedule = {
      id: `sch_${Date.now()}`,
      date: body.date || '2026-06-05',
      weekday: body.weekday || '待确认',
      startTime: body.startTime || '18:30',
      endTime: body.endTime || '20:00',
      subject: body.subject || '综合',
      title: body.title || '新课程',
      classId: classItem.id,
      className: classItem.name,
      teacherId: teacher.id,
      teacherName: teacher.name,
      classroomId: classroom.id,
      classroomName: classroom.name,
      status: '未开始',
      studentIds: db.students.filter((student) => student.classId === classItem.id).map((student) => student.id)
    };
    db.schedule.unshift(schedule);
    send(res, 200, clone(schedule));
    return;
  }

  send(res, 404, { message: 'Not found' });
}

http.createServer(handle).listen(PORT, '127.0.0.1', () => {
  console.log(`趣帆学习空间 demo backend listening at http://127.0.0.1:${PORT}`);
});
