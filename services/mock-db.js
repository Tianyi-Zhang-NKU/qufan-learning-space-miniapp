function twoDigit(value) {
  const text = String(value);
  return text.length >= 2 ? text : `0${text}`;
}

function classroomStatus(index) {
  if (index === 1 || index === 8 || index === 12) return 'ready';
  if (index === 3) return 'testing';
  return 'pending';
}

const classrooms = [];
for (let no = 1; no <= 15; no += 1) {
  const code = twoDigit(no);
  classrooms.push({
    id: `room_${code}`,
    name: `${no}号教室`,
    capacity: no <= 5 ? 18 : 24,
    campus: '主校区',
    cameraStatus: classroomStatus(no),
    streamPlaceholder: `classroom-${code}`,
    liveProvider: 'classin',
    liveConfigStatus: 'pending'
  });
}

const DEMO_IMAGE_URLS = [
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?w=900&auto=format&fit=crop'
];
const DEMO_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';
const DEMO_AUDIO_URL = 'https://www.w3schools.com/html/horse.mp3';

function weeklySessions(config) {
  return (config.topics || []).map((topic, index) => {
    const no = index + 1;
    const code = twoDigit(no);
    const finished = index < (config.finishedCount || 0);
    return {
      id: `${config.sessionPrefix}_${code}`,
      courseId: config.courseId,
      classId: config.classId,
      sessionIndex: no,
      sessionTitle: `第${no}次课`,
      title: `第${no}次课：${topic}`,
      displayTitle: `第${no}次课`,
      topic,
      date: config.dates[index],
      startTime: config.startTime,
      endTime: config.endTime,
      teacherId: config.teacherId,
      classroomId: config.classroomId,
      studentIds: config.studentIds.slice(),
      status: finished ? 'finished' : 'scheduled',
      statusText: finished ? '已结束' : '未开始',
      liveRoomId: `live_${config.classroomId}`,
      note: finished ? '已完成线下讲解，本讲学习反馈可查看。' : '每周固定课次，直播入口和学习反馈入口已准备。'
    };
  });
}

