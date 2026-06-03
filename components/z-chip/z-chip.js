Component({
  options: {
    virtualHost: true,
    styleIsolation: "isolated"
  },
  data: {
    className: "chip dark"
  },
  properties: {
    text: {
      type: String,
      value: ""
    },
    active: {
      type: Boolean,
      value: false
    },
    theme: {
      type: String,
      value: "dark"
    }
  },
  lifetimes: {
    attached: function() {
      this.updateClass(this.data.active, this.data.theme)
    }
  },
  observers: {
    "active, theme": function(active, theme) {
      this.updateClass(active, theme)
    }
  },
  methods: {
    updateClass: function(active, theme) {
      const names = ["chip", theme || "dark"]
      if (active) {
        names.push("active")
      }
      this.setData({
        className: names.join(" ")
      })
    },
    onTap: function() {
      this.triggerEvent("select", {
        text: this.data.text
      })
    }
  }
})
