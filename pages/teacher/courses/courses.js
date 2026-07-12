const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');
const ScheduleCalendar = require('../../../utils/schedule-calendar');

const WEEK_LABELS = ScheduleCalendar.WEEK_LABELS;

Page({
  data: {
    session: {},
    teacher: {},
    teacherName: '',
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
    const session = Guard.ensureLogin('teacher');
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    const today = ScheduleCalendar.getToday();

    Api.getTeacherCourses()
      .then((result) => {
        const courseGroups = result.courseGroups || result.courses || [];
        const teacher = result.teacher || {};
        const courseDates = ScheduleCalendar.collectCourseDates(courseGroups);

        // Default select today, but keep the user's selected date after edits.
        const selectedDateStr = this.data.selectedDateStr || today.dateStr;
        const dateCourses = ScheduleCalendar.getSessionsForDate(courseGroups, selectedDateStr);

        const calendarDays = ScheduleCalendar.buildCalendarDays(
          today.year,
          today.month,
          selectedDateStr,
          courseDates
        );

        this.setData({
          teacher,
          teacherName: teacher.name || teacher.fullName || session.displayName || '教师',
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
    return ScheduleCalendar.formatDisplayDate(dateStr);
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
    const calendarDays = ScheduleCalendar.buildCalendarDays(
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
    const dateCourses = ScheduleCalendar.getSessionsForDate(courseGroups, date);

    // Rebuild calendar with new selection
    const calendarDays = ScheduleCalendar.buildCalendarDays(
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

  /** Navigate to pre-test wrong-feedback student list */
  goPreTest(event) {
    const { courseId, courseName, sessionId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/teacher/feedback-students/feedback-students?courseId=${courseId}&courseName=${encodeURIComponent(courseName)}&feedbackType=pre&courseSessionId=${sessionId || ''}`
    });
  },

  /** Navigate to post-test wrong-feedback student list */
  goPostTest(event) {
    const { courseId, courseName, sessionId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/teacher/feedback-students/feedback-students?courseId=${courseId}&courseName=${encodeURIComponent(courseName)}&feedbackType=post&courseSessionId=${sessionId || ''}`
    });
  }
});
