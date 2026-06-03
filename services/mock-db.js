function twoDigit(value) {
  return String(value).padStart(2, '0');
}

function classroomStatus(index) {
  if (index === 1 || index === 8 || index === 12) return 'ready';
  if (index === 3) return 'testing';
  return 'pending';
}

const classrooms = Array.from({ length: 15 }, (_, index) => {
  const no = index + 1;
  const code = twoDigit(no);
  return {
    id: `room_${code}`,
    name: `${no}号教室`,
    capacity: no <= 5 ? 18 : 24,
    campus: '主校区',
    cameraStatus: classroomStatus(no),
    streamPlaceholder: `classroom-${code}`
  };
});

const db = {
  currentWechatAccountId: 'wx_demo_001',
  sessions: {},

  wechatAccounts: [
    {
      id: 'wx_demo_001',
      nickname: '微信演示账号',
      phone: '13800000001',
      avatarUrl: '',
      activeIdentityId: '',
      activeChildId: ''
    },
    {
      id: 'wx_guardian_002',
      nickname: '第二家长账号',
      phone: '13800000009',
      avatarUrl: '',
      activeIdentityId: '',
      activeChildId: ''
    }
  ],

  identities: [],

  inviteCodes: [
    {
      id: 'invite_student_001',
      code: 'STUDENT-001',
      role: 'parent',
      targetType: 'student',
      targetId: 'stu_001',
      targetName: '陈一诺',
      reusable: true,
      maxUses: 0,
      useCount: 0,
      status: 'active',
      expiresAt: '',
      createdBy: 'admin_001',
      note: '学生邀请码长期有效，可被多个微信账号绑定。'
    },
    {
      id: 'invite_teacher_2026',
      code: 'TEACHER-2026',
      role: 'teacher',
      targetType: 'teacher',
      targetId: 'teacher_001',
      targetName: '周老师',
      reusable: true,
      maxUses: 20,
      useCount: 0,
      status: 'active',
      expiresAt: '2026-12-31',
      createdBy: 'admin_001',
      note: '教师邀请码绑定到指定老师档案。'
    },
    {
      id: 'invite_admin_2026',
      code: 'ADMIN-2026',
      role: 'admin',
      targetType: 'admin',
      targetId: 'admin_001',
      targetName: '教务管理员',
      reusable: true,
      maxUses: 10,
      useCount: 0,
      status: 'active',
      expiresAt: '2026-12-31',
      createdBy: 'admin_001',
      note: '管理员邀请码绑定到机构教务管理员档案。'
    }
  ],

  guardianBindings: [],

  students: [
    {
      id: 'stu_001',
      name: '陈一诺',
      grade: '初二',
      classId: 'class_001',
      className: '初二数学A班',
      status: 'active',
      primaryGuardian: '林女士',
      guardianPhone: '13800000001'
    },
    {
      id: 'stu_002',
      name: '许知远',
      grade: '初二',
      classId: 'class_001',
      className: '初二数学A班',
      status: 'active',
      primaryGuardian: '许先生',
      guardianPhone: '13800000009'
    },
    {
      id: 'stu_003',
      name: '姜明澈',
      grade: '初三',
      classId: 'class_002',
      className: '初三物理冲刺班',
      status: 'active',
      primaryGuardian: '姜女士',
      guardianPhone: '13800000011'
    }
  ],

  teachers: [
    {
      id: 'teacher_001',
      name: '周老师',
      phone: '13800000002',
      subjects: ['数学', '物理'],
      title: '主讲老师',
      status: 'active'
    },
    {
      id: 'teacher_002',
      name: '王老师',
      phone: '13800000012',
      subjects: ['英语'],
      title: '英语老师',
      status: 'active'
    }
  ],

  admins: [
    {
      id: 'admin_001',
      name: '教务管理员',
      phone: '13800000003',
      campus: '主校区',
      roleTitle: '机构教务管理员',
      status: 'active'
    }
  ],

  classrooms,

  classes: [
    {
      id: 'class_001',
      name: '初二数学A班',
      subject: '数学',
      grade: '初二',
      mainTeacherId: 'teacher_001',
      studentIds: ['stu_001', 'stu_002'],
      defaultClassroomId: 'room_08',
      status: 'active'
    },
    {
      id: 'class_002',
      name: '初三物理冲刺班',
      subject: '物理',
      grade: '初三',
      mainTeacherId: 'teacher_001',
      studentIds: ['stu_003'],
      defaultClassroomId: 'room_12',
      status: 'active'
    },
    {
      id: 'class_003',
      name: '初一英语提高班',
      subject: '英语',
      grade: '初一',
      mainTeacherId: 'teacher_002',
      studentIds: [],
      defaultClassroomId: 'room_03',
      status: 'active'
    }
  ],

  courses: [
    {
      id: 'course_001',
      name: '一次函数专题',
      subject: '数学',
      grade: '初二',
      defaultDurationMinutes: 90,
      status: 'active'
    },
    {
      id: 'course_002',
      name: '浮力与压强专题',
      subject: '物理',
      grade: '初三',
      defaultDurationMinutes: 90,
      status: 'active'
    },
    {
      id: 'course_003',
      name: '英语阅读精讲',
      subject: '英语',
      grade: '初一',
      defaultDurationMinutes: 90,
      status: 'active'
    }
  ],

  courseSessions: [
    {
      id: 'cs_001',
      courseId: 'course_001',
      title: '一次函数综合提升',
      date: '2026-06-03',
      startTime: '18:30',
      endTime: '20:00',
      teacherId: 'teacher_001',
      classroomId: 'room_08',
      classId: 'class_001',
      studentIds: ['stu_001', 'stu_002'],
      status: 'in_progress',
      statusText: '正在进行',
      liveRoomId: 'live_room_001',
      note: '正在进行的演示课，家长可进入直播占位页。'
    },
    {
      id: 'cs_002',
      courseId: 'course_002',
      title: '浮力与压强专题',
      date: '2026-06-03',
      startTime: '20:10',
      endTime: '21:40',
      teacherId: 'teacher_001',
      classroomId: 'room_12',
      classId: 'class_002',
      studentIds: ['stu_003'],
      status: 'scheduled',
      statusText: '未开始',
      liveRoomId: 'live_room_002',
      note: '待上课后开放直播。'
    },
    {
      id: 'cs_003',
      courseId: 'course_003',
      title: '阅读理解精讲',
      date: '2026-06-04',
      startTime: '18:30',
      endTime: '20:00',
      teacherId: 'teacher_002',
      classroomId: 'room_03',
      classId: 'class_003',
      studentIds: [],
      status: 'scheduled',
      statusText: '未开始',
      liveRoomId: 'live_room_003',
      note: '教室硬件待联调。'
    },
    {
      id: 'cs_004',
      courseId: 'course_001',
      title: '函数图像复盘',
      date: '2026-06-01',
      startTime: '18:30',
      endTime: '20:00',
      teacherId: 'teacher_001',
      classroomId: 'room_08',
      classId: 'class_001',
      studentIds: ['stu_001', 'stu_002'],
      status: 'finished',
      statusText: '已结束',
      liveRoomId: 'live_room_001',
      note: '历史课次。'
    }
  ],

  assignments: [
    {
      id: 'assignment_001',
      courseSessionId: 'cs_001',
      courseId: 'course_001',
      classId: 'class_001',
      teacherId: 'teacher_001',
      type: 'pre',
      title: '一次函数课前测',
      status: 'grading',
      fileId: 'file_pdf_001',
      dueAt: '2026-06-03 18:20',
      pendingCount: 6,
      gradedCount: 12,
      totalCount: 18
    },
    {
      id: 'assignment_002',
      courseSessionId: 'cs_002',
      courseId: 'course_002',
      classId: 'class_002',
      teacherId: 'teacher_001',
      type: 'post',
      title: '浮力专题课后测',
      status: 'pending_grading',
      fileId: 'file_docx_001',
      dueAt: '2026-06-04 21:00',
      pendingCount: 14,
      gradedCount: 0,
      totalCount: 14
    },
    {
      id: 'assignment_003',
      courseSessionId: 'cs_003',
      courseId: 'course_003',
      classId: 'class_003',
      teacherId: 'teacher_002',
      type: 'pre',
      title: '英语阅读课前词汇',
      status: 'not_uploaded',
      fileId: '',
      dueAt: '2026-06-04 18:20',
      pendingCount: 0,
      gradedCount: 0,
      totalCount: 22
    }
  ],

  wrongRecords: [
    {
      id: 'wrong_001',
      studentId: 'stu_001',
      studentName: '陈一诺',
      courseSessionId: 'cs_001',
      courseId: 'course_001',
      classId: 'class_001',
      teacherId: 'teacher_001',
      subject: '数学',
      topic: '一次函数图像',
      source: '课前测',
      mistakeReason: '斜率和截距混淆',
      correction: '重画函数图像并标注截距。',
      imageFileId: 'file_img_001',
      status: 'todo',
      tags: ['概念混淆', '图像理解'],
      createdAt: '2026-06-03 19:30'
    },
    {
      id: 'wrong_002',
      studentId: 'stu_002',
      studentName: '许知远',
      courseSessionId: 'cs_001',
      courseId: 'course_001',
      classId: 'class_001',
      teacherId: 'teacher_001',
      subject: '数学',
      topic: '方程与函数转化',
      source: '课后测',
      mistakeReason: '审题遗漏定义域',
      correction: '补充定义域限制后再求交点。',
      imageFileId: '',
      status: 'corrected',
      tags: ['审题', '定义域'],
      createdAt: '2026-06-02 20:10'
    },
    {
      id: 'wrong_003',
      studentId: 'stu_003',
      studentName: '姜明澈',
      courseSessionId: 'cs_002',
      courseId: 'course_002',
      classId: 'class_002',
      teacherId: 'teacher_001',
      subject: '物理',
      topic: '浮力方向判断',
      source: '课堂练习',
      mistakeReason: '受力分析漏画浮力',
      correction: '先画受力图，再列平衡关系。',
      imageFileId: '',
      status: 'todo',
      tags: ['受力分析'],
      createdAt: '2026-06-03 21:00'
    }
  ],

  files: [
    {
      id: 'file_pdf_001',
      name: '一次函数课前测.pdf',
      ext: 'pdf',
      mimeType: 'application/pdf',
      size: 734003,
      ownerType: 'assignment',
      ownerId: 'assignment_001',
      uploadedBy: 'teacher_001',
      uploadedAt: '2026-06-02 21:30',
      fileID: '',
      downloadUrl: '',
      placeholder: true
    },
    {
      id: 'file_docx_001',
      name: '浮力专题课后测.docx',
      ext: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 524288,
      ownerType: 'assignment',
      ownerId: 'assignment_002',
      uploadedBy: 'teacher_001',
      uploadedAt: '2026-06-03 12:05',
      fileID: '',
      downloadUrl: '',
      placeholder: true
    },
    {
      id: 'file_img_001',
      name: '一次函数错题照片.jpg',
      ext: 'jpg',
      mimeType: 'image/jpeg',
      size: 258048,
      ownerType: 'wrongRecord',
      ownerId: 'wrong_001',
      uploadedBy: 'teacher_001',
      uploadedAt: '2026-06-03 19:28',
      fileID: '',
      downloadUrl: '',
      placeholder: true
    }
  ],

  liveRooms: [
    {
      id: 'live_room_001',
      courseSessionId: 'cs_001',
      classroomId: 'room_08',
      status: 'open',
      statusText: '直播占位已开放',
      streamUrl: '',
      provider: 'placeholder',
      lastHeartbeatAt: '2026-06-03 18:35',
      note: '演示数据，暂无真实播放流。'
    },
    {
      id: 'live_room_002',
      courseSessionId: 'cs_002',
      classroomId: 'room_12',
      status: 'scheduled',
      statusText: '待上课开放',
      streamUrl: '',
      provider: 'placeholder',
      lastHeartbeatAt: '',
      note: '正式版由服务端按权限签发播放地址。'
    },
    {
      id: 'live_room_003',
      courseSessionId: 'cs_003',
      classroomId: 'room_03',
      status: 'offline',
      statusText: '待硬件联调',
      streamUrl: '',
      provider: 'placeholder',
      lastHeartbeatAt: '',
      note: '教室直播设备待接入。'
    }
  ],

  auditLogs: [
    {
      id: 'audit_001',
      actorId: 'admin_001',
      action: 'create_invite',
      targetType: 'inviteCode',
      targetId: 'invite_student_001',
      message: '创建学生演示邀请码 STUDENT-001',
      createdAt: '2026-06-01 09:00'
    }
  ]
};

module.exports = db;
