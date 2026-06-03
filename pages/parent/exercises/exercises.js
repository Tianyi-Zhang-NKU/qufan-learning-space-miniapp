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
    filter: 'all',
    childOptions: [],
    childIndex: 0,
    currentChildLabel: ''
  },

  onShow() {
    const session = Guard.ensureLogin('parent');
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    Promise.all([Api.listParentChildren(), Api.getParentExercises({})])
      .then(([children, result]) => {
        const activeId = result.currentChild ? result.currentChild.id : '';
        const childIndex = Math.max(0, children.findIndex((item) => item.id === activeId));
        this.setData({
          children,
          currentChild: result.currentChild,
          assignments: result.assignments,
          wrongRecords: result.wrongRecords,
          childOptions: children.map((item) => item.displayLabel || item.name),
          childIndex,
          currentChildLabel: children[childIndex] ? (children[childIndex].displayLabel || children[childIndex].name) : ''
        });
      })
      .catch((error) => Notice.alert(error.message || '习题加载失败'));
  },

  switchChild(event) {
    const child = this.data.children[Number(event.detail.value || 0)];
    if (!child) return;
    Api.switchActiveChild(child.id).then((session) => {
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
