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
    streamPlaceholder: `classroom-${code}`,
    liveProvider: 'classin',
    liveConfigStatus: 'pending'
  };
});

const db = {
  currentSessionId: '',
  sessions: {},

  phoneAccounts: [
    {
      id: 'account_student_001',
      phone: '13800000001',
      role: 'parent',
      linkedId: 'stu_001',
      nickname: '陈一诺'
    },
    {
      id: 'account_teacher_001',
      phone: '13800000002',
      role: 'teacher',
      linkedId: 'teacher_001',
      nickname: '周明远老师'
    },
    {
      id: 'account_admin_001',
      phone: '13800000003',
      role: 'admin',
      linkedId: 'admin_001',
      nickname: '教务管理员'
    },
    {
      id: 'account_student_002',
      phone: '13800000004',
      role: 'parent',
      linkedId: 'stu_002',
      nickname: '许知远'
    },
    {
      id: 'account_teacher_002',
      phone: '13800000012',
      role: 'teacher',
      linkedId: 'teacher_002',
      nickname: '王思琪老师'
    },
    {
      id: 'account_teacher_003',
      phone: '13800000013',
      role: 'teacher',
      linkedId: 'teacher_003',
      nickname: '李景澜老师'
    }
  ],

  wechatAccounts: [],
  identities: [],
  guardianBindings: [],

  students: [
    {
      id: 'stu_001',
      name: '陈一诺',
      phone: '13800000001',
      grade: '初三',
      courseIds: ['course_bio_001', 'course_math_001'],
      status: 'active'
    },
    {
      id: 'stu_002',
      name: '许知远',
      phone: '13800000004',
      grade: '初二',
      courseIds: ['course_math_001', 'course_eng_001'],
      status: 'active'
    },
    {
      id: 'stu_003',
      name: '姜明澈',
      phone: '13800000005',
      grade: '初三',
      courseIds: ['course_bio_001'],
      status: 'active'
    },
    {
      id: 'stu_004',
      name: '罗语桐',
      phone: '13800000006',
      grade: '初一',
      courseIds: ['course_eng_001'],
      status: 'active'
    }
  ],

  teachers: [
    {
      id: 'teacher_001',
      fullName: '周明远',
      name: '周明远老师',
      phone: '13800000002',
      subject: '生物',
      subjects: ['生物'],
      courseIds: ['course_bio_001'],
      title: '生物老师',
      status: 'active'
    },
    {
      id: 'teacher_002',
      fullName: '王思琪',
      name: '王思琪老师',
      phone: '13800000012',
      subject: '英语',
      subjects: ['英语'],
      courseIds: ['course_eng_001'],
      title: '英语老师',
      status: 'active'
    },
    {
      id: 'teacher_003',
      fullName: '李景澜',
      name: '李景澜老师',
      phone: '13800000013',
      subject: '数学',
      subjects: ['数学'],
      courseIds: ['course_math_001'],
      title: '数学老师',
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
      id: 'class_bio_001',
      courseId: 'course_bio_001',
      name: '初三生物1班',
      subject: '生物',
      grade: '初三',
      mainTeacherId: 'teacher_001',
      studentIds: ['stu_001', 'stu_003'],
      defaultClassroomId: 'room_08',
      status: 'active'
    },
    {
      id: 'class_math_001',
      courseId: 'course_math_001',
      name: '初二数学A班',
      subject: '数学',
      grade: '初二',
      mainTeacherId: 'teacher_003',
      studentIds: ['stu_001', 'stu_002'],
      defaultClassroomId: 'room_12',
      status: 'active'
    },
    {
      id: 'class_eng_001',
      courseId: 'course_eng_001',
      name: '初一英语提高班',
      subject: '英语',
      grade: '初一',
      mainTeacherId: 'teacher_002',
      studentIds: ['stu_002', 'stu_004'],
      defaultClassroomId: 'room_03',
      status: 'active'
    }
  ],

  courses: [
    {
      id: 'course_bio_001',
      classId: 'class_bio_001',
      name: '初三生物1班',
      subject: '生物',
      grade: '初三',
      teacherId: 'teacher_001',
      mainTeacherId: 'teacher_001',
      classroomId: 'room_08',
      defaultClassroomId: 'room_08',
      studentIds: ['stu_001', 'stu_003'],
      defaultDurationMinutes: 90,
      status: 'active',
      description: '中考生物复习课后反馈班。'
    },
    {
      id: 'course_math_001',
      classId: 'class_math_001',
      name: '初二数学A班',
      subject: '数学',
      grade: '初二',
      teacherId: 'teacher_003',
      mainTeacherId: 'teacher_003',
      classroomId: 'room_12',
      defaultClassroomId: 'room_12',
      studentIds: ['stu_001', 'stu_002'],
      defaultDurationMinutes: 90,
      status: 'active',
      description: '函数与几何课后反馈班。'
    },
    {
      id: 'course_eng_001',
      classId: 'class_eng_001',
      name: '初一英语提高班',
      subject: '英语',
      grade: '初一',
      teacherId: 'teacher_002',
      mainTeacherId: 'teacher_002',
      classroomId: 'room_03',
      defaultClassroomId: 'room_03',
      studentIds: ['stu_002', 'stu_004'],
      defaultDurationMinutes: 90,
      status: 'active',
      description: '阅读理解与词汇课后反馈班。'
    }
  ],

  courseSessions: [
    {
      id: 'lesson_bio_001_01',
      courseId: 'course_bio_001',
      classId: 'class_bio_001',
      sessionIndex: 1,
      sessionTitle: '第一次课',
      title: '第一次课：细胞结构复习',
      displayTitle: '第一次课：细胞结构复习',
      date: '2026-06-03',
      startTime: '18:30',
      endTime: '20:00',
      teacherId: 'teacher_001',
      classroomId: 'room_08',
      studentIds: ['stu_001', 'stu_003'],
      status: 'finished',
      statusText: '已结束',
      liveRoomId: 'live_room_08',
      note: '线下完成练习，课后上传反馈。'
    },
    {
      id: 'lesson_bio_001_02',
      courseId: 'course_bio_001',
      classId: 'class_bio_001',
      sessionIndex: 2,
      sessionTitle: '第二次课',
      title: '第二次课：遗传与变异',
      displayTitle: '第二次课：遗传与变异',
      date: '2026-06-08',
      startTime: '18:30',
      endTime: '20:00',
      teacherId: 'teacher_001',
      classroomId: 'room_08',
      studentIds: ['stu_001', 'stu_003'],
      status: 'scheduled',
      statusText: '未开始',
      liveRoomId: 'live_room_08',
      note: '保留直播入口，正式部署后接入 ClassIn。'
    },
    {
      id: 'lesson_math_001_01',
      courseId: 'course_math_001',
      classId: 'class_math_001',
      sessionIndex: 1,
      sessionTitle: '第一次课',
      title: '第一次课：一次函数图像',
      displayTitle: '第一次课：一次函数图像',
      date: '2026-06-03',
      startTime: '20:10',
      endTime: '21:40',
      teacherId: 'teacher_003',
      classroomId: 'room_12',
      studentIds: ['stu_001', 'stu_002'],
      status: 'finished',
      statusText: '已结束',
      liveRoomId: 'live_room_12',
      note: '线下讲义批改后上传反馈。'
    },
    {
      id: 'lesson_math_001_02',
      courseId: 'course_math_001',
      classId: 'class_math_001',
      sessionIndex: 2,
      sessionTitle: '第二次课',
      title: '第二次课：方程与函数转化',
      displayTitle: '第二次课：方程与函数转化',
      date: '2026-06-10',
      startTime: '20:10',
      endTime: '21:40',
      teacherId: 'teacher_003',
      classroomId: 'room_12',
      studentIds: ['stu_001', 'stu_002'],
      status: 'scheduled',
      statusText: '未开始',
      liveRoomId: 'live_room_12',
      note: '课后反馈为主，可选测验资料。'
    },
    {
      id: 'lesson_eng_001_01',
      courseId: 'course_eng_001',
      classId: 'class_eng_001',
      sessionIndex: 1,
      sessionTitle: '第一次课',
      title: '第一次课：阅读理解定位',
      displayTitle: '第一次课：阅读理解定位',
      date: '2026-06-04',
      startTime: '18:30',
      endTime: '20:00',
      teacherId: 'teacher_002',
      classroomId: 'room_03',
      studentIds: ['stu_002', 'stu_004'],
      status: 'finished',
      statusText: '已结束',
      liveRoomId: 'live_room_03',
      note: '课后反馈已开放。'
    },
    {
      id: 'lesson_eng_001_02',
      courseId: 'course_eng_001',
      classId: 'class_eng_001',
      sessionIndex: 2,
      sessionTitle: '第二次课',
      title: '第二次课：完形填空线索',
      displayTitle: '第二次课：完形填空线索',
      date: '2026-06-11',
      startTime: '18:30',
      endTime: '20:00',
      teacherId: 'teacher_002',
      classroomId: 'room_03',
      studentIds: ['stu_002', 'stu_004'],
      status: 'scheduled',
      statusText: '未开始',
      liveRoomId: 'live_room_03',
      note: '保留直播入口。'
    }
  ],

  assignments: [
    {
      id: 'assignment_optional_001',
      courseId: 'course_bio_001',
      courseSessionId: 'lesson_bio_001_01',
      teacherId: 'teacher_001',
      type: 'pre',
      title: '细胞结构课前测记录',
      status: 'optional',
      statusText: '可选记录',
      fileId: 'file_optional_pdf_001',
      dueAt: '2026-06-03 18:20'
    },
    {
      id: 'assignment_optional_002',
      courseId: 'course_math_001',
      courseSessionId: 'lesson_math_001_01',
      teacherId: 'teacher_001',
      type: 'post',
      title: '一次函数课后测记录',
      status: 'optional',
      statusText: '可选记录',
      fileId: '',
      dueAt: '2026-06-03 21:50'
    }
  ],

  lessonFeedbacks: [
    {
      id: 'feedback_001',
      studentId: 'stu_001',
      teacherId: 'teacher_001',
      courseId: 'course_bio_001',
      courseSessionId: 'lesson_bio_001_01',
      text: '本次课前测错在细胞器功能区分，已当面讲解，建议回家复看笔记。',
      imageFileIds: ['media_img_001'],
      voiceFileIds: ['media_voice_001'],
      createdAt: '2026-06-03 20:10',
      visibleToStudent: true
    },
    {
      id: 'feedback_002',
      studentId: 'stu_003',
      teacherId: 'teacher_001',
      courseId: 'course_bio_001',
      courseSessionId: 'lesson_bio_001_01',
      text: '课堂练习完成度较好，生态系统能量流动部分还需要按步骤画图。',
      imageFileIds: ['media_img_002'],
      voiceFileIds: [],
      createdAt: '2026-06-03 20:18',
      visibleToStudent: true
    },
    {
      id: 'feedback_003',
      studentId: 'stu_002',
      teacherId: 'teacher_003',
      courseId: 'course_math_001',
      courseSessionId: 'lesson_math_001_01',
      text: '一次函数图像题审题有进步，定义域限制仍要先写出来。',
      imageFileIds: [],
      voiceFileIds: ['media_voice_002'],
      createdAt: '2026-06-03 21:55',
      visibleToStudent: true
    },
    {
      id: 'feedback_004',
      studentId: 'stu_004',
      teacherId: 'teacher_002',
      courseId: 'course_eng_001',
      courseSessionId: 'lesson_eng_001_01',
      text: '阅读定位速度提升明显，长难句建议继续拆主谓宾。',
      imageFileIds: ['media_img_003'],
      voiceFileIds: ['media_voice_003'],
      createdAt: '2026-06-04 20:08',
      visibleToStudent: true
    }
  ],

  mediaFiles: [
    {
      id: 'media_img_001',
      type: 'image',
      name: '细胞结构批改照片.jpg',
      url: '',
      tempPath: '',
      storageKey: 'feedback/course_bio_001/lesson_bio_001_01/stu_001/img_001.jpg',
      size: 320000,
      createdAt: '2026-06-03 20:08',
      retentionUntil: '2026-12-03',
      downloadable: true
    },
    {
      id: 'media_img_002',
      type: 'image',
      name: '生态系统练习反馈.jpg',
      url: '',
      tempPath: '',
      storageKey: 'feedback/course_bio_001/lesson_bio_001_01/stu_003/img_001.jpg',
      size: 286000,
      createdAt: '2026-06-03 20:17',
      retentionUntil: '2026-12-03',
      downloadable: true
    },
    {
      id: 'media_img_003',
      type: 'image',
      name: '英语阅读批注照片.jpg',
      url: '',
      tempPath: '',
      storageKey: 'feedback/course_eng_001/lesson_eng_001_01/stu_004/img_001.jpg',
      size: 248000,
      createdAt: '2026-06-04 20:06',
      retentionUntil: '2026-12-04',
      downloadable: true
    },
    {
      id: 'media_voice_001',
      type: 'voice',
      name: '老师语音反馈.m4a',
      url: '',
      tempPath: '',
      storageKey: 'feedback/course_bio_001/lesson_bio_001_01/stu_001/voice_001.m4a',
      duration: 18,
      size: 120000,
      createdAt: '2026-06-03 20:09',
      retentionUntil: '2026-12-03',
      downloadable: false
    },
    {
      id: 'media_voice_002',
      type: 'voice',
      name: '数学课后语音.m4a',
      url: '',
      tempPath: '',
      storageKey: 'feedback/course_math_001/lesson_math_001_01/stu_002/voice_001.m4a',
      duration: 22,
      size: 148000,
      createdAt: '2026-06-03 21:54',
      retentionUntil: '2026-12-03',
      downloadable: false
    },
    {
      id: 'media_voice_003',
      type: 'voice',
      name: '英语阅读反馈.m4a',
      url: '',
      tempPath: '',
      storageKey: 'feedback/course_eng_001/lesson_eng_001_01/stu_004/voice_001.m4a',
      duration: 16,
      size: 108000,
      createdAt: '2026-06-04 20:07',
      retentionUntil: '2026-12-04',
      downloadable: false
    }
  ],

  files: [
    {
      id: 'file_optional_pdf_001',
      name: '细胞结构课前测记录.pdf',
      ext: 'pdf',
      mimeType: 'application/pdf',
      size: 734003,
      ownerType: 'optionalMaterial',
      ownerId: 'assignment_optional_001',
      uploadedBy: 'teacher_001',
      uploadedAt: '2026-06-02 21:30',
      fileID: '',
      downloadUrl: '',
      placeholder: true,
      optional: true
    },
    {
      id: 'file_optional_docx_001',
      name: '一次函数课后测记录.docx',
      ext: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 524288,
      ownerType: 'optionalMaterial',
      ownerId: 'assignment_optional_002',
      uploadedBy: 'teacher_001',
      uploadedAt: '2026-06-03 12:05',
      fileID: '',
      downloadUrl: '',
      placeholder: true,
      optional: true
    }
  ],

  liveRooms: classrooms.map((room) => ({
    id: `live_${room.id}`,
    courseSessionId: '',
    classroomId: room.id,
    status: 'pending',
    statusText: 'ClassIn 接口待接入',
    streamUrl: '',
    classinEntryUrl: '',
    provider: 'classin',
    lastHeartbeatAt: '',
    note: '正式部署后由后端或云函数签发 ClassIn 入口。'
  })),

  auditLogs: [
    {
      id: 'audit_001',
      actorId: 'admin_001',
      action: 'seed_feedback_data',
      targetType: 'lessonFeedback',
      targetId: 'feedback_001',
      message: '初始化课后反馈演示数据',
      createdAt: '2026-06-03 20:10'
    }
  ]
};

db.liveRooms.forEach((room) => {
  const session = db.courseSessions.find((item) => item.classroomId === room.classroomId);
  if (session) room.courseSessionId = session.id;
});

module.exports = db;
