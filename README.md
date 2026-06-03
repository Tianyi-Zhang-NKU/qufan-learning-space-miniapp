# 趣帆学习空间微信小程序 Demo

这是为“趣帆学习空间”规划出的教培机构小程序 demo。当前版本先实现可在本地调试的前端和极简后端接口，核心目标是展示业务流程，不接 AI 搜题，不接正式摄像头流。

## 已实现范围

- 微信登录 + 邀请码绑定的模拟流程。
- 教务管理端：基础数据概览、生成邀请码。
- 教务录入：录入家长/学生并生成家长邀请码，录入课程安排。
- 老师端：查看课程、导入课前测/课后测、手动批改、跳转错题录入。
- 家长端：查看孩子课表、直播入口、测试进度、近期错题。
- 实时课表：按角色过滤课程。
- 课堂直播：展示 15 间教室直播接入前的权限和签权接口思路，当前没有真实流地址。
- 课堂测试习题：老师手动选择 PDF/Word 文件，保存导入记录。
- 错题本：老师手动拍照或从相册选择错题，补充错因和订正建议。
- 极简本地后端：`server/index.js`，不依赖第三方包。

## Demo 邀请码

| 角色 | 邀请码 | 手机号 |
|---|---|---|
| 家长端 | `STUDENT-001` | `13800000001` |
| 老师端 | `TEACHER-2026` | `13800000002` |
| 教务端 | `ADMIN-2026` | `13800000003` |

登录页也提供了快速填充按钮。

## 如何打开小程序

1. 打开微信开发者工具。
2. 选择导入项目。
3. 项目目录选择：`D:\Desktop\miniapp`
4. AppID 暂时可使用测试号或 `touristappid`。
5. 本地调试时勾选“不校验合法域名、web-view 域名、TLS 版本以及 HTTPS 证书”。
6. 编译后从登录页进入 demo。

## 前端默认数据模式

默认使用小程序内置 mock 数据：

```js
// services/config.js
module.exports = {
  apiMode: 'mock'
};
```

这样不需要启动本地后端，也能直接在微信开发者工具里看页面。

## 启动本地极简后端

如需测试 HTTP 接口：

```bash
cd /d D:\Desktop\miniapp
npm run start:backend
```

然后把 `services/config.js` 改成：

```js
module.exports = {
  apiMode: 'http',
  localBaseUrl: 'http://127.0.0.1:8787'
};
```

接口清单：

- `POST /api/auth/bind-invite`
- `GET /api/bootstrap`
- `GET /api/dashboard`
- `GET /api/schedule`
- `POST /api/schedule`
- `POST /api/students`
- `GET /api/live/rooms`
- `GET /api/live/ticket?roomId=live_08`
- `GET /api/tests`
- `POST /api/tests/import`
- `POST /api/tests/grade`
- `GET /api/wrong-records`
- `POST /api/wrong-records`
- `POST /api/invites`

## 直播接入说明

当前 demo 不包含真实直播流地址。直播页已经预留：

- 教室直播状态。
- 家长/老师/教务权限判断。
- 观看凭证申请接口。
- `<live-player>` 播放容器。

正式接入前必须线下确认：

1. 现有摄像头或 NVR 是否支持 RTMP 推流。
2. 是否能输出低码率子码流。
3. 每间教室是否能绑定独立推流地址。
4. 是否需要腾讯云直播播放域名和推流域名。
5. 是否需要防盗链和过期签名。

## 后续接云开发的建议

1. 把 `services/mock-db.js` 的数据结构迁移为云开发数据库集合。
2. 把 `services/api.js` 的 mock/http 适配改成云函数调用。
3. 文件上传从本地临时路径改成 `wx.cloud.uploadFile`。
4. 直播地址由云函数按权限生成短时有效播放地址。
5. 课表、测试、错题全部按角色做服务端过滤，不只依赖前端隐藏。

## 验证命令

```bash
cd /d D:\Desktop\miniapp
npm run check:js
npm run smoke
```

`check:js` 只检查 JavaScript 语法；`smoke` 会检查页面文件、15 间直播教室、邀请码、后端健康检查、课表、直播凭证、测试习题和错题接口。

微信开发者工具第一次打开本项目时可能提示“您信任此项目的作者吗？”。这是本地新项目的安全确认，点击“信任并运行”后即可进入模拟器。当前项目使用 `touristappid`，CLI 预览二维码可能受测试 AppID 权限限制；正式 AppID 创建后再做上传和预览验证。
