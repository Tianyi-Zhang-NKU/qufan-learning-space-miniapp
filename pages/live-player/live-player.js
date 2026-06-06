const Api = require('../../services/api');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

Page({
  data: {
    session: {},
    id: '',
    detail: {
      courseSession: {},
      course: {}
    },
    entry: null,
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
      Api.requestClassInLiveEntry({ courseSessionId: this.data.id })
    ])
      .then(([detail, entry]) => {
        this.setData({ detail, entry, error: '' });
      })
      .catch((error) => {
        this.setData({ error: error.message || '直播入口暂不可用' });
        Notice.toast(error.message || '直播入口暂不可用');
      });
  },

  openClassIn() {
    if (!this.data.entry || !this.data.entry.classinEntryUrl) {
      Notice.toast('课堂入口暂不可用');
      return;
    }
    Notice.alert('正在打开课堂入口。', '打开直播');
  }
});
