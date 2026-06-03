# 趣帆学习空间 教培小程序 Figma 设计稿 Brief

## 当前状态

本机已启用 `figma@openai-curated` 插件，并已在 `C:\Users\13777\.codex\config.toml` 增加远程 Figma MCP 配置：

- `url = "https://mcp.figma.com/mcp"`
- `bearer_token_env_var = "FIGMA_OAUTH_TOKEN"`
- `rmcp_client = true`

当前线程还没有刷新出 `whoami/create_new_file/use_figma` 等工具。重启 Codex 并确保启动环境里存在 `FIGMA_OAUTH_TOKEN` 后，再创建 Figma 文件。

## Figma 文件

文件名：`趣帆学习空间 教培小程序视觉稿`

文件结构：

1. `00 Style Tokens`
2. `01 Components`
3. `02 Mini Program Screens`
4. `03 Handoff Notes`

## Style Tokens

颜色：

- Night: `#071713`
- Deep Pine: `#0B211C`
- Pine: `#102C25`
- Cream Text: `#F8F3EA`
- Warm White: `#FFF8EA`
- Matcha: `#D6E6BE`
- Matcha Deep: `#A8C49A`
- Paper: `#FFFAED`
- Paper Text: `#22372F`
- Botanical Brown: `#674627`

字体：

- 中文：`PingFang SC` / `Microsoft YaHei`
- 标题：中等字重，避免过粗。
- 正文：常规字重，深色页使用奶油白，纸面页使用松绿色深色文字。

背景：

- 登录页：`assets/images/z-auth-bg.jpg`
- 暗色页：`assets/images/z-bg-dark.jpg`
- 浅色纸面：`assets/images/z-bg-light.jpg`

## Components

需要在 Figma 建成组件：

- `Background / Auth`
- `Background / Dark`
- `Background / Light`
- `Logo / Light`
- `Logo / Dark`
- `Card / Glass`
- `Card / Hero`
- `Card / Paper`
- `Card / Form`
- `Card / Camera`
- `Button / Primary`
- `Button / Ghost`
- `Chip / Dark`
- `Chip / Light`
- `Status / Ok`
- `Status / Warn`
- `Field / Input`
- `Field / Textarea`
- `ListItem / Schedule`
- `Metric`
- `CameraCard`
- `TabBar`

## Screens

设计稿页面尺寸：`375 x 812`。

需要绘制这些首屏：

- 登录：`pages/login/login`
- 首页：`pages/home/home`
- 实时课表：`pages/schedule/schedule`
- 教室直播：`pages/live/live`
- 可选测验资料：`pages/exercises/exercises`
- 课后反馈：`pages/parent/exercises/exercises`
- 家长端：`pages/parent/parent`
- 教师端：`pages/teacher/teacher`
- 机构端：`pages/admin/admin`

## Handoff Rules

- Figma 不重新发明视觉语言，以小程序 `assets/images` 和当前页面实现为视觉源。
- 所有页面先放背景，再放头部、卡片、功能区。
- 暗色页面保留植物边缘和中心留白，不在内容区堆满卡片。
- 课后反馈内容优先使用纸面卡片。
- 直播卡不画假播放器控件，只画教室画面容器、在线点、课程状态。
