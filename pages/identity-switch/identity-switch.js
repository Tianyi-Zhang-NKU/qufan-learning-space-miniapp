const Api = require('../../services/api');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

Page({
  data: {
    identities: [],
    identityOptions: [],
    identityIndex: 0,
    selectedIdentity: null
  },

  onShow() {
    this.load();
  },

  load() {
    Api.listIdentities().then((identities) => {
      this.setData({
        identities,
        identityOptions: identities.map((item) => `${item.label} · ${item.roleName}`),
        identityIndex: 0,
        selectedIdentity: identities[0] || null
      });
    });
  },

  chooseIdentity(event) {
    const identityIndex = Number(event.detail.value || 0);
    this.setData({
      identityIndex,
      selectedIdentity: this.data.identities[identityIndex] || null
    });
  },

  enterSelected() {
    const identityId = this.data.selectedIdentity ? this.data.selectedIdentity.id : '';
    if (!identityId) {
      Notice.toast('请选择身份');
      return;
    }
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
