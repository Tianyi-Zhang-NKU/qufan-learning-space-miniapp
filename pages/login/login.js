const config = require('../../services/config');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

let apiModule = null;

function getApi() {
  if (!apiModule) {
    apiModule = require('../../services/api');
  }
  return apiModule;
}

Page({
  data: {
    phone: '',
    logging: false,
    choosingRole: false,
    availableRoles: [],
    selectedRoleId: '',
    showDemo: false,
    demoPhones: [
      { label: '学生/家长', phone: config.demoPhones.student },
      { label: '老师', phone: config.demoPhones.teacher },
      { label: '管理员', phone: config.demoPhones.admin }
    ]
  },

  onLoad() {
    const session = wx.getStorageSync('session');
    if (session && session.identityId) {
      wx.redirectTo({ url: Guard.roleHome(session.role) });
    }
  },

  onPhoneInput(event) {
    this.setData({ phone: event.detail.value });
  },

  useDemoPhone(event) {
    this.setData({ phone: event.currentTarget.dataset.phone, showDemo: false });
  },

  toggleDemo() {
    this.setData({ showDemo: !this.data.showDemo });
  },

  login() {
    const phone = String(this.data.phone || '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      Notice.toast('请输入 11 位手机号');
      return Promise.resolve(null);
    }
    this.setData({ logging: true });
    let Api;
    try {
      Api = getApi();
    } catch (error) {
      Notice.alert(error.message || '登录服务加载失败，请重新编译。');
      this.setData({ logging: false });
      return Promise.resolve(null);
    }
    return Api.getAvailableRoles({ phone })
      .then((result) => {
        const roles = result.roles || [];
        if (roles.length === 1) return this.activateRole(phone, roles[0].id);
        this.setData({
          logging: false,
          choosingRole: true,
          availableRoles: roles,
          selectedRoleId: roles[0] ? roles[0].id : ''
        });
        return null;
      })
      .then((session) => {
        return session ? this.finishLogin(session) : null;
      })
      .catch((error) => {
        Notice.alert(error.message || '登录失败，请确认手机号。');
        this.setData({ logging: false });
        return null;
      });
  },

  activateRole(phone, roleId) {
    const Api = getApi();
    return Api.loginByPhone({ phone, roleId })
      .then(() => Api.selectActiveRole({ roleId }));
  },

  finishLogin(session) {
    getApp().setSession(session);
    wx.redirectTo({ url: Guard.roleHome(session.role) });
    this.setData({ logging: false, choosingRole: false, availableRoles: [], selectedRoleId: '' });
    return session;
  },

  selectRole(event) {
    this.setData({ selectedRoleId: event.currentTarget.dataset.roleId || '' });
  },

  confirmRole() {
    const phone = String(this.data.phone || '').trim();
    const roleId = this.data.selectedRoleId;
    if (!phone || !roleId || this.data.logging) return Promise.resolve(null);
    this.setData({ logging: true });
    return this.activateRole(phone, roleId)
      .then((session) => this.finishLogin(session))
      .catch((error) => {
        Notice.alert(error.message || '身份切换失败，请重试。');
        this.setData({ logging: false });
        return null;
      });
  },

  backToPhoneLogin() {
    this.setData({ choosingRole: false, availableRoles: [], selectedRoleId: '', logging: false });
  },

  onGetPhoneNumber() {
    Notice.toast('请使用报班手机号登录');
  },

  smsPlaceholder() {
    Notice.toast('请使用报班手机号登录');
  }
});
