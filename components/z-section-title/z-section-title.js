Component({
  options: {
    virtualHost: true,
    styleIsolation: "isolated"
  },
  data: {
    showStatus: false,
    showText: false
  },
  properties: {
    title: {
      type: String,
      value: ""
    },
    right: {
      type: String,
      value: ""
    },
    rightType: {
      type: String,
      value: "text"
    },
    rightTypeAlias: {
      type: String,
      value: ""
    },
    tone: {
      type: String,
      value: "ok"
    },
    theme: {
      type: String,
      value: "dark"
    }
  },
  lifetimes: {
    attached: function() {
      this.updateRight(this.data.right, this.data.rightType, this.data.rightTypeAlias)
    }
  },
  observers: {
    "right, rightType, rightTypeAlias": function(right, rightType, rightTypeAlias) {
      this.updateRight(right, rightType, rightTypeAlias)
    }
  },
  methods: {
    updateRight: function(right, rightType, rightTypeAlias) {
      const resolvedType = rightTypeAlias || rightType || "text"
      this.setData({
        showStatus: !!right && resolvedType === "status",
        showText: !!right && resolvedType !== "status"
      })
    }
  }
})
