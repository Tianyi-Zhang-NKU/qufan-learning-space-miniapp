const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

/**
 * Format a date as YYYY-MM-DD
 */
function formatDate(year, month, day) {
  const pad = (v) => String(v).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Get today's date object { year, month, day, dateStr }
 */
function getToday() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    dateStr: formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
  };
}

/**
 * How many days in a given month
 */
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Day-of-week for the 1st of the month: 0=Sun, 1=Mon, …, 6=Sat
 */
function firstDayOfWeek(year, month) {
  return new Date(year, month - 1, 1).getDay();
}

/**
 * Build the 42-cell calendar grid for a given year/month.
 * Returns an array of { day, date, isCurrentMonth, isToday, isSelected, hasCourse }
 */
function buildCalendarDays(year, month, selectedDateStr, courseDates) {
  const today = getToday();
  const total = daysInMonth(year, month);
  const firstDow = firstDayOfWeek(year, month); // 0=Sun

  // Monday-based: shift so Monday is column 0.
  // If firstDow == 0 (Sunday), startOffset = 6; else startOffset = firstDow - 1
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;

  const days = [];

  // Previous month fillers
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevTotal = daysInMonth(prevYear, prevMonth);
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = prevTotal - i;
    const dateStr = formatDate(prevYear, prevMonth, d);
    days.push({
      day: d,
      date: dateStr,
      isCurrentMonth: false,
      isToday: dateStr === today.dateStr,
      isSelected: dateStr === selectedDateStr,
      hasCourse: courseDates.has(dateStr)
    });
  }

  // Current month
  for (let d = 1; d <= total; d++) {
    const dateStr = formatDate(year, month, d);
    days.push({
      day: d,
      date: dateStr,
      isCurrentMonth: true,
      isToday: dateStr === today.dateStr,
      isSelected: dateStr === selectedDateStr,
      hasCourse: courseDates.has(dateStr)
    });
  }

  // Next month fillers (fill to 42 cells)
  const remaining = 42 - days.length;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  for (let d = 1; d <= remaining; d++) {
    const dateStr = formatDate(nextYear, nextMonth, d);
    days.push({
      day: d,
      date: dateStr,
      isCurrentMonth: false,
      isToday: dateStr === today.dateStr,
      isSelected: dateStr === selectedDateStr,
      hasCourse: courseDates.has(dateStr)
    });
  }

  return days.slice(0, 42);
}

/**
 * Collect all dates that have at least one course session
 */
function collectCourseDates(courses) {
  const dates = new Set();
  (courses || []).forEach((course) => {
    (course.sessions || []).forEach((session) => {
      if (session.date) dates.add(session.date);
    });
  });
  return dates;
}

/**
 * Filter sessions that fall on the given date, decorate with course info
 */
function getSessionsForDate(courses, dateStr) {
  const result = [];
  (courses || []).forEach((course) => {
    (course.sessions || []).forEach((session) => {
      if (session.date === dateStr) {
        result.push({
          id: session.id,
          courseId: course.id,
          courseName: course.name,
          teacherName: session.teacherName || course.teacherName || '',
          classroomName: session.classroomName || course.classroomName || '待定教室',
          startTime: session.startTime,
          endTime: session.endTime,
          date: session.date,
          status: session.status,
          sessionTitle: session.displayTitle || session.sessionTitle || ''
        });
      }
    });
  });
  // Sort by startTime
  result.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  return result;
}

Page({
  data: {
    session: {},
    currentStudent: {},
    courseGroups: [],

    // Calendar
    weekLabels: WEEK_LABELS,
    calendarYear: 2026,
    calendarMonth: 6,
    calendarDays: [],
    selectedDateStr: '',
    selectedDateText: '',
    courseDates: [],

    // Date course list
    dateCourses: []
  },

  onShow() {
    const session = Guard.ensureLogin('parent');
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    const today = getToday();

    Api.getStudentCourses()
      .then((result) => {
        const courseGroups = result.courseGroups || result.courses || [];
        const courseDates = collectCourseDates(courseGroups);

        // Default select today
        const selectedDateStr = today.dateStr;
        const dateCourses = getSessionsForDate(courseGroups, selectedDateStr);

        const calendarDays = buildCalendarDays(
          today.year,
          today.month,
          selectedDateStr,
          courseDates
        );

        this.setData({
          currentStudent: result.currentStudent || {},
          courseGroups,
          courseDates: Array.from(courseDates),
          calendarYear: today.year,
          calendarMonth: today.month,
          calendarDays,
          selectedDateStr,
          selectedDateText: this.formatDisplayDate(selectedDateStr),
          dateCourses
        });
      })
      .catch((error) => Notice.alert(error.message || '课程加载失败'));
  },

  /** Format date string for display */
  formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const today = getToday();
    if (dateStr === today.dateStr) return '今天';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow.getFullYear(), tomorrow.getMonth() + 1, tomorrow.getDate());
    if (dateStr === tomorrowStr) return '明天';
    return `${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
  },

  /** Navigate to previous month */
  prevMonth() {
    let { calendarYear, calendarMonth } = this.data;
    if (calendarMonth === 1) {
      calendarYear -= 1;
      calendarMonth = 12;
    } else {
      calendarMonth -= 1;
    }
    this.renderMonth(calendarYear, calendarMonth);
  },

  /** Navigate to next month */
  nextMonth() {
    let { calendarYear, calendarMonth } = this.data;
    if (calendarMonth === 12) {
      calendarYear += 1;
      calendarMonth = 1;
    } else {
      calendarMonth += 1;
    }
    this.renderMonth(calendarYear, calendarMonth);
  },

  /** Re-render the calendar for a specific year/month */
  renderMonth(year, month) {
    const { selectedDateStr, courseDates } = this.data;
    const calendarDays = buildCalendarDays(
      year,
      month,
      selectedDateStr,
      new Set(courseDates)
    );
    this.setData({
      calendarYear: year,
      calendarMonth: month,
      calendarDays
    });
  },

  /** Handle day tap */
  onDayTap(event) {
    const date = event.currentTarget.dataset.date;
    const clickable = event.currentTarget.dataset.clickable;
    if (!date || !clickable) return;

    const { courseGroups, courseDates } = this.data;
    const dateCourses = getSessionsForDate(courseGroups, date);

    // Rebuild calendar with new selection
    const calendarDays = buildCalendarDays(
      this.data.calendarYear,
      this.data.calendarMonth,
      date,
      new Set(courseDates)
    );

    this.setData({
      selectedDateStr: date,
      selectedDateText: this.formatDisplayDate(date),
      calendarDays,
      dateCourses
    });
  },

  /** Navigate to pre-test or post-test (opens session detail view) */
  goTest(event) {
    const { sessionId, type } = event.currentTarget.dataset;
    // Navigate to the session detail page which shows assignments (课前测/课后测)
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${sessionId}&testType=${type}`
    });
  }
});
