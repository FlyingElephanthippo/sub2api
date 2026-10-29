# Muse 接入状态

- 源码分支：`feat/muse-video-integration`，已同步到 `FlyingElephanthippo/sub2api`，合并正式服本地图片历史提交 `4d17a9efd4a549c03b749871d773f253348c8827`。
- 已实现 Muse 独立媒体适配、管理员视频页面和视频 API，保留原 Grok 路径。
- 已于 2026-10-29 部署正式服，仍仅供管理员私测，不向普通用户开放，不设公开收费价格。
- 发布目标：`45.207.201.197` 的 `/root/sub2api`；只替换应用容器，不更新 PostgreSQL/Redis，不增加数据库迁移。
- 发布代码提交：`fdf62f7eaac3a855da872f38880e466beb2ebe0f`，版本 `0.2.18-imggen-muse`。
- 已通过合并后的相关 Go 回归和 286 项 Vitest；前序构建已通过 ESLint、类型检查和前端构建。
- 用户重新授权上线后完成应用切换，约 8 秒恢复健康；PostgreSQL/Redis 容器及启动时间未变，迁移记录仍为 309。
- Linux 发布包：`D:\CodexBuilds\sub2api-muse-20261028\release.tar.gz`，SHA-256 `3f9992a76fce47419dceb0590f332c08475cfcc9868a8f363c06cdad9ff323c5`。
- 生产镜像：`local/sub2api:local-history-muse-fdf62f7ea-20261028`；旧镜像 `local/sub2api:local-history-4d17a9efd-20261028` 保留用于回退。
- 发布记录及备份：`/srv/muse-sub2api-deploy/20261028-fdf62f7ea`。备份覆盖旧应用、Compose、环境、数据库结构及本次配置数据，不是全库灾备；恢复时只能处理本次变更，不能整表覆盖并发生产写入。
- 标准模式私组隔离已核实：生产 `RUN_MODE=standard`，既有 Composite 组不会动态吸纳新 Muse 账号。
- 已创建独占 Grok 组 `Muse Admin Test`（78），仅授权管理员 1；上游账号 `Muse2API Admin Test`（1376）仅属于该组，`media_provider=muse`，模型仅 `muse-spark/muse-image/muse-video`。
- 显式设置图片三档单价 0 和 `video_model_prices.muse-video.480p=0`，避免继承 Grok 默认价。
- 上游为 `https://muse.codemax.store/v1`。真实生成需先在 Muse 后台导入有效账号。
- 公网入口 `https://api.codemax.store/video-gen`；健康、前端资源、模型列表、无鉴权 401、未知任务/内容 404、无上游账号视频 503 均已验证，未产生成功扣费记录。临时测试 Key 已删除。
- 账号导入后验证聊天、文生图、图片编辑、文生视频、图生视频、播放下载及任务归属，再决定开放范围和正式价格。
- 2026-10-29 修正组 78 的 RPM：6 → 60。视频每 3 秒查询一次，原限额会阻断正常轮询。已检查用户现有任务为 `done`，状态及受保护 MP4 内容均返回 200；没有重新提交生成。配置改动无需重启，修改前的分组快照保存在生产发布目录。
