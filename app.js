const Api = require('./services/api');

App({
  globalData: {
    appName: '趣帆学习空间',
    theme: {
      forest: '#173A32',
      forestLight: '#1F4A40',
      paper: '#FFF8EC',
      page: '#F7FAF6',
      orange: '#F97316',
      leaf: '#7FA37A',
      text: '#1F2937',
      muted: '#6B7F76'
    },
    session: null
  },

  onLaunch() {
    const session = wx.getStorageSync('session');
    if (session && session.identityId) {
      this.globalData.session = session;
      Api.setSession(session);
    }
  },

  setSession(session) {
    this.globalData.session = session;
    Api.setSession(session);
    wx.setStorageSync('session', session);
  },

  clearSession() {
    this.globalData.session = null;
    Api.setSession(null);
    wx.removeStorageSync('session');
  }
});
