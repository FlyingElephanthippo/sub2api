# Muse 管理员测试

网页入口：`/video-gen`，仅管理员可进入；图片入口沿用现有图片生成页面。

本方案要求 `RUN_MODE=standard`。`simple` 模式跳过账号分组隔离，不适用于此次管理员私测。

为 Muse 新建独占测试组，平台为 `grok`，只授权测试管理员，不修改已有用户分组或密钥。账号必须为 API Key 类型并设置：

```json
{
  "base_url": "https://muse.codemax.store/v1",
  "media_provider": "muse",
  "model_mapping": {
    "muse-spark": "muse-spark",
    "muse-image": "muse-image",
    "muse-video": "muse-video"
  }
}
```

API Key 由管理员在 Sub2API 中单独创建并绑定该测试组。上游密钥只保存在服务端账号凭据中。

测试价格显式设为图片 1K/2K/4K 三档 0，视频 `{"muse-video":{"480p":0}}`。`480p` 是适配器计费档，不承诺输出分辨率。Muse 聊天上游目前返回 0 token 用量，不可据此设计正式收费。

## 视频 API

使用测试组密钥作为 `Authorization: Bearer YOUR_TEST_KEY`，请求 Sub2API 的域名：

```http
GET /v1/models?purpose=video
POST /v1/videos
Content-Type: application/json

{"model":"muse-video","prompt":"海边日落，镜头缓慢推进","duration":6,"aspect_ratio":"16:9"}
```

创建响应包含 `id/task_id/request_id`；`GET /v1/videos/{id}` 查询 `pending/done/failed`；完成后 `GET /v1/videos/{id}/content` 获取视频，三个请求均需同一密钥。API 同时兼容 `seconds` 和 multipart `input_reference` 单张参考图。参考图支持 PNG/JPEG/WebP、最大 10 MiB；请求时长可选 5/6/8/10 秒，实际时长与画质由 Muse 决定。

创建失败不要自动重发；创建连接中断也可能已提交上游。网页切换不会重复提交，轮询可暂停/恢复。任务 ID 及 API Key 不应放进外部媒体 URL。

## 图片 API

`muse-image` 使用 `/v1/images/generations` 和 `/v1/images/edits`。仅支持同步 `n=1`，编辑最多四张参考图，单张最大 10 MiB、总计 24 MiB，不支持蒙版。保留 `size/aspect_ratio`，不冒用其他提供方模型名称。

## 发布和验证

当前发布不增加数据库迁移。备份旧镜像、Compose 和应用二进制，构建新镜像后只重建 `sub2api`。验证健康检查、管理员视频页面、三模型可见性、无鉴权 401、未知任务 404、无 Muse 账号时视频创建 503、未产生成功扣费。已有聊天和图片回归也应通过。

Muse 账号导入后，仍需真实生成、编辑、视频播放下载与跨密钥拒绝访问验证，完成后再开放普通用户。
