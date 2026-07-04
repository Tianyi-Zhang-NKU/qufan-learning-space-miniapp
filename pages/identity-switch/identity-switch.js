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
    this.setData({ session });
    Api.listIdentities()
      .then((identities) => this.setData({ identities }))
      .catch((error) => Notice.alert(error.message || '身份加载失败'));
  },

  enterHome() {
    wx.redirectTo({ url: Guard.roleHome(this.data.session.role) });
  },

  goLogin() {
    wx.redirectTo({ url: '/pages/login/login' });
  }
});
