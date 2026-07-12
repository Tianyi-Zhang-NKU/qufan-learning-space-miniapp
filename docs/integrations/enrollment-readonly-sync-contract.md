# 教务系统只读同步接口契约

## 业务边界

报名、插班、调班、退费、退班和财务状态只能在甲方现有报名/教务系统写入。趣帆学习平台只接收课程、课次和成员关系的全量快照或增量事件，不提供反向修改接口。

## 鉴权

- 甲方系统调用平台同步入口时使用服务端签名，不经过小程序前端。
- 请求头：`X-Client-Id`、`X-Timestamp`、`X-Nonce`、`X-Signature`。
- `X-Signature` 为 `HMAC-SHA256(timestamp + "\n" + nonce + "\n" + rawBody, sharedSecret)` 的十六进制小写结果。
- 平台拒绝超过 5 分钟的时间戳、重复 nonce、未知 Client ID 和签名错误请求。

## 全量快照

`POST /enrollment/snapshots`

```json
{
  "snapshotId": "snapshot_20260901_001",
  "generatedAt": "2026-09-01T01:00:00Z",
  "students": [
    { "sourceId": "student_123", "name": "张三", "phone": "13800000000", "grade": "初二", "status": "active" }
  ],
  "teachers": [
    { "sourceId": "teacher_456", "name": "李老师", "phone": "13900000000", "subjects": ["数学"], "status": "active" }
  ],
  "courses": [
    { "sourceId": "course_789", "name": "初二数学A班", "grade": "初二", "subject": "数学", "teacherSourceId": "teacher_456", "status": "active" }
  ],
  "sessions": [
    { "sourceId": "session_001", "courseSourceId": "course_789", "sessionIndex": 1, "title": "第1次课", "date": "2026-09-06", "startTime": "18:30", "endTime": "20:00", "status": "scheduled" }
  ],
  "enrollments": [
    { "studentSourceId": "student_123", "courseSourceId": "course_789", "status": "active", "effectiveAt": "2026-09-01T00:00:00Z" }
  ]
}
```

同一 `snapshotId` 重复提交必须返回第一次处理结果，不重复写入。全量快照按 `sourceId` upsert；快照中缺失的已存在关系只在甲方明确声明 `replaceScope: true` 时才停用，不能默认删除历史学习记录。

## 增量事件

`POST /enrollment/events`

```json
{
  "sourceEventId": "event_20260901_0001",
  "occurredAt": "2026-09-01T01:05:00Z",
  "entityType": "enrollment",
  "operation": "updated",
  "payload": {
    "studentSourceId": "student_123",
    "fromCourseSourceId": "course_789",
    "toCourseSourceId": "course_790",
    "status": "active",
    "effectiveAt": "2026-09-01T01:00:00Z"
  }
}
```

- `entityType`：`student`、`teacher`、`course`、`session`、`enrollment`。
- `operation`：`created`、`updated`、`deactivated`。
- `sourceEventId` 是幂等键；同一键返回原处理结果。
- 事件按 `occurredAt` 排序。迟到事件只更新源数据字段，不回滚已产生的老师反馈、通关、错题和荣誉记录。

## 同步结果

成功时返回 `200`：

```json
{
  "ok": true,
  "sourceEventId": "event_20260901_0001",
  "processedAt": "2026-09-01T01:05:03Z",
  "created": 0,
  "updated": 1,
  "deactivated": 0
}
```

错误码：`INVALID_SIGNATURE`、`EXPIRED_REQUEST`、`DUPLICATE_EVENT`、`UNKNOWN_REFERENCE`、`INVALID_PAYLOAD`、`TEMPORARY_FAILURE`。

## 验收

1. 插班、调班、退班只从事件接口进入，学习小程序没有对应写操作。
2. 同步后学生端、教师端、管理员端在下一次读取时看到同一课程成员关系。
3. 重复事件不产生重复学生、重复课次或重复审计记录。
4. 甲方系统不可读取或修改小程序的反馈、通关、错题、荣誉和管理员备注。
