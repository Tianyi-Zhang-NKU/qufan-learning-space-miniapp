const Api = require('../../services/api');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

Page({
  data: {
    session: {},
    identities: []
  },

  onShow() {
    const session = Guard.ensureLogin();
    if (!session) return;
    Promise.all([Api.getCurrentSession(), Api.listIdentities()]).then(([current, identities]) => {
      this.setData({ session: current || session, identities });
    });
  },

  goIdentitySwitch() {
    wx.navigateTo({ url: '/pages/identity-switch/identity-switch' });
  },

  logout() {
    Api.logout().then(() => {
      getApp().clearSession();
      Notice.toast('已退出');
      wx.redirectTo({ url: '/pages/login/login' });
    });
  }
});
