const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

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

    // ---- All-records mode ----
    allRecordsGroups: [],
    allRecordsTotal: 0
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
    } else if (courseId && type) {
      // From home page: pre/post test buttons
      this.setData({
        mode: 'testList',
        testType: type,
        testTypeLabel: type === 'pre' ? '课前测' : '课后测',
        courseId
      });
      wx.setNavigationBarTitle({
        title: type === 'pre' ? '课前测记录' : '课后测记录'
      });
    } else if (courseId && sessionId) {
      // From session list: single session's wrong records
      this.setData({
        mode: 'records',
        courseId,
        sessionId
      });
      wx.setNavigationBarTitle({ title: '课程错题' });
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
    Api.getStudentCourseDetail(this.data.courseId)
      .then((detail) => {
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
            label: `第${s.sessionIndex}次课课程错题`,
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
    Api.getStudentCourseDetail(this.data.courseId)
      .then((detail) => {
        const course = detail.course || {};
        const sessions = detail.sessions || [];
        const feedbacks = detail.lessonFeedbacks || [];

        // Find this specific session
        const session = sessions.find((s) => s.id === this.data.sessionId) || {};

        // ONLY this session's records
        const records = feedbacks
          .filter((f) => f.courseSessionId === this.data.sessionId)
          .map((r) => ({
            id: r.id,
            text: r.text || '',
            createdAt: r.createdAt || '',
            teacherName: r.teacherName || '',
            imageFiles: r.imageFiles || [],
            voiceFiles: r.voiceFiles || [],
            imageCount: r.imageCount || 0,
            voiceCount: r.voiceCount || 0
          }));

        this.setData({
          courseName: course.name || '',
          sessionLabel: `第${session.sessionIndex || ''}次课课程错题`,
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
  //  Mode 4: Test list — 课前测/课后测
  // ================================================================
  loadTestList() {
    const typeLabel = this.data.testTypeLabel;
    this.setData({ loading: true });
    Api.getStudentCourseDetail(this.data.courseId)
      .then((detail) => {
        const course = detail.course || {};
        const sessions = (detail.sessions || []).sort(
          (a, b) => a.sessionIndex - b.sessionIndex
        );
        const assignments = detail.assignments || [];

        const sessionTests = sessions.map((s) => {
          const tests = assignments.filter(
            (a) => a.courseSessionId === s.id && a.type === this.data.testType
          );
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
            tests: tests.map((t) => ({
              id: t.id,
              title: t.title || `${s.sessionTitle || '课次'}${typeLabel}`,
              statusText: t.statusText || '可选记录',
              file: t.file || null,
              hasFile: !!t.file
            }))
          };
        });

        this.setData({
          courseName: course.name || '',
          sessionTests,
          loading: false
        });
      })
      .catch((error) => {
        this.setData({ loading: false });
        Notice.alert(error.message || '课次列表加载失败');
      });
  },

  goTestDetail(event) {
    const fileId = event.currentTarget.dataset.fileId;
    if (fileId) {
      wx.navigateTo({ url: `/pages/file-preview/file-preview?id=${fileId}` });
    } else {
      Notice.toast('该测验暂无文件资料', 'none');
    }
  },

  // ================================================================
  //  Mode 5: All Records — 我的错题本（跨课程审阅）
  // ================================================================
  loadAllRecords() {
    this.setData({ loading: true });
    // Load all feedbacks + courses to build grouped view
    Promise.all([
      Api.getStudentLessonFeedbacks({}),
      Api.getStudentCourses()
    ])
      .then(([feedbackResult, courseResult]) => {
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
          groupMap[groupKey].records.push({
            id: f.id,
            text: f.text || '',
            createdAt: f.createdAt || '',
            teacherName: f.teacherName || '',
            imageFiles: f.imageFiles || [],
            voiceFiles: f.voiceFiles || [],
            imageCount: f.imageCount || 0,
            voiceCount: f.voiceCount || 0
          });
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
          loading: false
        });
      })
      .catch((error) => {
        this.setData({ loading: false });
        Notice.alert(error.message || '错题本加载失败');
      });
  },

  // ================================================================
  //  Legacy / shared utilities
  // ================================================================
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
