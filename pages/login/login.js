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
      return;
    }
    this.setData({ logging: true });
    let Api;
    try {
      Api = getApi();
    } catch (error) {
      Notice.alert(error.message || '登录服务加载失败，请重新编译。');
      this.setData({ logging: false });
      return;
    }
    Api.loginByPhone({ phone })
      .then((session) => {
        getApp().setSession(session);
        wx.redirectTo({ url: Guard.roleHome(session.role) });
        this.setData({ logging: false });
      })
      .catch((error) => {
        Notice.alert(error.message || '登录失败，请确认手机号。');
        this.setData({ logging: false });
      });
  },

  onGetPhoneNumber() {
    Notice.toast('请使用报班手机号登录');
  },

  smsPlaceholder() {
    Notice.toast('请使用报班手机号登录');
  }
});
