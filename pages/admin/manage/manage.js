const Api = require('../../../services/api');
const Guard = require('../../../utils/page-guard');
const Notice = require('../../../utils/notice');

Page({
  data: {
    bootstrap: {
      phoneAccounts: [],
      mediaFiles: [],
      lessonFeedbacks: []
    },
    relations: {
      courseTree: [],
      teachers: [],
      students: []
    },
    overview: {
      liveRooms: []
    }
  },

  onShow() {
    if (!Guard.ensureLogin('admin')) return;
    this.load();
  },

  load() {
    Promise.all([
      Api.getBootstrap(),
      Api.getAdminCourseTree(),
      Api.getAdminTeacherRelations(),
      Api.getAdminStudentRelations(),
      Api.getAdminOverview()
    ])
      .then(([bootstrap, courseTree, teachers, students, overview]) => {
        this.setData({
          bootstrap,
          relations: { courseTree, teachers, students },
          overview
        });
      })
      .catch((error) => Notice.alert(error.message || '数据加载失败'));
  }
});
