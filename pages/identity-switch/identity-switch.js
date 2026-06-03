const Api = require('../../services/api');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

Page({
  data: {
    identities: []
  },

  onShow() {
    this.load();
  },

  load() {
    Api.listIdentities().then((identities) => {
      this.setData({ identities });
    });
  },

  switchIdentity(event) {
    const identityId = event.currentTarget.dataset.id;
    Api.switchIdentity(identityId)
      .then((session) => {
        getApp().setSession(session);
        wx.redirectTo({ url: Guard.roleHome(session.role) });
      })
      .catch((error) => {
        Notice.alert(error.message || '切换身份失败');
      });
  },

  goLogin() {
    wx.redirectTo({ url: '/pages/login/login' });
  }
});
