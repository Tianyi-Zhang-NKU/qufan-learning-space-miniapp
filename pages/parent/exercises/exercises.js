const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    session: {},
    children: [],
    currentChild: {},
    assignments: [],
    wrongRecords: [],
    filter: 'all'
  },

  onShow() {
    const session = Guard.ensureLogin('parent');
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    Promise.all([Api.getParentChildren(), Api.getParentExercises({})])
      .then(([children, result]) => {
        this.setData({
          children,
          currentChild: result.currentChild,
          assignments: result.assignments,
          wrongRecords: result.wrongRecords
        });
      })
      .catch((error) => Notice.alert(error.message || '习题加载失败'));
  },

  switchChild(event) {
    Api.switchActiveChild(event.currentTarget.dataset.id).then((session) => {
      getApp().setSession(session);
      this.setData({ session });
      this.load();
    });
  },

  setFilter(event) {
    this.setData({ filter: event.currentTarget.dataset.filter });
  },

  previewFile(event) {
    wx.navigateTo({ url: `/pages/file-preview/file-preview?id=${event.currentTarget.dataset.id}` });
  }
});