const db = {
  currentSessionId: '',
  sessions: {},
  attentionRules: {
    consecutiveUnpassedThreshold: 2,
    lowPassRateThreshold: 60,
    excellentPassRateThreshold: 90,
    excellentCompletedSessionThreshold: 3
  },
  studentAttentionNotes: [],

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
      courseIds: ['course_bio_001', 'course_bio_002', 'course_math_001'],
      status: 'active'
    },
    {
      id: 'stu_002',
      name: '许知远',
      phone: '13800000004',
      grade: '初二',
      courseIds: ['course_math_001', 'course_math_002', 'course_eng_001'],
      status: 'active'
    },
    {
      id: 'stu_003',
      name: '姜明澈',
      phone: '13800000005',
      grade: '初三',
      courseIds: ['course_bio_001', 'course_bio_002'],
      status: 'active'
    },
    {
      id: 'stu_004',
      name: '罗语桐',
      phone: '13800000006',
      grade: '初一',
      courseIds: ['course_eng_001', 'course_eng_002'],
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
      courseIds: ['course_bio_001', 'course_bio_002'],
      title: '生物老师',
      createdAt: '2026-05-10 09:20',
      status: 'active'
    },
    {
      id: 'teacher_002',
      fullName: '王思琪',
      name: '王思琪老师',
      phone: '13800000012',
      subject: '英语',
      subjects: ['英语'],
      courseIds: ['course_eng_001', 'course_eng_002'],
      title: '英语老师',
      createdAt: '2026-05-12 10:00',
      status: 'active'
    },
    {
      id: 'teacher_003',
      fullName: '李景澜',
      name: '李景澜老师',
      phone: '13800000013',
      subject: '数学',
      subjects: ['数学'],
      courseIds: ['course_math_001', 'course_math_002'],
      title: '数学老师',
      createdAt: '2026-05-14 14:30',
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
      id: 'class_bio_002',
      courseId: 'course_bio_002',
      name: '初三生物2班',
      subject: '生物',
      grade: '初三',
      mainTeacherId: 'teacher_001',
      studentIds: ['stu_001', 'stu_003'],
      defaultClassroomId: 'room_10',
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
      id: 'class_math_002',
      courseId: 'course_math_002',
      name: '初二数学B班',
      subject: '数学',
      grade: '初二',
      mainTeacherId: 'teacher_003',
      studentIds: ['stu_001', 'stu_002'],
      defaultClassroomId: 'room_14',
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
    },
    {
      id: 'class_eng_002',
      courseId: 'course_eng_002',
      name: '初一英语阅读班',
      subject: '英语',
      grade: '初一',
      mainTeacherId: 'teacher_002',
      studentIds: ['stu_002', 'stu_004'],
      defaultClassroomId: 'room_06',
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
      passThresholdPercent: 80,
      status: 'active',
      description: '中考生物复习本讲总结班。'
    },
    {
      id: 'course_bio_002',
      classId: 'class_bio_002',
      name: '初三生物2班',
      subject: '生物',
      grade: '初三',
      teacherId: 'teacher_001',
      mainTeacherId: 'teacher_001',
      classroomId: 'room_10',
      defaultClassroomId: 'room_10',
      studentIds: ['stu_001', 'stu_003'],
      defaultDurationMinutes: 90,
      passThresholdPercent: 80,
      status: 'active',
      description: '中考生物第二轮专题复习班。'
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
      passThresholdPercent: 80,
      status: 'active',
      description: '函数与几何本讲总结班。'
    },
    {
      id: 'course_math_002',
      classId: 'class_math_002',
      name: '初二数学B班',
      subject: '数学',
      grade: '初二',
      teacherId: 'teacher_003',
      mainTeacherId: 'teacher_003',
      classroomId: 'room_14',
      defaultClassroomId: 'room_14',
      studentIds: ['stu_001', 'stu_002'],
      defaultDurationMinutes: 90,
      passThresholdPercent: 80,
      status: 'active',
      description: '代数与几何综合提升班。'
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
      passThresholdPercent: 80,
      status: 'active',
      description: '阅读理解与词汇本讲总结班。'
    },
    {
      id: 'course_eng_002',
      classId: 'class_eng_002',
      name: '初一英语阅读班',
      subject: '英语',
      grade: '初一',
      teacherId: 'teacher_002',
      mainTeacherId: 'teacher_002',
      classroomId: 'room_06',
      defaultClassroomId: 'room_06',
      studentIds: ['stu_002', 'stu_004'],
      defaultDurationMinutes: 90,
      passThresholdPercent: 80,
      status: 'active',
      description: '阅读精读与写作表达班。'
    }
  ],

  courseSessions: [
    ...weeklySessions({
      sessionPrefix: 'lesson_bio_001',
      courseId: 'course_bio_001',
      classId: 'class_bio_001',
      teacherId: 'teacher_001',
      classroomId: 'room_08',
      studentIds: ['stu_001', 'stu_003'],
      startTime: '18:30',
      endTime: '20:00',
      finishedCount: 1,
      dates: ['2026-06-06', '2026-06-13', '2026-06-20', '2026-06-27', '2026-07-04', '2026-07-11', '2026-07-18', '2026-07-25'],
      topics: ['细胞结构复习', '遗传与变异', '生态系统能量流动', '人体生命活动调节', '实验探究题方法', '中考图表题专项', '综合卷错题讲评', '期末模拟复盘']
    }),
    ...weeklySessions({
      sessionPrefix: 'lesson_bio_002',
      courseId: 'course_bio_002',
      classId: 'class_bio_002',
      teacherId: 'teacher_001',
      classroomId: 'room_10',
      studentIds: ['stu_001', 'stu_003'],
      startTime: '09:00',
      endTime: '10:30',
      finishedCount: 0,
      dates: ['2026-06-07', '2026-06-14', '2026-06-21', '2026-06-28', '2026-07-05', '2026-07-12'],
      topics: ['生物圈与生态系统', '植物光合作用', '人体消化与吸收', '免疫与健康', '实验设计规范', '专题错题复盘']
    }),
    ...weeklySessions({
      sessionPrefix: 'lesson_math_001',
      courseId: 'course_math_001',
      classId: 'class_math_001',
      teacherId: 'teacher_003',
      classroomId: 'room_12',
      studentIds: ['stu_001', 'stu_002'],
      startTime: '20:10',
      endTime: '21:40',
      finishedCount: 1,
      dates: ['2026-06-03', '2026-06-10', '2026-06-17', '2026-06-24', '2026-07-01', '2026-07-08'],
      topics: ['一次函数图像', '方程与函数转化', '动点问题入门', '几何辅助线训练', '期中错题归类', '综合压轴题拆解']
    }),
    ...weeklySessions({
      sessionPrefix: 'lesson_math_002',
      courseId: 'course_math_002',
      classId: 'class_math_002',
      teacherId: 'teacher_003',
      classroomId: 'room_14',
      studentIds: ['stu_001', 'stu_002'],
      startTime: '16:00',
      endTime: '17:30',
      finishedCount: 0,
      dates: ['2026-06-06', '2026-06-13', '2026-06-20', '2026-06-27', '2026-07-04', '2026-07-11'],
      topics: ['整式乘法与因式分解', '分式方程应用', '相似三角形基础', '圆的性质', '几何证明规范', '综合应用复盘']
    }),
    ...weeklySessions({
      sessionPrefix: 'lesson_eng_001',
      courseId: 'course_eng_001',
      classId: 'class_eng_001',
      teacherId: 'teacher_002',
      classroomId: 'room_03',
      studentIds: ['stu_002', 'stu_004'],
      startTime: '18:30',
      endTime: '20:00',
      finishedCount: 1,
      dates: ['2026-06-04', '2026-06-11', '2026-06-18', '2026-06-25', '2026-07-02', '2026-07-09'],
      topics: ['阅读理解定位', '完形填空线索', '词汇语境判断', '语法填空基础', '作文句式升级', '阶段测错题讲评']
    }),
    ...weeklySessions({
      sessionPrefix: 'lesson_eng_002',
      courseId: 'course_eng_002',
      classId: 'class_eng_002',
      teacherId: 'teacher_002',
      classroomId: 'room_06',
      studentIds: ['stu_002', 'stu_004'],
      startTime: '10:40',
      endTime: '12:10',
      finishedCount: 0,
      dates: ['2026-06-06', '2026-06-13', '2026-06-20', '2026-06-27', '2026-07-04', '2026-07-11'],
      topics: ['校园主题精读', '人物故事精读', '科普短文精读', '任务型阅读', '读后续写素材', '阅读错题复盘']
    })
  ],

  assignments: [
    {
      id: 'assignment_optional_001',
      courseId: 'course_bio_001',
      courseSessionId: 'lesson_bio_001_01',
      teacherId: 'teacher_001',
      type: 'pre',
      title: '细胞结构课堂小测记录',
      status: 'optional',
      statusText: '可选记录',
      fileId: 'file_optional_pdf_001',
      dueAt: '2026-06-03 18:20'
    },
    {
      id: 'assignment_optional_002',
      courseId: 'course_math_001',
      courseSessionId: 'lesson_math_001_01',
      teacherId: 'teacher_003',
      type: 'post',
      title: '一次函数本讲总结记录',
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
      feedbackType: 'pre',
      text: '本次课堂小测错在细胞器功能区分，已当面讲解，建议回家复看笔记。',
      imageFileIds: ['media_img_001'],
      videoFileIds: ['media_video_001'],
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
      feedbackType: 'post',
      text: '课堂练习完成度较好，生态系统能量流动部分还需要按步骤画图。',
      imageFileIds: ['media_img_002'],
      videoFileIds: [],
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
      feedbackType: 'post',
      text: '一次函数图像题审题有进步，定义域限制仍要先写出来。',
      imageFileIds: [],
      videoFileIds: [],
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
      feedbackType: 'post',
      text: '阅读定位速度提升明显，长难句建议继续拆主谓宾。',
      imageFileIds: ['media_img_003'],
      videoFileIds: [],
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
      url: DEMO_IMAGE_URLS[0],
      tempPath: '',
      storageKey: 'feedback/course_bio_001/lesson_bio_001_01/stu_001/img_001.jpg',
      size: 320000,
      createdAt: '2026-06-03 20:08',
      retentionUntil: '2026-12-03',
      downloadable: false
    },
    {
      id: 'media_img_002',
      type: 'image',
      name: '生态系统练习反馈.jpg',
      url: DEMO_IMAGE_URLS[1],
      tempPath: '',
      storageKey: 'feedback/course_bio_001/lesson_bio_001_01/stu_003/img_001.jpg',
      size: 286000,
      createdAt: '2026-06-03 20:17',
      retentionUntil: '2026-12-03',
      downloadable: false
    },
    {
      id: 'media_img_003',
      type: 'image',
      name: '英语阅读批注照片.jpg',
      url: DEMO_IMAGE_URLS[2],
      tempPath: '',
      storageKey: 'feedback/course_eng_001/lesson_eng_001_01/stu_004/img_001.jpg',
      size: 248000,
      createdAt: '2026-06-04 20:06',
      retentionUntil: '2026-12-04',
      downloadable: false
    },
    {
      id: 'media_video_001',
      type: 'video',
      name: '课堂小测错题讲解视频.mp4',
      url: DEMO_VIDEO_URL,
      tempPath: '',
      storageKey: 'feedback/course_bio_001/lesson_bio_001_01/stu_001/video_001.mp4',
      duration: 42,
      size: 4280000,
      createdAt: '2026-06-03 20:09',
      retentionUntil: '2026-12-03',
      downloadable: false
    },
    {
      id: 'media_voice_001',
      type: 'voice',
      name: '老师语音反馈.mp3',
      url: DEMO_AUDIO_URL,
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
      name: '数学本讲总结语音.mp3',
      url: DEMO_AUDIO_URL,
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
      name: '英语阅读反馈.mp3',
      url: DEMO_AUDIO_URL,
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
      name: '细胞结构课堂小测记录.pdf',
      ext: 'pdf',
      mimeType: 'application/pdf',
      size: 734003,
      ownerType: 'optionalMaterial',
      ownerId: 'assignment_optional_001',
      uploadedBy: 'teacher_003',
      uploadedAt: '2026-06-02 21:30',
      fileID: '',
      downloadUrl: '',
      placeholder: true,
      optional: true
    },
    {
      id: 'file_optional_docx_001',
      name: '一次函数本讲总结记录.docx',
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
    statusText: '课堂入口准备中',
    streamUrl: '',
    previewVideoUrl: '',
    classinEntryUrl: `https://classin.example.com/classroom/${room.id}`,
    provider: 'classin',
    lastHeartbeatAt: '',
    note: '课堂入口按课次开放。'
  })),

  auditLogs: [
    {
      id: 'audit_001',
      actorId: 'admin_001',
      action: 'seed_feedback_data',
      targetType: 'lessonFeedback',
      targetId: 'feedback_001',
      message: '初始化本讲总结数据',
      createdAt: '2026-06-03 20:10'
    }
  ]
};

db.liveRooms.forEach((room) => {
  const session = db.courseSessions.find((item) => item.classroomId === room.classroomId);
  if (session) {
    room.courseSessionId = session.id;
    room.status = 'ready';
    room.statusText = '已配置课堂入口';
    room.previewVideoUrl = DEMO_VIDEO_URL;
    room.classinEntryUrl = `https://classin.example.com/live/${session.id}`;
    room.lastHeartbeatAt = `${session.date} ${session.startTime}`;
  }
});

module.exports = db;
