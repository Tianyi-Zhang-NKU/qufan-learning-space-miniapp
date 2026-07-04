Component({
  options: {
    multipleSlots: true,
    virtualHost: true,
    styleIsolation: "isolated"
  },
  properties: {
    mode: {
      type: String,
      value: "glass"
    }
  }
})
