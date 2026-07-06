const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');
const FeedbackTypes = require('../../../utils/feedback-types');

function buildFeedbackRecord(feedback) {
  return {
    id: feedback.id,
    text: feedback.text || '',
    createdAt: feedback.createdAt || '',
    teacherName: feedback.teacherName || '',
    feedbackType: feedback.feedbackType || 'post',
    feedbackTypeText: feedback.feedbackTypeText || FeedbackTypes.feedbackTypeText(feedback.feedbackType),
    imageFiles: feedback.imageFiles || [],
    videoFiles: feedback.videoFiles || [],
    voiceFiles: feedback.voiceFiles || [],
    attachFiles: feedback.attachFiles || [],
    mediaFiles: feedback.mediaFiles || [],
    imageCount: feedback.imageCount || 0,
    videoCount: feedback.videoCount || 0,
    voiceCount: feedback.voiceCount || 0,
    attachFileCount: feedback.attachFileCount || 0,
    passed: !!feedback.passed
  };
}

function typeLabel(type) {
  return FeedbackTypes.feedbackTypeShortLabel(type);
}

Page({
  data: {
    session: {},
    mode: 'courses',   // 'courses' | 'sessions' | 'records' | 'testList' | 'allRecords'
    loading: true,

    // ---- Course-list mode ----
    studentName: '',
    courses: [],

    // ---- Session-list mode ----
    courseId: '',
    courseName: '',
    courseSubject: '',
    sessionList: [],

    // ---- Single-session records mode ----
    sessionId: '',
    sessionLabel: '',
    sessionDetail: {},
    sessionRecords: [],

    // ---- Test-list mode ----
    testType: '',
    testTypeLabel: '',
    sessionTests: [],
    testCurrentIndex: 0,
    testCurrentSession: null,

    // ---- All-records mode ----
    allRecordsGroups: [],
    allRecordsTotal: 0,
    workbookSummary: {},
    workbookRecords: [],
    exportingWorkbook: false
  },

  onLoad(query) {
    const courseId = query.courseId || '';
    const sessionId = query.sessionId || '';
    const type = query.type || '';
    const all = query.all || '';

    if (all === '1') {
      // From profile page: 我的错题本
      this.setData({ mode: 'allRecords' });
      wx.setNavigationBarTitle({ title: '我的错题本' });
    } else if (courseId && sessionId && type) {
      // From schedule page: one lesson's pre/post test records
      this.setData({
        mode: 'testList',
        testType: type,
        testTypeLabel: typeLabel(type),
        courseId,
        sessionId
      });
      wx.setNavigationBarTitle({
        title: `${typeLabel(type)}错题`
      });
    } else if (courseId && type) {
      // From home page: pre/post test buttons
      this.setData({
        mode: 'testList',
        testType: type,
        testTypeLabel: typeLabel(type),
        courseId
      });
      wx.setNavigationBarTitle({
        title: `${typeLabel(type)}错题`
      });
    } else if (courseId && sessionId) {
      // From session list: single session's wrong records
      this.setData({
        mode: 'records',
        courseId,
        sessionId
      });
      wx.setNavigationBarTitle({ title: '本讲总结' });
    } else if (courseId) {
      // From course list: session list for a course
      this.setData({ mode: 'sessions', courseId });
      wx.setNavigationBarTitle({ title: '课次列表' });
    }
  },

  onShow() {
    const session = Guard.ensureLogin('parent');
    if (!session) return;
    this.setData({ session });

    if (this.data.mode === 'allRecords') {
      this.loadAllRecords();
    } else if (this.data.mode === 'testList') {
      this.loadTestList();
    } else if (this.data.mode === 'records') {
      this.loadSessionRecords();
    } else if (this.data.mode === 'sessions') {
      this.loadSessionList();
    } else {
      this.loadCourseList();
    }
  },

  // ================================================================
  //  Mode 1: Course list — 反馈首页
  // ================================================================
  loadCourseList() {
    this.setData({ loading: true });
    Api.getStudentDashboard()
      .then((dashboard) => {
        const courses = (dashboard.courses || []).map((course) =>
          this.buildCourseEntry(course)
        );
        this.setData({
          studentName: (dashboard.currentStudent || {}).name || (dashboard.currentChild || {}).name || '',
          courses,
          loading: false
        });
      })
      .catch((error) => {
        this.setData({ loading: false });
        Notice.alert(error.message || '课程加载失败');
      });
  },

  buildCourseEntry(course) {
    const sessions = (course.sessions || []).sort(
      (a, b) => a.sessionIndex - b.sessionIndex
    );
    const teacherName = course.teacherName || '';

    const sessionInfo = sessions.map((s) => ({
      sessionId: s.id,
      sessionTitle: s.sessionTitle || s.displayTitle || `第${s.sessionIndex}次课`,
      sessionIndex: s.sessionIndex,
      date: s.date || '',
      time: s.startTime ? `${s.startTime}-${s.endTime}` : '',
      recordCount: s.feedbackCount || 0
    }));

    const totalRecords = sessionInfo.reduce((sum, s) => sum + s.recordCount, 0);
    const nextSession = sessions.find((s) => s.status === 'scheduled') || sessions[sessions.length - 1] || {};

    return {
      id: course.id,
      name: course.name,
      subject: course.subject || '',
      grade: course.grade || '',
      teacherName,
      classroomName: nextSession.classroomName || course.classroomName || '待定教室',
      sessionCount: sessions.length,
      sessionInfo,
      totalRecords,
      nextSessionTime: nextSession.startTime
        ? `${nextSession.date || ''} ${nextSession.startTime}-${nextSession.endTime || ''}`
        : ''
    };
  },

  goCourseSessions(event) {
    const courseId = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/parent/exercises/exercises?courseId=${courseId}`
    });
  },

  // ================================================================
  //  Mode 2: Session list — 课次列表，点击进入单课次错题
  // ================================================================
  loadSessionList() {
    this.setData({ loading: true });
    Promise.all([
      Api.getStudentCourseDetail(this.data.courseId),
      Api.getStudentWrongWorkbook ? Api.getStudentWrongWorkbook({ courseId: this.data.courseId }) : Promise.resolve({ records: [], summary: {} })
    ])
      .then(([detail, workbook]) => {
        const course = detail.course || {};
        const sessions = (detail.sessions || []).sort(
          (a, b) => a.sessionIndex - b.sessionIndex
        );
        const feedbacks = detail.lessonFeedbacks || [];

        const sessionList = sessions.map((s) => {
          // Count records that belong ONLY to this session
          const count = feedbacks.filter(
            (f) => f.courseSessionId === s.id
          ).length;
          return {
            sessionId: s.id,
            sessionTitle: s.sessionTitle || s.displayTitle || `第${s.sessionIndex}次课`,
            sessionIndex: s.sessionIndex,
            label: `第${s.sessionIndex}次课本讲总结`,
            date: s.date || '',
            time: s.startTime ? `${s.startTime}-${s.endTime}` : '',
            teacherName: s.teacherName || course.teacherName || '',
            status: s.status || '',
            statusText: s.statusText || '',
            recordCount: count
          };
        });

        this.setData({
          courseName: course.name || '',
          courseSubject: course.subject || '',
          sessionList,
          workbookSummary: workbook.summary || {},
          workbookRecords: workbook.records || [],
          loading: false
        });
      })
      .catch((error) => {
        this.setData({ loading: false });
        Notice.alert(error.message || '课次列表加载失败');
      });
  },

  // Click a session → go to single-session records
  goSessionRecords(event) {
    const sessionId = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/parent/exercises/exercises?courseId=${this.data.courseId}&sessionId=${sessionId}`
    });
  },

  // ================================================================
  //  Mode 3: Single-session records — 只看本次课的错题
  // ================================================================
  loadSessionRecords() {
    this.setData({ loading: true });
    Promise.all([
      Api.getStudentCourseDetail(this.data.courseId),
      Api.getStudentWrongWorkbook
        ? Api.getStudentWrongWorkbook({ courseId: this.data.courseId, courseSessionId: this.data.sessionId })
        : Promise.resolve({ records: [], summary: {} })
    ])
      .then(([detail, workbook]) => {
        const course = detail.course || {};
        const sessions = detail.sessions || [];
        const feedbacks = detail.lessonFeedbacks || [];

        // Find this specific session
        const session = sessions.find((s) => s.id === this.data.sessionId) || {};

        // ONLY this session's records
        const records = feedbacks
          .filter((f) => f.courseSessionId === this.data.sessionId)
          .map(buildFeedbackRecord);

        this.setData({
          courseName: course.name || '',
          sessionLabel: `第${session.sessionIndex || ''}次课本讲总结`,
          sessionDetail: {
            sessionTitle: session.sessionTitle || session.displayTitle || '',
            date: session.date || '',
            time: session.startTime ? `${session.startTime}-${session.endTime}` : '',
            teacherName: session.teacherName || course.teacherName || '',
            classroomName: session.classroomName || course.classroomName || '',
            status: session.status || '',
            statusText: session.statusText || ''
          },
          sessionRecords: records,
          workbookSummary: workbook.summary || {},
          workbookRecords: workbook.records || [],
          loading: false
        });
      })
      .catch((error) => {
        this.setData({ loading: false });
        Notice.alert(error.message || '错题加载失败');
      });
  },

  // View record detail
  viewRecordDetail(event) {
    const feedbackId = event.currentTarget.dataset.id;
    if (!feedbackId) return;
    Api.getFeedbackDetail(feedbackId)
      .then((feedback) => {
        const content = feedback.text || '该记录仅包含图片或语音。';
        Notice.alert(content, `${feedback.courseSessionTitle} · 错题详情`);
      })
      .catch((error) => Notice.alert(error.message || '详情加载失败'));
  },

  // Preview record media
  previewRecordMedia(event) {
    const fileId = event.currentTarget.dataset.id;
    if (fileId) {
      wx.navigateTo({ url: `/pages/file-preview/file-preview?id=${fileId}` });
    }
  },

  // ================================================================
  //  Mode 4: Test list — 课堂小测/本讲总结
  // ================================================================
  loadTestList() {
    this.setData({ loading: true });
    Api.getStudentCourseDetail(this.data.courseId)
      .then((detail) => {
        const course = detail.course || {};
        const sessions = (detail.sessions || []).sort(
          (a, b) => a.sessionIndex - b.sessionIndex
        );
        const feedbacks = detail.lessonFeedbacks || [];

        const sessionTests = sessions.map((s) => {
          const records = feedbacks
            .filter((feedback) =>
              feedback.courseSessionId === s.id
              && (feedback.feedbackType || 'post') === this.data.testType
            )
            .map(buildFeedbackRecord);
          return {
            sessionId: s.id,
            sessionTitle: s.sessionTitle || s.displayTitle || `第${s.sessionIndex}次课`,
            sessionIndex: s.sessionIndex,
            date: s.date || '',
            time: s.startTime ? `${s.startTime}-${s.endTime}` : '',
            teacherName: s.teacherName || course.teacherName || '',
            classroomName: s.classroomName || course.classroomName || '',
            status: s.status || '',
            statusText: s.statusText || '',
            records
          };
        });

        const requestedIndex = this.data.sessionId
          ? sessionTests.findIndex((item) => item.sessionId === this.data.sessionId)
          : -1;
        const defaultIndex = requestedIndex >= 0
          ? requestedIndex
          : (sessionTests.length > 0 ? sessionTests.length - 1 : 0);
        this.setData({
          courseName: course.name || '',
          sessionTests,
          testCurrentIndex: defaultIndex,
          testCurrentSession: sessionTests[defaultIndex] || null,
          loading: false
        });
      })
      .catch((error) => {
        this.setData({ loading: false });
        Notice.alert(error.message || '课次列表加载失败');
      });
  },

  goTestDetail(event) {
    const feedbackId = event.currentTarget.dataset.id;
    if (!feedbackId) return;
    Api.getFeedbackDetail(feedbackId)
      .then((feedback) => {
        const content = feedback.text || '该记录仅包含媒体反馈。';
        Notice.alert(content, feedback.feedbackTypeText || '学习反馈');
      })
      .catch((error) => Notice.alert(error.message || '详情加载失败'));
  },

  switchTestTab(event) {
    const index = event.currentTarget.dataset.index;
    this.setData({
      testCurrentIndex: index,
      testCurrentSession: this.data.sessionTests[index]
    });
  },

  previewInlineImage(event) {
    const current = event.currentTarget.dataset.current;
    const urls = (event.currentTarget.dataset.urls || []).map((f) => f.previewUrl).filter(Boolean);
    wx.previewImage({
      current,
      urls: urls.length ? urls : [current]
    });
  },

  playInlineVoice(event) {
    const url = event.currentTarget.dataset.url;
    if (!url) return;
    const innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.src = url;
    innerAudioContext.play();
    innerAudioContext.onEnded(() => {
      innerAudioContext.destroy();
    });
    innerAudioContext.onError(() => {
      innerAudioContext.destroy();
      Notice.alert('语音播放失败');
    });
  },

  toggleRecordExpand(event) {
    const index = event.currentTarget.dataset.index;
    const key = `testCurrentSession.records[${index}].expanded`;
    this.setData({ [key]: !this.data.testCurrentSession.records[index].expanded });
  },

  // ================================================================
  //  Mode 5: All Records — 我的错题本（跨课程审阅）
  // ================================================================
  loadAllRecords() {
    this.setData({ loading: true });
    // Load all feedbacks + courses to build grouped view
    Promise.all([
      Api.getStudentLessonFeedbacks({}),
      Api.getStudentCourses(),
      Api.getStudentWrongWorkbook ? Api.getStudentWrongWorkbook({}) : Promise.resolve({ records: [], summary: {} })
    ])
      .then(([feedbackResult, courseResult, workbook]) => {
        const feedbacks = feedbackResult.feedbacks || [];
        const courses = courseResult.courses || courseResult.courseGroups || [];

        // Build a courseId → courseName lookup
        const courseMap = {};
        courses.forEach((c) => {
          courseMap[c.id] = c.name;
        });

        // Group feedbacks by courseName → sessionTitle
        const groupMap = {};
        feedbacks.forEach((f) => {
          const courseName = f.courseName || courseMap[f.courseId] || '未知课程';
          const sessionKey = f.courseSessionTitle || f.courseSessionId || '';
          const groupKey = `${courseName}|||${sessionKey}|||${f.courseId}|||${f.courseSessionId}`;

          if (!groupMap[groupKey]) {
            groupMap[groupKey] = {
              courseName,
              courseId: f.courseId,
              sessionTitle: sessionKey,
              courseSessionId: f.courseSessionId,
              records: []
            };
          }
          groupMap[groupKey].records.push(buildFeedbackRecord(f));
        });

        // Convert to sorted array: groups by course, sessions in order
        const groups = Object.values(groupMap).sort((a, b) => {
          if (a.courseName !== b.courseName) return a.courseName.localeCompare(b.courseName);
          return (a.courseSessionId || '').localeCompare(b.courseSessionId || '');
        });

        const total = feedbacks.length;
        this.setData({
          allRecordsGroups: groups,
          allRecordsTotal: total,
          workbookSummary: workbook.summary || {},
          workbookRecords: workbook.records || [],
          loading: false
        });
      })
      .catch((error) => {
        this.setData({ loading: false });
        Notice.alert(error.message || '错题本加载失败');
      });
  },

  // ================================================================
  //  Shared utilities
  // ================================================================
  exportWorkbook(event) {
    if (this.data.exportingWorkbook) return;
    const format = (event.currentTarget.dataset.format || 'pdf');
    const scope = event.currentTarget.dataset.scope || this.data.mode;
    const payload = {
      format,
      courseId: this.data.courseId,
      courseSessionId: this.data.sessionId
    };
    if (scope === 'all') {
      payload.courseId = '';
      payload.courseSessionId = '';
    } else if (scope === 'course') {
      payload.courseSessionId = '';
    }
    this.setData({ exportingWorkbook: true });
    Api.exportStudentWrongWorkbook(payload)
      .then((result) => {
        this.setData({ exportingWorkbook: false });
        Notice.alert(`已生成 ${result.fileName}`, '错题本导出');
      })
      .catch((error) => {
        this.setData({ exportingWorkbook: false });
        Notice.alert(error.message || '导出失败');
      });
  },
  previewMedia(event) {
    wx.navigateTo({ url: `/pages/file-preview/file-preview?id=${event.currentTarget.dataset.id}` });
  },

  downloadImage(event) {
    Api.downloadFeedbackImage(event.currentTarget.dataset.id)
      .then((result) => Notice.alert(result.message, '图片下载'))
      .catch((error) => Notice.alert(error.message || '下载失败'));
  },

  playVoice(event) {
    Api.playFeedbackVoice(event.currentTarget.dataset.id)
      .then((result) => Notice.alert(result.message, '语音播放'))
      .catch((error) => Notice.alert(error.message || '播放失败'));
  }
});
