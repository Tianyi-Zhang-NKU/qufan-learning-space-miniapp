const Api = require('../../services/api');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

Page({
  data: {
    id: '',
    preview: null
  },

  onLoad(query) {
    this.setData({ id: query.id || query.fileId || '' });
  },

  onShow() {
    if (!Guard.ensureLogin()) return;
    this.load();
  },

  load() {
    if (!this.data.id) return;
    Api.getFilePreview(this.data.id)
      .then((preview) => this.setData({ preview }))
      .catch((error) => Notice.alert(error.message || '文件加载失败'));
  }
});
