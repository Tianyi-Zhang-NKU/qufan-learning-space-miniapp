Component({
  options: {
    virtualHost: true,
    styleIsolation: "isolated"
  },
  data: {
    frameClass: "camera-frame"
  },
  properties: {
    label: {
      type: String,
      value: ""
    },
    title: {
      type: String,
      value: ""
    },
    sub: {
      type: String,
      value: ""
    },
    live: {
      type: Boolean,
      value: false
    }
  },
  lifetimes: {
    attached: function() {
      this.updateClass(this.data.live)
    }
  },
  observers: {
    "live": function(live) {
      this.updateClass(live)
    }
  },
  methods: {
    updateClass: function(live) {
      this.setData({
        frameClass: live ? "camera-frame" : "camera-frame muted"
      })
    }
  }
})
