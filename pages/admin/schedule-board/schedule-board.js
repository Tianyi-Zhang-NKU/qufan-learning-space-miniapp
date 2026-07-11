const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

const WEEK_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDateStr(y, m, d) {
  return y + '-' + pad(m) + '-' + pad(d);
}

function parseDate(str) {
  // "2026-06-08" -> { y, m, d }
  const parts = (str || '').split('-');
  return {
    y: Number(parts[0]) || 2026,
    m: Number(parts[1]) || 6,
    d: Number(parts[2]) || 1
  };
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

Page({
  data: {
    // 日历数据
    weekDays: [],           // [{ dateStr, dayName, dayNum, hasSessions, isToday, isSelected }]
    weekLabel: '',          // "2026年6月 第2周"
    selectedDate: '',       // "2026-06-08"
    todayStr: '',           // "2026-06-06"

    // 当前周起始日期（用于导航）
    weekStart: null,

    // 所有课次（原始数据，用于筛选）
    allSessions: [],

    // 教室分组：所选日期下的教室及其课次
    dateClassrooms: [],     // [{ classroomId, classroomName, campus, capacity, sessions: [...] }]
    expandedClassroomId: '',

    // 统计数据
    dateSessionCount: 0,
    dateClassroomCount: 0
  },

  onShow() {
    if (!Guard.ensureLogin('admin')) return;
    const now = new Date();
    const todayStr = formatDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const monday = getMondayOfWeek(now);
    const weekStart = formatDateStr(monday.getFullYear(), monday.getMonth() + 1, monday.getDate());

    this.setData({ todayStr, selectedDate: todayStr, weekStart: null }); // 先设today
    this.loadScheduleData(todayStr, weekStart);
  },

  loadScheduleData(selectedDate, weekStartOverride) {
    Api.getBootstrap()
      .then((bootstrap) => {
        const sessions = (bootstrap.courseSessions || []).map((s) => {
          const course = (bootstrap.courses || []).find((c) => c.id === s.courseId) || {};
          const teacher = (bootstrap.teachers || []).find((t) => t.id === s.teacherId) || {};
          const classroom = (bootstrap.classrooms || []).find((r) => r.id === s.classroomId) || {};
          return {
            ...s,
            courseName: course.name || '',
            courseSubject: course.subject || '',
            teacherName: teacher.name || teacher.fullName || '',
            classroomName: classroom.name || '未知教室',
            classroomCampus: classroom.campus || '',
            statusTone: s.status === 'finished' ? 'ok' : s.status === 'scheduled' ? 'warn' : 'muted',
            displayMeta: s.startTime + '-' + s.endTime + ' · ' + (teacher.name || teacher.fullName || '')
          };
        });

        // 所有有课次的日期集合
        const datesWithSessions = new Set(sessions.map((s) => s.date));

        // 计算周起始
        let weekStart;
        if (weekStartOverride) {
          weekStart = weekStartOverride;
        } else if (this.data.weekStart) {
          weekStart = this.data.weekStart;
        } else {
          const monday = getMondayOfWeek(new Date());
          weekStart = formatDateStr(monday.getFullYear(), monday.getMonth() + 1, monday.getDate());
        }

        const weekDays = this.buildWeekDays(weekStart, selectedDate, datesWithSessions);
        const weekLabel = this.buildWeekLabel(weekStart);
        const { dateClassrooms, dateSessionCount, dateClassroomCount } = this.buildDateClassrooms(selectedDate, sessions, bootstrap.classrooms || []);

        this.setData({
          allSessions: sessions,
          weekStart,
          weekDays,
          weekLabel,
          selectedDate,
          dateClassrooms,
          dateSessionCount,
          dateClassroomCount,
          expandedClassroomId: ''
        });
      })
      .catch((error) => Notice.alert(error.message || '课表加载失败'));
  },

  // 构建一周 7 天的数据
  buildWeekDays(weekStart, selectedDate, datesWithSessions) {
    const todayStr = this.data.todayStr || formatDateStr(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
    const start = parseDate(weekStart);
    const startDate = new Date(start.y, start.m - 1, start.d);
    const days = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = formatDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
      days.push({
        dateStr,
        dayName: '周' + WEEK_NAMES[d.getDay()],
        dayNum: d.getDate(),
        hasSessions: datesWithSessions.has(dateStr),
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate
      });
    }
    return days;
  },

  // 构建周标签
  buildWeekLabel(weekStart) {
    const start = parseDate(weekStart);
    const endDate = new Date(start.y, start.m - 1, start.d + 6);
    return start.y + '年' + start.m + '月 ' + start.d + '日 - ' + endDate.getDate() + '日';
  },

  // 构建所选日期的教室-课次分组
  buildDateClassrooms(date, allSessions, allClassrooms) {
    const dateSessions = allSessions.filter((s) => s.date === date);

    // 按教室分组
    const groupMap = {};
    dateSessions.forEach((s) => {
      const roomId = s.classroomId || 'unknown';
      if (!groupMap[roomId]) {
        const room = allClassrooms.find((r) => r.id === roomId) || {};
        groupMap[roomId] = {
          classroomId: roomId,
          classroomName: room.name || s.classroomName || '未知教室',
          campus: room.campus || '',
          capacity: room.capacity || 0,
          sessions: []
        };
      }
      groupMap[roomId].sessions.push(s);
    });

    // 转换为数组，按教室名排序
    const dateClassrooms = Object.values(groupMap).sort((a, b) => {
      return a.classroomName.localeCompare(b.classroomName);
    });

    // 每个教室内的课次按时间排序
    dateClassrooms.forEach((room) => {
      room.sessions.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    return {
      dateClassrooms,
      dateSessionCount: dateSessions.length,
      dateClassroomCount: dateClassrooms.length
    };
  },

  // ---- 日历交互 ----
  selectDate(event) {
    const dateStr = event.currentTarget.dataset.date;
    if (!dateStr) return;
    this.loadScheduleData(dateStr, this.data.weekStart);
  },

  prevWeek() {
    const start = parseDate(this.data.weekStart);
    const d = new Date(start.y, start.m - 1, start.d - 7);
    const newStart = formatDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
    // 选中日期也往前一周
    const selected = parseDate(this.data.selectedDate);
    const sd = new Date(selected.y, selected.m - 1, selected.d - 7);
    const newSelected = formatDateStr(sd.getFullYear(), sd.getMonth() + 1, sd.getDate());
    this.loadScheduleData(newSelected, newStart);
  },

  nextWeek() {
    const start = parseDate(this.data.weekStart);
    const d = new Date(start.y, start.m - 1, start.d + 7);
    const newStart = formatDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const selected = parseDate(this.data.selectedDate);
    const sd = new Date(selected.y, selected.m - 1, selected.d + 7);
    const newSelected = formatDateStr(sd.getFullYear(), sd.getMonth() + 1, sd.getDate());
    this.loadScheduleData(newSelected, newStart);
  },

  goToday() {
    const now = new Date();
    const todayStr = formatDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const monday = getMondayOfWeek(now);
    const weekStart = formatDateStr(monday.getFullYear(), monday.getMonth() + 1, monday.getDate());
    this.loadScheduleData(todayStr, weekStart);
  },

  // ---- 教室展开 ----
  toggleClassroom(event) {
    const roomId = event.currentTarget.dataset.roomId;
    const { expandedClassroomId } = this.data;
    this.setData({
      expandedClassroomId: expandedClassroomId === roomId ? '' : roomId
    });
  }
});
