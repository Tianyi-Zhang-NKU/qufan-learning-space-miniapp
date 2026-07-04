Component({
  options: {
    virtualHost: true,
    styleIsolation: "isolated"
  },
  properties: {
    value: {
      type: String,
      value: ""
    },
    label: {
      type: String,
      value: ""
    },
    size: {
      type: String,
      value: "normal"
    }
  }
})
