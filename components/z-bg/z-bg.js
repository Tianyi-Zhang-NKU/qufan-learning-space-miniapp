const IMAGE_BY_MODE = {
  auth: '/assets/images/z-auth-bg.jpg',
  dark: '/assets/images/z-bg-dark.jpg',
  light: '/assets/images/z-bg-light.jpg'
};

function imageForMode(mode) {
  return IMAGE_BY_MODE[mode] || IMAGE_BY_MODE.light;
}

Component({
  properties: {
    mode: {
      type: String,
      value: 'light',
      observer(value) {
        this.setData({ imageSrc: imageForMode(value) });
      }
    }
  },

  data: {
    imageSrc: '/assets/images/z-bg-light.jpg'
  },

  lifetimes: {
    attached() {
      this.setData({ imageSrc: imageForMode(this.properties.mode) });
    }
  }
});
