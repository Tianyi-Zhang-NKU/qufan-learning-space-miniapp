const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    overview: {
      metrics: [],
      relationOverview: [],
      liveRooms: [],
      recentFeedbacks: [],
      recentAuditLogs: [],
      todaySessions: []
    },
    activePanel: 'courses'
  },

  onShow() {
    if (!Guard.ensureLogin('admin')) return;
    Api.getAdminOverview()
      .then((overview) => this.setData({ overview }))
      .catch((error) => Notice.alert(error.message || '总览加载失败'));
  },

  goManage() {
    wx.redirectTo({ url: '/pages/admin/manage/manage' });
  },

  setPanel(event) {
    this.setData({ activePanel: event.currentTarget.dataset.panel });
  }
});
