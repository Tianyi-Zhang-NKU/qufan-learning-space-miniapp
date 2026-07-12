# 趣帆学习空间微信小程序 Demo

第一版核心路线已经收敛为：手机号登录 + 老师上传本讲总结 + 学生/家长查看反馈。直播入口保留，但当前只预留 ClassIn/真实服务接口，不实现伪直播。

## 第一版主流程

1. 用户用报班手机号登录。
2. 小程序按手机号识别老师、学生/家长或管理员身份。
3. 老师进入“我的课程”，选择课程、课次和学生。
4. 老师上传本讲总结：文字、图片、语音。
5. 学生/家长用绑定学生的手机号登录后，查看课程、课次和老师反馈。
6. 图片可查看和下载；语音只能收听，不提供下载入口。
7. 直播入口始终保留，当前按 ClassIn 入口结构预留真实接口字段。

## 演示手机号

| 角色 | 手机号 | 登录后 |
|---|---:|---|
| 学生/家长 | `13800000001` | 我的学习、我的课程、本讲总结 |
| 老师 | `13800000002` | 教师首页、我的课程、上传本讲总结 |
| 管理员 | `13800000003` | 管理首页、数据关系、手机号映射、反馈记录 |

开发阶段 `services/config.js` 使用：

```js
authMode: 'mock' // mock | wechatPhone | sms | http
```

后续可接微信手机号授权或短信验证码，但真实 API 密钥、短信密钥、ClassIn secret 不能放在小程序前端。

## 数据与接口

核心 mock 数据在 `services/mock-db.js`：

- `phoneAccounts`：手机号到老师、学生/家长、管理员档案的映射。
- `students` / `teachers` / `courses` / `courseSessions`：课程与课次基础数据；老师按“一名老师对应一个学科”建模。
- 教务同步：mock 层支持学生插班、调班、退班，并同步课程、班级和课次名单。
- 通关荣誉：课程默认按 80% 通关讲次生成证书，逐讲通关记录独立展示。
- `lessonFeedbacks`：老师上传给学生的本讲总结。
- `mediaFiles`：图片、语音元信息，包含 `storageKey`、`retentionUntil` 和下载权限。
- `classrooms` / `liveRooms`：15 间教室和 ClassIn 直播入口占位。

核心 API 在 `services/api.js`：

- 登录：`loginByPhone`、`logout`、`getCurrentSession`、`getCurrentUserProfile`
- 老师端：`getTeacherDashboard`、`getTeacherCourses`、`getTeacherCourseDetail`、`getTeacherLessonDetail`、`getTeacherStudentsByCourse`
- 反馈：`uploadFeedbackImage`、`uploadFeedbackVoice`、`createLessonFeedback`
- 学生/家长端：`getStudentDashboard`、`getStudentCourses`、`getStudentCourseDetail`、`getStudentLessonFeedbacks`、`getFeedbackDetail`
- 媒体：`getMediaPreview`、`downloadFeedbackImage`、`playFeedbackVoice`
- 管理端：`getAdminOverview`、`getAdminCourseTree`、`getAdminTeacherRelations`、`getAdminStudentRelations`、`syncEnrollmentChange`
- 直播：`requestClassInLiveEntry`

## 页面说明

- `pages/login`：手机号登录页，保留趣帆学习空间品牌。
- `pages/teacher/home`：教师首页，展示今日课程、教师待办、课次合集和学生路径。
- `pages/teacher/courses`：老师课程表，查看课次日历，编辑课次名称和主题。
- `pages/teacher/test-upload`：老师预上传本课题目框，供错题本勾选使用。
- `pages/teacher/feedback-students`：老师按课次进入学生头像网格，适配大班检索。
- `pages/teacher/feedback-detail`：老师编辑学生反馈、勾选错题并确认通关。
- `pages/parent/home`：学生/家长“我的学习”首页，展示课堂小测、本讲总结、通关进度和直播入口。
- `pages/parent/courses`：当前学生课程、传统周课程表和课次反馈数量。
- `pages/parent/quiz` / `pages/parent/summary` / `pages/parent/exercises`：分别承载课堂小测、本讲总结和错题本导出。
- `pages/file-preview`：媒体预览。图片可查看/下载，语音只能播放。
- `pages/live-player`：ClassIn 直播入口占位。
- `pages/admin/home` / `pages/admin/manage`：传统课程表、课程关系、学生详情、课程反馈记录、手机号映射和直播配置占位；数据多时用下拉选择和姓名/手机号搜索缩小范围。

## 真实上线前需要甲方提供

- 真实手机号登录方式：微信手机号授权或短信验证码服务。
- 学员、老师、课程、课次数据 API，以及插班、调班、退班同步事件。
- 媒体存储方案：微信云存储、腾讯云 COS 或其他对象存储。
- 图片下载签名接口。
- 语音播放签名接口。
- ClassIn 对接参数与服务端签名 URL 生成方案。

## 开发与验证

```bash
node scripts/check-js.js
node scripts/smoke-test.js
```

`check-js` 检查 JavaScript 语法；`smoke-test` 覆盖手机号登录、老师课程课次学生路径、反馈创建、图片/语音媒体权限、学生/家长查看反馈、ClassIn 占位、15 间教室/直播占位和旧品牌/旧主流程文案清理。

## 教研电脑后台

本地开发可启动当前 Node 服务后，在浏览器访问：

```bash
node server/index.js
```

`http://127.0.0.1:8787/research-admin`

教研后台与小程序复用资料包、题目单元、课程绑定和权限 API。资料包发布后可以绑定多个平行班；对已发布资料的修改会新建版本，已绑定课次继续引用原版本。

生产环境推荐使用微信云开发：小程序将 `services/config.js` 的 `apiMode` 切换为 `cloud`，并部署名为 `learning-platform` 的云函数。环境 ID、密钥和真实接口地址不得写入前端或提交仓库。部署协议见：

- `docs/integrations/cloudbase-function-contract.md`
- `docs/integrations/enrollment-readonly-sync-contract.md`
- `docs/integrations/classin-entry-contract.md`
