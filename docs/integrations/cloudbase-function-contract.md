# CloudBase `learning-platform` 云函数契约

## 小程序调用

当 `services/config.js` 的 `apiMode` 设置为 `cloud` 时，小程序通过：

```js
wx.cloud.callFunction({
  name: 'learning-platform',
  data: { method, payload }
});
```

调用云函数。页面层不感知数据来自 Mock、CloudBase 或 HTTP 服务。

## 入参

```json
{
  "method": "getAdminDashboard",
  "payload": {}
}
```

云函数必须从 `cloud.getWXContext()` 获取 openid/unionid，并从 `users`、`userRoles`、`adminGrants` 解析当前身份和范围；不得相信客户端传入的用户 ID、角色、年级或学科范围。

## 成功响应

```json
{
  "ok": true,
  "data": {}
}
```

## 错误响应

```json
{
  "ok": false,
  "code": "NO_PERMISSION",
  "message": "当前身份无权访问该数据。",
  "details": null
}
```

## 首期支持的方法

- 身份：`loginByPhone`（仅开发模式）、`getAvailableRoles`、`selectActiveRole`、`getCurrentSession`、`logout`。
- 教师：`getTeacherDashboard`、`getTeacherCourses`、`getTeacherLessonDetail`、`getTeacherTodos`、`createLessonFeedback`、`confirmStudentPass`、`markStudentWrongQuestions`、`getTeacherPublishedMaterial`。
- 学生：`getStudentDashboard`、`getStudentCourses`、`getStudentCourseDetail`、`getStudentLessonFeedbacks`、`getStudentWrongWorkbook`、`getStudentHonors`。
- 管理：`getAdminDashboard`、`getPassStatistics`、`getFocusStudents`、`saveStudentAttentionNote`、`getAdminGrants`、`saveAdminGrant`。
- 教研：`getResearchMaterialPackages`、`saveMaterialPackage`、`publishMaterialPackage`、`bindMaterialPackage`。

## 部署前检查

1. 在微信开发者工具或 CloudBase CLI 配置真实环境 ID，不能提交到仓库。
2. 建立 `users`、`userRoles`、`adminGrants`、`materialPackages`、`materialUnits`、`materialPublishScopes`、`courseMaterialBindings` 等集合及索引。
3. 给云函数最小化数据库和云存储权限；前端只通过临时 URL 读取私有文件。
4. 将教务同步和 ClassIn 密钥仅保存为云函数环境变量。
5. 用真实微信手机号授权替换开发期 `loginByPhone`，再关闭演示手机号入口。
