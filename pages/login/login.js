const Api = require('../../services/api');
const config = require('../../services/config');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

Page({
  data: {
    inviteCode: config.demoInvites.student,
    relation: '母亲',
    relationIndex: 1,
    needRelation: true,
    binding: false,
    relations: ['父亲', '母亲', '爷爷', '奶奶', '外公', '外婆', '其他'],
    demoCodes: [
      { label: '家长学生', code: config.demoInvites.student },
      { label: '教师', code: config.demoInvites.teacher },
      { label: '管理员', code: config.demoInvites.admin }
    ]
  },

  onLoad() {
    const session = wx.getStorageSync('session');
    if (session && session.identityId) {
      wx.redirectTo({ url: Guard.roleHome(session.role) });
    }
  },

  onInviteInput(event) {
    const inviteCode = event.detail.value;
    this.setData({
      inviteCode,
      needRelation: String(inviteCode || '').trim().toUpperCase().indexOf('STUDENT-') === 0
    });
  },

  chooseRelation(event) {
    const relationIndex = Number(event.detail.value || 0);
    this.setData({
      relationIndex,
      relation: this.data.relations[relationIndex] || this.data.relations[0]
    });
  },

  useDemoCode(event) {
    const code = event.currentTarget.dataset.code;
    this.setData({
      inviteCode: code,
      needRelation: String(code || '').indexOf('STUDENT-') === 0
    });
  },

  bindInvite() {
    const inviteCode = String(this.data.inviteCode || '').trim();
    if (!inviteCode) {
      Notice.toast('请填写邀请码');
      return;
    }
    this.setData({ binding: true });
    Api.bindInvite({
      inviteCode,
      relation: this.data.needRelation ? this.data.relation : ''
    })
      .then((session) => {
        getApp().setSession(session);
        wx.redirectTo({ url: Guard.roleHome(session.role) });
      })
      .catch((error) => {
        if (error.code === 'NEED_RELATION') {
          this.setData({ needRelation: true });
        }
        Notice.alert(error.message || '绑定失败，请检查邀请码。');
      })
      .finally(() => {
        this.setData({ binding: false });
      });
  },

  goIdentitySwitch() {
    Api.listIdentities().then((identities) => {
      if (!identities.length) {
        Notice.toast('当前微信账号暂无已绑定身份');
        return;
      }
      wx.navigateTo({ url: '/pages/identity-switch/identity-switch' });
    });
  }
});
