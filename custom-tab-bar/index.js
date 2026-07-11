Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: "/pages/parent/home/home",
        text: "首页",
        icon: "/assets/icons/home.svg",
        className: "tab-item"
      },
      {
        pagePath: "/pages/parent/courses/courses",
        text: "课表",
        icon: "/assets/icons/calendar.svg",
        className: "tab-item"
      },
      {
        pagePath: "/pages/profile/profile",
        text: "我的",
        icon: "/assets/icons/profile.svg",
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
          icon: item.icon,
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
      wx.redirectTo({
        url: item.pagePath,
        fail: function() {
          self.updateSelected(previous)
        }
      })
    }
  }
})
