Component({
  options: {
    virtualHost: true,
    styleIsolation: "isolated"
  },
  data: {
    className: "list-item"
  },
  properties: {
    time: {
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
    status: {
      type: String,
      value: ""
    },
    tone: {
      type: String,
      value: "ok"
    },
    noBorder: {
      type: Boolean,
      value: false
    }
  },
  lifetimes: {
    attached: function() {
      this.updateClass(this.data.noBorder)
    }
  },
  observers: {
    "noBorder": function(noBorder) {
      this.updateClass(noBorder)
    }
  },
  methods: {
    updateClass: function(noBorder) {
      this.setData({
        className: noBorder ? "list-item no-border" : "list-item"
      })
    }
  }
})
