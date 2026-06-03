const Api = require('../../services/api');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

Page({
  data: {
    session: {},
    identities: [],
    children: [],
    childOptions: [],
    childIndex: 0,
    currentChildLabel: ''
  },

  onShow() {
    const session = Guard.ensureLogin();
    if (!session) return;
    Promise.all([Api.getCurrentSession(), Api.listIdentities()]).then(([current, identities]) => {
      const active = current || session;
      this.setData({ session: active, identities });
      if (active.role === 'parent') {
        Api.listParentChildren().then((children) => {
          const childIndex = Math.max(0, children.findIndex((item) => item.id === active.activeChildId));
          this.setData({
            children,
            childOptions: children.map((item) => item.displayLabel || item.name),
            childIndex,
            currentChildLabel: children[childIndex] ? (children[childIndex].displayLabel || children[childIndex].name) : ''
          });
        });
      }
    });
  },

  switchChild(event) {
    const child = this.data.children[Number(event.detail.value || 0)];
    if (!child) return;
    Api.switchActiveChild(child.id)
      .then((session) => {
        getApp().setSession(session);
        this.setData({ session });
        this.onShow();
      })
      .catch((error) => Notice.alert(error.message || '切换孩子失败'));
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
