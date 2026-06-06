const Api = require('../../services/api');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

Page({
  audioContext: null,

  data: {
    id: '',
    preview: null,
    audioPlaying: false
  },

  onLoad(query) {
    this.setData({ id: query.id || query.fileId || '' });
  },

  onShow() {
    if (!Guard.ensureLogin()) return;
    this.load();
  },

  onUnload() {
    this.destroyAudio();
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

  toggleVoice() {
    const file = this.data.preview && this.data.preview.file;
    const src = file ? (file.previewUrl || file.url || file.tempPath) : '';
    if (!src) {
      Notice.toast('当前为 mock 语音占位');
      return;
    }
    if (this.data.audioPlaying && this.audioContext) {
      this.audioContext.stop();
      this.setData({ audioPlaying: false });
      return;
    }
    this.destroyAudio();
    this.audioContext = wx.createInnerAudioContext();
    this.audioContext.src = src;
    this.audioContext.onEnded(() => this.setData({ audioPlaying: false }));
    this.audioContext.onStop(() => this.setData({ audioPlaying: false }));
    this.audioContext.onError(() => {
      this.setData({ audioPlaying: false });
      Notice.toast('语音播放失败');
    });
    this.audioContext.play();
    this.setData({ audioPlaying: true });
  },

  destroyAudio() {
    if (!this.audioContext) return;
    this.audioContext.stop();
    this.audioContext.destroy();
    this.audioContext = null;
    this.setData({ audioPlaying: false });
  }
});
