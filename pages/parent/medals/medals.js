const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    session: {},
    studentName: '',
    medals: [],
    unlockedCount: 0,
    totalCount: 0,
    loading: true
  },

  onShow() {
    const session = Guard.ensureLogin('parent');
    if (!session) return;
    this.setData({ session });
    this.load();
  },

  load() {
    this.setData({ loading: true });
    Api.getStudentMedals()
      .then((result) => {
        this.setData({
          studentName: (result.currentStudent || {}).name || '',
          medals: result.medals || [],
          unlockedCount: result.unlockedCount || 0,
          totalCount: result.totalCount || 0,
          loading: false
        });
      })
      .catch((error) => {
        this.setData({ loading: false });
        Notice.alert(error.message || '奖章墙加载失败');
      });
  }
});
