const Api = require('../../services/api');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

Page({
  data: {
    session: {},
    id: '',
    detail: {
      courseSession: {}
    },
    ticket: null,
    error: ''
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
    Promise.all([
      Api.getCourseDetail(this.data.id),
      Api.requestLiveTicket(this.data.id)
    ])
      .then(([detail, ticket]) => {
        this.setData({ detail, ticket, error: '' });
      })
      .catch((error) => {
        this.setData({ error: error.message || '直播未开放' });
        Notice.toast(error.message || '直播未开放');
      });
  }
});
