# 趣帆学习空间 组件契约

本文件记录小程序前端组件边界。页面开发优先使用现有组件，不直接复制底层 WXML 结构。本轮视觉基线为“浅纸感管理风”，组件需要统一落到米灰背景、象牙白卡片、深蓝文字和低饱和图标底。

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

## 视觉令牌

- 页面背景：`#E9E6DA` / `#ECE8DD`
- 卡片底色：`#FFFDF6` / `#FFFCF2`
- 次级浅底：`#F6F3E8`
- 主文字：`#10224A`
- 正文文字：`#31405F`
- 次级文字：`#8A8D88`
- 分割线：`rgba(16, 34, 74, 0.08)`
- 强调蓝：`#2F6FAE`
- 强调橙：`#F59A23`
- 成功绿：`#3E8B68`
- 图标浅底：`#EEF5DD`、`#E8EEFF`、`#FFE8BF`、`#EFEAFF`

## 组件清单

### `z-bg`

用途：统一页面浅纸感背景。当前实现继续使用压缩背景图资源，但通过浅色遮罩让视觉落到米灰/纸感页面，而不是深色装饰页。

属性：

- `mode="dark"`：兼容旧调用，实际以浅纸感背景呈现。
- `mode="auth"`：登录页背景，叠加浅色发布态遮罩。
- `mode="light"`：浅色纸面背景。

页面规则：

- 每个一级页面根节点下第一层放 `<z-bg />` 或 `<z-bg mode="auth" />`。
- 不在页面里手写底层背景装饰结构。

### `z-logo`

用途：统一“趣帆”文字徽标。

属性：

- `mode="normal"`：首页、角色页。
- `mode="compact"`：标准功能页头部。
- `mode="auth"`：登录页大 Logo。
- `mode="paper|light|dark"`：浅色纸面上的品牌标识。

页面规则：

- 不在页面里重复手写复杂品牌标识结构。

### `z-page-head`

用途：标准功能页头部。

属性：

- `kicker`：英文小标题。
- `title`：中文标题。
- `desc`：描述文字。
- `logoMode`：默认 `compact`。

页面规则：

- 课表、直播、反馈、可选测验等标准页面优先使用此组件；旧页面可保留已有 `.qf-top`，但样式由全局浅纸感令牌统一。

### `z-card`

用途：统一卡片容器。

属性：

- `mode="glass"`：兼容旧模式，当前显示为象牙白卡片。
- `mode="hero"`：首页/功能页重点卡片。
- `mode="light"`：浅色纸面卡片。
- `mode="auth"`：登录页表单卡片。
- `mode="camera"`：直播画面卡片。

页面规则：

- 新样式以 `#FFFDF6` / `#FFFCF2` 为底，不再做大面积深色玻璃。
- 卡片用于具体内容、模态、重复条目；页面分区不要再套多层浮动卡片。

### `z-tile`

用途：功能入口卡片。

属性：

- `icon`
- `title`
- `desc`
- `url`
- `open-type-alias`

页面规则：

- 图标必须用矢量资源或组件图标，不能用汉字替代。
- 入口视觉用浅底 + 小面积强调色，不做高饱和整块按钮。

### `z-metric`

用途：数字指标卡。

属性：

- `value`
- `label`
- `size="normal|mini|compact"`

页面规则：

- 指标区参考短卡节奏，数字醒目但颜色克制。

### `z-status`

用途：状态胶囊。

属性：

- `text`
- `tone="ok|warn|muted|danger"`

页面规则：

- 状态色小面积使用：蓝色表示操作/直播，橙色表示提醒/待处理，绿色表示完成/成功。

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

- 课表、课程、摄像头状态等列表统一使用短行、时间胶囊、浅底分割线。

### `z-section-title`

用途：章节标题行。

属性：

- `title`
- `right`
- `right-type-alias="status"`：右侧显示 `z-status`。
- `tone`
- `theme="dark|light"`

页面规则：

- 不新增大段说明文案，标题应服务信息结构。

### `z-chip`

用途：筛选/状态标签。

属性：

- `text`
- `active`
- `theme="dark|light"`

页面规则：

- 筛选 Tab 使用浅底和底部/边框强调，不做强烈填充。

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

- 管理端新增课程、筛选、导入等表单尽量使用下拉选择和现有输入结构。

### `z-camera`

用途：直播画面/摄像头卡片。

属性：

- `label`
- `title`
- `sub`
- `live`

页面规则：

- 直播入口文案按发布态呈现，不出现“正式部署后”“mock 占位”等调试说明。

## 自定义 tabBar

路径：

- `components/qf-role-tabbar/`
- `custom-tab-bar/`

职责：

- 统一底部导航的浅纸感底色和矢量图标。
- 角色化管理 首页 / 课表 / 数据 / 我的 等入口。
- 底部导航左右贴边铺满，不留侧边空隙。

验收：

- 切换页面后选中态同步。
- 切换失败时不应停留在错误选中态。
- 不遮挡页面底部内容。
- 家长/学生端不再暴露独立“错题反馈”底栏入口。
