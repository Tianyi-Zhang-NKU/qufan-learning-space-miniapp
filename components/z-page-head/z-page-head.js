Component({
  options: {
    virtualHost: true,
    styleIsolation: "isolated"
  },
  properties: {
    kicker: {
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
    logoMode: {
      type: String,
      value: "compact"
    }
  }
})
