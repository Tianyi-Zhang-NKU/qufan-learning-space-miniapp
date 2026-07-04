Component({
  options: {
    virtualHost: true,
    styleIsolation: "isolated"
  },
  data: {
    resolvedOpenType: "navigate"
  },
  properties: {
    icon: {
      type: String,
      value: ""
    },
    title: {
      type: String,
      value: ""
    },
    desc: {
      type: String,
      value: ""
    },
    url: {
      type: String,
      value: ""
    },
    openType: {
      type: String,
      value: "navigate"
    },
    openTypeAlias: {
      type: String,
      value: ""
    }
  },
  lifetimes: {
    attached: function() {
      this.resolveOpenType(this.data.openType, this.data.openTypeAlias)
    }
  },
  observers: {
    "openType, openTypeAlias": function(openType, openTypeAlias) {
      this.resolveOpenType(openType, openTypeAlias)
    }
  },
  methods: {
    resolveOpenType: function(openType, openTypeAlias) {
      this.setData({
        resolvedOpenType: openTypeAlias || openType || "navigate"
      })
    }
  }
})
