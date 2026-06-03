# 趣帆学习空间 组件契约

本文件记录小程序前端复刻 趣帆学习空间 风格时的组件边界。页面开发优先使用这些组件，不直接复制底层 WXML 结构。

## 基础库要求

当前组件使用了：

- 自定义组件
- 全局 `usingComponents`
- 自定义 tabBar
- `virtualHost`
- 组件 `observers`
- 组件样式隔离 `styleIsolation`

建议微信开发者工具基础库使用较新版本。若目标基础库较低，优先检查：

1. `virtualHost` 是否导致组件不显示或布局异常。
2. 自定义 tabBar 是否被正确加载。
3. 组件属性的短横线写法是否正确映射到 camelCase 属性。

低版本回退策略：

- 若 `virtualHost` 不兼容，删除对应组件 JS 里的 `virtualHost: true`，保留组件 WXSS 里的宿主层。
- 若全局组件注册异常，在页面 JSON 中局部注册相关组件。
- 若自定义 tabBar 异常，先临时关闭 `app.json` 的 `tabBar.custom`，确认页面主体是否正常渲染。

## 组件清单

### `z-bg`

用途：统一 趣帆学习空间 深松绿纸纹和植物线稿背景。当前实现使用压缩后的 趣帆学习空间 原始位图资源，通过 `<image mode="aspectFill">` 铺底，不再用 WXSS 手写植物线条。

属性：

- `mode="dark"`：默认页面背景。
- `mode="auth"`：登录页背景，对应 `assets/images/z-auth-bg.jpg`。
- `mode="light"`：浅色纸面背景，对应 `assets/images/z-bg-light.jpg`。

页面规则：

- 每个一级页面根节点下第一层放 `<z-bg />` 或 `<z-bg mode="auth" />`。
- 不在页面里手写 `z-branch`、`botanical-line`、山、树林等装饰结构。

### `z-logo`

用途：统一“趣帆”文字徽标。当前实现不再使用旧图片 logo，直接用组件样式渲染品牌字标。

属性：

- `mode="normal"`：首页、角色页。
- `mode="compact"`：标准功能页头部。
- `mode="auth"`：登录页大 Logo。
- `mode="paper|light|dark"`：浅色纸面上的深色线稿 Logo。

页面规则：

- 不在页面里手写品牌标识结构。

### `z-page-head`

用途：标准功能页头部。

属性：

- `kicker`：英文小标题。
- `title`：中文标题。
- `desc`：描述文字。
- `logoMode`：默认 `compact`。

页面规则：

- 课表、直播、习题、错题等标准页面优先使用此组件。

### `z-card`

用途：统一卡片容器。

属性：

- `mode="glass"`：默认玻璃卡片。
- `mode="hero"`：首页/功能页大说明卡片。
- `mode="light"`：浅色纸面卡片。
- `mode="auth"`：登录页表单卡片。
- `mode="camera"`：直播画面卡片。

页面规则：

- 新页面不新增 `.glass-card` 或 `.hero-card`。

### `z-tile`

用途：功能入口卡片。

属性：

- `icon`
- `title`
- `desc`
- `url`
- `open-type-alias`：例如 `switchTab`。

页面规则：

- 放在 `.grid-2` 时外层用普通 `view` 承载宽度。

### `z-metric`

用途：数字指标卡。

属性：

- `value`
- `label`
- `size="normal|mini|compact"`

页面规则：

- 不手写 `.metric`。

### `z-status`

用途：状态胶囊。

属性：

- `text`
- `tone="ok|warn|muted|danger"`

页面规则：

- 不手写 `.status`。

### `z-list-item`

用途：时间列表行。

属性：

- `time`
- `title`
- `sub`
- `status`
- `tone`
- `no-border`

页面规则：

- 课表、课程、摄像头状态等列表统一使用。

### `z-section-title`

用途：章节标题行。

属性：

- `title`
- `right`
- `right-type-alias="status"`：右侧显示 `z-status`。
- `tone`
- `theme="dark|light"`

页面规则：

- 不手写 `.section-title/.muted tiny`。

### `z-chip`

用途：筛选/状态标签。

属性：

- `text`
- `active`
- `theme="dark|light"`

页面规则：

- 不手写 `.chip`。

### `z-field`

用途：表单字段。

属性：

- `label`
- `placeholder`
- `type="input|textarea"`
- `theme="dark|light"`
- `value`

事件：

- `bind:input`

页面规则：

- 不手写 `.field/.input/.textarea`。

### `z-camera`

用途：直播画面占位/摄像头卡片。

属性：

- `label`
- `title`
- `sub`
- `live`

页面规则：

- 不手写 `.camera-frame/.live-dot`。

## 自定义 tabBar

路径：`custom-tab-bar/`

职责：

- 统一底部导航的深松绿玻璃底。
- 管理 首页 / 课表 / 直播 / 错题 的选中态。

验收：

- 切换页面后选中态同步。
- 切换失败时不应停留在错误选中态。
- 不遮挡页面底部内容。
