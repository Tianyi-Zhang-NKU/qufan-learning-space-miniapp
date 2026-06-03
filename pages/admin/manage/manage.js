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
      students: [],
      classrooms: []
    },
    overview: {
      liveRooms: []
    },
    activePanel: 'classrooms',
    selectedStudentId: '',
    selectedCourseId: ''
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
      Api.getAdminClassroomRelations(),
      Api.getAdminOverview()
    ])
      .then(([bootstrap, courseTree, teachers, students, classrooms, overview]) => {
        this.setData({
          bootstrap,
          relations: { courseTree, teachers, students, classrooms },
          overview,
          selectedStudentId: students[0] ? students[0].id : '',
          selectedCourseId: courseTree[0] ? courseTree[0].id : ''
        });
      })
      .catch((error) => Notice.alert(error.message || '数据加载失败'));
  },

  setPanel(event) {
    this.setData({ activePanel: event.currentTarget.dataset.panel });
  },

  selectStudent(event) {
    this.setData({ selectedStudentId: event.currentTarget.dataset.id });
  },

  selectCourse(event) {
    this.setData({ selectedCourseId: event.currentTarget.dataset.id });
  }
});
