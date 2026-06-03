const Api = require('../../services/api');
const config = require('../../services/config');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

Page({
  data: {
    phone: config.demoPhones.student,
    logging: false,
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
    this.setData({ phone: event.currentTarget.dataset.phone });
  },

  login() {
    const phone = String(this.data.phone || '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      Notice.toast('请输入 11 位手机号');
      return;
    }
    this.setData({ logging: true });
    Api.loginByPhone({ phone })
      .then((session) => {
        getApp().setSession(session);
        wx.redirectTo({ url: Guard.roleHome(session.role) });
      })
      .catch((error) => Notice.alert(error.message || '登录失败，请确认手机号。'))
      .finally(() => {
        this.setData({ logging: false });
      });
  },

  onGetPhoneNumber() {
    Notice.toast('微信手机号授权待接入后端');
  },

  smsPlaceholder() {
    Notice.toast('短信验证码登录待接入');
  }
});
