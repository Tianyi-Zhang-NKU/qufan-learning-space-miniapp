const Guard = require('../../utils/page-guard');

Page({
  onShow() {
    const session = Guard.ensureLogin();
    if (!session) return;
    if (session.role === 'admin') {
      wx.redirectTo({ url: '/pages/admin/schedule-board/schedule-board' });
      return;
    }
    if (session.role === 'teacher') {
      wx.redirectTo({ url: '/pages/teacher/courses/courses' });
      return;
    }
    wx.redirectTo({ url: '/pages/parent/courses/courses' });
  }
});
