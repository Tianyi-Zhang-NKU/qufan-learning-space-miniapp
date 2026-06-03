# 趣帆学习空间 小程序前端风格基线

本项目的视觉目标是延续原 Flutter 应用的暗色植物纸感视觉，而不是做通用教培后台模板。

真实验收请配合 `docs/qufan-visual-acceptance.md`，必须用微信开发者工具截图确认，不能只看代码判断完成。

## 视觉关键词

- 深松绿 / 暗森林背景
- 奶油白文字
- 细线植物边框
- “趣帆”文字徽标
- 半透明玻璃卡片
- 浅色纸张内容卡片
- 克制、安静、偏艺术感的移动端界面

## 资源基线

小程序已经把暗色植物纸感背景压缩后放入 `assets/images/`：

- `z-auth-bg.jpg`：登录页暗雾背景。
- `z-bg-dark.jpg`：默认暗色植物纸纹背景。
- `z-bg-light.jpg`：浅色纸张植物背景。

背景资源必须通过 `components/z-bg` 渲染，不要在 WXSS 中直接写本地 `background-image`。

## 色彩基线

- 页面底色：`#071713`、`#0b211c`、`#102c25`
- 主文字：`#fff9ec`、`#f8f0df`
- 弱文字：`rgba(248, 240, 223, 0.58-0.72)`
- 叶片强调：`#d6e6be`、`#a9c99e`
- 浅纸面：`#fffaf0`、`#f2ead8`
- 纸面线稿棕：`rgba(103, 70, 39, 0.18-0.28)`
- 橙色强调：`#f97316` 只用于主按钮、选中态、直播入口和关键提示，不作为大面积页面底色。

## 页面结构

每个一级页面应包含：

1. `.screen` 根容器。
2. `<z-bg />` 背景装饰组件，登录页使用 `<z-bg mode="auth" />`，浅纸面页面可使用 `<z-bg mode="light" />`。
3. 普通功能页头部优先使用 `<z-page-head kicker="" title="" desc="" />`。
4. 首页、登录页、角色页需要自定义头部时使用 `<z-logo />`、`<z-logo mode="compact" />` 或 `<z-logo mode="auth" />`。
5. 容器卡片使用 `<z-card />`，章节标题使用 `<z-section-title />`，表单字段使用 `<z-field />`，功能入口使用 `<z-tile />`，筛选标签使用 `<z-chip />`，数字指标使用 `<z-metric />`，状态胶囊使用 `<z-status />`，时间列表使用 `<z-list-item />`，摄像头画面使用 `<z-camera />`。

## 导航

- 底部导航使用 `custom-tab-bar`，保持深松绿玻璃底、细线圆形入口、奶油色文字。
- 不新增原生 tabBar 图标 PNG 作为主要视觉入口，避免和当前克制的文字徽标风格不一致。
- 页面底部需要保留足够空白，避免内容被自定义 tabBar 遮挡。

## 禁止回退

- 不使用纯白大面积后台卡片。
- 不使用蓝紫渐变、营销风 hero、通用 SaaS 仪表盘风格。
- 不把功能入口做成普通彩色九宫格。
- 不用粗图标替代植物纸感背景和“趣帆”文字徽标。
- 不在页面里写大段功能说明文案。

## 小程序兼容约束

- 背景装饰优先使用 `z-bg` 的 `<image>` 层，避免在 WXSS 里写本地背景图。
- 避免 CSS Grid，当前使用 flex 网格。
- 关键品牌标识统一使用 `components/z-logo`。
- 植物背景不在页面内复制节点，统一使用 `components/z-bg`。
- 标准功能页头部不手写 `.page-kicker/.page-title/.page-desc`，统一使用 `components/z-page-head`。
- 玻璃卡片、首页 hero、浅色纸面卡片优先使用 `components/z-card`。
- 新页面不得继续新增 `.glass-card` / `.hero-card`；旧全局样式如有残留，只作为迁移兼容层，不作为开发入口。
- 章节标题不手写 `.section-title/.muted tiny`，统一使用 `components/z-section-title`。
- 表单字段不手写 `.field/.input/.textarea`，统一使用 `components/z-field`。
- 功能入口卡片不手写 `.nav-tile/.tile-icon`，统一使用 `components/z-tile`。
- 筛选/状态标签不手写 `.chip`，统一使用 `components/z-chip`。
- 数字指标卡不手写 `.metric/.metric-value/.metric-label`，统一使用 `components/z-metric`。
- 状态胶囊不手写 `.status`，统一使用 `components/z-status`。
- 课表、课程、摄像头状态等时间列表不手写 `.list-item/.time-pill`，统一使用 `components/z-list-item`。
- 直播画面不手写 `.camera-frame/.live-dot`，统一使用 `components/z-camera`。
- 页面内不要再手写 `botanical-line`、`z-branch`、`logo-mark` 这类底层装饰结构。
- 底部导航不回退到普通原生 tabBar 视觉，统一维护 `custom-tab-bar`。
- `components/z-bg` 和 `components/z-logo` 使用样式隔离，改视觉细节时优先改组件文件。
- 当前组件体系使用自定义 tabBar 和 `virtualHost`，微信开发者工具验收时需确认基础库兼容；若目标基础库较低，需要关闭 `virtualHost` 并重新检查布局。
- 固定宽高、flex 居中、按钮、图标、时间胶囊优先使用 `view` / `navigator`，不要用 `text` 承载复杂盒模型。
- 不能只看代码判断完成，必须用微信开发者工具截图对比。
