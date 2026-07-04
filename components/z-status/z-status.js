Component({
  options: {
    virtualHost: true,
    styleIsolation: "isolated"
  },
  properties: {
    text: {
      type: String,
      value: ""
    },
    tone: {
      type: String,
      value: "ok"
    }
  }
})
