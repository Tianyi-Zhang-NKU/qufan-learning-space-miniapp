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
    Api.getMediaPreview(this.data.id)
      .then((preview) => this.setData({ preview }))
      .catch((error) => Notice.alert(error.message || '媒体加载失败'));
  },

  previewImage() {
    const file = this.data.preview && this.data.preview.file;
    const url = file ? (file.previewUrl || file.url || file.tempPath) : '';
    if (!url) {
      Notice.toast('当前为 mock 图片占位');
      return;
    }
    wx.previewImage({ urls: [url], current: url });
  },

  downloadImage() {
    Api.downloadFeedbackImage(this.data.id)
      .then((result) => Notice.alert(result.message, '图片下载'))
      .catch((error) => Notice.alert(error.message || '下载失败'));
  },

  playVoice() {
    Api.playFeedbackVoice(this.data.id)
      .then((result) => Notice.alert(result.message, '语音播放'))
      .catch((error) => Notice.alert(error.message || '播放失败'));
  }
});
