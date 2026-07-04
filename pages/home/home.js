const Guard = require('../../utils/page-guard');

Page({
  onShow() {
    const session = Guard.ensureLogin();
    if (!session) return;
    wx.redirectTo({ url: Guard.roleHome(session.role) });
  }
});
