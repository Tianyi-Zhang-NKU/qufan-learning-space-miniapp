Component({
  options: {
    virtualHost: true,
    styleIsolation: "isolated"
  },
  data: {
    isInput: true
  },
  properties: {
    label: {
      type: String,
      value: ""
    },
    placeholder: {
      type: String,
      value: ""
    },
    type: {
      type: String,
      value: "input"
    },
    theme: {
      type: String,
      value: "dark"
    },
    value: {
      type: String,
      value: ""
    }
  },
  lifetimes: {
    attached: function() {
      this.resolveType(this.data.type)
    }
  },
  observers: {
    "type": function(type) {
      this.resolveType(type)
    }
  },
  methods: {
    resolveType: function(type) {
      this.setData({
        isInput: type !== "textarea"
      })
    },
    onInput: function(event) {
      this.triggerEvent("input", {
        value: event.detail.value
      })
    }
  }
})
