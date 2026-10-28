# Muse 接入状态

- 源码分支：`feat/muse-video-integration`，基于生产 `085033fb1d2d7e413c89c3f574cdbe449661331f`。
- 已实现 Muse 独立媒体适配、管理员视频页面和视频 API，保留原 Grok 路径。
- 当前仅准备管理员私测，不向普通用户开放，不设公开收费价格。
- 发布目标：`45.207.201.197` 的 `/root/sub2api`；只替换应用容器，不更新 PostgreSQL/Redis，不增加数据库迁移。
- 发布前完成相关 Go/Vitest、类型检查和前端构建；生产变更前按项目运维规则确认影响。
- 私测需要独占 Grok 组，仅授权管理员 1，账号 `media_provider=muse`，模型仅 `muse-spark/muse-image/muse-video`。
- 显式设置图片三档单价 0 和 `video_model_prices.muse-video.480p=0`，避免继承 Grok 默认价。
- 上游为 `https://muse.codemax.store/v1`。真实生成需先在 Muse 后台导入有效账号。
- 账号导入后验证聊天、文生图、图片编辑、文生视频、图生视频、播放下载及任务归属，再决定开放范围和正式价格。
