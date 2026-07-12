# ClassIn 课堂入口接口契约

## 业务边界

ClassIn 入口不按教室手工配置。每一节课堂使用甲方提供的课程 ID、老师 ID、课节 ID 定位，平台服务端按当前小程序用户身份生成短时有效入口。

## 课节映射

平台课程课次保存以下外部字段：

```json
{
  "classInCourseId": "classin_course_001",
  "classInTeacherId": "classin_teacher_001",
  "classInSessionId": "classin_session_001"
}
```

三项任一缺失时，学生端显示“课堂入口暂未配置”，不展示示例视频或伪造链接。

## 服务端请求

`POST /classin/entry`

```json
{
  "platformUserId": "user_13800000001",
  "platformRole": "parent",
  "studentSourceId": "student_123",
  "courseSourceId": "course_789",
  "sessionSourceId": "session_001",
  "classInCourseId": "classin_course_001",
  "classInTeacherId": "classin_teacher_001",
  "classInSessionId": "classin_session_001"
}
```

服务端必须先验证学生在该课节的有效报名关系，教师仅能进入自己的课次，管理员必须通过年级/学科授权。ClassIn 的 app secret、签名和回调校验全部在云函数或后端完成。

## 响应

```json
{
  "status": "ready",
  "entryUrl": "https://provider.example.com/signed-entry",
  "expiresAt": "2026-09-01T02:00:00Z",
  "provider": "classin",
  "playbackUrl": "",
  "requestId": "classin_req_001"
}
```

- `entryUrl` 有效期不超过 10 分钟。
- 过期后小程序重新请求，不能缓存永久链接。
- 直播未开始时返回 `status: "scheduled"` 与开始时间。
- 回放只有甲方明确提供授权地址后才返回 `playbackUrl`。

## 错误码

`NO_ENROLLMENT`、`NO_SCOPE`、`SESSION_NOT_CONFIGURED`、`SESSION_NOT_STARTED`、`PROVIDER_UNAVAILABLE`、`SIGNATURE_FAILED`。

## 验收

1. 小程序源码和日志中不出现 ClassIn secret。
2. 换教室不会改变课节映射；仅外部课程/老师/课节 ID 决定入口。
3. 无权限用户不能拿到或复用已签发入口。
4. 入口失败时展示业务错误态，不降级为示例视频。
