const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function formatDate(year, month, day) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

function getToday(date) {
  const now = date || new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    dateStr: formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
  };
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function firstDayOfWeek(year, month) {
  return new Date(year, month - 1, 1).getDay();
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function buildCalendarDays(year, month, selectedDateStr, courseDates, todayStr) {
  const dateSet = courseDates instanceof Set ? courseDates : new Set(courseDates || []);
  const todayDateStr = todayStr || getToday().dateStr;
  const total = daysInMonth(year, month);
  const firstDow = firstDayOfWeek(year, month);
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;
  const days = [];

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevTotal = daysInMonth(prevYear, prevMonth);
  for (let index = startOffset - 1; index >= 0; index -= 1) {
    const day = prevTotal - index;
    const date = formatDate(prevYear, prevMonth, day);
    days.push({
      day,
      date,
      isCurrentMonth: false,
      isToday: date === todayDateStr,
      isSelected: date === selectedDateStr,
      hasCourse: dateSet.has(date)
    });
  }

  for (let day = 1; day <= total; day += 1) {
    const date = formatDate(year, month, day);
    days.push({
      day,
      date,
      isCurrentMonth: true,
      isToday: date === todayDateStr,
      isSelected: date === selectedDateStr,
      hasCourse: dateSet.has(date)
    });
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  for (let day = 1; days.length < 42; day += 1) {
    const date = formatDate(nextYear, nextMonth, day);
    days.push({
      day,
      date,
      isCurrentMonth: false,
      isToday: date === todayDateStr,
      isSelected: date === selectedDateStr,
      hasCourse: dateSet.has(date)
    });
  }

  return days.slice(0, 42);
}

function collectCourseDates(courses) {
  const dates = new Set();
  (courses || []).forEach((course) => {
    (course.sessions || []).forEach((session) => {
      if (session.date) dates.add(session.date);
    });
  });
  return dates;
}

function getSessionsForDate(courses, dateStr) {
  const result = [];
  (courses || []).forEach((course) => {
    (course.sessions || []).forEach((session) => {
      if (session.date !== dateStr) return;
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
        statusText: session.statusText,
        sessionTitle: session.displayTitle || session.sessionTitle || '',
        topic: session.topic || '',
        studentCount: course.studentCount || 0
      });
    });
  });
  return result.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
}

function formatDisplayDate(dateStr, todayStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const todayDateStr = todayStr || getToday().dateStr;
  if (dateStr === todayDateStr) return '今天';
  if (dateStr === addDays(todayDateStr, 1)) return '明天';
  return `${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
}

module.exports = {
  WEEK_LABELS,
  formatDate,
  getToday,
  daysInMonth,
  firstDayOfWeek,
  buildCalendarDays,
  collectCourseDates,
  getSessionsForDate,
  formatDisplayDate
};
