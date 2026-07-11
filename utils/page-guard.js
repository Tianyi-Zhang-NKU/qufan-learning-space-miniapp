function roleHome(role) {
  if (role === 'teacher') return '/pages/teacher/home/home';
  if (role === 'admin') return '/pages/admin/home/home';
  return '/pages/parent/home/home';
}

function ensureLogin(role) {
  const session = wx.getStorageSync('session');
  if (!session || !session.identityId) {
    wx.redirectTo({ url: '/pages/login/login' });
    return null;
  }
  if (role && session.role !== role) {
    wx.redirectTo({ url: roleHome(session.role) });
    return null;
  }
  return session;
}

function roleLabel(role) {
  if (role === 'admin') return '管理员端';
  if (role === 'teacher') return '教师端';
  if (role === 'parent' || role === 'student') return '学生/家长端';
  return '未绑定';
}

module.exports = {
  ensureLogin,
  roleHome,
  roleLabel
};
