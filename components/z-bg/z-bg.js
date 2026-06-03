Component({
  options: {
    virtualHost: true,
    styleIsolation: "isolated"
  },
  data: {
    bgSrc: "/assets/images/z-bg-dark.jpg"
  },
  properties: {
    mode: {
      type: String,
      value: "dark"
    }
  },
  lifetimes: {
    attached: function() {
      this.updateSource(this.data.mode)
    }
  },
  observers: {
    mode: function(mode) {
      this.updateSource(mode)
    }
  },
  methods: {
    updateSource: function(mode) {
      const map = {
        auth: "/assets/images/z-auth-bg.jpg",
        dark: "/assets/images/z-bg-dark.jpg",
        light: "/assets/images/z-bg-light.jpg"
      }
      this.setData({
        bgSrc: map[mode] || map.dark
      })
    }
  }
})
