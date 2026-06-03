function toast(title, icon) {
  wx.showToast({
    title,
    icon: icon || 'none',
    duration: 1800
  });
}

function alert(content, title) {
  wx.showModal({
    title: title || '提示',
    content,
    showCancel: false,
    confirmColor: '#F97316'
  });
}

module.exports = {
  toast,
  alert
};
