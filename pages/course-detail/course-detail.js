const Api = require('../../services/api');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

Page({
  data: {
    session: {},
    id: '',
    detail: {
      courseSession: {},
      assignments: [],
      students: []
    }
  },

  onLoad(query) {
    this.setData({ id: query.id || query.courseSessionId || '' });
  },

  onShow() {
    const session = Guard.ensureLogin();
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    if (!this.data.id) return;
    Api.getCourseDetail(this.data.id)
      .then((detail) => this.setData({ detail }))
      .catch((error) => Notice.alert(error.message || '课程详情加载失败'));
  },

  goLive() {
    wx.navigateTo({ url: `/pages/live-player/live-player?id=${this.data.id}` });
  },

  previewFile(event) {
    wx.navigateTo({ url: `/pages/file-preview/file-preview?id=${event.currentTarget.dataset.id}` });
  }
});
