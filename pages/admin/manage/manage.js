const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

const GRADE_OPTIONS = ['初一', '初二', '初三'];
const SUBJECT_OPTIONS = ['语文', '数学', '英语', '物理', '化学', '生物', '科学'];

Page({
  data: {
    loading: true,
    saving: false,
    isSuperAdmin: false,
    grants: [],
    phone: '',
    gradeOptions: GRADE_OPTIONS,
    subjectOptions: SUBJECT_OPTIONS,
    selectedGrades: [],
    selectedSubjects: []
  },

  onShow() {
    const session = Guard.ensureLogin('admin');
    if (!session) return;
    if (!session.isSuperAdmin) {
      wx.redirectTo({ url: Guard.roleHome('admin') });
      return;
    }
    this.setData({ isSuperAdmin: true });
    this.loadGrants();
  },

  loadGrants() {
    this.setData({ loading: true });
    Api.getAdminGrants()
      .then((grants) => this.setData({ loading: false, grants: grants || [] }))
      .catch((error) => {
        this.setData({ loading: false, grants: [] });
        Notice.alert(error.message || '权限数据加载失败');
      });
  },

  onPhoneInput(event) {
    this.setData({ phone: event.detail.value || '' });
  },

  toggleGradeScope(event) {
    const grade = event.currentTarget.dataset.value;
    const selectedGrades = this.data.selectedGrades.slice();
    const index = selectedGrades.indexOf(grade);
    if (index >= 0) selectedGrades.splice(index, 1);
    else selectedGrades.push(grade);
    this.setData({ selectedGrades });
  },

  toggleSubjectScope(event) {
    const subject = event.currentTarget.dataset.value;
    const selectedSubjects = this.data.selectedSubjects.slice();
    const index = selectedSubjects.indexOf(subject);
    if (index >= 0) selectedSubjects.splice(index, 1);
    else selectedSubjects.push(subject);
    this.setData({ selectedSubjects });
  },

  saveGrant() {
    const phone = String(this.data.phone || '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      Notice.toast('请输入有效的 11 位手机号');
      return;
    }
    if (!this.data.selectedGrades.length || !this.data.selectedSubjects.length) {
      Notice.toast('请至少选择一个年级和学科');
      return;
    }
    if (this.data.saving) return;
    this.setData({ saving: true });
    Api.saveAdminGrant({
      phone,
      gradeScopes: this.data.selectedGrades,
      subjectScopes: this.data.selectedSubjects,
      enabled: true
    })
      .then(() => {
        Notice.toast('管理员授权已保存');
        this.setData({ saving: false, phone: '', selectedGrades: [], selectedSubjects: [] });
        this.loadGrants();
      })
      .catch((error) => {
        this.setData({ saving: false });
        Notice.alert(error.message || '管理员授权保存失败');
      });
  }
});
