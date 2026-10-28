# Muse 接入状态

- 源码分支：`feat/muse-video-integration`，基于生产 `085033fb1d2d7e413c89c3f574cdbe449661331f`。
- 已实现 Muse 独立媒体适配、管理员视频页面和视频 API，保留原 Grok 路径。
- 当前仅准备管理员私测，不向普通用户开放，不设公开收费价格。
- 发布目标：`45.207.201.197` 的 `/root/sub2api`；只替换应用容器，不更新 PostgreSQL/Redis，不增加数据库迁移。
- 发布代码提交：`86a318c8fcc490e19429dd40caec02e7365a556b`，版本 `0.2.18-imggen-muse`。
- 已通过相关 Go 回归、276 项 Vitest、ESLint、类型检查和前端构建。
- 用户于 2026-10-28 选择暂不上线，保留已完成发布包；不执行应用重建或生产配置变更。
- Linux 发布包已保留：`D:\CodexBuilds\sub2api-muse-20261028\release.tar.gz`，SHA-256 `1ebc258d6dff05ef175a09d32a46cde8913c3632a6c43c20130745786bb3c602`。
- 后续上线前重新确认生产版本、运行模式、备份及发布包校验，并取得上线授权。
- 标准模式私组隔离已核实：生产 `RUN_MODE=standard`，既有 Composite 组不会动态吸纳新 Muse 账号。
- 私测需要独占 Grok 组，仅授权管理员 1，账号 `media_provider=muse`，模型仅 `muse-spark/muse-image/muse-video`。
- 显式设置图片三档单价 0 和 `video_model_prices.muse-video.480p=0`，避免继承 Grok 默认价。
- 上游为 `https://muse.codemax.store/v1`。真实生成需先在 Muse 后台导入有效账号。
- 账号导入后验证聊天、文生图、图片编辑、文生视频、图生视频、播放下载及任务归属，再决定开放范围和正式价格。
