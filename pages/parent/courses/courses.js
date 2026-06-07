const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');
const ScheduleCalendar = require('../../../utils/schedule-calendar');

const WEEK_LABELS = ScheduleCalendar.WEEK_LABELS;

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
    const today = ScheduleCalendar.getToday();

    Api.getStudentCourses()
      .then((result) => {
        const courseGroups = result.courseGroups || result.courses || [];
        const courseDates = ScheduleCalendar.collectCourseDates(courseGroups);

        // Default select today
        const selectedDateStr = today.dateStr;
        const dateCourses = ScheduleCalendar.getSessionsForDate(courseGroups, selectedDateStr);

        const calendarDays = ScheduleCalendar.buildCalendarDays(
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

  /** Navigate to pre-test or post-test (opens session detail view) */
  goTest(event) {
    const { courseId, sessionId, type } = event.currentTarget.dataset;
    if (!courseId || !sessionId || !type) return;
    wx.navigateTo({
      url: `/pages/parent/exercises/exercises?courseId=${courseId}&sessionId=${sessionId}&type=${type}`
    });
  },

  goLive(event) {
    const { sessionId } = event.currentTarget.dataset;
    if (!sessionId) return;
    wx.navigateTo({ url: `/pages/live-player/live-player?id=${sessionId}` });
  }
});
