const Api = require('../../services/api');
const Guard = require('../../utils/page-guard');
const Notice = require('../../utils/notice');

Page({
  data: {
    session: {},
    draft: {
      studentId: 'stu_001',
      courseSessionId: 'cs_001',
      subject: '数学',
      topic: '',
      mistakeReason: '',
      correction: ''
    },
    imageFile: null
  },

  onShow() {
    const session = Guard.ensureLogin();
    if (!session) return;
    this.setData({ session });
  },

  input(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`draft.${field}`]: event.detail.value });
  },

  mockImage() {
    Api.uploadWrongRecordImage({
      fileName: '错题图片.png',
      size: 320000
    })
      .then((file) => {
        this.setData({ imageFile: file });
        Notice.toast('已保存图片元信息');
      })
      .catch((error) => Notice.alert(error.message || '图片上传失败'));
  },

  save() {
    if (!this.data.draft.studentId || !this.data.draft.topic) {
      Notice.toast('请填写学生和知识点');
      return;
    }
    Api.createWrongRecord({
      ...this.data.draft,
      imageFileId: this.data.imageFile ? this.data.imageFile.id : ''
    })
      .then(() => {
        Notice.toast('错题已保存', 'success');
        wx.navigateBack();
      })
      .catch((error) => Notice.alert(error.message || '保存失败'));
  }
});
