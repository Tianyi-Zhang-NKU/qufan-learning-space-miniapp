const Api = require('../../services/api');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

function roleName(role) {
  if (role === 'teacher') return '教师端';
  if (role === 'admin') return '管理端';
  return '学生/家长端';
}

Page({
  data: {
    session: {},
    profile: {},
    roleName: ''
  },

  onShow() {
    const session = Guard.ensureLogin();
    if (!session) return;
    Api.getCurrentUserProfile()
      .then((result) => {
        const active = result.session || session;
        this.setData({
          session: active,
          profile: result.profile || {},
          roleName: roleName(active.role)
        });
      })
      .catch((error) => Notice.alert(error.message || '个人信息加载失败'));
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
