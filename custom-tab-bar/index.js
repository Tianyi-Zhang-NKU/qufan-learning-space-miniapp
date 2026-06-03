Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: "/pages/home/home",
        text: "首页",
        mark: "趣",
        className: "tab-item"
      },
      {
        pagePath: "/pages/schedule/schedule",
        text: "课表",
        mark: "表",
        className: "tab-item"
      },
      {
        pagePath: "/pages/live/live",
        text: "直播",
        mark: "看",
        className: "tab-item"
      },
      {
        pagePath: "/pages/wrongbook/wrongbook",
        text: "错题",
        mark: "错",
        className: "tab-item"
      }
    ]
  },
  pageLifetimes: {
    show: function() {
      this.syncSelected()
    }
  },
  lifetimes: {
    attached: function() {
      this.syncSelected()
    },
    ready: function() {
      this.syncSelected()
    }
  },
  methods: {
    syncSelected: function() {
      const pages = getCurrentPages()
      const current = pages.length ? "/" + pages[pages.length - 1].route : ""
      let selected = -1
      for (let i = 0; i < this.data.list.length; i += 1) {
        if (this.data.list[i].pagePath === current) {
          selected = i
          break
        }
      }
      if (selected >= 0 && selected !== this.data.selected) {
        this.updateSelected(selected)
      }
    },
    updateSelected: function(selected) {
      const list = []
      for (let index = 0; index < this.data.list.length; index += 1) {
        const item = this.data.list[index]
        list.push({
          pagePath: item.pagePath,
          text: item.text,
          mark: item.mark,
          className: index === selected ? "tab-item active" : "tab-item"
        })
      }
      this.setData({
        selected,
        list
      })
    },
    switchTab: function(event) {
      const index = Number(event.currentTarget.dataset.index)
      const item = this.data.list[index]
      if (!item || index === this.data.selected) {
        return
      }
      const previous = this.data.selected
      this.updateSelected(index)
      const self = this
      wx.switchTab({
        url: item.pagePath,
        fail: function() {
          self.updateSelected(previous)
        }
      })
    }
  }
})
