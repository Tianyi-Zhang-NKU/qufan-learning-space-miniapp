const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

function percent(value) {
  return `${Number(value || 0)}%`;
}

function displayStatistics(items) {
  return (items || []).map((item) => ({
    ...item,
    passRateText: percent(item.passRate),
    confirmationText: `${item.confirmedPasses || 0}/${item.eligibleStudentSessions || 0}`
  }));
}

function buildGradeStatistics(items) {
  return displayStatistics(items).map((item) => {
    const subjects = {};
    (item.courseStatistics || []).forEach((course) => {
      const key = course.subject || '未分类';
      if (!subjects[key]) subjects[key] = { subjectName: key, confirmedPasses: 0, eligibleStudentSessions: 0 };
      subjects[key].confirmedPasses += course.confirmedPasses || 0;
      subjects[key].eligibleStudentSessions += course.eligibleStudentSessions || 0;
    });
    return {
      ...item,
      subjects: Object.keys(subjects).sort().map((key) => ({
        ...subjects[key],
        passRateText: percent(subjects[key].eligibleStudentSessions
          ? Math.round((subjects[key].confirmedPasses / subjects[key].eligibleStudentSessions) * 100)
          : 0)
      }))
    };
  });
}

function displayFocus(items, category) {
  return (items || []).map((item) => ({
    ...item,
    category,
    passRateText: percent(item.passRate),
    confirmationText: `${item.confirmedPasses || 0}/${item.completedSessions || 0} 讲已通关`,
    attentionText: category === 'needsAttention'
      ? `连续 ${item.consecutiveUnpassedCount || 0} 讲待确认`
      : `稳定通关 ${item.completedSessions || 0} 讲`,
    noteDraft: item.note || ''
  }));
}

Page({
  data: {
    loading: true,
    savingFocusId: '',
    summary: {},
    gradeStatistics: [],
    subjectStatistics: [],
    teacherStatistics: [],
    needsAttention: [],
    excellentStudents: [],
    grants: [],
    scope: {},
    expandedGrade: '',
    showExcellent: false
  },

  onShow() {
    const session = Guard.ensureLogin('admin');
    if (!session) return;
    this.loadDashboard();
  },

  loadDashboard() {
    this.setData({ loading: true });
    Api.getAdminDashboard({})
      .then((dashboard) => {
        const scope = dashboard.scope || {};
        const grantRequest = scope.isSuperAdmin && Api.getAdminGrants
          ? Api.getAdminGrants()
          : Promise.resolve([]);
        return grantRequest.then((grants) => ({ dashboard, grants }));
      })
      .then(({ dashboard, grants }) => {
        this.setData({
          loading: false,
          summary: {
            ...dashboard.summary,
            passRateText: percent((dashboard.summary || {}).passRate),
            confirmationText: `${(dashboard.summary || {}).confirmedPasses || 0}/${(dashboard.summary || {}).eligibleStudentSessions || 0}`
          },
          gradeStatistics: buildGradeStatistics(dashboard.gradeStatistics),
          subjectStatistics: displayStatistics(dashboard.subjectStatistics),
          teacherStatistics: displayStatistics(dashboard.teacherStatistics),
          needsAttention: displayFocus((dashboard.focusStudents || {}).needsAttention, 'needsAttention'),
          excellentStudents: displayFocus((dashboard.focusStudents || {}).excellent, 'excellent'),
          grants: grants || [],
          scope: dashboard.scope || {}
        });
      })
      .catch((error) => {
        this.setData({ loading: false });
        Notice.alert(error.message || '通关数据加载失败');
      });
  },

  toggleGrade(event) {
    const grade = event.currentTarget.dataset.grade;
    this.setData({ expandedGrade: this.data.expandedGrade === grade ? '' : grade });
  },

  toggleExcellent() {
    this.setData({ showExcellent: !this.data.showExcellent });
  },

  onNoteInput(event) {
    const id = event.currentTarget.dataset.id;
    const note = event.detail.value || '';
    const update = (items) => items.map((item) => (item.id === id ? { ...item, noteDraft: note } : item));
    this.setData({
      needsAttention: update(this.data.needsAttention),
      excellentStudents: update(this.data.excellentStudents)
    });
  },

  saveFocusNote(event) {
    const id = event.currentTarget.dataset.id;
    const source = this.data.needsAttention.concat(this.data.excellentStudents);
    const item = source.find((entry) => entry.id === id);
    if (!item || this.data.savingFocusId) return;
    this.setData({ savingFocusId: id });
    Api.saveStudentAttentionNote({
      studentId: item.studentId,
      courseId: item.courseId,
      note: item.noteDraft || '',
      status: item.category === 'needsAttention' ? 'following' : 'resolved'
    })
      .then(() => {
        Notice.toast('跟进备注已保存');
        this.setData({ savingFocusId: '' });
        this.loadDashboard();
      })
      .catch((error) => {
        this.setData({ savingFocusId: '' });
        Notice.alert(error.message || '备注保存失败');
      });
  }
});
